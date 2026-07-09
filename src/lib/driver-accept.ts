/**
 * Lógica compartilhada de aceite do motorista.
 * Usada tanto pelo endpoint /api/os-driver-accept quanto pelo webhook do Meta.
 */

import { sendWhatsAppMessage } from "@/lib/meta";
import {
  buildDriverNotificationMessage,
  type OperationalCycle,
  type ItineraryGroup,
  type PassengerInfo,
} from "@/lib/os-messages";
import {
  fetchOperationalCyclesForOS,
  replaceOperationalCyclesForOS,
} from "@/lib/operational-cycles-db";
import { BASE_URL } from "@/lib/constants";
import { fetchInChunks } from "@/lib/supabase/chunked-in-query";
import { createClient } from "@supabase/supabase-js";

// Tipos locais para o driver accept
interface OSDriverRouteRow {
  id: string;
  status_operacional?: string | null;
  motorista?: string | null;
  veiculo_id?: string | null;
  protocolo?: string | null;
  os_number?: string | null;
  data?: string | null;
  hora?: string | null;
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}
const findOperationalCycleByIndex = (
  cycles: OperationalCycle[],
  itineraryIndex: number,
): OperationalCycle | undefined =>
  cycles.find((cycle) => cycle.itineraryIndex === itineraryIndex);

const getFirstPendingOperationalCycle = (
  cycles: OperationalCycle[],
): OperationalCycle | undefined =>
  cycles.find(
    (cycle) => cycle.state === "pending" || cycle.state === "awaiting_accept",
  );

const resolveCycle = (
  cycles: OperationalCycle[],
  requestedCycleIndex: number | null,
): OperationalCycle | undefined => {
  if (requestedCycleIndex !== null) {
    return findOperationalCycleByIndex(cycles, requestedCycleIndex);
  }

  return getFirstPendingOperationalCycle(cycles) || cycles[0];
};

const updateCycleInList = (
  cycles: OperationalCycle[],
  itineraryIndex: number,
  updates: Partial<OperationalCycle>,
): OperationalCycle[] =>
  cycles.map((cycle) =>
    cycle.itineraryIndex === itineraryIndex ? { ...cycle, ...updates } : cycle,
  );

export interface DriverAcceptResult {
  success: boolean;
  alreadyAccepted?: boolean;
  message?: string;
  error?: string;
  cycle?: OperationalCycle;
  messageSent?: boolean;
}

/**
 * Busca dados detalhados da OS para envio de mensagem ao motorista.
 * Se itineraryIndex for 0, retorna todos os itinerários.
 * Se itineraryIndex for diferente de 0, filtra para mostrar apenas o ciclo específico.
 */
export async function fetchOSDataForDriverMessage(
  osId: string,
  itineraryIndex: number,
): Promise<{
  protocolo: string;
  osNumber: string | null;
  data: string | null;
  hora: string | null;
  empresa: string;
  solicitante: string | null;
  centroCusto: string | null;
  motorista: string;
  motoristaTelefone: string;
  veiculoTipo: string | null;
  veiculoMarcaModelo: string | null;
  veiculoPlaca: string | null;
  passageiros: PassengerInfo[];
  itineraries: ItineraryGroup[];
}> {
  const [{ data: osData }, { data: waypointsData }] = await Promise.all([
    getAdmin()
      .from("ordens_servico")
      .select(
        "protocolo, os_number, data, hora, motorista, cliente_id, solicitante, centro_custo, veiculo_id",
      )
      .eq("id", osId)
      .maybeSingle(),
    getAdmin()
      .from("os_waypoints")
      .select("id, label, comment, itinerary_index, hora, data, position")
      .eq("ordem_servico_id", osId)
      .order("position"),
  ]);

  const osRecord = osData as Record<string, unknown> | null;
  if (!osRecord) {
    throw new Error("OS não encontrada");
  }

  let empresa = "Não informado";
  if (osRecord.cliente_id) {
    const { data: cliente } = await getAdmin()
      .from("clientes")
      .select("nome")
      .eq("id", String(osRecord.cliente_id))
      .maybeSingle();
    empresa = (cliente as { nome?: string } | null)?.nome || empresa;
  }

  let vehicleData: Record<string, unknown> | null = null;
  if (osRecord.veiculo_id) {
    const { data: v } = await getAdmin()
      .from("veiculos")
      .select("marca, modelo, placa, tipo")
      .eq("id", String(osRecord.veiculo_id))
      .maybeSingle();
    vehicleData = v as Record<string, unknown> | null;
  }

  const waypointIds = (waypointsData || []).map((wp: Record<string, unknown>) =>
    String(wp.id),
  );
  let paxRows: Record<string, unknown>[] = [];
  if (waypointIds.length > 0) {
    paxRows = await fetchInChunks<Record<string, unknown>>(
      getAdmin(),
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
      getAdmin(),
      "passageiros",
      "id",
      passageirosList,
      "id, nome_completo, celular",
    );
  }

  const passageiros: PassengerInfo[] = (passageirosData || []).map(
    (p: Record<string, unknown>) => ({
      nome: String(p.nome_completo || ""),
      celular: String(p.celular || ""),
    }),
  );

  const itineraryGroups = new Map<
    number,
    { firstIndex: number; stops: ItineraryGroup["stops"] }
  >();
  (waypointsData || []).forEach((wp: Record<string, unknown>) => {
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
      dateTime:
        wp.data || wp.hora
          ? `${wp.data ? String(wp.data).split("-").reverse().join("/") : ""}${wp.hora ? ` - ${String(wp.hora).slice(0, 5)}` : ""}`.trim()
          : null,
    });
    if (typeof wp.position === "number" && wp.position < group.firstIndex) {
      group.firstIndex = wp.position;
    }
  });

  let sortedGroups: ItineraryGroup[] = Array.from(itineraryGroups.entries())
    .sort((a, b) => a[1].firstIndex - b[1].firstIndex)
    .map(([index, group]) => {
      const stops = group.stops;
      if (stops.length > 0) {
        stops[0].isOrigin = true;
        stops[stops.length - 1].isDestination = true;
      }
      const title =
        index < 0
          ? `🔄 *${Math.abs(index)} Retorno*`
          : `📍 *${index + 1} Itinerário*`;
      const firstWp = (waypointsData || []).find(
        (w: Record<string, unknown>) => w.itinerary_index === index,
      );
      const dateTime =
        firstWp?.data || firstWp?.hora
          ? `${firstWp.data ? String(firstWp.data).split("-").reverse().join("/") : ""}${firstWp.hora ? ` - ${String(firstWp.hora).slice(0, 5)}` : ""}`.trim()
          : "Não informado";
      return {
        index,
        title: `${title} — ${dateTime}`,
        stops,
      };
    });

  // Filtrar itinerários baseado no itineraryIndex
  // Se for 0 (primeiro ciclo), mostra todos
  // Se for diferente de 0, mostra apenas o ciclo específico
  if (itineraryIndex !== 0) {
    sortedGroups = sortedGroups.filter(
      (group) => group.index === itineraryIndex,
    );
  }

  let driverPhone = "Não informado";
  if (osRecord.motorista) {
    const normalized = String(osRecord.motorista)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    const { data: candidates } = await getAdmin()
      .from("drivers")
      .select("name, phone")
      .ilike("name", `%${String(osRecord.motorista).trim()}%`)
      .limit(10);
    const matched = (candidates || []).find((c: Record<string, unknown>) => {
      const n = String(c.name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      return n === normalized || n.includes(normalized);
    });
    if (matched)
      driverPhone = String(
        (matched as { phone?: string }).phone || driverPhone,
      );
  }

  return {
    protocolo: String(osRecord.protocolo || "N/A"),
    osNumber: osRecord.os_number ? String(osRecord.os_number) : null,
    data: osRecord.data ? String(osRecord.data) : null,
    hora: osRecord.hora ? String(osRecord.hora) : null,
    empresa,
    solicitante: osRecord.solicitante ? String(osRecord.solicitante) : null,
    centroCusto: osRecord.centro_custo ? String(osRecord.centro_custo) : null,
    motorista: String(osRecord.motorista || "Não informado"),
    motoristaTelefone: driverPhone,
    veiculoTipo: (vehicleData as { tipo?: string | null } | null)?.tipo || null,
    veiculoMarcaModelo: vehicleData
      ? `${(vehicleData as { marca?: string | null }).marca || ""} ${(vehicleData as { modelo?: string | null }).modelo || ""}`.trim()
      : null,
    veiculoPlaca:
      (vehicleData as { placa?: string | null } | null)?.placa || null,
    passageiros,
    itineraries: sortedGroups,
  };
}

/**
 * Monta a mensagem completa da OS com link de Iniciar Rota para envio pós-aceite.
 * Busca waypoints, passageiros, veículo e cliente para montar a mensagem detalhada.
 */
export async function buildPostAcceptMessage(
  osId: string,
  cycle: OperationalCycle,
): Promise<string> {
  const [{ data: osData }, { data: waypointsData }] = await Promise.all([
    getAdmin()
      .from("ordens_servico")
      .select(
        "protocolo, os_number, data, hora, motorista, cliente_id, solicitante, centro_custo, veiculo_id",
      )
      .eq("id", osId)
      .maybeSingle(),
    getAdmin()
      .from("os_waypoints")
      .select("id, label, comment, itinerary_index, hora, data, position")
      .eq("ordem_servico_id", osId)
      .order("position"),
  ]);

  const osRecord = osData as Record<string, unknown> | null;
  if (!osRecord) {
    throw new Error("OS não encontrada");
  }

  let empresa = "Não informado";
  if (osRecord.cliente_id) {
    const { data: cliente } = await getAdmin()
      .from("clientes")
      .select("nome")
      .eq("id", String(osRecord.cliente_id))
      .maybeSingle();
    empresa = (cliente as { nome?: string } | null)?.nome || empresa;
  }

  let vehicleData: Record<string, unknown> | null = null;
  if (osRecord.veiculo_id) {
    const { data: v } = await getAdmin()
      .from("veiculos")
      .select("marca, modelo, placa, tipo")
      .eq("id", String(osRecord.veiculo_id))
      .maybeSingle();
    vehicleData = v as Record<string, unknown> | null;
  }

  const waypointIds = (waypointsData || []).map((wp: Record<string, unknown>) =>
    String(wp.id),
  );
  let paxRows: Record<string, unknown>[] = [];
  if (waypointIds.length > 0) {
    paxRows = await fetchInChunks<Record<string, unknown>>(
      getAdmin(),
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
      getAdmin(),
      "passageiros",
      "id",
      passageirosList,
      "id, nome_completo, celular",
    );
  }

  const passageiros: PassengerInfo[] = (passageirosData || []).map(
    (p: Record<string, unknown>) => ({
      nome: String(p.nome_completo || ""),
      celular: String(p.celular || ""),
    }),
  );

  const itineraryGroups = new Map<
    number,
    { firstIndex: number; stops: ItineraryGroup["stops"] }
  >();
  (waypointsData || []).forEach((wp: Record<string, unknown>) => {
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
      dateTime:
        wp.data || wp.hora
          ? `${wp.data ? String(wp.data).split("-").reverse().join("/") : ""}${wp.hora ? ` - ${String(wp.hora).slice(0, 5)}` : ""}`.trim()
          : null,
    });
    if (typeof wp.position === "number" && wp.position < group.firstIndex) {
      group.firstIndex = wp.position;
    }
  });

  const sortedGroups: ItineraryGroup[] = Array.from(itineraryGroups.entries())
    .sort((a, b) => a[1].firstIndex - b[1].firstIndex)
    .map(([index, group]) => {
      const stops = group.stops;
      if (stops.length > 0) {
        stops[0].isOrigin = true;
        stops[stops.length - 1].isDestination = true;
      }
      const title =
        index < 0
          ? `🔄 *${Math.abs(index)} Retorno*`
          : `📍 *${index + 1} Itinerário*`;
      const firstWp = (waypointsData || []).find(
        (w: Record<string, unknown>) => w.itinerary_index === index,
      );
      const dateTime =
        firstWp?.data || firstWp?.hora
          ? `${firstWp.data ? String(firstWp.data).split("-").reverse().join("/") : ""}${firstWp.hora ? ` - ${String(firstWp.hora).slice(0, 5)}` : ""}`.trim()
          : "Não informado";
      return {
        index,
        title: `${title} — ${dateTime}`,
        stops,
      };
    });

  let driverPhone = "Não informado";
  if (osRecord.motorista) {
    const normalized = String(osRecord.motorista)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    const { data: candidates } = await getAdmin()
      .from("drivers")
      .select("name, phone")
      .ilike("name", `%${String(osRecord.motorista).trim()}%`)
      .limit(10);
    const matched = (candidates || []).find((c: Record<string, unknown>) => {
      const n = String(c.name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      return n === normalized || n.includes(normalized);
    });
    if (matched)
      driverPhone = String(
        (matched as { phone?: string }).phone || driverPhone,
      );
  }

  const startRouteLink = `${BASE_URL}/iniciar-rota/${osId}?cycle_index=${cycle.itineraryIndex}`;

  return buildDriverNotificationMessage({
    protocolo: String(osRecord.protocolo || "N/A"),
    osNumber: osRecord.os_number ? String(osRecord.os_number) : null,
    data: osRecord.data ? String(osRecord.data) : null,
    hora: osRecord.hora ? String(osRecord.hora) : null,
    fornecedor: "Geolog Transporte Executivo",
    empresa,
    solicitante: osRecord.solicitante ? String(osRecord.solicitante) : null,
    centroCusto: osRecord.centro_custo ? String(osRecord.centro_custo) : null,
    motorista: String(osRecord.motorista || "Não informado"),
    motoristaTelefone: driverPhone,
    veiculoTipo: (vehicleData as { tipo?: string | null } | null)?.tipo || null,
    veiculoMarcaModelo: vehicleData
      ? `${(vehicleData as { marca?: string | null }).marca || ""} ${(vehicleData as { modelo?: string | null }).modelo || ""}`.trim()
      : null,
    veiculoPlaca:
      (vehicleData as { placa?: string | null } | null)?.placa || null,
    passageiros,
    itineraries: sortedGroups,
    startRouteLink,
  });
}

/**
 * Processa o aceite do motorista para uma OS.
 * Atualiza o status no banco e envia mensagem de confirmação.
 */
export async function processDriverAccept(
  osId: string,
  requestedCycleIndex?: number | null,
  skipNotification = false,
): Promise<DriverAcceptResult> {
  const { data: osRaw, error: findError } = await getAdmin()
    .from("ordens_servico")
    .select(
      "id, status_operacional, motorista, veiculo_id, protocolo, os_number, data, hora",
    )
    .eq("id", osId)
    .single();

  const os = osRaw as OSDriverRouteRow | null;

  console.log(
    "[driver-accept] OS encontrada:",
    os?.id,
    "motorista:",
    os?.motorista,
    "status:",
    os?.status_operacional,
  );

  if (findError || !os) {
    return { success: false, error: "Ordem de serviço não encontrada." };
  }

  const cycles = await fetchOperationalCyclesForOS(getAdmin(), osId);
  const cycle = resolveCycle(cycles, requestedCycleIndex ?? null);

  if (!cycle) {
    return {
      success: false,
      error: "Ciclo operacional não encontrado para esta OS.",
    };
  }

  if (
    cycle.state !== "pending" &&
    cycle.state !== "cancelled" &&
    cycle.state !== "awaiting_accept"
  ) {
    return {
      success: true,
      alreadyAccepted: true,
      message: "Viagem já aceita pelo motorista anteriormente.",
    };
  }

  const now = new Date().toISOString();
  const updatedCycles = updateCycleInList(cycles, cycle.itineraryIndex, {
    state: "awaiting_start",
    acceptedAt: now,
    messageSentAt: cycle.messageSentAt || now,
  });

  await replaceOperationalCyclesForOS(getAdmin(), osId, updatedCycles);

  const { error: updateError } = await getAdmin()
    .from("ordens_servico")
    .update({
      status_operacional: "Aguardando",
      driver_accepted_at: now,
    })
    .eq("id", osId);

  if (updateError) {
    return { success: false, error: "Erro ao registrar aceite do motorista." };
  }

  // Registrar log driver_accept → trigger gera notificação no sino
  try {
    await (getAdmin().from("os_logs") as unknown as {
      insert: (values: Record<string, unknown>) => Promise<unknown>;
    }).insert({
      os_id: osId,
      type: "driver_accept",
      actor_name: os.motorista || "Motorista",
      description: `Motorista visualizou o atendimento${cycle ? ` — Ciclo ${cycle.itineraryIndex + 1}` : ""}`,
      metadata: {
        cycle_index: cycle?.itineraryIndex ?? null,
        cycle_kind: cycle?.kind ?? null,
        cycle_ordinal: cycle?.ordinal ?? null,
        motorista: os.motorista || "Motorista",
      },
    });
  } catch (logErr) {
    console.error("[driver-accept] Erro ao registrar log driver_accept:", logErr);
  }

  // Enviar mensagem de confirmação
  let messageSent = false;
  if (skipNotification) {
    console.log("[driver-accept] Notificação omitida (skipNotification=true)");
  }
  try {
    if (skipNotification) {
      // nada a fazer
    } else if (os.motorista) {
      const motoristaNormalized = normalizeName(String(os.motorista));

      const { data: driverCandidates, error: driverError } = await getAdmin()
        .from("drivers")
        .select("name, phone")
        .ilike("name", `%${escapeLikePattern(String(os.motorista).trim())}%`)
        .limit(10);

      const matchedDriver =
        driverCandidates?.find(
          (candidate) =>
            normalizeName(candidate.name || "") === motoristaNormalized,
        ) ||
        driverCandidates?.find((candidate) =>
          normalizeName(candidate.name || "").includes(motoristaNormalized),
        );

      const driverPhone = matchedDriver?.phone?.trim();

      console.log("[driver-accept] Driver lookup:", {
        name: os.motorista,
        matchedName: matchedDriver?.name,
        phone: driverPhone,
        candidates: driverCandidates?.length || 0,
        error: driverError?.message,
      });

      if (driverPhone) {
        const confirmationMsg = await buildPostAcceptMessage(osId, cycle);

        console.log(
          "[driver-accept] Enviando mensagem completa da OS com link Iniciar Rota:",
          driverPhone,
        );
        const result = await sendWhatsAppMessage(driverPhone, confirmationMsg);
        if (result.success) {
          messageSent = true;
          console.log(
            "[driver-accept] Mensagem de confirmação enviada com sucesso",
          );
        } else {
          console.warn(
            "[driver-accept] Erro ao enviar mensagem de confirmação:",
            result.error,
          );
        }
      } else {
        console.warn("[driver-accept] Telefone do motorista não encontrado", {
          motorista: os.motorista,
          candidates: driverCandidates?.map((candidate) => candidate.name),
        });
      }
    } else {
      console.warn("[driver-accept] OS sem motorista definido");
    }
  } catch (notifyErr) {
    console.error(
      "[driver-accept] Erro ao enviar mensagem (Meta API):",
      notifyErr,
    );
  }

  return {
    success: true,
    message: messageSent
      ? "Viagem aceita. Mensagens enviadas ao motorista."
      : "Viagem aceita.",
    cycle,
    messageSent,
  };
}
