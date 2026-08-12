import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  PDFDocument,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
  PDFFont,
  RGB,
} from "pdf-lib";
import {
  isFinanceStatusSettled,
  isLiberadoParaFaturamento,
  sanitizeFinanceFileName,
  parseHoraExtraMinutes,
  calcHoraExtraCliente,
  calcHoraExtraMotorista,
  calcBilledMinutes,
  formatBilledHours,
  getNextDay,
} from "@/lib/financeiro";
import { fetchInChunks } from "@/lib/supabase/chunked-in-query";
import ExcelJS from "exceljs";

export const runtime = "edge";

const LOGO_BASE64 =
  "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";

export type ReportTemplate =
  | "medicao_cliente"
  | "repasse_motorista"
  | "resumo_motoristas"
  | "performance"
  | "liberadas_faturamento"
  | "pendentes_repasse";

export type ReportFormat = "pdf" | "csv" | "xlsx";

type RepasseStatusFilter = "all" | "pending" | "paid";

type FinanceFilters = {
  template?: ReportTemplate;
  format?: ReportFormat;
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
  searchTerm?: string;
  repasseStatusFilter?: RepasseStatusFilter;
  /**
   * Modo Seleção: quando ativo e com `selectedOsIds` não vazio, a query
   * busca apenas as OS cujos IDs estão na lista, ignorando o filtro
   * automático de período/status do template. Atualmente aplicável
   * apenas ao template `medicao_cliente`, mas modelado de forma genérica
   * para suportar expansão.
   */
  selectionMode?: boolean;
  selectedOsIds?: string[];
};

type FinanceRow = {
  id: string;
  protocolo: string | null;
  os_number: string | null;
  data: string | null;
  cliente_id: string | null;
  centro_custo_id: string | null;
  solicitante: string | null;
  motorista: string | null;
  driver_id: string | null;
  veiculo_id: string | null;
  valor_bruto: number | string | null;
  custo: number | string | null;
  hora_extra: string | null;
  no_show: boolean | null;
  no_show_percentual: number | null;
  imposto: number | string | null;
  lucro: number | string | null;
  status_financeiro: string | null;
  status_operacional: string | null;
  repasse_pago: boolean | null;
  tipo: string | null;
  isento_valor_bruto: boolean | null;
  isento_custo: boolean | null;
};

type DriverDetail = {
  id: string;
  name: string;
  parceiro_id: string | null;
  vinculo_tipo: string | null;
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

type ReportWaypoint = OSWaypointRow & {
  passengers: { id: string; nome: string }[];
};

type ReportData = {
  rows: FinanceRow[];
  clienteMap: Map<string, string>;
  centroCustoMap: Map<string, string>;
  driverMap: Map<string, string>;
  driverDetailMap: Map<string, DriverDetail>;
  parceiroMap: Map<string, string>;
  vehicleMap: Map<string, string>;
  waypointsMap: Map<string, ReportWaypoint[]>;
  passengerNamesMap: Map<string, string>;
  summary: ReportSummary;
  periodLabel: string;
};

type ReportSummary = {
  totalOS: number;
  totalCentrosCusto: number;
  totalSolicitantes: number;
  totalPassageiros: number;
  totalWaypoints: number;
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
  // Valor efetivo cobrado do cliente (valor_bruto + hora_extra - no_show)
  totalEfetivo: number;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

/** Formata valor monetário ou retorna "Isento" se a OS tem flag ativo. */
function formatCurrencyOrIsento(
  value: number,
  isento: boolean | null | undefined,
): string {
  if (isento) return "Isento";
  return formatCurrency(value);
}

/**
 * Calcula o valor efetivo cobrado do cliente para uma OS:
 * (valor_bruto + hora_extra_cliente) × fator_no_show
 * Espelha a mesma lógica usada em queries.ts ao salvar/editar uma OS.
 */
function calcEffectiveClientValue(row: FinanceRow): number {
  const vBruto = Number(row.valor_bruto || 0);
  const heCliente = calcHoraExtraCliente(parseHoraExtraMinutes(row.hora_extra));
  const total = vBruto + heCliente;
  if (row.no_show) {
    const fator = (row.no_show_percentual ?? 100) / 100;
    return total * fator;
  }
  return total;
}

/**
 * Calcula o valor efetivo do repasse (custo) ao motorista/parceiro para uma OS:
 * (custo + hora_extra_motorista) × fator_no_show
 * Espelha a lógica usada em ValorCell (FinanceiroTable.tsx) e queries.ts.
 */
function calcEffectiveCustoValue(row: FinanceRow): number {
  const vCusto = Number(row.custo || 0);
  const heMotorista = calcHoraExtraMotorista(
    parseHoraExtraMinutes(row.hora_extra),
  );
  const total = vCusto + heMotorista;
  if (row.no_show) {
    const fator = (row.no_show_percentual ?? 100) / 100;
    return total * fator;
  }
  return total;
}

/**
 * Classifica o vínculo de uma OS com o motorista: Freelance (sempre que
 * `tipo === "freelance"`, independente do vínculo do motorista), Parceiro
 * (motorista com parceiro_id), Interno (vinculo_tipo === "interno") ou
 * Autônomo (default). Usada no Repasse a Motoristas e no Resumo Geral.
 */
function getRowVinculoTipo(
  row: Pick<FinanceRow, "tipo">,
  driverDetail: DriverDetail | undefined,
): "Freelance" | "Parceiro" | "Interno" | "Autônomo" {
  if (row.tipo === "freelance") return "Freelance";
  if (driverDetail?.parceiro_id) return "Parceiro";
  if (driverDetail?.vinculo_tipo === "interno") return "Interno";
  return "Autônomo";
}

function createAdminClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );
}

const parseFilters = (request: Request): FinanceFilters => {
  const url = new URL(request.url);
  const repasseStatusFilter = url.searchParams.get("repasseStatusFilter");
  const selectionModeRaw = url.searchParams.get("selectionMode");
  const selectedOsIdsRaw = url.searchParams.get("selectedOsIds") || "";
  const selectedOsIds = selectedOsIdsRaw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return {
    template:
      (url.searchParams.get("template") as ReportTemplate) || "medicao_cliente",
    format: (url.searchParams.get("format") as ReportFormat) || "pdf",
    month: url.searchParams.get("month") || undefined,
    dataInicio: url.searchParams.get("dataInicio") || undefined,
    dataFim: url.searchParams.get("dataFim") || undefined,
    clienteId: url.searchParams.get("clienteId") || undefined,
    centroCustoId: url.searchParams.get("centroCustoId") || undefined,
    motorista: url.searchParams.get("motorista") || undefined,
    driverId: url.searchParams.get("driverId") || undefined,
    parceiroId: url.searchParams.get("parceiroId") || undefined,
    statusOperacional: url.searchParams.get("statusOperacional") || undefined,
    statusFinanceiro: url.searchParams.get("statusFinanceiro") || undefined,
    searchTerm: url.searchParams.get("searchTerm") || undefined,
    repasseStatusFilter:
      repasseStatusFilter === "pending" || repasseStatusFilter === "paid"
        ? repasseStatusFilter
        : "all",
    selectionMode: selectionModeRaw === "true" && selectedOsIds.length > 0,
    selectedOsIds: selectedOsIds.length > 0 ? selectedOsIds : undefined,
  };
};

const getNextMonthFirstDay = (month: string): string => {
  const [year, monthNum] = month.split("-").map(Number);
  if (monthNum === 12) return `${year + 1}-01-01`;
  return `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;
};

const sanitizeSearchTerm = (term: string): string => {
  return term
    .trim()
    .slice(0, 100)
    .replace(/[%_]/g, "\\$&")
    .replace(/[(),]/g, "");
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatDate = (value?: string | null): string => {
  if (!value) return "-";
  // Strings no formato YYYY-MM-DD (sem timezone) devem ser tratadas como
  // data local para evitar o off-by-one do construtor Date que assume UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  // Timestamps completos: sempre no fuso de Brasília, independente do UTC
  // do servidor (Cloudflare Worker roda em UTC).
  return new Date(value).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
};

const formatDateTime = (data?: string | null, hora?: string | null): string => {
  const parts: string[] = [];

  if (data) parts.push(formatDate(data));
  if (hora) parts.push(hora.slice(0, 5));

  return parts.length > 0 ? parts.join(" ") : "-";
};

const truncateText = (
  text: string | null | undefined,
  maxLength: number,
): string => {
  const safeText = text || "";
  if (safeText.length <= maxLength) return safeText;
  return safeText.substring(0, maxLength - 3) + "...";
};

/**
 * Sanitizes text for pdf-lib StandardFonts (WinAnsi encoding).
 * Replaces characters outside the Windows-1252 range with ASCII equivalents
 * so that widthOfTextAtSize / drawText never throw an encoding error.
 */
const sanitizePdfText = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'") // curly single quotes → '
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"') // curly double quotes → "
    .replace(/[\u2013\u2014\u2015]/g, "-") // en/em dash → -
    .replace(/\u2026/g, "...") // ellipsis → ...
    .replace(/\u00A0/g, " ") // non-breaking space → space
    .replace(/[^\x00-\xFF]/g, "?"); // any remaining non-Latin → ?
};

async function fetchReportData(
  filters: FinanceFilters,
  template: ReportTemplate,
  adminClient: ReturnType<typeof createAdminClient>,
): Promise<ReportData> {
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
    searchTerm,
    repasseStatusFilter = "all",
    selectionMode = false,
    selectedOsIds = [],
  } = filters;

  let query = adminClient
    .from("ordens_servico")
    .select(
      "id, protocolo, os_number, data, cliente_id, centro_custo_id, solicitante, motorista, driver_id, veiculo_id, valor_bruto, custo, hora_extra, no_show, no_show_percentual, imposto, lucro, status_financeiro, status_operacional, repasse_pago, tipo, isento_valor_bruto, isento_custo",
    )
    .eq("arquivado", false);

  // ── Modo Seleção ────────────────────────────────────────────────────
  // Quando ativo, o relatório inclui APENAS as OS marcadas manualmente,
  // ignorando o filtro automático de período e os filtros específicos do
  // template. Mantemos `cliente_id` (quando informado) como trava de
  // segurança para evitar vazamento cross-cliente.
  //
  // Chunking: com centenas de UUIDs, `.in("id", [...])` gera uma URL
  // longa demais para o PostgREST. Dividimos em lotes de 100 e unimos
  // os resultados, preservando a ordenação por data.
  const SELECTION_CHUNK_SIZE = 200;

  let rows: FinanceRow[];

  if (selectionMode && selectedOsIds.length > 0) {
    const chunks: string[][] = [];
    for (let i = 0; i < selectedOsIds.length; i += SELECTION_CHUNK_SIZE) {
      chunks.push(selectedOsIds.slice(i, i + SELECTION_CHUNK_SIZE));
    }

    const chunkResults = await Promise.all(
      chunks.map(async (chunk) => {
        let q = adminClient
          .from("ordens_servico")
          .select(
            "id, protocolo, os_number, data, cliente_id, centro_custo_id, solicitante, motorista, driver_id, veiculo_id, valor_bruto, custo, hora_extra, no_show, no_show_percentual, imposto, lucro, status_financeiro, status_operacional, repasse_pago, tipo, isento_valor_bruto, isento_custo",
          )
          .eq("arquivado", false)
          .in("id", chunk);
        if (clienteId) q = q.eq("cliente_id", clienteId);
        const { data, error } = await q.order("data", { ascending: true });
        if (error) throw error;
        return (data || []) as FinanceRow[];
      }),
    );

    rows = chunkResults.flat();
    // Reordenar após merge dos chunks (cada chunk já vem ordenado por data,
    // mas a intercalação entre chunks precisa de uma ordenação final).
    rows.sort((a, b) => {
      const da = a.data || "";
      const db = b.data || "";
      return da < db ? -1 : da > db ? 1 : 0;
    });
  } else {
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

    if (template === "liberadas_faturamento") {
      query = query
        .eq("status_operacional", "Finalizado")
        .eq("status_financeiro", "Pendente");
    } else if (template === "pendentes_repasse") {
      query = query.eq("repasse_pago", false);
    } else if (template === "repasse_motorista") {
      query = query.eq("status_operacional", "Finalizado");
    } else if (template === "resumo_motoristas") {
      // Resumo geral: todas as OS finalizadas no período, de todos os
      // motoristas (autônomos, internos e parceiros). A consolidação por
      // motorista acontece depois, no gerador do relatório.
      query = query.eq("status_operacional", "Finalizado");
    } else {
      if (statusOperacional)
        query = query.eq("status_operacional", statusOperacional);
      if (statusFinanceiro)
        query = query.eq("status_financeiro", statusFinanceiro);
    }

    if (template === "repasse_motorista" && repasseStatusFilter !== "all") {
      query = query.eq("repasse_pago", repasseStatusFilter === "paid");
    }

    if (searchTerm) {
      const likeTerm = `%${sanitizeSearchTerm(searchTerm)}%`;
      query = query.or(
        `os_number.ilike.${likeTerm},motorista.ilike.${likeTerm}`,
      );
    }

    if (parceiroId) {
      const { data: driverRows, error: driverError } = await adminClient
        .from("drivers")
        .select("id")
        .eq("parceiro_id", parceiroId)
        .eq("status", "active");
      if (driverError) throw driverError;
      const ids = (driverRows || []).map((row) => row.id);
      if (ids.length === 0) return emptyReportData(dataInicio, dataFim, month);
      query = query.in("driver_id", ids);
    }

    const { data: rowsRaw, error: rowsError } = await query.order("data", {
      ascending: true,
    });
    if (rowsError) throw rowsError;
    rows = (rowsRaw || []) as FinanceRow[];
  }

  const osIds = rows.map((r) => r.id);
  const waypointsMap = new Map<string, ReportWaypoint[]>();
  const passengerNamesMap = new Map<string, string>();

  // ── Coletar IDs de entidades relacionadas (disponíveis desde já) ──
  // Estas fetches só dependem de `rows` e podem rodar em paralelo com
  // a árvore de waypoints (que é sequencial: wp → wp_pass → passageiros).
  const clientIds = Array.from(
    new Set(rows.map((row) => row.cliente_id).filter(Boolean) as string[]),
  );
  const centerIds = Array.from(
    new Set(rows.map((row) => row.centro_custo_id).filter(Boolean) as string[]),
  );
  const driverIds = Array.from(
    new Set(rows.map((row) => row.driver_id).filter(Boolean) as string[]),
  );
  const vehicleIds = Array.from(
    new Set(rows.map((row) => row.veiculo_id).filter(Boolean) as string[]),
  );

  // Chunk size maior: UUIDs têm 36 chars + vírgula = 37 bytes. 200 UUIDs
  // = ~7.4KB, ainda dentro do limite do PostgREST (~8KB de URL).
  const FETCH_CHUNK = 200;

  // ── Disparar fetches independentes em paralelo ──────────────────────
  const relatedEntitiesPromise = (async () => {
    const [clientesRes, centrosRes, driversRes, veiculosRes] =
      await Promise.all([
        clientIds.length > 0
          ? adminClient.from("clientes").select("id, nome").in("id", clientIds)
          : Promise.resolve({
              data: [] as Array<{ id: string; nome: string }>,
            }),
        centerIds.length > 0
          ? adminClient
              .from("centros_custo")
              .select("id, nome")
              .in("id", centerIds)
          : Promise.resolve({
              data: [] as Array<{ id: string; nome: string }>,
            }),
        driverIds.length > 0
          ? adminClient
              .from("drivers")
              .select("id, name, parceiro_id, vinculo_tipo")
              .in("id", driverIds)
          : Promise.resolve({ data: [] as Array<DriverDetail> }),
        vehicleIds.length > 0
          ? adminClient
              .from("veiculos")
              .select("id, placa, modelo")
              .in("id", vehicleIds)
          : Promise.resolve({
              data: [] as Array<{ id: string; placa: string; modelo: string }>,
            }),
      ]);

    const driverParceiroIds = (driversRes.data || [])
      .filter((d) => d.parceiro_id)
      .map((d) => d.parceiro_id) as string[];

    const parceirosRes =
      driverParceiroIds.length > 0
        ? await adminClient
            .from("parceiros_servico")
            .select("id, razao_social_ou_nome_completo")
            .in("id", [...new Set(driverParceiroIds)])
        : { data: [] };

    return { clientesRes, centrosRes, driversRes, veiculosRes, parceirosRes };
  })();

  // ── Árvore de waypoints (sequencial: wp → wp_pass → passageiros) ────
  if (osIds.length > 0) {
    const wpRows = await fetchInChunks<OSWaypointRow>(
      adminClient,
      "os_waypoints",
      "ordem_servico_id",
      osIds,
      "id, ordem_servico_id, position, label, lat, lng, comment, itinerary_index, hora, data",
      "position",
      FETCH_CHUNK,
    );
    const wpIds = wpRows.map((w) => w.id);

    const wpPassRows =
      wpIds.length > 0
        ? await fetchInChunks<OSWaypointPassengerRow>(
            adminClient,
            "os_waypoint_passengers",
            "waypoint_id",
            wpIds,
            "id, waypoint_id, passageiro_id",
            undefined,
            FETCH_CHUNK,
          )
        : [];

    const passengerIds = Array.from(
      new Set(
        wpPassRows
          .map((p) => p.passageiro_id)
          .filter((id): id is string => !!id),
      ),
    );

    // Fetch passenger names
    if (passengerIds.length > 0) {
      const passData = await fetchInChunks<{
        id: string;
        nome_completo: string;
      }>(
        adminClient,
        "passageiros",
        "id",
        passengerIds,
        "id, nome_completo",
        undefined,
        FETCH_CHUNK,
      );
      passData.forEach((p: { id: string; nome_completo: string }) => {
        passengerNamesMap.set(p.id, p.nome_completo);
      });
    }

    // Organize waypoints and passengers
    const wpWithPassMap = new Map<string, string[]>(); // waypointId -> passengerIds
    wpPassRows.forEach((p) => {
      if (p.passageiro_id) {
        const list = wpWithPassMap.get(p.waypoint_id) || [];
        list.push(p.passageiro_id);
        wpWithPassMap.set(p.waypoint_id, list);
      }
    });

    wpRows.forEach((wp) => {
      const list = waypointsMap.get(wp.ordem_servico_id) || [];
      const passIds = wpWithPassMap.get(wp.id) || [];
      list.push({
        ...wp,
        passengers: passIds.map((pid) => ({
          id: pid,
          nome: passengerNamesMap.get(pid) || "",
        })),
      });
      waypointsMap.set(wp.ordem_servico_id, list);
    });
  }

  // ── Aguardar fetches paralelas das entidades relacionadas ───────────
  const { clientesRes, centrosRes, driversRes, veiculosRes, parceirosRes } =
    await relatedEntitiesPromise;

  const clientes = clientesRes.data;
  const centrosCusto = centrosRes.data;
  const drivers = driversRes.data;
  const veiculosRaw = veiculosRes.data;
  const parceirosRaw = parceirosRes.data;

  const clienteMap = new Map(
    (clientes || []).map((item) => [item.id, item.nome]),
  );
  const centroCustoMap = new Map(
    (centrosCusto || []).map((item) => [item.id, item.nome]),
  );
  const driverMap = new Map(
    (drivers || []).map((item) => [item.id, item.name]),
  );
  const driverDetailMap = new Map(
    (drivers || []).map((item) => [item.id, item]),
  );
  const parceiroMap = new Map(
    (parceirosRaw || []).map((item: Record<string, unknown>) => [
      item.id as string,
      (item.razao_social_ou_nome_completo as string) || "",
    ]),
  );
  const vehicleMap = new Map(
    (veiculosRaw || []).map((item: Record<string, unknown>) => {
      const placa = (item.placa as string) || "";
      const modelo = (item.modelo as string) || "";
      return [
        item.id as string,
        placa && modelo ? `${placa} - ${modelo}` : placa || modelo || "-",
      ];
    }),
  );

  if (template === "repasse_motorista") {
    // Relatório único de repasse: inclui qualquer OS finalizada com um
    // motorista vinculado (autônomo, interno, parceiro ou freelance),
    // independente do vínculo dele mudar ao longo do período. A coluna
    // TIPO no relatório mostra a classificação de cada OS individualmente.
    rows = rows.filter((row) => {
      if (row.isento_custo) return false;
      return Boolean(row.driver_id);
    });
  } else if (template === "pendentes_repasse") {
    rows = rows.filter((row) => !row.isento_custo);
  } else if (template === "resumo_motoristas") {
    // Resumo geral: inclui todas as OS finalizadas que tenham um driver
    // associado (autônomos, internos, parceiros e freelance). Exclui
    // isentas de custo. A consolidação por motorista acontece no gerador.
    rows = rows.filter((row) => {
      if (row.isento_custo) return false;
      return Boolean(row.driver_id);
    });
  }

  const summary = computeSummary(rows, driverDetailMap, waypointsMap);
  const periodLabel = month
    ? month
    : dataInicio && dataFim
      ? `${formatDate(dataInicio)} a ${formatDate(dataFim)}`
      : "Período";

  return {
    rows,
    clienteMap,
    centroCustoMap,
    driverMap,
    driverDetailMap,
    parceiroMap,
    vehicleMap,
    waypointsMap,
    passengerNamesMap,
    summary,
    periodLabel,
  };
}

function emptyReportData(
  dataInicio?: string,
  dataFim?: string,
  month?: string,
): ReportData {
  return {
    rows: [],
    clienteMap: new Map(),
    centroCustoMap: new Map(),
    driverMap: new Map(),
    driverDetailMap: new Map(),
    parceiroMap: new Map(),
    vehicleMap: new Map(),
    waypointsMap: new Map(),
    passengerNamesMap: new Map(),
    summary: {
      totalOS: 0,
      totalCentrosCusto: 0,
      totalSolicitantes: 0,
      totalPassageiros: 0,
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
      totalWaypoints: 0,
      totalEfetivo: 0,
    },
    periodLabel:
      month ||
      (dataInicio && dataFim
        ? `${formatDate(dataInicio)} a ${formatDate(dataFim)}`
        : "Período"),
  };
}

function computeSummary(
  rows: FinanceRow[],
  driverDetailMap: Map<string, DriverDetail>,
  waypointsMap: Map<string, ReportWaypoint[]>,
): ReportSummary {
  const centroCustoIds = new Set<string>();
  const solicitanteNames = new Set<string>();
  const passengerIds = new Set<string>();
  let totalWaypoints = 0;

  rows.forEach((row) => {
    if (row.centro_custo_id) centroCustoIds.add(row.centro_custo_id);
    if (row.solicitante?.trim()) solicitanteNames.add(row.solicitante.trim());

    const waypoints = waypointsMap.get(row.id) || [];
    totalWaypoints += waypoints.length;
    waypoints.forEach((waypoint) => {
      waypoint.passengers.forEach((passenger) => {
        if (passenger.id) passengerIds.add(passenger.id);
      });
    });
  });

  return rows.reduce(
    (acc, row) => {
      const bruto = Number(row.valor_bruto || 0);
      const custo = calcEffectiveCustoValue(row);
      const imposto = Number(row.imposto || 0);
      const lucro = Number(row.lucro || 0);
      const statusFinanceiro = row.status_financeiro || "Pendente";
      const statusOperacional = row.status_operacional || "";
      const driverId = row.driver_id;
      const repassePago = row.repasse_pago || false;

      acc.totalOS += 1;
      acc.totalCentrosCusto = centroCustoIds.size;
      acc.totalSolicitantes = solicitanteNames.size;
      acc.totalPassageiros = passengerIds.size;
      acc.totalWaypoints = totalWaypoints;
      acc.totalBruto += bruto;
      acc.totalEfetivo += calcEffectiveClientValue(row);
      acc.totalCusto += custo;
      acc.totalImposto += imposto;
      acc.totalLucro += lucro;

      if (
        isLiberadoParaFaturamento(statusOperacional) &&
        statusFinanceiro === "Pendente"
      ) {
        acc.totalLiberadoFaturamento += bruto;
      }
      if (statusFinanceiro === "Faturado") acc.totalFaturado += bruto;
      if (isFinanceStatusSettled(statusFinanceiro)) acc.totalRecebido += bruto;
      if (statusFinanceiro === "Pendente") acc.totalPendente += bruto;

      if (driverId) {
        const driver = driverDetailMap.get(driverId);
        // OS Freelance sempre conta como Autônomo, independente do vínculo do motorista
        const isFreelance = row.tipo === "freelance";
        if (!isFreelance && driver && driver.parceiro_id) {
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
      totalCentrosCusto: 0,
      totalSolicitantes: 0,
      totalPassageiros: 0,
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
      totalWaypoints: 0,
      totalEfetivo: 0,
    },
  );
}

function generateCsv(
  data: ReportData,
  template: ReportTemplate,
  filters: FinanceFilters,
): Response {
  const {
    rows,
    clienteMap,
    centroCustoMap,
    driverMap,
    driverDetailMap,
    parceiroMap,
    vehicleMap,
  } = data;

  // Determina se a coluna PARCEIRO deve aparecer no CSV (mesma lógica
  // do Excel e PDF).
  const showParceiroColCsv = (() => {
    if (template !== "repasse_motorista") return true;
    if (!filters.driverId || filters.parceiroId) return true;
    const driverDetail = driverDetailMap.get(filters.driverId);
    return (
      driverDetail?.parceiro_id !== null &&
      driverDetail?.parceiro_id !== undefined
    );
  })();

  const headersMap: Record<ReportTemplate, string[]> = {
    medicao_cliente: [
      "Protocolo",
      "OS",
      "Data",
      "Cliente",
      "Centro de Custo",
      "Solicitante",
      "Passageiros",
      "Trajeto",
      "Motorista",
      "Valor Bruto",
      "Status",
    ],
    repasse_motorista: [
      "Data",
      "Protocolo",
      "Status",
      "Tipo",
      ...(showParceiroColCsv ? ["Parceiro"] : []),
      "Motorista",
      "Trajeto realizado",
      "Veículo usado",
      "Valor",
    ],
    performance: [
      "Protocolo",
      "OS",
      "Data",
      "Cliente",
      "Valor Bruto",
      "Custo",
      "Imposto",
      "Lucro",
      "Margem %",
    ],
    liberadas_faturamento: [
      "Protocolo",
      "OS",
      "Data",
      "Cliente",
      "Motorista",
      "Valor Bruto",
    ],
    pendentes_repasse: [
      "Protocolo",
      "OS",
      "Data",
      "Motorista/Parceiro",
      "Custo",
      "Status",
    ],
    resumo_motoristas: [
      "Motorista/Parceiro",
      "Tipo",
      "Parceiro",
      "Serviços Realizados",
      "Já Pagos",
      "Pendentes",
      "Valor Total",
      "Valor Pago",
      "Valor Pendente",
    ],
  };

  const headers = headersMap[template];
  const lines: string[] = [headers.join(";")];

  // Resumo consolidado por motorista — estrutura diferente das demais
  // (uma linha por motorista, não por OS).
  if (template === "resumo_motoristas") {
    type CsvSummary = {
      nome: string;
      tipo: string;
      parceiroNome: string;
      servicos: number;
      pagos: number;
      pendentes: number;
      valorTotal: number;
      valorPago: number;
      valorPendente: number;
    };
    const csvDriverMap = new Map<string, CsvSummary>();
    for (const row of rows) {
      if (!row.driver_id) continue;
      const driverDetail = driverDetailMap.get(row.driver_id);
      const nome =
        driverMap.get(row.driver_id) || row.motorista || "Desconhecido";
      let tipo = "Autônomo";
      if (row.tipo === "freelance") tipo = "Freelance";
      else if (driverDetail?.parceiro_id) tipo = "Parceiro";
      else if (driverDetail?.vinculo_tipo === "interno") tipo = "Interno";
      const parceiroNome = driverDetail?.parceiro_id
        ? parceiroMap.get(driverDetail.parceiro_id) || ""
        : "";

      let entry = csvDriverMap.get(row.driver_id);
      if (!entry) {
        entry = {
          nome,
          tipo,
          parceiroNome,
          servicos: 0,
          pagos: 0,
          pendentes: 0,
          valorTotal: 0,
          valorPago: 0,
          valorPendente: 0,
        };
        csvDriverMap.set(row.driver_id, entry);
      }
      const custo = calcEffectiveCustoValue(row);
      entry.servicos++;
      entry.valorTotal += custo;
      if (row.repasse_pago) {
        entry.pagos++;
        entry.valorPago += custo;
      } else {
        entry.pendentes++;
        entry.valorPendente += custo;
      }
    }
    const csvSummaries = Array.from(csvDriverMap.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    );
    let csvTotalServicos = 0;
    let csvTotalPagos = 0;
    let csvTotalPendentes = 0;
    let csvTotalValor = 0;
    let csvTotalPago = 0;
    let csvTotalPendente = 0;
    for (const s of csvSummaries) {
      lines.push(
        [
          s.nome,
          s.tipo,
          s.parceiroNome || "-",
          String(s.servicos),
          String(s.pagos),
          String(s.pendentes),
          formatCurrency(s.valorTotal),
          formatCurrency(s.valorPago),
          formatCurrency(s.valorPendente),
        ].join(";"),
      );
      csvTotalServicos += s.servicos;
      csvTotalPagos += s.pagos;
      csvTotalPendentes += s.pendentes;
      csvTotalValor += s.valorTotal;
      csvTotalPago += s.valorPago;
      csvTotalPendente += s.valorPendente;
    }
    lines.push("");
    lines.push(
      `TOTAL; ; ;${csvTotalServicos};${csvTotalPagos};${csvTotalPendentes};${formatCurrency(csvTotalValor)};${formatCurrency(csvTotalPago)};${formatCurrency(csvTotalPendente)}`,
    );

    const csvContent = lines.join("\n");
    const encoder = new TextEncoder();
    const bytes = encoder.encode("\uFEFF" + csvContent);
    return new Response(bytes, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="resumo-motoristas-${data.periodLabel.replace(/\s/g, "_")}.csv"`,
      },
    });
  }

  rows.forEach((row) => {
    const clienteNome = clienteMap.get(row.cliente_id || "") || "-";
    const centroCustoNome = centroCustoMap.get(row.centro_custo_id || "") || "";
    const motoristaNome =
      driverMap.get(row.driver_id || "") || row.motorista || "-";
    const driver = row.driver_id
      ? data.driverDetailMap.get(row.driver_id)
      : undefined;
    const parceiroNome = driver?.parceiro_id
      ? parceiroMap.get(driver.parceiro_id) || "-"
      : "";

    switch (template) {
      case "medicao_cliente": {
        const waypoints = data.waypointsMap.get(row.id) || [];
        const passageiros = Array.from(
          new Set(
            waypoints
              .flatMap((wp) => wp.passengers?.map((p) => p.nome))
              .filter(Boolean),
          ),
        ).join(", ");
        const trajeto = waypoints
          .map((wp) => wp.label)
          .filter(Boolean)
          .join(" -> ");

        lines.push(
          [
            row.protocolo || "-",
            row.os_number || "-",
            formatDate(row.data),
            clienteNome,
            centroCustoNome,
            row.solicitante || "-",
            passageiros,
            trajeto,
            motoristaNome,
            formatCurrencyOrIsento(
              calcEffectiveClientValue(row),
              row.isento_valor_bruto,
            ),
            row.status_financeiro || "Pendente",
          ].join(";"),
        );
        break;
      }
      case "repasse_motorista": {
        const waypoints = data.waypointsMap.get(row.id) || [];
        const trajeto = waypoints
          .map((wp) => wp.label)
          .filter(Boolean)
          .join(" -> ");
        const csvRow = [
          formatDate(row.data),
          row.protocolo || "-",
          row.repasse_pago ? "Pago" : "Pendente",
          getRowVinculoTipo(row, driver),
          ...(showParceiroColCsv ? [parceiroNome || "-"] : []),
          motoristaNome || "-",
          trajeto || "-",
          vehicleMap.get(row.veiculo_id || "") || "-",
          formatCurrencyOrIsento(
            calcEffectiveCustoValue(row),
            row.isento_custo,
          ),
        ];
        lines.push(csvRow.join(";"));
        break;
      }
      case "performance": {
        const bruto = Number(row.valor_bruto || 0);
        const lucro = Number(row.lucro || 0);
        const margem = bruto > 0 ? ((lucro / bruto) * 100).toFixed(2) : "0.00";
        lines.push(
          [
            row.protocolo || "-",
            row.os_number || "-",
            formatDate(row.data),
            clienteNome,
            formatCurrencyOrIsento(bruto, row.isento_valor_bruto),
            formatCurrencyOrIsento(
              calcEffectiveCustoValue(row),
              row.isento_custo,
            ),
            formatCurrency(Number(row.imposto || 0)),
            formatCurrency(lucro),
            `${margem}%`,
          ].join(";"),
        );
        break;
      }
      case "liberadas_faturamento":
        lines.push(
          [
            row.protocolo || "-",
            row.os_number || "-",
            formatDate(row.data),
            clienteNome,
            motoristaNome,
            formatCurrencyOrIsento(
              Number(row.valor_bruto || 0),
              row.isento_valor_bruto,
            ),
          ].join(";"),
        );
        break;
      case "pendentes_repasse": {
        const isParceiro =
          driver?.parceiro_id !== null && driver?.parceiro_id !== undefined;
        const nomeDestinatario = isParceiro ? parceiroNome : motoristaNome;
        lines.push(
          [
            row.protocolo || "-",
            row.os_number || "-",
            formatDate(row.data),
            nomeDestinatario,
            formatCurrencyOrIsento(
              calcEffectiveCustoValue(row),
              row.isento_custo,
            ),
            row.status_financeiro || "Pendente",
          ].join(";"),
        );
        break;
      }
    }
  });

  lines.push("");
  lines.push(`Total OS;${data.summary.totalOS}`);
  lines.push(`Total Bruto;${formatCurrency(data.summary.totalBruto)}`);
  lines.push(`Total Custo;${formatCurrency(data.summary.totalCusto)}`);
  lines.push(`Total Lucro;${formatCurrency(data.summary.totalLucro)}`);

  const csvContent = lines.join("\n");
  const encoder = new TextEncoder();
  const bytes = encoder.encode("\uFEFF" + csvContent);

  const fileNameMap: Record<ReportTemplate, string> = {
    medicao_cliente: "medicao-cliente",
    repasse_motorista: "repasse-motoristas",
    resumo_motoristas: "resumo-motoristas",
    performance: "performance-financeira",
    liberadas_faturamento: "liberadas-faturamento",
    pendentes_repasse: "pendentes-repasse",
  };

  return new Response(bytes, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileNameMap[template]}-${data.periodLabel.replace(/\s/g, "_")}.csv"`,
    },
  });
}

// ── XLSX Generator ────────────────────────────────────────

const XLSX_FILE_NAME_MAP: Record<ReportTemplate, string> = {
  medicao_cliente: "medicao-cliente",
  repasse_motorista: "repasse-motoristas",
  resumo_motoristas: "resumo-motoristas",
  performance: "performance-financeira",
  liberadas_faturamento: "liberadas-faturamento",
  pendentes_repasse: "pendentes-repasse",
};

/**
 * Gera um arquivo Excel (.xlsx) estilizado para o template informado.
 * Atualmente o layout detalhado (cabeçalho azul, colunas específicas,
 * formatação monetária e bordas) é aplicado ao template
 * `medicao_cliente`. Para os demais templates, gera uma planilha simples
 * reaproveitando as mesmas colunas do CSV.
 */
async function generateXlsx(
  data: ReportData,
  template: ReportTemplate,
  filters: FinanceFilters,
): Promise<Response> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Portal Geolog";
  workbook.created = new Date();

  if (template === "medicao_cliente") {
    await buildMedicaoClienteSheet(workbook, data, filters);
  } else if (template === "repasse_motorista") {
    buildRepasseSheet(workbook, data, filters);
  } else if (template === "resumo_motoristas") {
    buildResumoMotoristasSheet(workbook, data, filters);
  } else {
    buildGenericSheet(workbook, data, template);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);

  const fileName = `${XLSX_FILE_NAME_MAP[template]}-${data.periodLabel.replace(/\s/g, "_")}.xlsx`;

  return new Response(bytes, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

/**
 * Planilha estilizada da Medição para Cliente.
 * Layout:
 *  - Linha 1: título mesclado em azul marinho com texto "MEDIÇÃO <CLIENTE> – <PERÍODO>"
 *  - Linha 2: subtítulo mesclado em azul claro com período completo
 *  - Linha 3: cabeçalho azul com fonte branca em maiúsculas
 *    Colunas: DATA | OS | OS CLIENTE | CENTRO DE CUSTO | SOLICITANTE | PAXS | TRECHO | PLACA | VALOR
 *  - Linhas 4+: dados das OS com bordas finas e valor em formato R$
 *  - Última linha: TOTAL em negrito com soma dos valores
 */
async function buildMedicaoClienteSheet(
  workbook: ExcelJS.Workbook,
  data: ReportData,
  filters: FinanceFilters,
): Promise<void> {
  const sheet = workbook.addWorksheet("Medição", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  // Larguras dinâmicas baseadas no maior conteúdo de cada coluna de texto
  // longo. Garante que nada seja truncado ou quebrado em linha.
  const maxSolicitanteLen = data.rows.reduce((max, row) => {
    const len = (row.solicitante || "-").length;
    return len > max ? len : max;
  }, "SOLICITANTE".length);

  const maxPlacaLen = data.rows.reduce((max, row) => {
    const txt = data.vehicleMap.get(row.veiculo_id || "") || "-";
    return txt.length > max ? txt.length : max;
  }, "PLACA".length);

  const columns = [
    { header: "DATA", key: "data", width: 12 },
    { header: "PROTOCOLO GEOLOG", key: "protocolo", width: 20 },
    { header: "OS DO CLIENTE", key: "os_cliente", width: 20 },
    { header: "CENTRO DE CUSTO", key: "centro_custo", width: 32 },
    {
      header: "SOLICITANTE",
      key: "solicitante",
      width: Math.max(maxSolicitanteLen + 2, 14),
    },
    { header: "PAXS", key: "paxs", width: 80 },
    { header: "TRECHO", key: "trecho", width: 80 },
    { header: "PLACA", key: "placa", width: Math.max(maxPlacaLen + 2, 10) },
    { header: "VALOR", key: "valor", width: 16 },
  ];
  sheet.columns = columns;

  const lastColLetter = sheet.getColumn(columns.length).letter;

  // ── Linha 1: Título principal ────────────────────────────────────
  const selectedClientId = filters.clienteId || data.rows[0]?.cliente_id;
  const clienteNome = selectedClientId
    ? data.clienteMap.get(selectedClientId) || "GERAL"
    : "GERAL";
  const titleRow = sheet.getRow(1);
  titleRow.height = 28;
  const titleCell = titleRow.getCell(1);
  titleCell.value = `MEDIÇÃO ${clienteNome.toUpperCase()}`;
  sheet.mergeCells(`A1:${lastColLetter}1`);
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" }, // azul marinho
  };

  // ── Linha 2: Subtítulo (período + total de OS) ───────────────────
  const subtitleRow = sheet.getRow(2);
  subtitleRow.height = 20;
  const subtitleCell = subtitleRow.getCell(1);
  subtitleCell.value = `Período: ${data.periodLabel}  |  Total de OS: ${data.summary.totalOS}`;
  sheet.mergeCells(`A2:${lastColLetter}2`);
  subtitleCell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  subtitleCell.alignment = { vertical: "middle", horizontal: "center" };
  subtitleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF3B82F6" }, // azul claro
  };

  // ── Linha 3: Cabeçalho das colunas ───────────────────────────────
  const headerRow = sheet.getRow(3);
  headerRow.height = 22;
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E40AF" }, // azul forte
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFFFFFFF" } },
      bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
      left: { style: "thin", color: { argb: "FFFFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFFFF" } },
    };
  });

  // ── Linhas de dados ──────────────────────────────────────────────
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };

  let totalValor = 0;
  data.rows.forEach((row, idx) => {
    const rowNumber = idx + 4;
    const excelRow = sheet.getRow(rowNumber);
    excelRow.height = 18;

    const centroCustoNome =
      data.centroCustoMap.get(row.centro_custo_id || "") || "";
    const waypoints = data.waypointsMap.get(row.id) || [];
    const passageirosList = Array.from(
      new Set(
        waypoints
          .flatMap((wp) => wp.passengers?.map((p) => p.nome))
          .filter(Boolean),
      ),
    ) as string[];
    const trajetoList = waypoints.map((wp) => wp.label).filter(Boolean);
    const placaModelo = data.vehicleMap.get(row.veiculo_id || "") || "-";

    // Data como texto DD/MM/AAAA (evita problemas de fuso no Excel)
    excelRow.getCell(1).value = formatDate(row.data);
    excelRow.getCell(2).value = row.protocolo || "-";
    excelRow.getCell(3).value = row.os_number || "-";
    excelRow.getCell(4).value = centroCustoNome || "-";
    excelRow.getCell(5).value = row.solicitante || "-";
    excelRow.getCell(6).value = passageirosList.join(" / ") || "-";
    excelRow.getCell(7).value = trajetoList.join(" X ") || "-";
    excelRow.getCell(8).value = placaModelo;

    const valor = calcEffectiveClientValue(row);
    const isento = row.isento_valor_bruto;
    if (isento) {
      excelRow.getCell(9).value = "Isento";
      excelRow.getCell(9).alignment = { horizontal: "center" };
    } else {
      excelRow.getCell(9).value = valor;
      excelRow.getCell(9).numFmt = '"R$" #,##0.00';
      excelRow.getCell(9).alignment = { horizontal: "right" };
      totalValor += valor;
    }

    // Estilo das células
    for (let c = 1; c <= columns.length; c++) {
      const cell = excelRow.getCell(c);
      cell.border = thinBorder;
      if (!cell.font) {
        cell.font = { size: 10, color: { argb: "FF1F2937" } };
      } else {
        cell.font = { ...cell.font, size: 10, color: { argb: "FF1F2937" } };
      }
      // wrapText apenas em PAXS (6) — TRECHO (7) fica em linha única
      const wrap = c === 6;
      if (!cell.alignment) {
        cell.alignment = {
          vertical: "middle",
          horizontal: "left",
          wrapText: wrap,
        };
      } else {
        cell.alignment = {
          ...cell.alignment,
          vertical: "middle",
          wrapText: wrap,
        };
      }
    }
    // Zebra striping suave
    if (idx % 2 === 1) {
      for (let c = 1; c <= columns.length; c++) {
        excelRow.getCell(c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF1F5F9" },
        };
      }
    }
  });

  // ── Linha de TOTAL ───────────────────────────────────────────────
  const totalRowNumber = data.rows.length + 4;
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.height = 24;
  sheet.mergeCells(`A${totalRowNumber}:H${totalRowNumber}`);
  const totalLabelCell = totalRow.getCell(1);
  totalLabelCell.value = "TOTAL";
  totalLabelCell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  totalLabelCell.alignment = {
    vertical: "middle",
    horizontal: "right",
  };
  totalLabelCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" },
  };
  const totalValueCell = totalRow.getCell(9);
  totalValueCell.value = totalValor;
  totalValueCell.numFmt = '"R$" #,##0.00';
  totalValueCell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  totalValueCell.alignment = { vertical: "middle", horizontal: "right" };
  totalValueCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" },
  };
  for (let c = 1; c <= columns.length; c++) {
    totalRow.getCell(c).border = {
      top: { style: "medium", color: { argb: "FFFFFFFF" } },
      bottom: { style: "medium", color: { argb: "FFFFFFFF" } },
      left: { style: "thin", color: { argb: "FFFFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFFFF" } },
    };
  }

  // Definir a área de impressão e ajustes finais
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;
}

/**
 * Planilha estilizada do relatório único de Repasse a Motoristas (unifica
 * os antigos Autônomos/Internos/Parceiros). Layout espelhado na Medição
 * para Cliente:
 *  - Linha 1: título mesclado em azul marinho
 *  - Linha 2: subtítulo mesclado em azul claro com período + total de OS
 *  - Linha 3: cabeçalho azul forte com fonte branca em maiúsculas
 *  - Linhas 4+: dados das OS com bordas finas, zebra striping e valor em R$
 *  - Última linha: TOTAL em negrito com soma dos valores
 *
 * Colunas: DATA | PROTOCOLO GEOLOG | STATUS | TIPO | PARCEIRO | MOTORISTA |
 * TRAJETO | VEÍCULO | VALOR. A coluna TIPO mostra a classificação de cada
 * OS individualmente (Autônomo/Interno/Parceiro/Freelance), já que o
 * mesmo motorista pode ter OS de tipos diferentes no período.
 */
function buildRepasseSheet(
  workbook: ExcelJS.Workbook,
  data: ReportData,
  filters: FinanceFilters,
): void {
  const sheet = workbook.addWorksheet("Repasse a Motoristas", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  // Determina se a coluna PARCEIRO deve aparecer. Só é omitida quando
  // o filtro é por um motorista autônomo/interno específico (sem
  // parceiro associado). Em todos os outros casos (Todos, parceiro
  // específico, ou motorista de parceiro), a coluna aparece.
  const showParceiroCol = (() => {
    if (!filters.driverId || filters.parceiroId) return true;
    const driverDetail = data.driverDetailMap.get(filters.driverId);
    return (
      driverDetail?.parceiro_id !== null &&
      driverDetail?.parceiro_id !== undefined
    );
  })();

  // Larguras dinâmicas para colunas de texto longo
  const maxParceiroLen = data.rows.reduce((max, row) => {
    const driver = row.driver_id
      ? data.driverDetailMap.get(row.driver_id)
      : undefined;
    const txt = driver?.parceiro_id
      ? data.parceiroMap.get(driver.parceiro_id) || "-"
      : "-";
    return txt.length > max ? txt.length : max;
  }, "PARCEIRO".length);

  const maxMotoristaLen = data.rows.reduce((max, row) => {
    const txt = data.driverMap.get(row.driver_id || "") || row.motorista || "-";
    return txt.length > max ? txt.length : max;
  }, "MOTORISTA".length);

  const maxVeiculoLen = data.rows.reduce((max, row) => {
    const txt = data.vehicleMap.get(row.veiculo_id || "") || "-";
    return txt.length > max ? txt.length : max;
  }, "VEÍCULO USADO".length);

  const columns = [
    { header: "DATA", key: "data", width: 12 },
    { header: "PROTOCOLO GEOLOG", key: "protocolo", width: 20 },
    { header: "STATUS", key: "status", width: 14 },
    { header: "TIPO", key: "tipo", width: 14 },
    ...(showParceiroCol
      ? [
          {
            header: "PARCEIRO",
            key: "parceiro",
            width: Math.max(maxParceiroLen + 2, 14),
          },
        ]
      : []),
    {
      header: "MOTORISTA",
      key: "motorista",
      width: Math.max(maxMotoristaLen + 2, 14),
    },
    { header: "TRAJETO REALIZADO", key: "trajeto", width: 80 },
    {
      header: "VEÍCULO USADO",
      key: "veiculo",
      width: Math.max(maxVeiculoLen + 2, 14),
    },
    { header: "VALOR", key: "valor", width: 16 },
  ];
  sheet.columns = columns;

  const lastColLetter = sheet.getColumn(columns.length).letter;

  // ── Linha 1: Título principal ────────────────────────────────────
  // Mostra o nome do motorista/parceiro filtrado. Sem filtro, é geral.
  let titleText: string;
  if (filters.driverId) {
    titleText = `REPASSE A MOTORISTAS – ${(data.driverMap.get(filters.driverId) || "GERAL").toUpperCase()}`;
  } else if (filters.parceiroId) {
    titleText = `REPASSE A MOTORISTAS – ${(data.parceiroMap.get(filters.parceiroId) || "GERAL").toUpperCase()}`;
  } else {
    titleText = "RELATÓRIO GERAL DE REPASSE A MOTORISTAS";
  }

  const titleRow = sheet.getRow(1);
  titleRow.height = 28;
  const titleCell = titleRow.getCell(1);
  titleCell.value = titleText;
  sheet.mergeCells(`A1:${lastColLetter}1`);
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" }, // azul marinho
  };

  // ── Linha 2: Subtítulo (período + total de OS) ───────────────────
  const subtitleRow = sheet.getRow(2);
  subtitleRow.height = 20;
  const subtitleCell = subtitleRow.getCell(1);
  subtitleCell.value = `Período: ${data.periodLabel}  |  Total de OS: ${data.summary.totalOS}`;
  sheet.mergeCells(`A2:${lastColLetter}2`);
  subtitleCell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  subtitleCell.alignment = { vertical: "middle", horizontal: "center" };
  subtitleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF3B82F6" }, // azul claro
  };

  // ── Linha 3: Cabeçalho das colunas ───────────────────────────────
  const headerRow = sheet.getRow(3);
  headerRow.height = 22;
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E40AF" }, // azul forte
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFFFFFFF" } },
      bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
      left: { style: "thin", color: { argb: "FFFFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFFFF" } },
    };
  });

  // ── Linhas de dados ──────────────────────────────────────────────
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };

  // Mapeia keys para índices reais (depende de showParceiroCol)
  const colIndexMap: Record<string, number> = {};
  columns.forEach((col, idx) => {
    colIndexMap[col.key] = idx + 1;
  });

  // Índice da coluna de VALOR (última). TRAJETO REALIZADO fica em linha
  // única (sem wrapText), igual ao TRECHO da Medição para Cliente — o
  // usuário amplia a coluna manualmente ou clica na célula para ver tudo.
  const valorColIdx = colIndexMap["valor"];

  let totalValor = 0;
  data.rows.forEach((row, idx) => {
    const rowNumber = idx + 4;
    const excelRow = sheet.getRow(rowNumber);
    excelRow.height = 18;

    const driver = row.driver_id
      ? data.driverDetailMap.get(row.driver_id)
      : undefined;
    const parceiroNomeLinha = driver?.parceiro_id
      ? data.parceiroMap.get(driver.parceiro_id) || "-"
      : "-";
    const motoristaNome =
      data.driverMap.get(row.driver_id || "") || row.motorista || "-";
    const waypoints = data.waypointsMap.get(row.id) || [];
    const trajetoList = waypoints.map((wp) => wp.label).filter(Boolean);
    const placaModelo = data.vehicleMap.get(row.veiculo_id || "") || "-";

    excelRow.getCell(colIndexMap["data"]).value = formatDate(row.data);
    excelRow.getCell(colIndexMap["protocolo"]).value = row.protocolo || "-";
    excelRow.getCell(colIndexMap["status"]).value = row.repasse_pago
      ? "Pago"
      : "Pendente";
    excelRow.getCell(colIndexMap["tipo"]).value = getRowVinculoTipo(
      row,
      driver,
    );
    if (showParceiroCol) {
      excelRow.getCell(colIndexMap["parceiro"]).value = parceiroNomeLinha;
    }
    excelRow.getCell(colIndexMap["motorista"]).value = motoristaNome;
    excelRow.getCell(colIndexMap["trajeto"]).value =
      trajetoList.join(" -> ") || "-";
    excelRow.getCell(colIndexMap["veiculo"]).value = placaModelo;

    const valor = calcEffectiveCustoValue(row);
    const isento = row.isento_custo;
    const valorCell = excelRow.getCell(valorColIdx);
    if (isento) {
      valorCell.value = "Isento";
      valorCell.alignment = { horizontal: "center", vertical: "middle" };
    } else {
      // Tags de NO-SHOW e/ou Hora Extra abaixo do valor, espelhando o PDF.
      const tags: string[] = [];
      if (row.no_show) {
        tags.push(`NO-SHOW (${row.no_show_percentual ?? 100}%)`);
      }
      const heBilledMinutes = calcBilledMinutes(
        parseHoraExtraMinutes(row.hora_extra),
      );
      if (heBilledMinutes > 0) {
        tags.push(`H.EXTRA (${formatBilledHours(heBilledMinutes)})`);
      }
      if (tags.length > 0) {
        // RichText: valor em negrito/verde + tags em cinza/vermelho
        valorCell.value = {
          richText: [
            {
              text: formatCurrency(valor),
              font: { bold: true, size: 10, color: { argb: "FF1F7A4D" } },
            },
            ...tags.map((tag, i) => ({
              text: `${i === 0 ? "\n" : "\n"}${tag}`,
              font: {
                size: 8,
                color: {
                  argb: tag.startsWith("NO-SHOW") ? "FFB91C1C" : "FF4B5563",
                },
                bold: tag.startsWith("H.EXTRA"),
              },
            })),
          ],
        };
        valorCell.alignment = {
          horizontal: "right",
          vertical: "top",
          wrapText: true,
        };
        // Aumenta a altura da linha para acomodar as tags
        excelRow.height = Math.max(
          excelRow.height || 18,
          18 + tags.length * 12,
        );
      } else {
        valorCell.value = valor;
        valorCell.numFmt = '"R$" #,##0.00';
        valorCell.alignment = { horizontal: "right", vertical: "middle" };
      }
      totalValor += valor;
    }

    // Estilo das células
    for (let c = 1; c <= columns.length; c++) {
      const cell = excelRow.getCell(c);
      cell.border = thinBorder;
      // Pula font/alignment da célula VALOR quando ela já tem richText
      // (valor + tags NO-SHOW/H.EXTRA) — o estilo foi definido acima.
      if (
        c === valorColIdx &&
        cell.value &&
        typeof cell.value === "object" &&
        "richText" in cell.value
      ) {
        continue;
      }
      if (!cell.font) {
        cell.font = { size: 10, color: { argb: "FF1F2937" } };
      } else {
        cell.font = { ...cell.font, size: 10, color: { argb: "FF1F2937" } };
      }
      // Sem wrapText — TRAJETO REALIZADO fica em linha única (igual ao
      // TRECHO da Medição para Cliente).
      if (!cell.alignment) {
        cell.alignment = {
          vertical: "middle",
          horizontal: "left",
        };
      } else {
        cell.alignment = {
          ...cell.alignment,
          vertical: "middle",
        };
      }
    }
    // Zebra striping suave
    if (idx % 2 === 1) {
      for (let c = 1; c <= columns.length; c++) {
        excelRow.getCell(c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF1F5F9" },
        };
      }
    }
  });

  // ── Linha de TOTAL ───────────────────────────────────────────────
  const totalRowNumber = data.rows.length + 4;
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.height = 24;
  // Mescla da coluna A até a penúltima (deixa VALOR separado à direita)
  const totalMergeEndCol = sheet.getColumn(columns.length - 1).letter;
  sheet.mergeCells(`A${totalRowNumber}:${totalMergeEndCol}${totalRowNumber}`);
  const totalLabelCell = totalRow.getCell(1);
  totalLabelCell.value = "TOTAL";
  totalLabelCell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  totalLabelCell.alignment = {
    vertical: "middle",
    horizontal: "right",
  };
  totalLabelCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" },
  };
  const totalValueCell = totalRow.getCell(valorColIdx);
  totalValueCell.value = totalValor;
  totalValueCell.numFmt = '"R$" #,##0.00';
  totalValueCell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  totalValueCell.alignment = { vertical: "middle", horizontal: "right" };
  totalValueCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" },
  };
  for (let c = 1; c <= columns.length; c++) {
    totalRow.getCell(c).border = {
      top: { style: "medium", color: { argb: "FFFFFFFF" } },
      bottom: { style: "medium", color: { argb: "FFFFFFFF" } },
      left: { style: "thin", color: { argb: "FFFFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFFFF" } },
    };
  }

  // Definir a área de impressão e ajustes finais
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;
}

/**
 * Planilha estilizada do Resumo Geral de Motoristas.
 * Consolida todas as OS do período por motorista/parceiro, mostrando
 * uma linha por motorista com: nome, tipo, serviços realizados, pagos,
 * pendentes e valores totais.
 *
 * Layout espelhado nos demais relatórios estilizados:
 *  - Linha 1: título "RESUMO GERAL DE MOTORISTAS"
 *  - Linha 2: subtítulo com período + total de motoristas
 *  - Linha 3: cabeçalho azul forte
 *  - Linhas 4+: dados consolidados por motorista
 *  - Última linha: TOTAL
 */
function buildResumoMotoristasSheet(
  workbook: ExcelJS.Workbook,
  data: ReportData,
  _filters: FinanceFilters,
): void {
  const sheet = workbook.addWorksheet("Resumo Motoristas", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  // Consolida por driver_id
  type DriverSummary = {
    driverId: string;
    nome: string;
    tipo: string; // "Autônomo", "Interno", "Parceiro", "Freelance"
    parceiroNome: string;
    servicos: number;
    pagos: number;
    pendentes: number;
    valorTotal: number;
    valorPago: number;
    valorPendente: number;
  };

  const driverMap = new Map<string, DriverSummary>();

  for (const row of data.rows) {
    if (!row.driver_id) continue;
    const driverDetail = data.driverDetailMap.get(row.driver_id);
    const nome =
      data.driverMap.get(row.driver_id) || row.motorista || "Desconhecido";

    let tipo = "Autônomo";
    if (row.tipo === "freelance") {
      tipo = "Freelance";
    } else if (driverDetail?.parceiro_id) {
      tipo = "Parceiro";
    } else if (driverDetail?.vinculo_tipo === "interno") {
      tipo = "Interno";
    }

    const parceiroNome = driverDetail?.parceiro_id
      ? data.parceiroMap.get(driverDetail.parceiro_id) || ""
      : "";

    let entry = driverMap.get(row.driver_id);
    if (!entry) {
      entry = {
        driverId: row.driver_id,
        nome,
        tipo,
        parceiroNome,
        servicos: 0,
        pagos: 0,
        pendentes: 0,
        valorTotal: 0,
        valorPago: 0,
        valorPendente: 0,
      };
      driverMap.set(row.driver_id, entry);
    }

    const custo = calcEffectiveCustoValue(row);
    entry.servicos++;
    entry.valorTotal += custo;
    if (row.repasse_pago) {
      entry.pagos++;
      entry.valorPago += custo;
    } else {
      entry.pendentes++;
      entry.valorPendente += custo;
    }
  }

  const summaries = Array.from(driverMap.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );

  // Larguras dinâmicas
  const maxNomeLen = summaries.reduce(
    (max, s) => (s.nome.length > max ? s.nome.length : max),
    "MOTORISTA / PARCEIRO".length,
  );
  const maxParceiroLen = summaries.reduce(
    (max, s) => (s.parceiroNome.length > max ? s.parceiroNome.length : max),
    "PARCEIRO".length,
  );

  const columns = [
    {
      header: "MOTORISTA / PARCEIRO",
      key: "nome",
      width: Math.max(maxNomeLen + 2, 22),
    },
    { header: "TIPO", key: "tipo", width: 14 },
    {
      header: "PARCEIRO",
      key: "parceiro",
      width: Math.max(maxParceiroLen + 2, 14),
    },
    { header: "SERVIÇOS REALIZADOS", key: "servicos", width: 22 },
    { header: "JÁ PAGOS", key: "pagos", width: 14 },
    { header: "PENDENTES", key: "pendentes", width: 14 },
    { header: "VALOR TOTAL", key: "valorTotal", width: 18 },
    { header: "VALOR PAGO", key: "valorPago", width: 18 },
    { header: "VALOR PENDENTE", key: "valorPendente", width: 18 },
  ];
  sheet.columns = columns;
  const lastColLetter = sheet.getColumn(columns.length).letter;

  // ── Linha 1: Título ──────────────────────────────────────────────
  const titleRow = sheet.getRow(1);
  titleRow.height = 28;
  const titleCell = titleRow.getCell(1);
  titleCell.value = "RESUMO GERAL DE MOTORISTAS";
  sheet.mergeCells(`A1:${lastColLetter}1`);
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" },
  };

  // ── Linha 2: Subtítulo ───────────────────────────────────────────
  const subtitleRow = sheet.getRow(2);
  subtitleRow.height = 20;
  const subtitleCell = subtitleRow.getCell(1);
  subtitleCell.value = `Período: ${data.periodLabel}  |  Total de Motoristas: ${summaries.length}  |  Total de OS: ${data.summary.totalOS}`;
  sheet.mergeCells(`A2:${lastColLetter}2`);
  subtitleCell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  subtitleCell.alignment = { vertical: "middle", horizontal: "center" };
  subtitleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF3B82F6" },
  };

  // ── Linha 3: Cabeçalho ───────────────────────────────────────────
  const headerRow = sheet.getRow(3);
  headerRow.height = 22;
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E40AF" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFFFFFFF" } },
      bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
      left: { style: "thin", color: { argb: "FFFFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFFFF" } },
    };
  });

  // ── Linhas de dados ──────────────────────────────────────────────
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };

  const numFmt = '"R$" #,##0.00';
  let totalServicos = 0;
  let totalPagos = 0;
  let totalPendentes = 0;
  let totalValorTotal = 0;
  let totalValorPago = 0;
  let totalValorPendente = 0;

  summaries.forEach((s, idx) => {
    const rowNumber = idx + 4;
    const excelRow = sheet.getRow(rowNumber);
    excelRow.height = 20;

    excelRow.getCell(1).value = s.nome;
    excelRow.getCell(2).value = s.tipo;
    excelRow.getCell(3).value = s.parceiroNome || "-";
    excelRow.getCell(4).value = s.servicos;
    excelRow.getCell(5).value = s.pagos;
    excelRow.getCell(6).value = s.pendentes;
    excelRow.getCell(7).value = s.valorTotal;
    excelRow.getCell(8).value = s.valorPago;
    excelRow.getCell(9).value = s.valorPendente;

    // Formatação numérica
    [7, 8, 9].forEach((c) => {
      const cell = excelRow.getCell(c);
      cell.numFmt = numFmt;
      cell.alignment = { horizontal: "right", vertical: "middle" };
    });
    [4, 5, 6].forEach((c) => {
      excelRow.getCell(c).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
    });

    // Estilo geral
    for (let c = 1; c <= columns.length; c++) {
      const cell = excelRow.getCell(c);
      cell.border = thinBorder;
      cell.font = { size: 10, color: { argb: "FF1F2937" } };
      if (!cell.alignment) {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    }

    // Zebra (não aplica nas colunas de valor, que têm cor própria)
    if (idx % 2 === 1) {
      for (let c = 1; c <= 6; c++) {
        excelRow.getCell(c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF1F5F9" },
        };
      }
    }

    // Cores pastel nas colunas de valor
    // Col 7 = VALOR TOTAL (azul pastel)
    excelRow.getCell(7).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDBEAFE" },
    };
    // Col 8 = VALOR PAGO (verde pastel)
    excelRow.getCell(8).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD1FAE5" },
    };
    // Col 9 = VALOR PENDENTE (vermelho pastel)
    excelRow.getCell(9).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEE2E2" },
    };

    totalServicos += s.servicos;
    totalPagos += s.pagos;
    totalPendentes += s.pendentes;
    totalValorTotal += s.valorTotal;
    totalValorPago += s.valorPago;
    totalValorPendente += s.valorPendente;
  });

  // ── Linha de TOTAL ───────────────────────────────────────────────
  const totalRowNumber = summaries.length + 4;
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.height = 24;
  // Mescla A:C (nome + tipo + parceiro)
  sheet.mergeCells(`A${totalRowNumber}:C${totalRowNumber}`);
  const totalLabelCell = totalRow.getCell(1);
  totalLabelCell.value = "TOTAL";
  totalLabelCell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  totalLabelCell.alignment = { vertical: "middle", horizontal: "right" };
  totalLabelCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" },
  };

  totalRow.getCell(4).value = totalServicos;
  totalRow.getCell(5).value = totalPagos;
  totalRow.getCell(6).value = totalPendentes;
  totalRow.getCell(7).value = totalValorTotal;
  totalRow.getCell(8).value = totalValorPago;
  totalRow.getCell(9).value = totalValorPendente;

  [4, 5, 6].forEach((c) => {
    const cell = totalRow.getCell(c);
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };
  });
  [7, 8, 9].forEach((c) => {
    const cell = totalRow.getCell(c);
    cell.numFmt = numFmt;
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "right", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };
  });

  for (let c = 1; c <= columns.length; c++) {
    totalRow.getCell(c).border = {
      top: { style: "medium", color: { argb: "FFFFFFFF" } },
      bottom: { style: "medium", color: { argb: "FFFFFFFF" } },
      left: { style: "thin", color: { argb: "FFFFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFFFF" } },
    };
  }

  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;
}

/**
 * Planilha genérica (sem estilização avançada) para os demais templates.
 * Reaproveita as colunas já definidas no gerador de CSV.
 */
function buildGenericSheet(
  workbook: ExcelJS.Workbook,
  data: ReportData,
  template: ReportTemplate,
): void {
  const sheet = workbook.addWorksheet("Relatório");

  const headersMap: Record<ReportTemplate, string[]> = {
    medicao_cliente: [
      "Protocolo",
      "OS",
      "Data",
      "Cliente",
      "Centro de Custo",
      "Solicitante",
      "Passageiros",
      "Trajeto",
      "Motorista",
      "Valor Bruto",
      "Status",
    ],
    repasse_motorista: [
      "Data",
      "Protocolo",
      "Status",
      "Tipo",
      "Parceiro",
      "Motorista",
      "Trajeto realizado",
      "Veículo usado",
      "Valor",
    ],
    performance: [
      "Protocolo",
      "OS",
      "Data",
      "Cliente",
      "Valor Bruto",
      "Custo",
      "Imposto",
      "Lucro",
      "Margem %",
    ],
    liberadas_faturamento: [
      "Protocolo",
      "OS",
      "Data",
      "Cliente",
      "Motorista",
      "Valor Bruto",
    ],
    pendentes_repasse: [
      "Protocolo",
      "OS",
      "Data",
      "Motorista/Parceiro",
      "Custo",
      "Status",
    ],
    resumo_motoristas: [
      "Motorista/Parceiro",
      "Tipo",
      "Parceiro",
      "Serviços Realizados",
      "Já Pagos",
      "Pendentes",
      "Valor Total",
      "Valor Pago",
      "Valor Pendente",
    ],
  };

  const headers = headersMap[template];
  sheet.columns = headers.map((h) => ({ header: h, key: h, width: 20 }));

  // Estiliza o cabeçalho
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E40AF" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 20;

  data.rows.forEach((row) => {
    const clienteNome = data.clienteMap.get(row.cliente_id || "") || "-";
    const centroCustoNome =
      data.centroCustoMap.get(row.centro_custo_id || "") || "";
    const motoristaNome =
      data.driverMap.get(row.driver_id || "") || row.motorista || "-";
    const driver = row.driver_id
      ? data.driverDetailMap.get(row.driver_id)
      : undefined;
    const parceiroNome = driver?.parceiro_id
      ? data.parceiroMap.get(driver.parceiro_id) || "-"
      : "";
    const waypoints = data.waypointsMap.get(row.id) || [];
    const passageiros = Array.from(
      new Set(
        waypoints
          .flatMap((wp) => wp.passengers?.map((p) => p.nome))
          .filter(Boolean),
      ),
    ).join(", ");
    const trajeto = waypoints
      .map((wp) => wp.label)
      .filter(Boolean)
      .join(" -> ");

    const rowData: Record<string, string> = {};
    switch (template) {
      case "medicao_cliente":
        rowData[headers[0]] = row.protocolo || "-";
        rowData[headers[1]] = row.os_number || "-";
        rowData[headers[2]] = formatDate(row.data);
        rowData[headers[3]] = clienteNome;
        rowData[headers[4]] = centroCustoNome;
        rowData[headers[5]] = row.solicitante || "-";
        rowData[headers[6]] = passageiros;
        rowData[headers[7]] = trajeto;
        rowData[headers[8]] = motoristaNome;
        rowData[headers[9]] = formatCurrencyOrIsento(
          calcEffectiveClientValue(row),
          row.isento_valor_bruto,
        );
        rowData[headers[10]] = row.status_financeiro || "Pendente";
        break;
      case "repasse_motorista":
        rowData[headers[0]] = formatDate(row.data);
        rowData[headers[1]] = row.protocolo || "-";
        rowData[headers[2]] = row.repasse_pago ? "Pago" : "Pendente";
        rowData[headers[3]] = getRowVinculoTipo(row, driver);
        rowData[headers[4]] = parceiroNome || "-";
        rowData[headers[5]] = motoristaNome || "-";
        rowData[headers[6]] = trajeto || "-";
        rowData[headers[7]] = data.vehicleMap.get(row.veiculo_id || "") || "-";
        rowData[headers[8]] = formatCurrencyOrIsento(
          calcEffectiveCustoValue(row),
          row.isento_custo,
        );
        break;
      case "performance": {
        const bruto = Number(row.valor_bruto || 0);
        const custo = Number(row.custo || 0);
        const imposto = Number(row.imposto || 0);
        const lucro = Number(row.lucro || 0);
        const margem = bruto > 0 ? (lucro / bruto) * 100 : 0;
        rowData[headers[0]] = row.protocolo || "-";
        rowData[headers[1]] = row.os_number || "-";
        rowData[headers[2]] = formatDate(row.data);
        rowData[headers[3]] = clienteNome;
        rowData[headers[4]] = formatCurrency(bruto);
        rowData[headers[5]] = formatCurrency(custo);
        rowData[headers[6]] = formatCurrency(imposto);
        rowData[headers[7]] = formatCurrency(lucro);
        rowData[headers[8]] = `${margem.toFixed(2)}%`;
        break;
      }
      case "liberadas_faturamento":
        rowData[headers[0]] = row.protocolo || "-";
        rowData[headers[1]] = row.os_number || "-";
        rowData[headers[2]] = formatDate(row.data);
        rowData[headers[3]] = clienteNome;
        rowData[headers[4]] = motoristaNome;
        rowData[headers[5]] = formatCurrencyOrIsento(
          calcEffectiveClientValue(row),
          row.isento_valor_bruto,
        );
        break;
      case "pendentes_repasse": {
        const nomeDestinatario = driver?.parceiro_id
          ? parceiroNome || motoristaNome
          : motoristaNome;
        rowData[headers[0]] = row.protocolo || "-";
        rowData[headers[1]] = row.os_number || "-";
        rowData[headers[2]] = formatDate(row.data);
        rowData[headers[3]] = nomeDestinatario;
        rowData[headers[4]] = formatCurrencyOrIsento(
          calcEffectiveCustoValue(row),
          row.isento_custo,
        );
        rowData[headers[5]] = row.status_financeiro || "Pendente";
        break;
      }
    }
    sheet.addRow(rowData);
  });
}

// ── PDF Generator ────────────────────────────────────────

async function generatePdf(
  data: ReportData,
  template: ReportTemplate,
  request: Request,
  filters: FinanceFilters,
): Promise<Response> {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Logo embutido como base64 (100x100 otimizado).
  // Cloudflare Workers nao consegue fazer fetch para o proprio dominio (self-referential request),
  // por isso o logo é embutido diretamente para garantir que funcione tanto em localhost quanto em producao.
  let logoImage: PDFImage | null = null;
  try {
    const logoBytes = Uint8Array.from(atob(LOGO_BASE64), (c) =>
      c.charCodeAt(0),
    ).buffer;
    logoImage = await pdfDoc.embedPng(logoBytes);
  } catch (err) {
    console.error("Logo embedding failed:", err);
    logoImage = null;
  }

  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 32;

  const companyData = {
    name: "GELOG TRANSPORTES E LOGÍSTICA LTDA",
    cnpj: "31.223.049/0001-37",
    address:
      "Rua Jandira Morais Pimentel, 490 Centro 28893-046 - Rio das Ostras - Rio de Janeiro",
    city: "Rio das Ostras - RJ",
    phone: "2299759-9213",
    email: "contato@geolog.com.br",
  };

  const titleMap: Record<ReportTemplate, string> = {
    medicao_cliente: "RELATÓRIO DE MEDIÇÃO",
    repasse_motorista: "REPASSE A MOTORISTAS",
    resumo_motoristas: "RESUMO GERAL DE MOTORISTAS",
    performance: "PERFORMANCE FINANCEIRA",
    liberadas_faturamento: "LIBERADAS PARA FATURAMENTO",
    pendentes_repasse: "PENDENTES DE REPASSE",
  };

  const reportTitle = titleMap[template];

  // ── Rounded rectangle helper (simulates border-radius) ──
  function drawRoundedRect(
    currentPage: PDFPage,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fillColor?: ReturnType<typeof rgb>,
    strokeColor?: ReturnType<typeof rgb>,
    strokeWidth = 1,
  ) {
    const r = Math.min(radius, width / 2, height / 2);

    const fillShape = (
      ox: number,
      oy: number,
      ow: number,
      oh: number,
      or: number,
      color: ReturnType<typeof rgb>,
    ) => {
      currentPage.drawRectangle({
        x: ox + or,
        y: oy,
        width: ow - 2 * or,
        height: oh,
        color,
      });
      currentPage.drawRectangle({
        x: ox,
        y: oy + or,
        width: or,
        height: oh - 2 * or,
        color,
      });
      currentPage.drawRectangle({
        x: ox + ow - or,
        y: oy + or,
        width: or,
        height: oh - 2 * or,
        color,
      });
      currentPage.drawEllipse({
        x: ox + or,
        y: oy + or,
        xScale: or,
        yScale: or,
        color,
      });
      currentPage.drawEllipse({
        x: ox + ow - or,
        y: oy + or,
        xScale: or,
        yScale: or,
        color,
      });
      currentPage.drawEllipse({
        x: ox + or,
        y: oy + oh - or,
        xScale: or,
        yScale: or,
        color,
      });
      currentPage.drawEllipse({
        x: ox + ow - or,
        y: oy + oh - or,
        xScale: or,
        yScale: or,
        color,
      });
    };

    if (strokeColor && strokeWidth > 0) {
      fillShape(x, y, width, height, r, strokeColor);
      const inset = strokeWidth;
      const innerR = Math.max(0, r - inset);
      if (fillColor) {
        fillShape(
          x + inset,
          y + inset,
          width - inset * 2,
          height - inset * 2,
          innerR,
          fillColor,
        );
      }
    } else if (fillColor) {
      fillShape(x, y, width, height, r, fillColor);
    }
  }

  // ── Color palette (blue-gray mix) ──
  const c = {
    headerBg: rgb(0.18, 0.28, 0.42),
    headerText: rgb(1, 1, 1),
    headerMuted: rgb(0.75, 0.82, 0.92),
    primaryBox: rgb(0.24, 0.36, 0.52),
    primaryBoxText: rgb(1, 1, 1),
    primaryBoxMuted: rgb(0.82, 0.88, 0.96),
    highlightBg: rgb(0.92, 0.97, 0.94),
    highlightBorder: rgb(0.18, 0.55, 0.38),
    highlightText: rgb(0.12, 0.48, 0.32),
    standardBg: rgb(0.98, 0.99, 1.0),
    standardBorder: rgb(0.82, 0.86, 0.92),
    standardText: rgb(0.35, 0.42, 0.52),
    tableHeader: rgb(0.24, 0.36, 0.52),
    tableZebra: rgb(0.97, 0.98, 1.0),
    tableWhite: rgb(1, 1, 1),
    textDark: rgb(0.25, 0.3, 0.38),
    textMedium: rgb(0.42, 0.47, 0.55),
    borderLight: rgb(0.85, 0.89, 0.94),
    accentGreen: rgb(0.12, 0.48, 0.32),
    accentRed: rgb(0.75, 0.3, 0.22),
  };

  // ── Multi-line helpers ──
  function wrapTextToLines(
    text: string,
    size: number,
    font: PDFFont,
    maxWidth: number,
  ): string[] {
    const paragraphs = text.split("\n");
    const wrappedLines: string[] = [];

    const pushWrappedWord = (word: string) => {
      let chunk = "";
      for (const char of word) {
        const testChunk = chunk + char;
        if (chunk && font.widthOfTextAtSize(testChunk, size) > maxWidth) {
          wrappedLines.push(chunk);
          chunk = char;
        } else {
          chunk = testChunk;
        }
      }

      if (chunk) wrappedLines.push(chunk);
    };

    for (const paragraph of paragraphs) {
      const words = paragraph.split(/\s+/).filter(Boolean);

      if (words.length === 0) {
        wrappedLines.push("");
        continue;
      }

      let currentLine = "";

      for (const word of words) {
        const wordWidth = font.widthOfTextAtSize(word, size);

        if (wordWidth > maxWidth) {
          if (currentLine) {
            wrappedLines.push(currentLine);
            currentLine = "";
          }
          pushWrappedWord(word);
          continue;
        }

        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (font.widthOfTextAtSize(testLine, size) > maxWidth && currentLine) {
          wrappedLines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) wrappedLines.push(currentLine);
    }

    return wrappedLines.length > 0 ? wrappedLines : [text];
  }

  function calculateMultiLineHeight(
    text: string,
    size: number,
    font: PDFFont,
    maxWidth: number,
    lineHeight: number,
  ): number {
    return (
      Math.max(1, wrapTextToLines(text, size, font, maxWidth).length) *
      lineHeight
    );
  }

  function drawMultiLineText(
    currentPage: PDFPage,
    text: string,
    x: number,
    y: number,
    size: number,
    font: PDFFont,
    color: RGB,
    maxWidth: number,
    lineHeight: number,
  ) {
    const lines = wrapTextToLines(text, size, font, maxWidth);
    let currentY = y;

    for (const line of lines) {
      currentPage.drawText(line, { x, y: currentY, size, font, color });
      currentY -= lineHeight;
    }
  }

  function drawGradientHeaderBg(currentPage: PDFPage) {
    const topY = pageHeight - 120;
    const h = 120;
    const strips = 24;
    const stripH = h / strips;
    // from darker blue at top to headerBg at bottom
    const from = { r: 0.1, g: 0.18, b: 0.32 };
    const to = { r: 0.18, g: 0.28, b: 0.42 };
    for (let i = 0; i < strips; i++) {
      const t = i / (strips - 1);
      const color = rgb(
        from.r + (to.r - from.r) * t,
        from.g + (to.g - from.g) * t,
        from.b + (to.b - from.b) * t,
      );
      currentPage.drawRectangle({
        x: 0,
        y: topY + i * stripH,
        width: pageWidth,
        height: stripH + 0.5,
        color,
        borderWidth: 0,
      });
    }
  }

  function drawHeader(currentPage: PDFPage) {
    drawGradientHeaderBg(currentPage);

    if (logoImage) {
      currentPage.drawImage(logoImage, {
        x: margin,
        y: pageHeight - 85,
        width: 50,
        height: 50,
      });
    } else {
      // Fallback: draw a simple icon placeholder
      currentPage.drawRectangle({
        x: margin,
        y: pageHeight - 85,
        width: 50,
        height: 50,
        borderColor: c.headerMuted,
        borderWidth: 2,
        color: rgb(0.95, 0.95, 0.95),
      });
      currentPage.drawText("G", {
        x: margin + 16,
        y: pageHeight - 70,
        size: 28,
        font: boldFont,
        color: c.primaryBox,
      });
    }

    currentPage.drawText(companyData.name, {
      x: margin + 60,
      y: pageHeight - 40,
      size: 16,
      font: boldFont,
      color: c.headerText,
    });

    currentPage.drawText(`CNPJ: ${companyData.cnpj}`, {
      x: margin + 60,
      y: pageHeight - 55,
      size: 8,
      font: regularFont,
      color: c.headerMuted,
    });

    currentPage.drawText(companyData.address, {
      x: margin + 60,
      y: pageHeight - 70,
      size: 8,
      font: regularFont,
      color: c.headerMuted,
    });

    currentPage.drawText(`Tel: ${companyData.phone}`, {
      x: margin + 60,
      y: pageHeight - 85,
      size: 8,
      font: regularFont,
      color: c.headerMuted,
    });

    drawRoundedRect(
      currentPage,
      pageWidth - 250,
      pageHeight - 100,
      220,
      80,
      8,
      c.primaryBox,
      c.headerMuted,
      1,
    );

    currentPage.drawText(reportTitle, {
      x: pageWidth - 230,
      y: pageHeight - 45,
      size: 12,
      font: boldFont,
      color: c.headerText,
    });

    const periodLabelX = pageWidth - 230;
    const periodLabelWidth = boldFont.widthOfTextAtSize("Período: ", 11);
    currentPage.drawText("Período: ", {
      x: periodLabelX,
      y: pageHeight - 65,
      size: 11,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    const periodParts = data.periodLabel.split(" a ");
    const periodStart = periodParts[0] || data.periodLabel;
    const periodEnd = periodParts[1] || "";
    const periodStartWidth = regularFont.widthOfTextAtSize(periodStart, 11);
    const connectorWidth = boldFont.widthOfTextAtSize(" a ", 11);
    currentPage.drawText(periodStart, {
      x: periodLabelX + periodLabelWidth,
      y: pageHeight - 65,
      size: 11,
      font: regularFont,
      color: c.headerMuted,
    });
    if (periodEnd) {
      currentPage.drawText(" a ", {
        x: periodLabelX + periodLabelWidth + periodStartWidth,
        y: pageHeight - 65,
        size: 11,
        font: boldFont,
        color: rgb(1, 1, 1),
      });
      currentPage.drawText(periodEnd, {
        x: periodLabelX + periodLabelWidth + periodStartWidth + connectorWidth,
        y: pageHeight - 65,
        size: 11,
        font: regularFont,
        color: c.headerMuted,
      });
    }

    const today = new Date().toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
    const emissaoLabelX = pageWidth - 230;
    const emissaoLabelWidth = boldFont.widthOfTextAtSize("Emissão: ", 11);
    currentPage.drawText("Emissão: ", {
      x: emissaoLabelX,
      y: pageHeight - 80,
      size: 11,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    currentPage.drawText(today, {
      x: emissaoLabelX + emissaoLabelWidth,
      y: pageHeight - 80,
      size: 11,
      font: regularFont,
      color: c.headerMuted,
    });
  }

  type SummaryCardTone =
    | "blue"
    | "cyan"
    | "amber"
    | "teal"
    | "slate"
    | "emerald";

  function getSummaryCardTone(tone: SummaryCardTone) {
    switch (tone) {
      case "blue":
        return {
          badgeFill: rgb(0.94, 0.97, 1),
          badgeStroke: rgb(0.81, 0.88, 0.98),
          badgeText: rgb(0.11, 0.27, 0.72),
          titleColor: rgb(0.11, 0.27, 0.72),
          valueColor: rgb(0.05, 0.12, 0.23),
          subtitleColor: c.textMedium,
          accentBorder: rgb(0.81, 0.88, 0.98),
        };
      case "cyan":
        return {
          badgeFill: rgb(0.92, 0.98, 0.99),
          badgeStroke: rgb(0.77, 0.92, 0.95),
          badgeText: rgb(0.09, 0.53, 0.62),
          titleColor: rgb(0.09, 0.53, 0.62),
          valueColor: rgb(0.05, 0.12, 0.23),
          subtitleColor: c.textMedium,
          accentBorder: rgb(0.77, 0.92, 0.95),
        };
      case "amber":
        return {
          badgeFill: rgb(0.99, 0.98, 0.91),
          badgeStroke: rgb(0.94, 0.89, 0.69),
          badgeText: rgb(0.59, 0.47, 0.08),
          titleColor: rgb(0.59, 0.47, 0.08),
          valueColor: rgb(0.39, 0.32, 0.06),
          subtitleColor: c.textMedium,
          accentBorder: rgb(0.94, 0.89, 0.69),
        };
      case "teal":
        return {
          badgeFill: rgb(0.91, 0.98, 0.96),
          badgeStroke: rgb(0.77, 0.92, 0.88),
          badgeText: rgb(0.09, 0.59, 0.49),
          titleColor: rgb(0.09, 0.59, 0.49),
          valueColor: rgb(0.05, 0.12, 0.23),
          subtitleColor: c.textMedium,
          accentBorder: rgb(0.77, 0.92, 0.88),
        };
      case "emerald":
        return {
          badgeFill: rgb(0.92, 0.98, 0.94),
          badgeStroke: rgb(0.78, 0.92, 0.84),
          badgeText: rgb(0.12, 0.48, 0.32),
          titleColor: rgb(0.12, 0.48, 0.32),
          valueColor: rgb(0.05, 0.12, 0.23),
          subtitleColor: c.textMedium,
          accentBorder: rgb(0.78, 0.92, 0.84),
        };
      case "slate":
      default:
        return {
          badgeFill: rgb(0.96, 0.97, 0.99),
          badgeStroke: rgb(0.86, 0.89, 0.94),
          badgeText: rgb(0.35, 0.42, 0.52),
          titleColor: rgb(0.35, 0.42, 0.52),
          valueColor: rgb(0.05, 0.12, 0.23),
          subtitleColor: c.textMedium,
          accentBorder: rgb(0.86, 0.89, 0.94),
        };
    }
  }

  // ── Simple geometric card icons (pdf-lib has no SVG support) ──
  function drawCardIcon(
    currentPage: PDFPage,
    cx: number,
    cy: number,
    size: number,
    iconType: string,
    color: RGB,
  ) {
    const s = size * 0.5;
    switch (iconType) {
      case "document": {
        // page with lines and folded corner
        const w = s * 0.7;
        const h = s * 0.9;
        const x = cx - w / 2;
        const y = cy - h / 2;

        // main page
        currentPage.drawRectangle({
          x,
          y,
          width: w,
          height: h,
          color,
          borderWidth: 0,
        });

        // folded corner triangle (simulated with a small background-colored rectangle at top right)
        const corner = s * 0.25;
        currentPage.drawRectangle({
          x: x + w - corner,
          y: y + h - corner,
          width: corner + 1,
          height: corner + 1,
          color: c.standardBg,
        });

        // lines on page
        const lineW = w * 0.6;
        const lineH = 1.5;
        const lineX = x + w * 0.2;
        [0.3, 0.5, 0.7].forEach((offset) => {
          currentPage.drawRectangle({
            x: lineX,
            y: y + h * offset,
            width: lineW,
            height: lineH,
            color: c.standardBg,
            borderWidth: 0,
          });
        });
        break;
      }
      case "grid": {
        // 2x2 grid with rounded-ish look
        const sq = s * 0.3;
        const g = 2;
        [
          { dx: -sq - g, dy: g },
          { dx: g, dy: g },
          { dx: -sq - g, dy: -sq - g },
          { dx: g, dy: -sq - g },
        ].forEach((pos) => {
          currentPage.drawRectangle({
            x: cx + pos.dx,
            y: cy + pos.dy,
            width: sq,
            height: sq,
            color,
            borderWidth: 0,
          });
        });
        break;
      }
      case "person": {
        // head + rounded shoulders
        currentPage.drawEllipse({
          x: cx,
          y: cy + s * 0.25,
          xScale: s * 0.22,
          yScale: s * 0.22,
          color,
        });
        currentPage.drawRectangle({
          x: cx - s * 0.35,
          y: cy - s * 0.35,
          width: s * 0.7,
          height: s * 0.4,
          color,
          borderWidth: 0,
        });
        // round the shoulders
        currentPage.drawEllipse({
          x: cx - s * 0.35,
          y: cy - s * 0.15,
          xScale: s * 0.1,
          yScale: s * 0.2,
          color,
        });
        currentPage.drawEllipse({
          x: cx + s * 0.35,
          y: cy - s * 0.15,
          xScale: s * 0.1,
          yScale: s * 0.2,
          color,
        });
        break;
      }
      case "people": {
        // two people overlapping
        const drawP = (ox: number, oy: number, sc: number) => {
          currentPage.drawEllipse({
            x: cx + ox,
            y: cy + oy + s * 0.2 * sc,
            xScale: s * 0.18 * sc,
            yScale: s * 0.18 * sc,
            color,
          });
          currentPage.drawRectangle({
            x: cx + ox - s * 0.3 * sc,
            y: cy + oy - s * 0.3 * sc,
            width: s * 0.6 * sc,
            height: s * 0.35 * sc,
            color,
            borderWidth: 0,
          });
        };
        drawP(s * 0.15, s * 0.1, 0.9); // back
        drawP(-s * 0.15, -s * 0.1, 1); // front
        break;
      }
      case "money": {
        // nested coins/circles with a vertical "bill" look
        currentPage.drawEllipse({
          x: cx,
          y: cy,
          xScale: s * 0.4,
          yScale: s * 0.4,
          color,
        });
        currentPage.drawEllipse({
          x: cx,
          y: cy,
          xScale: s * 0.32,
          yScale: s * 0.32,
          color: c.standardBg,
        });
        currentPage.drawEllipse({
          x: cx,
          y: cy,
          xScale: s * 0.25,
          yScale: s * 0.25,
          color,
        });

        // vertical symbol (simulated $)
        currentPage.drawRectangle({
          x: cx - 0.75,
          y: cy - s * 0.3,
          width: 1.5,
          height: s * 0.6,
          color: c.standardBg,
        });
        break;
      }
      case "check": {
        // heavy checkmark
        const thick = 3.5;
        currentPage.drawLine({
          start: { x: cx - s * 0.3, y: cy },
          end: { x: cx - s * 0.05, y: cy - s * 0.25 },
          thickness: thick,
          color,
        });
        currentPage.drawLine({
          start: { x: cx - s * 0.05, y: cy - s * 0.25 },
          end: { x: cx + s * 0.35, y: cy + s * 0.3 },
          thickness: thick,
          color,
        });
        // caps
        currentPage.drawEllipse({
          x: cx - s * 0.3,
          y: cy,
          xScale: thick / 2,
          yScale: thick / 2,
          color,
        });
        currentPage.drawEllipse({
          x: cx + s * 0.35,
          y: cy + s * 0.3,
          xScale: thick / 2,
          yScale: thick / 2,
          color,
        });
        break;
      }
      case "route": {
        // path with start point and end point
        const dotR = 3.5;
        const lineT = 2.5;
        // start (bottom leftish)
        const x1 = cx - s * 0.3;
        const y1 = cy - s * 0.2;
        // mid
        const x2 = cx + s * 0.1;
        const y2 = cy + s * 0.1;
        // end (top rightish)
        const x3 = cx + s * 0.35;
        const y3 = cy + s * 0.35;

        currentPage.drawLine({
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
          thickness: lineT,
          color,
        });
        currentPage.drawLine({
          start: { x: x2, y: y2 },
          end: { x: x3, y: y3 },
          thickness: lineT,
          color,
        });

        currentPage.drawEllipse({
          x: x1,
          y: y1,
          xScale: dotR,
          yScale: dotR,
          color,
        });
        currentPage.drawEllipse({
          x: x3,
          y: y3,
          xScale: dotR + 1,
          yScale: dotR + 1,
          color,
        });
        currentPage.drawEllipse({
          x: x3,
          y: y3,
          xScale: dotR - 1,
          yScale: dotR - 1,
          color: c.standardBg,
        });
        break;
      }
      default: {
        currentPage.drawEllipse({
          x: cx,
          y: cy,
          xScale: s * 0.25,
          yScale: s * 0.25,
          color,
        });
      }
    }
  }

  function drawSummaryBox(
    currentPage: PDFPage,
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    value: string,
    subtitle: string,
    iconType: string,
    tone: SummaryCardTone,
    isEmphasis = false,
  ) {
    const palette = getSummaryCardTone(tone);

    drawRoundedRect(
      currentPage,
      x,
      y,
      width,
      height,
      18,
      c.standardBg,
      isEmphasis ? palette.accentBorder : c.standardBorder,
      isEmphasis ? 1.5 : 1,
    );

    const badgeSize = Math.min(52, height - 28);
    const badgeY = y + (height - badgeSize) / 2;
    const contentX = x + 82;

    // Colored icon background
    drawRoundedRect(
      currentPage,
      x + 16,
      badgeY,
      badgeSize,
      badgeSize,
      14,
      palette.badgeFill,
      palette.badgeStroke,
      1,
    );

    // Geometric icon instead of text
    drawCardIcon(
      currentPage,
      x + 16 + badgeSize / 2,
      badgeY + badgeSize / 2,
      badgeSize,
      iconType,
      palette.badgeText,
    );

    currentPage.drawText(title.toUpperCase(), {
      x: contentX,
      y: y + height - 24,
      size: 11,
      font: boldFont,
      color: palette.titleColor,
    });

    currentPage.drawText(value, {
      x: contentX,
      y: y + height / 2 - 6,
      size: value.length > 11 ? 17 : 20,
      font: boldFont,
      color: palette.valueColor,
    });

    currentPage.drawText(subtitle, {
      x: contentX,
      y: y + 18,
      size: 10,
      font: regularFont,
      color: palette.subtitleColor,
    });
  }

  function drawTableHeader(
    currentPage: PDFPage,
    y: number,
    headers: Array<{ label: string; width: number; align?: string }>,
  ) {
    drawRoundedRect(
      currentPage,
      margin,
      y,
      pageWidth - margin * 2,
      32,
      4,
      c.tableHeader,
      c.tableHeader,
      1,
    );

    let x = margin + 8;
    headers.forEach((header) => {
      const align = header.align || "left";
      const textWidth = boldFont.widthOfTextAtSize(header.label, 9);
      const drawX =
        align === "right"
          ? x + header.width - 4 - textWidth
          : align === "center"
            ? x + (header.width - textWidth) / 2 - 4
            : x;
      currentPage.drawText(header.label, {
        x: drawX,
        y: y + 12,
        size: 9,
        font: boldFont,
        color: c.headerText,
      });
      x += header.width;
    });
  }

  function drawFooter(
    currentPage: PDFPage,
    pageNumber: number,
    totalPages: number,
  ) {
    const footerY = 40;
    currentPage.drawLine({
      start: { x: margin, y: footerY + 15 },
      end: { x: pageWidth - margin, y: footerY + 15 },
      thickness: 1,
      color: c.borderLight,
    });

    currentPage.drawText("Geolog Transportes e Logística Ltda", {
      x: margin,
      y: footerY + 5,
      size: 8,
      font: regularFont,
      color: c.textMedium,
    });

    currentPage.drawText(`CNPJ: ${companyData.cnpj}`, {
      x: margin,
      y: footerY - 8,
      size: 8,
      font: regularFont,
      color: c.textMedium,
    });

    currentPage.drawText(`Página ${pageNumber} de ${totalPages}`, {
      x: pageWidth - margin - 80,
      y: footerY + 5,
      size: 8,
      font: regularFont,
      color: c.textMedium,
    });

    currentPage.drawText("Documento emitido eletronicamente", {
      x: pageWidth - margin - 180,
      y: footerY - 8,
      size: 8,
      font: regularFont,
      color: c.textMedium,
    });
  }

  // Summary boxes configuration per template
  const summaryBoxes: Record<
    ReportTemplate,
    Array<{
      title: string;
      value: string;
      subtitle: string;
      iconType: string;
      tone: SummaryCardTone;
      emphasis?: boolean;
    }>
  > = {
    medicao_cliente: [
      {
        title: "Total OS",
        value: String(data.summary.totalOS),
        subtitle: "Volume total de ordens",
        iconType: "document",
        tone: "blue",
        emphasis: true,
      },
      {
        title: "Centros de custo",
        value: String(data.summary.totalCentrosCusto),
        subtitle: "Centros distintos no período",
        iconType: "grid",
        tone: "cyan",
      },
      {
        title: "Solicitantes",
        value: String(data.summary.totalSolicitantes),
        subtitle: "Solicitantes distintos",
        iconType: "person",
        tone: "teal",
      },
      {
        title: "Passageiros",
        value: String(data.summary.totalPassageiros),
        subtitle: "Passageiros distintos",
        iconType: "people",
        tone: "amber",
      },
      {
        title: "Valor Total",
        value: formatCurrency(data.summary.totalEfetivo),
        subtitle: "Valor total cobrado",
        iconType: "money",
        tone: "emerald",
        emphasis: true,
      },
    ],
    repasse_motorista: [
      {
        title: "Serviços Executados",
        value: String(data.summary.totalOS),
        subtitle: "Volume total de ordens",
        iconType: "document",
        tone: "blue",
        emphasis: true,
      },
      {
        title: "Valor Total",
        value: formatCurrency(
          data.summary.totalCustoAutonomos + data.summary.totalCustoParceiros,
        ),
        subtitle: "Repasses previstos",
        iconType: "money",
        tone: "cyan",
        emphasis: true,
      },
      {
        title: "Já Pago",
        value: formatCurrency(
          data.summary.totalPagoAutonomos + data.summary.totalPagoParceiros,
        ),
        subtitle: "Repasses quitados",
        iconType: "check",
        tone: "emerald",
      },
      {
        title: "Pendente",
        value: formatCurrency(
          data.summary.totalCustoAutonomos +
            data.summary.totalCustoParceiros -
            data.summary.totalPagoAutonomos -
            data.summary.totalPagoParceiros,
        ),
        subtitle: "Saldo em aberto",
        iconType: "document",
        tone: "amber",
        emphasis: true,
      },
      {
        title: "Itinerários",
        value: String(data.summary.totalWaypoints),
        subtitle: "Total de waypoints",
        iconType: "route",
        tone: "teal",
      },
    ],
    performance: [
      {
        title: "Total OS",
        value: String(data.summary.totalOS),
        subtitle: "Volume total de ordens",
        iconType: "document",
        tone: "blue",
        emphasis: true,
      },
      {
        title: "Faturamento Bruto",
        value: formatCurrency(data.summary.totalBruto),
        subtitle: "Receita bruta",
        iconType: "money",
        tone: "blue",
      },
      {
        title: "Custos",
        value: formatCurrency(data.summary.totalCusto),
        subtitle: "Custos operacionais",
        iconType: "grid",
        tone: "slate",
      },
      {
        title: "Impostos",
        value: formatCurrency(data.summary.totalImposto),
        subtitle: "Tributos apurados",
        iconType: "document",
        tone: "amber",
      },
      {
        title: "Lucro Líquido",
        value: formatCurrency(data.summary.totalLucro),
        subtitle: "Resultado final",
        iconType: "money",
        tone: "emerald",
        emphasis: true,
      },
      {
        title: "Margem",
        value:
          data.summary.totalBruto > 0
            ? `${((data.summary.totalLucro / data.summary.totalBruto) * 100).toFixed(1)}%`
            : "0%",
        subtitle: "Eficiência operacional",
        iconType: "document",
        tone: "teal",
      },
    ],
    liberadas_faturamento: [
      {
        title: "Total OS Liberadas",
        value: String(data.summary.totalOS),
        subtitle: "Prontas para faturar",
        iconType: "document",
        tone: "blue",
        emphasis: true,
      },
      {
        title: "Valor Total",
        value: formatCurrency(data.summary.totalBruto),
        subtitle: "Total liberado",
        iconType: "money",
        tone: "cyan",
        emphasis: true,
      },
    ],
    pendentes_repasse: [
      {
        title: "Total OS Pendentes",
        value: String(data.summary.totalOS),
        subtitle: "Itens em aberto",
        iconType: "document",
        tone: "blue",
        emphasis: true,
      },
      {
        title: "Custo Total Pendente",
        value: formatCurrency(
          data.summary.totalCustoAutonomos +
            data.summary.totalCustoParceiros -
            data.summary.totalPagoAutonomos -
            data.summary.totalPagoParceiros,
        ),
        subtitle: "Saldo total pendente",
        iconType: "money",
        tone: "amber",
        emphasis: true,
      },
    ],
    resumo_motoristas: [
      {
        title: "Total de Motoristas",
        value: String(
          new Set(data.rows.map((r) => r.driver_id).filter(Boolean)).size,
        ),
        subtitle: "Motoristas distintos no período",
        iconType: "people",
        tone: "blue",
        emphasis: true,
      },
      {
        title: "Serviços Realizados",
        value: String(data.summary.totalOS),
        subtitle: "Volume total de ordens",
        iconType: "document",
        tone: "cyan",
        emphasis: true,
      },
      {
        title: "Valor Total",
        value: formatCurrency(
          data.summary.totalCustoAutonomos + data.summary.totalCustoParceiros,
        ),
        subtitle: "Repasses previstos",
        iconType: "money",
        tone: "emerald",
        emphasis: true,
      },
      {
        title: "Já Pago",
        value: formatCurrency(
          data.summary.totalPagoAutonomos + data.summary.totalPagoParceiros,
        ),
        subtitle: "Repasses quitados",
        iconType: "check",
        tone: "teal",
      },
      {
        title: "Pendente",
        value: formatCurrency(
          data.summary.totalCustoAutonomos +
            data.summary.totalCustoParceiros -
            data.summary.totalPagoAutonomos -
            data.summary.totalPagoParceiros,
        ),
        subtitle: "Saldo em aberto",
        iconType: "document",
        tone: "amber",
        emphasis: true,
      },
    ],
  };

  // Table headers per template
  const tableHeadersMap: Record<
    ReportTemplate,
    Array<{ label: string; width: number; key: string; align?: string }>
  > = {
    medicao_cliente: [
      { label: "Protocolo/Data", width: 80, key: "protocolo_data" },
      { label: "OS", width: 60, key: "os" },
      { label: "Centro de Custo", width: 100, key: "centro_custo" },
      { label: "Solicitante", width: 120, key: "solicitante" },
      { label: "Passageiros", width: 120, key: "passageiros" },
      { label: "Trajeto Realizado", width: 210, key: "trajeto" },
      { label: "Valor", width: 88, key: "valor" },
    ],
    repasse_motorista: [
      { label: "Data", width: 50, key: "data" },
      { label: "Protocolo Geolog", width: 75, key: "protocolo" },
      { label: "Status", width: 55, key: "status" },
      { label: "Tipo", width: 50, key: "tipo" },
      { label: "Parceiro", width: 100, key: "parceiro" },
      { label: "Motorista", width: 125, key: "motorista" },
      { label: "Trajeto realizado", width: 173, key: "trajeto" },
      { label: "Veículo usado", width: 75, key: "veiculo" },
      { label: "Valor", width: 75, key: "custo" },
    ],
    performance: [
      { label: "Protocolo", width: 80, key: "protocolo" },
      { label: "OS", width: 60, key: "os" },
      { label: "Data", width: 80, key: "data" },
      { label: "Cliente", width: 160, key: "cliente" },
      { label: "Bruto", width: 100, key: "bruto" },
      { label: "Custo", width: 100, key: "custo" },
      { label: "Imposto", width: 100, key: "imposto" },
      { label: "Lucro", width: 100, key: "lucro" },
      { label: "Margem", width: 70, key: "margem" },
    ],
    liberadas_faturamento: [
      { label: "Protocolo", width: 110, key: "protocolo" },
      { label: "OS", width: 90, key: "os" },
      { label: "Data", width: 100, key: "data" },
      { label: "Cliente", width: 260, key: "cliente" },
      { label: "Motorista", width: 200, key: "motorista" },
      { label: "Valor", width: 120, key: "valor" },
    ],
    pendentes_repasse: [
      { label: "Protocolo", width: 100, key: "protocolo" },
      { label: "OS", width: 80, key: "os" },
      { label: "Data", width: 90, key: "data" },
      { label: "Destinatário", width: 260, key: "destinatario" },
      { label: "Custo", width: 120, key: "custo" },
      { label: "Status Fin.", width: 100, key: "status" },
    ],
    resumo_motoristas: [
      { label: "Motorista/Parceiro", width: 180, key: "nome", align: "left" },
      { label: "Tipo", width: 75, key: "tipo", align: "center" },
      { label: "Serviços", width: 65, key: "servicos", align: "center" },
      { label: "Pagos", width: 55, key: "pagos", align: "center" },
      { label: "Pendentes", width: 65, key: "pendentes", align: "center" },
      { label: "Valor Total", width: 95, key: "valorTotal", align: "right" },
      { label: "Valor Pago", width: 95, key: "valorPago", align: "right" },
      {
        label: "Valor Pendente",
        width: 105,
        key: "valorPendente",
        align: "right",
      },
    ],
  };

  // Build pages
  // Para repasse_motorista: a coluna "Parceiro" só aparece quando o
  // relatório inclui parceiros — ou seja, quando o filtro é por parceiro
  // ou quando é "Todos" (sem filtro de motorista individual). Se o
  // filtro é por um motorista autônomo/interno específico, a coluna é
  // omitida e sua largura é redistribuída para as demais colunas para
  // preencher 100% da área da tabela.
  let headers = tableHeadersMap[template];
  if (
    template === "repasse_motorista" &&
    filters.driverId &&
    !filters.parceiroId
  ) {
    const driverDetail = filters.driverId
      ? data.driverDetailMap.get(filters.driverId)
      : undefined;
    const isParceiroDriver =
      driverDetail?.parceiro_id !== null &&
      driverDetail?.parceiro_id !== undefined;
    if (!isParceiroDriver) {
      // Remove a coluna "parceiro" e redistribui seus 100px:
      // +10 Protocolo, +25 Motorista, +55 Trajeto, +10 Veículo
      headers = headers
        .filter((h) => h.key !== "parceiro")
        .map((h) => {
          if (h.key === "protocolo") return { ...h, width: h.width + 10 };
          if (h.key === "motorista") return { ...h, width: h.width + 25 };
          if (h.key === "trajeto") return { ...h, width: h.width + 55 };
          if (h.key === "veiculo") return { ...h, width: h.width + 10 };
          return h;
        });
    }
  }
  const boxes = summaryBoxes[template];

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - margin;

  drawHeader(page);

  // Draw summary boxes (4 per row)
  if (
    template === "medicao_cliente" ||
    template === "repasse_motorista" ||
    template === "resumo_motoristas"
  ) {
    const isMedicao = template === "medicao_cliente";
    const isRepasseMotorista = template === "repasse_motorista";
    const isResumo = template === "resumo_motoristas";
    // Add title
    const titleText = isMedicao
      ? "RELATÓRIO DE MEDIÇÃO"
      : isResumo
        ? "RESUMO GERAL DE MOTORISTAS"
        : "RELATÓRIO DE REPASSE A MOTORISTAS";

    const titleWidth = regularFont.widthOfTextAtSize(titleText, 10);
    page.drawText(titleText, {
      x: (pageWidth - titleWidth) / 2 + 10,
      y: pageHeight - 155,
      size: 10,
      font: regularFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Nome do destinatário: só mostra quando há filtro específico.
    // Sem filtro, exibe "RELATÓRIO GERAL DE ..." (igual ao Excel).
    let displayName: string;
    if (isMedicao) {
      const selectedClientId = filters.clienteId || data.rows[0]?.cliente_id;
      displayName = sanitizePdfText(
        selectedClientId
          ? data.clienteMap.get(selectedClientId) || "GERAL"
          : "GERAL",
      );
    } else if (isRepasseMotorista) {
      // Prioriza o motorista específico; se só o parceiro foi filtrado
      // (todos os motoristas dele), mostra o nome do parceiro.
      displayName = filters.driverId
        ? sanitizePdfText(data.driverMap.get(filters.driverId) || "GERAL")
        : filters.parceiroId
          ? sanitizePdfText(data.parceiroMap.get(filters.parceiroId) || "GERAL")
          : "";
    } else if (isResumo) {
      // Resumo geral não tem filtro de entidade — sempre "GERAL"
      displayName = "";
    } else {
      displayName = "";
    }

    // Sem filtro: título "RELATÓRIO GERAL DE ..." centralizado.
    // Com filtro: nome do destinatário em destaque.
    if (!displayName || displayName === "GERAL" || displayName === "") {
      const generalTitleMap = {
        medicao_cliente: "RELATÓRIO GERAL DE MEDIÇÃO",
        repasse_motorista: "RELATÓRIO GERAL DE REPASSE A MOTORISTAS",
        resumo_motoristas: "RESUMO GERAL DE MOTORISTAS",
      } as const;
      const generalTitle =
        generalTitleMap[template as keyof typeof generalTitleMap] ||
        "RELATÓRIO GERAL";
      const generalWidth = boldFont.widthOfTextAtSize(generalTitle, 14);
      page.drawText(generalTitle, {
        x: (pageWidth - generalWidth) / 2 + 10,
        y: pageHeight - 190,
        size: 14,
        font: boldFont,
        color: rgb(0.05, 0.12, 0.23),
      });
    } else {
      const nameWidth = boldFont.widthOfTextAtSize(
        displayName.toUpperCase(),
        18,
      );
      page.drawText(displayName.toUpperCase(), {
        x: (pageWidth - nameWidth) / 2 + 10,
        y: pageHeight - 190,
        size: 18,
        font: boldFont,
        color: rgb(0.05, 0.12, 0.23),
      });
    }

    const cardGap = 16;
    const cardWidth = (pageWidth - margin * 2 - cardGap * 2) / 3;
    const cardHeight = 108;
    const firstRowY = 240;
    const secondRowY = 120;
    const firstRow = boxes.slice(0, 3);
    const secondRow = boxes.slice(3);

    firstRow.forEach((box, index) => {
      const x = margin + index * (cardWidth + cardGap);
      drawSummaryBox(
        page,
        x,
        firstRowY,
        cardWidth,
        cardHeight,
        box.title,
        box.value,
        box.subtitle,
        box.iconType,
        box.tone,
        box.emphasis,
      );
    });

    secondRow.forEach((box, index) => {
      const x =
        margin + (cardWidth + cardGap) / 2 + index * (cardWidth + cardGap);
      drawSummaryBox(
        page,
        x,
        secondRowY,
        cardWidth,
        cardHeight,
        box.title,
        box.value,
        box.subtitle,
        box.iconType,
        box.tone,
        box.emphasis,
      );
    });
  } else {
    const boxWidth = (pageWidth - margin * 2 - 12 * 3) / 4;
    const boxHeight = 84;
    const boxGap = 12;
    let boxRow = 0;
    let boxCol = 0;

    for (const box of boxes) {
      const x = margin + boxCol * (boxWidth + boxGap);
      const y = pageHeight - 200 - boxRow * (boxHeight + boxGap);
      drawSummaryBox(
        page,
        x,
        y,
        boxWidth,
        boxHeight,
        box.title,
        box.value,
        box.subtitle,
        box.iconType,
        box.tone,
        box.emphasis,
      );
      boxCol++;
      if (boxCol >= 4) {
        boxCol = 0;
        boxRow++;
      }
    }
  }

  // Dashboard/cards page ends here. Table starts on a new page.
  page = pdfDoc.addPage([pageWidth, pageHeight]);
  drawHeader(page);

  // Start table header lower to avoid any overlap with info box
  currentY = pageHeight - 170;
  drawTableHeader(page, currentY, headers);

  // currentY will track the top of the next row.
  // We leave a small padding between header and first row.
  currentY -= 4;

  // Resumo consolidado por motorista — uma linha por motorista, não por OS.
  if (template === "resumo_motoristas") {
    type PdfSummary = {
      nome: string;
      tipo: string;
      servicos: number;
      pagos: number;
      pendentes: number;
      valorTotal: number;
      valorPago: number;
      valorPendente: number;
    };
    const pdfDriverMap = new Map<string, PdfSummary>();
    for (const row of data.rows) {
      if (!row.driver_id) continue;
      const driverDetail = data.driverDetailMap.get(row.driver_id);
      const nome =
        data.driverMap.get(row.driver_id) || row.motorista || "Desconhecido";
      let tipo = "Autônomo";
      if (row.tipo === "freelance") tipo = "Freelance";
      else if (driverDetail?.parceiro_id) tipo = "Parceiro";
      else if (driverDetail?.vinculo_tipo === "interno") tipo = "Interno";

      let entry = pdfDriverMap.get(row.driver_id);
      if (!entry) {
        entry = {
          nome,
          tipo,
          servicos: 0,
          pagos: 0,
          pendentes: 0,
          valorTotal: 0,
          valorPago: 0,
          valorPendente: 0,
        };
        pdfDriverMap.set(row.driver_id, entry);
      }
      const custo = calcEffectiveCustoValue(row);
      entry.servicos++;
      entry.valorTotal += custo;
      if (row.repasse_pago) {
        entry.pagos++;
        entry.valorPago += custo;
      } else {
        entry.pendentes++;
        entry.valorPendente += custo;
      }
    }
    const pdfSummaries = Array.from(pdfDriverMap.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    );

    let pdfTotalServicos = 0;
    let pdfTotalPagos = 0;
    let pdfTotalPendentes = 0;
    let pdfTotalValor = 0;
    let pdfTotalPago = 0;
    let pdfTotalPendente = 0;

    pdfSummaries.forEach((s, idx) => {
      const rowHeight = 28;
      if (currentY - rowHeight < margin + 20) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        drawHeader(page);
        currentY = pageHeight - 170;
        drawTableHeader(page, currentY, headers);
        currentY -= 4;
      }

      const isEven = idx % 2 === 0;
      currentY -= rowHeight;
      (page as PDFPage).drawRectangle({
        x: margin,
        y: currentY,
        width: pageWidth - margin * 2,
        height: rowHeight,
        color: isEven ? c.tableZebra : c.tableWhite,
      });

      const cellValues: Array<{
        text: string;
        align: "left" | "right" | "center";
        bold: boolean;
      }> = [
        {
          text: truncateText(sanitizePdfText(s.nome), 35),
          align: "left",
          bold: true,
        },
        { text: s.tipo, align: "center", bold: false },
        { text: String(s.servicos), align: "center", bold: false },
        { text: String(s.pagos), align: "center", bold: false },
        { text: String(s.pendentes), align: "center", bold: false },
        { text: formatCurrency(s.valorTotal), align: "right", bold: true },
        { text: formatCurrency(s.valorPago), align: "right", bold: false },
        { text: formatCurrency(s.valorPendente), align: "right", bold: false },
      ];

      let x = margin + 8;
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i];
        const cv = cellValues[i];
        const font = cv.bold ? boldFont : regularFont;
        const drawX =
          cv.align === "right"
            ? x + h.width - 4 - font.widthOfTextAtSize(cv.text, 9)
            : cv.align === "center"
              ? x + (h.width - font.widthOfTextAtSize(cv.text, 9)) / 2 - 4
              : x;
        (page as PDFPage).drawText(cv.text, {
          x: drawX,
          y: currentY + rowHeight / 2 - 4,
          size: 9,
          font,
          color: cv.bold ? c.accentGreen : c.textDark,
        });
        x += h.width;
      }

      pdfTotalServicos += s.servicos;
      pdfTotalPagos += s.pagos;
      pdfTotalPendentes += s.pendentes;
      pdfTotalValor += s.valorTotal;
      pdfTotalPago += s.valorPago;
      pdfTotalPendente += s.valorPendente;
    });

    // Linha de TOTAL
    const totalRowHeight = 30;
    if (currentY - totalRowHeight < margin + 20) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      drawHeader(page);
      currentY = pageHeight - 170;
      drawTableHeader(page, currentY, headers);
      currentY -= 4;
    }
    currentY -= totalRowHeight;
    (page as PDFPage).drawRectangle({
      x: margin,
      y: currentY,
      width: pageWidth - margin * 2,
      height: totalRowHeight,
      color: rgb(0.05, 0.12, 0.23),
    });
    const totalCellValues: Array<{
      text: string;
      align: "left" | "right" | "center";
    }> = [
      { text: "TOTAL", align: "left" },
      { text: "", align: "center" },
      { text: String(pdfTotalServicos), align: "center" },
      { text: String(pdfTotalPagos), align: "center" },
      { text: String(pdfTotalPendentes), align: "center" },
      { text: formatCurrency(pdfTotalValor), align: "right" },
      { text: formatCurrency(pdfTotalPago), align: "right" },
      { text: formatCurrency(pdfTotalPendente), align: "right" },
    ];
    let tx = margin + 8;
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      const cv = totalCellValues[i];
      if (!cv.text) {
        tx += h.width;
        continue;
      }
      const drawX =
        cv.align === "right"
          ? tx + h.width - 4 - boldFont.widthOfTextAtSize(cv.text, 10)
          : cv.align === "center"
            ? tx + (h.width - boldFont.widthOfTextAtSize(cv.text, 10)) / 2 - 4
            : tx;
      (page as PDFPage).drawText(cv.text, {
        x: drawX,
        y: currentY + totalRowHeight / 2 - 4,
        size: 10,
        font: boldFont,
        color: rgb(1, 1, 1),
      });
      tx += h.width;
    }
  } else {
    data.rows.forEach((row: FinanceRow, index: number) => {
      const isMedicaoCliente = template === "medicao_cliente";
      const baseRowHeight = isMedicaoCliente ? 45 : 36;

      // Fetch related data
      const clienteNome = data.clienteMap.get(row.cliente_id || "") || "-";
      const centroCustoNome =
        data.centroCustoMap.get(row.centro_custo_id || "") || "";
      const motoristaNome =
        data.driverMap.get(row.driver_id || "") || row.motorista || "-";
      const waypoints = data.waypointsMap.get(row.id) || [];
      const passageirosList = Array.from(
        new Set(
          waypoints
            .flatMap((wp) => wp.passengers?.map((p) => p.nome))
            .filter(Boolean),
        ),
      ) as string[];
      const trajetoList = waypoints.map((wp) => wp.label).filter(Boolean);

      const driver = row.driver_id
        ? data.driverDetailMap.get(row.driver_id)
        : undefined;
      const parceiroNome = driver?.parceiro_id
        ? data.parceiroMap.get(driver.parceiro_id) || "-"
        : "";
      const veiculoNome = data.vehicleMap.get(row.veiculo_id || "") || "-";
      const status = row.status_financeiro || "Pendente";

      // First pass: compute all cell texts and measure heights
      type RouteSegment = {
        type: "header" | "origem" | "parada" | "destino";
        text: string;
        dateTime?: string;
        wrappedLines?: string[];
      };
      const cellData: Array<{
        text: string;
        font: PDFFont;
        color: RGB;
        size: number;
        isMultiLine: boolean;
        maxWidth: number;
        lineHeight: number;
        align: "left" | "right";
        routeSegments?: RouteSegment[];
        custoTagLines?: string[];
      }> = [];

      let maxContentHeight = baseRowHeight;

      for (const h of headers) {
        let text = "";
        let font = regularFont;
        let color = c.textDark;
        let size = 9;

        switch (h.key) {
          case "protocolo_data":
            text = `${sanitizePdfText(row.protocolo) || "-"}\n${formatDate(row.data)}`;
            size = 8;
            break;
          case "protocolo":
            text = sanitizePdfText(row.protocolo) || "-";
            break;
          case "os":
            text = sanitizePdfText(row.os_number) || "-";
            size = 8;
            font = boldFont;
            break;
          case "centro_custo":
            text = sanitizePdfText(centroCustoNome) || "-";
            size = 8;
            break;
          case "solicitante":
            text = sanitizePdfText(row.solicitante) || "-";
            size = 8;
            break;
          case "passageiros":
            text = sanitizePdfText(passageirosList.join(", "));
            size = 7;
            break;
          case "trajeto":
            if (template === "repasse_motorista") {
              // routeSegments will be set below; text is left empty
              size = 6.5;
            } else {
              text = sanitizePdfText(trajetoList.join(" -> "));
              size = 7;
            }
            break;
          case "tipo":
            text = getRowVinculoTipo(row, driver);
            font = boldFont;
            size = 8;
            break;
          case "cliente": {
            const lines = [truncateText(sanitizePdfText(clienteNome), 35)];
            if (centroCustoNome)
              lines.push(truncateText(sanitizePdfText(centroCustoNome), 35));
            text = lines.join("\n");
            if (lines.length > 1) size = 8;
            break;
          }
          case "motorista":
            // No repasse_motorista o texto quebra em múltiplas linhas (wrap),
            // então não truncamos — preservamos o nome completo. Nos demais
            // templates mantemos o truncate em linha única.
            text =
              template === "repasse_motorista"
                ? sanitizePdfText(motoristaNome) || "-"
                : truncateText(sanitizePdfText(motoristaNome), 25);
            break;
          case "data":
            text = formatDate(row.data);
            break;
          case "valor":
          case "bruto":
            text = formatCurrencyOrIsento(
              template === "medicao_cliente"
                ? calcEffectiveClientValue(row)
                : Number(row.valor_bruto || 0),
              row.isento_valor_bruto,
            );
            font = boldFont;
            color = row.isento_valor_bruto ? c.textMedium : c.accentGreen;
            break;
          case "custo":
            text = formatCurrencyOrIsento(
              calcEffectiveCustoValue(row),
              row.isento_custo,
            );
            font = boldFont;
            color = row.isento_custo
              ? c.textMedium
              : template === "repasse_motorista"
                ? c.accentGreen
                : c.accentRed;
            break;
          case "imposto":
            text = formatCurrency(Number(row.imposto || 0));
            break;
          case "lucro": {
            const l = Number(row.lucro || 0);
            text = formatCurrency(l);
            color = l >= 0 ? c.accentGreen : c.accentRed;
            font = boldFont;
            break;
          }
          case "margem": {
            const bruto = Number(row.valor_bruto || 0);
            const lucro = Number(row.lucro || 0);
            text = bruto > 0 ? `${((lucro / bruto) * 100).toFixed(1)}%` : "0%";
            break;
          }
          case "status":
            if (template === "repasse_motorista") {
              text = row.repasse_pago ? "Pago" : "Pendente";
              font = boldFont;
              color = row.repasse_pago ? c.accentGreen : c.accentRed;
            } else {
              text = status;
              font = boldFont;
              color = status === "Recebido" ? c.accentGreen : c.textDark;
            }
            break;
          case "parceiro_motorista": {
            const partnerLine = sanitizePdfText(parceiroNome) || "-";
            const driverLine = sanitizePdfText(motoristaNome) || "-";
            text = `${partnerLine}\n${driverLine}`;
            font = boldFont;
            size = 10;
            break;
          }
          case "pago":
            text = row.repasse_pago ? "Sim" : "Não";
            font = boldFont;
            color = row.repasse_pago ? c.accentGreen : c.accentRed;
            break;
          case "parceiro":
            // No repasse_motorista o texto quebra em múltiplas linhas (wrap),
            // então não truncamos — preservamos o nome completo do parceiro.
            text = sanitizePdfText(parceiroNome) || "-";
            break;
          case "destinatario": {
            const isParceiro =
              driver?.parceiro_id !== null && driver?.parceiro_id !== undefined;
            text = sanitizePdfText(isParceiro ? parceiroNome : motoristaNome);
            break;
          }
          case "veiculo": {
            const vehText = sanitizePdfText(veiculoNome);
            if (vehText === "-") {
              text = "-";
            } else {
              const parts = vehText.split(" - ", 2);
              const placaPart = parts[0] || "-";
              // No repasse_motorista o modelo quebra em múltiplas linhas (wrap),
              // então não truncamos. Nos demais templates mantemos o truncate.
              const modeloPart =
                parts[1] && template !== "repasse_motorista"
                  ? truncateText(parts[1], 22)
                  : parts[1] || "";
              text = modeloPart ? `${placaPart}\n${modeloPart}` : placaPart;
            }
            size = 8;
            break;
          }
        }

        const isMultiLine =
          h.key === "protocolo_data" ||
          h.key === "os" ||
          h.key === "centro_custo" ||
          h.key === "solicitante" ||
          h.key === "passageiros" ||
          h.key === "trajeto" ||
          h.key === "parceiro_motorista" ||
          h.key === "veiculo" ||
          (template === "repasse_motorista" &&
            (h.key === "parceiro" || h.key === "motorista"));
        const lineH = size + 2;
        const maxW = h.width - 10;
        const align =
          h.key === "custo" && template === "repasse_motorista"
            ? "left"
            : h.key === "valor" && template === "medicao_cliente"
              ? "left"
              : h.key === "valor" || h.key === "bruto" || h.key === "custo"
                ? "right"
                : "left";

        // Build structured route segments for trajeto (medicao_cliente & repasse_motorista)
        let routeSegments: RouteSegment[] | undefined;
        if (
          h.key === "trajeto" &&
          (template === "repasse_motorista" || template === "medicao_cliente")
        ) {
          routeSegments = [];

          // Group waypoints by itinerary_index
          const itineraryGroups = new Map<number, ReportWaypoint[]>();
          for (const wp of waypoints) {
            const idx = wp.itinerary_index ?? 0;
            if (!itineraryGroups.has(idx)) itineraryGroups.set(idx, []);
            itineraryGroups.get(idx)!.push(wp);
          }
          const sortedIndices = Array.from(itineraryGroups.keys()).sort(
            (a, b) => a - b,
          );
          const hasMultiple = sortedIndices.length > 1;

          for (let gi = 0; gi < sortedIndices.length; gi++) {
            const group = itineraryGroups.get(sortedIndices[gi])!;

            // Section header when there are multiple itineraries
            if (hasMultiple) {
              const headerLabel =
                gi === 0
                  ? `ITINERÁRIO ${gi + 1}`
                  : `RETORNO / ITINERÁRIO ${gi + 1}`;
              const headerDateTime = formatDateTime(
                group[0]?.data,
                group[0]?.hora,
              );
              routeSegments.push({
                type: "header",
                text: headerLabel,
                dateTime: headerDateTime !== "-" ? headerDateTime : undefined,
              });
            }

            for (let i = 0; i < group.length; i++) {
              const wp = group[i];
              const type: RouteSegment["type"] =
                i === 0
                  ? "origem"
                  : i === group.length - 1
                    ? "destino"
                    : "parada";
              const label =
                sanitizePdfText(wp.label) || "Endereco nao informado";
              const text =
                template === "medicao_cliente"
                  ? truncateText(label, 30)
                  : label;
              routeSegments.push({
                type,
                text,
                wrappedLines:
                  template === "repasse_motorista"
                    ? wrapTextToLines(
                        text,
                        size,
                        regularFont,
                        Math.max(60, h.width - 55),
                      )
                    : undefined,
              });
            }
          }

          if (routeSegments.length === 0) {
            routeSegments.push({ type: "origem", text: "-" });
          }

          // height: header lines are shorter (size+5) to create whitespace between itineraries
          const segH = routeSegments.reduce((acc, seg) => {
            const lineCount = seg.wrappedLines?.length ?? 1;
            const lineHeight = seg.type === "header" ? size + 5 : size + 3;
            return acc + lineCount * lineHeight;
          }, 10);
          maxContentHeight = Math.max(maxContentHeight, segH);
        } else if (h.key === "veiculo" && template === "repasse_motorista") {
          // Cálculo preciso considerando wrap de placa e modelo
          const [placaLine = "-", modeloLine = ""] = text.split("\n");
          const placaLines = wrapTextToLines(placaLine, 10, boldFont, maxW);
          const modeloLines = modeloLine
            ? wrapTextToLines(modeloLine, 9, regularFont, maxW)
            : [];
          const veicH =
            placaLines.length * 12 +
            (modeloLines.length > 0 ? 4 + modeloLines.length * 11 : 0);
          maxContentHeight = Math.max(maxContentHeight, veicH + 10);
        } else if (isMultiLine) {
          const contentHeight = calculateMultiLineHeight(
            text,
            size,
            font,
            maxW,
            lineH,
          );
          maxContentHeight = Math.max(maxContentHeight, contentHeight + 10);
        } else if (text.includes("\n")) {
          const lines = text.split("\n").length;
          maxContentHeight = Math.max(maxContentHeight, lines * lineH + 10);
        }

        // Indica NO-SHOW e/ou Hora Extra abaixo do valor de repasse, exibindo
        // o percentual/tempo aplicado (ex: "NO-SHOW (50%)", "H.EXTRA (01:30)").
        let custoTagLines: string[] | undefined;
        if (
          h.key === "custo" &&
          template === "repasse_motorista" &&
          !row.isento_custo
        ) {
          const tagSize = 6.5;
          const tags: string[] = [];
          if (row.no_show) {
            tags.push(`NO-SHOW (${row.no_show_percentual ?? 100}%)`);
          }
          const heBilledMinutes = calcBilledMinutes(
            parseHoraExtraMinutes(row.hora_extra),
          );
          if (heBilledMinutes > 0) {
            tags.push(`H.EXTRA (${formatBilledHours(heBilledMinutes)})`);
          }
          if (tags.length > 0) {
            custoTagLines = tags.flatMap((tag) =>
              wrapTextToLines(tag, tagSize, regularFont, maxW),
            );
            const tagsHeight = custoTagLines.length * (tagSize + 2);
            maxContentHeight = Math.max(
              maxContentHeight,
              size + 3 + tagsHeight + 10,
            );
          }
        }

        cellData.push({
          text,
          font,
          color,
          size,
          isMultiLine,
          maxWidth: maxW,
          lineHeight: lineH,
          align,
          routeSegments,
          custoTagLines,
        });
      }

      const rowHeight = maxContentHeight;

      // Check pagination
      if (currentY - rowHeight < margin + 20) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        drawHeader(page);
        currentY = pageHeight - 170;
        drawTableHeader(page, currentY, headers);
        currentY -= 4;
      }

      const isEven = index % 2 === 0;
      currentY -= rowHeight;

      (page as PDFPage).drawRectangle({
        x: margin,
        y: currentY,
        width: pageWidth - margin * 2,
        height: rowHeight,
        color: isEven ? c.tableZebra : c.tableWhite,
      });

      let x = margin + 8;
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i];
        const cell = cellData[i];

        if (h.key === "trajeto" && cell.routeSegments) {
          const segColors: Record<string, RGB> = {
            origem: rgb(0.08, 0.48, 0.28),
            parada: rgb(0.56, 0.62, 0.72),
            destino: rgb(0.16, 0.42, 0.78),
          };
          const segLabels: Record<string, string> = {
            origem: "ORIGEM: ",
            parada: "PARADA: ",
            destino: "DESTINO: ",
          };
          const segSize = cell.size;
          let segY = currentY + rowHeight - 9;

          for (const seg of cell.routeSegments) {
            if (seg.type === "header") {
              // Section label with blank line before the next itinerary
              (page as PDFPage).drawText(seg.text, {
                x: x + 2,
                y: segY - 1,
                size: segSize - 1,
                font: boldFont,
                color: rgb(0.88, 0.53, 0.12),
              });
              if (seg.dateTime) {
                const labelWidth = boldFont.widthOfTextAtSize(
                  seg.text,
                  segSize - 1,
                );
                const dash = " - ";
                const dashWidth = boldFont.widthOfTextAtSize(dash, segSize - 1);
                (page as PDFPage).drawText(dash, {
                  x: x + 2 + labelWidth,
                  y: segY - 1,
                  size: segSize - 1,
                  font: boldFont,
                  color: c.textMedium,
                });
                const dateSize = segSize + 1;
                (page as PDFPage).drawText(seg.dateTime, {
                  x: x + 2 + labelWidth + dashWidth,
                  y: segY - 1,
                  size: dateSize,
                  font: regularFont,
                  color: c.textMedium,
                });
                segY -= segSize + 5;
              } else {
                segY -= segSize + 5;
              }
            } else {
              const col = segColors[seg.type];
              const lbl = segLabels[seg.type];
              const lblWidth = boldFont.widthOfTextAtSize(lbl, segSize - 0.5);
              const lines = seg.wrappedLines || [seg.text];
              const lineStep = segSize + 2;

              lines.forEach((line, lineIndex) => {
                const lineY = segY - lineIndex * lineStep;

                if (lineIndex === 0) {
                  // bullet circle
                  (page as PDFPage).drawEllipse({
                    x: x + 3,
                    y: lineY + segSize * 0.3,
                    xScale: 2.5,
                    yScale: 2.5,
                    color: col,
                  });
                  // label
                  (page as PDFPage).drawText(lbl, {
                    x: x + 8,
                    y: lineY,
                    size: segSize - 0.5,
                    font: boldFont,
                    color: col,
                  });
                }

                // address
                (page as PDFPage).drawText(line, {
                  x: x + 12 + lblWidth,
                  y: lineY,
                  size: segSize,
                  font: regularFont,
                  color: c.textDark,
                });
              });
              segY -=
                lines.length * lineStep + (seg.type === "destino" ? 7 : 3);
            }
          }
        } else if (h.key === "protocolo_data") {
          const [protocolLine = "-", dateLine = ""] = cell.text.split("\n");
          const protocolSize = 10;
          const dateSize = 9;
          const protocolY = currentY + rowHeight - 10;
          const dateY = protocolY - 15;

          (page as PDFPage).drawText(protocolLine, {
            x,
            y: protocolY,
            size: protocolSize,
            font: boldFont,
            color: cell.color,
          });
          if (dateLine) {
            (page as PDFPage).drawText(dateLine, {
              x,
              y: dateY,
              size: dateSize,
              font: regularFont,
              color: c.textMedium,
            });
          }
        } else if (h.key === "parceiro_motorista") {
          const [partnerLine = "-", driverLine = "-"] = cell.text.split("\n");
          const partnerSize = 10;
          const driverSize = 8.5;
          const gap = 4;
          const partnerLines = wrapTextToLines(
            partnerLine,
            partnerSize,
            boldFont,
            cell.maxWidth,
          );
          const driverLines = wrapTextToLines(
            driverLine,
            driverSize,
            regularFont,
            cell.maxWidth,
          );
          const partnerStep = partnerSize + 2;
          const driverStep = driverSize + 2;
          let currentTextY = currentY + rowHeight - 10;

          partnerLines.forEach((line) => {
            (page as PDFPage).drawText(line, {
              x,
              y: currentTextY,
              size: partnerSize,
              font: boldFont,
              color: cell.color,
            });
            currentTextY -= partnerStep;
          });

          currentTextY -= gap;

          driverLines.forEach((line) => {
            (page as PDFPage).drawText(line, {
              x,
              y: currentTextY,
              size: driverSize,
              font: regularFont,
              color: c.textMedium,
            });
            currentTextY -= driverStep;
          });
        } else if (h.key === "veiculo") {
          const [placaLine = "-", modeloLine = ""] = cell.text.split("\n");
          const placaSize = 10;
          const modeloSize = 9;
          const gap = 4;
          const placaLines = wrapTextToLines(
            placaLine,
            placaSize,
            boldFont,
            cell.maxWidth,
          );
          const modeloLines = modeloLine
            ? wrapTextToLines(
                modeloLine,
                modeloSize,
                regularFont,
                cell.maxWidth,
              )
            : [];
          const placaStep = placaSize + 2;
          const modeloStep = modeloSize + 2;
          const totalH =
            placaLines.length * placaStep +
            (modeloLines.length > 0
              ? gap + modeloLines.length * modeloStep
              : 0);
          let vY = currentY + rowHeight - 8;

          // Se o conteúdo cabe, centraliza verticalmente; senão, começa no topo.
          if (totalH < rowHeight - 10) {
            vY = currentY + (rowHeight + totalH) / 2 - 4;
          }

          for (const line of placaLines) {
            (page as PDFPage).drawText(line, {
              x,
              y: vY,
              size: placaSize,
              font: boldFont,
              color: cell.color,
            });
            vY -= placaStep;
          }
          if (modeloLines.length > 0) {
            vY -= gap;
            for (const line of modeloLines) {
              (page as PDFPage).drawText(line, {
                x,
                y: vY,
                size: modeloSize,
                font: regularFont,
                color: c.textMedium,
              });
              vY -= modeloStep;
            }
          }
        } else if (
          h.key === "custo" &&
          cell.custoTagLines &&
          cell.custoTagLines.length > 0
        ) {
          const tagSize = 6.5;
          const tagStep = tagSize + 2;
          const tagColors: Record<string, RGB> = {
            "NO-SHOW": c.accentRed,
            "H.EXTRA": rgb(0.3, 0.34, 0.4),
          };
          const valueY = currentY + rowHeight - cell.size - 2;
          const valueDrawX =
            cell.align === "right"
              ? x +
                h.width -
                8 -
                cell.font.widthOfTextAtSize(cell.text, cell.size)
              : x;

          (page as PDFPage).drawText(cell.text, {
            x: valueDrawX,
            y: valueY,
            size: cell.size,
            font: cell.font,
            color: cell.color,
          });

          let tagY = valueY - tagStep - 2;
          for (const line of cell.custoTagLines) {
            const isNoShow = line.startsWith("NO-SHOW");
            const tagColor = isNoShow
              ? tagColors["NO-SHOW"]
              : tagColors["H.EXTRA"];
            const tagDrawX =
              cell.align === "right"
                ? x + h.width - 8 - regularFont.widthOfTextAtSize(line, tagSize)
                : x;
            if (isNoShow) {
              (page as PDFPage).drawText(line, {
                x: tagDrawX,
                y: tagY,
                size: tagSize,
                font: regularFont,
                color: tagColor,
              });
            } else {
              // H.EXTRA: "H.EXTRA " em regular + "(HH:mm)" em bold, ambos cinza escuro
              const match = line.match(/^(H\.EXTRA\s*)(\(\d{2}:\d{2}\).*)$/);
              if (match) {
                const [, prefix, suffix] = match;
                (page as PDFPage).drawText(prefix, {
                  x: tagDrawX,
                  y: tagY,
                  size: tagSize,
                  font: regularFont,
                  color: tagColor,
                });
                (page as PDFPage).drawText(suffix, {
                  x: tagDrawX + regularFont.widthOfTextAtSize(prefix, tagSize),
                  y: tagY,
                  size: tagSize,
                  font: boldFont,
                  color: tagColor,
                });
              } else {
                (page as PDFPage).drawText(line, {
                  x: tagDrawX,
                  y: tagY,
                  size: tagSize,
                  font: regularFont,
                  color: tagColor,
                });
              }
            }
            tagY -= tagStep;
          }
        } else if (cell.isMultiLine) {
          drawMultiLineText(
            page as PDFPage,
            cell.text,
            x,
            currentY + rowHeight - 8,
            cell.size,
            cell.font,
            cell.color,
            cell.maxWidth,
            cell.lineHeight,
          );
        } else {
          const drawX =
            cell.align === "right"
              ? x +
                h.width -
                8 -
                cell.font.widthOfTextAtSize(cell.text, cell.size)
              : x;
          (page as PDFPage).drawText(cell.text, {
            x: drawX,
            y: currentY + rowHeight / 2 - cell.size / 2,
            size: cell.size,
            font: cell.font,
            color: cell.color,
          });
        }

        x += h.width;
      }
    });
  } // fim do else (não resumo_motoristas)

  // Draw footers
  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    drawFooter(pdfDoc.getPage(i) as PDFPage, i + 1, totalPages);
  }

  const pdfBytes = await pdfDoc.save();
  const fileNameMap: Record<ReportTemplate, string> = {
    medicao_cliente: "medicao-cliente",
    repasse_motorista: "repasse-motoristas",
    resumo_motoristas: "resumo-motoristas",
    performance: "performance-financeira",
    liberadas_faturamento: "liberadas-faturamento",
    pendentes_repasse: "pendentes-repasse",
  };

  const fileName = sanitizeFinanceFileName(
    `${fileNameMap[template]}-${data.periodLabel.replace(/\s/g, "_")}.pdf`,
  );

  const pdfArrayBuffer = new Uint8Array(pdfBytes.length);
  pdfArrayBuffer.set(pdfBytes);

  return new Response(pdfArrayBuffer.buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
    },
  });
}

// ── Handler ────────────────────────────────────────────────

export async function GET(request: Request) {
  return handleReportRequest(request);
}

/**
 * POST aceita `selectedOsIds` no body JSON para evitar o erro 431
 * (Request Header Fields Too Large) quando centenas de OS são
 * selecionadas — a lista não cabe na query string.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    selectedOsIds?: string[];
  } | null;
  const selectedOsIds = (body?.selectedOsIds || [])
    .map((id) => String(id).trim())
    .filter(Boolean);
  return handleReportRequest(request, selectedOsIds);
}

async function handleReportRequest(
  request: Request,
  bodySelectedOsIds?: string[],
) {
  try {
    const authClient = await createAuthClient();
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const filters = parseFilters(request);
    if (bodySelectedOsIds && bodySelectedOsIds.length > 0) {
      filters.selectedOsIds = bodySelectedOsIds;
      filters.selectionMode =
        new URL(request.url).searchParams.get("selectionMode") === "true";
    }
    const template = filters.template || "medicao_cliente";
    const format = filters.format || "pdf";

    const adminClient = createAdminClient();
    const data = await fetchReportData(filters, template, adminClient);

    if (data.rows.length === 0) {
      return NextResponse.json(
        { error: "Nenhum registro encontrado para os filtros aplicados." },
        { status: 404 },
      );
    }

    if (format === "csv") {
      return generateCsv(data, template, filters);
    }

    if (format === "xlsx") {
      return generateXlsx(data, template, filters);
    }

    return generatePdf(data, template, request, filters);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    const stack = error instanceof Error ? error.stack : "";
    console.error("[Relatorio Error]", message, stack);
    return NextResponse.json({ error: message, stack }, { status: 500 });
  }
}
