import { createClient } from "@supabase/supabase-js";
import { fromZonedTime } from "date-fns-tz";
import {
  sendMessageWithRetry,
  sendTemplateWithRetry,
} from "@/lib/webhook-helpers";
import { updateOperationalCycleForOS } from "@/lib/operational-cycles-db";

const REMINDER_KINDS = {
  preStart: "pre_start",
  postStart5: "post_start_5",
  postStart30: "post_start_30",
} as const;

type ReminderKind = (typeof REMINDER_KINDS)[keyof typeof REMINDER_KINDS];

interface ReminderCycleRow {
  cycle_id: string;
  os_id: string;
  protocolo: string;
  os_number: string | null;
  motorista: string | null;
  driver_id: string | null;
  driver_phone: string | null;
  cycle_index: number;
  cycle_title: string;
  cycle_state: string;
  message_sent_at: string | null;
  started_at: string | null;
  waypoint_data: string | null;
  waypoint_hora: string | null;
  os_data: string | null;
  os_hora: string | null;
  cliente_id: string | null;
}

interface ReminderResult {
  cycleId: string;
  osId: string;
  kind: ReminderKind;
  sent: boolean;
  error?: string;
}

let _adminClient: ReturnType<typeof createClient> | null = null;

function getAdminClient(): ReturnType<typeof createClient> {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return _adminClient;
}

function getReminderTimezone(): string {
  return process.env.REMINDER_TIMEZONE ?? "America/Sao_Paulo";
}

function getPreStartMinutes(): number {
  return Number(process.env.REMINDER_PRE_START_MINUTES ?? 15);
}

function getPostStartMinutes(): number {
  return Number(process.env.REMINDER_POST_START_MINUTES ?? 5);
}

function getCriticalDelayMinutes(): number {
  return Number(process.env.REMINDER_CRITICAL_DELAY_MINUTES ?? 30);
}

// ---------------------------------------------------------------------------
// Conversão de data/hora local (Brasília) para UTC
// ---------------------------------------------------------------------------

function utcFromLocalDateTime(
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

  return fromZonedTime(localIso, timeZone);
}

function isToday(date: Date, tz: string): boolean {
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

function formatDateTimeLocal(
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
// Banco de dados
// ---------------------------------------------------------------------------

async function fetchReminderCycles(): Promise<ReminderCycleRow[]> {
  const supabase = getAdminClient();
  const activeStates = [
    "pending",
    "awaiting_accept",
    "awaiting_start",
    "awaiting_km_start",
  ];

  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>
  )("get_os_cycles_for_reminders", { p_active_states: activeStates });

  if (error) {
    console.error("[os-reminders] Erro ao buscar ciclos:", error);
    throw error;
  }

  return (data || []) as unknown as ReminderCycleRow[];
}

async function markReminderSent(
  cycleId: string,
  kind: ReminderKind,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await (
    supabase.from("os_cycle_reminders") as unknown as {
      upsert: (
        values: Record<string, unknown>,
        opts: { onConflict: string },
      ) => Promise<{ error: unknown }>;
    }
  ).upsert({ cycle_id: cycleId, reminder_kind: kind, metadata }, { onConflict: "cycle_id, reminder_kind" });
  if (error) {
    console.error("[os-reminders] Erro ao marcar lembrete:", error);
    throw error;
  }
}

async function hasReminderSent(
  cycleId: string,
  kind: ReminderKind,
): Promise<boolean> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("os_cycle_reminders")
    .select("id")
    .eq("cycle_id", cycleId)
    .eq("reminder_kind", kind)
    .maybeSingle();

  if (error) {
    console.error("[os-reminders] Erro ao verificar lembrete:", error);
    return false;
  }
  return !!data;
}

async function logDriverDelay(
  osId: string,
  motorista: string,
  cycleIndex: number,
  minutesLate: number,
): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await (
    supabase.from("os_logs") as unknown as {
      insert: (values: Record<string, unknown>) => Promise<{ error: unknown }>;
    }
  ).insert({
    os_id: osId,
    type: "driver_delay",
    actor_name: motorista || "Motorista",
    description: `Motorista atrasado há ${minutesLate} minutos (ciclo ${cycleIndex + 1})`,
    metadata: { cycle_index: cycleIndex, minutes_late: minutesLate },
  });
  if (error) {
    console.error("[os-reminders] Erro ao logar atraso:", error);
  }
}

function getScheduledAt(row: ReminderCycleRow): Date | null {
  const timeZone = getReminderTimezone();
  const waypointDateTime = utcFromLocalDateTime(
    row.waypoint_data,
    row.waypoint_hora,
    timeZone,
  );
  if (waypointDateTime) return waypointDateTime;
  return utcFromLocalDateTime(row.os_data, row.os_hora, timeZone);
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

// ---------------------------------------------------------------------------
// Envio de mensagens
// ---------------------------------------------------------------------------

async function sendPreStartReminder(
  row: ReminderCycleRow,
  scheduledAt: Date,
): Promise<ReminderResult> {
  const phone = normalizePhone(row.driver_phone);
  if (!phone) {
    return {
      cycleId: row.cycle_id,
      osId: row.os_id,
      kind: REMINDER_KINDS.preStart,
      sent: false,
      error: "Telefone do motorista não informado",
    };
  }

  const tz = getReminderTimezone();
  const { time } = formatDateTimeLocal(scheduledAt, tz);
  const preMin = getPreStartMinutes();

  const message =
    `⏰ *Lembrete de atendimento*\n\n` +
    `Olá, ${row.motorista || "Motorista"}!\n\n` +
    `Seu atendimento${row.os_number ? ` (${row.os_number})` : ""} está previsto para *${time}*` +
    ` (menos de ${preMin} minutos).\n\n` +
    `📑 Protocolo: *${row.protocolo}*\n\n` +
    `Prepare-se para iniciar no horário.`;

  const result = await sendMessageWithRetry(phone, message);

  if (result.success) {
    await markReminderSent(row.cycle_id, REMINDER_KINDS.preStart);
  }

  return {
    cycleId: row.cycle_id,
    osId: row.os_id,
    kind: REMINDER_KINDS.preStart,
    sent: result.success,
    error: result.error,
  };
}

async function sendDelayReminder(
  row: ReminderCycleRow,
  scheduledAt: Date,
  minutesLate: number,
  kind: ReminderKind,
): Promise<ReminderResult> {
  const phone = normalizePhone(row.driver_phone);
  if (!phone) {
    return {
      cycleId: row.cycle_id,
      osId: row.os_id,
      kind,
      sent: false,
      error: "Telefone do motorista não informado",
    };
  }

  const tz = getReminderTimezone();
  const { date, time } = formatDateTimeLocal(scheduledAt, tz);
  const cycleTitle = row.cycle_title;
  const motoristaName = row.motorista || "Motorista";

  const components = [
    {
      type: "header",
      parameters: [{ type: "text", text: cycleTitle }],
    },
    {
      type: "body",
      parameters: [
        { type: "text", text: "ATRASO DETECTADO" },
        { type: "text", text: motoristaName },
        { type: "text", text: date },
        { type: "text", text: time },
        { type: "text", text: row.protocolo },
      ],
    },
    {
      type: "button",
      sub_type: "flow",
      index: 0,
      parameters: [],
    },
  ];

  const result = await sendTemplateWithRetry(
    phone,
    "atraso_inicio_motorista",
    "pt_BR",
    components,
  );

  if (result.success && result.messageId) {
    await markReminderSent(row.cycle_id, kind, {
      message_id: result.messageId,
      minutes_late: minutesLate,
    });

    await (
      getAdminClient().from("ordens_servico") as unknown as {
        update: (values: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<unknown> };
      }
    )
      .update({
        driver_flow_start_message_id: result.messageId,
        driver_flow_finish_message_id: null,
      })
      .eq("id", row.os_id);

    await updateOperationalCycleForOS(
      getAdminClient(),
      row.os_id,
      row.cycle_index,
      { messageSentAt: new Date().toISOString() },
    );

    // T+30: também gera log → dispara notificação no sino para internos via trigger
    if (kind === REMINDER_KINDS.postStart30) {
      await logDriverDelay(
        row.os_id,
        row.motorista || "Motorista",
        row.cycle_index,
        minutesLate,
      );
    }
  }

  return {
    cycleId: row.cycle_id,
    osId: row.os_id,
    kind,
    sent: result.success,
    error: result.error,
  };
}

// ---------------------------------------------------------------------------
// Exportações públicas
// ---------------------------------------------------------------------------

/**
 * Retorna os ciclos atrasados do dia atual (para exibição no portal).
 */
export async function getTodaysDelayedCycles(
  onlyToday: boolean = true,
): Promise<Array<ReminderCycleRow & { minutesLate: number }>> {
  const now = new Date();
  const tz = getReminderTimezone();
  const cycles = await fetchReminderCycles();
  const delayed: Array<ReminderCycleRow & { minutesLate: number }> = [];

  for (const row of cycles) {
    const scheduledAt = getScheduledAt(row);
    if (!scheduledAt) continue;
    if (onlyToday && !isToday(scheduledAt, tz)) continue;

    const minutesLate = Math.floor(
      (now.getTime() - scheduledAt.getTime()) / 60_000,
    );

    if (minutesLate > 0 && !row.started_at) {
      delayed.push({ ...row, minutesLate });
    }
  }

  return delayed.sort((a, b) => b.minutesLate - a.minutesLate);
}

/**
 * Executa o ciclo de lembretes (chamado pelo cron do Worker).
 *
 * Fluxo por ciclo (somente ciclos do dia atual):
 *   1. T-15min (antes do horário): texto simples "prepare-se"
 *   2. T+5min (atrasado): template atraso_inicio_motorista com botão INICIAR VIAGEM
 *   3. T+30min (crítico): mesmo template + log → notificação no sino para internos
 *   - Se já passou 30min e T+5 ainda não foi enviado, pula T+5 e vai direto ao T+30
 *   - Funciona 24h (sem janela noturna — há viagens de manhã, tarde, noite e madrugada)
 */
export async function processOSReminders(): Promise<ReminderResult[]> {
  const now = new Date();
  const tz = getReminderTimezone();

  const cycles = await fetchReminderCycles();
  const results: ReminderResult[] = [];
  const preMin = getPreStartMinutes();
  const post5Min = getPostStartMinutes();
  const post30Min = getCriticalDelayMinutes();

  for (const row of cycles) {
    const scheduledAt = getScheduledAt(row);
    if (!scheduledAt) continue;

    // Só ciclos agendados para HOJE
    if (!isToday(scheduledAt, tz)) continue;

    // Ciclo já iniciado → nada a fazer
    if (row.started_at) continue;

    const diffMin = (now.getTime() - scheduledAt.getTime()) / 60_000;

    // ----------------------------------------------------------------
    // ANTES DO HORÁRIO: T-15min → texto simples "prepare-se"
    // Só envia se motorista já teve contato (message_sent_at != null)
    // ----------------------------------------------------------------
    if (diffMin <= 0 && diffMin >= -preMin) {
      const preStartSent = await hasReminderSent(
        row.cycle_id,
        REMINDER_KINDS.preStart,
      );
      if (!preStartSent && row.message_sent_at) {
        results.push(await sendPreStartReminder(row, scheduledAt));
      }
      continue;
    }

    // Ainda não chegou o horário e fora da janela pré → ignorar
    if (diffMin < 0) continue;

    // ----------------------------------------------------------------
    // APÓS O HORÁRIO: T+5min e T+30min
    // ----------------------------------------------------------------
    const minutesLate = Math.floor(diffMin);
    const post5Sent = await hasReminderSent(
      row.cycle_id,
      REMINDER_KINDS.postStart5,
    );
    const post30Sent = await hasReminderSent(
      row.cycle_id,
      REMINDER_KINDS.postStart30,
    );

    // T+30 já enviado → tudo feito para esse ciclo
    if (post30Sent) continue;

    if (minutesLate >= post30Min) {
      // Passou 30min: envia T+30 diretamente (skip T+5 se necessário)
      results.push(
        await sendDelayReminder(
          row,
          scheduledAt,
          minutesLate,
          REMINDER_KINDS.postStart30,
        ),
      );
    } else if (minutesLate >= post5Min && !post5Sent) {
      // Entre 5min e 30min: envia T+5
      results.push(
        await sendDelayReminder(
          row,
          scheduledAt,
          minutesLate,
          REMINDER_KINDS.postStart5,
        ),
      );
    }
  }

  const sentCount = results.filter((r) => r.sent).length;
  console.log(
    `[os-reminders] ${results.length} lembretes processados, ${sentCount} enviados em ${formatDateTimeLocal(now, tz).dateTime}`,
  );

  return results;
}
