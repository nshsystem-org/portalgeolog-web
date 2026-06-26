import { createClient } from "@/lib/supabase/client";
import { fetchInChunks } from "@/lib/supabase/chunked-in-query";
import { normalizeBrazilPhone } from "@/lib/phone";
import type {
  Cliente,
  CentroCusto,
  Solicitante,
  Passageiro,
  PassageiroEndereco,
  OrderService,
  NovoPassageiroInput,
  Waypoint,
  Driver,
  Vehicle,
} from "@/context/DataContext";
import {
  buildOperationalCyclesFromWaypoints,
  deriveCyclesOperationalStatus,
  getOperationalCycleTitle,
  type OperationalCycle,
} from "@/lib/os-messages";
import {
  fetchOperationalCyclesForOSIds,
  getFirstActiveOperationalCycle,
} from "@/lib/operational-cycles-db";

import {
  isFinanceStatusSettled,
  isLiberadoParaFaturamento,
  parseHoraExtraMinutes,
  calcHoraExtraCliente,
  calcHoraExtraMotorista,
  getNextDay,
} from "@/lib/financeiro";

let _supabase: ReturnType<typeof createClient> | null = null;
const getSupabase = () => {
  if (!_supabase) _supabase = createClient();
  return _supabase;
};

const trimText = (value?: string): string => value?.trim() ?? "";
const upperText = (value?: string): string => trimText(value).toUpperCase();

const normalizeForComparison = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForComparison(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, nestedValue]) => [
          key,
          normalizeForComparison(nestedValue),
        ]),
    );
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value ?? null;
};

const isDeepEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(normalizeForComparison(left)) ===
  JSON.stringify(normalizeForComparison(right));

const normalizeWaypointComparison = (waypoints: Waypoint[] = []) =>
  waypoints.map((waypoint) => ({
    label: waypoint.label,
    lat: waypoint.lat ?? null,
    lng: waypoint.lng ?? null,
    comment: waypoint.comment?.trim() || "",
    itineraryIndex: waypoint.itineraryIndex ?? null,
    hora: waypoint.hora?.trim() || null,
    data: waypoint.data || null,
    passengers: (waypoint.passengers || [])
      .map((passenger) => passenger.solicitanteId || passenger.id || "")
      .sort(),
  }));

const normalizeCycleComparison = (cycles: OperationalCycle[] = []) =>
  cycles.map((cycle) => ({
    itineraryIndex: cycle.itineraryIndex,
    sequenceOrder: cycle.sequenceOrder,
    kind: cycle.kind,
    ordinal: cycle.ordinal,
    title: cycle.title,
    state: cycle.state,
    messageSentAt: cycle.messageSentAt || null,
    acceptedAt: cycle.acceptedAt || null,
    startedAt: cycle.startedAt || null,
    finishedAt: cycle.finishedAt || null,
    kmInitial: cycle.kmInitial ?? null,
    kmFinal: cycle.kmFinal ?? null,
  }));

type OSFieldChange = {
  field: string;
  from?: string;
  to?: string;
  action?: "added" | "removed" | "changed";
};

type OSUpdateLogContext = {
  changedSections: string[];
  fieldChanges: OSFieldChange[];
  metadata: Record<string, unknown>;
};

const buildOSUpdateLogContext = (
  previousOS: OrderService | null | undefined,
  osData: OSInput,
  waypoints: Waypoint[],
  operationalCycles: OperationalCycle[],
): OSUpdateLogContext => {
  const changedFieldsBySection: Record<string, string[]> = {};
  const fieldChanges: OSFieldChange[] = [];

  const markChange = (
    section: string,
    label: string,
    previousValue: unknown,
    nextValue: unknown,
  ) => {
    if (isDeepEqual(previousValue, nextValue)) return;
    if (!changedFieldsBySection[section]) changedFieldsBySection[section] = [];
    changedFieldsBySection[section].push(label);
  };

  const addFieldChange = (change: OSFieldChange) => {
    fieldChanges.push(change);
  };

  const fmt = (v: unknown): string => {
    if (v == null) return "";
    if (typeof v === "string") return v.trim() || "";
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "Sim" : "Não";
    return "";
  };

  if (previousOS) {
    const nextCentroCusto =
      (osData as OSInput & { centroCusto?: string }).centroCusto ??
      osData.centroCustoId ??
      null;

    const simpleFields: Array<[string, unknown, unknown]> = [
      ["Data", previousOS.data, osData.data],
      ["Horário", previousOS.hora, osData.hora || null],
      ["Hora Extra", previousOS.horaExtra || "", osData.horaExtra || ""],
      ["Código OS", previousOS.os, osData.os],
      ["Cliente", previousOS.clienteId, osData.clienteId],
      [
        "Solicitante",
        previousOS.solicitante || "",
        upperText(osData.solicitante),
      ],
      [
        "Solicitante Responsável",
        previousOS.solicitanteId || null,
        osData.solicitanteId || null,
      ],
      ["Centro de Custo", previousOS.centroCustoId || null, nextCentroCusto],
      ["Motorista", previousOS.motorista || "", upperText(osData.motorista)],
      [
        "Motorista Alocado",
        previousOS.driverId || null,
        osData.driverId || null,
      ],
      [
        "Veículo de Uso",
        previousOS.veiculoId || null,
        osData.veiculoId || null,
      ],
      ["Valor Bruto (R$)", previousOS.valorBruto ?? 0, osData.valorBruto ?? 0],
      ["Custo Motorista (R$)", previousOS.custo ?? 0, osData.custo ?? 0],
      ["NO-SHOW", previousOS.noShow ?? false, osData.noShow ?? false],
      [
        "Cobrança NO-SHOW (%)",
        previousOS.noShowPercentual ?? null,
        osData.noShow ? (osData.noShowPercentual ?? 100) : null,
      ],
      [
        "Observações Financeiras",
        previousOS.obsFinanceiras || "",
        osData.obsFinanceiras || "",
      ],
    ];

    for (const [label, prev, next] of simpleFields) {
      if (!isDeepEqual(prev, next)) {
        markChange("Dados básicos", label, prev, next);
        addFieldChange({
          field: label,
          from: fmt(prev),
          to: fmt(next),
          action: "changed",
        });
      }
    }

    const prevWaypoints = previousOS.rota?.waypoints || [];
    const nextWaypoints = waypoints;

    if (
      !isDeepEqual(
        normalizeWaypointComparison(prevWaypoints),
        normalizeWaypointComparison(nextWaypoints),
      )
    ) {
      markChange(
        "Rota",
        "Waypoints",
        normalizeWaypointComparison(prevWaypoints),
        normalizeWaypointComparison(nextWaypoints),
      );

      const maxLen = Math.max(prevWaypoints.length, nextWaypoints.length);
      for (let i = 0; i < maxLen; i++) {
        const prevWp = prevWaypoints[i];
        const nextWp = nextWaypoints[i];
        const idxLabel = `Parada ${i + 1}`;

        if (!prevWp && nextWp) {
          addFieldChange({
            field: idxLabel,
            to: nextWp.label,
            action: "added",
          });
          continue;
        }

        if (prevWp && !nextWp) {
          addFieldChange({
            field: idxLabel,
            from: prevWp.label,
            action: "removed",
          });
          continue;
        }

        if (prevWp && nextWp) {
          if (prevWp.label !== nextWp.label) {
            addFieldChange({
              field: `${idxLabel} — Endereço`,
              from: prevWp.label,
              to: nextWp.label,
              action: "changed",
            });
          }

          if (
            (prevWp.comment?.trim() || "") !== (nextWp.comment?.trim() || "")
          ) {
            addFieldChange({
              field: `${idxLabel} — Comentário`,
              from: prevWp.comment?.trim() || "",
              to: nextWp.comment?.trim() || "",
              action: "changed",
            });
          }

          if (prevWp.hora?.trim() !== nextWp.hora?.trim()) {
            addFieldChange({
              field: `${idxLabel} — Horário`,
              from: prevWp.hora?.trim() || "",
              to: nextWp.hora?.trim() || "",
              action: "changed",
            });
          }

          if (prevWp.data !== nextWp.data) {
            addFieldChange({
              field: `${idxLabel} — Data`,
              from: prevWp.data || "",
              to: nextWp.data || "",
              action: "changed",
            });
          }

          const prevPax = prevWp.passengers || [];
          const nextPax = nextWp.passengers || [];
          const prevIds = new Set(prevPax.map((p) => p.solicitanteId || p.id));
          const nextIds = new Set(nextPax.map((p) => p.solicitanteId || p.id));

          const added = nextPax.filter(
            (p) => !prevIds.has(p.solicitanteId || p.id),
          );
          const removed = prevPax.filter(
            (p) => !nextIds.has(p.solicitanteId || p.id),
          );

          for (const p of added) {
            addFieldChange({
              field: `${idxLabel} — Passageiro`,
              to: p.nome || p.id,
              action: "added",
            });
          }
          for (const p of removed) {
            addFieldChange({
              field: `${idxLabel} — Passageiro`,
              from: p.nome || p.id,
              action: "removed",
            });
          }
        }
      }
    }

    if (
      !isDeepEqual(
        normalizeCycleComparison(previousOS.operationalCycles || []),
        normalizeCycleComparison(operationalCycles),
      )
    ) {
      markChange(
        "Ciclos operacionais",
        "Ciclos",
        normalizeCycleComparison(previousOS.operationalCycles || []),
        normalizeCycleComparison(operationalCycles),
      );
      addFieldChange({
        field: "Ciclos operacionais",
        action: "changed",
      });
    }
  }

  const changedSections = Object.keys(changedFieldsBySection);
  return {
    changedSections,
    fieldChanges,
    metadata: {
      changed_sections: changedSections,
      changed_fields_by_section: changedFieldsBySection,
      field_changes: fieldChanges,
    },
  };
};

/**
 * Utilitário para retry de operações assíncronas
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delay = 1000,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;

    // Só tenta de novo se for erro de rede (Failed to fetch) ou 5xx
    const isNetworkError =
      error instanceof TypeError && error.message === "Failed to fetch";
    // @ts-expect-error - Supabase error object has status property but TypeScript doesn't recognize it
    const isServerError = error?.status >= 500;

    if (isNetworkError || isServerError) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }

    throw error;
  }
}

type PaginationParams = {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
};

export type FinanceQueryFilters = {
  month?: string;
  dataInicio?: string;
  dataFim?: string;
  clienteId?: string;
  centroCustoId?: string;
  motorista?: string;
  driverId?: string;
  parceiroId?: string;
  statusOperacional?: string;
  statusFinanceiro?: string;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount: number;
};

const normalizePagination = (page = 1, pageSize = 10) => {
  const safePage = Math.max(1, Math.floor(page || 1));
  const safePageSize = Math.max(1, Math.floor(pageSize || 10));
  return {
    page: safePage,
    pageSize: safePageSize,
    from: (safePage - 1) * safePageSize,
    to: safePage * safePageSize - 1,
  };
};

const PASSAGEIRO_SELECT_COLUMNS =
  "id, nome_completo, email, celular, cpf, notificar, genero, passageiro_enderecos(id, rotulo, endereco_completo, referencia)";
const PASSAGEIRO_PAGE_SELECT_COLUMNS =
  "id, nome_completo, email, celular, cpf, notificar, genero";
const DRIVER_SELECT_COLUMNS =
  "id, name, cpf, cnh, phone, status, created_at, vinculo_tipo, parceiro_id, avatar_url, driver_vehicles(id, vehicle_id, vehicle:veiculos(id, placa, modelo, marca, tipo)), driver_documents(id)";
const DRIVER_PAGE_SELECT_COLUMNS =
  "id, name, cpf, cnh, phone, status, created_at, vinculo_tipo, parceiro_id, avatar_url, driver_vehicles(id, vehicle_id, vehicle:veiculos(id, placa, modelo, marca, tipo)), driver_documents(id)";
const VEICULO_PAGE_SELECT_COLUMNS =
  "id, placa, renavam, modelo, marca, ano, cor, tipo, status, created_at";

const MAX_SEARCH_TERM_LENGTH = 100;

const sanitizeSearchTerm = (term: string): string => {
  const trimmed = term.trim().slice(0, MAX_SEARCH_TERM_LENGTH);
  return trimmed
    .replace(/[%_]/g, "\\$&")
    .replace(/[(),]/g, "")
    .replace(/:/g, " ");
};

// Função para criar notificações
export async function createNotification(
  type: "success" | "info" | "warning" | "error",
  title: string,
  message: string,
  targetAudience: "interno" | "gestor" | "all" = "all",
  targetUserId?: string,
): Promise<void> {
  try {
    const response = await fetch("/api/app-notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        title,
        message,
        targetAudience,
        targetUserId: targetUserId || null,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      console.error(
        "Erro ao criar notificação:",
        payload?.error || `HTTP ${response.status}`,
      );
    }
  } catch (err) {
    console.error("Erro ao criar notificação:", err);
  }
}

type CentroCustoRow = { id: string; nome: string; cliente_id: string };
type SolicitanteRow = {
  id: string;
  nome: string;
  cliente_id: string;
  centro_custo_id: string | null;
};
type PassageiroRow = {
  id: string;
  nome_completo: string;
  email: string | null;
  celular: string | null;
  cpf: string | null;
  notificar: boolean | null;
  genero: string | null;
};
type PassageiroEnderecoRow = {
  id: string;
  passageiro_id: string;
  rotulo: string;
  endereco_completo: string;
  referencia: string | null;
};
type OSRow = {
  id: string;
  protocolo: string | null;
  os_number: string | null;
  data: string | null;
  hora: string | null;
  hora_extra: string | null;
  no_show: boolean | null;
  no_show_percentual: number | null;
  cliente_id: string | null;
  centro_custo?: string | null;
  solicitante: string | null;
  tipo_servico: string | null;
  motorista: string | null;
  driver_id?: string | null;
  solicitante_id?: string | null;
  centro_custo_id?: string | null;
  veiculo_id?: string | null;
  valor_bruto: number | string | null;
  imposto: number | string | null;
  custo: number | string | null;
  lucro: number | string | null;
  obs_financeiras: string | null;
  status_operacional: OrderService["status"]["operacional"];
  status_financeiro: OrderService["status"]["financeiro"];
  distancia: string | null;
  arquivado: boolean;
  driver_message_sent_at: string | null;
  driver_accepted_at: string | null;
  driver_km_initial: number | null;
  route_started_at: string | null;
  route_started_km: number | null;
  route_finished_at: string | null;
  route_finished_km: number | null;
  created_at: string | null;
  created_by: string | null;
  created_by_name: string | null;
  financeiro_faturado_em: string | null;
  financeiro_recebido_em: string | null;
  os_financeiro_anexos?: FinanceAttachmentRow[] | null;
  is_freelance: boolean | null;
  tipo: string | null;
};
type FinanceAttachmentRow = {
  id: string;
  ordem_servico_id: string;
  storage_path: string;
  nome_arquivo: string;
  mime_type: string;
  tamanho_bytes: number | string;
  tipo_documento: string;
  observacao: string | null;
  created_by: string | null;
  created_at: string;
};
type OSWaypointRow = {
  id: string;
  ordem_servico_id: string;
  position: number;
  label: string;
  lat: number | null;
  lng: number | null;
  comment: string | null;
  itinerary_index: number | null;
  hora: string | null;
  data: string | null;
};
type OSWaypointPassengerRow = {
  id: string;
  waypoint_id: string;
  passageiro_id: string | null;
};

const formatWaypointDateForUi = (
  value: string | null | undefined,
): string | undefined => {
  if (!value) return undefined;

  if (value.includes("/")) return value;

  const parts = value.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year && month && day) return `${day}/${month}/${year}`;
  }

  return value;
};

const normalizeWaypointDateForDb = (
  value: string | null | undefined,
): string | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.includes("-")) return trimmed;

  const parts = trimmed.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (day && month && year) return `${year}-${month}-${day}`;
  }

  if (parts.length === 2) {
    const [day, month] = parts;
    const year = new Date().getFullYear();
    if (day && month)
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
};

type DriverRow = {
  id: string;
  name: string;
  cpf?: string;
  cnh?: string | null;
  phone?: string | null;
  status: "active" | "inactive";
  created_at?: string;
  vinculo_tipo?: "interno" | "parceiro" | "autonomo";
  parceiro_id?: string | null;
  avatar_url?: string | null;
  driver_vehicles?: Array<{
    id: string;
    vehicle_id: string;
    vehicle:
      | {
          id: string;
          placa: string;
          modelo: string;
          marca: string;
          tipo?: string;
        }
      | {
          id: string;
          placa: string;
          modelo: string;
          marca: string;
          tipo?: string;
        }[];
  }>;
};

const mapOSRecord = (
  o: OSRow,
  wpRaw: OSWaypointRow[],
  wpPassRaw: OSWaypointPassengerRow[],
  operationalCycles?: OperationalCycle[],
): OrderService => {
  const waypoints: Waypoint[] = wpRaw
    .filter((w) => w.ordem_servico_id === o.id)
    .map((w) => ({
      label: w.label,
      lat: w.lat,
      lng: w.lng,
      comment: w.comment || undefined,
      itineraryIndex: w.itinerary_index ?? undefined,
      hora: w.hora ?? undefined,
      data: formatWaypointDateForUi(w.data),
      passengers: wpPassRaw
        .filter((p) => p.waypoint_id === w.id)
        .map((p) => ({
          id: p.id,
          solicitanteId: p.passageiro_id || "",
          nome: "",
        })),
    }));

  const cycleSource =
    operationalCycles && operationalCycles.length > 0
      ? operationalCycles
      : buildOperationalCyclesFromWaypoints(waypoints);
  const operationalStatus = deriveCyclesOperationalStatus(cycleSource);

  return {
    id: o.id,
    protocolo: o.protocolo || "",
    os: o.os_number || "",
    data: o.data || "",
    hora: o.hora,
    horaExtra: o.hora_extra || "",
    noShow: Boolean(o.no_show),
    noShowPercentual: o.no_show_percentual ?? null,
    clienteId: o.cliente_id || "",
    solicitante: o.solicitante || "",
    solicitanteId: o.solicitante_id || undefined,
    centroCustoId: o.centro_custo_id || o.centro_custo || "",
    motorista: o.motorista || "",
    driverId: o.driver_id || undefined,
    veiculoId: o.veiculo_id || undefined,
    valorBruto: o.valor_bruto !== null ? Number(o.valor_bruto) : null,
    imposto: o.imposto !== null ? Number(o.imposto) : null,
    custo: o.custo !== null ? Number(o.custo) : null,
    lucro: o.lucro !== null ? Number(o.lucro) : null,
    obsFinanceiras: o.obs_financeiras || "",
    status: {
      operacional: operationalStatus,
      financeiro: o.status_financeiro as OrderService["status"]["financeiro"],
    },
    distancia: o.distancia ? Number(o.distancia) : undefined,
    rota: waypoints.length > 0 ? { waypoints } : undefined,
    driverMessageSentAt: o.driver_message_sent_at ?? undefined,
    driverAcceptedAt: o.driver_accepted_at ?? undefined,
    driverKmInitial: o.driver_km_initial ?? undefined,
    routeStartedAt: o.route_started_at ?? undefined,
    routeStartedKm: o.route_started_km ?? undefined,
    routeFinishedAt: o.route_finished_at ?? undefined,
    routeFinishedKm: o.route_finished_km ?? undefined,
    operationalCycles: cycleSource,
    currentDriverCycleIndex:
      getFirstActiveOperationalCycle(cycleSource)?.sequenceOrder ?? undefined,
    createdAt: o.created_at ?? undefined,
    createdBy: o.created_by ?? undefined,
    createdByName: undefined,
    tipo: (o.tipo as OrderService["tipo"]) ?? "os",
    arquivado: o.arquivado ?? undefined,
    financeiroFaturadoEm: o.financeiro_faturado_em ?? undefined,
    financeiroRecebidoEm: o.financeiro_recebido_em ?? undefined,
    financeiroAnexos: (o.os_financeiro_anexos || []).map((anexo) => ({
      id: anexo.id,
      ordemServicoId: anexo.ordem_servico_id,
      storagePath: anexo.storage_path,
      nomeArquivo: anexo.nome_arquivo,
      mimeType: anexo.mime_type,
      tamanhoBytes: Number(anexo.tamanho_bytes),
      tipoDocumento: anexo.tipo_documento,
      observacao: anexo.observacao ?? undefined,
      createdBy: anexo.created_by ?? undefined,
      createdAt: anexo.created_at,
    })),
  };
};

const fetchWaypointsForOSIds = async (
  osIds: string[],
): Promise<{
  wpRaw: OSWaypointRow[];
  wpPassRaw: OSWaypointPassengerRow[];
}> => {
  if (osIds.length === 0) {
    return { wpRaw: [], wpPassRaw: [] };
  }

  const wpRaw = await fetchInChunks<OSWaypointRow>(
    getSupabase(),
    "os_waypoints",
    "ordem_servico_id",
    osIds,
    "id, ordem_servico_id, position, label, lat, lng, comment, itinerary_index, hora, data",
    "position",
  );

  const wpIds = wpRaw.map((waypoint) => waypoint.id);
  const wpPassRaw =
    wpIds.length > 0
      ? await fetchInChunks<OSWaypointPassengerRow>(
          getSupabase(),
          "os_waypoint_passengers",
          "waypoint_id",
          wpIds,
          "id, waypoint_id, passageiro_id",
        )
      : [];

  return { wpRaw, wpPassRaw };
};

// ── Clientes ──────────────────────────────────────────────

export async function fetchClientes(): Promise<Cliente[]> {
  return withRetry(async () => {
    const { data: clientesRaw, error } = await getSupabase()
      .from("clientes")
      .select(
        "id, nome, contato, centros_custo(id, nome, cliente_id, arquivado)",
      )
      .eq("arquivado", false)
      .order("nome");

    if (error) throw error;

    return (clientesRaw || []).map((c: Record<string, unknown>) => ({
      id: String(c.id),
      nome: String(c.nome),
      contato: c.contato ? String(c.contato) : undefined,
      centrosCusto: ((c.centros_custo || []) as Record<string, unknown>[])
        .filter((cc) => cc.arquivado === false)
        .map((cc) => ({
          id: String(cc.id),
          nome: String(cc.nome),
          clienteId: String(cc.cliente_id),
        })),
    }));
  });
}

export async function insertCentroCusto(
  nome: string,
  clienteId: string,
): Promise<CentroCusto> {
  const { data, error } = await getSupabase()
    .from("centros_custo")
    .insert({ nome: upperText(nome), cliente_id: clienteId })
    .select("id, nome, cliente_id")
    .single();

  if (error) throw error;
  return { id: data.id, nome: data.nome, clienteId: data.cliente_id };
}

export async function updateCentroCustoInDB(
  id: string,
  updates: Partial<CentroCusto>,
): Promise<void> {
  const { error } = await getSupabase()
    .from("centros_custo")
    .update({
      nome: updates.nome ? upperText(updates.nome) : undefined,
      cliente_id: updates.clienteId,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCentroCustoFromDB(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("centros_custo")
    .update({ arquivado: true })
    .eq("id", id);
  if (error) throw error;
}

export async function insertCliente(
  nome: string,
  contato?: string,
): Promise<Cliente> {
  const { data, error } = await getSupabase()
    .from("clientes")
    .insert({ nome: trimText(nome), contato: trimText(contato) || null })
    .select("id, nome, contato")
    .single();

  if (error) throw error;
  return { ...data, contato: data.contato || undefined, centrosCusto: [] };
}

export async function updateClienteInDB(
  id: string,
  updates: Partial<Cliente>,
): Promise<void> {
  const payload: { nome?: string; contato?: string | null } = {};

  if (updates.nome !== undefined) {
    payload.nome = trimText(updates.nome);
  }

  if (updates.contato !== undefined) {
    payload.contato = trimText(updates.contato) || null;
  }

  const { error } = await getSupabase()
    .from("clientes")
    .update(payload)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteClienteFromDB(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("clientes")
    .update({ arquivado: true })
    .eq("id", id);

  if (error) throw error;
}

// ── Solicitantes ──────────────────────────────────────────

export async function fetchSolicitantes(): Promise<Solicitante[]> {
  return withRetry(async () => {
    const { data, error } = await getSupabase()
      .from("solicitantes")
      .select("id, nome, cliente_id, centro_custo_id")
      .eq("arquivado", false)
      .order("nome");

    if (error) throw error;
    return ((data || []) as SolicitanteRow[]).map((s) => ({
      id: s.id,
      nome: s.nome,
      clienteId: s.cliente_id,
      centroCustoId: s.centro_custo_id || undefined,
    }));
  });
}

export async function insertSolicitante(
  nome: string,
  clienteId: string,
  centroCustoId?: string,
): Promise<Solicitante> {
  const { data, error } = await getSupabase()
    .from("solicitantes")
    .insert({
      nome: upperText(nome),
      cliente_id: clienteId,
      centro_custo_id: centroCustoId,
    })
    .select("id, nome, cliente_id, centro_custo_id")
    .single();

  if (error) throw error;
  return {
    id: data.id,
    nome: data.nome,
    clienteId: data.cliente_id,
    centroCustoId: data.centro_custo_id,
  };
}

export async function updateSolicitanteInDB(
  id: string,
  updates: Partial<Solicitante>,
): Promise<void> {
  const { error } = await getSupabase()
    .from("solicitantes")
    .update({
      nome: updates.nome ? upperText(updates.nome) : undefined,
      cliente_id: updates.clienteId,
      centro_custo_id: updates.centroCustoId,
    })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteSolicitanteFromDB(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("solicitantes")
    .update({ arquivado: true })
    .eq("id", id);

  if (error) throw error;
}

// ── Passageiros ───────────────────────────────────────────

export async function fetchPassageiros(): Promise<Passageiro[]> {
  return withRetry(async () => {
    const { data: passRaw, error } = await getSupabase()
      .from("passageiros")
      .select(PASSAGEIRO_SELECT_COLUMNS)
      .eq("arquivado", false)
      .order("nome_completo");

    if (error) throw error;

    return (passRaw || []).map((p: Record<string, unknown>) => ({
      id: String(p.id),
      nomeCompleto: String(p.nome_completo),
      email: p.email ? String(p.email) : undefined,
      celular: p.celular ? String(p.celular) : "",
      cpf: p.cpf ? String(p.cpf) : undefined,
      notificar: typeof p.notificar === "boolean" ? p.notificar : undefined,
      genero: typeof p.genero === "string" ? p.genero : undefined,
      enderecos: (
        (p.passageiro_enderecos || []) as Record<string, unknown>[]
      ).map((e) => ({
        id: String(e.id),
        rotulo: String(e.rotulo),
        enderecoCompleto: String(e.endereco_completo),
        referencia: e.referencia ? String(e.referencia) : undefined,
      })),
    }));
  });
}

export async function insertPassageiro(
  input: NovoPassageiroInput,
): Promise<Passageiro> {
  const celular = normalizeBrazilPhone(input.celular);

  const { data: passRow, error: passError } = await getSupabase()
    .from("passageiros")
    .insert({
      nome_completo: upperText(input.nomeCompleto),
      email: input.email ? trimText(input.email) : null,
      celular,
      cpf: input.cpf ? trimText(input.cpf) : null,
      notificar: input.notificar ?? false,
      genero: input.genero || null,
    })
    .select("id, nome_completo, email, celular, cpf, notificar, genero")
    .single();

  if (passError) throw passError;

  const enderecos: PassageiroEndereco[] = [];

  if (input.enderecos.length > 0) {
    const { data: endRows, error: endError } = await getSupabase()
      .from("passageiro_enderecos")
      .insert(
        input.enderecos.map((e) => ({
          passageiro_id: passRow.id,
          rotulo: trimText(e.rotulo) || "Principal",
          endereco_completo: trimText(e.enderecoCompleto),
          referencia: trimText(e.referencia) || null,
        })),
      )
      .select("id, rotulo, endereco_completo, referencia");

    if (!endError && endRows) {
      (endRows as PassageiroEnderecoRow[]).forEach((e) =>
        enderecos.push({
          id: e.id,
          rotulo: e.rotulo,
          enderecoCompleto: e.endereco_completo,
          referencia: e.referencia || undefined,
        }),
      );
    }
  }

  return {
    id: passRow.id,
    nomeCompleto: passRow.nome_completo,
    email: passRow.email || undefined,
    celular: passRow.celular || "",
    cpf: passRow.cpf || undefined,
    notificar: passRow.notificar || undefined,
    genero: passRow.genero || undefined,
    enderecos,
  };
}

export async function updatePassageiroInDB(
  id: string,
  input: NovoPassageiroInput,
): Promise<Passageiro> {
  const celular = normalizeBrazilPhone(input.celular);

  const enderecosPayload = input.enderecos.map((e) => ({
    rotulo: trimText(e.rotulo) || "Principal",
    endereco_completo: trimText(e.enderecoCompleto),
    referencia: trimText(e.referencia) || null,
  }));

  const { error: rpcError } = await getSupabase().rpc(
    "update_passageiro_atomic",
    {
      p_passageiro_id: id,
      p_nome_completo: upperText(input.nomeCompleto),
      p_email: input.email ? trimText(input.email) : null,
      p_celular: celular,
      p_cpf: input.cpf ? trimText(input.cpf) : null,
      p_notificar: input.notificar ?? false,
      p_genero: input.genero || null,
      p_enderecos: enderecosPayload,
    },
  );

  if (rpcError) throw rpcError;

  // Buscar dados atualizados
  const { data: passRow, error: passError } = await getSupabase()
    .from("passageiros")
    .select("id, nome_completo, email, celular, cpf, notificar, genero")
    .eq("id", id)
    .single();

  if (passError || !passRow)
    throw passError || new Error("Passageiro não encontrado após atualização.");

  const { data: endRows } = await getSupabase()
    .from("passageiro_enderecos")
    .select("id, rotulo, endereco_completo, referencia")
    .eq("passageiro_id", id);

  const enderecos: PassageiroEndereco[] = (endRows || []).map((e) => ({
    id: e.id,
    rotulo: e.rotulo,
    enderecoCompleto: e.endereco_completo,
    referencia: e.referencia || undefined,
  }));

  return {
    id: passRow.id,
    nomeCompleto: passRow.nome_completo,
    email: passRow.email || undefined,
    celular: passRow.celular || "",
    cpf: passRow.cpf || undefined,
    notificar: passRow.notificar || undefined,
    genero: passRow.genero || undefined,
    enderecos,
  };
}

export async function archivePassageiroInDB(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("passageiros")
    .update({ arquivado: true })
    .eq("id", id);

  if (error) throw error;
}

export async function fetchPassageirosPage({
  page = 1,
  pageSize = 10,
  searchTerm = "",
}: PaginationParams = {}): Promise<PaginatedResult<Passageiro>> {
  return withRetry(async () => {
    const { from, to } = normalizePagination(page, pageSize);
    const term = searchTerm.trim();
    const likeTerm = term ? `%${sanitizeSearchTerm(term)}%` : "";

    let query = getSupabase()
      .from("passageiros")
      .select(PASSAGEIRO_PAGE_SELECT_COLUMNS, { count: "exact" })
      .eq("arquivado", false)
      .order("nome_completo", { ascending: true })
      .range(from, to);

    if (likeTerm) {
      query = query.or(
        `nome_completo.ilike.${likeTerm},email.ilike.${likeTerm},celular.ilike.${likeTerm},cpf.ilike.${likeTerm}`,
      );
    }

    const { data: passRaw, error, count } = await query;
    if (error) throw error;

    const typedPassengers = (passRaw || []) as PassageiroRow[];
    const passengerIds = typedPassengers.map((p) => p.id);

    let endRaw: PassageiroEnderecoRow[] = [];
    if (passengerIds.length > 0) {
      const { data: endData } = await getSupabase()
        .from("passageiro_enderecos")
        .select("id, passageiro_id, rotulo, endereco_completo, referencia")
        .in("passageiro_id", passengerIds);

      endRaw = (endData || []) as PassageiroEnderecoRow[];
    }

    return {
      items: typedPassengers.map((p) => ({
        id: p.id,
        nomeCompleto: p.nome_completo,
        email: p.email || undefined,
        celular: p.celular || "",
        cpf: p.cpf || undefined,
        notificar: p.notificar ?? undefined,
        genero: p.genero ?? undefined,
        enderecos: endRaw
          .filter((e) => e.passageiro_id === p.id)
          .map((e) => ({
            id: e.id,
            rotulo: e.rotulo,
            enderecoCompleto: e.endereco_completo,
            referencia: e.referencia || undefined,
          })),
      })),
      totalCount: count ?? typedPassengers.length,
    };
  });
}

/**
 * Busca passageiros por IDs (usado para hidratar passageiros já selecionados
 * em formulários que usam busca assíncrona, onde o selecionado pode estar fora
 * da página atual de resultados). Retorna apenas passageiros não arquivados.
 */
export async function fetchPassageirosByIds(
  ids: string[],
): Promise<Passageiro[]> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  return withRetry(async () => {
    const { data: passRaw, error } = await getSupabase()
      .from("passageiros")
      .select(PASSAGEIRO_SELECT_COLUMNS)
      .in("id", uniqueIds)
      .eq("arquivado", false);

    if (error) throw error;

    return (passRaw || []).map((p: Record<string, unknown>) => ({
      id: String(p.id),
      nomeCompleto: String(p.nome_completo),
      email: p.email ? String(p.email) : undefined,
      celular: p.celular ? String(p.celular) : "",
      cpf: p.cpf ? String(p.cpf) : undefined,
      notificar: typeof p.notificar === "boolean" ? p.notificar : undefined,
      genero: typeof p.genero === "string" ? p.genero : undefined,
      enderecos: (
        (p.passageiro_enderecos || []) as Record<string, unknown>[]
      ).map((e) => ({
        id: String(e.id),
        rotulo: String(e.rotulo),
        enderecoCompleto: String(e.endereco_completo),
        referencia: e.referencia ? String(e.referencia) : undefined,
      })),
    }));
  });
}

// ── Veículos ───────────────────────────────────────────

export async function updateVeiculoInDB(
  id: string,
  input: Partial<Vehicle>,
): Promise<Vehicle> {
  const { data: vehRow, error: vehError } = await getSupabase()
    .from("veiculos")
    .update({
      placa: input.placa?.trim().toUpperCase(),
      renavam: input.renavam?.trim(),
      modelo: input.modelo?.trim(),
      marca: input.marca?.trim(),
      ano: input.ano,
      cor: input.cor?.trim() || null,
      tipo: input.tipo,
      status: input.status,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (vehError) throw vehError;

  return {
    id: vehRow.id,
    placa: vehRow.placa,
    renavam: vehRow.renavam,
    modelo: vehRow.modelo,
    marca: vehRow.marca,
    ano: vehRow.ano,
    cor: vehRow.cor || undefined,
    tipo: vehRow.tipo as Vehicle["tipo"],
    status: vehRow.status as Vehicle["status"],
    created_at: vehRow.created_at,
  };
}

export async function deleteVeiculoFromDB(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("veiculos")
    .update({ arquivado: true, status: "inativo" })
    .eq("id", id);

  if (error) throw error;
}

// ── Ordens de Serviço ─────────────────────────────────────

const OS_SELECT_COLUMNS = [
  "id",
  "protocolo",
  "os_number",
  "data",
  "hora",
  "hora_extra",
  "no_show",
  "no_show_percentual",
  "cliente_id",
  "centro_custo",
  "centro_custo_id",
  "solicitante",
  "solicitante_id",
  "motorista",
  "driver_id",
  "veiculo_id",
  "valor_bruto",
  "imposto",
  "custo",
  "lucro",
  "obs_financeiras",
  "status_operacional",
  "status_financeiro",
  "distancia",
  "arquivado",
  "driver_message_sent_at",
  "driver_accepted_at",
  "driver_km_initial",
  "route_started_at",
  "route_started_km",
  "route_finished_at",
  "route_finished_km",
  "created_at",
  "created_by",
  "is_freelance",
  "tipo",
].join(",");

export async function fetchOSList(): Promise<OrderService[]> {
  return withRetry(async () => {
    const { data: osRaw, error } = await getSupabase()
      .from("ordens_servico")
      .select(OS_SELECT_COLUMNS)
      .eq("arquivado", false)
      .neq("tipo", "rascunho")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const typedOrders = (osRaw || []) as unknown as OSRow[];
    const osIds = typedOrders.map((o) => o.id);
    const { wpRaw, wpPassRaw } = await fetchWaypointsForOSIds(osIds);
    const operationalCyclesByOS = await fetchOperationalCyclesForOSIds(
      getSupabase(),
      osIds,
    );

    return typedOrders.map((o) =>
      mapOSRecord(o, wpRaw, wpPassRaw, operationalCyclesByOS[o.id]),
    );
  });
}

export async function fetchOSById(id: string): Promise<OrderService | null> {
  return withRetry(async () => {
    const { data: osRaw, error } = await getSupabase()
      .from("ordens_servico")
      .select(OS_SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!osRaw) return null;

    const { data: wpData, error: wpError } = await getSupabase()
      .from("os_waypoints")
      .select(
        "id, ordem_servico_id, position, label, lat, lng, comment, itinerary_index, hora, data",
      )
      .eq("ordem_servico_id", id)
      .order("position");

    if (wpError) throw wpError;

    const wpRaw = (wpData || []) as unknown as OSWaypointRow[];
    const wpIds = wpRaw.map((w) => w.id);
    let wpPassRaw: OSWaypointPassengerRow[] = [];

    if (wpIds.length > 0) {
      wpPassRaw = await fetchInChunks<OSWaypointPassengerRow>(
        getSupabase(),
        "os_waypoint_passengers",
        "waypoint_id",
        wpIds,
        "id, waypoint_id, passageiro_id",
      );
    }

    const operationalCyclesByOS = await fetchOperationalCyclesForOSIds(
      getSupabase(),
      [id],
    );

    return mapOSRecord(
      osRaw as unknown as OSRow,
      wpRaw,
      wpPassRaw,
      operationalCyclesByOS[id],
    );
  });
}

export async function fetchOSByProtocolo(
  protocolo: string,
): Promise<OrderService | null> {
  return withRetry(async () => {
    const { data: osRaw, error } = await getSupabase()
      .from("ordens_servico")
      .select(OS_SELECT_COLUMNS)
      .eq("protocolo", protocolo)
      .maybeSingle();

    if (error) throw error;
    if (!osRaw) return null;

    const osId = (osRaw as unknown as OSRow).id;
    const { data: wpData, error: wpError } = await getSupabase()
      .from("os_waypoints")
      .select(
        "id, ordem_servico_id, position, label, lat, lng, comment, itinerary_index, hora, data",
      )
      .eq("ordem_servico_id", osId)
      .order("position");

    if (wpError) throw wpError;

    const wpRaw = (wpData || []) as unknown as OSWaypointRow[];
    const wpIds = wpRaw.map((w) => w.id);
    let wpPassRaw: OSWaypointPassengerRow[] = [];

    if (wpIds.length > 0) {
      wpPassRaw = await fetchInChunks<OSWaypointPassengerRow>(
        getSupabase(),
        "os_waypoint_passengers",
        "waypoint_id",
        wpIds,
        "id, waypoint_id, passageiro_id",
      );
    }

    const operationalCyclesByOS = await fetchOperationalCyclesForOSIds(
      getSupabase(),
      [osId],
    );

    return mapOSRecord(
      osRaw as unknown as OSRow,
      wpRaw,
      wpPassRaw,
      operationalCyclesByOS[osId],
    );
  });
}

export type OSPageFilters = {
  osNumber?: string;
  clienteId?: string;
  centroCustoId?: string;
  solicitante?: string;
  driverId?: string;
  veiculoId?: string;
  dataInicio?: string;
  dataFim?: string;
  statusOperacional?: string;
  faltandoValores?: boolean;
  createdBy?: string;
  arquivado?: boolean;
  tipo?: string;
  excludeTipos?: string[];
};

export async function fetchOSPage({
  page = 1,
  pageSize = 10,
  searchTerm = "",
  filters = {},
}: PaginationParams & { filters?: OSPageFilters } = {}): Promise<
  PaginatedResult<OrderService>
> {
  return withRetry(async () => {
    const { from, to } = normalizePagination(page, pageSize);
    const term = searchTerm.trim();
    const likeTerm = term ? `%${sanitizeSearchTerm(term)}%` : "";

    let query = getSupabase()
      .from("ordens_servico")
      .select(OS_SELECT_COLUMNS, { count: "exact" });

    if (filters.arquivado !== undefined) {
      query = query.eq("arquivado", filters.arquivado);
    } else {
      query = query.eq("arquivado", false);
    }

    query = query.order("created_at", { ascending: false }).range(from, to);

    if (likeTerm) {
      query = query.or(
        `protocolo.ilike.${likeTerm},os_number.ilike.${likeTerm},motorista.ilike.${likeTerm}`,
      );
    }

    if (filters.osNumber) {
      query = query.ilike(
        "os_number",
        `%${sanitizeSearchTerm(filters.osNumber)}%`,
      );
    }
    if (filters.clienteId) {
      query = query.eq("cliente_id", filters.clienteId);
    }
    if (filters.centroCustoId) {
      query = query.eq("centro_custo_id", filters.centroCustoId);
    }
    if (filters.solicitante) {
      query = query.ilike(
        "solicitante",
        `%${sanitizeSearchTerm(filters.solicitante)}%`,
      );
    }
    if (filters.driverId) {
      query = query.eq("driver_id", filters.driverId);
    }
    if (filters.veiculoId) {
      query = query.eq("veiculo_id", filters.veiculoId);
    }
    if (filters.dataInicio) {
      query = query.gte("data", filters.dataInicio);
    }
    if (filters.dataFim) {
      query = query.lte("data", filters.dataFim);
    }
    if (filters.statusOperacional) {
      query = query.eq("status_operacional", filters.statusOperacional);
    }
    if (filters.faltandoValores) {
      query = query
        .eq("status_operacional", "Finalizado")
        .or("valor_bruto.is.null,valor_bruto.eq.0,custo.is.null,custo.eq.0");
    }
    if (filters.createdBy) {
      query = query.eq("created_by", filters.createdBy);
    }
    if (filters.tipo) {
      query = query.eq("tipo", filters.tipo);
    }
    if (filters.excludeTipos && filters.excludeTipos.length > 0) {
      for (const excludeTipo of filters.excludeTipos) {
        query = query.neq("tipo", excludeTipo);
      }
    }

    const { data: osRaw, error, count } = await query;
    if (error) throw error;

    const typedOrders = (osRaw || []) as unknown as OSRow[];
    const osIds = typedOrders.map((o) => o.id);
    let wpRaw: OSWaypointRow[] = [];
    let wpPassRaw: OSWaypointPassengerRow[] = [];

    if (osIds.length > 0) {
      const { data: wpData } = await getSupabase()
        .from("os_waypoints")
        .select(
          "id, ordem_servico_id, position, label, lat, lng, comment, itinerary_index, hora, data",
        )
        .in("ordem_servico_id", osIds)
        .order("position");

      wpRaw = (wpData || []) as OSWaypointRow[];
      const wpIds = wpRaw.map((w) => w.id);

      if (wpIds.length > 0) {
        wpPassRaw = await fetchInChunks<OSWaypointPassengerRow>(
          getSupabase(),
          "os_waypoint_passengers",
          "waypoint_id",
          wpIds,
          "id, waypoint_id, passageiro_id",
        );
      }
    }

    const operationalCyclesByOS = await fetchOperationalCyclesForOSIds(
      getSupabase(),
      osIds,
    );

    return {
      items: typedOrders.map((o) =>
        mapOSRecord(o, wpRaw, wpPassRaw, operationalCyclesByOS[o.id]),
      ),
      totalCount: count ?? typedOrders.length,
    };
  });
}

const FINANCE_OS_SELECT_COLUMNS = `${OS_SELECT_COLUMNS}, financeiro_faturado_em, financeiro_recebido_em`;

export async function fetchOSFinancePage({
  page = 1,
  pageSize = 10,
  searchTerm = "",
  month = "",
  dataInicio,
  dataFim,
  clienteId,
  centroCustoId,
  motorista,
  driverId,
  parceiroId,
  statusOperacional,
  statusFinanceiro,
}: PaginationParams & FinanceQueryFilters = {}): Promise<
  PaginatedResult<OrderService>
> {
  return withRetry(async () => {
    const { from, to } = normalizePagination(page, pageSize);
    const term = searchTerm.trim();
    const likeTerm = term ? `%${sanitizeSearchTerm(term)}%` : "";

    let query = getSupabase()
      .from("ordens_servico")
      .select(FINANCE_OS_SELECT_COLUMNS, { count: "exact" })
      .eq("arquivado", false)
      .neq("tipo", "rascunho")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (month) {
      query = query
        .gte("data", `${month}-01`)
        .lt("data", getNextMonthFirstDay(month));
    }

    if (dataInicio) {
      query = query.gte("data", dataInicio);
    }

    if (dataFim) {
      query = query.lt("data", getNextDay(dataFim));
    }

    if (clienteId) {
      query = query.eq("cliente_id", clienteId);
    }

    if (centroCustoId) {
      query = query.eq("centro_custo_id", centroCustoId);
    }

    if (motorista) {
      query = query.ilike("motorista", `%${sanitizeSearchTerm(motorista)}%`);
    }

    if (driverId) {
      query = query.eq("driver_id", driverId);
    }

    if (parceiroId) {
      const { data: driverRows, error: driverError } = await getSupabase()
        .from("drivers")
        .select("id")
        .eq("parceiro_id", parceiroId)
        .eq("status", "active");

      if (driverError) throw driverError;

      const driverIds = (driverRows || []).map((row) => row.id);
      if (driverIds.length === 0) {
        return { items: [], totalCount: 0 };
      }

      query = query.in("driver_id", driverIds);
    }

    if (statusOperacional) {
      query = query.eq("status_operacional", statusOperacional);
    }

    if (statusFinanceiro) {
      query = query.eq("status_financeiro", statusFinanceiro);
    }

    if (likeTerm) {
      query = query.or(
        `protocolo.ilike.${likeTerm},os_number.ilike.${likeTerm},motorista.ilike.${likeTerm}`,
      );
    }

    const { data: osRaw, error, count } = await query;
    if (error) throw error;

    const typedOrders = (osRaw || []) as unknown as OSRow[];
    const operationalCyclesByOS = await fetchOperationalCyclesForOSIds(
      getSupabase(),
      typedOrders.map((o) => o.id),
    );

    return {
      items: typedOrders.map((o) =>
        mapOSRecord(o, [], [], operationalCyclesByOS[o.id]),
      ),
      totalCount: count ?? typedOrders.length,
    };
  });
}

export async function fetchOSFinanceOverview(
  filters: FinanceQueryFilters = {},
): Promise<OrderService[]> {
  return withRetry(async () => {
    const {
      month = "",
      dataInicio,
      dataFim,
      clienteId,
      centroCustoId,
      motorista,
      driverId,
      parceiroId,
      statusOperacional,
      statusFinanceiro,
    } = filters;

    let query = getSupabase()
      .from("ordens_servico")
      .select(FINANCE_OS_SELECT_COLUMNS)
      .eq("arquivado", false)
      .neq("tipo", "rascunho")
      .order("created_at", { ascending: false });

    if (month) {
      query = query
        .gte("data", `${month}-01`)
        .lt("data", getNextMonthFirstDay(month));
    }
    if (dataInicio) query = query.gte("data", dataInicio);
    if (dataFim) query = query.lt("data", getNextDay(dataFim));
    if (clienteId) query = query.eq("cliente_id", clienteId);
    if (centroCustoId) query = query.eq("centro_custo_id", centroCustoId);
    if (motorista)
      query = query.ilike("motorista", `%${sanitizeSearchTerm(motorista)}%`);
    if (driverId) query = query.eq("driver_id", driverId);
    if (statusOperacional)
      query = query.eq("status_operacional", statusOperacional);
    if (statusFinanceiro)
      query = query.eq("status_financeiro", statusFinanceiro);
    if (parceiroId) {
      const { data: driverRows, error: driverError } = await getSupabase()
        .from("drivers")
        .select("id")
        .eq("parceiro_id", parceiroId)
        .eq("status", "active");
      if (driverError) throw driverError;
      const driverIds = (driverRows || []).map((row) => row.id);
      if (driverIds.length === 0) return [];
      query = query.in("driver_id", driverIds);
    }

    const { data: osRaw, error } = await query;
    if (error) throw error;

    const typedOrders = (osRaw || []) as unknown as OSRow[];
    const operationalCyclesByOS = await fetchOperationalCyclesForOSIds(
      getSupabase(),
      typedOrders.map((o) => o.id),
    );

    return typedOrders.map((o) =>
      mapOSRecord(o, [], [], operationalCyclesByOS[o.id]),
    );
  });
}

function getNextMonthFirstDay(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  if (monthNum === 12) return `${year + 1}-01-01`;
  return `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;
}

type OSInput = Omit<
  OrderService,
  "id" | "lucro" | "imposto" | "status" | "protocolo"
>;

export async function insertOS(osData: OSInput): Promise<OrderService> {
  const waypoints = osData.rota?.waypoints || [];
  const operationalCycles = buildOperationalCyclesFromWaypoints(waypoints);
  const centroCusto =
    (osData as OSInput & { centroCusto?: string }).centroCusto ??
    osData.centroCustoId ??
    "";

  const osPayload = {
    data: osData.data,
    hora: osData.hora || "",
    hora_extra: osData.horaExtra || "",
    os_number: osData.os || "",
    cliente_id: osData.clienteId || "",
    solicitante: upperText(osData.solicitante),
    solicitante_id:
      (osData as OSInput & { solicitanteId?: string }).solicitanteId || "",
    centro_custo: centroCusto,
    centro_custo_id: centroCusto,
    motorista: upperText(osData.motorista),
    driver_id: (osData as OSInput & { driverId?: string }).driverId || "",
    veiculo_id: (osData as OSInput & { veiculoId?: string }).veiculoId || "",
    valor_bruto: osData.valorBruto ?? 0,
    no_show: Boolean(osData.noShow),
    no_show_percentual: osData.noShow ? (osData.noShowPercentual ?? 100) : null,
    obs_financeiras:
      (osData as OSInput & { obsFinanceiras?: string }).obsFinanceiras || "",
    custo: osData.custo ?? 0,
    tipo: (osData as OSInput & { tipo?: OrderService["tipo"] }).tipo ?? "os",
  };

  const waypointsPayload = waypoints.map((wp) => ({
    label: wp.label,
    lat: wp.lat ?? null,
    lng: wp.lng ?? null,
    comment: wp.comment?.trim() || "",
    itinerary_index: wp.itineraryIndex ?? null,
    hora: wp.hora?.trim() || null,
    data: normalizeWaypointDateForDb(wp.data),
    passengers: (wp.passengers || []).map((p) => ({
      solicitante_id: p.solicitanteId || null,
    })),
  }));

  const { data: osId, error } = await getSupabase().rpc("insert_os_atomic", {
    p_os_data: osPayload,
    p_waypoints: waypointsPayload,
    p_operational_cycles: operationalCycles,
  });

  if (error || !osId) {
    throw error || new Error("Falha ao criar OS via RPC");
  }

  const latest = await fetchOSById(osId);
  if (!latest) {
    throw new Error("OS criada mas não pôde ser recuperada");
  }

  return latest;
}

export async function updateOSInDB(
  id: string,
  osData: OSInput,
  previousOS?: OrderService | null,
): Promise<{ changed: boolean }> {
  const impostoPercentual = await getImpostoPercentualForDate(osData.data);
  const vBruto = osData.valorBruto ?? 0;
  const vCusto = osData.custo ?? 0;
  const noShowFator = osData.noShow
    ? (osData.noShowPercentual ?? 100) / 100
    : 1;
  const heMin = parseHoraExtraMinutes(osData.horaExtra || "");
  const heCliente = calcHoraExtraCliente(heMin);
  const heMotorista = calcHoraExtraMotorista(heMin);
  const baseCobranca = osData.noShow
    ? (vBruto + heCliente) * noShowFator
    : vBruto + heCliente;
  const repasseEfetivo = osData.noShow
    ? (vCusto + heMotorista) * noShowFator
    : vCusto + heMotorista;
  const imposto = baseCobranca * (impostoPercentual / 100);
  const lucro = baseCobranca - imposto - repasseEfetivo;
  const centroCusto =
    (osData as OSInput & { centroCusto?: string }).centroCusto ??
    osData.centroCustoId ??
    "";

  const waypoints = osData.rota?.waypoints || [];

  // Buscar ciclos operacionais existentes para preservar status
  const { data: existingCyclesRaw } = await getSupabase()
    .from("os_operational_cycles")
    .select(
      "itinerary_index, sequence_order, kind, ordinal, title, state, message_sent_at, accepted_at, started_at, finished_at, km_initial, km_final",
    )
    .eq("ordem_servico_id", id)
    .order("sequence_order");

  const existingCycles = (existingCyclesRaw || []) as {
    itinerary_index: number;
    sequence_order: number;
    kind: OperationalCycle["kind"];
    ordinal: number;
    title: string;
    state: OperationalCycle["state"];
    message_sent_at: string | null;
    accepted_at: string | null;
    started_at: string | null;
    finished_at: string | null;
    km_initial: number | null;
    km_final: number | null;
  }[];

  const existingCyclesMap = new Map<number, OperationalCycle>();
  existingCycles.forEach((cycle) => {
    existingCyclesMap.set(cycle.itinerary_index, {
      itineraryIndex: cycle.itinerary_index,
      sequenceOrder: cycle.sequence_order,
      kind: cycle.kind,
      ordinal: cycle.ordinal,
      title: getOperationalCycleTitle({
        kind: cycle.kind,
        ordinal: cycle.ordinal,
      }),
      state: cycle.state,
      messageSentAt: cycle.message_sent_at,
      acceptedAt: cycle.accepted_at,
      startedAt: cycle.started_at,
      finishedAt: cycle.finished_at,
      kmInitial: cycle.km_initial,
      kmFinal: cycle.km_final,
    });
  });

  // Construir novos ciclos a partir dos waypoints
  const newCycles = buildOperationalCyclesFromWaypoints(waypoints);

  // Mesclar: preservar status dos ciclos existentes, adicionar novos ciclos
  const operationalCycles = newCycles.map((newCycle) => {
    const existingCycle = existingCyclesMap.get(newCycle.itineraryIndex);

    if (existingCycle) {
      return {
        ...newCycle,
        state: existingCycle.state,
        messageSentAt: existingCycle.messageSentAt,
        acceptedAt: existingCycle.acceptedAt,
        startedAt: existingCycle.startedAt,
        finishedAt: existingCycle.finishedAt,
        kmInitial: existingCycle.kmInitial,
        kmFinal: existingCycle.kmFinal,
      };
    }

    return newCycle;
  });

  const updateLogContext = buildOSUpdateLogContext(
    previousOS,
    osData,
    waypoints,
    operationalCycles,
  );

  // Fonte de verdade: sem diff real, nao salva no banco e nao gera log/notificacao
  if (updateLogContext.changedSections.length === 0) {
    return { changed: false };
  }

  const osPayload = {
    data: osData.data,
    hora: osData.hora || null,
    hora_extra: osData.horaExtra || "",
    os_number: osData.os || "",
    cliente_id: osData.clienteId || null,
    solicitante: upperText(osData.solicitante),
    solicitante_id:
      (osData as OSInput & { solicitanteId?: string }).solicitanteId || null,
    centro_custo: centroCusto,
    centro_custo_id: centroCusto || null,
    motorista: upperText(osData.motorista),
    driver_id: (osData as OSInput & { driverId?: string }).driverId || null,
    veiculo_id: (osData as OSInput & { veiculoId?: string }).veiculoId || null,
    valor_bruto: osData.valorBruto ?? 0,
    no_show: Boolean(osData.noShow),
    no_show_percentual: osData.noShow ? (osData.noShowPercentual ?? 100) : null,
    obs_financeiras:
      (osData as OSInput & { obsFinanceiras?: string }).obsFinanceiras || "",
    imposto,
    custo: osData.custo ?? 0,
    lucro,
    tipo: (osData as OSInput & { tipo?: OrderService["tipo"] }).tipo ?? "os",
  };

  const waypointsPayload = waypoints.map((wp) => ({
    label: wp.label,
    lat: wp.lat ?? null,
    lng: wp.lng ?? null,
    comment: wp.comment?.trim() || "",
    itinerary_index: wp.itineraryIndex ?? null,
    hora: wp.hora?.trim() || null,
    data: normalizeWaypointDateForDb(wp.data),
    passengers: (wp.passengers || []).map((p) => ({
      solicitante_id: p.solicitanteId || null,
    })),
  }));

  const { error } = await getSupabase().rpc("update_os_atomic", {
    p_os_id: id,
    p_os_data: osPayload,
    p_waypoints: waypointsPayload,
    p_operational_cycles: operationalCycles,
    p_log_metadata: updateLogContext.metadata,
  });

  if (error) throw error;

  return { changed: true };
}

export async function promoteDraftToOS(id: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("promote_draft_to_os", {
    p_os_id: id,
  });
  if (error || !data) throw error || new Error("Falha ao promover rascunho");
  return data as string;
}

export async function updateOSStatusInDB(
  id: string,
  updates: { operacional?: string; financeiro?: string },
): Promise<void> {
  const { error } = await getSupabase().rpc("update_os_status_atomic", {
    p_os_id: id,
    p_operacional: updates.operacional ?? null,
    p_financeiro: updates.financeiro ?? null,
  });

  if (error) throw error;
}

export async function archiveOSFromDB(
  id: string,
  osLabel?: string | null,
): Promise<void> {
  const { error } = await getSupabase().rpc("archive_os_atomic", {
    p_os_id: id,
    p_os_label: osLabel ?? null,
  });

  if (error) throw error;
}

export async function unarchiveOSFromDB(
  id: string,
  osLabel?: string | null,
): Promise<void> {
  const { error } = await getSupabase().rpc("unarchive_os_atomic", {
    p_os_id: id,
    p_os_label: osLabel ?? null,
  });

  if (error) throw error;
}

// ── Centros de Custo ──────────────────────────────────────

export async function fetchCentrosCustoByCliente(
  clienteId: string,
): Promise<CentroCusto[]> {
  return withRetry(async () => {
    const { data, error } = await getSupabase()
      .from("centros_custo")
      .select("id, nome")
      .eq("cliente_id", clienteId)
      .eq("arquivado", false)
      .order("nome");

    if (error) throw error;
    return ((data || []) as Array<Pick<CentroCustoRow, "id" | "nome">>).map(
      (cc) => ({ id: cc.id, nome: cc.nome, clienteId: clienteId }),
    );
  });
}

// ── Motoristas ────────────────────────────────────────────

export async function fetchDrivers(): Promise<Driver[]> {
  return withRetry(async () => {
    const { data, error } = await getSupabase()
      .from("drivers")
      .select(DRIVER_SELECT_COLUMNS)
      .eq("arquivado", false)
      .order("name");

    if (error) throw error;
    return ((data || []) as unknown as DriverRow[]).map((d) => ({
      id: d.id,
      name: d.name,
      cpf: d.cpf || "",
      cnh: d.cnh || "",
      phone: d.phone || "",
      status: d.status as "active" | "inactive",
      created_at: d.created_at,
      vinculo_tipo: d.vinculo_tipo,
      parceiro_id: d.parceiro_id ?? undefined,
      avatar_url: d.avatar_url ?? undefined,
      driver_vehicles:
        d.driver_vehicles?.map((dv) => ({
          id: dv.id,
          driver_id: d.id,
          vehicle_id: dv.vehicle_id,
          vehicle: Array.isArray(dv.vehicle) ? dv.vehicle[0] : dv.vehicle,
        })) || [],
      docsCount:
        (
          (d as unknown as Record<string, unknown>).driver_documents as
            | unknown[]
            | undefined
        )?.length || 0,
    }));
  });
}

export async function fetchDriversPage({
  page = 1,
  pageSize = 10,
  searchTerm = "",
}: PaginationParams = {}): Promise<PaginatedResult<Driver>> {
  return withRetry(async () => {
    const { from, to } = normalizePagination(page, pageSize);
    const term = searchTerm.trim();
    const likeTerm = term ? `%${sanitizeSearchTerm(term)}%` : "";

    let query = getSupabase()
      .from("drivers")
      .select(DRIVER_PAGE_SELECT_COLUMNS, { count: "exact" })
      .eq("arquivado", false)
      .order("name", { ascending: true })
      .range(from, to);

    if (likeTerm) {
      query = query.or(
        `name.ilike.${likeTerm},cpf.ilike.${likeTerm},cnh.ilike.${likeTerm},phone.ilike.${likeTerm}`,
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      items: ((data || []) as unknown as DriverRow[]).map((d) => ({
        id: d.id,
        name: d.name,
        cpf: d.cpf || "",
        cnh: d.cnh || "",
        phone: d.phone || "",
        status: d.status as "active" | "inactive",
        created_at: d.created_at,
        vinculo_tipo: d.vinculo_tipo,
        parceiro_id: d.parceiro_id ?? undefined,
        avatar_url: d.avatar_url ?? undefined,
        driver_vehicles:
          d.driver_vehicles?.map((dv) => ({
            id: dv.id,
            driver_id: d.id,
            vehicle_id: dv.vehicle_id,
            vehicle: Array.isArray(dv.vehicle) ? dv.vehicle[0] : dv.vehicle,
          })) || [],
        docsCount:
          (
            (d as unknown as Record<string, unknown>).driver_documents as
              | unknown[]
              | undefined
          )?.length || 0,
      })),
      totalCount: count ?? (data || []).length,
    };
  });
}

// ── Veículos ───────────────────────────────────────────

export async function fetchVeiculosPage({
  page = 1,
  pageSize = 10,
  searchTerm = "",
}: PaginationParams = {}): Promise<PaginatedResult<Vehicle>> {
  return withRetry(async () => {
    const { from, to } = normalizePagination(page, pageSize);
    const term = searchTerm.trim();
    const likeTerm = term ? `%${sanitizeSearchTerm(term)}%` : "";

    let query = getSupabase()
      .from("veiculos")
      .select(VEICULO_PAGE_SELECT_COLUMNS, { count: "exact" })
      .eq("arquivado", false)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (likeTerm) {
      query = query.or(
        `placa.ilike.${likeTerm},modelo.ilike.${likeTerm},marca.ilike.${likeTerm},renavam.ilike.${likeTerm}`,
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      items: (data || []) as Vehicle[],
      totalCount: count ?? (data || []).length,
    };
  });
}

export async function insertDriver(
  driver: Omit<Driver, "id" | "created_at">,
): Promise<Driver> {
  const { data, error } = await getSupabase()
    .from("drivers")
    .insert({
      ...driver,
      name: upperText(driver.name),
    })
    .select(DRIVER_SELECT_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as Driver;
}

export async function updateDriverInDB(
  id: string,
  driver: Partial<Driver>,
): Promise<void> {
  const { error } = await getSupabase()
    .from("drivers")
    .update({
      ...driver,
      name: driver.name ? upperText(driver.name) : undefined,
    })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteDriverFromDB(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("drivers")
    .update({ arquivado: true, status: "inactive" })
    .eq("id", id);
  if (error) throw error;
}

// ── Parceiros de Serviço ─────────────────────────────────

export interface ParceiroServico {
  id: string;
  pessoaTipo: "fisica" | "juridica";
  documento: string;
  razaoSocialOuNomeCompleto: string;
  status: "ativo" | "inativo";
  arquivado: boolean;
  contatos: ParceiroContato[];
  filiais: ParceiroFilial[];
  searchIndex: string;
}

export interface ParceiroContato {
  id: string;
  setor: string;
  celular: string;
  email?: string;
  responsavel: string;
}

export interface ParceiroFilial {
  id: string;
  rotulo: string;
  enderecoCompleto: string;
}

export interface NovoParceiroInput {
  pessoaTipo: "fisica" | "juridica";
  documento: string;
  razaoSocialOuNomeCompleto: string;
  contatos: {
    setor: string;
    celular: string;
    email?: string;
    responsavel: string;
  }[];
  filiais: {
    rotulo: string;
    enderecoCompleto: string;
  }[];
}

type ParceiroRow = {
  id: string;
  nome: string;
  tipo: string;
  pessoa_tipo: "fisica" | "juridica";
  documento: string | null;
  razao_social_ou_nome_completo: string | null;
  telefone: string | null;
  status: "ativo" | "inativo";
  arquivado: boolean;
  search_index: string;
};

type ParceiroContatoRow = {
  id: string;
  parceiro_id: string;
  setor: string;
  celular: string;
  email: string | null;
  responsavel: string;
};

type ParceiroFilialRow = {
  id: string;
  parceiro_id: string;
  rotulo: string;
  endereco_completo: string;
};

const buildParceiroSearchIndex = (
  parceiro: Omit<ParceiroServico, "searchIndex">,
  contatos: ParceiroContato[],
  filiais: ParceiroFilial[],
): string => {
  const tokens = [
    parceiro.pessoaTipo,
    parceiro.documento,
    parceiro.razaoSocialOuNomeCompleto,
    ...contatos.flatMap((contato) => [
      contato.setor,
      contato.celular,
      contato.email || "",
      contato.responsavel,
    ]),
    ...filiais.flatMap((filial) => [filial.rotulo, filial.enderecoCompleto]),
  ];

  return tokens.join(" ").toLowerCase();
};

const mapParceiroPayload = (
  parceiro: ParceiroRow,
  contatos: ParceiroContatoRow[],
  filiais: ParceiroFilialRow[],
): ParceiroServico => {
  const mappedContatos = contatos.map((contato) => ({
    id: contato.id,
    setor: contato.setor,
    celular: contato.celular,
    email: contato.email || undefined,
    responsavel: contato.responsavel,
  }));

  const mappedFiliais = filiais.map((filial) => ({
    id: filial.id,
    rotulo: filial.rotulo || "Filial",
    enderecoCompleto: filial.endereco_completo,
  }));

  const base = {
    id: parceiro.id,
    pessoaTipo: parceiro.pessoa_tipo,
    documento: parceiro.documento || "",
    razaoSocialOuNomeCompleto:
      parceiro.razao_social_ou_nome_completo || parceiro.nome || "",
    status: parceiro.status || "ativo",
    arquivado: parceiro.arquivado ?? false,
    contatos: mappedContatos,
    filiais: mappedFiliais,
  };

  return {
    ...base,
    searchIndex: buildParceiroSearchIndex(base, mappedContatos, mappedFiliais),
  };
};

export async function fetchParceiros(): Promise<ParceiroServico[]> {
  return withRetry(async () => {
    const { data, error } = await getSupabase()
      .from("parceiros_servico")
      .select("*")
      .eq("arquivado", false)
      .order("razao_social_ou_nome_completo");

    if (error) throw error;
    const parceiros = data as ParceiroRow[];

    // Buscar contatos e filiais para todos os parceiros
    const parceirosIds = parceiros.map((p) => p.id);

    let contatos: ParceiroContatoRow[] = [];
    let filiais: ParceiroFilialRow[] = [];

    if (parceirosIds.length > 0) {
      const { data: contatosData, error: contatosError } = await getSupabase()
        .from("parceiros_contatos")
        .select("*")
        .in("parceiro_id", parceirosIds);

      if (contatosError) throw contatosError;
      contatos = contatosData as ParceiroContatoRow[];

      const { data: filiaisData, error: filiaisError } = await getSupabase()
        .from("parceiros_filiais")
        .select("*")
        .in("parceiro_id", parceirosIds);

      if (filiaisError) throw filiaisError;
      filiais = filiaisData as ParceiroFilialRow[];
    }

    // Mapear dados completos
    return parceiros.map((parceiro) => {
      const parceiroContatos = contatos.filter(
        (c) => c.parceiro_id === parceiro.id,
      );
      const parceiroFiliais = filiais.filter(
        (f) => f.parceiro_id === parceiro.id,
      );
      return mapParceiroPayload(parceiro, parceiroContatos, parceiroFiliais);
    });
  });
}

export async function fetchParceirosPage({
  page = 1,
  pageSize = 10,
  searchTerm = "",
  arquivado = false,
}: PaginationParams & { arquivado?: boolean } = {}): Promise<
  PaginatedResult<ParceiroServico>
> {
  return withRetry(async () => {
    const { from, to } = normalizePagination(page, pageSize);
    const term = searchTerm.trim();
    const likeTerm = term ? `%${sanitizeSearchTerm(term)}%` : "";

    let query = getSupabase()
      .from("parceiros_servico")
      .select("*", { count: "exact" })
      .eq("arquivado", arquivado)
      .order("razao_social_ou_nome_completo", { ascending: true })
      .range(from, to);

    if (likeTerm) {
      query = query.or(`search_index.ilike.${likeTerm}`);
    }

    const { data: parceirosData, error: parceirosError, count } = await query;
    if (parceirosError) throw parceirosError;
    const parceiros = (parceirosData || []) as ParceiroRow[];

    const parceirosIds = parceiros.map((p) => p.id);
    let contatos: ParceiroContatoRow[] = [];
    let filiais: ParceiroFilialRow[] = [];

    if (parceirosIds.length > 0) {
      const { data: contatosData, error: contatosError } = await getSupabase()
        .from("parceiros_contatos")
        .select("*")
        .in("parceiro_id", parceirosIds);

      if (contatosError) throw contatosError;
      contatos = contatosData as ParceiroContatoRow[];

      const { data: filiaisData, error: filiaisError } = await getSupabase()
        .from("parceiros_filiais")
        .select("*")
        .in("parceiro_id", parceirosIds);

      if (filiaisError) throw filiaisError;
      filiais = filiaisData as ParceiroFilialRow[];
    }

    return {
      items: parceiros.map((parceiro) => {
        const parceiroContatos = contatos.filter(
          (c) => c.parceiro_id === parceiro.id,
        );
        const parceiroFiliais = filiais.filter(
          (f) => f.parceiro_id === parceiro.id,
        );
        return mapParceiroPayload(parceiro, parceiroContatos, parceiroFiliais);
      }),
      totalCount: count ?? parceiros.length,
    };
  });
}

export async function fetchParceiroById(id: string): Promise<ParceiroServico> {
  return withRetry(async () => {
    const { data: parceiroData, error: parceiroError } = await getSupabase()
      .from("parceiros_servico")
      .select("*")
      .eq("id", id)
      .single();

    if (parceiroError) throw parceiroError;
    const parceiro = parceiroData as ParceiroRow;

    // Buscar contatos
    const { data: contatosData, error: contatosError } = await getSupabase()
      .from("parceiros_contatos")
      .select("*")
      .eq("parceiro_id", id);

    if (contatosError) throw contatosError;
    const contatos = contatosData as ParceiroContatoRow[];

    // Buscar filiais
    const { data: filiaisData, error: filiaisError } = await getSupabase()
      .from("parceiros_filiais")
      .select("*")
      .eq("parceiro_id", id);

    if (filiaisError) throw filiaisError;
    const filiais = filiaisData as ParceiroFilialRow[];

    return mapParceiroPayload(parceiro, contatos, filiais);
  });
}

export async function insertParceiro(
  input: NovoParceiroInput,
): Promise<ParceiroServico> {
  // Inserir parceiro principal
  const { data: parceiroData, error: parceiroError } = await getSupabase()
    .from("parceiros_servico")
    .insert({
      nome: trimText(input.razaoSocialOuNomeCompleto),
      tipo: "Parceiro",
      pessoa_tipo: input.pessoaTipo,
      documento: trimText(input.documento),
      razao_social_ou_nome_completo: trimText(input.razaoSocialOuNomeCompleto),
    })
    .select("*")
    .single();

  if (parceiroError) throw parceiroError;
  const parceiro = parceiroData as ParceiroRow;

  // Inserir contatos
  const contatosToInsert = input.contatos.map((contato) => ({
    parceiro_id: parceiro.id,
    setor: trimText(contato.setor),
    celular: normalizeBrazilPhone(contato.celular),
    email: trimText(contato.email) || null,
    responsavel: trimText(contato.responsavel),
  }));

  if (contatosToInsert.length > 0) {
    const { error: contatosError } = await getSupabase()
      .from("parceiros_contatos")
      .insert(contatosToInsert);

    if (contatosError) throw contatosError;
  }

  // Inserir filiais
  const filiaisToInsert = input.filiais.map((filial) => ({
    parceiro_id: parceiro.id,
    rotulo: trimText(filial.rotulo),
    endereco_completo: trimText(filial.enderecoCompleto),
  }));

  if (filiaisToInsert.length > 0) {
    const { error: filiaisError } = await getSupabase()
      .from("parceiros_filiais")
      .insert(filiaisToInsert);

    if (filiaisError) throw filiaisError;
  }

  // Buscar dados completos para retornar
  return fetchParceiroById(parceiro.id);
}

export async function updateParceiroInDB(
  id: string,
  input: NovoParceiroInput,
): Promise<ParceiroServico> {
  const contatosPayload = input.contatos.map((c) => ({
    setor: trimText(c.setor),
    celular: normalizeBrazilPhone(c.celular),
    email: trimText(c.email) || null,
    responsavel: trimText(c.responsavel),
  }));

  const filiaisPayload = input.filiais.map((f) => ({
    rotulo: trimText(f.rotulo),
    endereco_completo: trimText(f.enderecoCompleto),
  }));

  const { error: rpcError } = await getSupabase().rpc(
    "update_parceiro_atomic",
    {
      p_parceiro_id: id,
      p_nome: trimText(input.razaoSocialOuNomeCompleto),
      p_pessoa_tipo: input.pessoaTipo,
      p_documento: trimText(input.documento),
      p_razao_social_ou_nome_completo: trimText(
        input.razaoSocialOuNomeCompleto,
      ),
      p_contatos: contatosPayload,
      p_filiais: filiaisPayload,
    },
  );

  if (rpcError) throw rpcError;

  // Buscar dados completos para retornar
  return fetchParceiroById(id);
}

export interface ParceiroVinculo {
  tabela: string;
  campo: string;
  registros: { id: string; nome: string }[];
}

export async function checkParceiroVinculos(
  parceiroId: string,
): Promise<ParceiroVinculo[]> {
  return withRetry(async () => {
    const vinculos: ParceiroVinculo[] = [];

    const { data: driversData, error: driversError } = await getSupabase()
      .from("drivers")
      .select("id, name")
      .eq("parceiro_id", parceiroId);

    if (driversError) throw driversError;

    if (driversData && driversData.length > 0) {
      vinculos.push({
        tabela: "Motoristas",
        campo: "parceiro_id",
        registros: driversData.map((d) => ({ id: d.id, nome: d.name })),
      });
    }

    return vinculos;
  });
}

export async function toggleParceiroStatus(
  id: string,
  currentStatus: "ativo" | "inativo",
): Promise<void> {
  const novoStatus = currentStatus === "ativo" ? "inativo" : "ativo";
  const { error } = await getSupabase()
    .from("parceiros_servico")
    .update({ status: novoStatus })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteParceiroFromDB(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("parceiros_servico")
    .update({ arquivado: true, status: "inativo" })
    .eq("id", id);

  if (error) throw error;
}

export async function unarchiveParceiroFromDB(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("parceiros_servico")
    .update({ arquivado: false })
    .eq("id", id);

  if (error) throw error;
}

// ── App Settings ────────────────────────────────────────

function getReadableErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export async function getAppSetting(key: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .single();

  if (error || !data) return null;
  return data.value;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  const { error } = await getSupabase()
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) {
    throw new Error(
      getReadableErrorMessage(error, "Falha ao salvar configuração atual."),
    );
  }
}

export async function getImpostoPercentual(): Promise<number> {
  return withRetry(async () => {
    const raw = await getAppSetting("imposto_percentual");
    const parsed = parseFloat(raw || "");
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
      ? parsed
      : 12;
  });
}

export async function getImpostoPercentualForDate(
  date: string,
): Promise<number> {
  return withRetry(async () => {
    const { data, error } = await getSupabase()
      .from("financial_config_history")
      .select("value")
      .eq("config_key", "imposto_percentual")
      .lte("effective_from", date)
      .order("effective_from", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Fallback para app_settings se não houver histórico
      return getImpostoPercentual();
    }

    const parsed = parseFloat(data.value || "");
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
      ? parsed
      : 12;
  });
}

export async function setFinancialConfig(
  key: string,
  value: string,
  effectiveFrom: string,
): Promise<void> {
  const supabase = getSupabase();

  const { data: existingConfig, error: findError } = await supabase
    .from("financial_config_history")
    .select("id")
    .eq("config_key", key)
    .eq("effective_from", effectiveFrom)
    .maybeSingle();

  if (findError) {
    throw new Error(
      getReadableErrorMessage(
        findError,
        "Falha ao consultar o histórico financeiro.",
      ),
    );
  }

  if (existingConfig?.id) {
    const { error: updateError } = await supabase
      .from("financial_config_history")
      .update({ value })
      .eq("id", existingConfig.id);

    if (updateError) {
      throw new Error(
        getReadableErrorMessage(
          updateError,
          "Falha ao atualizar o histórico financeiro.",
        ),
      );
    }
  } else {
    const { error: insertError } = await supabase
      .from("financial_config_history")
      .insert({ config_key: key, value, effective_from: effectiveFrom });

    if (insertError) {
      throw new Error(
        getReadableErrorMessage(
          insertError,
          "Falha ao salvar o histórico financeiro.",
        ),
      );
    }
  }

  // Atualiza o valor atual em app_settings para compatibilidade
  await setAppSetting(key, value);
}

// ── OS Logs ──────────────────────────────────────────────

export interface OSLog {
  id: string;
  os_id: string;
  type: string;
  actor_name: string;
  actor_id: string | null;
  actor_avatar_url: string | null;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function fetchOSCalendarRange({
  from,
  to,
  arquivado,
}: {
  from: string;
  to: string;
  arquivado?: boolean;
}): Promise<OrderService[]> {
  return withRetry(async () => {
    let query = getSupabase()
      .from("ordens_servico")
      .select(OS_SELECT_COLUMNS)
      .gte("data", from)
      .lte("data", to);

    if (arquivado !== undefined) {
      query = query.eq("arquivado", arquivado);
    } else {
      query = query.eq("arquivado", false);
    }
    query = query.neq("tipo", "rascunho");

    const { data: osRaw, error } = await query
      .order("data", { ascending: true })
      .order("hora", { ascending: true });

    if (error) throw error;

    const typedOrders = (osRaw || []) as unknown as OSRow[];
    const { wpRaw, wpPassRaw } = await fetchWaypointsForOSIds(
      typedOrders.map((o) => o.id),
    );
    const operationalCyclesByOS = await fetchOperationalCyclesForOSIds(
      getSupabase(),
      typedOrders.map((o) => o.id),
    );

    return typedOrders.map((o) =>
      mapOSRecord(o, wpRaw, wpPassRaw, operationalCyclesByOS[o.id]),
    );
  });
}

export type OSStatusCounts = {
  Pendente: number;
  Aguardando: number;
  "Em Rota": number;
  Finalizado: number;
  Cancelado: number;
};

export async function fetchOSStatusCounts(): Promise<OSStatusCounts> {
  return withRetry(async () => {
    const { data, error } = await getSupabase().rpc("get_os_status_counts");
    if (error) throw error;

    const counts: OSStatusCounts = {
      Pendente: 0,
      Aguardando: 0,
      "Em Rota": 0,
      Finalizado: 0,
      Cancelado: 0,
    };

    (data || []).forEach((row: { status: string; count: number }) => {
      if (row.status in counts) {
        counts[row.status as keyof OSStatusCounts] = Number(row.count);
      }
    });

    return counts;
  });
}

export type OSCalendarEvent = {
  id: string;
  protocolo: string;
  data: string;
  hora: string | null;
  statusOperacional: string;
  clienteId: string | null;
  motorista: string | null;
  driverId: string | null;
  veiculoId: string | null;
};

export async function fetchOSCalendarEvents({
  from,
  to,
}: {
  from: string;
  to: string;
}): Promise<OSCalendarEvent[]> {
  const { data, error } = await getSupabase().rpc("get_os_calendar_events", {
    p_from: from,
    p_to: to,
  });
  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    protocolo: row.protocolo as string,
    data: row.data as string,
    hora: (row.hora as string | null) || null,
    statusOperacional: row.status_operacional as string,
    clienteId: row.cliente_id as string | null,
    motorista: row.motorista as string | null,
    driverId: row.driver_id as string | null,
    veiculoId: row.veiculo_id as string | null,
  }));
}

export async function checkActiveOSForDriverVehicle(
  driverId: string,
  vehicleId: string,
  excludeOsId?: string | null,
): Promise<boolean> {
  const { data, error } = await getSupabase().rpc(
    "check_active_os_for_driver_vehicle",
    {
      p_driver_id: driverId,
      p_vehicle_id: vehicleId,
      p_exclude_os_id: excludeOsId || null,
    },
  );
  if (error) throw error;
  return Boolean(data);
}

export async function fetchOSFinanceStats(
  filters: FinanceQueryFilters = {},
): Promise<{
  totalOS: number;
  totalBruto: number;
  totalCusto: number;
  totalImposto: number;
  totalLucro: number;
  totalLiberadoFaturamento: number;
  totalFaturado: number;
  totalRecebido: number;
  totalPendente: number;
  totalCustoAutonomos: number;
  totalPagoAutonomos: number;
  totalCustoParceiros: number;
  totalPagoParceiros: number;
}> {
  return withRetry(async () => {
    const {
      month = "",
      dataInicio,
      dataFim,
      clienteId,
      centroCustoId,
      motorista,
      driverId,
      parceiroId,
      statusOperacional,
      statusFinanceiro,
    } = filters;

    let query = getSupabase()
      .from("ordens_servico")
      .select(
        "id, valor_bruto, custo, imposto, lucro, status_financeiro, status_operacional, data, motorista, driver_id, cliente_id, centro_custo_id, repasse_pago, tipo",
        { count: "exact" },
      )
      .eq("arquivado", false)
      .neq("tipo", "rascunho");

    if (month) {
      query = query
        .gte("data", `${month}-01`)
        .lt("data", getNextMonthFirstDay(month));
    }
    if (dataInicio) query = query.gte("data", dataInicio);
    if (dataFim) query = query.lt("data", getNextDay(dataFim));
    if (clienteId) query = query.eq("cliente_id", clienteId);
    if (centroCustoId) query = query.eq("centro_custo_id", centroCustoId);
    if (motorista)
      query = query.ilike("motorista", `%${sanitizeSearchTerm(motorista)}%`);
    if (driverId) query = query.eq("driver_id", driverId);
    if (statusOperacional)
      query = query.eq("status_operacional", statusOperacional);
    if (statusFinanceiro)
      query = query.eq("status_financeiro", statusFinanceiro);
    if (parceiroId) {
      const { data: driverRows, error: driverError } = await getSupabase()
        .from("drivers")
        .select("id")
        .eq("parceiro_id", parceiroId)
        .eq("status", "active");
      if (driverError) throw driverError;
      const driverIds = (driverRows || []).map((row) => row.id);
      if (driverIds.length === 0) {
        return {
          totalOS: 0,
          totalBruto: 0,
          totalCusto: 0,
          totalImposto: 0,
          totalLucro: 0,
          totalLiberadoFaturamento: 0,
          totalFaturado: 0,
          totalRecebido: 0,
          totalPendente: 0,
          totalCustoAutonomos: 0,
          totalPagoAutonomos: 0,
          totalCustoParceiros: 0,
          totalPagoParceiros: 0,
        };
      }
      query = query.in("driver_id", driverIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []) as Array<{
      valor_bruto: number | string | null;
      custo: number | string | null;
      imposto: number | string | null;
      lucro: number | string | null;
      status_financeiro: string | null;
      status_operacional: string | null;
      driver_id: string | null;
      repasse_pago: boolean | null;
      tipo: string | null;
    }>;

    const driverIds = [
      ...new Set(
        rows
          .map((row) => row.driver_id)
          .filter((id): id is string => id !== null),
      ),
    ];

    const { data: driversData, error: driversError } = await getSupabase()
      .from("drivers")
      .select("id, parceiro_id")
      .in("id", driverIds);

    if (driversError) throw driversError;

    const driverMap = new Map(
      (driversData || []).map((driver) => [driver.id, driver.parceiro_id]),
    );

    const summary = rows.reduce(
      (acc, row) => {
        const bruto = Number(row.valor_bruto || 0);
        const custo = Number(row.custo || 0);
        const imposto = Number(row.imposto || 0);
        const lucro = Number(row.lucro || 0);
        const statusFinanceiro = row.status_financeiro || "Pendente";
        const statusOperacional = row.status_operacional || "";
        const driverId = row.driver_id;
        const repassePago = row.repasse_pago || false;
        const isFreelance = row.tipo === "freelance";

        acc.totalOS += 1;
        acc.totalBruto += bruto;
        acc.totalCusto += custo;
        acc.totalImposto += imposto;
        acc.totalLucro += lucro;

        const isLiberadaFaturar = isLiberadoParaFaturamento(statusOperacional);
        if (isLiberadaFaturar && statusFinanceiro === "Pendente") {
          acc.totalLiberadoFaturamento += bruto;
        }
        if (statusFinanceiro === "Faturado") acc.totalFaturado += bruto;

        if (isFinanceStatusSettled(statusFinanceiro))
          acc.totalRecebido += bruto;
        if (statusFinanceiro === "Pendente") acc.totalPendente += bruto;

        if (driverId) {
          // OS Freelance sempre conta como Autônomo, independente do vínculo do motorista
          const parceiroId = isFreelance ? null : driverMap.get(driverId);
          if (parceiroId) {
            acc.totalCustoParceiros += custo;
            if (repassePago) acc.totalPagoParceiros += custo;
          } else {
            acc.totalCustoAutonomos += custo;
            if (repassePago) acc.totalPagoAutonomos += custo;
          }
        }

        return acc;
      },
      {
        totalOS: 0,
        totalBruto: 0,
        totalCusto: 0,
        totalImposto: 0,
        totalLucro: 0,
        totalLiberadoFaturamento: 0,
        totalFaturado: 0,
        totalRecebido: 0,
        totalPendente: 0,
        totalCustoAutonomos: 0,
        totalPagoAutonomos: 0,
        totalCustoParceiros: 0,
        totalPagoParceiros: 0,
      },
    );

    return {
      totalOS: summary.totalOS,
      totalBruto: summary.totalBruto,
      totalCusto: summary.totalCusto,
      totalImposto: summary.totalImposto,
      totalLucro: summary.totalLucro,
      totalLiberadoFaturamento: summary.totalLiberadoFaturamento,
      totalFaturado: summary.totalFaturado,
      totalRecebido: summary.totalRecebido,
      totalPendente: summary.totalPendente,
      totalCustoAutonomos: summary.totalCustoAutonomos,
      totalPagoAutonomos: summary.totalPagoAutonomos,
      totalCustoParceiros: summary.totalCustoParceiros,
      totalPagoParceiros: summary.totalPagoParceiros,
    };
  });
}

export async function fetchOSLogs(osId: string): Promise<OSLog[]> {
  return withRetry(async () => {
    const { data, error } = await getSupabase()
      .from("os_logs")
      .select(
        "id, os_id, type, actor_name, actor_id, actor_avatar_url, description, metadata, created_at",
      )
      .eq("os_id", osId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = (data || []) as Array<{
      id: string;
      os_id: string;
      type: string;
      actor_name: string;
      actor_id: string | null;
      actor_avatar_url: string | null;
      description: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>;

    const uniqueActorIds = [
      ...new Set(
        rows.map((row) => row.actor_id).filter((id): id is string => !!id),
      ),
    ];

    let profileMap = new Map<
      string,
      { nome: string | null; avatar_url: string | null }
    >();

    if (uniqueActorIds.length > 0) {
      try {
        const { data: profiles } = await getSupabase()
          .from("user_roles")
          .select("id, nome, avatar_url")
          .in("id", uniqueActorIds);

        profileMap = new Map(
          (profiles || []).map((profile) => [
            profile.id,
            {
              nome: profile.nome ?? null,
              avatar_url: profile.avatar_url ?? null,
            },
          ]),
        );
      } catch {
        profileMap = new Map();
      }
    }

    return rows.map((row) => {
      const profile = row.actor_id ? profileMap.get(row.actor_id) : undefined;

      return {
        id: row.id,
        os_id: row.os_id,
        type: row.type,
        actor_name: profile?.nome || row.actor_name,
        actor_id: row.actor_id,
        actor_avatar_url: profile?.avatar_url ?? row.actor_avatar_url,
        description: row.description,
        metadata: row.metadata || {},
        created_at: row.created_at,
      };
    });
  });
}

// ── Chat Functions ──────────────────────────────────────────

type ChatConversationWithParticipantsRow = {
  id: string;
  type: "direct" | "group";
  title: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  chat_participants: ChatParticipantRow[];
};

type ChatParticipantRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string | null;
  is_admin: boolean;
};

type ChatMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_avatar: string | null;
  content: string;
  message_type: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
  reply_to_id: string | null;
};

export async function fetchChatConversations(): Promise<
  import("@/context/DataContext").ChatConversation[]
> {
  return withRetry(async () => {
    const { data, error } = await getSupabase()
      .from("chat_conversations")
      .select(
        `
        id,
        type,
        title,
        created_by,
        created_at,
        updated_at,
        chat_participants(
          id,
          conversation_id,
          user_id,
          joined_at,
          last_read_at,
          is_admin
        )
      `,
      )
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((conv: ChatConversationWithParticipantsRow) => ({
      id: conv.id,
      type: conv.type,
      title: conv.title || undefined,
      created_by: conv.created_by || undefined,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      participants: conv.chat_participants?.map((p: ChatParticipantRow) => ({
        id: p.id,
        conversation_id: p.conversation_id,
        user_id: p.user_id,
        user_name: undefined,
        user_avatar: undefined,
        joined_at: p.joined_at,
        last_read_at: p.last_read_at || undefined,
        is_admin: p.is_admin,
      })),
    }));
  });
}

export async function fetchChatMessages(
  conversationId: string,
): Promise<import("@/context/DataContext").ChatMessage[]> {
  return withRetry(async () => {
    const { data, error } = await getSupabase()
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return (data || []).map((msg: ChatMessageRow) => ({
      id: msg.id,
      conversation_id: msg.conversation_id,
      sender_id: msg.sender_id,
      sender_name: msg.sender_name,
      sender_avatar: msg.sender_avatar,
      content: msg.content,
      message_type: msg.message_type as "text" | "image" | "file" | "system",
      created_at: msg.created_at,
      updated_at: msg.updated_at,
      is_edited: msg.is_edited,
      reply_to_id: msg.reply_to_id,
    }));
  });
}

export async function createChatConversation(
  type: "direct" | "group",
  title?: string,
  participantIds: string[] = [],
  createdBy?: string,
): Promise<string> {
  return withRetry(async () => {
    const supabase = getSupabase();
    const { data: convData, error: convError } = await supabase
      .from("chat_conversations")
      .insert({
        type,
        title: type === "group" ? title : null,
        created_by: createdBy ?? null,
      })
      .select()
      .single();

    if (convError) throw convError;

    const conversationId = convData.id;

    if (participantIds.length > 0) {
      const participants = participantIds.map((userId) => ({
        conversation_id: conversationId,
        user_id: userId,
      }));

      const { error: partError } = await supabase
        .from("chat_participants")
        .insert(participants);

      if (partError) throw partError;
    }

    return conversationId;
  });
}

export async function findExistingDirectConversation(
  userId1: string,
  userId2: string,
): Promise<string | null> {
  return withRetry(async () => {
    const { data, error } = await getSupabase()
      .from("chat_conversations")
      .select(
        `
        id,
        chat_participants(user_id)
      `,
      )
      .eq("type", "direct")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const conversations = data || [];
    for (const conv of conversations) {
      const participants = conv.chat_participants || [];
      if (participants.length === 2) {
        const participantIds = participants.map(
          (p: { user_id: string }) => p.user_id,
        );
        if (
          participantIds.includes(userId1) &&
          participantIds.includes(userId2)
        ) {
          return conv.id;
        }
      }
    }

    return null;
  });
}

export async function createChatMessage(
  conversationId: string,
  senderId: string,
  content: string,
  messageType: "text" | "image" | "file" | "system" = "text",
  replyToId?: string,
): Promise<import("@/context/DataContext").ChatMessage> {
  return withRetry(async () => {
    const { data, error } = await getSupabase()
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        message_type: messageType,
        reply_to_id: replyToId,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      conversation_id: data.conversation_id,
      sender_id: data.sender_id,
      sender_name: data.sender_name,
      sender_avatar: data.sender_avatar,
      content: data.content,
      message_type: data.message_type as "text" | "image" | "file" | "system",
      created_at: data.created_at,
      updated_at: data.updated_at,
      is_edited: data.is_edited,
      reply_to_id: data.reply_to_id,
    };
  });
}

export async function updateChatParticipantLastRead(
  conversationId: string,
  userId: string,
): Promise<void> {
  return withRetry(async () => {
    const { error } = await getSupabase()
      .from("chat_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);

    if (error) throw error;
  });
}

export async function addChatParticipant(
  conversationId: string,
  userId: string,
): Promise<void> {
  return withRetry(async () => {
    const { error } = await getSupabase().from("chat_participants").insert({
      conversation_id: conversationId,
      user_id: userId,
    });

    if (error) throw error;
  });
}

export async function getConversationUnreadCount(
  conversationId: string,
  userId: string,
): Promise<number> {
  return withRetry(async () => {
    const { data: participant } = await getSupabase()
      .from("chat_participants")
      .select("last_read_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .single();

    if (!participant) return 0;

    const lastReadAt = participant.last_read_at;

    const { count, error } = await getSupabase()
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .gt("created_at", lastReadAt || "1970-01-01");

    if (error) throw error;

    return count || 0;
  });
}

export async function getUserConversationsWithUnread(
  userId: string,
): Promise<
  Array<
    import("@/context/DataContext").ChatConversation & { unreadCount: number }
  >
> {
  return withRetry(async () => {
    const conversations = await fetchChatConversations();

    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await getConversationUnreadCount(conv.id, userId);
        return { ...conv, unreadCount };
      }),
    );

    return conversationsWithUnread;
  });
}

export async function fetchChatUsers(
  currentUserId: string,
): Promise<Array<{ id: string; name: string; avatar?: string }>> {
  return withRetry(async () => {
    type ChatUserRow = {
      id: string;
      nome: string | null;
      avatar_url: string | null;
    };

    const { data, error } = await getSupabase()
      .from("user_roles")
      .select("id, nome, avatar_url")
      .neq("id", currentUserId)
      .order("nome");

    if (error) throw error;

    return ((data || []) as ChatUserRow[]).map((user) => ({
      id: user.id,
      name: user.nome || "Usuário",
      avatar: user.avatar_url ?? undefined,
    }));
  });
}

export async function fetchUsersByIds(
  userIds: string[],
): Promise<Map<string, { name: string; avatar?: string }>> {
  if (userIds.length === 0) return new Map();

  return withRetry(async () => {
    type ChatUserRow = {
      id: string;
      nome: string | null;
      avatar_url: string | null;
    };

    const { data, error } = await getSupabase()
      .from("user_roles")
      .select("id, nome, avatar_url")
      .in("id", userIds);

    if (error) throw error;

    const userMap = new Map<string, { name: string; avatar?: string }>();
    ((data || []) as ChatUserRow[]).forEach((user) => {
      userMap.set(user.id, {
        name: user.nome || "Usuário",
        avatar: user.avatar_url ?? undefined,
      });
    });

    return userMap;
  });
}

// Funções para gerenciar avisos do sistema
export async function fetchActiveAnnouncements(): Promise<
  Array<{
    id: string;
    title: string;
    subtitle: string | null;
    message: string;
    type: "info" | "warning" | "error" | "success";
    created_at: string;
    updated_at: string;
    expires_at: string | null;
  }>
> {
  return withRetry(async () => {
    const { data, error } = await getSupabase()
      .from("system_announcements")
      .select(
        "id, title, subtitle, message, type, created_at, updated_at, expires_at",
      )
      .eq("is_active", true)
      .or("expires_at.is.null,expires_at.gte.now()")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as Array<{
      id: string;
      title: string;
      subtitle: string | null;
      message: string;
      type: "info" | "warning" | "error" | "success";
      created_at: string;
      updated_at: string;
      expires_at: string | null;
    }>;
  });
}

export async function fetchAllAnnouncements(): Promise<
  Array<{
    id: string;
    title: string;
    subtitle: string | null;
    message: string;
    type: "info" | "warning" | "error" | "success";
    is_active: boolean;
    created_at: string;
    updated_at: string;
    expires_at: string | null;
    created_by: string | null;
  }>
> {
  return withRetry(async () => {
    const { data, error } = await getSupabase()
      .from("system_announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as Array<{
      id: string;
      title: string;
      subtitle: string | null;
      message: string;
      type: "info" | "warning" | "error" | "success";
      is_active: boolean;
      created_at: string;
      updated_at: string;
      expires_at: string | null;
      created_by: string | null;
    }>;
  });
}

export async function createAnnouncement(
  title: string,
  subtitle: string | null,
  message: string,
  type: "info" | "warning" | "error" | "success" = "info",
  expiresAt?: string,
  createdBy?: string,
): Promise<{ id: string }> {
  const { data, error } = await getSupabase()
    .from("system_announcements")
    .insert({
      title,
      subtitle,
      message,
      type,
      expires_at: expiresAt || null,
      created_by: createdBy || null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id };
}

export async function updateAnnouncement(
  id: string,
  updates: {
    title?: string;
    subtitle?: string | null;
    message?: string;
    type?: "info" | "warning" | "error" | "success";
    is_active?: boolean;
    expires_at?: string | null;
  },
): Promise<void> {
  const { error } = await getSupabase()
    .from("system_announcements")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("system_announcements")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
