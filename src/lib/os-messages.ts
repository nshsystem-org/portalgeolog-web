/**
 * Templates centralizados de mensagens para OS.
 * Usado para formatação de mensagens (WhatsApp, email, SMS, etc.).
 *
 * Nota: As mensagens são enviadas via Meta API oficial (WhatsApp Business).
 */

export interface ItineraryStop {
  label: string;
  comment?: string | null;
  isOrigin?: boolean;
  isDestination?: boolean;
  isPassengerAddress?: boolean;
  dateTime?: string | null;
}

export interface ItineraryGroup {
  index: number;
  title?: string;
  dateTime?: string | null;
  stops: ItineraryStop[];
}

export interface PassengerInfo {
  nome: string;
  celular?: string | null;
}

export interface DriverNotificationData {
  protocolo: string;
  data?: string | null;
  hora?: string | null;
  osNumber?: string | null;
  fornecedor?: string;
  empresa: string;
  solicitante?: string | null;
  centroCusto?: string | null;
  transporteTipo?: string | null;
  motorista: string;
  motoristaTelefone?: string | null;
  veiculoTipo?: string | null;
  veiculoMarcaModelo?: string | null;
  veiculoPlaca?: string | null;
  passageiros: PassengerInfo[];
  itineraries: ItineraryGroup[];
  acceptLink?: string | null;
  startRouteLink?: string | null;
}

export interface PassengerNotificationData {
  passengerName?: string | null;
  osProtocol?: string | null;
  driverName: string;
  driverPhone: string;
  vehicleLabel: string;
  vehiclePlate: string;
  passengerAddress: string;
  itinerarySummary: string;
  confirmationLink: string;
}

export type OperationalCycleKind = "itinerary" | "return";

export type OperationalCycleState =
  | "pending"
  | "awaiting_accept"
  | "awaiting_start"
  | "awaiting_km_start"
  | "awaiting_finish"
  | "awaiting_km_finish"
  | "completed"
  | "cancelled";

export interface WaypointLike {
  itineraryIndex?: number | null;
  position?: number | null;
}

export interface OperationalCycle {
  itineraryIndex: number;
  sequenceOrder: number;
  kind: OperationalCycleKind;
  ordinal: number;
  title: string;
  state: OperationalCycleState;
  messageSentAt?: string | null;
  messageSentById?: string | null;
  acceptedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  kmInitial?: number | null;
  kmFinal?: number | null;
}

export interface DriverAcceptData {
  startRouteLink: string;
  cycleTitle?: string;
}

export interface DriverStartRouteData {
  kmInitial: number;
  finishLink: string;
  cycleTitle?: string;
}

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
    const dezenaText = dezenas[d] || "";
    const unidadeText = u > 0 ? unidades[u] : "";
    if (dezenaText && unidadeText) return `${dezenaText} ${unidadeText}`;
    return dezenaText || unidadeText || String(n);
  }
  if (n === 100) return "Centésimo";
  return String(n);
}

function normalizeItineraryIndex(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function getOperationalCycleTitle(
  cycle: Pick<OperationalCycle, "kind" | "ordinal">,
): string {
  const prefix = cycle.kind === "return" ? "Retorno" : "Itinerário";
  return `${numeroParaOrdinal(cycle.ordinal)} - ${prefix}`;
}

export function getOperationalCycleBannerTitle(
  cycle: Pick<OperationalCycle, "kind" | "ordinal">,
): string {
  return `NOVO ATENDIMENTO - ${getOperationalCycleTitle(cycle).toUpperCase()}`;
}

export function buildOperationalCyclesFromWaypoints(
  waypoints: WaypointLike[],
): OperationalCycle[] {
  const groups: Record<
    number,
    { itineraryIndex: number; firstPosition: number }
  > = {};

  waypoints.forEach((wp, position) => {
    const itineraryIndex = normalizeItineraryIndex(wp.itineraryIndex);
    if (!groups[itineraryIndex]) {
      groups[itineraryIndex] = { itineraryIndex, firstPosition: position };
      return;
    }

    groups[itineraryIndex].firstPosition = Math.min(
      groups[itineraryIndex].firstPosition,
      position,
    );
  });

  const orderedGroups = Object.values(groups).sort(
    (a, b) => a.firstPosition - b.firstPosition,
  );
  let itineraryOrdinal = 0;
  let returnOrdinal = 0;

  return orderedGroups.map((group, sequenceOrder) => {
    const kind: OperationalCycleKind =
      group.itineraryIndex < 0 ? "return" : "itinerary";
    const ordinal = kind === "return" ? ++returnOrdinal : ++itineraryOrdinal;

    return {
      itineraryIndex: group.itineraryIndex,
      sequenceOrder,
      kind,
      ordinal,
      title: getOperationalCycleTitle({ kind, ordinal }),
      state: "pending",
      messageSentAt: null,
      acceptedAt: null,
      startedAt: null,
      finishedAt: null,
      kmInitial: null,
      kmFinal: null,
    };
  });
}

export function findOperationalCycleByIndex(
  cycles: OperationalCycle[],
  itineraryIndex: number,
): OperationalCycle | undefined {
  return cycles.find((cycle) => cycle.itineraryIndex === itineraryIndex);
}

export function getNextOperationalCycle(
  cycles: OperationalCycle[],
  itineraryIndex: number,
): OperationalCycle | undefined {
  const currentCycle = findOperationalCycleByIndex(cycles, itineraryIndex);
  if (!currentCycle) return undefined;

  return cycles.find(
    (cycle) => cycle.sequenceOrder === currentCycle.sequenceOrder + 1,
  );
}

export function getFirstPendingOperationalCycle(
  cycles: OperationalCycle[],
): OperationalCycle | undefined {
  return cycles.find(
    (cycle) => cycle.state !== "completed" && cycle.state !== "cancelled",
  );
}

export type CycleOperationalStatus =
  | "Pendente"
  | "Aguardando"
  | "Em Rota"
  | "Andamento"
  | "Finalizado"
  | "Cancelado"
  | "Rascunho";

/** Mapeia o state de um único ciclo para um status operacional exibível. */
export function getCycleDisplayStatus(
  state: OperationalCycleState,
): CycleOperationalStatus {
  switch (state) {
    case "awaiting_accept":
    case "awaiting_start":
    case "awaiting_km_start":
      return "Aguardando";
    case "awaiting_finish":
    case "awaiting_km_finish":
      return "Em Rota";
    case "completed":
      return "Finalizado";
    case "cancelled":
      return "Cancelado";
    default:
      return "Pendente";
  }
}

/**
 * Deriva o status operacional geral a partir de todos os ciclos da OS.
 * Regras (prioridade decrescente):
 *  1. Qualquer ciclo "Em Rota" → "Em Rota"
 *  2. Qualquer ciclo "Aguardando" → "Aguardando"
 *  3. Todos ativos (não cancelados) "Finalizado" → "Finalizado"
 *  4. Todos "Cancelado" → "Cancelado"
 *  5. Há ciclos concluídos mas nem todos → "Aguardando" (pendentes aguardam ativação)
 *  6. → "Pendente" (todos os ciclos ainda estão pending)
 */
export function deriveCyclesOperationalStatus(
  cycles: OperationalCycle[],
): CycleOperationalStatus {
  if (cycles.length === 0) return "Pendente";

  const states = cycles.map((c) => c.state);

  if (states.some((s) => s === "awaiting_finish" || s === "awaiting_km_finish"))
    return "Em Rota";
  if (
    states.some(
      (s) =>
        s === "awaiting_accept" ||
        s === "awaiting_start" ||
        s === "awaiting_km_start",
    )
  )
    return "Aguardando";

  const activeCycles = cycles.filter((c) => c.state !== "cancelled");
  if (
    activeCycles.length > 0 &&
    activeCycles.every((c) => c.state === "completed")
  )
    return "Finalizado";
  if (activeCycles.length === 0) return "Cancelado";

  // Se há ciclos concluídos mas nem todos os ativos estão concluídos,
  // os ciclos "pending" restantes estão aguardando ativação.
  if (activeCycles.some((c) => c.state === "completed")) return "Aguardando";

  return "Pendente";
}

export interface FinalizadoSemValorInput {
  status: { operacional: CycleOperationalStatus };
  operationalCycles?: OperationalCycle[] | null;
  valorBruto: number | string | null;
  custo: number | string | null;
}

/** Verifica se uma OS está operacionalmente finalizada mas ainda falta
 *  preencher valor bruto e/ou custo do motorista. */
export function isFinalizadoSemValor(os: FinalizadoSemValorInput): boolean {
  const isFinalizado =
    os.status.operacional === "Finalizado" ||
    (os.operationalCycles && os.operationalCycles.length > 0
      ? deriveCyclesOperationalStatus(os.operationalCycles) === "Finalizado"
      : false);

  const vBruto =
    typeof os.valorBruto === "string" ? Number(os.valorBruto) : os.valorBruto;
  const vCusto = typeof os.custo === "string" ? Number(os.custo) : os.custo;

  const faltaValor =
    vBruto === null ||
    vBruto === undefined ||
    vBruto === 0 ||
    vCusto === null ||
    vCusto === undefined ||
    vCusto === 0;

  return isFinalizado && faltaValor;
}

export interface OSAtrasadaInput {
  data: string;
  hora?: string | null;
  status: { operacional: CycleOperationalStatus };
  arquivado?: boolean;
  tipo?: "os" | "freelance" | "rascunho";
  rota?: {
    waypoints?: {
      itineraryIndex?: number | null;
      data?: string;
      hora?: string;
    }[];
  };
}

/**
 * Verifica se uma OS está atrasada ou não iniciada:
 *  - Data passada + qualquer status não Finalizado/Cancelado → atrasada
 *    (Pendente, Aguardando, Andamento, A caminho, etc.)
 *  - Data = hoje + status Andamento/A caminho → NÃO atrasada (está em execução).
 *  - Data = hoje + status Pendente/Aguardando + horário já passou → atrasada.
 *  - Data = hoje + horário ainda no futuro → NÃO atrasada.
 *  - Data futura → NÃO atrasada.
 * Rascunhos e arquivados são sempre ignorados.
 *
 * @param overrideDateTime - ISO datetime "YYYY-MM-DDTHH:mm:ss" (ou só "YYYY-MM-DD")
 *   do itinerário específico. Sobrepõe os.data e os.hora. Use em calendários com
 *   múltiplos itinerários em dias/horas diferentes para avaliar cada card pela
 *   data+hora do seu próprio itinerário.
 */
export function isOsAtrasadaOuNaoIniciada(
  os: OSAtrasadaInput,
  overrideDateTime?: string,
): boolean {
  if (os.arquivado) return false;
  if (os.tipo === "rascunho") return false;

  const status = os.status.operacional;
  if (status === "Cancelado" || status === "Finalizado") return false;

  // Determina a data de referência
  const dataStr = overrideDateTime ? overrideDateTime.slice(0, 10) : os.data;
  if (!dataStr) return false;
  const parts = dataStr.split("-").map(Number);
  if (parts.length < 3 || isNaN(parts[0])) return false;

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const osDate = new Date(parts[0], parts[1] - 1, parts[2]);

  // Data futura: não é atraso
  if (osDate > today) return false;

  // Data passada: qualquer status não-finalizado/cancelado é atrasada
  // (inclui Andamento, A caminho, etc.)
  if (osDate < today) return true;

  // Hoje: só Pendente/Aguardando podem ser "não iniciadas"
  // (Andamento / A caminho = está sendo executada agora, não é atraso)
  if (status !== "Pendente" && status !== "Aguardando") return false;

  // Hoje + Pendente/Aguardando: verifica se o horário agendado já passou
  let scheduled: Date | null = null;

  if (overrideDateTime?.includes("T")) {
    // Calendário passa o ISO completo (ex: "2026-07-06T05:00:00")
    const d = new Date(overrideDateTime);
    if (!isNaN(d.getTime())) scheduled = d;
  } else if (os.hora) {
    // Reconstrói a partir de os.hora ("HH:mm" ou "HH:mm:ss")
    const [h, m] = os.hora.split(":").map(Number);
    if (!isNaN(h)) {
      scheduled = new Date(parts[0], parts[1] - 1, parts[2], h, m || 0, 0, 0);
    }
  }

  if (scheduled) {
    // Horário ainda no futuro → não é atraso
    if (scheduled > now) return false;
  } else {
    // Sem horário agendado conhecido → não pode afirmar atraso
    // (alinhado com recompute_os_pendencias: IF v_itin.itin_hora IS NOT NULL)
    return false;
  }

  return true;
}

/**
 * Verifica se QUALQUER itinerário/retorno da OS está atrasado ou não iniciado.
 * Espelha a lógica do recompute_os_pendencias (SQL): itera os_waypoints
 * agrupados por itinerary_index e avalia cada um pela sua própria data/hora.
 *
 * Use na tabela de OS e no banner geral do modal — onde não há um ciclo
 * específico para avaliar, mas precisa saber se a OS tem alguma pendência.
 *
 * Sem waypoints (legacy): fallback para isOsAtrasadaOuNaoIniciada(os).
 */
export function isOsAtrasadaQualquerItinerario(os: OSAtrasadaInput): boolean {
  const waypoints = os.rota?.waypoints || [];
  if (waypoints.length === 0) {
    return isOsAtrasadaOuNaoIniciada(os);
  }

  // Agrupa por itineraryIndex (igual ao SQL: DISTINCT ON itinerary_index)
  // Mantém o primeiro waypoint de cada itinerário (menor position = data/hora de partida)
  const itinerarios = new Map<number, { data?: string; hora?: string }>();
  for (const wp of waypoints) {
    const idx = wp.itineraryIndex ?? 0;
    if (!itinerarios.has(idx)) {
      itinerarios.set(idx, { data: wp.data, hora: wp.hora });
    }
  }

  for (const [, { data, hora }] of itinerarios) {
    const isoDate = data?.includes("/")
      ? data.split("/").reverse().join("-")
      : data;
    const dateTime =
      isoDate && hora
        ? `${isoDate}T${hora}:00`
        : isoDate
          ? `${isoDate}T00:00:00`
          : undefined;
    if (isOsAtrasadaOuNaoIniciada(os, dateTime)) return true;
  }
  return false;
}

export function formatItineraryGroups(groups: ItineraryGroup[]): string {
  if (groups.length === 0) return "";

  return groups
    .map((it) => {
      const title =
        it.title ||
        (it.index < 0
          ? `🔄 *${numeroParaOrdinal(Math.abs(it.index))} Retorno*`
          : `📍 *${numeroParaOrdinal(it.index + 1)} Itinerário*`);

      const dateTimeLine = it.dateTime ? ` — ${it.dateTime}` : "";
      const stops = it.stops
        .map((stop, idx) => {
          let line = "";
          if (stop.isOrigin) line = `   🟢 *Origem:* ${stop.label}`;
          else if (stop.isDestination)
            line = `   🔵 *Destino Final:* ${stop.label}`;
          else {
            // Parada numerada (começando em 1, não 0)
            const paradaNum =
              it.stops.filter(
                (s, i) => i < idx && !s.isOrigin && !s.isDestination,
              ).length + 1;
            line = `   🔘 *Parada ${paradaNum}:* ${stop.label}`;
          }

          if (stop.dateTime) line += ` (${stop.dateTime})`;
          if (stop.isPassengerAddress) line += " 📍 (seu endereço)";
          return line;
        })
        .join("\n");

      return `────────────────\n${title}${dateTimeLine}\n\n${stops}\n`;
    })
    .join("\n");
}

/**
 * Mensagem inicial enviada ao motorista com os dados da OS.
 * Formato do template do Facebook (Meta WhatsApp).
 * O link de aceite é enviado como botão CTA no template, não no corpo da mensagem.
 */
export function buildDriverNotificationMessage(
  data: DriverNotificationData,
): string {
  const osLine = data.osNumber ? `*OS:* ${data.osNumber.toUpperCase()}\n` : "";
  const dataDisplay = data.data || "Não informado";
  const horaDisplay = data.hora || "Não informado";
  const tipoCapitalizado = data.veiculoTipo
    ? data.veiculoTipo.charAt(0).toUpperCase() + data.veiculoTipo.slice(1)
    : "Não informado";
  const placaDisplay = data.veiculoPlaca || "Não informada";

  const paxText =
    data.passageiros.length > 0
      ? data.passageiros
          .map((p) => `* ${p.nome}${p.celular ? ` – ${p.celular}` : ""}`)
          .join("\n")
      : "Não informado";

  const itineraryText = formatItineraryGroups(data.itineraries);

  const acceptSection = data.acceptLink
    ? `\n──────────────────────────────\n👇 *Aceitar Serviço:*\n${data.acceptLink}`
    : "";

  const startRouteSection = data.startRouteLink
    ? `\n──────────────────────────────\n👇 *Quando estiver pronto, clique para iniciar a rota:*\n${data.startRouteLink}`
    : "";

  return (
    `📃 *Protocolo:* ${data.protocolo}\n\n` +
    `*Data:* ${dataDisplay}\n` +
    `*Horário:* ${horaDisplay}\n\n` +
    `*Empresa:* ${data.empresa}\n` +
    `*Solicitante:* ${data.solicitante || "Não informado"}\n` +
    `*C. Custo:* ${data.centroCusto || "Não informado"}\n` +
    `${osLine}\n` +
    `*Fornecedor:* Geolog Transporte Executivo\n\n` +
    `──────────────────────────────\n` +
    `👥 *Passageiros:*\n` +
    `_Por ordem de origem_\n\n` +
    `${paxText}\n\n` +
    `──────────────────────────────\n` +
    `📍 *Itinerário(s):*\n\n` +
    `${itineraryText}\n` +
    `──────────────────────────────\n` +
    `👨‍✈️ *Motorista:*\n\n` +
    `*${data.motorista}*\n` +
    `*Contato:* ${data.motoristaTelefone || "Não informado"}\n` +
    `*Veículo:* ${tipoCapitalizado}\n` +
    `*Placa:* ${placaDisplay}\n\n` +
    `_Portal Geolog_` +
    acceptSection +
    startRouteSection
  );
}

/** Mensagem de confirmação de aceite enviada ao motorista. */
export function buildDriverAcceptConfirmationMessage(
  data: DriverAcceptData,
): string {
  const startSection = data.startRouteLink
    ? `\n\n──────────────────────────────\n👇 *Quando estiver pronto, clique para iniciar a rota:*\n${data.startRouteLink}`
    : "";

  return (
    `✅ *Serviço aceito com sucesso!*\n\n` +
    `*${data.cycleTitle || "NOVO ATENDIMENTO"}*\n\n` +
    `Obrigado por confirmar. Quando estiver a caminho, clique no link abaixo para registrar o KM inicial e dar início ao atendimento.` +
    startSection +
    `\n\n` +
    `_Portal Geolog_`
  );
}

/** Mensagem de início de rota enviada ao motorista. */
export function buildDriverStartRouteMessage(
  data: DriverStartRouteData,
): string {
  return (
    `🚗 *Rota iniciada!*\n\n` +
    `${data.cycleTitle ? `🚦 *${data.cycleTitle.toUpperCase()}*\n\n` : ""}` +
    `KM inicial registrado: *${data.kmInitial.toLocaleString("pt-BR")}*\n\n` +
    `Quando chegar ao destino, clique no link abaixo para finalizar a rota e informar apenas o KM final:\n` +
    `${data.finishLink}\n\n` +
    `_Após clicar, o status será atualizado automaticamente no painel._`
  );
}

export interface PassengerDetailsMessageData {
  protocolo: string;
  osNumber?: string | null;
  fornecedor?: string;
  empresa: string;
  solicitante?: string | null;
  motorista: string;
  motoristaTelefone?: string | null;
  veiculoTipo?: string | null;
  veiculoMarcaModelo?: string | null;
  veiculoPlaca?: string | null;
  passageiros: PassengerInfo[];
  itineraries: ItineraryGroup[];
}

/** Mensagem detalhada da OS enviada ao passageiro após clicar em 'Detalhes do Serviço'. */
export function buildPassengerDetailsMessage(
  data: PassengerDetailsMessageData,
): string {
  // OS number omitido para não poluir a mensagem
  const tipoCapitalizado = data.veiculoTipo
    ? data.veiculoTipo.charAt(0).toUpperCase() + data.veiculoTipo.slice(1)
    : "Não informado";
  const placaDisplay = data.veiculoPlaca || "Não informada";
  const paxText =
    data.passageiros.length > 0
      ? data.passageiros
          .map((p) => `* ${p.nome}${p.celular ? ` – ${p.celular}` : ""}`)
          .join("\n")
      : "Não informado";
  const itineraryText = formatItineraryGroups(data.itineraries);

  return (
    `📋 *Protocolo:* ${data.protocolo}\n\n` +
    `*Fornecedor:* ${data.fornecedor || "Geolog Transporte Executivo"}\n` +
    `*Empresa:* ${data.empresa}\n` +
    `*Solicitante:* ${data.solicitante || "Não informado"}\n\n` +
    `────────────────\n` +
    `👨‍✈️ *Motorista:* ${data.motorista}\n\n` +
    `*Contato:* ${data.motoristaTelefone || "Não informado"}\n` +
    `*Veículo:* ${tipoCapitalizado}\n` +
    `*Marca/Modelo:* ${data.veiculoMarcaModelo || "Não informado"}\n` +
    `*Placa:* ${placaDisplay}\n\n` +
    `────────────────\n` +
    `👥 *Passageiro(s):*\n\n` +
    `${paxText}\n\n` +
    `${itineraryText}\n` +
    `_Portal Geolog_`
  );
}

/** Mensagem de notificação enviada ao passageiro. */
export function buildPassengerNotificationMessage(
  data: PassengerNotificationData,
): string {
  const itineraryPart = data.itinerarySummary
    ? `${data.itinerarySummary}\n────────────────\n`
    : "";

  return (
    `👋 Olá, *${data.passengerName || "Passageiro"}*!\n\n` +
    `Sua viagem foi agendada. Por favor, *revise os dados abaixo* e confirme pelo link.\n\n` +
    `📋 *Protocolo:* ${data.osProtocol || "N/A"}\n\n` +
    `────────────────\n` +
    `🚗 *Motorista:* ${data.driverName}\n` +
    `📞 *Contato:* ${data.driverPhone}\n` +
    `🪪 *Veículo:* ${data.vehicleLabel}\n` +
    `📝 *Placa:* ${data.vehiclePlate}\n\n` +
    itineraryPart +
    `👇 *Revisar e confirmar viagem:*\n${data.confirmationLink}`
  );
}
