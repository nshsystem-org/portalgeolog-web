/**
 * Webhook da Meta (WhatsApp Business API)
 *
 * Recebe notificações de interações do motorista via WhatsApp:
 * - Clique em botão CTA do template "appointment_scheduling" (Detalhes do Serviço)
 * - Flow completado do template "inicio_viagem_motorista" (KM inicial)
 * - Flow completado do template "finalizar_viagem_motoristas" (KM final)
 *
 * Fluxo:
 * 1. Meta envia GET com hub.verify_token para validação do webhook
 * 2. Meta envia POST quando o usuário interage com templates/flows
 * 3. Extraímos o payload e processamos aceite, início ou finalização da OS
 *
 * Configuração no Meta Business Manager:
 * - Callback URL: https://portalgeolog.com.br/api/meta-webhook
 * - Verify token: mesmo valor de META_WEBHOOK_VERIFY_TOKEN
 */

import { NextResponse } from "next/server";
import { fetchInChunks } from "@/lib/supabase/chunked-in-query";
import { createClient } from "@supabase/supabase-js";
import { processDriverAccept } from "@/lib/driver-accept";
import {
  normalizeWhatsAppPhone,
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
} from "@/lib/meta";
import { recordWhatsAppLog } from "@/lib/whatsapp-logs";
import {
  buildPassengerDetailsMessage,
  getOperationalCycleTitle,
  normalizeOperationalCycles,
  deriveCyclesOperationalStatus,
  type ItineraryGroup,
  type ItineraryStop,
  type OperationalCycleState,
} from "@/lib/os-messages";

// Cache simples para deduplicação de mensagens (Wamids)
// Em Cloudflare Workers, variáveis globais podem persistir entre requisições no mesmo isolate.
const processedMessages = new Set<string>();
const CACHE_LIMIT = 500;

function isDuplicateMessage(messageId: string): boolean {
  if (processedMessages.has(messageId)) return true;
  processedMessages.add(messageId);
  if (processedMessages.size > CACHE_LIMIT) {
    const first = processedMessages.values().next().value;
    if (first) processedMessages.delete(first);
  }
  return false;
}

interface OSRecord {
  id?: string;
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

type OrdensServicoUpdateBuilder = {
  update(values: Record<string, unknown>): {
    eq(column: string, value: string): Promise<{ error: Error | null }>;
  };
};

interface WaypointRecord {
  id?: string;
  label?: string | null;
  comment?: string | null;
  itinerary_index?: number;
  hora?: string | null;
  data?: string | null;
  position?: number;
}

export const runtime = "edge";

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
const getAdmin = () => {
  if (!_supabaseAdmin)
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  return _supabaseAdmin;
};

function numeroParaOrdinal(n: number): string {
  const unidades = [
    "",
    "Primeiro",
    "Segundo",
    "Terceiro",
    "Quarto",
    "Quinto",
    "Sexto",
    "Sétimo",
    "Oitavo",
    "Nono",
  ];
  const especiais: Record<number, string> = {
    10: "Décimo",
    11: "Décimo Primeiro",
    12: "Décimo Segundo",
    13: "Décimo Terceiro",
    14: "Décimo Quarto",
    15: "Décimo Quinto",
    16: "Décimo Sexto",
    17: "Décimo Sétimo",
    18: "Décimo Oitavo",
    19: "Décimo Nono",
  };
  const dezenas: Record<number, string> = {
    2: "Vigésimo",
    3: "Trigésimo",
    4: "Quadragésimo",
    5: "Quinquagésimo",
    6: "Sexagésimo",
    7: "Septuagésimo",
    8: "Octogésimo",
    9: "Nonagésimo",
  };
  if (n >= 1 && n <= 9) return unidades[n];
  if (n >= 10 && n <= 19) return especiais[n] || "";
  if (n >= 20 && n <= 99) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    const dt = dezenas[d] || "";
    const ut = u > 0 ? unidades[u] : "";
    if (dt && ut) return `${dt} ${ut}`;
    return dt || ut || String(n);
  }
  if (n === 100) return "Centésimo";
  return String(n);
}

function formatDate(value?: string | null): string {
  if (!value) return "Não informado";
  if (value.includes("/")) return value;
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

async function handlePassengerDetailsRequest(phone: string, contextId: string) {
  try {
    console.log("[meta-webhook] Buscando OS pelo contextId:", contextId);

    const { data: confirmation } = await getAdmin()
      .from("os_passenger_confirmations")
      .select("os_id, passageiro_id")
      .eq("template_message_id", contextId)
      .maybeSingle();

    let osId: string;

    if (confirmation) {
      osId = (confirmation as { os_id: string; passageiro_id: string | null })
        .os_id;
    } else {
      console.log(
        "[meta-webhook] Confirmação de passageiro não encontrada, tentando lookup por driver_template_message_id...",
      );
      const { data: driverOS } = await getAdmin()
        .from("ordens_servico")
        .select("id")
        .eq("driver_template_message_id", contextId)
        .maybeSingle();

      if (!driverOS) {
        console.warn(
          "[meta-webhook] Nenhum registro encontrado para contextId:",
          contextId,
        );
        return;
      }
      osId = (driverOS as { id: string }).id;

      // Auto-aceite para motorista solicitando detalhes do serviço
      try {
        const result = await processDriverAccept(osId, undefined, true);
        if (result.success && !result.alreadyAccepted) {
          console.log(
            "[meta-webhook] OS auto-aceita via detalhes do serviço:",
            osId,
          );
        }
      } catch (acceptErr) {
        console.error(
          "[meta-webhook] Erro ao auto-aceitar via detalhes:",
          acceptErr,
        );
      }

      console.log(
        "[meta-webhook] OS encontrada via driver_template_message_id:",
        osId,
      );
    }

    let osData: OSRecord | null = null;

    const [, { data: vehicleData }, { data: waypointsData }] =
      await Promise.all([
        getAdmin()
          .from("ordens_servico")
          .select(
            "protocolo, os_number, data, hora, motorista, cliente_id, solicitante, centro_custo, veiculo_id, driver_id, driver_operation_cycles",
          )
          .eq("id", osId)
          .maybeSingle()
          .then(({ data }) => {
            osData = data as OSRecord | null;
            return { data: osData };
          }),
        getAdmin()
          .from("ordens_servico")
          .select("veiculo_id")
          .eq("id", osId)
          .maybeSingle()
          .then(async ({ data: osVehicle }) => {
            const vehicle = osVehicle as { veiculo_id?: string | null } | null;
            if (!vehicle?.veiculo_id) return { data: null };
            return getAdmin()
              .from("veiculos")
              .select("marca, modelo, placa, tipo")
              .eq("id", vehicle.veiculo_id)
              .maybeSingle();
          }),
        getAdmin()
          .from("os_waypoints")
          .select("id, label, comment, itinerary_index, hora, data, position")
          .eq("ordem_servico_id", osId)
          .order("position"),
      ]);

    const waypointIds = (waypointsData || []).map(
      (wp: Record<string, unknown>) => String(wp.id),
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

    let driverPhone = "Não informado";
    const osRecord = osData as OSRecord | null;
    if (osRecord?.driver_id) {
      const { data: driverRow } = await getAdmin()
        .from("drivers")
        .select("phone")
        .eq("id", osRecord.driver_id)
        .maybeSingle();
      if (driverRow) {
        driverPhone = normalizeWhatsAppPhone(
          String((driverRow as { phone?: string }).phone || "Não informado"),
        );
      }
    }
    if (driverPhone === "Não informado" && osRecord?.motorista) {
      const normalized = osRecord.motorista
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      const { data: candidates } = await getAdmin()
        .from("drivers")
        .select("name, phone")
        .ilike("name", `%${osRecord.motorista.trim()}%`)
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
        driverPhone = normalizeWhatsAppPhone(
          String((matched as { phone?: string }).phone || driverPhone),
        );
    }
    // Se ainda não encontrou o motorista no banco, usa o telefone do webhook
    // (caso comum quando o motorista está cadastrado sem código do país)
    if (driverPhone === "Não informado") {
      driverPhone = normalizeWhatsAppPhone(phone);
      console.log(
        "[meta-webhook] Usando telefone do webhook como fallback:",
        driverPhone,
      );
    }

    let empresa = "Não informado";
    if (osRecord?.cliente_id) {
      const { data: cliente } = await getAdmin()
        .from("clientes")
        .select("nome")
        .eq("id", osRecord.cliente_id)
        .maybeSingle();
      empresa = (cliente as { nome?: string } | null)?.nome || empresa;
    }

    const passengerIds = new Set<string>();
    (paxRows || []).forEach((row: Record<string, unknown>) => {
      const pid = String(row.passageiro_id || "");
      if (pid) passengerIds.add(pid);
    });

    const { data: passageirosData } = await getAdmin()
      .from("passageiros")
      .select("id, nome_completo, celular")
      .in("id", Array.from(passengerIds));

    const passageiros = (passageirosData || []).map(
      (p: Record<string, unknown>) => ({
        nome: String(p.nome_completo || ""),
        celular: String(p.celular || ""),
      }),
    );

    const itineraryGroups = new Map<
      number,
      { firstIndex: number; stops: ItineraryStop[] }
    >();
    (waypointsData || []).forEach((wp: Record<string, unknown>) => {
      const idx =
        typeof wp.itinerary_index === "number" ? wp.itinerary_index : 0;
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
        const title =
          kind === "return"
            ? `🔄 *${numeroParaOrdinal(ordinal)} Retorno*`
            : `📍 *${numeroParaOrdinal(ordinal)} Itinerário*`;
        const firstWp = (waypointsData || []).find(
          (w: Record<string, unknown>) => w.itinerary_index === index,
        ) as WaypointRecord | undefined;
        const dateTime = formatDateTime(
          String(firstWp?.data || osRecord?.data || null),
          String(firstWp?.hora || osRecord?.hora || null),
        );
        return {
          index,
          title: `${title} — ${dateTime}`,
          dateTime: undefined,
          stops,
        } as ItineraryGroup;
      });

    const message = buildPassengerDetailsMessage({
      protocolo: osRecord?.protocolo || "N/A",
      osNumber: osRecord?.os_number || null,
      fornecedor: "Geolog Transporte Executivo",
      empresa,
      solicitante: osRecord?.solicitante || null,
      motorista: osRecord?.motorista || "Não informado",
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

    await sendWhatsAppMessage(phone, message);
    console.log(
      "[meta-webhook] Mensagem de detalhes enviada com sucesso para",
      phone,
    );

    // Envia template flow "inicio_viagem_motorista" para o motorista
    // O template contem header (titulo do ciclo), body (nome do motorista)
    // e um botao de flow "INICIAR VIAGEM" onde o motorista digita o KM inicial
    try {
      const rawCycles = (osRecord as Record<string, unknown> | null)
        ?.driver_operation_cycles;
      const cycles = normalizeOperationalCycles(rawCycles);
      const pendingCycle = cycles.find(
        (c) => c.state !== "completed" && c.state !== "cancelled",
      );
      const targetCycle = pendingCycle || cycles[0];

      if (targetCycle) {
        if (driverPhone === "Não informado") {
          console.warn(
            "[meta-webhook] Template flow inicio_viagem_motorista não enviado: driverPhone não informado",
          );
        }
      }

      if (targetCycle && driverPhone !== "Não informado") {
        const cycleTitle = getOperationalCycleTitle(targetCycle);
        const motoristaName = String(osRecord?.motorista || "Motorista");

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

        const templateResult = await sendWhatsAppTemplate(
          driverPhone,
          "inicio_viagem_motorista",
          "pt_BR",
          templateComponents,
        );

        if (templateResult.success && templateResult.messageId) {
          // Atualizar messageSentAt no ciclo específico dentro de driver_operation_cycles
          const updatedCycles = cycles.map((cycle) => {
            if (cycle.itineraryIndex === targetCycle.itineraryIndex) {
              return {
                ...cycle,
                messageSentAt: new Date().toISOString(),
                state: "awaiting_accept" as const,
              };
            }
            return cycle;
          });

          await getAdmin()
            .from("ordens_servico")
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            .update({
              driver_flow_start_message_id: templateResult.messageId,
              driver_operation_cycles: updatedCycles,
            })
            .eq("id", osId);
          console.log(
            "[meta-webhook] Template flow inicio_viagem_motorista enviado para",
            driverPhone,
            "cycle:",
            cycleTitle,
            "msgId:",
            templateResult.messageId,
            "messageSentAt atualizado para ciclo:",
            targetCycle.itineraryIndex,
          );
        } else {
          console.warn(
            "[meta-webhook] Falha ao enviar template flow inicio_viagem_motorista:",
            templateResult.error,
          );
        }
      }
    } catch (templateErr) {
      console.error(
        "[meta-webhook] Erro ao enviar template flow inicio_viagem_motorista:",
        templateErr,
      );
    }
  } catch (err) {
    console.error("[meta-webhook] Erro ao enviar detalhes:", err);
  }
}

async function sendNextCyclePreviewAndStartFlow(
  osId: string,
  phone: string,
  targetCycleIndex: number,
) {
  console.log(
    "[meta-webhook] sendNextCyclePreviewAndStartFlow chamado para OS:",
    osId,
    "phone:",
    phone,
    "targetCycleIndex:",
    targetCycleIndex,
  );

  try {
    const [{ data: osData }, { data: waypointsData }] = await Promise.all([
      getAdmin()
        .from("ordens_servico")
        .select(
          "protocolo, os_number, data, hora, motorista, cliente_id, solicitante, centro_custo, veiculo_id, driver_operation_cycles, current_driver_cycle_index",
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
      console.warn(
        "[meta-webhook] OS não encontrada ao preparar próximo ciclo:",
        osId,
      );
      return;
    }

    console.log(
      "[meta-webhook] OS encontrada, driver_operation_cycles:",
      osRecord.driver_operation_cycles,
    );

    const cycles = normalizeOperationalCycles(osRecord.driver_operation_cycles);
    console.log(
      "[meta-webhook] Ciclos normalizados:",
      cycles.map((c) => ({
        itineraryIndex: c.itineraryIndex,
        sequenceOrder: c.sequenceOrder,
        state: c.state,
        title: c.title,
      })),
    );

    const targetCycle = cycles.find(
      (cycle) => cycle.itineraryIndex === targetCycleIndex,
    );

    if (!targetCycle) {
      console.warn(
        "[meta-webhook] Próximo ciclo não encontrado:",
        targetCycleIndex,
        "ciclos disponíveis:",
        cycles.map((c) => ({
          itineraryIndex: c.itineraryIndex,
          sequenceOrder: c.sequenceOrder,
          state: c.state,
          title: c.title,
        })),
        "OS:",
        osId,
      );
      return;
    }

    console.log(
      "[meta-webhook] Ciclo alvo encontrado:",
      targetCycle.itineraryIndex,
      targetCycle.title,
      targetCycle.state,
    );

    let vehicleData: Record<string, unknown> | null = null;
    if (osRecord.veiculo_id) {
      const { data: vehicle } = await getAdmin()
        .from("veiculos")
        .select("marca, modelo, placa, tipo")
        .eq("id", String(osRecord.veiculo_id))
        .maybeSingle();
      vehicleData = vehicle as Record<string, unknown> | null;
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

    const cycleWaypoints = (waypointsData || []).filter(
      (wp: Record<string, unknown>) =>
        Number(wp.itinerary_index ?? 0) === targetCycleIndex,
    );

    const waypointIds = cycleWaypoints.map((wp: Record<string, unknown>) =>
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

    const passageiros = (passageirosData || []).map(
      (p: Record<string, unknown>) => ({
        nome: String(p.nome_completo || ""),
        celular: String(p.celular || ""),
      }),
    );

    const itineraryGroups = new Map<
      number,
      { firstIndex: number; stops: ItineraryStop[] }
    >();

    cycleWaypoints.forEach((wp: Record<string, unknown>) => {
      const idx =
        typeof wp.itinerary_index === "number" ? wp.itinerary_index : 0;

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
        const title =
          kind === "return"
            ? `🔄 *${numeroParaOrdinal(ordinal)} Retorno*`
            : `📍 *${numeroParaOrdinal(ordinal)} Itinerário*`;
        const firstWp = cycleWaypoints.find(
          (w: Record<string, unknown>) => w.itinerary_index === index,
        ) as WaypointRecord | undefined;
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
        motoristaTelefone: phone,
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

    const previewResult = await sendWhatsAppMessage(phone, introMessage);
    if (!previewResult.success) {
      console.warn(
        "[meta-webhook] Falha ao enviar prévia do próximo ciclo:",
        previewResult.error,
      );
    }

    const cycleTitle = getOperationalCycleTitle(targetCycle);
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

    const templateResult = await sendWhatsAppTemplate(
      phone,
      "inicio_viagem_motorista",
      "pt_BR",
      templateComponents,
    );

    if (templateResult.success && templateResult.messageId) {
      // Atualizar messageSentAt no ciclo específico dentro de driver_operation_cycles
      const currentCycles = cycles;
      const updatedCycles = currentCycles.map((cycle) => {
        if (cycle.itineraryIndex === targetCycleIndex) {
          return {
            ...cycle,
            messageSentAt: new Date().toISOString(),
            state: "awaiting_accept" as const,
          };
        }
        return cycle;
      });

      await getAdmin()
        .from("ordens_servico")
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        .update({
          driver_flow_start_message_id: templateResult.messageId,
          current_driver_cycle_index: targetCycle.sequenceOrder,
          driver_operation_cycles: updatedCycles,
        })
        .eq("id", osId);

      console.log(
        "[meta-webhook] Próximo ciclo preparado com sucesso:",
        cycleTitle,
        "msgId:",
        templateResult.messageId,
        "messageSentAt atualizado para ciclo:",
        targetCycleIndex,
      );
    } else {
      console.warn(
        "[meta-webhook] Falha ao enviar template flow inicio_viagem_motorista para o próximo ciclo:",
        templateResult.error,
      );
    }
  } catch (error) {
    console.error(
      "[meta-webhook] Erro ao preparar próximo ciclo operacional:",
      error,
    );
  }
}

/**
 * Processa um flow completado pelo motorista (KM inicial ou KM final).
 * O response_json vem em base64 dentro do evento interactive.nfm do webhook da Meta.
 */
async function handleFlowCompleted(
  phone: string,
  contextId: string,
  responseJson: string,
) {
  try {
    let data: Record<string, unknown>;
    try {
      const decoded = atob(responseJson);
      data = JSON.parse(decoded);
      console.log("[meta-webhook] Flow response decoded (base64):", data);
    } catch {
      data = JSON.parse(responseJson);
      console.log("[meta-webhook] Flow response decoded (raw json):", data);
    }

    // Extrair o primeiro valor numerico valido (KM)
    let kmValue: number | null = null;
    for (const [key, value] of Object.entries(data)) {
      if (key === "flow_token") continue;
      const num = Number(value);
      if (!Number.isNaN(num) && num >= 0) {
        kmValue = num;
        break;
      }
    }

    if (kmValue === null) {
      console.warn(
        "[meta-webhook] Valor de KM nao encontrado no flow:",
        data,
      );
      return;
    }

    // Buscar OS pelo contextId (messageId do template original)
    const { data: osData } = await getAdmin()
      .from("ordens_servico")
      .select(
        "id, motorista, driver_operation_cycles, driver_flow_start_message_id, driver_flow_finish_message_id",
      )
      .or(
        `driver_flow_start_message_id.eq.${contextId},driver_flow_finish_message_id.eq.${contextId}`,
      )
      .maybeSingle();

    if (!osData) {
      console.warn(
        "[meta-webhook] OS nao encontrada para flow contextId:",
        contextId,
      );
      return;
    }

    const osRecord = osData as Record<string, unknown>;
    const cycles = normalizeOperationalCycles(osRecord.driver_operation_cycles);

    if (osRecord.driver_flow_start_message_id === contextId) {
      // Flow de inicio: registra KM inicial, status "Em Rota", envia template de finalizar
      const pendingCycle = cycles.find(
        (c) => c.state !== "completed" && c.state !== "cancelled",
      );
      const targetCycle = pendingCycle || cycles[0];

      if (targetCycle) {
        const updatedCycles = cycles.map((cycle) =>
          cycle.itineraryIndex === targetCycle.itineraryIndex
            ? {
                ...cycle,
                state: "awaiting_finish" as OperationalCycleState,
                kmInitial: kmValue,
                startedAt: new Date().toISOString(),
              }
            : cycle,
        );

        const newStatus = deriveCyclesOperationalStatus(updatedCycles);

        const ordensServico = getAdmin().from(
          "ordens_servico",
        ) as unknown as OrdensServicoUpdateBuilder;
        await ordensServico
          .update({
            status_operacional: newStatus,
            driver_operation_cycles: updatedCycles,
            route_started_at: new Date().toISOString(),
            route_started_km: kmValue,
          })
          .eq("id", osRecord.id as string);

        console.log(
          "[meta-webhook] KM inicial registrado via flow:",
          kmValue,
          "OS:",
          osRecord.id,
        );

        // Enviar template flow "finalizar_viagem_motoristas" com KM inicial no body
        const kmFormatted = kmValue.toLocaleString("pt-BR");
        const finishComponents = [
          {
            type: "body",
            parameters: [{ type: "text", text: kmFormatted }],
          },
          {
            type: "button",
            sub_type: "flow",
            index: 0,
            parameters: [],
          },
        ];

        const finishResult = await sendWhatsAppTemplate(
          phone,
          "finalizar_viagem_motoristas",
          "pt_BR",
          finishComponents,
        );

        if (finishResult.success && finishResult.messageId) {
          const ordensServico2 = getAdmin().from(
            "ordens_servico",
          ) as unknown as OrdensServicoUpdateBuilder;
          await ordensServico2.update({
            driver_flow_finish_message_id: finishResult.messageId,
          })
            .eq("id", osRecord.id as string);
          console.log(
            "[meta-webhook] Template flow finalizar_viagem_motoristas enviado para",
            phone,
            "msgId:",
            finishResult.messageId,
          );
        } else {
          console.warn(
            "[meta-webhook] Falha ao enviar template flow finalizar_viagem_motoristas:",
            finishResult.error,
          );
        }
      }
    } else if (osRecord.driver_flow_finish_message_id === contextId) {
      // Flow de finalizacao: registra KM final, status "Finalizado" ou "Em Rota"
      const activeCycle = cycles.find(
        (c) => c.state === "awaiting_finish" || c.state === "awaiting_km_finish",
      );
      const targetCycle =
        activeCycle ||
        cycles.find((c) => c.state !== "completed" && c.state !== "cancelled") ||
        cycles[0];

      if (targetCycle) {
        const kmInicial = targetCycle.kmInitial || 0;

        if (kmValue <= kmInicial) {
          const erroMsg =
            `⚠️ *KM Inválido*\n\n` +
            `O KM final (${kmValue.toLocaleString("pt-BR")}) não pode ser menor ou igual ao KM inicial (${kmInicial.toLocaleString("pt-BR")}).\n\n` +
            `Por favor, verifique o hodômetro do veículo e tente novamente.`;
          await sendWhatsAppMessage(phone, erroMsg);

          const kmFormatted = kmInicial.toLocaleString("pt-BR");
          const retryComponents = [
            {
              type: "body",
              parameters: [{ type: "text", text: kmFormatted }],
            },
            {
              type: "button",
              sub_type: "flow",
              index: 0,
              parameters: [],
            },
          ];

          const retryResult = await sendWhatsAppTemplate(
            phone,
            "finalizar_viagem_motoristas",
            "pt_BR",
            retryComponents,
          );

          if (!retryResult.success) {
            console.warn(
              "[meta-webhook] Falha ao reenviar template flow finalizar_viagem_motoristas:",
              retryResult.error,
            );
          } else {
            console.log(
              "[meta-webhook] Template flow finalizar_viagem_motoristas reenviado para",
              phone,
              "msgId:",
              retryResult.messageId,
            );
            // Atualizar driver_flow_finish_message_id para o novo messageId
            // para que o próximo clique do motorista seja encontrado
            try {
              const ordensServicoRetry = getAdmin().from(
                "ordens_servico",
              ) as unknown as OrdensServicoUpdateBuilder;
              await ordensServicoRetry
                .update({
                  driver_flow_finish_message_id: retryResult.messageId,
                })
                .eq("id", osRecord.id as string);
              console.log(
                "[meta-webhook] driver_flow_finish_message_id atualizado para novo msgId:",
                retryResult.messageId,
              );
            } catch (updateErr) {
              console.error(
                "[meta-webhook] Erro ao atualizar driver_flow_finish_message_id:",
                updateErr,
              );
            }
          }

          console.warn(
            "[meta-webhook] KM final invalido:",
            kmValue,
            "<= inicial:",
            kmInicial,
            "OS:",
            osRecord.id,
          );
          return;
        }

        const updatedCycles = cycles.map((cycle) =>
          cycle.itineraryIndex === targetCycle.itineraryIndex
            ? {
                ...cycle,
                state: "completed" as OperationalCycleState,
                kmFinal: kmValue,
                finishedAt: new Date().toISOString(),
              }
            : cycle,
        );

        const newStatus = deriveCyclesOperationalStatus(updatedCycles);

        const ordensServico3 = getAdmin().from(
          "ordens_servico",
        ) as unknown as OrdensServicoUpdateBuilder;
        await ordensServico3
          .update({
            status_operacional: newStatus,
            driver_operation_cycles: updatedCycles,
            route_finished_at: new Date().toISOString(),
            route_finished_km: kmValue,
          })
          .eq("id", osRecord.id as string);

        console.log(
          "[meta-webhook] KM final registrado via flow:",
          kmValue,
          "OS:",
          osRecord.id,
          "novo status:",
          newStatus,
        );

        // Enviar mensagem de agradecimento ao motorista
        try {
          const motoristaName = String(osRecord.motorista || "Motorista");
          const distancia = kmValue - kmInicial;
          const agradecimentoMsg =
            `Obrigado, *${motoristaName}*! 🎉\n\n` +
            `Sua viagem foi concluída com sucesso. Agradecemos pela dedicação e profissionalismo!\n\n` +
            `*Resumo da viagem:*\n` +
            `📍 KM Inicial: ${kmInicial.toLocaleString("pt-BR")}\n` +
            `🏁 KM Final: ${kmValue.toLocaleString("pt-BR")}\n` +
            `📏 Distância percorrida: ${distancia > 0 ? distancia.toLocaleString("pt-BR") : "0"} km\n\n` +
            `A Portal Geolog agradece sua parceria. Tenha um excelente dia e volte sempre! 🚗✨`;

          const msgResult = await sendWhatsAppMessage(phone, agradecimentoMsg);
          if (msgResult.success) {
            console.log(
              "[meta-webhook] Mensagem de agradecimento enviada para",
              phone,
            );
          } else {
            console.warn(
              "[meta-webhook] Falha ao enviar mensagem de agradecimento:",
              msgResult.error,
            );
          }

          console.log(
            "[meta-webhook] Verificando próximos ciclos. Ciclo atual finalizado:",
            targetCycle.itineraryIndex,
            "sequenceOrder:",
            targetCycle.sequenceOrder,
            "Todos os ciclos:",
            cycles.map((c) => ({
              itineraryIndex: c.itineraryIndex,
              sequenceOrder: c.sequenceOrder,
              state: c.state,
              title: c.title,
            })),
          );

          const remainingCycles = cycles
            .filter(
              (cycle) =>
                cycle.sequenceOrder > targetCycle.sequenceOrder &&
                cycle.state !== "completed" &&
                cycle.state !== "cancelled",
            )
            .sort((a, b) => a.sequenceOrder - b.sequenceOrder);

          console.log(
            "[meta-webhook] Ciclos restantes após filtro:",
            remainingCycles.map((c) => ({
              itineraryIndex: c.itineraryIndex,
              sequenceOrder: c.sequenceOrder,
              state: c.state,
              title: c.title,
            })),
          );

          const nextCycle = remainingCycles[0];

          if (nextCycle) {
            console.log(
              "[meta-webhook] Próximo ciclo encontrado após finalização:",
              nextCycle.itineraryIndex,
              nextCycle.title,
            );
            await sendNextCyclePreviewAndStartFlow(
              String(osRecord.id),
              phone,
              nextCycle.itineraryIndex,
            );
          } else {
            console.log(
              "[meta-webhook] Nenhum próximo ciclo encontrado para enviar prévia.",
            );
          }
        } catch (msgErr) {
          console.error(
            "[meta-webhook] Erro ao enviar mensagem de agradecimento:",
            msgErr,
          );
        }
      }
    }
  } catch (err) {
    console.error("[meta-webhook] Erro ao processar flow completado:", err);
  }
}

/**
 * GET: Verificação do webhook (Meta envia hub.mode, hub.verify_token, hub.challenge)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  console.log("[meta-webhook] GET verification:", {
    mode,
    token: token ? "***" : null,
    hasChallenge: !!challenge,
  });

  if (!verifyToken) {
    console.error("[meta-webhook] META_WEBHOOK_VERIFY_TOKEN não configurado");
    return new Response("Webhook verify token not configured", { status: 500 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[meta-webhook] Webhook verificado com sucesso");
    return new Response(challenge, { status: 200 });
  }

  console.warn("[meta-webhook] Falha na verificação:", {
    mode,
    tokenMatch: token === verifyToken,
  });
  return new Response("Forbidden", { status: 403 });
}

/**
 * POST: Recebe notificações de eventos do WhatsApp (botões CTA e flows)
 *
 * O template "appointment_scheduling" possui o botão CTA "Detalhes do Serviço".
 * Ao clicar, o motorista recebe:
 * 1. Auto-aceite da OS (processDriverAccept)
 * 2. Mensagem completa com detalhes do serviço
 * 3. Template flow "inicio_viagem_motorista" com botão "INICIAR VIAGEM"
 *
 * Quando o motorista completa o flow "inicio_viagem_motorista":
 * - Registra KM inicial, atualiza status para "Em Rota"
 * - Envia automaticamente template flow "finalizar_viagem_motoristas"
 *
 * Quando o motorista completa o flow "finalizar_viagem_motoristas":
 * - Registra KM final, atualiza status para "Finalizado"
 *
 * Otimização: processamento é fire-and-forget para responder
 * 200 imediatamente ao Meta e evitar timeout/retry.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log(
      "[meta-webhook] POST body completo:",
      JSON.stringify(body),
    );

    await recordWhatsAppLog({
      source: "meta-webhook",
      eventType: "webhook_payload",
      payload: body as Record<string, unknown>,
    });

    const entries = body?.entry || [];
    const processingTasks: Promise<void>[] = [];

    for (const entry of entries) {
      const changes = entry?.changes || [];

      for (const change of changes) {
        const value = change?.value;
        const messages = value?.messages || [];

        for (const message of messages) {
          const msgType = message?.type;
          const contextId = message?.context?.id;
          const phone = message?.from;

          console.log("[meta-webhook] Mensagem recebida:", {
            msgType,
            phone,
            contextId,
            messageId: message?.id,
            hasInteractive: !!message?.interactive,
            hasButton: !!message?.button,
          });
          void recordWhatsAppLog({
            source: "meta-webhook",
            eventType: "message_received",
            payload: {
              msgType,
              phone,
              contextId,
              messageId: message?.id,
              hasInteractive: !!message?.interactive,
              hasButton: !!message?.button,
            },
          });

          // Deduplicação
          if (message?.id && isDuplicateMessage(message.id)) {
            console.log("[meta-webhook] Duplicada ignorada:", message.id);
            void recordWhatsAppLog({
              source: "meta-webhook",
              eventType: "message_duplicate_ignored",
              payload: {
                messageId: message.id,
                phone,
                contextId,
              },
            });
            continue;
          }

          // Tratamento de flow completado (interactive.type === "nfm_reply")
          const interactive = message?.interactive;
          const nfmReply = interactive?.nfm_reply;
          if (interactive && nfmReply && nfmReply.response_json && contextId && phone) {
            console.log("[meta-webhook] Flow completado detectado:", {
              phone,
              contextId,
              responseJson: nfmReply.response_json,
            });
            void recordWhatsAppLog({
              source: "meta-webhook",
              eventType: "flow_completed_detected",
              payload: {
                phone,
                contextId,
                responseJson: nfmReply.response_json,
              },
            });
            processingTasks.push(
              (async () => {
                try {
                  await handleFlowCompleted(
                    phone,
                    contextId,
                    nfmReply.response_json,
                  );
                } catch (err) {
                  console.error(
                    "[meta-webhook] Erro ao processar flow:",
                    err,
                  );
                }
              })(),
            );
            continue;
          }

          // Tratamento de botões interativos (interactive)
          if (interactive) {
            const buttonReply = interactive?.button_reply;
            console.log("[meta-webhook] Botão interativo detectado:", {
              buttonReply,
              buttonId: buttonReply?.id,
              buttonTitle: buttonReply?.title,
            });
            void recordWhatsAppLog({
              source: "meta-webhook",
              eventType: "button_interactive_detected",
              payload: {
                phone,
                contextId,
                buttonId: buttonReply?.id || null,
                buttonTitle: buttonReply?.title || null,
              },
            });

            if (buttonReply && contextId && phone) {
              // Qualquer botão interativo com contextId dispara detalhes
              console.log(
                "[meta-webhook] Disparando detalhes via botão interativo:",
                { phone, contextId, buttonId: buttonReply.id },
              );
              void recordWhatsAppLog({
                source: "meta-webhook",
                eventType: "details_requested",
                payload: {
                  phone,
                  contextId,
                  buttonId: buttonReply.id,
                  trigger: "interactive_button",
                },
              });
              processingTasks.push(
                (async () => {
                  try {
                    await handlePassengerDetailsRequest(phone, contextId);
                  } catch (err) {
                    console.error(
                      "[meta-webhook] Erro ao processar detalhes:",
                      err,
                    );
                  }
                })(),
              );
            }
            continue;
          }

          // Tratamento de quick reply de template (message.type === "button")
          if (msgType === "button") {
            const buttonPayload = String(message?.button?.payload || "");
            const buttonText = String(message?.button?.text || "").toLowerCase();
            console.log("[meta-webhook] Quick reply de template:", {
              buttonPayload,
              buttonText,
              contextId,
              phone,
            });
            void recordWhatsAppLog({
              source: "meta-webhook",
              eventType: "quick_reply_detected",
              payload: {
                phone,
                contextId,
                buttonPayload,
                buttonText,
              },
            });

            if (contextId && phone) {
              console.log(
                "[meta-webhook] Disparando detalhes via quick reply:",
                { phone, contextId, buttonText },
              );
              void recordWhatsAppLog({
                source: "meta-webhook",
                eventType: "details_requested",
                payload: {
                  phone,
                  contextId,
                  buttonText,
                  trigger: "quick_reply",
                },
              });
              processingTasks.push(
                (async () => {
                  try {
                    await handlePassengerDetailsRequest(phone, contextId);
                  } catch (err) {
                    console.error(
                      "[meta-webhook] Erro ao processar detalhes:",
                      err,
                    );
                  }
                })(),
              );
            }
            continue;
          }

          // Tratamento de texto com contextId (fallback)
          if (msgType === "text" && contextId && phone) {
            console.log(
              "[meta-webhook] Mensagem de texto com contextId, disparando detalhes:",
              { phone, contextId },
            );
            void recordWhatsAppLog({
              source: "meta-webhook",
              eventType: "text_context_detected",
              payload: {
                phone,
                contextId,
              },
            });
            processingTasks.push(
              (async () => {
                try {
                  await handlePassengerDetailsRequest(phone, contextId);
                } catch (err) {
                  console.error(
                    "[meta-webhook] Erro ao processar detalhes:",
                    err,
                  );
                }
              })(),
            );
            continue;
          }

          console.log("[meta-webhook] Tipo de mensagem não tratado:", {
            msgType,
            phone,
            contextId,
          });
          void recordWhatsAppLog({
            source: "meta-webhook",
            eventType: "message_unhandled",
            payload: {
              msgType,
              phone,
              contextId,
            },
          });
        }
      }
    }

    // Aguarda todas as tarefas de processamento completarem antes de responder.
    // No Cloudflare Workers, responder 200 imediatamente com fire-and-forget
    // faz o isolate ser encerrado antes que as queries ao Supabase terminem.
    if (processingTasks.length > 0) {
      console.log(
        "[meta-webhook] Aguardando",
        processingTasks.length,
        "tarefa(s) de processamento...",
      );
      await Promise.all(processingTasks);
      console.log("[meta-webhook] Todas as tarefas concluídas.");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[meta-webhook] Erro ao processar webhook:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
}
