import { NextResponse } from "next/server";
import { createAdminClient, getAuthUser, hasCaixaAccess } from "../_shared";

export const runtime = "edge";

type StatsQuery = {
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
};

function parseStatsQuery(searchParams: URLSearchParams): StatsQuery {
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
    const q = parseStatsQuery(url.searchParams);

    const adminClient = createAdminClient();

    // Query base para o período + filtros
    const buildQuery = () => {
      let query = adminClient
        .from("caixa_lancamentos")
        .select(
          "id, tipo, valor, conta_id, conta:caixa_contas(id, nome, tipo, saldo_inicial, ativa)",
        );
      if (q.dataInicio) query = query.gte("data", q.dataInicio);
      if (q.dataFim) query = query.lte("data", q.dataFim);
      if (q.contaId) query = query.eq("conta_id", q.contaId);
      if (q.tipo && ["entrada", "saida"].includes(q.tipo)) {
        query = query.eq("tipo", q.tipo);
      }
      if (q.categoria) query = query.eq("categoria", q.categoria);
      if (q.formaPagamento)
        query = query.eq("forma_pagamento", q.formaPagamento);
      if (q.clienteId) query = query.eq("cliente_id", q.clienteId);
      if (q.parceiroId) query = query.eq("parceiro_id", q.parceiroId);
      if (q.driverId) query = query.eq("driver_id", q.driverId);
      if (q.origem) query = query.eq("origem", q.origem);
      return query;
    };

    // Período: lê todos os lançamentos do período (com filtros aplicados)
    const { data: periodRows, error: periodError } = await buildQuery();
    if (periodError) throw periodError;

    const rows = (
      (periodRows ?? []) as unknown as Array<{
        id: string;
        tipo: string;
        valor: number | string | null;
        conta_id: string;
        conta: {
          id: string;
          nome: string;
          tipo: string;
          saldo_inicial: number | string | null;
          ativa: boolean | null;
        } | null;
      }>
    ).map((row) => ({
      ...row,
      // Supabase returns joins as arrays; normalize to single object.
      conta: Array.isArray(row.conta) ? row.conta[0] : row.conta,
    }));

    let totalEntradas = 0;
    let totalSaidas = 0;
    const saldosContaPeriodo = new Map<
      string,
      { contaId: string; contaNome: string; contaTipo: string; delta: number }
    >();

    rows.forEach((row) => {
      const v = Number(row.valor || 0);
      if (row.tipo === "entrada") {
        totalEntradas += v;
      } else if (row.tipo === "saida") {
        totalSaidas += v;
      }
      if (row.conta) {
        const cur = saldosContaPeriodo.get(row.conta_id);
        const delta = row.tipo === "entrada" ? v : -v;
        if (cur) {
          cur.delta += delta;
        } else {
          saldosContaPeriodo.set(row.conta_id, {
            contaId: row.conta_id,
            contaNome: row.conta.nome,
            contaTipo: row.conta.tipo,
            delta,
          });
        }
      }
    });

    // Saldos consolidados: lê diretamente de saldo_atual (materializado por trigger)
    // — não precisa mais escanear todos os lançamentos
    const { data: contas, error: contasError } = await adminClient
      .from("caixa_contas")
      .select("id, nome, tipo, saldo_atual, ativa")
      .eq("ativa", true);
    if (contasError) throw contasError;

    const contasList =
      (contas as Array<{
        id: string;
        nome: string;
        tipo: string;
        saldo_atual: number | string | null;
        ativa: boolean | null;
      }>) ?? [];

    const saldosPorConta = contasList.map((c) => ({
      contaId: c.id,
      contaNome: c.nome,
      contaTipo: c.tipo,
      saldo: Number(c.saldo_atual || 0),
    }));
    const saldoConsolidado = saldosPorConta.reduce(
      (sum, c) => sum + c.saldo,
      0,
    );

    return NextResponse.json({
      totalEntradas,
      totalSaidas,
      saldoPeriodo: totalEntradas - totalSaidas,
      saldoConsolidado,
      totalLancamentos: rows.length,
      saldosPorConta,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
