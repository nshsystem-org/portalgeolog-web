import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  isFinanceStatusSettled,
  isLiberadoParaFaturamento,
  sanitizeFinanceFileName,
} from "@/lib/financeiro";

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

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
};

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
        "id, protocolo, os_number, data, cliente_id, centro_custo_id, motorista, driver_id, valor_bruto, custo, imposto, lucro, status_financeiro, status_operacional",
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
        const statusOperacional = row.status_operacional || "";
        acc.totalOS += 1;
        acc.totalBruto += bruto;
        acc.totalCusto += custo;
        acc.totalImposto += imposto;
        acc.totalLucro += lucro;
        if (isLiberadoParaFaturamento(statusOperacional) && status === "Pendente") {
          acc.totalLiberadoFaturamento += bruto;
        }
        if (status === "Faturado") acc.totalFaturado += bruto;
        if (isFinanceStatusSettled(status)) acc.totalRecebido += bruto;
        if (status === "Pendente") acc.totalPendente += bruto;
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

    const companyData = {
      name: "GELOG TRANSPORTES E LOGÍSTICA LTDA",
      cnpj: "31.223.049/0001-37",
      address: "Rua Jandira Morais Pimentel, 490 Centro 28893-046 - Rio das Ostras - Rio de Janeiro",
      city: "Rio das Ostras - RJ",
      phone: "2299759-9213",
      email: "contato@geolog.com.br"
    };

    const drawInvoiceHeader = (currentPage = page) => {
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

      currentPage.drawText("RELATÓRIO FINANCEIRO", {
        x: pageWidth - 210,
        y: pageHeight - 55,
        size: 12,
        font: boldFont,
        color: rgb(1, 1, 1),
      });

      currentPage.drawText(`Período: ${month || `${formatDate(dataInicio)} a ${formatDate(dataFim)}`}`, {
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
    };

    const drawSummaryBox = (
      currentPage: typeof page,
      x: number,
      y: number,
      width: number,
      title: string,
      value: string,
      isHighlighted = false,
      isPrimary = false,
    ) => {
      // Background
      currentPage.drawRectangle({
        x,
        y,
        width,
        height: 65,
        color: isPrimary ? rgb(0.02, 0.12, 0.25) : (isHighlighted ? rgb(0.95, 0.98, 0.96) : rgb(1, 1, 1)),
        borderColor: isPrimary ? rgb(0.02, 0.12, 0.25) : (isHighlighted ? rgb(0.05, 0.56, 0.31) : rgb(0.87, 0.9, 0.95)),
        borderWidth: isPrimary ? 2 : (isHighlighted ? 2 : 1),
      });

      // Title
      currentPage.drawText(title, {
        x: x + 12,
        y: y + 45,
        size: 8,
        font: boldFont,
        color: isPrimary ? rgb(0.8, 0.85, 0.95) : (isHighlighted ? rgb(0.05, 0.56, 0.31) : rgb(0.42, 0.47, 0.55)),
      });

      // Value
      currentPage.drawText(value, {
        x: x + 12,
        y: y + 20,
        size: 16,
        font: boldFont,
        color: isPrimary ? rgb(1, 1, 1) : (isHighlighted ? rgb(0.05, 0.56, 0.31) : rgb(0.05, 0.12, 0.23)),
      });

      // Decorative line
      currentPage.drawLine({
        start: { x: x + 12, y: y + 38 },
        end: { x: x + width - 12, y: y + 38 },
        thickness: 1,
        color: isPrimary ? rgb(0.3, 0.4, 0.6) : (isHighlighted ? rgb(0.05, 0.56, 0.31) : rgb(0.85, 0.89, 0.94)),
      });
    };

    const drawTableHeader = (currentPage: typeof page, y: number) => {
      const headers = [
        { label: "Protocolo", width: 90 },
        { label: "OS", width: 70 },
        { label: "Empresa / Centro de Custo", width: 280 },
        { label: "Motorista", width: 180 },
        { label: "Data", width: 80 },
        { label: "Valor", width: 100, align: "center" as const },
        { label: "Status", width: 90 },
      ];

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
    };

    drawInvoiceHeader(page);

    drawSummaryBox(page, margin, pageHeight - 200, 170, "Total OS", String(summary.totalOS), false, true);
    drawSummaryBox(
      page,
      margin + 182,
      pageHeight - 200,
      170,
      "Liberado Faturamento",
      formatCurrency(summary.totalLiberadoFaturamento),
      true,
      false,
    );
    drawSummaryBox(page, margin + 364, pageHeight - 200, 170, "Recebido", formatCurrency(summary.totalRecebido), true, false);
    drawSummaryBox(page, margin + 546, pageHeight - 200, 170, "A Receber", formatCurrency(summary.totalFaturado), false, false);
    drawSummaryBox(page, margin, pageHeight - 268, 170, "Faturamento Bruto", formatCurrency(summary.totalBruto), false, false);
    drawSummaryBox(page, margin + 182, pageHeight - 268, 170, "Custos Totais", formatCurrency(summary.totalCusto), false, false);
    drawSummaryBox(page, margin + 364, pageHeight - 268, 170, "Impostos", formatCurrency(summary.totalImposto), false, false);
    drawSummaryBox(page, margin + 546, pageHeight - 268, 170, "Lucro Líquido", formatCurrency(summary.totalLucro), true, true);

    currentY = pageHeight - 320;
    drawTableHeader(page, currentY);
    currentY -= 36;

    rows.forEach((row, index) => {
      if (currentY < margin + 36) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        drawInvoiceHeader(page);
        currentY = pageHeight - 160;
        drawTableHeader(page, currentY);
        currentY -= 36;
      }

      const isEven = index % 2 === 0;
      page.drawRectangle({
        x: margin,
        y: currentY - 2,
        width: pageWidth - margin * 2,
        height: 36,
        color: isEven ? rgb(0.97, 0.98, 0.99) : rgb(1, 1, 1),
      });

      const clienteNome = clienteMap.get(row.cliente_id || "") || "-";
      const centroCustoNome = centroCustoMap.get(row.centro_custo_id || "") || "";
      const motoristaNome = driverMap.get(row.driver_id || "") || row.motorista || "-";
      const status = row.status_financeiro || "Pendente";

      const osValue = row.os_number || "-";
      const osIsEmpty = !row.os_number;

      const xPositions = [margin + 8, margin + 98, margin + 168, margin + 448, margin + 628, margin + 708, margin + 808];

      // Protocolo
      page.drawText(row.protocolo || "-", {
        x: xPositions[0],
        y: currentY + 10,
        size: 9,
        font: regularFont,
        color: rgb(0.15, 0.19, 0.24),
      });

      // OS
      const osColor = osIsEmpty ? rgb(0.7, 0.75, 0.85) : rgb(0.15, 0.19, 0.24);
      page.drawText(osValue, {
        x: xPositions[1],
        y: currentY + 10,
        size: 9,
        font: boldFont,
        color: osColor,
      });

      // Empresa / Centro de Custo (empresa em cima, centro embaixo)
      page.drawText(truncateText(clienteNome, 35), {
        x: xPositions[2],
        y: currentY + 18,
        size: 9,
        font: boldFont,
        color: rgb(0.15, 0.19, 0.24),
      });

      if (centroCustoNome) {
        page.drawText(truncateText(centroCustoNome, 35), {
          x: xPositions[2],
          y: currentY + 6,
          size: 8,
          font: regularFont,
          color: rgb(0.42, 0.47, 0.55),
        });
      }

      // Motorista
      page.drawText(truncateText(motoristaNome, 25), {
        x: xPositions[3],
        y: currentY + 10,
        size: 9,
        font: regularFont,
        color: rgb(0.15, 0.19, 0.24),
      });

      // Data
      page.drawText(formatDate(row.data), {
        x: xPositions[4],
        y: currentY + 10,
        size: 9,
        font: regularFont,
        color: rgb(0.15, 0.19, 0.24),
      });

      // Valor
      const valorText = formatCurrency(Number(row.valor_bruto || 0));
      const valorWidth = valorText.length * 5.5;
      page.drawText(valorText, {
        x: xPositions[5] + 50 - valorWidth / 2,
        y: currentY + 10,
        size: 9,
        font: boldFont,
        color: rgb(0.05, 0.56, 0.31),
      });

      // Status
      const statusColor = status === "Recebido" ? rgb(0.05, 0.56, 0.31) : rgb(0.15, 0.19, 0.24);
      page.drawText(status, {
        x: xPositions[6],
        y: currentY + 10,
        size: 9,
        font: boldFont,
        color: statusColor,
      });

      currentY -= 36;
    });

    const drawFooter = (currentPage: typeof page, pageNumber: number, totalPages: number) => {
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
    };

    const totalPages = pdfDoc.getPageCount();
    for (let i = 0; i < totalPages; i++) {
      const currentPage = pdfDoc.getPage(i);
      drawFooter(currentPage, i + 1, totalPages);
    }

    const pdfBytes = await pdfDoc.save();
    const fileName = sanitizeFinanceFileName(
      `medicao-financeira-${month || "periodo"}.pdf`,
    );
    const pdfArrayBuffer = new Uint8Array(pdfBytes.length);
    pdfArrayBuffer.set(pdfBytes);

    return new Response(pdfArrayBuffer.buffer, {
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
