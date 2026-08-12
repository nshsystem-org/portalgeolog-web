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
} from "../_shared";

export const runtime = "edge";

type ListQuery = {
  dataInicio?: string;
  dataFim?: string;
  contaId?: string;
  tipo?: string;
  categoria?: string;
  formaPagamento?: string;
  clienteId?: string;
  parceiroId?: string;
  driverId?: string;
  origem?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

function parseListQuery(searchParams: URLSearchParams): ListQuery {
  const get = (key: string) => searchParams.get(key) || undefined;
  return {
    dataInicio: get("dataInicio"),
    dataFim: get("dataFim"),
    contaId: get("contaId"),
    tipo: get("tipo"),
    categoria: get("categoria"),
    formaPagamento: get("formaPagamento"),
    clienteId: get("clienteId"),
    parceiroId: get("parceiroId"),
    driverId: get("driverId"),
    origem: get("origem"),
    q: get("q"),
    page: get("page") ? Number(get("page")) : undefined,
    pageSize: get("pageSize") ? Number(get("pageSize")) : undefined,
  };
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (!(await hasCaixaAccess(user.id))) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const url = new URL(request.url);
    const q = parseListQuery(url.searchParams);
    const page = Math.max(1, q.page || 1);
    const pageSize = Math.max(1, Math.min(q.pageSize || 20, 100));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const adminClient = createAdminClient();
    let query = adminClient
      .from("caixa_lancamentos")
      .select(CAIXA_LANCAMENTO_SELECT, { count: "exact" });

    if (q.dataInicio) query = query.gte("data", q.dataInicio);
    if (q.dataFim) query = query.lte("data", q.dataFim);
    if (q.contaId) query = query.eq("conta_id", q.contaId);
    if (q.tipo && ["entrada", "saida"].includes(q.tipo)) {
      query = query.eq("tipo", q.tipo);
    }
    if (q.categoria) query = query.eq("categoria", q.categoria);
    if (q.formaPagamento) query = query.eq("forma_pagamento", q.formaPagamento);
    if (q.clienteId) query = query.eq("cliente_id", q.clienteId);
    if (q.parceiroId) query = query.eq("parceiro_id", q.parceiroId);
    if (q.driverId) query = query.eq("driver_id", q.driverId);
    if (q.origem) query = query.eq("origem", q.origem);
    if (q.q) {
      const term = q.q.trim();
      if (term) {
        query = query.or(`descricao.ilike.%${term}%,categoria.ilike.%${term}%`);
      }
    }

    query = query
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    const { data, count, error } = await query;

    if (error) throw error;

    const items = ((data ?? []) as unknown as CaixaLancamentoJoinRow[]).map(
      mapCaixaLancamentoRow,
    );
    return NextResponse.json({
      items,
      totalCount: count ?? 0,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (!(await hasCaixaAccess(user.id))) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const formData = await request.formData();
    const contaId = String(formData.get("contaId") || "").trim();
    const tipo = String(formData.get("tipo") || "").trim();
    const valorRaw = String(formData.get("valor") || "0").trim();
    const dataStr = String(formData.get("data") || "").trim();
    const descricao = String(formData.get("descricao") || "").trim();
    const categoria = String(formData.get("categoria") || "outros").trim();
    const formaPagamento = String(
      formData.get("formaPagamento") || "outro",
    ).trim();
    const clienteId = String(formData.get("clienteId") || "").trim() || null;
    const parceiroId = String(formData.get("parceiroId") || "").trim() || null;
    const driverId = String(formData.get("driverId") || "").trim() || null;
    const osId = String(formData.get("osId") || "").trim() || null;
    const file = formData.get("file");

    if (!contaId) {
      return NextResponse.json(
        { error: "contaId é obrigatório" },
        { status: 400 },
      );
    }
    if (!["entrada", "saida"].includes(tipo)) {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }
    const valor = Number(valorRaw);
    if (Number.isNaN(valor) || valor <= 0) {
      return NextResponse.json({ error: "valor inválido" }, { status: 400 });
    }
    if (!dataStr || !/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
      return NextResponse.json({ error: "data inválida" }, { status: 400 });
    }
    if (!formaPagamento) {
      return NextResponse.json(
        { error: "formaPagamento é obrigatória" },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();

    // Valida que a conta existe e está ativa
    const { data: contaRow, error: contaError } = await adminClient
      .from("caixa_contas")
      .select("id, ativa")
      .eq("id", contaId)
      .single();
    if (contaError || !contaRow) {
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

    let anexoPath: string | null = null;
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
      const fileName = `${Date.now()}_${sanitizeFileName(file.name)}`;
      const storagePath = `${CAIXA_ATTACHMENT_PREFIX}/${contaId}/${fileName}`;
      const fileBuffer = await file.arrayBuffer();
      const { error: uploadError } = await adminClient.storage
        .from(CAIXA_ATTACHMENT_BUCKET)
        .upload(storagePath, new Blob([fileBuffer], { type: file.type }), {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      anexoPath = storagePath;
    }

    const insertRow = {
      conta_id: contaId,
      tipo,
      valor,
      data: dataStr,
      descricao,
      categoria,
      forma_pagamento: formaPagamento,
      cliente_id: clienteId,
      parceiro_id: parceiroId,
      driver_id: driverId,
      os_id: osId,
      origem: "manual",
      anexo_path: anexoPath,
      created_by: user.id,
    };

    const { data: inserted, error: insertError } = await adminClient
      .from("caixa_lancamentos")
      .insert(insertRow)
      .select(CAIXA_LANCAMENTO_SELECT)
      .single();

    if (insertError) throw insertError;

    const lancamento = mapCaixaLancamentoRow(
      inserted as unknown as CaixaLancamentoJoinRow,
    );
    return NextResponse.json({ lancamento }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
