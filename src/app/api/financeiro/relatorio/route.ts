import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { sanitizeFinanceFileName } from "@/lib/financeiro";

export const runtime = "edge";

type FinanceFilters = {
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
};

type FinanceRow = {
  id: string;
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
  };
};

const getNextMonthFirstDay = (month: string): string => {
  const [year, monthNum] = month.split("-").map(Number);
  if (monthNum === 12) return `${year + 1}-01-01`;
  return `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;
};

const sanitizeSearchTerm = (term: string): string => {
  return term.trim().slice(0, 100).replace(/[%_]/g, "\\$&").replace(/[(),]/g, "");
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatDate = (value?: string | null): string =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "-";

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
    const adminClient = createAdminClient();
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
        "id, os_number, data, cliente_id, centro_custo_id, motorista, driver_id, valor_bruto, custo, imposto, lucro, status_financeiro",
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
    if (motorista) query = query.ilike("motorista", `%${sanitizeSearchTerm(motorista)}%`);
    if (driverId) query = query.eq("driver_id", driverId);
    if (statusOperacional) query = query.eq("status_operacional", statusOperacional);
    if (statusFinanceiro) query = query.eq("status_financeiro", statusFinanceiro);
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
      const driverIds = (driverRows || []).map((row) => row.id);
      if (driverIds.length === 0) {
        return NextResponse.json(
          { error: "Nenhum motorista encontrado para o parceiro." },
          { status: 404 },
        );
      }
      query = query.in("driver_id", driverIds);
    }

    const { data: rowsRaw, error: rowsError } = await query.order("data", {
      ascending: false,
    });
    if (rowsError) throw rowsError;

    const rows = (rowsRaw || []) as FinanceRow[];
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
          ? adminClient.from("drivers").select("id, name").in("id", driverIds)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
      ]);

    const clienteMap = new Map((clientes || []).map((item) => [item.id, item.nome]));
    const centroCustoMap = new Map(
      (centrosCusto || []).map((item) => [item.id, item.nome]),
    );
    const driverMap = new Map((drivers || []).map((item) => [item.id, item.name]));

    const summary = rows.reduce(
      (acc, row) => {
        const bruto = Number(row.valor_bruto || 0);
        const custo = Number(row.custo || 0);
        const imposto = Number(row.imposto || 0);
        const lucro = Number(row.lucro || 0);
        const status = row.status_financeiro || "Pendente";
        acc.totalOS += 1;
        acc.totalBruto += bruto;
        acc.totalCusto += custo;
        acc.totalImposto += imposto;
        acc.totalLucro += lucro;
        if (status === "Recebido" || status === "Pago") acc.totalRecebido += bruto;
        if (status === "Faturado") acc.totalFaturado += bruto;
        if (status === "Pendente") acc.totalPendente += bruto;
        return acc;
      },
      {
        totalOS: 0,
        totalBruto: 0,
        totalCusto: 0,
        totalImposto: 0,
        totalLucro: 0,
        totalFaturado: 0,
        totalRecebido: 0,
        totalPendente: 0,
      },
    );

    const pdfDoc = await PDFDocument.create();
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let logoImage = null;
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
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin;

    const drawPageHeader = (currentPage = page) => {
      currentPage.drawRectangle({
        x: 0,
        y: pageHeight - 96,
        width: pageWidth,
        height: 96,
        color: rgb(0, 0.11, 0.23),
      });

      if (logoImage) {
        currentPage.drawImage(logoImage, {
          x: margin,
          y: pageHeight - 78,
          width: 44,
          height: 44,
        });
      }

      currentPage.drawText("Medição Financeira Geolog", {
        x: margin + 56,
        y: pageHeight - 50,
        size: 20,
        font: boldFont,
        color: rgb(1, 1, 1),
      });
      currentPage.drawText(
        `Período: ${month || `${formatDate(dataInicio)} - ${formatDate(dataFim)}`}`,
        {
          x: margin + 56,
          y: pageHeight - 72,
          size: 10,
          font: regularFont,
          color: rgb(0.83, 0.89, 0.98),
        },
      );
    };

    const drawSummaryBox = (
      currentPage: typeof page,
      x: number,
      y: number,
      width: number,
      title: string,
      value: string,
    ) => {
      currentPage.drawRectangle({
        x,
        y,
        width,
        height: 60,
        borderColor: rgb(0.87, 0.9, 0.95),
        color: rgb(1, 1, 1),
        borderWidth: 1,
      });
      currentPage.drawText(title, {
        x: x + 12,
        y: y + 38,
        size: 8,
        font: regularFont,
        color: rgb(0.42, 0.47, 0.55),
      });
      currentPage.drawText(value, {
        x: x + 12,
        y: y + 18,
        size: 13,
        font: boldFont,
        color: rgb(0.05, 0.12, 0.23),
      });
    };

    const drawTableHeader = (currentPage: typeof page, y: number) => {
      const headers = [
        { label: "OS", width: 66 },
        { label: "Data", width: 66 },
        { label: "Cliente", width: 170 },
        { label: "Motorista", width: 160 },
        { label: "Bruto", width: 88, align: "right" as const },
        { label: "Custo", width: 88, align: "right" as const },
        { label: "Lucro", width: 88, align: "right" as const },
        { label: "Status", width: 88 },
      ];

      currentPage.drawRectangle({
        x: margin,
        y,
        width: pageWidth - margin * 2,
        height: 24,
        color: rgb(0.95, 0.97, 0.99),
        borderColor: rgb(0.85, 0.89, 0.94),
        borderWidth: 1,
      });

      let x = margin + 8;
      headers.forEach((header) => {
        currentPage.drawText(header.label, {
          x,
          y: y + 8,
          size: 8,
          font: boldFont,
          color: rgb(0.34, 0.39, 0.47),
        });
        x += header.width;
      });
    };

    drawPageHeader(page);
    drawSummaryBox(page, margin, pageHeight - 156, 170, "Total OS", String(summary.totalOS));
    drawSummaryBox(page, margin + 182, pageHeight - 156, 170, "Faturado", formatCurrency(summary.totalFaturado));
    drawSummaryBox(page, margin + 364, pageHeight - 156, 170, "Recebido", formatCurrency(summary.totalRecebido));
    drawSummaryBox(page, margin + 546, pageHeight - 156, 170, "A faturar", formatCurrency(summary.totalPendente));
    drawSummaryBox(page, margin, pageHeight - 228, 170, "Bruto", formatCurrency(summary.totalBruto));
    drawSummaryBox(page, margin + 182, pageHeight - 228, 170, "Custos", formatCurrency(summary.totalCusto));
    drawSummaryBox(page, margin + 364, pageHeight - 228, 170, "Impostos", formatCurrency(summary.totalImposto));
    drawSummaryBox(page, margin + 546, pageHeight - 228, 170, "Lucro", formatCurrency(summary.totalLucro));

    currentY = pageHeight - 272;
    drawTableHeader(page, currentY);
    currentY -= 22;

    rows.forEach((row, index) => {
      if (currentY < margin + 28) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        drawPageHeader(page);
        currentY = pageHeight - 120;
        drawTableHeader(page, currentY);
        currentY -= 22;
      }

      const isEven = index % 2 === 0;
      page.drawRectangle({
        x: margin,
        y: currentY - 2,
        width: pageWidth - margin * 2,
        height: 20,
        color: isEven ? rgb(0.99, 0.99, 0.995) : rgb(1, 1, 1),
      });

      const clienteNome = clienteMap.get(row.cliente_id || "") || "-";
      const centroCustoNome = centroCustoMap.get(row.centro_custo_id || "") || "";
      const motoristaNome = driverMap.get(row.driver_id || "") || row.motorista || "-";
      const status = row.status_financeiro || "Pendente";

      const cells = [
        `#${row.os_number || "-"}${centroCustoNome ? ` / ${centroCustoNome}` : ""}`,
        formatDate(row.data),
        clienteNome,
        motoristaNome,
        formatCurrency(Number(row.valor_bruto || 0)),
        formatCurrency(Number(row.custo || 0)),
        formatCurrency(Number(row.lucro || 0)),
        status,
      ];

      const xPositions = [margin + 8, margin + 74, margin + 244, margin + 404, margin + 564, margin + 652, margin + 740, margin + 828];
      const widths = [58, 58, 156, 150, 76, 76, 76, 76];

      cells.forEach((cell, cellIndex) => {
        const isRightAligned = cellIndex >= 4;
        page.drawText(String(cell), {
          x: isRightAligned ? xPositions[cellIndex] - 8 - String(cell).length * 0.5 : xPositions[cellIndex],
          y: currentY + 4,
          size: 8,
          font: cellIndex === 0 || cellIndex === 7 ? boldFont : regularFont,
          color:
            cellIndex === 7 && status === "Recebido"
              ? rgb(0.05, 0.56, 0.31)
              : rgb(0.15, 0.19, 0.24),
        });
      });

      currentY -= 20;
    });

    const pdfBytes = await pdfDoc.save();
    const fileName = sanitizeFinanceFileName(
      `medicao-financeira-${month || "periodo"}.pdf`,
    );

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
