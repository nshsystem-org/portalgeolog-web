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

export type ConfirmarRecebimentoPayload = {
  osId: string;
  observacao: string;
};

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
  if (payload.onlyPending) params.set("onlyPending", "true");

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
