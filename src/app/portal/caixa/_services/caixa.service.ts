import type { PaginatedResult } from "@/lib/supabase/queries";
import type {
  CaixaConta,
  CaixaFormaPagamento,
  CaixaLancamento,
  CaixaLancamentoOrigem,
  CaixaOverview,
  CaixaQueryFilters,
} from "../_lib/caixa-page";

// =============================================================================
// Tipos de payload
// =============================================================================

export type CaixaContaPayload = {
  nome: string;
  tipo: CaixaConta["tipo"];
  saldoInicial: number;
  ativa: boolean;
  isDefault: boolean;
};

export type CaixaLancamentoPayload = {
  contaId: string;
  tipo: "entrada" | "saida";
  valor: number;
  data: string;
  descricao: string;
  categoria: string;
  formaPagamento: CaixaFormaPagamento;
  clienteId?: string;
  parceiroId?: string;
  driverId?: string;
  fornecedorId?: string;
  osId?: string;
  file?: File | null;
};

// =============================================================================
// Helpers internos
// =============================================================================

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

function buildFiltersQuery(
  base: URLSearchParams,
  filters: CaixaQueryFilters,
): URLSearchParams {
  const params = new URLSearchParams(base);
  if (filters.dataInicio) params.set("dataInicio", filters.dataInicio);
  if (filters.dataFim) params.set("dataFim", filters.dataFim);
  if (filters.contaId) params.set("contaId", filters.contaId);
  if (filters.tipo) params.set("tipo", filters.tipo);
  if (filters.categoria) params.set("categoria", filters.categoria);
  if (filters.formaPagamento)
    params.set("formaPagamento", filters.formaPagamento);
  if (filters.clienteId) params.set("clienteId", filters.clienteId);
  if (filters.parceiroId) params.set("parceiroId", filters.parceiroId);
  if (filters.driverId) params.set("driverId", filters.driverId);
  if (filters.origem) params.set("origem", filters.origem);
  if (filters.searchTerm) params.set("q", filters.searchTerm);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  return params;
}

// =============================================================================
// Contas
// =============================================================================

export async function listContas(): Promise<CaixaConta[]> {
  const response = await fetch("/api/caixa/contas", { credentials: "include" });
  const body = (await parseJson(response)) as {
    error?: string;
    contas?: CaixaConta[];
  };
  if (!response.ok) {
    throw new Error(body.error || "Falha ao carregar contas.");
  }
  return body.contas ?? [];
}

export async function createConta(
  payload: CaixaContaPayload,
): Promise<CaixaConta> {
  const response = await fetch("/api/caixa/contas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const body = (await parseJson(response)) as {
    error?: string;
    conta?: CaixaConta;
  };
  if (!response.ok || !body.conta) {
    throw new Error(body.error || "Falha ao criar conta.");
  }
  return body.conta;
}

export async function updateConta(
  id: string,
  payload: Partial<CaixaContaPayload>,
): Promise<CaixaConta> {
  const response = await fetch(`/api/caixa/contas/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const body = (await parseJson(response)) as {
    error?: string;
    conta?: CaixaConta;
  };
  if (!response.ok || !body.conta) {
    throw new Error(body.error || "Falha ao atualizar conta.");
  }
  return body.conta;
}

// =============================================================================
// Lançamentos
// =============================================================================

export async function listLancamentos(
  filters: CaixaQueryFilters,
): Promise<PaginatedResult<CaixaLancamento>> {
  const params = buildFiltersQuery(new URLSearchParams(), filters);
  const response = await fetch(`/api/caixa/lancamentos?${params.toString()}`, {
    credentials: "include",
  });
  const body = (await parseJson(response)) as {
    error?: string;
    items?: CaixaLancamento[];
    totalCount?: number;
  };
  if (!response.ok) {
    throw new Error(body.error || "Falha ao carregar lançamentos.");
  }
  return {
    items: body.items ?? [],
    totalCount: body.totalCount ?? 0,
  };
}

export async function createLancamento(
  payload: CaixaLancamentoPayload,
): Promise<CaixaLancamento> {
  const formData = new FormData();
  formData.append("contaId", payload.contaId);
  formData.append("tipo", payload.tipo);
  formData.append("valor", String(payload.valor));
  formData.append("data", payload.data);
  formData.append("descricao", payload.descricao);
  formData.append("categoria", payload.categoria);
  formData.append("formaPagamento", payload.formaPagamento);
  if (payload.clienteId) formData.append("clienteId", payload.clienteId);
  if (payload.parceiroId) formData.append("parceiroId", payload.parceiroId);
  if (payload.driverId) formData.append("driverId", payload.driverId);
  if (payload.fornecedorId)
    formData.append("fornecedorId", payload.fornecedorId);
  if (payload.osId) formData.append("osId", payload.osId);
  if (payload.file) formData.append("file", payload.file);

  const response = await fetch("/api/caixa/lancamentos", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const body = (await parseJson(response)) as {
    error?: string;
    lancamento?: CaixaLancamento;
  };
  if (!response.ok || !body.lancamento) {
    throw new Error(body.error || "Falha ao registrar lançamento.");
  }
  return body.lancamento;
}

export async function updateLancamento(
  id: string,
  updates: {
    contaId?: string;
    tipo?: "entrada" | "saida";
    valor?: number;
    data?: string;
    descricao?: string;
    categoria?: string;
    formaPagamento?: CaixaFormaPagamento;
    clienteId?: string | null;
    parceiroId?: string | null;
    driverId?: string | null;
    fornecedorId?: string | null;
    file?: File | null;
  },
): Promise<CaixaLancamento> {
  const formData = new FormData();
  if (updates.contaId) formData.append("contaId", updates.contaId);
  if (updates.tipo) formData.append("tipo", updates.tipo);
  if (typeof updates.valor === "number")
    formData.append("valor", String(updates.valor));
  if (updates.data) formData.append("data", updates.data);
  if (updates.descricao !== undefined)
    formData.append("descricao", updates.descricao);
  if (updates.categoria) formData.append("categoria", updates.categoria);
  if (updates.formaPagamento)
    formData.append("formaPagamento", updates.formaPagamento);
  if (updates.clienteId !== undefined)
    formData.append("clienteId", updates.clienteId || "");
  if (updates.parceiroId !== undefined)
    formData.append("parceiroId", updates.parceiroId || "");
  if (updates.driverId !== undefined)
    formData.append("driverId", updates.driverId || "");
  if (updates.fornecedorId !== undefined)
    formData.append("fornecedorId", updates.fornecedorId || "");
  if (updates.file) formData.append("file", updates.file);

  const response = await fetch(`/api/caixa/lancamentos/${id}`, {
    method: "PATCH",
    body: formData,
    credentials: "include",
  });
  const body = (await parseJson(response)) as {
    error?: string;
    lancamento?: CaixaLancamento;
  };
  if (!response.ok || !body.lancamento) {
    throw new Error(body.error || "Falha ao atualizar lançamento.");
  }
  return body.lancamento;
}

export async function archiveLancamento(id: string): Promise<void> {
  const response = await fetch(`/api/caixa/lancamentos/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const body = (await parseJson(response)) as { error?: string };
    throw new Error(body.error || "Falha ao arquivar lançamento.");
  }
}

// =============================================================================
// Stats / Saldos
// =============================================================================

export async function getCaixaStats(
  filters: Omit<CaixaQueryFilters, "page" | "pageSize" | "searchTerm">,
): Promise<CaixaOverview> {
  const params = buildFiltersQuery(new URLSearchParams(), filters);
  const response = await fetch(`/api/caixa/stats?${params.toString()}`, {
    credentials: "include",
  });
  const body = (await parseJson(response)) as CaixaOverview & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body.error || "Falha ao carregar totais do caixa.");
  }
  return body;
}

// =============================================================================
// Anexos
// =============================================================================

export async function getComprovanteUrl(lancamentoId: string): Promise<string> {
  const response = await fetch(`/api/caixa/anexos/${lancamentoId}`, {
    credentials: "include",
  });
  const body = (await parseJson(response)) as {
    error?: string;
    signedUrl?: string;
  };
  if (!response.ok) {
    throw new Error(body.error || "Falha ao abrir comprovante.");
  }
  if (!body.signedUrl) {
    throw new Error("URL do comprovante não encontrada.");
  }
  return body.signedUrl;
}

// =============================================================================
// Helper: origem editável
// =============================================================================

export const isLancamentoEditavel = (
  origem: CaixaLancamentoOrigem | string | null | undefined,
): boolean => origem === "manual";
