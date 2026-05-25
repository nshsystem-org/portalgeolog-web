export const FINANCE_ATTACHMENT_BUCKET = "financeiro-comprovantes";

export type FinanceStatus = "Pendente" | "Faturado" | "Recebido" | "Pago";

export const isFinanceStatusSettled = (status?: string | null): boolean =>
  status === "Recebido" || status === "Pago";

export const normalizeStatusText = (status?: string | null): string => {
  return (status || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
};

export const isLiberadoParaFaturamento = (status?: string | null): boolean => {
  const normalized = normalizeStatusText(status);
  return normalized === "finalizado" || normalized === "concluido";
};

export const normalizeFinanceStatus = (
  status?: string | null,
): FinanceStatus => {
  if (status === "Faturado" || status === "Recebido" || status === "Pago") {
    return status;
  }

  return "Pendente";
};

export const sanitizeFinanceFileName = (fileName: string): string => {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
};
