import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PDFDocument, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import {
  isFinanceStatusSettled,
  isLiberadoParaFaturamento,
  sanitizeFinanceFileName,
} from "@/lib/financeiro";

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

type ReportData = {
  rows: FinanceRow[];
  clienteMap: Map<string, string>;
  centroCustoMap: Map<string, string>;
  driverMap: Map<string, string>;
  driverDetailMap: Map<string, DriverDetail>;
  parceiroMap: Map<string, string>;
  summary: ReportSummary;
  periodLabel: string;
};

type ReportSummary = {
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
      "id, protocolo, os_number, data, cliente_id, centro_custo_id, motorista, driver_id, valor_bruto, custo, imposto, lucro, status_financeiro, status_operacional, repasse_pago",
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

  const summary = computeSummary(rows, driverDetailMap);
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
    summary: {
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
): ReportSummary {
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
      case "medicao_cliente":
        lines.push(
          [
            row.protocolo || "-",
            row.os_number || "-",
            formatDate(row.data),
            clienteNome,
            centroCustoNome,
            motoristaNome,
            formatCurrency(Number(row.valor_bruto || 0)),
            row.status_financeiro || "Pendente",
          ].join(";"),
        );
        break;
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
    const logoResponse = await fetch(new URL("/logo.png", request.url));
    if (logoResponse.ok) {
      const logoBytes = await logoResponse.arrayBuffer();
      logoImage = await pdfDoc.embedPng(logoBytes);
    }
  } catch {
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

  function drawHeader(currentPage: PDFPage) {
    currentPage.drawRectangle({
      x: 0,
      y: pageHeight - 120,
      width: pageWidth,
      height: 120,
      color: rgb(0.02, 0.12, 0.25),
    });

    if (logoImage) {
      currentPage.drawImage(logoImage, {
        x: margin,
        y: pageHeight - 100,
        width: 50,
        height: 50,
      });
    }

    currentPage.drawText(companyData.name, {
      x: margin + 60,
      y: pageHeight - 55,
      size: 16,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    currentPage.drawText(`CNPJ: ${companyData.cnpj}`, {
      x: margin + 60,
      y: pageHeight - 75,
      size: 8,
      font: regularFont,
      color: rgb(0.8, 0.85, 0.95),
    });

    currentPage.drawText(companyData.address, {
      x: margin + 60,
      y: pageHeight - 90,
      size: 8,
      font: regularFont,
      color: rgb(0.8, 0.85, 0.95),
    });

    currentPage.drawText(`Tel: ${companyData.phone}`, {
      x: margin + 60,
      y: pageHeight - 105,
      size: 8,
      font: regularFont,
      color: rgb(0.8, 0.85, 0.95),
    });

    currentPage.drawRectangle({
      x: pageWidth - 220,
      y: pageHeight - 110,
      width: 180,
      height: 80,
      borderColor: rgb(0.8, 0.85, 0.95),
      borderWidth: 1,
      color: rgb(0.02, 0.12, 0.25),
    });

    currentPage.drawText(reportTitle, {
      x: pageWidth - 210,
      y: pageHeight - 55,
      size: 12,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    currentPage.drawText(`Período: ${data.periodLabel}`, {
      x: pageWidth - 210,
      y: pageHeight - 75,
      size: 9,
      font: regularFont,
      color: rgb(0.8, 0.85, 0.95),
    });

    const today = new Date().toLocaleDateString("pt-BR");
    currentPage.drawText(`Emissão: ${today}`, {
      x: pageWidth - 210,
      y: pageHeight - 90,
      size: 9,
      font: regularFont,
      color: rgb(0.8, 0.85, 0.95),
    });
  }

  function drawSummaryBox(
    currentPage: PDFPage,
    x: number,
    y: number,
    width: number,
    title: string,
    value: string,
    isHighlighted = false,
    isPrimary = false,
  ) {
    currentPage.drawRectangle({
      x,
      y,
      width,
      height: 65,
      color: isPrimary
        ? rgb(0.02, 0.12, 0.25)
        : isHighlighted
          ? rgb(0.95, 0.98, 0.96)
          : rgb(1, 1, 1),
      borderColor: isPrimary
        ? rgb(0.02, 0.12, 0.25)
        : isHighlighted
          ? rgb(0.05, 0.56, 0.31)
          : rgb(0.87, 0.9, 0.95),
      borderWidth: isPrimary ? 2 : isHighlighted ? 2 : 1,
    });

    currentPage.drawText(title, {
      x: x + 12,
      y: y + 45,
      size: 8,
      font: boldFont,
      color: isPrimary
        ? rgb(0.8, 0.85, 0.95)
        : isHighlighted
          ? rgb(0.05, 0.56, 0.31)
          : rgb(0.42, 0.47, 0.55),
    });

    currentPage.drawText(value, {
      x: x + 12,
      y: y + 20,
      size: 16,
      font: boldFont,
      color: isPrimary
        ? rgb(1, 1, 1)
        : isHighlighted
          ? rgb(0.05, 0.56, 0.31)
          : rgb(0.05, 0.12, 0.23),
    });

    currentPage.drawLine({
      start: { x: x + 12, y: y + 38 },
      end: { x: x + width - 12, y: y + 38 },
      thickness: 1,
      color: isPrimary
        ? rgb(0.3, 0.4, 0.6)
        : isHighlighted
          ? rgb(0.05, 0.56, 0.31)
          : rgb(0.85, 0.89, 0.94),
    });
  }

  function drawTableHeader(
    currentPage: PDFPage,
    y: number,
    headers: Array<{ label: string; width: number; align?: string }>,
  ) {
    currentPage.drawRectangle({
      x: margin,
      y,
      width: pageWidth - margin * 2,
      height: 32,
      color: rgb(0.02, 0.12, 0.25),
      borderColor: rgb(0.02, 0.12, 0.25),
      borderWidth: 1,
    });

    let x = margin + 8;
    headers.forEach((header) => {
      currentPage.drawText(header.label, {
        x,
        y: y + 12,
        size: 9,
        font: boldFont,
        color: rgb(1, 1, 1),
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
      color: rgb(0.85, 0.89, 0.94),
    });

    currentPage.drawText("Geolog Transportes e Logística Ltda", {
      x: margin,
      y: footerY + 5,
      size: 8,
      font: regularFont,
      color: rgb(0.42, 0.47, 0.55),
    });

    currentPage.drawText(`CNPJ: ${companyData.cnpj}`, {
      x: margin,
      y: footerY - 8,
      size: 8,
      font: regularFont,
      color: rgb(0.42, 0.47, 0.55),
    });

    currentPage.drawText(`Página ${pageNumber} de ${totalPages}`, {
      x: pageWidth - margin - 80,
      y: footerY + 5,
      size: 8,
      font: regularFont,
      color: rgb(0.42, 0.47, 0.55),
    });

    currentPage.drawText("Documento emitido eletronicamente", {
      x: pageWidth - margin - 180,
      y: footerY - 8,
      size: 8,
      font: regularFont,
      color: rgb(0.42, 0.47, 0.55),
    });
  }

  // Summary boxes configuration per template
  const summaryBoxes: Record<
    ReportTemplate,
    Array<{
      title: string;
      value: string;
      highlight?: boolean;
      primary?: boolean;
    }>
  > = {
    medicao_cliente: [
      { title: "Total OS", value: String(data.summary.totalOS), primary: true },
      {
        title: "Liberado Faturamento",
        value: formatCurrency(data.summary.totalLiberadoFaturamento),
        highlight: true,
      },
      {
        title: "Recebido",
        value: formatCurrency(data.summary.totalRecebido),
        highlight: true,
      },
      { title: "A Receber", value: formatCurrency(data.summary.totalFaturado) },
      {
        title: "Faturamento Bruto",
        value: formatCurrency(data.summary.totalBruto),
      },
      {
        title: "Custos Totais",
        value: formatCurrency(data.summary.totalCusto),
      },
      { title: "Impostos", value: formatCurrency(data.summary.totalImposto) },
      {
        title: "Lucro Líquido",
        value: formatCurrency(data.summary.totalLucro),
        highlight: true,
        primary: true,
      },
    ],
    repasse_autonomos: [
      { title: "Total OS", value: String(data.summary.totalOS), primary: true },
      {
        title: "Custo Autônomos",
        value: formatCurrency(data.summary.totalCustoAutonomos),
        highlight: true,
      },
      {
        title: "Já Pago",
        value: formatCurrency(data.summary.totalPagoAutonomos),
        highlight: true,
      },
      {
        title: "Pendente",
        value: formatCurrency(
          data.summary.totalCustoAutonomos - data.summary.totalPagoAutonomos,
        ),
      },
    ],
    repasse_parceiros: [
      { title: "Total OS", value: String(data.summary.totalOS), primary: true },
      {
        title: "Custo Parceiros",
        value: formatCurrency(data.summary.totalCustoParceiros),
        highlight: true,
      },
      {
        title: "Já Pago",
        value: formatCurrency(data.summary.totalPagoParceiros),
        highlight: true,
      },
      {
        title: "Pendente",
        value: formatCurrency(
          data.summary.totalCustoParceiros - data.summary.totalPagoParceiros,
        ),
      },
    ],
    performance: [
      { title: "Total OS", value: String(data.summary.totalOS), primary: true },
      {
        title: "Faturamento Bruto",
        value: formatCurrency(data.summary.totalBruto),
      },
      { title: "Custos", value: formatCurrency(data.summary.totalCusto) },
      { title: "Impostos", value: formatCurrency(data.summary.totalImposto) },
      {
        title: "Lucro Líquido",
        value: formatCurrency(data.summary.totalLucro),
        highlight: true,
        primary: true,
      },
      {
        title: "Margem",
        value:
          data.summary.totalBruto > 0
            ? `${((data.summary.totalLucro / data.summary.totalBruto) * 100).toFixed(1)}%`
            : "0%",
        highlight: true,
      },
    ],
    liberadas_faturamento: [
      {
        title: "Total OS Liberadas",
        value: String(data.summary.totalOS),
        primary: true,
      },
      {
        title: "Valor Total",
        value: formatCurrency(data.summary.totalBruto),
        highlight: true,
        primary: true,
      },
    ],
    pendentes_repasse: [
      {
        title: "Total OS Pendentes",
        value: String(data.summary.totalOS),
        primary: true,
      },
      {
        title: "Custo Total Pendente",
        value: formatCurrency(
          data.summary.totalCustoAutonomos +
            data.summary.totalCustoParceiros -
            data.summary.totalPagoAutonomos -
            data.summary.totalPagoParceiros,
        ),
        highlight: true,
        primary: true,
      },
    ],
  };

  // Table headers per template
  const tableHeadersMap: Record<
    ReportTemplate,
    Array<{ label: string; width: number; key: string }>
  > = {
    medicao_cliente: [
      { label: "Protocolo", width: 90, key: "protocolo" },
      { label: "OS", width: 70, key: "os" },
      { label: "Empresa / Centro", width: 280, key: "cliente" },
      { label: "Motorista", width: 180, key: "motorista" },
      { label: "Data", width: 80, key: "data" },
      { label: "Valor", width: 100, key: "valor" },
      { label: "Status", width: 90, key: "status" },
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
  const boxWidth = (pageWidth - margin * 2 - 12 * 3) / 4;
  const boxHeight = 65;
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
      box.title,
      box.value,
      box.highlight,
      box.primary,
    );
    boxCol++;
    if (boxCol >= 4) {
      boxCol = 0;
      boxRow++;
    }
  }

  const lastBoxY =
    pageHeight -
    200 -
    boxRow * (boxHeight + boxGap) -
    (boxCol > 0 ? 0 : boxHeight + boxGap);
  currentY = lastBoxY - 40;

  // Table
  drawTableHeader(page, currentY, headers);
  currentY -= 36;

  data.rows.forEach((row: FinanceRow, index: number) => {
    if (currentY < margin + 50) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      drawHeader(page);
      currentY = pageHeight - 160;
      drawTableHeader(page, currentY, headers);
      currentY -= 36;
    }

    const isEven = index % 2 === 0;
    (page as PDFPage).drawRectangle({
      x: margin,
      y: currentY - 2,
      width: pageWidth - margin * 2,
      height: 36,
      color: isEven ? rgb(0.97, 0.98, 0.99) : rgb(1, 1, 1),
    });

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
    const status = row.status_financeiro || "Pendente";

    let x = margin + 8;

    for (const h of headers) {
      let text = "";
      let font = regularFont;
      let color = rgb(0.15, 0.19, 0.24);
      let size = 9;

      switch (h.key) {
        case "protocolo":
          text = row.protocolo || "-";
          break;
        case "os":
          text = row.os_number || "-";
          font = boldFont;
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
          color = rgb(0.05, 0.56, 0.31);
          break;
        case "custo":
          text = formatCurrency(Number(row.custo || 0));
          font = boldFont;
          color = rgb(0.8, 0.3, 0.2);
          break;
        case "imposto":
          text = formatCurrency(Number(row.imposto || 0));
          break;
        case "lucro": {
          const l = Number(row.lucro || 0);
          text = formatCurrency(l);
          color = l >= 0 ? rgb(0.05, 0.56, 0.31) : rgb(0.8, 0.3, 0.2);
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
          color =
            status === "Recebido"
              ? rgb(0.05, 0.56, 0.31)
              : rgb(0.15, 0.19, 0.24);
          break;
        case "pago":
          text = row.repasse_pago ? "Sim" : "Não";
          font = boldFont;
          color = row.repasse_pago ? rgb(0.05, 0.56, 0.31) : rgb(0.8, 0.3, 0.2);
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

      (page as PDFPage).drawText(text, {
        x,
        y: currentY + 10,
        size,
        font,
        color,
      });

      x += h.width;
    }

    currentY -= 36;
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
