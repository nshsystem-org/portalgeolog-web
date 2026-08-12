import { NextResponse } from "next/server";
import {
  createAdminClient,
  getAuthUser,
  hasCaixaAccess,
  mapCaixaContaRow,
  type CaixaContaRow,
} from "../_shared";

export const runtime = "edge";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (!(await hasCaixaAccess(user.id))) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("caixa_contas")
      .select("id, nome, tipo, saldo_inicial, ativa, is_default, created_at")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) throw error;

    const contas =
      (data as CaixaContaRow[] | null)?.map(mapCaixaContaRow) ?? [];
    return NextResponse.json({ contas });
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

    const body = (await request.json()) as {
      nome?: string;
      tipo?: string;
      saldoInicial?: number | string;
      ativa?: boolean;
      isDefault?: boolean;
    };

    const nome = String(body.nome || "").trim();
    if (!nome) {
      return NextResponse.json(
        { error: "Nome é obrigatório" },
        { status: 400 },
      );
    }
    const tipo = String(body.tipo || "caixa").trim();
    if (!["caixa", "banco", "pix", "carteira"].includes(tipo)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }
    const saldoInicial = Number(body.saldoInicial || 0);
    if (Number.isNaN(saldoInicial)) {
      return NextResponse.json(
        { error: "Saldo inicial inválido" },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();

    // Se isDefault=true, desmarca outras contas default primeiro
    if (body.isDefault) {
      const { error: unmarkError } = await adminClient
        .from("caixa_contas")
        .update({ is_default: false })
        .eq("is_default", true);
      if (unmarkError) throw unmarkError;
    }

    const { data, error } = await adminClient
      .from("caixa_contas")
      .insert({
        nome,
        tipo,
        saldo_inicial: saldoInicial,
        ativa: body.ativa !== false,
        is_default: Boolean(body.isDefault),
      })
      .select("id, nome, tipo, saldo_inicial, ativa, is_default, created_at")
      .single();

    if (error) throw error;

    const conta = mapCaixaContaRow(data as CaixaContaRow);
    return NextResponse.json({ conta }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
