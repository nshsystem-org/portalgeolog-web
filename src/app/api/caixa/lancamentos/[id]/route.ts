import { NextResponse } from "next/server";
import {
  CAIXA_ATTACHMENT_BUCKET,
  CAIXA_ATTACHMENT_PREFIX,
  CAIXA_ALLOWED_MIME_TYPES,
  CAIXA_MAX_FILE_SIZE,
  CAIXA_LANCAMENTO_SELECT,
  createAdminClient,
  getAuthUser,
  hasCaixaAccess,
  mapCaixaLancamentoRow,
  sanitizeFileName,
  type CaixaLancamentoJoinRow,
} from "../../_shared";

export const runtime = "edge";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (!(await hasCaixaAccess(user.id))) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Verifica existência e origem (não permite editar lançamentos automáticos)
    const { data: existing, error: existingError } = await adminClient
      .from("caixa_lancamentos")
      .select("id, origem, conta_id, anexo_path")
      .eq("id", id)
      .single();
    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Lançamento não encontrado" },
        { status: 404 },
      );
    }
    if (existing.origem !== "manual") {
      return NextResponse.json(
        { error: "Lançamentos automáticos não podem ser editados." },
        { status: 409 },
      );
    }

    const formData = await request.formData();
    const updates: Record<string, unknown> = {};

    const contaId = String(formData.get("contaId") || "").trim();
    if (contaId) {
      const { data: contaRow } = await adminClient
        .from("caixa_contas")
        .select("id, ativa")
        .eq("id", contaId)
        .single();
      if (!contaRow) {
        return NextResponse.json(
          { error: "Conta não encontrada" },
          { status: 404 },
        );
      }
      if (contaRow.ativa === false) {
        return NextResponse.json(
          { error: "Conta inativa. Selecione uma conta ativa." },
          { status: 400 },
        );
      }
      updates.conta_id = contaId;
    }

    const tipo = String(formData.get("tipo") || "").trim();
    if (tipo) {
      if (!["entrada", "saida"].includes(tipo)) {
        return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
      }
      updates.tipo = tipo;
    }

    const valorRaw = formData.get("valor");
    if (valorRaw !== null && String(valorRaw).trim() !== "") {
      const valor = Number(String(valorRaw));
      if (Number.isNaN(valor) || valor <= 0) {
        return NextResponse.json({ error: "valor inválido" }, { status: 400 });
      }
      updates.valor = valor;
    }

    const dataStr = formData.get("data");
    if (dataStr !== null && String(dataStr).trim() !== "") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataStr))) {
        return NextResponse.json({ error: "data inválida" }, { status: 400 });
      }
      updates.data = String(dataStr);
    }

    if (formData.get("descricao") !== null) {
      updates.descricao = String(formData.get("descricao") || "").trim();
    }
    if (formData.get("categoria") !== null) {
      updates.categoria = String(formData.get("categoria") || "outros").trim();
    }
    const formaRaw = formData.get("formaPagamento");
    if (formaRaw !== null && String(formaRaw).trim() !== "") {
      updates.forma_pagamento = String(formaRaw).trim();
    }

    if (formData.get("clienteId") !== null) {
      const v = String(formData.get("clienteId") || "").trim();
      updates.cliente_id = v || null;
    }
    if (formData.get("parceiroId") !== null) {
      const v = String(formData.get("parceiroId") || "").trim();
      updates.parceiro_id = v || null;
    }
    if (formData.get("driverId") !== null) {
      const v = String(formData.get("driverId") || "").trim();
      updates.driver_id = v || null;
    }

    const file = formData.get("file");
    if (file instanceof File) {
      if (!CAIXA_ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: "Comprovante inválido. Use PDF, PNG, JPG ou WEBP." },
          { status: 400 },
        );
      }
      if (file.size > CAIXA_MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Arquivo muito grande. Máximo 20MB." },
          { status: 400 },
        );
      }
      // Remove anexo anterior
      if (existing.anexo_path) {
        await adminClient.storage
          .from(CAIXA_ATTACHMENT_BUCKET)
          .remove([existing.anexo_path]);
      }
      const contaIdFinal = (updates.conta_id as string) || existing.conta_id;
      const fileName = `${Date.now()}_${sanitizeFileName(file.name)}`;
      const storagePath = `${CAIXA_ATTACHMENT_PREFIX}/${contaIdFinal}/${fileName}`;
      const fileBuffer = await file.arrayBuffer();
      const { error: uploadError } = await adminClient.storage
        .from(CAIXA_ATTACHMENT_BUCKET)
        .upload(storagePath, new Blob([fileBuffer], { type: file.type }), {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      updates.anexo_path = storagePath;
    }

    const { data: updated, error: updateError } = await adminClient
      .from("caixa_lancamentos")
      .update(updates)
      .eq("id", id)
      .select(CAIXA_LANCAMENTO_SELECT)
      .single();

    if (updateError) throw updateError;

    const lancamento = mapCaixaLancamentoRow(
      updated as unknown as CaixaLancamentoJoinRow,
    );
    return NextResponse.json({ lancamento });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (!(await hasCaixaAccess(user.id))) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: existing, error: existingError } = await adminClient
      .from("caixa_lancamentos")
      .select("id, origem, anexo_path")
      .eq("id", id)
      .single();
    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Lançamento não encontrado" },
        { status: 404 },
      );
    }
    if (existing.origem !== "manual") {
      return NextResponse.json(
        {
          error:
            "Lançamentos automáticos (recebimento/repasse de OS) não podem ser excluídos diretamente.",
        },
        { status: 409 },
      );
    }

    if (existing.anexo_path) {
      await adminClient.storage
        .from(CAIXA_ATTACHMENT_BUCKET)
        .remove([existing.anexo_path]);
    }

    const { error: deleteError } = await adminClient
      .from("caixa_lancamentos")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
