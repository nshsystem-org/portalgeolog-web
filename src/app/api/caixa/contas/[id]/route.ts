import { NextResponse } from "next/server";
import {
  createAdminClient,
  getAuthUser,
  hasCaixaAccess,
  mapCaixaContaRow,
  type CaixaContaRow,
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

    const body = (await request.json()) as {
      nome?: string;
      tipo?: string;
      saldoInicial?: number | string;
      ativa?: boolean;
      isDefault?: boolean;
    };

    const updates: Record<string, unknown> = {};
    if (body.nome !== undefined) {
      const nome = String(body.nome).trim();
      if (!nome) {
        return NextResponse.json({ error: "Nome inválido" }, { status: 400 });
      }
      updates.nome = nome;
    }
    if (body.tipo !== undefined) {
      if (!["caixa", "banco", "pix", "carteira"].includes(body.tipo)) {
        return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
      }
      updates.tipo = body.tipo;
    }
    if (body.saldoInicial !== undefined) {
      const saldo = Number(body.saldoInicial);
      if (Number.isNaN(saldo)) {
        return NextResponse.json(
          { error: "Saldo inicial inválido" },
          { status: 400 },
        );
      }
      updates.saldo_inicial = saldo;
    }
    if (body.ativa !== undefined) updates.ativa = Boolean(body.ativa);
    if (body.isDefault !== undefined) {
      updates.is_default = Boolean(body.isDefault);
    }

    const adminClient = createAdminClient();

    if (body.isDefault) {
      const { error: unmarkError } = await adminClient
        .from("caixa_contas")
        .update({ is_default: false })
        .eq("is_default", true)
        .neq("id", id);
      if (unmarkError) throw unmarkError;
    }

    const { data, error } = await adminClient
      .from("caixa_contas")
      .update(updates)
      .eq("id", id)
      .select("id, nome, tipo, saldo_inicial, ativa, is_default, created_at")
      .single();

    if (error) throw error;

    const conta = mapCaixaContaRow(data as CaixaContaRow);
    return NextResponse.json({ conta });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
