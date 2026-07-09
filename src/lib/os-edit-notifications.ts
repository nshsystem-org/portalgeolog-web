import { createClient } from "@supabase/supabase-js";
import { sendTemplateWithRetry } from "@/lib/webhook-helpers";
import { normalizePhone } from "@/lib/os-reminders-logic";

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

interface PreviousOSState {
  driverId?: string | null;
  motorista?: string | null;
  data?: string | null;
  hora?: string | null;
  waypoints?: Array<{
    label: string;
    hora?: string | null;
    data?: string | null;
    itineraryIndex?: number | null;
  }>;
}

interface EditNotificationResult {
  sent: boolean;
  type: "alteracao" | "cancelamento" | "novo_motorista" | "none";
  error?: string;
}

/**
 * Resolve o telefone do motorista a partir do driver_id ou nome.
 * Reutiliza a mesma lógica de operational-cycle-flow.ts.
 */
interface DriverPhoneRow {
  phone: string | null;
}

interface DriverNamePhoneRow {
  name: string | null;
  phone: string | null;
}

interface OSRecordRow {
  protocolo: string;
  motorista: string | null;
  driver_id: string | null;
  data: string | null;
  hora: string | null;
}

interface WaypointRow {
  label: string;
  hora: string | null;
  data: string | null;
  itinerary_index: number | null;
}

async function resolveDriverPhone(
  driverId?: string | null,
  motoristaName?: string | null,
): Promise<string | null> {
  const supabase = getAdminClient();

  if (driverId) {
    const { data } = await supabase
      .from("drivers")
      .select("phone")
      .eq("id", driverId)
      .maybeSingle();
    const row = data as unknown as DriverPhoneRow | null;
    if (row?.phone) return normalizePhone(String(row.phone));
  }

  if (motoristaName) {
    const { data: candidates } = await supabase
      .from("drivers")
      .select("name, phone")
      .ilike("name", `%${motoristaName.trim()}%`)
      .limit(5);

    const rows = (candidates || []) as unknown as DriverNamePhoneRow[];
    const matched = rows.find(
      (c) =>
        c.name?.trim().toUpperCase() === motoristaName.trim().toUpperCase(),
    );

    if (matched?.phone) return normalizePhone(String(matched.phone));
  }

  return null;
}

/**
 * Compara waypoints para detectar mudança de ENDEREÇO apenas.
 * NÃO compara hora/data dos waypoints — a detecção de horário é feita
 * por waypointTimeChanged (que compara data/hora de cada waypoint
 * individualmente, incluindo retornos e itinerários secundários).
 */
function waypointsChanged(
  prev: PreviousOSState["waypoints"],
  next: PreviousOSState["waypoints"],
): boolean {
  if (!prev || !next) return false;
  if (prev.length !== next.length) return true;

  for (let i = 0; i < prev.length; i++) {
    const p = prev[i];
    const n = next[i];
    if (p.label !== n.label) return true;
  }

  return false;
}

/**
 * Compara waypoints para detectar mudança de HORÁRIO (data/hora) por waypoint.
 * Ao contrário de osTimeChanged (que compara apenas os.data/os.hora
 * sincronizados do primeiro itinerário), esta função compara cada waypoint
 * individualmente, detectando alterações de horário em retornos e
 * itinerários secundários que não afetam os campos da OS.
 */
function waypointTimeChanged(
  prev: PreviousOSState["waypoints"],
  next: { label: string; hora: string | null; data: string | null }[],
): boolean {
  if (!prev || !next) return false;
  if (prev.length !== next.length) return true;

  for (let i = 0; i < prev.length; i++) {
    const p = prev[i];
    const n = next[i];
    if ((p.data || null) !== (n.data || null)) return true;
    if ((p.hora || null) !== (n.hora || null)) return true;
  }

  return false;
}

/**
 * Detecta mudanças relevantes em uma OS editada e envia notificações WhatsApp
 * ao motorista afetado.
 *
 * Cenários:
 * 1. Motorista trocado:
 *    - Envia cancelamento_viagem_motorista ao motorista ANTIGO
 *    - Envia appointment_scheduling ao motorista NOVO (fluxo inicial)
 * 2. Mesmo motorista, mas horário ou endereço mudou:
 *    - Envia alteracao_viagem_motorista ao motorista atual
 *
 * Retorna o tipo de notificação enviada (ou "none" se nada relevante mudou).
 */
export async function notifyDriverOnOSEdit(
  osId: string,
  previousState: PreviousOSState,
): Promise<EditNotificationResult> {
  const supabase = getAdminClient();

  // Verifica se as notificações de edição estão habilitadas
  // e se os lembretes globais (avisos de atraso) estão ativos.
  // Quando "Avisos de atraso" está desativado na config, as mensagens
  // de alteração de endereço/horário ao motorista também são bloqueadas.
  const { data: flagRows } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["os_edit_notify_enabled", "os_reminders_enabled"]);

  const flagMap = new Map<string, string>();
  for (const row of (flagRows || []) as unknown as { key: string; value: string }[]) {
    flagMap.set(row.key, row.value);
  }

  if (flagMap.get("os_edit_notify_enabled") === "false") {
    console.log("[os-edit-notify] Notificações de edição desativadas. Saindo.");
    return { sent: false, type: "none" };
  }

  if (flagMap.get("os_reminders_enabled") === "false") {
    console.log(
      "[os-edit-notify] Avisos de atraso (os_reminders_enabled) desativados. Bloqueando notificações de edição. Saindo.",
    );
    return { sent: false, type: "none" };
  }

  // Busca estado atual da OS no banco (após o update)
  const { data: osRecordRaw, error: osError } = await supabase
    .from("ordens_servico")
    .select("protocolo, motorista, driver_id, data, hora")
    .eq("id", osId)
    .maybeSingle();

  const osRecord = osRecordRaw as unknown as OSRecordRow | null;

  if (osError || !osRecord) {
    return { sent: false, type: "none", error: "OS não encontrada" };
  }

  const { data: waypointsData } = await supabase
    .from("os_waypoints")
    .select("label, hora, data, itinerary_index")
    .eq("ordem_servico_id", osId)
    .order("position");

  const waypointRows = (waypointsData || []) as unknown as WaypointRow[];
  const currentWaypoints = waypointRows.map((w) => ({
    label: w.label,
    hora: w.hora,
    data: w.data,
    itineraryIndex: w.itinerary_index,
  }));

  const currentDriverId = osRecord.driver_id || null;
  const prevDriverId = previousState.driverId || null;
  const driverChanged = currentDriverId !== prevDriverId;

  // osTimeChanged: compara os.data/os.hora (sincronizados do primeiro itinerário).
  // Mantido como safety net — cobre o caso de a OS ter hora própria (legado).
  const osTimeChanged =
    (osRecord.data || null) !== (previousState.data || null) ||
    (osRecord.hora || null) !== (previousState.hora || null);

  // wpTimeChanged: compara data/hora de cada waypoint individualmente.
  // Essencial para detectar mudanças de horário em retornos e itinerários
  // secundários que não afetam os.data/os.hora da OS.
  const wpTimeChanged = waypointTimeChanged(
    previousState.waypoints,
    currentWaypoints,
  );

  const timeChanged = osTimeChanged || wpTimeChanged;

  const addressChanged = waypointsChanged(
    previousState.waypoints,
    currentWaypoints,
  );

  // Nenhuma mudança relevante
  if (!driverChanged && !timeChanged && !addressChanged) {
    return { sent: false, type: "none" };
  }

  const protocolo = osRecord.protocolo;

  // ---------------------------------------------------------------
  // Cenário 1: Motorista trocado
  // ---------------------------------------------------------------
  if (driverChanged) {
    // 1a. Avisar motorista ANTIGO (cancelamento)
    if (prevDriverId || previousState.motorista) {
      const oldPhone = await resolveDriverPhone(
        prevDriverId,
        previousState.motorista,
      );

      if (oldPhone) {
        try {
          await sendTemplateWithRetry(
            oldPhone,
            "cancelamento_viagem_motorista",
            "pt_BR",
            [
              {
                type: "body",
                parameters: [
                  {
                    type: "text",
                    text: previousState.motorista || "Motorista",
                  },
                  { type: "text", text: protocolo },
                ],
              },
            ],
          );
          console.log(
            `[os-edit-notify] Cancelamento enviado ao motorista anterior (${previousState.motorista})`,
          );
        } catch (err) {
          console.error(
            "[os-edit-notify] Erro ao enviar cancelamento ao motorista anterior:",
            err,
          );
        }
      }
    }

    // 1b. Enviar fluxo inicial ao motorista NOVO (appointment_scheduling)
    // O operador pode fazer isso manualmente, mas enviamos automaticamente
    // para garantir que o novo motorista seja notificado imediatamente.
    const newPhone = await resolveDriverPhone(
      currentDriverId,
      osRecord.motorista,
    );

    if (newPhone) {
      try {
        // O template appointment_scheduling tem apenas 1 variável no body (nome do motorista).
        // Os detalhes completos da viagem são enviados quando o motorista clica em
        // "Detalhes do Serviço" (processado no meta-webhook → sendServiceDetails).
        await sendTemplateWithRetry(
          newPhone,
          "appointment_scheduling",
          "pt_BR",
          [
            {
              type: "body",
              parameters: [
                { type: "text", text: osRecord.motorista || "Motorista" },
              ],
            },
          ],
        );
        console.log(
          `[os-edit-notify] Fluxo inicial (appointment_scheduling) enviado ao novo motorista (${osRecord.motorista})`,
        );
        return { sent: true, type: "novo_motorista" };
      } catch (err) {
        console.error(
          "[os-edit-notify] Erro ao enviar fluxo inicial ao novo motorista:",
          err,
        );
        return {
          sent: false,
          type: "novo_motorista",
          error: err instanceof Error ? err.message : "Erro desconhecido",
        };
      }
    }

    return {
      sent: false,
      type: "novo_motorista",
      error: "Telefone do novo motorista não encontrado",
    };
  }

  // ---------------------------------------------------------------
  // Cenário 2: Mesmo motorista, horário ou endereço mudou
  // ---------------------------------------------------------------
  if (timeChanged || addressChanged) {
    const phone = await resolveDriverPhone(currentDriverId, osRecord.motorista);

    if (!phone) {
      return {
        sent: false,
        type: "alteracao",
        error: "Telefone do motorista não encontrado",
      };
    }

    // Formata data e hora para pt-BR.
    // os.hora é null (a hora vive nos waypoints), então usamos a hora
    // do primeiro waypoint do primeiro itinerário como referência principal.
    const tz = process.env.REMINDER_TIMEZONE ?? "America/Sao_Paulo";
    const dateStr = osRecord.data || "";
    const timeStr = currentWaypoints[0]?.hora || osRecord.hora || "";

    // Formata data de YYYY-MM-DD para DD/MM/YYYY
    let formattedDate = dateStr;
    if (dateStr && dateStr.includes("-")) {
      const [y, m, d] = dateStr.split("-");
      formattedDate = `${d}/${m}/${y}`;
    }

    // Determina "hoje", "amanhã" ou "em N dias" baseado na diferença real de datas
    const now = new Date();
    let whenLabel = "hoje";
    if (dateStr && dateStr.includes("-")) {
      const [y, m, d] = dateStr.split("-").map(Number);
      const scheduledDate = new Date(y, m - 1, d);

      const todayInTz = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
      const [ty, tm, td] = todayInTz.split("-").map(Number);
      const todayDate = new Date(ty, tm - 1, td);

      const dayDiff = Math.round(
        (scheduledDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      whenLabel =
        dayDiff === 0
          ? "hoje"
          : dayDiff === 1
            ? "amanhã"
            : dayDiff > 1
              ? `em ${dayDiff} dias`
              : "hoje";
    }

    // Endereço de embarque (primeiro waypoint)
    const firstWaypoint = currentWaypoints[0];
    const embarkAddress = firstWaypoint?.label || "Não informado";

    // Monta o texto da variável {{3}} dinamicamente conforme o que mudou.
    // O template tem apenas 3 variáveis: {{1}}=nome, {{2}}=protocolo, {{3}}=detalhes.
    // Isso evita mostrar "Novo endereço" quando só o horário mudou (e vice-versa).
    const changeParts: string[] = [];
    if (timeChanged) {
      changeParts.push(
        `📅 Novo horário: ${formattedDate} às ${timeStr} (${whenLabel})`,
      );
    }
    if (addressChanged) {
      changeParts.push(`📍 Novo endereço: ${embarkAddress}`);
    }
    // NOTA: A Meta API não aceita \n (quebra de linha) em parâmetros de template.
    // Usar " | " como separador quando horário e endereço mudaram simultaneamente.
    const changeDetails = changeParts.join(" | ");

    try {
      await sendTemplateWithRetry(
        phone,
        "alteracao_viagem_motorista",
        "pt_BR",
        [
          {
            type: "body",
            parameters: [
              { type: "text", text: osRecord.motorista || "Motorista" },
              { type: "text", text: protocolo },
              { type: "text", text: changeDetails },
            ],
          },
        ],
      );
      console.log(
        `[os-edit-notify] Alteração enviada ao motorista (${osRecord.motorista}): ${timeChanged ? "horário" : ""} ${addressChanged ? "endereço" : ""}`.trim(),
      );
      return { sent: true, type: "alteracao" };
    } catch (err) {
      console.error("[os-edit-notify] Erro ao enviar alteração:", err);
      return {
        sent: false,
        type: "alteracao",
        error: err instanceof Error ? err.message : "Erro desconhecido",
      };
    }
  }

  return { sent: false, type: "none" };
}
