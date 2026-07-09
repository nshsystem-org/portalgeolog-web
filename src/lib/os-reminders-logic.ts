/**
 * Lógica pura de lembretes do motorista — sem dependências externas.
 *
 * Este arquivo contém apenas funções puras (sem side effects, sem I/O, sem banco)
 * relacionadas ao sistema de lembretes. Pode ser importado em testes sem precisar
 * mockar Supabase, Meta API ou qualquer outra infraestrutura.
 *
 * O arquivo principal `os-reminders.ts` importa daqui e adiciona as camadas
 * de I/O (banco, envio de mensagens, cron).
 */

// ---------------------------------------------------------------------------
// Constantes e tipos
// ---------------------------------------------------------------------------

export const REMINDER_KINDS = {
  reminder12h: "reminder_12h",
  startButton: "start_button",
  preStart: "pre_start",
  postStart5: "post_start_5",
  postStart30: "post_start_30",
} as const;

export type ReminderKind = (typeof REMINDER_KINDS)[keyof typeof REMINDER_KINDS];

export interface ReminderFlags {
  global: boolean;
  reminder12h: boolean;
  startButton: boolean;
  delayAlert: boolean;
}

export type ReminderPhase =
  | "reminder_12h"
  | "start_button"
  | "pre_start"
  | "post_start_5"
  | "post_start_30"
  | "idle"
  | "skip";

export interface PhaseDecisionInput {
  diffMin: number;
  messageSentAt: string | null;
  reminder12hSent: boolean;
  startButtonSent: boolean;
  preStartSent: boolean;
  post5Sent: boolean;
  post30Sent: boolean;
  flags: ReminderFlags;
  /** Se o ciclo agendado é do dia atual. Default true (backward compatible).
   *  Quando false, alertas de atraso (T+5/T+30) são suprimidos para OS antigas. */
  isToday?: boolean;
}

export interface PhaseDecision {
  phase: ReminderPhase;
  minutesLate?: number;
}

// ---------------------------------------------------------------------------
// Configurações (lidas de env vars com defaults)
// ---------------------------------------------------------------------------

export function getReminderTimezone(): string {
  return process.env.REMINDER_TIMEZONE ?? "America/Sao_Paulo";
}

export function getPreStartMinutes(): number {
  return Number(process.env.REMINDER_PRE_START_MINUTES ?? 15);
}

export function getReminder12hMinutes(): number {
  return Number(process.env.REMINDER_12H_MINUTES ?? 720);
}

export function getStartButtonMinutes(): number {
  return Number(process.env.REMINDER_START_BUTTON_MINUTES ?? 60);
}

export function getPostStartMinutes(): number {
  return Number(process.env.REMINDER_POST_START_MINUTES ?? 5);
}

export function getCriticalDelayMinutes(): number {
  return Number(process.env.REMINDER_CRITICAL_DELAY_MINUTES ?? 30);
}

// ---------------------------------------------------------------------------
// Conversão de data/hora
// ---------------------------------------------------------------------------

/**
 * Converte uma data (YYYY-MM-DD) e hora (HH:MM) local no timezone informado
 * para um Date UTC. Retorna null se os valores forem inválidos.
 */
export function utcFromLocalDateTime(
  dateStr: string | null,
  timeStr: string | null,
  timeZone: string,
): Date | null {
  if (!dateStr || !timeStr) return null;

  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  if (
    [year, month, day, hour, minute].some(
      (v) => !Number.isFinite(v) || Number.isNaN(v),
    )
  ) {
    return null;
  }

  const localIso =
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-` +
    `${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;

  // fromZonedTime de date-fns-tz converte local → UTC
  // Mas para manter este arquivo sem dependências, fazemos conversão manual
  // usando Intl.DateTimeFormat para detectar o offset do timezone.
  const date = new Date(localIso);
  if (isNaN(date.getTime())) return null;

  // Calcula o offset do timezone em minutos
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";
  const localFormatted = new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`,
  );

  if (isNaN(localFormatted.getTime())) return null;

  // diff = UTC - local = offset em ms
  const offsetMs = date.getTime() - localFormatted.getTime();
  return new Date(date.getTime() + offsetMs);
}

export function isToday(date: Date, tz: string): boolean {
  const now = new Date();
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: tz,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  return fmt(date) === fmt(now);
}

export function formatDateTimeLocal(
  date: Date,
  timeZone: string,
): { date: string; time: string; dateTime: string } {
  const fmtDate = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
  }).format(date);

  const fmtTime = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return { date: fmtDate, time: fmtTime, dateTime: `${fmtDate} ${fmtTime}` };
}

// ---------------------------------------------------------------------------
// Normalização de telefone
// ---------------------------------------------------------------------------

export function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

// ---------------------------------------------------------------------------
// Lógica de decisão de fase (pura, testável)
// ---------------------------------------------------------------------------

/**
 * Função pura que determina qual fase de lembrete deve ser executada para um ciclo,
 * dado o diffMin (minutos entre agora e o horário agendado) e o estado de idempotência.
 *
 * Regras:
 *   - Fase 1 (12h):  diffMin em [-720, 0], flag 12h on, não enviado
 *   - Fase 2 (1h):   diffMin em [-60, 0], flag start on, não enviado
 *   - Fase 3 (15min): diffMin em [-15, 0], message_sent_at != null, não enviado
 *   - Fase 4 (T+5):  diffMin em [5, 30), flag delay on, não enviado, isToday
 *   - Fase 5 (T+30): diffMin >= 30, flag delay on, T+30 não enviado, isToday
 *   - Se T+30 já enviado → idle (tudo feito)
 *   - Se diffMin > 0 e isToday === false → idle (não notifica OS de dias anteriores)
 *   - Se diffMin < 0 e fora de todas as janelas → skip
 *
 * Retorna "idle" se não há nada a fazer (ciclo completo ou já iniciado).
 */
export function determineReminderPhase(
  input: PhaseDecisionInput,
): PhaseDecision {
  const {
    diffMin,
    messageSentAt,
    reminder12hSent,
    startButtonSent,
    preStartSent,
    post5Sent,
    post30Sent,
    flags,
  } = input;

  // Antes do horário (diffMin <= 0)
  if (diffMin <= 0) {
    // Fase 1: lembrete 12h
    if (flags.reminder12h && diffMin >= -720 && !reminder12hSent) {
      return { phase: "reminder_12h" };
    }
    // Fase 2: botão iniciar
    if (flags.startButton && diffMin >= -60 && !startButtonSent) {
      return { phase: "start_button" };
    }
    // Fase 3: pre-start (só se motorista já teve contato)
    if (diffMin >= -15 && !preStartSent && messageSentAt) {
      return { phase: "pre_start" };
    }
    return { phase: "skip" };
  }

  // Após o horário (diffMin > 0) — alertas de atraso
  if (!flags.delayAlert) return { phase: "idle" };
  if (post30Sent) return { phase: "idle" };

  // Só notifica atraso para ciclos do dia atual.
  // Evita notificar OS de dias anteriores (ex: 300min, 1200min no passado).
  // A última mensagem de atraso pro motorista é a T+30.
  if (input.isToday === false) return { phase: "idle" };

  const minutesLate = Math.floor(diffMin);

  if (minutesLate >= 30) {
    return { phase: "post_start_30", minutesLate };
  }
  if (minutesLate >= 5 && !post5Sent) {
    return { phase: "post_start_5", minutesLate };
  }

  return { phase: "idle" };
}
