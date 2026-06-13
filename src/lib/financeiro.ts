export const FINANCE_ATTACHMENT_BUCKET = "financeiro-comprovantes";

// ─── Hora Extra ────────────────────────────────────────────────────────────────
// Taxa cobrada do cliente por hora extra: R$ 50/h
export const HORA_EXTRA_TAXA_CLIENTE = 50;
// Taxa repassada ao motorista por hora extra: R$ 20/h
export const HORA_EXTRA_TAXA_MOTORISTA = 20;

/**
 * Converte string "HH:mm" em total de minutos.
 * Retorna 0 para strings vazias ou inválidas.
 */
export const parseHoraExtraMinutes = (horaExtra: string | null | undefined): number => {
  if (!horaExtra) return 0;
  const [hStr, mStr] = horaExtra.trim().split(":");
  const h = parseInt(hStr || "0", 10);
  const m = parseInt(mStr || "0", 10);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
};

/**
 * Aplica a regra de arredondamento de cobrança:
 * - 0 minutos → 0 (sem cobrança)
 * - Qualquer valor > 0 → mínimo 1h (60 min)
 * - Acima de 1h, blocos de 30 min:
 *   - resto ≤ 15 min → arredonda pra baixo
 *   - resto ≥ 16 min → arredonda pra cima
 *
 * Exemplos:
 *   0:01 → 60 | 1:00 → 60 | 1:15 → 60 | 1:16 → 90 | 1:30 → 90 | 1:45 → 90 | 1:46 → 120
 */
export const calcBilledMinutes = (inputMinutes: number): number => {
  if (inputMinutes <= 0) return 0;
  const blocks = Math.floor(inputMinutes / 30);
  const remainder = inputMinutes % 30;
  const billedBlocks = remainder > 15 ? blocks + 1 : blocks;
  return Math.max(billedBlocks * 30, 60);
};

/**
 * Retorna o valor em R$ a cobrar do cliente pela hora extra.
 * Já aplica o arredondamento de cobrança.
 */
export const calcHoraExtraCliente = (inputMinutes: number): number => {
  const billed = calcBilledMinutes(inputMinutes);
  return (billed / 60) * HORA_EXTRA_TAXA_CLIENTE;
};

/**
 * Retorna o valor em R$ a repassar ao motorista pela hora extra.
 * Já aplica o arredondamento de cobrança.
 */
export const calcHoraExtraMotorista = (inputMinutes: number): number => {
  const billed = calcBilledMinutes(inputMinutes);
  return (billed / 60) * HORA_EXTRA_TAXA_MOTORISTA;
};

/**
 * Formata minutos faturados de volta para string "HH:mm".
 * Útil para exibir "cobrando 1h30" no UI.
 */
export const formatBilledHours = (billedMinutes: number): string => {
  if (billedMinutes <= 0) return "";
  const h = Math.floor(billedMinutes / 60);
  const m = billedMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

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
