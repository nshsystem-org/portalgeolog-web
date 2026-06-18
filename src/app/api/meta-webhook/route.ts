/**
 * Webhook da Meta (WhatsApp Business API) - Production Grade
 *
 * Melhorias Production-Grade:
 * - ✅ Idempotência via banco de dados (webhook_flow_events)
 * - ✅ Transações atômicas via RPCs (process_driver_km_start/finish)
 * - ✅ Timeouts em todas as queries (5s max)
 * - ✅ Rate limiting por telefone (10 req/min)
 * - ✅ Retry automático com exponential backoff
 * - ✅ Validação de schema com Zod
 * - ✅ Observabilidade (métricas de latência e erro)
 */

import { NextResponse } from "next/server";
import { fetchInChunks } from "@/lib/supabase/chunked-in-query";
import { createClient } from "@supabase/supabase-js";
import { processDriverAccept } from "@/lib/driver-accept";
import { normalizeWhatsAppPhone } from "@/lib/meta";
import { recordWhatsAppLog } from "@/lib/whatsapp-logs";
import {
  buildPassengerDetailsMessage,
  getFirstPendingOperationalCycle,
  type ItineraryGroup,
  type ItineraryStop,
} from "@/lib/os-messages";
import {
  loadOperationalCycleContextForOS,
  updateOperationalCycleForOS,
} from "@/lib/operational-cycles-db";
import {
  validateWebhookPayload,
  validateFlowResponse,
  extractKmFromFlowResponse,
} from "@/lib/webhook-validation";
import {
  withTimeout,
  checkRateLimit,
  recordMetric,
  sendTemplateWithRetry,
  sendMessageWithRetry,
  enqueuePendingMessage,
  checkAndClaimFlowEvent,
  processKmStart,
  processKmFinish,
  validateVehicleKm,
} from "@/lib/webhook-helpers";

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

function buildStartFlowHeader(
  cycle: { title?: string | null },
  protocolo: string,
): string {
  const cleanTitle = String(cycle.title || "")
    .replace(/\s*[—-]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `${cleanTitle || "Itinerário"} - ${String(protocolo || "N/A").trim()}`;
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
      const { data: driverOS } = await withTimeout(
        getAdmin()
          .from("ordens_servico")
          .select("id")
          .eq("driver_template_message_id", contextId)
          .maybeSingle() as unknown as Promise<{
          data: { id: string } | null;
          error: unknown;
        }>,
        5000,
      );

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
            "protocolo, os_number, data, hora, motorista, cliente_id, solicitante, centro_custo, veiculo_id, driver_id",
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

    await sendMessageWithRetry(phone, message);
    console.log(
      "[meta-webhook] Mensagem de detalhes enviada com sucesso para",
      phone,
    );

    // Envia template flow "inicio_viagem_motorista" para o motorista
    // O template contem header (titulo do ciclo), body (nome do motorista)
    // e um botao de flow "INICIAR VIAGEM" onde o motorista digita o KM inicial
    try {
      const { cycles } = await loadOperationalCycleContextForOS(
        getAdmin(),
        String((osRecord as Record<string, unknown> | null)?.id || osId),
        null,
      );
      const targetCycle = getFirstPendingOperationalCycle(cycles) || cycles[0];

      if (targetCycle) {
        if (driverPhone === "Não informado") {
          console.warn(
            "[meta-webhook] Template flow inicio_viagem_motorista não enviado: driverPhone não informado",
          );
        }
      }

      if (targetCycle && driverPhone !== "Não informado") {
        const cycleTitle = buildStartFlowHeader(
          targetCycle,
          String(osRecord?.protocolo || "N/A"),
        );
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

        const templateResult = await sendTemplateWithRetry(
          driverPhone,
          "inicio_viagem_motorista",
          "pt_BR",
          templateComponents,
        );

        if (templateResult.success && templateResult.messageId) {
          const ordensServicoUpdate = getAdmin().from(
            "ordens_servico",
          ) as unknown as OrdensServicoUpdateBuilder;
          await ordensServicoUpdate
            .update({
              driver_flow_start_message_id: templateResult.messageId,
              driver_flow_finish_message_id: null,
            })
            .eq("id", osId);

          await updateOperationalCycleForOS(getAdmin(), osId, targetCycle.itineraryIndex, {
            messageSentAt: new Date().toISOString(),
            state: "awaiting_accept",
          });

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
      console.warn(
        "[meta-webhook] OS não encontrada ao preparar próximo ciclo:",
        osId,
      );
      return;
    }

    console.log("[meta-webhook] OS encontrada:");

    const { cycles } = await loadOperationalCycleContextForOS(
      getAdmin(),
      osId,
      null,
    );
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

    const previewResult = await sendMessageWithRetry(phone, introMessage);
    if (!previewResult.success) {
      console.warn(
        "[meta-webhook] Falha ao enviar prévia do próximo ciclo:",
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
      phone,
      "inicio_viagem_motorista",
      "pt_BR",
      templateComponents,
    );

    if (templateResult.success && templateResult.messageId) {
      const now = new Date().toISOString();

      const ordensServicoUpdate = getAdmin().from(
        "ordens_servico",
      ) as unknown as OrdensServicoUpdateBuilder;
      await ordensServicoUpdate
        .update({
          driver_flow_start_message_id: templateResult.messageId,
          driver_flow_finish_message_id: null,
        })
        .eq("id", osId);

      await updateOperationalCycleForOS(getAdmin(), osId, targetCycleIndex, {
        messageSentAt: now,
        state: "awaiting_accept",
      });

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
  const startTime = Date.now();
  try {
    // Rate limit: máximo 5 flows por minuto por telefone
    const rateLimit = await checkRateLimit(getAdmin(), phone, "flow_completed", 5);
    if (!rateLimit.allowed) {
      console.warn("[meta-webhook] Rate limit excedido para flow_completed, phone:", phone);
      await sendMessageWithRetry(phone, `⚠️ Muitas tentativas. Aguarde ${Math.ceil((new Date(rateLimit.resetAt).getTime() - Date.now()) / 1000)} segundos e tente novamente.`);
      return;
    }

    // Validar e extrair KM usando helper com Zod
    const flowValidation = validateFlowResponse(responseJson);
    let kmValue: number | null = null;

    if (flowValidation.success && flowValidation.data) {
      kmValue = extractKmFromFlowResponse(flowValidation.data);
    } else {
      // Fallback: tentar parse manual (compatibilidade)
      try {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(atob(responseJson));
        } catch {
          data = JSON.parse(responseJson);
        }
        for (const [key, value] of Object.entries(data)) {
          if (key === "flow_token") continue;
          const num = Number(value);
          if (!Number.isNaN(num) && num >= 0) { kmValue = num; break; }
        }
      } catch {
        console.warn("[meta-webhook] Flow response inválido:", flowValidation.error);
      }
    }

    if (kmValue === null) {
      console.warn("[meta-webhook] Valor de KM nao encontrado no flow");
      await recordMetric(getAdmin(), "flow_km_extract_failed", { phone, success: false, durationMs: Date.now() - startTime });
      return;
    }

    // Buscar OS pelo contextId (messageId do template original)
    const { data: osData } = await withTimeout(
      getAdmin()
        .from("ordens_servico")
        .select(
          "id, protocolo, motorista, veiculo_id, driver_flow_start_message_id, driver_flow_finish_message_id",
        )
        .or(
          `driver_flow_start_message_id.eq.${contextId},driver_flow_finish_message_id.eq.${contextId}`,
        )
        .maybeSingle() as unknown as Promise<{
        data: Record<string, unknown> | null;
        error: unknown;
      }>,
      5000,
    );

    if (!osData) {
      console.warn(
        "[meta-webhook] OS nao encontrada para flow contextId:",
        contextId,
      );
      return;
    }

    const osRecord = osData as Record<string, unknown>;
    const osId = String(osRecord.id || "");
    if (!osId) {
      console.warn("[meta-webhook] OS sem id válido:", contextId);
      return;
    }
    const { cycles } = await loadOperationalCycleContextForOS(
      getAdmin(),
      osId,
      null,
    );

    if (osRecord.driver_flow_start_message_id === contextId) {
      // Flow de inicio: registra KM inicial via RPC atômica
      const targetCycle = getFirstPendingOperationalCycle(cycles) || cycles[0];

      if (targetCycle) {
        const actorName = String(osRecord.motorista || "Motorista");

        // 1. Validar odômetro global do veículo (KM não pode ser menor que o último registrado)
        const veiculoId = osRecord.veiculo_id ? String(osRecord.veiculo_id) : null;
        if (veiculoId) {
          const odoResult = await validateVehicleKm(
            getAdmin(),
            veiculoId,
            osId,
            kmValue,
            "initial",
            actorName,
          );
          if (!odoResult.success && odoResult.error === "KM_BELOW_ODOMETER") {
            const odoMsg =
              `⚠️ *KM Inválido*\n\n` +
              `📍 Último KM registrado: ${(odoResult.currentKm ?? 0).toLocaleString("pt-BR")} km\n` +
              `📝 KM informado: ${kmValue.toLocaleString("pt-BR")} km\n\n` +
              `O KM deve ser *maior* que o último registrado para este veículo. Verifique o hodômetro e clique em *INICIAR VIAGEM* novamente.`;
            await sendMessageWithRetry(phone, odoMsg);
            const retryStartComponents = [
              {
                type: "header",
                parameters: [
                  {
                    type: "text",
                    text: buildStartFlowHeader(
                      targetCycle,
                      String(osRecord.protocolo || "N/A"),
                    ),
                  },
                ],
              },
              {
                type: "body",
                parameters: [
                  { type: "text", text: String(osRecord.motorista || "Motorista") },
                ],
              },
              {
                type: "button",
                sub_type: "flow",
                index: 0,
                parameters: [],
              },
            ];
            const retryStartResult = await sendTemplateWithRetry(
              phone,
              "inicio_viagem_motorista",
              "pt_BR",
              retryStartComponents,
            );
            if (retryStartResult.success && retryStartResult.messageId) {
              const ordensServicoRetry = getAdmin().from(
                "ordens_servico",
              ) as unknown as OrdensServicoUpdateBuilder;
              await ordensServicoRetry
                .update({
                  driver_flow_start_message_id: retryStartResult.messageId,
                  driver_flow_finish_message_id: null,
                })
                .eq("id", osRecord.id as string);

              await updateOperationalCycleForOS(getAdmin(), osId, targetCycle.itineraryIndex, {
                messageSentAt: new Date().toISOString(),
                state: "awaiting_accept",
              });
            } else {
              console.warn(
                "[meta-webhook] Falha ao reenviar template flow inicio_viagem_motorista após KM inválido:",
                retryStartResult.error,
              );
            }
            console.warn("[meta-webhook] KM inicial rejeitado por odômetro:", kmValue, "<=", odoResult.currentKm);
            return;
          }
        }

        // 2. Verificar idempotência (evita duplo processamento)
        const idempotency = await checkAndClaimFlowEvent(
          getAdmin(),
          contextId,
          "start",
          osId,
          targetCycle.itineraryIndex,
          kmValue,
        );
        if (idempotency.alreadyProcessed) {
          console.log("[meta-webhook] Flow start já processado (idempotente), contextId:", contextId);
          return;
        }

        // 3. Processar KM inicial via RPC atômica (atualiza cycles + log em uma transação)
        const kmStartResult = await processKmStart(
          getAdmin(),
          osId,
          targetCycle.itineraryIndex,
          kmValue,
          actorName,
        );

        if (!kmStartResult.success) {
          console.error("[meta-webhook] Falha ao registrar KM inicial via RPC:", kmStartResult.error);
          await sendMessageWithRetry(phone, "⚠️ Erro ao registrar o KM inicial. Tente novamente.");
          return;
        }

        // 4. status_operacional e route_started_at agora atualizados atomicamente dentro da RPC
        console.log("[meta-webhook] KM inicial registrado (RPC atômica):", kmValue, "OS:", osRecord.id, "status:", kmStartResult.statusOperacional);

        // 5. Enviar template flow "finalizar_viagem_motoristas" com KM inicial no body
        const kmFormatted = kmValue.toLocaleString("pt-BR");
        const finishComponents = [
          { type: "body", parameters: [{ type: "text", text: kmFormatted }] },
          { type: "button", sub_type: "flow", index: 0, parameters: [] },
        ];

        const finishResult = await sendTemplateWithRetry(
          phone,
          "finalizar_viagem_motoristas",
          "pt_BR",
          finishComponents,
        );

        if (finishResult.success && finishResult.messageId) {
          const ordensServico2 = getAdmin().from("ordens_servico") as unknown as OrdensServicoUpdateBuilder;
          await ordensServico2.update({ driver_flow_finish_message_id: finishResult.messageId }).eq("id", osRecord.id as string);
          console.log("[meta-webhook] Template finalizar_viagem_motoristas enviado para", phone, "msgId:", finishResult.messageId);
        } else {
          console.warn("[meta-webhook] Falha ao enviar template finalizar_viagem_motoristas:", finishResult.error);
          if (finishResult.error) {
            await enqueuePendingMessage(getAdmin(), phone, "template", {
              osId,
              templateName: "finalizar_viagem_motoristas",
              templateComponents: finishComponents,
            });
          }
        }
      }
    } else if (osRecord.driver_flow_finish_message_id === contextId) {
      // Flow de finalização: registra KM final via RPC atômica
      const activeCycle = cycles.find(
        (c) => c.state === "awaiting_finish" || c.state === "awaiting_km_finish",
      );
      const targetCycle =
        activeCycle ||
        cycles.find((c) => c.state !== "completed" && c.state !== "cancelled") ||
        cycles[0];

      if (targetCycle) {
        const kmInicial = targetCycle.kmInitial || 0;
        const actorName = String(osRecord.motorista || "Motorista");

        // Validação local: KM final > KM inicial do ciclo
        if (kmValue <= kmInicial) {
          const erroMsg =
            `⚠️ *KM Inválido*\n\n` +
            `📍 KM inicial: ${kmInicial.toLocaleString("pt-BR")} km\n` +
            `📝 KM final informado: ${kmValue.toLocaleString("pt-BR")} km\n\n` +
            `O KM final deve ser *maior* que o KM inicial. Verifique o hodômetro e clique em *FINALIZAR VIAGEM* novamente.`;
          await sendMessageWithRetry(phone, erroMsg);

          const kmFormatted = kmInicial.toLocaleString("pt-BR");
          const retryComponents = [
            { type: "body", parameters: [{ type: "text", text: kmFormatted }] },
            { type: "button", sub_type: "flow", index: 0, parameters: [] },
          ];
          const retryResult = await sendTemplateWithRetry(phone, "finalizar_viagem_motoristas", "pt_BR", retryComponents);
          if (retryResult.success && retryResult.messageId) {
            try {
              const ordensServicoRetry = getAdmin().from("ordens_servico") as unknown as OrdensServicoUpdateBuilder;
              await ordensServicoRetry.update({ driver_flow_finish_message_id: retryResult.messageId }).eq("id", osRecord.id as string);
            } catch (updateErr) {
              console.error("[meta-webhook] Erro ao atualizar driver_flow_finish_message_id:", updateErr);
            }
          }
          console.warn("[meta-webhook] KM final inválido:", kmValue, "<= inicial:", kmInicial, "OS:", osRecord.id);
          return;
        }

        // 1. Validar odômetro global do veículo
        const veiculoId = osRecord.veiculo_id ? String(osRecord.veiculo_id) : null;
        if (veiculoId) {
          const odoResult = await validateVehicleKm(
            getAdmin(),
            veiculoId,
            osId,
            kmValue,
            "final",
            actorName,
          );
          if (!odoResult.success && odoResult.error === "KM_BELOW_ODOMETER") {
            const odoMsg =
              `⚠️ *KM Inválido*\n\n` +
              `📍 Último KM registrado: ${(odoResult.currentKm ?? 0).toLocaleString("pt-BR")} km\n` +
              `📝 KM informado: ${kmValue.toLocaleString("pt-BR")} km\n\n` +
              `O KM deve ser *maior* que o último registrado para este veículo. Verifique o hodômetro e clique em *FINALIZAR VIAGEM* novamente.`;
            await sendMessageWithRetry(phone, odoMsg);
            console.warn("[meta-webhook] KM final rejeitado por odômetro:", kmValue, "<=", odoResult.currentKm);
            return;
          }
        }

        // 2. Verificar idempotência
        const idempotency = await checkAndClaimFlowEvent(
          getAdmin(),
          contextId,
          "finish",
          osId,
          targetCycle.itineraryIndex,
          kmValue,
        );
        if (idempotency.alreadyProcessed) {
          console.log("[meta-webhook] Flow finish já processado (idempotente), contextId:", contextId);
          return;
        }

        // 3. Processar KM final via RPC atômica (atualiza cycles + log em uma transação)
        const kmFinishResult = await processKmFinish(
          getAdmin(),
          osId,
          targetCycle.itineraryIndex,
          kmValue,
          actorName,
          true,
        );

        if (!kmFinishResult.success) {
          console.error("[meta-webhook] Falha ao registrar KM final via RPC:", kmFinishResult.error);
          await sendMessageWithRetry(phone, "⚠️ Erro ao registrar o KM final. Tente novamente.");
          return;
        }

        // 4. status_operacional e route_finished_at agora atualizados atomicamente dentro da RPC
        console.log("[meta-webhook] KM final registrado (RPC atômica):", kmValue, "OS:", osRecord.id, "novo status:", kmFinishResult.statusOperacional);

        // 5. Enviar mensagem de agradecimento + próximo ciclo
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

          const msgResult = await sendMessageWithRetry(phone, agradecimentoMsg);
          if (!msgResult.success) {
            console.warn("[meta-webhook] Falha ao enviar mensagem de agradecimento:", msgResult.error);
          }

          const remainingCycles = cycles
            .filter(
              (cycle) =>
                cycle.sequenceOrder > targetCycle.sequenceOrder &&
                cycle.state !== "completed" &&
                cycle.state !== "cancelled",
            )
            .sort((a, b) => a.sequenceOrder - b.sequenceOrder);

          const nextCycle = remainingCycles[0];
          if (nextCycle) {
            console.log("[meta-webhook] Próximo ciclo encontrado:", nextCycle.itineraryIndex, nextCycle.title);
            await sendNextCyclePreviewAndStartFlow(String(osRecord.id), phone, nextCycle.itineraryIndex);
          } else {
            console.log("[meta-webhook] Todos os ciclos concluídos para OS:", osRecord.id);
          }
        } catch (msgErr) {
          console.error("[meta-webhook] Erro ao enviar mensagem de agradecimento:", msgErr);
        }
      }
    }
  } catch (err) {
    console.error("[meta-webhook] Erro ao processar flow completado:", err);
    await recordMetric(getAdmin(), "flow_completed_error", {
      phone,
      success: false,
      durationMs: Date.now() - startTime,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
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
    console.log("[meta-webhook] POST body completo:", JSON.stringify(body));

    await recordWhatsAppLog({
      source: "meta-webhook",
      eventType: "webhook_payload",
      payload: body as Record<string, unknown>,
    });

        // Validar payload com Zod
    const validation = validateWebhookPayload(body);
    if (!validation.success) {
      console.error("[meta-webhook] Payload inválido:", validation.error);
      return NextResponse.json({ status: "invalid_payload" }, { status: 400 });
    }

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
          if (
            interactive &&
            nfmReply &&
            nfmReply.response_json &&
            contextId &&
            phone
          ) {
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
                  console.error("[meta-webhook] Erro ao processar flow:", err);
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
            const buttonText = String(
              message?.button?.text || "",
            ).toLowerCase();
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

        // ── Status updates (delivery, read, sent, failed) ──────────────────────
        const statuses = value?.statuses || [];
        for (const status of statuses) {
          const msgId = status?.id;
          const statusType = status?.status;
          const recipientPhone = status?.recipient_id;

          if (!msgId) continue;

          console.log("[meta-webhook] Status update recebido:", {
            msgId,
            statusType,
            recipientPhone,
          });

          void recordWhatsAppLog({
            source: "meta-webhook",
            eventType: "status_update_received",
            payload: {
              msgId,
              statusType,
              recipientPhone,
            },
          });

          if (statusType === "delivered" || statusType === "read") {
            processingTasks.push(
              (async () => {
                try {
                  const adminClient = getAdmin();

                  // 1. Buscar rastreamento pelo message_id
                  const { data: tracking } = await (adminClient
                    .from("whatsapp_message_tracking") as unknown as {
                    select: (cols: string) => {
                      eq: (col: string, val: string) => {
                        maybeSingle: () => Promise<{
                          data: {
                            os_id: string;
                            motorista: string;
                            cycle_index: number;
                            status: string;
                          } | null;
                        }>;
                      };
                    };
                  })
                    .select("os_id, motorista, cycle_index, status")
                    .eq("message_id", msgId)
                    .maybeSingle();

                  if (!tracking) {
                    console.log(
                      "[meta-webhook] Nenhum rastreamento encontrado para message_id:",
                      msgId,
                    );
                    return;
                  }

                  // 2. Evitar duplicatas: só processar se ainda não foi delivered/read
                  if (tracking.status === "delivered" || tracking.status === "read") {
                    console.log(
                      "[meta-webhook] Status já processado anteriormente:",
                      tracking.status,
                    );
                    return;
                  }

                  // 3. Atualizar status na tabela de rastreamento
                  await (adminClient
                    .from("whatsapp_message_tracking") as unknown as {
                    update: (values: Record<string, unknown>) => {
                      eq: (col: string, val: string) => Promise<unknown>;
                    };
                  }).update({ status: statusType }).eq("message_id", msgId);

                  // 4. Inserir log driver_delivered → trigger gera notificação no sino
                  const motoristaFullName = tracking.motorista || "Motorista";

                  await (adminClient.from("os_logs") as unknown as {
                    insert: (values: Record<string, unknown>) => Promise<unknown>;
                  }).insert({
                    os_id: tracking.os_id,
                    type: "driver_delivered",
                    actor_name: motoristaFullName,
                    actor_id: null,
                    description: `Mensagem ${statusType === "read" ? "visualizada" : "entregue"} no WhatsApp do motorista`,
                    metadata: {
                      cycle_index: tracking.cycle_index,
                      message_id: msgId,
                      delivery_status: statusType,
                    },
                  });

                  console.log(
                    "[meta-webhook] Notificação driver_delivered gerada para OS:",
                    tracking.os_id,
                  );
                } catch (err) {
                  console.error(
                    "[meta-webhook] Erro ao processar status update:",
                    err,
                  );
                }
              })(),
            );
          }
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
