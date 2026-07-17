import type { ReportPayload } from "@/components/financeiro/RelatorioModal";
import { fetchOSById, fetchOSFinanceStats } from "@/lib/supabase/queries";
import type { FinanceQueryFilters } from "@/lib/supabase/queries";
import type { OrderService } from "@/context/DataContext";
import type { FinanceOverview } from "../_lib/financeiro-page";

export type FaturarPayload = {
  osId: string;
  file: File;
  tipoDocumento: string;
  observacao: string;
};

export type FaturamentoLotePayload = {
  dataInicio: string;
  dataFim: string;
  clienteId: string;
  centroCustoId: string;
  file: File | null;
  tipoDocumento: string;
};

export type FaturamentoLotePreview = {
  count: number;
  totalValue: number;
  customerName: string;
  centerName: string | null;
};

export type FaturamentoLoteResult = {
  count: number;
  totalValue: number;
};

export type ConfirmarRecebimentoPayload = {
  osId: string;
  observacao: string;
};

export async function registrarRepasse(osId: string): Promise<void> {
  const response = await fetch("/api/financeiro/repasse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ osId }),
  });

  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(body?.error || "Falha ao registrar repasse.");
  }
}

export type RepasseLoteResult = {
  count: number;
  totalValue: number;
};

export async function registrarRepasseLote(
  driverId: string,
  dataInicio: string,
  dataFim: string,
): Promise<RepasseLoteResult> {
  const response = await fetch("/api/financeiro/repasse/lote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ driverId, dataInicio, dataFim }),
  });

  const body = (await response.json().catch(() => null)) as {
    error?: string;
    count?: number;
    totalValue?: number;
  } | null;

  if (!response.ok) {
    throw new Error(body?.error || "Falha ao registrar repasse em lote.");
  }

  return {
    count: body?.count ?? 0,
    totalValue: body?.totalValue ?? 0,
  };
}

export async function getFinanceStats(
  filters: FinanceQueryFilters,
): Promise<FinanceOverview> {
  return fetchOSFinanceStats(filters);
}

export async function getOSById(id: string): Promise<OrderService | null> {
  return fetchOSById(id);
}

export async function faturarOS(payload: FaturarPayload): Promise<void> {
  const formData = new FormData();
  formData.append("osId", payload.osId);
  formData.append("file", payload.file);
  formData.append("tipoDocumento", payload.tipoDocumento);
  formData.append("observacao", payload.observacao);

  const response = await fetch("/api/financeiro/faturar", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(body?.error || "Falha ao faturar a OS.");
  }
}

export async function previewFaturamentoLote(
  payload: Omit<FaturamentoLotePayload, "file" | "tipoDocumento">,
): Promise<FaturamentoLotePreview> {
  const params = new URLSearchParams({
    dataInicio: payload.dataInicio,
    dataFim: payload.dataFim,
    clienteId: payload.clienteId,
  });
  if (payload.centroCustoId) {
    params.set("centroCustoId", payload.centroCustoId);
  }

  const response = await fetch(
    `/api/financeiro/faturar/lote?${params.toString()}`,
    { credentials: "include" },
  );
  const body = (await response.json().catch(() => null)) as
    | (FaturamentoLotePreview & { error?: string })
    | null;

  if (!response.ok || !body) {
    throw new Error(body?.error || "Falha ao visualizar o faturamento em lote.");
  }
  return body;
}

export async function faturarOSLote(
  payload: FaturamentoLotePayload,
): Promise<FaturamentoLoteResult> {
  const formData = new FormData();
  formData.append("dataInicio", payload.dataInicio);
  formData.append("dataFim", payload.dataFim);
  formData.append("clienteId", payload.clienteId);
  formData.append("centroCustoId", payload.centroCustoId);
  formData.append("tipoDocumento", payload.tipoDocumento);
  if (payload.file) formData.append("file", payload.file);

  const response = await fetch("/api/financeiro/faturar/lote", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const body = (await response.json().catch(() => null)) as
    | (FaturamentoLoteResult & { error?: string })
    | null;

  if (!response.ok || !body) {
    throw new Error(body?.error || "Falha ao faturar as OS em lote.");
  }
  return body;
}

export async function confirmarRecebimento(
  payload: ConfirmarRecebimentoPayload,
): Promise<void> {
  const response = await fetch("/api/financeiro/baixar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      osId: payload.osId,
      observacao: payload.observacao,
    }),
  });

  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(body?.error || "Falha ao registrar recebimento.");
  }
}

export async function gerarRelatorio(payload: ReportPayload): Promise<Blob> {
  const params = new URLSearchParams();
  params.set("template", payload.template);
  params.set("format", payload.format);
  params.set("dataInicio", payload.dataInicio);
  params.set("dataFim", payload.dataFim);
  if (payload.clienteId) params.set("clienteId", payload.clienteId);
  if (payload.parceiroId) params.set("parceiroId", payload.parceiroId);
  if (payload.driverId) params.set("driverId", payload.driverId);
  if (payload.repasseStatusFilter && payload.repasseStatusFilter !== "all") {
    params.set("repasseStatusFilter", payload.repasseStatusFilter);
  }

  const response = await fetch(
    `/api/financeiro/relatorio?${params.toString()}`,
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error || "Falha ao gerar relatório.");
  }

  return response.blob();
}

export async function getComprovanteUrl(attachmentId: string): Promise<string> {
  const response = await fetch(`/api/financeiro/anexos/${attachmentId}`, {
    credentials: "include",
  });

  const body = (await response.json().catch(() => null)) as {
    error?: string;
    signedUrl?: string;
  } | null;

  if (!response.ok) {
    throw new Error(body?.error || "Falha ao abrir comprovante.");
  }

  if (!body?.signedUrl) {
    throw new Error("URL do comprovante não encontrada.");
  }

  return body.signedUrl;
}
