import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchInChunks } from "@/lib/supabase/chunked-in-query";
import { normalizeWhatsAppPhone } from "@/lib/meta";
import {
  buildPassengerDetailsMessage,
  type ItineraryGroup,
  type ItineraryStop,
  type OperationalCycle,
} from "@/lib/os-messages";
import {
  loadOperationalCycleContextForOS,
  updateOperationalCycleForOS,
} from "@/lib/operational-cycles-db";
import {
  sendMessageWithRetry,
  sendTemplateWithRetry,
} from "@/lib/webhook-helpers";

interface NextCycleOSRecord {
  protocolo?: string | null;
  os_number?: string | null;
  data?: string | null;
  hora?: string | null;
  motorista?: string | null;
  cliente_id?: string | null;
  solicitante?: string | null;
  centro_custo?: string | null;
  veiculo_id?: string | null;
  driver_id?: string | null;
}

interface DriverLookupRow {
  name?: string | null;
  phone?: string | null;
}

interface NextCycleWaypointRow {
  id?: string;
  label?: string | null;
  comment?: string | null;
  itinerary_index?: number | null;
  hora?: string | null;
  data?: string | null;
  position?: number | null;
}

export interface SendNextOperationalCycleFlowResult {
  success: boolean;
  driverPhone?: string;
  templateMessageId?: string;
  error?: string;
}

function formatDate(value?: string | null): string {
  if (!value) return "Não informado";
  const [year, month, day] = value.split("-");
  if (year && month && day) return `${day}/${month}/${year}`;
  return value;
}

function formatTime(value?: string | null): string {
  if (!value) return "Não informado";
  return value.slice(0, 5);
}

function formatDateTime(date?: string | null, time?: string | null): string {
  const formattedDate = formatDate(date);
  const formattedTime = formatTime(time);
  if (formattedDate === "Não informado" && formattedTime === "Não informado")
    return "Não informado";
  if (formattedDate === "Não informado") return formattedTime;
  if (formattedTime === "Não informado") return formattedDate;
  return `${formattedDate} - ${formattedTime}`;
}

function buildStartFlowHeader(
  cycle: Pick<OperationalCycle, "title">,
  protocolo: string,
): string {
  const cleanTitle = String(cycle.title || "")
    .replace(/\s*[—-]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `${cleanTitle || "Itinerário"} - ${String(protocolo || "N/A").trim()}`;
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveDriverPhoneForOS(
  client: SupabaseClient,
  osRecord: NextCycleOSRecord,
  fallbackPhone?: string,
): Promise<string> {
  if (fallbackPhone) return normalizeWhatsAppPhone(fallbackPhone);

  let driverPhone = "Não informado";

  if (osRecord.driver_id) {
    const { data: driverRow } = await client
      .from("drivers")
      .select("phone")
      .eq("id", osRecord.driver_id)
      .maybeSingle();

    if (driverRow) {
      driverPhone = normalizeWhatsAppPhone(
        String((driverRow as DriverLookupRow).phone || "Não informado"),
      );
    }
  }

  if (driverPhone === "Não informado" && osRecord.motorista) {
    const normalizedMotorista = normalizeName(osRecord.motorista);
    const { data: candidates } = await client
      .from("drivers")
      .select("name, phone")
      .ilike("name", `%${osRecord.motorista.trim()}%`)
      .limit(10);

    const matched = (candidates || []).find((candidate: unknown) => {
      const typed = candidate as DriverLookupRow;
      const normalizedName = normalizeName(String(typed.name || ""));
      return (
        normalizedName === normalizedMotorista ||
        normalizedName.includes(normalizedMotorista)
      );
    });

    if (matched) {
      driverPhone = normalizeWhatsAppPhone(
        String((matched as DriverLookupRow).phone || driverPhone),
      );
    }
  }

  return driverPhone;
}

export async function sendNextOperationalCycleFlow(
  client: SupabaseClient,
  options: {
    osId: string;
    targetCycleIndex: number;
    destinationPhone?: string;
    cycles?: OperationalCycle[];
  },
): Promise<SendNextOperationalCycleFlowResult> {
  try {
    const [
      { data: osData },
      { data: waypointsData },
      cyclesResult,
    ] = await Promise.all([
      client
        .from("ordens_servico")
        .select(
          "protocolo, os_number, data, hora, motorista, cliente_id, solicitante, centro_custo, veiculo_id, driver_id",
        )
        .eq("id", options.osId)
        .maybeSingle(),
      client
        .from("os_waypoints")
        .select("id, label, comment, itinerary_index, hora, data, position")
        .eq("ordem_servico_id", options.osId)
        .order("position"),
      options.cycles
        ? Promise.resolve({ cycles: options.cycles })
        : loadOperationalCycleContextForOS(client, options.osId, null),
    ]);

    const osRecord = osData as NextCycleOSRecord | null;
    if (!osRecord) {
      console.warn(
        "[operational-cycle-flow] OS não encontrada ao preparar próximo ciclo:",
        options.osId,
      );
      return { success: false, error: "OS_NOT_FOUND" };
    }

    const cycles = cyclesResult.cycles;
    const targetCycle = cycles.find(
      (cycle) => cycle.itineraryIndex === options.targetCycleIndex,
    );

    if (!targetCycle) {
      console.warn(
        "[operational-cycle-flow] Próximo ciclo não encontrado:",
        options.targetCycleIndex,
        "OS:",
        options.osId,
      );
      return { success: false, error: "CYCLE_NOT_FOUND" };
    }

    const driverPhone = await resolveDriverPhoneForOS(
      client,
      osRecord,
      options.destinationPhone,
    );

    if (driverPhone === "Não informado") {
      console.warn(
        "[operational-cycle-flow] Motorista não encontrado para envio do próximo ciclo:",
        options.osId,
      );
      return { success: false, error: "DRIVER_PHONE_NOT_FOUND" };
    }

    let vehicleData: Record<string, unknown> | null = null;
    if (osRecord.veiculo_id) {
      const { data: vehicle } = await client
        .from("veiculos")
        .select("marca, modelo, placa, tipo")
        .eq("id", String(osRecord.veiculo_id))
        .maybeSingle();
      vehicleData = vehicle as Record<string, unknown> | null;
    }

    let empresa = "Não informado";
    if (osRecord.cliente_id) {
      const { data: cliente } = await client
        .from("clientes")
        .select("nome")
        .eq("id", String(osRecord.cliente_id))
        .maybeSingle();
      empresa = (cliente as { nome?: string } | null)?.nome || empresa;
    }

    const cycleWaypoints = (waypointsData || []).filter(
      (wp: NextCycleWaypointRow) => Number(wp.itinerary_index ?? 0) === options.targetCycleIndex,
    );

    const waypointIds = cycleWaypoints.map((wp: NextCycleWaypointRow) => String(wp.id));

    let paxRows: Record<string, unknown>[] = [];
    if (waypointIds.length > 0) {
      paxRows = await fetchInChunks<Record<string, unknown>>(
        client,
        "os_waypoint_passengers",
        "waypoint_id",
        waypointIds,
        "passageiro_id, waypoint_id",
      );
    }

    const passengerIds = new Set<string>();
    (paxRows || []).forEach((row: Record<string, unknown>) => {
      const pid = String(row.passageiro_id || "");
      if (pid) passengerIds.add(pid);
    });

    const passageirosList = Array.from(passengerIds);
    let passageirosData: Record<string, unknown>[] = [];
    if (passageirosList.length > 0) {
      passageirosData = await fetchInChunks<Record<string, unknown>>(
        client,
        "passageiros",
        "id",
        passageirosList,
        "id, nome_completo, celular",
      );
    }

    const passageiros = (passageirosData || []).map((p: Record<string, unknown>) => ({
      nome: String(p.nome_completo || ""),
      celular: String(p.celular || ""),
    }));

    const itineraryGroups = new Map<
      number,
      { firstIndex: number; stops: ItineraryStop[] }
    >();

    cycleWaypoints.forEach((wp: NextCycleWaypointRow) => {
      const idx = typeof wp.itinerary_index === "number" ? wp.itinerary_index : 0;

      if (!itineraryGroups.has(idx)) {
        itineraryGroups.set(idx, {
          firstIndex: Number(wp.position ?? 0),
          stops: [],
        });
      }

      const group = itineraryGroups.get(idx);
      if (!group) return;

      group.stops.push({
        label: String(wp.label || "Não informado"),
        comment: wp.comment ? String(wp.comment) : null,
        isOrigin: false,
        isDestination: false,
        isPassengerAddress: false,
        dateTime:
          wp.data || wp.hora
            ? formatDateTime(String(wp.data || null), String(wp.hora || null))
            : null,
      });

      if (typeof wp.position === "number" && wp.position < group.firstIndex) {
        group.firstIndex = wp.position;
      }
    });

    const sortedGroups = Array.from(itineraryGroups.entries())
      .sort((a, b) => a[1].firstIndex - b[1].firstIndex)
      .map(([index, group]) => {
        const stops = group.stops;

        if (stops.length > 0) {
          stops[0].isOrigin = true;
          stops[stops.length - 1].isDestination = true;
        }

        const kind = index < 0 ? "return" : "itinerary";
        const ordinal = kind === "return" ? Math.abs(index) : index + 1;
        const title = kind === "return"
          ? `🔄 *${ordinal} Retorno*`
          : `📍 *${ordinal} Itinerário*`;
        const firstWp = cycleWaypoints.find(
          (w: NextCycleWaypointRow) => w.itinerary_index === index,
        );
        const dateTime = formatDateTime(
          String(firstWp?.data || osRecord.data || null),
          String(firstWp?.hora || osRecord.hora || null),
        );

        return {
          index,
          title: `${title} — ${dateTime}`,
          dateTime: undefined,
          stops,
        } as ItineraryGroup;
      });

    const introMessage =
      `🚦 *Você ainda tem mais um ciclo para executar.*\n\n` +
      `Confira abaixo os detalhes do próximo itinerário/retorno antes de iniciar.\n\n` +
      buildPassengerDetailsMessage({
        protocolo: String(osRecord.protocolo || "N/A"),
        osNumber: osRecord.os_number ? String(osRecord.os_number) : null,
        fornecedor: "Geolog Transporte Executivo",
        empresa,
        solicitante: osRecord.solicitante ? String(osRecord.solicitante) : null,
        motorista: String(osRecord.motorista || "Não informado"),
        motoristaTelefone: driverPhone,
        veiculoTipo:
          (vehicleData as { tipo?: string | null } | null)?.tipo || null,
        veiculoMarcaModelo: vehicleData
          ? `${(vehicleData as { marca?: string | null }).marca || ""} ${(vehicleData as { modelo?: string | null }).modelo || ""}`.trim()
          : null,
        veiculoPlaca:
          (vehicleData as { placa?: string | null } | null)?.placa || null,
        passageiros,
        itineraries: sortedGroups,
      });

    const previewResult = await sendMessageWithRetry(driverPhone, introMessage);
    if (!previewResult.success) {
      console.warn(
        "[operational-cycle-flow] Falha ao enviar mensagem de agradecimento/próximo ciclo:",
        previewResult.error,
      );
    }

    const cycleTitle = buildStartFlowHeader(
      targetCycle,
      String(osRecord.protocolo || "N/A"),
    );
    const motoristaName = String(osRecord.motorista || "Motorista");
    const templateComponents = [
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

    const templateResult = await sendTemplateWithRetry(
      driverPhone,
      "inicio_viagem_motorista",
      "pt_BR",
      templateComponents,
    );

    if (!templateResult.success || !templateResult.messageId) {
      console.warn(
        "[operational-cycle-flow] Falha ao enviar template fluxo do próximo ciclo:",
        templateResult.error,
      );
      return { success: false, driverPhone, error: templateResult.error || "TEMPLATE_SEND_FAILED" };
    }

    await client
      .from("ordens_servico")
      .update({
        driver_flow_start_message_id: templateResult.messageId,
        driver_flow_finish_message_id: null,
      })
      .eq("id", options.osId);

    await updateOperationalCycleForOS(client, options.osId, options.targetCycleIndex, {
      messageSentAt: new Date().toISOString(),
      state: "awaiting_accept",
    });

    return {
      success: true,
      driverPhone,
      templateMessageId: templateResult.messageId,
    };
  } catch (error) {
    console.error("[operational-cycle-flow] Erro ao preparar próximo ciclo:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
