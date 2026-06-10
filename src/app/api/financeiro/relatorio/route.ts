import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PDFDocument, PDFImage, PDFPage, StandardFonts, rgb, PDFFont, RGB } from "pdf-lib";
import {
  isFinanceStatusSettled,
  isLiberadoParaFaturamento,
  sanitizeFinanceFileName,
} from "@/lib/financeiro";
import { fetchInChunks } from "@/lib/supabase/chunked-in-query";

export const runtime = "edge";

export type ReportTemplate =
  | "medicao_cliente"
  | "repasse_autonomos"
  | "repasse_parceiros"
  | "performance"
  | "liberadas_faturamento"
  | "pendentes_repasse";

export type ReportFormat = "pdf" | "csv";

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
  onlyPending?: boolean;
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
  valor_bruto: number | string | null;
  custo: number | string | null;
  imposto: number | string | null;
  lucro: number | string | null;
  status_financeiro: string | null;
  status_operacional: string | null;
  repasse_pago: boolean | null;
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
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
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
    onlyPending: url.searchParams.get("onlyPending") === "true",
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

const formatDate = (value?: string | null): string =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "-";

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
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
  } = filters;

  let query = adminClient
    .from("ordens_servico")
    .select(
      "id, protocolo, os_number, data, cliente_id, centro_custo_id, solicitante, motorista, driver_id, valor_bruto, custo, imposto, lucro, status_financeiro, status_operacional, repasse_pago",
    )
    .eq("arquivado", false);

  if (month) {
    query = query
      .gte("data", `${month}-01`)
      .lt("data", getNextMonthFirstDay(month));
  }
  if (dataInicio) query = query.gte("data", dataInicio);
  if (dataFim) query = query.lte("data", dataFim);
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
  } else {
    if (statusOperacional)
      query = query.eq("status_operacional", statusOperacional);
    if (statusFinanceiro)
      query = query.eq("status_financeiro", statusFinanceiro);
  }

  if (searchTerm) {
    const likeTerm = `%${sanitizeSearchTerm(searchTerm)}%`;
    query = query.or(`os_number.ilike.${likeTerm},motorista.ilike.${likeTerm}`);
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
    ascending: false,
  });
  if (rowsError) throw rowsError;

  let rows = (rowsRaw || []) as FinanceRow[];

  const osIds = rows.map((r) => r.id);
  const waypointsMap = new Map<string, ReportWaypoint[]>();
  const passengerNamesMap = new Map<string, string>();

  if (osIds.length > 0) {
    const wpRows = await fetchInChunks<OSWaypointRow>(
      adminClient,
      "os_waypoints",
      "ordem_servico_id",
      osIds,
      "id, ordem_servico_id, position, label, lat, lng, comment, itinerary_index, hora, data",
      "position",
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
          )
        : [];

    const passengerIds = Array.from(
      new Set(wpPassRows.map((p) => p.passageiro_id).filter((id): id is string => !!id)),
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
        passengers: passIds.map((pid) => ({ id: pid, nome: passengerNamesMap.get(pid) || "" })),
      });
      waypointsMap.set(wp.ordem_servico_id, list);
    });
  }

  const clientIds = Array.from(
    new Set(rows.map((row) => row.cliente_id).filter(Boolean) as string[]),
  );
  const centerIds = Array.from(
    new Set(rows.map((row) => row.centro_custo_id).filter(Boolean) as string[]),
  );
  const driverIds = Array.from(
    new Set(rows.map((row) => row.driver_id).filter(Boolean) as string[]),
  );

  const [{ data: clientes }, { data: centrosCusto }, { data: drivers }] =
    await Promise.all([
      clientIds.length > 0
        ? adminClient.from("clientes").select("id, nome").in("id", clientIds)
        : Promise.resolve({ data: [] as Array<{ id: string; nome: string }> }),
      centerIds.length > 0
        ? adminClient
            .from("centros_custo")
            .select("id, nome")
            .in("id", centerIds)
        : Promise.resolve({ data: [] as Array<{ id: string; nome: string }> }),
      driverIds.length > 0
        ? adminClient
            .from("drivers")
            .select("id, name, parceiro_id, vinculo_tipo")
            .in("id", driverIds)
        : Promise.resolve({ data: [] as Array<DriverDetail> }),
    ]);

  const driverParceiroIds = (drivers || [])
    .filter((d) => d.parceiro_id)
    .map((d) => d.parceiro_id) as string[];

  const { data: parceirosRaw } =
    driverParceiroIds.length > 0
      ? await adminClient
          .from("parceiros_servico")
          .select("id, razao_social_ou_nome_completo")
          .in("id", [...new Set(driverParceiroIds)])
      : { data: [] };

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

  if (template === "repasse_autonomos") {
    rows = rows.filter((row) => {
      const driver = row.driver_id
        ? driverDetailMap.get(row.driver_id)
        : undefined;
      return (
        driver && !driver.parceiro_id && driver.vinculo_tipo === "autonomo"
      );
    });
  } else if (template === "repasse_parceiros") {
    rows = rows.filter((row) => {
      const driver = row.driver_id
        ? driverDetailMap.get(row.driver_id)
        : undefined;
      return (
        driver &&
        driver.parceiro_id !== null &&
        driver.parceiro_id !== undefined
      );
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

  rows.forEach((row) => {
    if (row.centro_custo_id) centroCustoIds.add(row.centro_custo_id);
    if (row.solicitante?.trim()) solicitanteNames.add(row.solicitante.trim());

    const waypoints = waypointsMap.get(row.id) || [];
    waypoints.forEach((waypoint) => {
      waypoint.passengers.forEach((passenger) => {
        if (passenger.id) passengerIds.add(passenger.id);
      });
    });
  });

  return rows.reduce(
    (acc, row) => {
      const bruto = Number(row.valor_bruto || 0);
      const custo = Number(row.custo || 0);
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
      acc.totalBruto += bruto;
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
        if (driver && driver.parceiro_id) {
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
    },
  );
}

function generateCsv(data: ReportData, template: ReportTemplate): Response {
  const { rows, clienteMap, centroCustoMap, driverMap, parceiroMap } = data;

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
    repasse_autonomos: [
      "Protocolo",
      "OS",
      "Data",
      "Motorista",
      "Custo",
      "Repasse Pago",
    ],
    repasse_parceiros: [
      "Protocolo",
      "OS",
      "Data",
      "Parceiro",
      "Motorista",
      "Custo",
      "Repasse Pago",
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
  };

  const headers = headersMap[template];
  const lines: string[] = [headers.join(";")];

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
            waypoints.flatMap((wp) => wp.passengers?.map((p) => p.nome)).filter(Boolean),
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
            formatCurrency(Number(row.valor_bruto || 0)),
            row.status_financeiro || "Pendente",
          ].join(";"),
        );
        break;
      }
      case "repasse_autonomos":
        lines.push(
          [
            row.protocolo || "-",
            row.os_number || "-",
            formatDate(row.data),
            motoristaNome,
            formatCurrency(Number(row.custo || 0)),
            row.repasse_pago ? "Sim" : "Não",
          ].join(";"),
        );
        break;
      case "repasse_parceiros":
        lines.push(
          [
            row.protocolo || "-",
            row.os_number || "-",
            formatDate(row.data),
            parceiroNome,
            motoristaNome,
            formatCurrency(Number(row.custo || 0)),
            row.repasse_pago ? "Sim" : "Não",
          ].join(";"),
        );
        break;
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
            formatCurrency(bruto),
            formatCurrency(Number(row.custo || 0)),
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
            formatCurrency(Number(row.valor_bruto || 0)),
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
            formatCurrency(Number(row.custo || 0)),
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
    repasse_autonomos: "repasse-autonomos",
    repasse_parceiros: "repasse-parceiros",
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

// ── PDF Generator ────────────────────────────────────────

async function generatePdf(
  data: ReportData,
  template: ReportTemplate,
  request: Request,
): Promise<Response> {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let logoImage: PDFImage | null = null;
  try {
    const logoUrl = new URL("/logo.png", request.url);
    let logoResponse = await fetch(logoUrl);

    // Fallback if loopback fetch fails in production
    if (!logoResponse.ok && !request.url.includes("localhost")) {
      logoResponse = await fetch("https://portalgeolog.com.br/logo.png");
    }

    if (logoResponse.ok) {
      const logoBytes = await logoResponse.arrayBuffer();
      const contentType = logoResponse.headers.get("content-type") || "";

      if (contentType.includes("image/png") || logoUrl.pathname.endsWith(".png")) {
        logoImage = await pdfDoc.embedPng(logoBytes);
      } else if (
        contentType.includes("image/jpeg") ||
        logoUrl.pathname.endsWith(".jpg") ||
        logoUrl.pathname.endsWith(".jpeg")
      ) {
        logoImage = await pdfDoc.embedJpg(logoBytes);
      } else {
        // Try PNG as default fallback
        logoImage = await pdfDoc.embedPng(logoBytes);
      }
    }
  } catch (err) {
    console.error("Logo fetch error:", err);
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
    repasse_autonomos: "REPASSE A AUTÔNOMOS",
    repasse_parceiros: "REPASSE A PARCEIROS",
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
    textDark: rgb(0.25, 0.30, 0.38),
    textMedium: rgb(0.42, 0.47, 0.55),
    borderLight: rgb(0.85, 0.89, 0.94),
    accentGreen: rgb(0.12, 0.48, 0.32),
    accentRed: rgb(0.75, 0.30, 0.22),
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
    return Math.max(1, wrapTextToLines(text, size, font, maxWidth).length) * lineHeight;
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
    const from = { r: 0.10, g: 0.18, b: 0.32 };
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

    const today = new Date().toLocaleDateString("pt-BR");
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

  type SummaryCardTone = "blue" | "cyan" | "amber" | "teal" | "slate" | "emerald";

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
        // page with lines
        currentPage.drawRectangle({
          x: cx - s * 0.35,
          y: cy - s * 0.42,
          width: s * 0.7,
          height: s * 0.84,
          color,
          borderWidth: 0,
        });
        currentPage.drawRectangle({
          x: cx - s * 0.22,
          y: cy + s * 0.08,
          width: s * 0.44,
          height: s * 0.08,
          color: c.standardBg,
          borderWidth: 0,
        });
        currentPage.drawRectangle({
          x: cx - s * 0.22,
          y: cy - s * 0.12,
          width: s * 0.3,
          height: s * 0.06,
          color: c.standardBg,
          borderWidth: 0,
        });
        break;
      }
      case "grid": {
        // 2x2 grid
        const sq = s * 0.22;
        const g = 3;
        currentPage.drawRectangle({ x: cx - sq - g, y: cy + g, width: sq, height: sq, color, borderWidth: 0 });
        currentPage.drawRectangle({ x: cx + g, y: cy + g, width: sq, height: sq, color, borderWidth: 0 });
        currentPage.drawRectangle({ x: cx - sq - g, y: cy - sq - g, width: sq, height: sq, color, borderWidth: 0 });
        currentPage.drawRectangle({ x: cx + g, y: cy - sq - g, width: sq, height: sq, color, borderWidth: 0 });
        break;
      }
      case "person": {
        // head + body
        currentPage.drawEllipse({ x: cx, y: cy + s * 0.2, xScale: s * 0.18, yScale: s * 0.18, color });
        currentPage.drawRectangle({
          x: cx - s * 0.22,
          y: cy - s * 0.38,
          width: s * 0.44,
          height: s * 0.38,
          color,
          borderWidth: 0,
        });
        break;
      }
      case "people": {
        // two overlapping people
        // back person
        currentPage.drawEllipse({ x: cx + s * 0.12, y: cy + s * 0.18, xScale: s * 0.14, yScale: s * 0.14, color });
        currentPage.drawRectangle({
          x: cx - s * 0.05,
          y: cy - s * 0.28,
          width: s * 0.34,
          height: s * 0.32,
          color,
          borderWidth: 0,
        });
        // front person
        currentPage.drawEllipse({ x: cx - s * 0.12, y: cy + s * 0.08, xScale: s * 0.16, yScale: s * 0.16, color });
        currentPage.drawRectangle({
          x: cx - s * 0.32,
          y: cy - s * 0.38,
          width: s * 0.4,
          height: s * 0.34,
          color,
          borderWidth: 0,
        });
        break;
      }
      case "money": {
        // coin with ring
        currentPage.drawEllipse({ x: cx, y: cy, xScale: s * 0.32, yScale: s * 0.32, color });
        currentPage.drawEllipse({
          x: cx,
          y: cy,
          xScale: s * 0.22,
          yScale: s * 0.22,
          color: c.standardBg,
        });
        currentPage.drawEllipse({ x: cx, y: cy, xScale: s * 0.14, yScale: s * 0.14, color });
        break;
      }
      default: {
        currentPage.drawEllipse({ x: cx, y: cy, xScale: s * 0.25, yScale: s * 0.25, color });
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
      currentPage.drawText(header.label, {
        x,
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
        value: formatCurrency(data.summary.totalBruto),
        subtitle: "Valor total de todas as OS",
        iconType: "money",
        tone: "emerald",
        emphasis: true,
      },
    ],
    repasse_autonomos: [
      {
        title: "Total OS",
        value: String(data.summary.totalOS),
        subtitle: "Volume total de ordens",
        iconType: "document",
        tone: "blue",
        emphasis: true,
      },
      {
        title: "Custo Autônomos",
        value: formatCurrency(data.summary.totalCustoAutonomos),
        subtitle: "Repasses previstos",
        iconType: "grid",
        tone: "cyan",
      },
      {
        title: "Já Pago",
        value: formatCurrency(data.summary.totalPagoAutonomos),
        subtitle: "Repasses quitados",
        iconType: "money",
        tone: "teal",
      },
      {
        title: "Pendente",
        value: formatCurrency(
          data.summary.totalCustoAutonomos - data.summary.totalPagoAutonomos,
        ),
        subtitle: "Saldo em aberto",
        iconType: "document",
        tone: "amber",
      },
    ],
    repasse_parceiros: [
      {
        title: "Total OS",
        value: String(data.summary.totalOS),
        subtitle: "Volume total de ordens",
        iconType: "document",
        tone: "blue",
        emphasis: true,
      },
      {
        title: "Custo Parceiros",
        value: formatCurrency(data.summary.totalCustoParceiros),
        subtitle: "Repasses previstos",
        iconType: "grid",
        tone: "cyan",
      },
      {
        title: "Já Pago",
        value: formatCurrency(data.summary.totalPagoParceiros),
        subtitle: "Repasses quitados",
        iconType: "money",
        tone: "teal",
      },
      {
        title: "Pendente",
        value: formatCurrency(
          data.summary.totalCustoParceiros - data.summary.totalPagoParceiros,
        ),
        subtitle: "Saldo em aberto",
        iconType: "document",
        tone: "amber",
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
  };

  // Table headers per template
  const tableHeadersMap: Record<
    ReportTemplate,
    Array<{ label: string; width: number; key: string }>
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
    repasse_autonomos: [
      { label: "Protocolo", width: 100, key: "protocolo" },
      { label: "OS", width: 80, key: "os" },
      { label: "Data", width: 90, key: "data" },
      { label: "Motorista", width: 250, key: "motorista" },
      { label: "Custo", width: 110, key: "custo" },
      { label: "Pago", width: 90, key: "pago" },
    ],
    repasse_parceiros: [
      { label: "Protocolo", width: 90, key: "protocolo" },
      { label: "OS", width: 70, key: "os" },
      { label: "Data", width: 80, key: "data" },
      { label: "Parceiro", width: 180, key: "parceiro" },
      { label: "Motorista", width: 180, key: "motorista" },
      { label: "Custo", width: 100, key: "custo" },
      { label: "Pago", width: 90, key: "pago" },
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
  };

  // Build pages
  const headers = tableHeadersMap[template];
  const boxes = summaryBoxes[template];

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - margin;

  drawHeader(page);

  // Draw summary boxes (4 per row)
  if (template === "medicao_cliente") {
    // Add title for Medição ao Cliente
    const titleText = "RELATÓRIO DE MEDIÇÃO";
    const titleWidth = regularFont.widthOfTextAtSize(titleText, 10);
    page.drawText(titleText, {
      x: (pageWidth - titleWidth) / 2 + 10,
      y: pageHeight - 155,
      size: 10,
      font: regularFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    const selectedClientId = data.rows[0]?.cliente_id;
    const clientName = selectedClientId ? (data.clienteMap.get(selectedClientId) || "GERAL") : "GERAL";

    const nameWidth = boldFont.widthOfTextAtSize(clientName.toUpperCase(), 18);
    page.drawText(clientName.toUpperCase(), {
      x: (pageWidth - nameWidth) / 2 + 10,
      y: pageHeight - 190,
      size: 18,
      font: boldFont,
      color: rgb(0.05, 0.12, 0.23), // Very dark navy blue
    });

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
      const x = margin + (cardWidth + cardGap) / 2 + index * (cardWidth + cardGap);
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
        waypoints.flatMap((wp) => wp.passengers?.map((p) => p.nome)).filter(Boolean),
      ),
    ) as string[];
    const trajetoList = waypoints.map((wp) => wp.label).filter(Boolean);

    const driver = row.driver_id
      ? data.driverDetailMap.get(row.driver_id)
      : undefined;
    const parceiroNome = driver?.parceiro_id
      ? data.parceiroMap.get(driver.parceiro_id) || "-"
      : "";
    const status = row.status_financeiro || "Pendente";

    // First pass: compute all cell texts and measure heights
    const cellData: Array<{
      text: string;
      font: PDFFont;
      color: RGB;
      size: number;
      isMultiLine: boolean;
      maxWidth: number;
      lineHeight: number;
    }> = [];

    let maxContentHeight = baseRowHeight;

    for (const h of headers) {
      let text = "";
      let font = regularFont;
      let color = c.textDark;
      let size = 9;

      switch (h.key) {
        case "protocolo_data":
          text = `${row.protocolo || "-"}\n${formatDate(row.data)}`;
          size = 8;
          break;
        case "protocolo":
          text = row.protocolo || "-";
          break;
        case "os":
          text = row.os_number || "-";
          size = 8;
          font = boldFont;
          break;
        case "centro_custo":
          text = centroCustoNome || "-";
          size = 8;
          break;
        case "solicitante":
          text = row.solicitante || "-";
          size = 8;
          break;
        case "passageiros":
          text = passageirosList.join(", ");
          size = 7;
          break;
        case "trajeto":
          text = trajetoList.join(" -> ");
          size = 7;
          break;
        case "cliente": {
          const lines = [truncateText(clienteNome, 35)];
          if (centroCustoNome) lines.push(truncateText(centroCustoNome, 35));
          text = lines.join("\n");
          if (lines.length > 1) size = 8;
          break;
        }
        case "motorista":
          text = truncateText(motoristaNome, 25);
          break;
        case "data":
          text = formatDate(row.data);
          break;
        case "valor":
        case "bruto":
          text = formatCurrency(Number(row.valor_bruto || 0));
          font = boldFont;
          color = c.accentGreen;
          break;
        case "custo":
          text = formatCurrency(Number(row.custo || 0));
          font = boldFont;
          color = c.accentRed;
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
          text = status;
          font = boldFont;
          color = status === "Recebido" ? c.accentGreen : c.textDark;
          break;
        case "pago":
          text = row.repasse_pago ? "Sim" : "Não";
          font = boldFont;
          color = row.repasse_pago ? c.accentGreen : c.accentRed;
          break;
        case "parceiro":
          text = parceiroNome;
          break;
        case "destinatario": {
          const isParceiro =
            driver?.parceiro_id !== null && driver?.parceiro_id !== undefined;
          text = isParceiro ? parceiroNome : motoristaNome;
          break;
        }
      }

      const isMultiLine =
        h.key === "protocolo_data" ||
        h.key === "os" ||
        h.key === "centro_custo" ||
        h.key === "solicitante" ||
        h.key === "passageiros" ||
        h.key === "trajeto";
      const lineH = size + 2;
      const maxW = h.width - 10;

      if (isMultiLine) {
        const contentHeight = calculateMultiLineHeight(text, size, font, maxW, lineH);
        maxContentHeight = Math.max(maxContentHeight, contentHeight + 10);
      } else if (text.includes("\n")) {
        const lines = text.split("\n").length;
        maxContentHeight = Math.max(maxContentHeight, lines * lineH + 10);
      }

      cellData.push({ text, font, color, size, isMultiLine, maxWidth: maxW, lineHeight: lineH });
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

      if (cell.isMultiLine) {
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
        (page as PDFPage).drawText(cell.text, {
          x,
          y: currentY + (rowHeight / 2) - (cell.size / 2),
          size: cell.size,
          font: cell.font,
          color: cell.color,
        });
      }

      x += h.width;
    }
  });

  // Draw footers
  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    drawFooter(pdfDoc.getPage(i) as PDFPage, i + 1, totalPages);
  }

  const pdfBytes = await pdfDoc.save();
  const fileNameMap: Record<ReportTemplate, string> = {
    medicao_cliente: "medicao-cliente",
    repasse_autonomos: "repasse-autonomos",
    repasse_parceiros: "repasse-parceiros",
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
      return generateCsv(data, template);
    }

    return generatePdf(data, template, request);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    const stack = error instanceof Error ? error.stack : "";
    console.error("[Relatorio Error]", message, stack);
    return NextResponse.json({ error: message, stack }, { status: 500 });
  }
}
