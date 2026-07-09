import { createClient } from "@supabase/supabase-js";
import { sendTemplateWithRetry } from "@/lib/webhook-helpers";
import { updateOperationalCycleForOS } from "@/lib/operational-cycles-db";
import {
  REMINDER_KINDS,
  type ReminderKind,
  type ReminderFlags,
  type ReminderPhase,
  type PhaseDecision,
  type PhaseDecisionInput,
  getReminderTimezone,
  getPreStartMinutes,
  getReminder12hMinutes,
  getStartButtonMinutes,
  getPostStartMinutes,
  getCriticalDelayMinutes,
  utcFromLocalDateTime,
  isToday,
  formatDateTimeLocal,
  normalizePhone,
  determineReminderPhase,
} from "@/lib/os-reminders-logic";

// Re-exporta funções puras para compatibilidade com imports existentes
export {
  getReminderTimezone,
  getPreStartMinutes,
  getReminder12hMinutes,
  getStartButtonMinutes,
  getPostStartMinutes,
  getCriticalDelayMinutes,
  utcFromLocalDateTime,
  normalizePhone,
  determineReminderPhase,
  type ReminderPhase,
  type PhaseDecision,
  type PhaseDecisionInput,
};

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

// ---------------------------------------------------------------------------
// Feature flags por fase (app_settings)
// ---------------------------------------------------------------------------

/**
 * Lê os feature flags de lembretes da tabela app_settings.
 *
 * Flags suportados:
 *   - os_reminders_enabled          (global, já existente)
 *   - os_reminders_12h_enabled      (fase 1: lembrete 12h)
 *   - os_reminders_start_button_enabled  (fase 2: botão iniciar)
 *   - os_reminders_delay_alert_enabled   (fases 4+5: alertas de atraso)
 *
 * Backward compatible: se um flag não existir na tabela, assume `true`.
 * Só desativa se o valor for explicitamente "false".
 */
async function getReminderFlags(): Promise<ReminderFlags> {
  const supabase = getAdminClient();
  const keys = [
    "os_reminders_enabled",
    "os_reminders_12h_enabled",
    "os_reminders_start_button_enabled",
    "os_reminders_delay_alert_enabled",
  ];

  const { data, error } = await (
    supabase.from("app_settings") as unknown as {
      select: (cols: string) => {
        in: (col: string, vals: string[]) => Promise<{
          data: { key: string; value: string }[] | null;
          error: unknown;
        }>;
      };
    }
  )
    .select("key, value")
    .in("key", keys);

  if (error) {
    console.error("[os-reminders] Erro ao ler feature flags:", error);
    // Em caso de erro, assume tudo habilitado (fail-open)
    return { global: true, reminder12h: true, startButton: true, delayAlert: true };
  }

  const map = new Map<string, string>();
  for (const row of data || []) {
    map.set(row.key, row.value);
  }

  const isDisabled = (key: string) => map.get(key) === "false";

  return {
    global: !isDisabled("os_reminders_enabled"),
    reminder12h: !isDisabled("os_reminders_12h_enabled"),
    startButton: !isDisabled("os_reminders_start_button_enabled"),
    delayAlert: !isDisabled("os_reminders_delay_alert_enabled"),
  };
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

// ---------------------------------------------------------------------------
// Envio de mensagens
// ---------------------------------------------------------------------------

async function sendReminder12h(
  row: ReminderCycleRow,
  scheduledAt: Date,
): Promise<ReminderResult> {
  const phone = normalizePhone(row.driver_phone);
  if (!phone) {
    return {
      cycleId: row.cycle_id,
      osId: row.os_id,
      kind: REMINDER_KINDS.reminder12h,
      sent: false,
      error: "Telefone do motorista não informado",
    };
  }

  const tz = getReminderTimezone();
  const { date, time } = formatDateTimeLocal(scheduledAt, tz);
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
  }).format(now);
  const scheduledStr = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
  }).format(scheduledAt);
  const whenLabel = todayStr === scheduledStr ? "hoje" : "amanhã";

  // Usa template aprovado na Meta (lembrete_viagem_motorista) em vez de texto simples,
  // pois mensagens de texto só funcionam dentro da janela de 24h após última interação.
  // O template funciona fora dessa janela, garantindo entrega do lembrete 12h antes da viagem.
  const components = [
    {
      type: "body",
      parameters: [
        { type: "text", text: row.motorista || "Motorista" },
        { type: "text", text: date },
        { type: "text", text: time },
        { type: "text", text: whenLabel },
        { type: "text", text: row.protocolo },
      ],
    },
  ];

  const result = await sendTemplateWithRetry(
    phone,
    "lembrete_viagem_motorista",
    "pt_BR",
    components,
  );

  if (result.success) {
    await markReminderSent(row.cycle_id, REMINDER_KINDS.reminder12h);
  }

  return {
    cycleId: row.cycle_id,
    osId: row.os_id,
    kind: REMINDER_KINDS.reminder12h,
    sent: result.success,
    error: result.error,
  };
}

async function sendStartButton(
  row: ReminderCycleRow,
  scheduledAt: Date,
): Promise<ReminderResult> {
  const phone = normalizePhone(row.driver_phone);
  if (!phone) {
    return {
      cycleId: row.cycle_id,
      osId: row.os_id,
      kind: REMINDER_KINDS.startButton,
      sent: false,
      error: "Telefone do motorista não informado",
    };
  }

  // NOTA: Não usamos message_sent_at como guarda aqui.
  // Esse campo é setado quando o operador envia detalhes da viagem (sem botão de iniciar),
  // e também quando o webhook faz auto-aceite. Usar message_sent_at como guarda impediria
  // o cron de enviar o botão de iniciar quando o operador já enviou apenas os detalhes.
  // A idempotência real é garantida por hasReminderSent(cycle_id, start_button) no loop principal.
  const cycleTitle = row.cycle_title || "Itinerário";
  const motoristaName = row.motorista || "Motorista";

  const components = [
    {
      type: "header",
      parameters: [{ type: "text", text: cycleTitle }],
    },
    {
      type: "body",
      parameters: [{ type: "text", text: motoristaName }],
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
    "inicio_viagem_motorista",
    "pt_BR",
    components,
  );

  if (result.success && result.messageId) {
    await markReminderSent(row.cycle_id, REMINDER_KINDS.startButton, {
      message_id: result.messageId,
    });

    // Atualiza driver_flow_start_message_id e messageSentAt no ciclo
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
      {
        messageSentAt: new Date().toISOString(),
        state: "awaiting_accept",
      },
    );

    console.log(
      "[os-reminders] Botão INICIAR VIAGEM enviado para",
      phone,
      "ciclo:",
      row.cycle_index,
      "msgId:",
      result.messageId,
    );
  }

  return {
    cycleId: row.cycle_id,
    osId: row.os_id,
    kind: REMINDER_KINDS.startButton,
    sent: result.success,
    error: result.error,
  };
}

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
  const { date, time } = formatDateTimeLocal(scheduledAt, tz);
  const preMin = getPreStartMinutes();

  // Usa template aprovado na Meta (pre_start_viagem_motorista) em vez de texto simples,
  // pois mensagens de texto só funcionam dentro da janela de 24h após última interação.
  const components = [
    {
      type: "body",
      parameters: [
        { type: "text", text: row.motorista || "Motorista" },
        { type: "text", text: date },
        { type: "text", text: time },
        { type: "text", text: String(preMin) },
        { type: "text", text: row.protocolo },
      ],
    },
  ];

  const result = await sendTemplateWithRetry(
    phone,
    "pre_start_viagem_motorista",
    "pt_BR",
    components,
  );

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
 * Fluxo por ciclo (janela ampliada para ±12h do horário):
 *   1. T-720min (12h antes): template lembrete_viagem_motorista (lembrete de viagem)
 *   2. T-60min  (1h antes): template inicio_viagem_motorista com botão INICIAR VIAGEM
 *   3. T-15min  (antes do horário): texto simples "prepare-se"
 *   4. T+5min   (atrasado): template atraso_inicio_motorista com botão INICIAR VIAGEM
 *   5. T+30min  (crítico): mesmo template + log → notificação no sino para internos
 *   - Se já passou 30min e T+5 ainda não foi enviado, pula T+5 e vai direto ao T+30
 *   - Funciona 24h (sem janela noturna — há viagens de manhã, tarde, noite e madrugada)
 *   - O botão de iniciar (fase 2) só é enviado se message_sent_at ainda é nulo,
 *     evitando duplicação com envios manuais do operador ou do webhook.
 *
 * Feature flags (app_settings):
 *   - os_reminders_enabled              → global (liga/desliga tudo)
 *   - os_reminders_12h_enabled          → fase 1 (lembrete 12h)
 *   - os_reminders_start_button_enabled → fase 2 (botão iniciar)
 *   - os_reminders_delay_alert_enabled  → fases 4+5 (alertas de atraso)
 *   Se um flag não existir, assume true (backward compatible).
 */
export async function processOSReminders(): Promise<ReminderResult[]> {
  // Verifica feature flags (global + por fase) em uma única query
  const flags = await getReminderFlags();
  if (!flags.global) {
    console.log("[os-reminders] Envio de lembretes desativado nas configurações. Saindo sem enviar.");
    return [];
  }

  const now = new Date();
  const tz = getReminderTimezone();

  const cycles = await fetchReminderCycles();
  const results: ReminderResult[] = [];

  for (const row of cycles) {
    const scheduledAt = getScheduledAt(row);
    if (!scheduledAt) continue;

    // Ciclo já iniciado → nada a fazer
    if (row.started_at) continue;

    const diffMin = (now.getTime() - scheduledAt.getTime()) / 60_000;

    // Consulta idempotência de todas as fases de uma vez (paralelizable no futuro)
    const [reminder12hSent, startButtonSent, preStartSent, post5Sent, post30Sent] =
      await Promise.all([
        hasReminderSent(row.cycle_id, REMINDER_KINDS.reminder12h),
        hasReminderSent(row.cycle_id, REMINDER_KINDS.startButton),
        hasReminderSent(row.cycle_id, REMINDER_KINDS.preStart),
        hasReminderSent(row.cycle_id, REMINDER_KINDS.postStart5),
        hasReminderSent(row.cycle_id, REMINDER_KINDS.postStart30),
      ]);

    // Delegação para função pura — toda a lógica de decisão está aqui
    const decision = determineReminderPhase({
      diffMin,
      messageSentAt: row.message_sent_at,
      reminder12hSent,
      startButtonSent,
      preStartSent,
      post5Sent,
      post30Sent,
      flags,
    });

    switch (decision.phase) {
      case "reminder_12h":
        results.push(await sendReminder12h(row, scheduledAt));
        break;
      case "start_button":
        results.push(await sendStartButton(row, scheduledAt));
        break;
      case "pre_start":
        results.push(await sendPreStartReminder(row, scheduledAt));
        break;
      case "post_start_5":
        results.push(
          await sendDelayReminder(
            row,
            scheduledAt,
            decision.minutesLate!,
            REMINDER_KINDS.postStart5,
          ),
        );
        break;
      case "post_start_30":
        results.push(
          await sendDelayReminder(
            row,
            scheduledAt,
            decision.minutesLate!,
            REMINDER_KINDS.postStart30,
          ),
        );
        break;
      case "skip":
      case "idle":
      default:
        // Nada a fazer para este ciclo nesta execução
        break;
    }
  }

  const sentCount = results.filter((r) => r.sent).length;
  console.log(
    `[os-reminders] ${results.length} lembretes processados, ${sentCount} enviados em ${formatDateTimeLocal(now, tz).dateTime}`,
  );

  return results;
}
