import { NextResponse } from "next/server";
import {
  PDFDocument,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
  RGB,
} from "pdf-lib";
import ExcelJS from "exceljs";
import {
  CAIXA_LANCAMENTO_SELECT,
  createAdminClient,
  getAuthUser,
  hasCaixaAccess,
  mapCaixaLancamentoRow,
  sanitizeFileName,
  type CaixaLancamentoJoinRow,
  type CaixaContaRow,
} from "../_shared";
import { LOGO_BASE64 } from "@/lib/pdf/report-logo";

export const runtime = "edge";

const MAX_LINHAS = 3000;

type CaixaReportTemplate =
  | "movimentacoes"
  | "por_categoria"
  | "por_fornecedor"
  | "por_conta";

type CaixaReportFormat = "pdf" | "xlsx";

type RelatorioQuery = {
  template: CaixaReportTemplate;
  format: CaixaReportFormat;
  dataInicio: string;
  dataFim: string;
  tipo?: "entrada" | "saida";
  contaId?: string;
  categoria?: string;
  clienteId?: string;
  parceiroId?: string;
  driverId?: string;
  fornecedorId?: string;
};

function parseQuery(searchParams: URLSearchParams): RelatorioQuery {
  const get = (key: string) => searchParams.get(key) || undefined;
  const template = (get("template") || "movimentacoes") as CaixaReportTemplate;
  const format = (get("format") || "pdf") as CaixaReportFormat;
  const tipoRaw = get("tipo");
  const tipo: "entrada" | "saida" | undefined =
    tipoRaw === "entrada" || tipoRaw === "saida" ? tipoRaw : undefined;
  return {
    template: VALID_TEMPLATES.includes(template) ? template : "movimentacoes",
    format: format === "xlsx" ? "xlsx" : "pdf",
    dataInicio: get("dataInicio") || "",
    dataFim: get("dataFim") || "",
    tipo,
    contaId: get("contaId"),
    categoria: get("categoria"),
    clienteId: get("clienteId"),
    parceiroId: get("parceiroId"),
    driverId: get("driverId"),
    fornecedorId: get("fornecedorId"),
  };
}

const VALID_TEMPLATES: CaixaReportTemplate[] = [
  "movimentacoes",
  "por_categoria",
  "por_fornecedor",
  "por_conta",
];

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatDate = (value?: string | null): string => {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  return new Date(value).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
};

const CATEGORIAS_LABEL: Record<string, string> = {
  recebimento_cliente: "Recebimento de Cliente",
  repasse_recebido: "Repasse Recebido",
  estorno: "Estorno",
  rendimento: "Rendimento / Juros",
  emprestimo: "Empréstimo / Aporte",
  repasse_motorista: "Repasse a Motorista",
  combustivel: "Combustível",
  manutencao: "Manutenção",
  aluguel: "Aluguel",
  salarios: "Salários / Pró-labore",
  impostos: "Impostos",
  fornecedores: "Fornecedores",
  despesas_fixas: "Despesas Fixas",
  despesas_variaveis: "Despesas Variáveis",
  investimento: "Investimento",
  outros: "Outros",
};

const labelCategoria = (categoria: string | null | undefined): string => {
  if (!categoria) return "Outros";
  return CATEGORIAS_LABEL[categoria] || categoria;
};

const labelTipoConta = (tipo: string): string => {
  switch (tipo) {
    case "caixa":
      return "Caixa";
    case "banco":
      return "Banco";
    case "pix":
      return "Pix";
    case "carteira":
      return "Carteira";
    default:
      return tipo;
  }
};

const labelFormaPagamento = (forma: string | null | undefined): string => {
  switch (forma) {
    case "pix":
      return "Pix";
    case "dinheiro":
      return "Dinheiro";
    case "cartao_credito":
      return "Cartão de Crédito";
    case "cartao_debito":
      return "Cartão de Débito";
    case "transferencia":
      return "Transferência";
    case "boleto":
      return "Boleto";
    case "outro":
      return "Outro";
    default:
      return forma || "-";
  }
};

type Lancamento = ReturnType<typeof mapCaixaLancamentoRow>;

type ContaInfo = {
  id: string;
  nome: string;
  tipo: string;
  bancoNome?: string;
  bancoSigla?: string;
  bancoCor?: string;
};

type ReportData = {
  lancamentos: Lancamento[];
  contas: ContaInfo[];
  periodLabel: string;
  filters: RelatorioQuery;
};

async function fetchReportData(
  filters: RelatorioQuery,
  adminClient: ReturnType<typeof createAdminClient>,
): Promise<ReportData> {
  // 1) Contagem prévia com os mesmos filtros
  let countQuery = adminClient
    .from("caixa_lancamentos")
    .select("id", { count: "exact", head: true })
    .eq("arquivado", false);

  if (filters.dataInicio)
    countQuery = countQuery.gte("data", filters.dataInicio);
  if (filters.dataFim) countQuery = countQuery.lte("data", filters.dataFim);
  if (filters.contaId) countQuery = countQuery.eq("conta_id", filters.contaId);
  if (filters.tipo) countQuery = countQuery.eq("tipo", filters.tipo);
  if (filters.categoria)
    countQuery = countQuery.eq("categoria", filters.categoria);
  if (filters.clienteId)
    countQuery = countQuery.eq("cliente_id", filters.clienteId);
  if (filters.parceiroId)
    countQuery = countQuery.eq("parceiro_id", filters.parceiroId);
  if (filters.driverId)
    countQuery = countQuery.eq("driver_id", filters.driverId);
  if (filters.fornecedorId)
    countQuery = countQuery.eq("fornecedor_id", filters.fornecedorId);
  if (filters.template === "por_fornecedor") {
    countQuery = countQuery.eq("tipo", "saida");
  }

  const { count, error: countError } = await countQuery;
  if (countError) throw countError;
  if ((count ?? 0) > MAX_LINHAS) {
    throw new Error(
      `Período muito extenso (${count} lançamentos encontrados). Reduza o intervalo de datas ou aplique mais filtros para gerar o relatório. Limite: ${MAX_LINHAS} lançamentos.`,
    );
  }

  // 2) Busca completa
  let query = adminClient
    .from("caixa_lancamentos")
    .select(CAIXA_LANCAMENTO_SELECT)
    .eq("arquivado", false);

  if (filters.dataInicio) query = query.gte("data", filters.dataInicio);
  if (filters.dataFim) query = query.lte("data", filters.dataFim);
  if (filters.contaId) query = query.eq("conta_id", filters.contaId);
  if (filters.tipo) query = query.eq("tipo", filters.tipo);
  if (filters.categoria) query = query.eq("categoria", filters.categoria);
  if (filters.clienteId) query = query.eq("cliente_id", filters.clienteId);
  if (filters.parceiroId) query = query.eq("parceiro_id", filters.parceiroId);
  if (filters.driverId) query = query.eq("driver_id", filters.driverId);
  if (filters.fornecedorId)
    query = query.eq("fornecedor_id", filters.fornecedorId);
  if (filters.template === "por_fornecedor") {
    query = query.eq("tipo", "saida");
  }

  query = query
    .order("data", { ascending: true })
    .order("created_at", { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  const lancamentos = ((data ?? []) as unknown as CaixaLancamentoJoinRow[]).map(
    mapCaixaLancamentoRow,
  );

  // 3) Busca contas para o template "por_conta"
  const contas: ContaInfo[] = [];
  if (filters.template === "por_conta") {
    const { data: contasData, error: contasError } = await adminClient
      .from("caixa_contas")
      .select("id, nome, tipo, banco_id, bancos(nome, sigla, cor)")
      .eq("ativa", true)
      .order("nome", { ascending: true });

    if (contasError) throw contasError;

    const contasRows = (contasData ?? []) as unknown as CaixaContaRow[];
    for (const row of contasRows) {
      const banco = Array.isArray(row.bancos) ? row.bancos[0] : row.bancos;
      contas.push({
        id: row.id,
        nome: row.nome,
        tipo: row.tipo,
        bancoNome: banco?.nome || undefined,
        bancoSigla: banco?.sigla || undefined,
        bancoCor: banco?.cor || undefined,
      });
    }
  }

  const periodLabel = `${formatDate(filters.dataInicio)} a ${formatDate(filters.dataFim)}`;

  return { lancamentos, contas, periodLabel, filters };
}

// =============================================================================
// Excel
// =============================================================================

const TEMPLATE_FILE_LABEL: Record<CaixaReportTemplate, string> = {
  movimentacoes: "movimentacoes",
  por_categoria: "analise-categoria",
  por_fornecedor: "analise-fornecedor",
  por_conta: "analise-conta",
};

async function generateXlsx(data: ReportData): Promise<Response> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Portal Geolog";
  workbook.created = new Date();

  if (data.filters.template === "movimentacoes") {
    buildMovimentacoesSheet(workbook, data);
  } else if (data.filters.template === "por_categoria") {
    buildCategoriaSheet(workbook, data);
  } else if (data.filters.template === "por_fornecedor") {
    buildFornecedorSheet(workbook, data);
  } else {
    buildContaSheet(workbook, data);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const fileName = `caixa-${TEMPLATE_FILE_LABEL[data.filters.template]}-${data.periodLabel.replace(/\s/g, "_")}.xlsx`;

  return new Response(bytes, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

function buildMovimentacoesSheet(
  workbook: ExcelJS.Workbook,
  data: ReportData,
): void {
  const sheet = workbook.addWorksheet("Movimentações", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  const columns = [
    { header: "DATA", key: "data", width: 12 },
    { header: "TIPO", key: "tipo", width: 10 },
    { header: "CONTA", key: "conta", width: 22 },
    { header: "CATEGORIA", key: "categoria", width: 26 },
    { header: "DESCRIÇÃO", key: "descricao", width: 40 },
    { header: "FORMA PGTO", key: "forma", width: 16 },
    { header: "CLIENTE", key: "cliente", width: 22 },
    { header: "FORNECEDOR", key: "fornecedor", width: 22 },
    { header: "VALOR", key: "valor", width: 16 },
  ];
  sheet.columns = columns;
  const lastColLetter = sheet.getColumn(columns.length).letter;

  // Título
  const titleRow = sheet.getRow(1);
  titleRow.height = 28;
  const titleCell = titleRow.getCell(1);
  titleCell.value = `MOVIMENTAÇÕES DE CAIXA — ${data.periodLabel}`;
  sheet.mergeCells(`A1:${lastColLetter}1`);
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" },
  };

  // Subtítulo com resumo
  const totalEntradas = data.lancamentos
    .filter((l) => l.tipo === "entrada")
    .reduce((s, l) => s + l.valor, 0);
  const totalSaidas = data.lancamentos
    .filter((l) => l.tipo === "saida")
    .reduce((s, l) => s + l.valor, 0);
  const saldo = totalEntradas - totalSaidas;

  const subRow = sheet.getRow(2);
  subRow.height = 22;
  const subCell = subRow.getCell(1);
  subCell.value = `Entradas: ${formatCurrency(totalEntradas)}  |  Saídas: ${formatCurrency(totalSaidas)}  |  Saldo: ${formatCurrency(saldo)}  |  ${data.lancamentos.length} lançamento(s)`;
  sheet.mergeCells(`A2:${lastColLetter}2`);
  subCell.font = { bold: true, size: 11, color: { argb: "FF1E3A8A" } };
  subCell.alignment = { vertical: "middle", horizontal: "center" };
  subCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E7FF" },
  };

  // Cabeçalho
  const headerRow = sheet.getRow(3);
  headerRow.height = 20;
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF3B82F6" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF1E3A8A" } },
    };
  });

  // Linhas
  data.lancamentos.forEach((l, idx) => {
    const row = sheet.getRow(4 + idx);
    row.getCell(1).value = formatDate(l.data);
    row.getCell(2).value = l.tipo === "entrada" ? "Entrada" : "Saída";
    row.getCell(3).value = l.contaNome || "-";
    row.getCell(4).value = labelCategoria(l.categoria);
    row.getCell(5).value = l.descricao || "-";
    row.getCell(6).value = labelFormaPagamento(l.formaPagamento);
    row.getCell(7).value = l.clienteNome || "-";
    row.getCell(8).value = l.fornecedorNome || "-";
    row.getCell(9).value = l.valor;
    row.getCell(9).numFmt = '"R$" #,##0.00';

    const isEntrada = l.tipo === "entrada";
    row.getCell(2).font = {
      bold: true,
      color: { argb: isEntrada ? "FF047857" : "FFDC2626" },
    };
    row.getCell(9).font = {
      bold: true,
      color: { argb: isEntrada ? "FF047857" : "FFDC2626" },
    };
    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  // Total
  const totalRow = sheet.getRow(4 + data.lancamentos.length);
  totalRow.getCell(8).value = "SALDO";
  totalRow.getCell(8).font = { bold: true, size: 11 };
  totalRow.getCell(8).alignment = { horizontal: "right" };
  totalRow.getCell(9).value = saldo;
  totalRow.getCell(9).numFmt = '"R$" #,##0.00';
  totalRow.getCell(9).font = {
    bold: true,
    size: 12,
    color: { argb: saldo >= 0 ? "FF047857" : "FFDC2626" },
  };
  totalRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    cell.border = {
      top: { style: "double", color: { argb: "FF1E3A8A" } },
    };
  });
}

function buildCategoriaSheet(
  workbook: ExcelJS.Workbook,
  data: ReportData,
): void {
  const sheet = workbook.addWorksheet("Por Categoria", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  const columns = [
    { header: "CATEGORIA", key: "categoria", width: 30 },
    { header: "ENTRADAS", key: "entradas", width: 18 },
    { header: "SAÍDAS", key: "saidas", width: 18 },
    { header: "SALDO", key: "saldo", width: 18 },
    { header: "QTDE", key: "qtde", width: 10 },
  ];
  sheet.columns = columns;
  const lastColLetter = sheet.getColumn(columns.length).letter;

  const titleRow = sheet.getRow(1);
  titleRow.height = 28;
  const titleCell = titleRow.getCell(1);
  titleCell.value = `ANÁLISE POR CATEGORIA — ${data.periodLabel}`;
  sheet.mergeCells(`A1:${lastColLetter}1`);
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF047857" },
  };

  // Agrupar por categoria
  const grupos = new Map<
    string,
    { entradas: number; saidas: number; qtde: number }
  >();
  for (const l of data.lancamentos) {
    const key = labelCategoria(l.categoria);
    const g = grupos.get(key) || { entradas: 0, saidas: 0, qtde: 0 };
    if (l.tipo === "entrada") g.entradas += l.valor;
    else g.saidas += l.valor;
    g.qtde++;
    grupos.set(key, g);
  }

  const subRow = sheet.getRow(2);
  subRow.height = 22;
  const subCell = subRow.getCell(1);
  subCell.value = `${grupos.size} categoria(s)  |  ${data.lancamentos.length} lançamento(s)`;
  sheet.mergeCells(`A2:${lastColLetter}2`);
  subCell.font = { bold: true, size: 11, color: { argb: "FF047857" } };
  subCell.alignment = { vertical: "middle", horizontal: "center" };
  subCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD1FAE5" },
  };

  // Cabeçalho
  const headerRow = sheet.getRow(3);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF10B981" },
    };
  });

  let rowIdx = 4;
  let totalE = 0;
  let totalS = 0;
  let totalQ = 0;
  const sorted = Array.from(grupos.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], "pt-BR"),
  );
  for (const [cat, g] of sorted) {
    const row = sheet.getRow(rowIdx);
    row.getCell(1).value = cat;
    row.getCell(2).value = g.entradas;
    row.getCell(3).value = g.saidas;
    row.getCell(4).value = g.entradas - g.saidas;
    row.getCell(5).value = g.qtde;
    row.getCell(2).numFmt = '"R$" #,##0.00';
    row.getCell(3).numFmt = '"R$" #,##0.00';
    row.getCell(4).numFmt = '"R$" #,##0.00';
    row.getCell(1).font = { bold: true };
    row.getCell(2).font = { color: { argb: "FF047857" } };
    row.getCell(3).font = { color: { argb: "FFDC2626" } };
    row.getCell(4).font = {
      bold: true,
      color: { argb: g.entradas - g.saidas >= 0 ? "FF047857" : "FFDC2626" },
    };
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
    });
    totalE += g.entradas;
    totalS += g.saidas;
    totalQ += g.qtde;
    rowIdx++;
  }

  // Total
  const totalRow = sheet.getRow(rowIdx);
  totalRow.getCell(1).value = "TOTAL";
  totalRow.getCell(2).value = totalE;
  totalRow.getCell(3).value = totalS;
  totalRow.getCell(4).value = totalE - totalS;
  totalRow.getCell(5).value = totalQ;
  totalRow.getCell(2).numFmt = '"R$" #,##0.00';
  totalRow.getCell(3).numFmt = '"R$" #,##0.00';
  totalRow.getCell(4).numFmt = '"R$" #,##0.00';
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    cell.border = { top: { style: "double", color: { argb: "FF047857" } } };
  });
}

function buildFornecedorSheet(
  workbook: ExcelJS.Workbook,
  data: ReportData,
): void {
  const sheet = workbook.addWorksheet("Por Fornecedor", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  const columns = [
    { header: "FORNECEDOR", key: "fornecedor", width: 32 },
    { header: "TOTAL PAGO", key: "total", width: 18 },
    { header: "QTDE", key: "qtde", width: 10 },
  ];
  sheet.columns = columns;
  const lastColLetter = sheet.getColumn(columns.length).letter;

  const titleRow = sheet.getRow(1);
  titleRow.height = 28;
  const titleCell = titleRow.getCell(1);
  titleCell.value = `ANÁLISE POR FORNECEDOR (SAÍDAS) — ${data.periodLabel}`;
  sheet.mergeCells(`A1:${lastColLetter}1`);
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFB45309" },
  };

  // Agrupar por fornecedor
  const grupos = new Map<string, { total: number; qtde: number }>();
  for (const l of data.lancamentos) {
    const key = l.fornecedorNome || "Sem Fornecedor";
    const g = grupos.get(key) || { total: 0, qtde: 0 };
    g.total += l.valor;
    g.qtde++;
    grupos.set(key, g);
  }

  const subRow = sheet.getRow(2);
  subRow.height = 22;
  const subCell = subRow.getCell(1);
  subCell.value = `${grupos.size} fornecedor(es)  |  ${data.lancamentos.length} saída(s)`;
  sheet.mergeCells(`A2:${lastColLetter}2`);
  subCell.font = { bold: true, size: 11, color: { argb: "FFB45309" } };
  subCell.alignment = { vertical: "middle", horizontal: "center" };
  subCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFEF3C7" },
  };

  const headerRow = sheet.getRow(3);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF59E0B" },
    };
  });

  let rowIdx = 4;
  let totalG = 0;
  let totalQ = 0;
  const sorted = Array.from(grupos.entries()).sort(
    (a, b) => b[1].total - a[1].total,
  );
  for (const [forn, g] of sorted) {
    const row = sheet.getRow(rowIdx);
    row.getCell(1).value = forn;
    row.getCell(2).value = g.total;
    row.getCell(3).value = g.qtde;
    row.getCell(2).numFmt = '"R$" #,##0.00';
    row.getCell(1).font = { bold: true };
    row.getCell(2).font = { bold: true, color: { argb: "FFDC2626" } };
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
    });
    totalG += g.total;
    totalQ += g.qtde;
    rowIdx++;
  }

  const totalRow = sheet.getRow(rowIdx);
  totalRow.getCell(1).value = "TOTAL";
  totalRow.getCell(2).value = totalG;
  totalRow.getCell(3).value = totalQ;
  totalRow.getCell(2).numFmt = '"R$" #,##0.00';
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    cell.border = { top: { style: "double", color: { argb: "FFB45309" } } };
  });
}

function buildContaSheet(workbook: ExcelJS.Workbook, data: ReportData): void {
  const sheet = workbook.addWorksheet("Por Conta", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  const columns = [
    { header: "CONTA", key: "conta", width: 24 },
    { header: "TIPO", key: "tipo", width: 12 },
    { header: "ENTRADAS", key: "entradas", width: 18 },
    { header: "SAÍDAS", key: "saidas", width: 18 },
    { header: "SALDO PERÍODO", key: "saldo", width: 18 },
    { header: "QTDE", key: "qtde", width: 10 },
  ];
  sheet.columns = columns;
  const lastColLetter = sheet.getColumn(columns.length).letter;

  const titleRow = sheet.getRow(1);
  titleRow.height = 28;
  const titleCell = titleRow.getCell(1);
  titleCell.value = `ANÁLISE POR CONTA — ${data.periodLabel}`;
  sheet.mergeCells(`A1:${lastColLetter}1`);
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF7C3AED" },
  };

  // Agrupar por conta
  const grupos = new Map<
    string,
    {
      nome: string;
      tipo: string;
      entradas: number;
      saidas: number;
      qtde: number;
    }
  >();

  // Inicializa com todas as contas ativas
  for (const c of data.contas) {
    grupos.set(c.id, {
      nome: c.nome,
      tipo: labelTipoConta(c.tipo),
      entradas: 0,
      saidas: 0,
      qtde: 0,
    });
  }

  for (const l of data.lancamentos) {
    const key = l.contaId;
    if (!key) continue;
    const g = grupos.get(key) || {
      nome: l.contaNome || "-",
      tipo: labelTipoConta(l.contaTipo || ""),
      entradas: 0,
      saidas: 0,
      qtde: 0,
    };
    if (l.tipo === "entrada") g.entradas += l.valor;
    else g.saidas += l.valor;
    g.qtde++;
    grupos.set(key, g);
  }

  const subRow = sheet.getRow(2);
  subRow.height = 22;
  const subCell = subRow.getCell(1);
  subCell.value = `${grupos.size} conta(s)  |  ${data.lancamentos.length} lançamento(s)`;
  sheet.mergeCells(`A2:${lastColLetter}2`);
  subCell.font = { bold: true, size: 11, color: { argb: "FF7C3AED" } };
  subCell.alignment = { vertical: "middle", horizontal: "center" };
  subCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEDE9FE" },
  };

  const headerRow = sheet.getRow(3);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF8B5CF6" },
    };
  });

  let rowIdx = 4;
  let totalE = 0;
  let totalS = 0;
  let totalQ = 0;
  const sorted = Array.from(grupos.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );
  for (const g of sorted) {
    const row = sheet.getRow(rowIdx);
    row.getCell(1).value = g.nome;
    row.getCell(2).value = g.tipo;
    row.getCell(3).value = g.entradas;
    row.getCell(4).value = g.saidas;
    row.getCell(5).value = g.entradas - g.saidas;
    row.getCell(6).value = g.qtde;
    row.getCell(3).numFmt = '"R$" #,##0.00';
    row.getCell(4).numFmt = '"R$" #,##0.00';
    row.getCell(5).numFmt = '"R$" #,##0.00';
    row.getCell(1).font = { bold: true };
    row.getCell(3).font = { color: { argb: "FF047857" } };
    row.getCell(4).font = { color: { argb: "FFDC2626" } };
    row.getCell(5).font = {
      bold: true,
      color: { argb: g.entradas - g.saidas >= 0 ? "FF047857" : "FFDC2626" },
    };
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
    });
    totalE += g.entradas;
    totalS += g.saidas;
    totalQ += g.qtde;
    rowIdx++;
  }

  const totalRow = sheet.getRow(rowIdx);
  totalRow.getCell(1).value = "TOTAL CONSOLIDADO";
  totalRow.getCell(3).value = totalE;
  totalRow.getCell(4).value = totalS;
  totalRow.getCell(5).value = totalE - totalS;
  totalRow.getCell(6).value = totalQ;
  totalRow.getCell(3).numFmt = '"R$" #,##0.00';
  totalRow.getCell(4).numFmt = '"R$" #,##0.00';
  totalRow.getCell(5).numFmt = '"R$" #,##0.00';
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    cell.border = { top: { style: "double", color: { argb: "FF7C3AED" } } };
  });
}

// =============================================================================
// PDF
// =============================================================================

const COMPANY_DATA = {
  name: "GELOG TRANSPORTES E LOGÍSTICA LTDA",
  cnpj: "31.223.049/0001-37",
  address:
    "Rua Jandira Morais Pimentel, 490 Centro 28893-046 - Rio das Ostras - Rio de Janeiro",
  phone: "2299759-9213",
  email: "contato@geolog.com.br",
};

const TEMPLATE_TITLE: Record<CaixaReportTemplate, string> = {
  movimentacoes: "MOVIMENTAÇÕES DE CAIXA",
  por_categoria: "ANÁLISE POR CATEGORIA",
  por_fornecedor: "ANÁLISE POR FORNECEDOR",
  por_conta: "ANÁLISE POR CONTA",
};

async function generatePdf(data: ReportData): Promise<Response> {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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

  const reportTitle = TEMPLATE_TITLE[data.filters.template];

  // ── Rounded rectangle helper ──
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

  // ── Color palette (same as Financeiro) ──
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

  // ── Gradient header background ──
  function drawGradientHeaderBg(currentPage: PDFPage) {
    const topY = pageHeight - 120;
    const h = 120;
    const strips = 24;
    const stripH = h / strips;
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

  // ── Header ──
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

    currentPage.drawText(COMPANY_DATA.name, {
      x: margin + 60,
      y: pageHeight - 40,
      size: 16,
      font: boldFont,
      color: c.headerText,
    });
    currentPage.drawText(`CNPJ: ${COMPANY_DATA.cnpj}`, {
      x: margin + 60,
      y: pageHeight - 55,
      size: 8,
      font: regularFont,
      color: c.headerMuted,
    });
    currentPage.drawText(COMPANY_DATA.address, {
      x: margin + 60,
      y: pageHeight - 70,
      size: 8,
      font: regularFont,
      color: c.headerMuted,
    });
    currentPage.drawText(`Tel: ${COMPANY_DATA.phone}`, {
      x: margin + 60,
      y: pageHeight - 85,
      size: 8,
      font: regularFont,
      color: c.headerMuted,
    });

    // Title box (right side)
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

  // ── Summary card tones ──
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

  // ── Card icons ──
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
      case "money": {
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
        currentPage.drawRectangle({
          x: cx - 0.75,
          y: cy - s * 0.3,
          width: 1.5,
          height: s * 0.6,
          color: c.standardBg,
        });
        break;
      }
      case "document": {
        const w = s * 0.7;
        const h = s * 0.9;
        const x = cx - w / 2;
        const y = cy - h / 2;
        currentPage.drawRectangle({
          x,
          y,
          width: w,
          height: h,
          color,
          borderWidth: 0,
        });
        const corner = s * 0.25;
        currentPage.drawRectangle({
          x: x + w - corner,
          y: y + h - corner,
          width: corner + 1,
          height: corner + 1,
          color: c.standardBg,
        });
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
      case "people": {
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
        drawP(s * 0.15, s * 0.1, 0.9);
        drawP(-s * 0.15, -s * 0.1, 1);
        break;
      }
      case "check": {
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

  // ── Table header ──
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

    let x = margin;
    headers.forEach((header) => {
      const align = header.align || "left";
      const textWidth = boldFont.widthOfTextAtSize(header.label, 9);
      const drawX =
        align === "right"
          ? x + header.width - 13 - textWidth
          : align === "center"
            ? x + (header.width - textWidth) / 2
            : x + 14;
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

  // ── Footer ──
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

    currentPage.drawText(`CNPJ: ${COMPANY_DATA.cnpj}`, {
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

  // ── Page state ──
  type PageState = { page: PDFPage; y: number };
  const state: PageState = {
    page: pdfDoc.addPage([pageWidth, pageHeight]),
    y: pageHeight - margin,
  };

  const newPage = (): void => {
    state.page = pdfDoc.addPage([pageWidth, pageHeight]);
    state.y = pageHeight - margin;
  };

  const ensureSpace = (heightNeeded: number): void => {
    if (state.y - heightNeeded < margin + 50) newPage();
  };

  // ── Draw header on first page ──
  drawHeader(state.page);
  state.y = pageHeight - 140;

  // ── Summary cards ──
  const totalEntradas = data.lancamentos
    .filter((l) => l.tipo === "entrada")
    .reduce((s, l) => s + l.valor, 0);
  const totalSaidas = data.lancamentos
    .filter((l) => l.tipo === "saida")
    .reduce((s, l) => s + l.valor, 0);
  const saldo = totalEntradas - totalSaidas;

  const summaryCards = [
    {
      title: "Entradas",
      value: formatCurrency(totalEntradas),
      subtitle: `${data.lancamentos.filter((l) => l.tipo === "entrada").length} lançamento(s)`,
      iconType: "money",
      tone: "emerald" as SummaryCardTone,
      emphasis: true,
    },
    {
      title: "Saídas",
      value: formatCurrency(totalSaidas),
      subtitle: `${data.lancamentos.filter((l) => l.tipo === "saida").length} lançamento(s)`,
      iconType: "money",
      tone: "amber" as SummaryCardTone,
      emphasis: true,
    },
    {
      title: "Saldo",
      value: formatCurrency(saldo),
      subtitle: saldo >= 0 ? "Positivo" : "Negativo",
      iconType: "check",
      tone:
        saldo >= 0 ? ("teal" as SummaryCardTone) : ("amber" as SummaryCardTone),
      emphasis: true,
    },
  ];

  const cardW = 250;
  const cardH = 80;
  const cardGap = 12;
  const cardY = state.y - cardH;
  summaryCards.forEach((card, i) => {
    const cardX = margin + i * (cardW + cardGap);
    drawSummaryBox(
      state.page,
      cardX,
      cardY,
      cardW,
      cardH,
      card.title,
      card.value,
      card.subtitle,
      card.iconType,
      card.tone,
      card.emphasis,
    );
  });

  state.y = cardY - 24;

  // ── Table ──
  const template = data.filters.template;

  type Col = { header: string; width: number; align: "left" | "right" };
  let cols: Col[];
  let grupos: Array<{
    label: string;
    tipo?: string;
    entradas?: number;
    saidas?: number;
    saldo?: number;
    total?: number;
    qtde: number;
  }>;

  if (template === "movimentacoes") {
    cols = [
      { header: "DATA", width: 80, align: "left" },
      { header: "TIPO", width: 70, align: "left" },
      { header: "CONTA", width: 130, align: "left" },
      { header: "CATEGORIA", width: 170, align: "left" },
      { header: "DESCRIÇÃO", width: 230, align: "left" },
      { header: "VALOR", width: 98, align: "right" },
    ];
    grupos = data.lancamentos.map((l) => ({
      label: l.descricao || "-",
      tipo: l.tipo,
      entradas: l.tipo === "entrada" ? l.valor : 0,
      saidas: l.tipo === "saida" ? l.valor : 0,
      qtde: 1,
    }));
  } else if (template === "por_categoria") {
    cols = [
      { header: "CATEGORIA", width: 280, align: "left" },
      { header: "ENTRADAS", width: 140, align: "right" },
      { header: "SAÍDAS", width: 140, align: "right" },
      { header: "SALDO", width: 140, align: "right" },
      { header: "QTDE", width: 78, align: "right" },
    ];
    const map = new Map<
      string,
      { entradas: number; saidas: number; qtde: number }
    >();
    for (const l of data.lancamentos) {
      const key = labelCategoria(l.categoria);
      const g = map.get(key) || { entradas: 0, saidas: 0, qtde: 0 };
      if (l.tipo === "entrada") g.entradas += l.valor;
      else g.saidas += l.valor;
      g.qtde++;
      map.set(key, g);
    }
    grupos = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([label, g]) => ({
        label,
        entradas: g.entradas,
        saidas: g.saidas,
        saldo: g.entradas - g.saidas,
        qtde: g.qtde,
      }));
  } else if (template === "por_fornecedor") {
    cols = [
      { header: "FORNECEDOR", width: 470, align: "left" },
      { header: "TOTAL PAGO", width: 210, align: "right" },
      { header: "QTDE", width: 98, align: "right" },
    ];
    const map = new Map<string, { total: number; qtde: number }>();
    for (const l of data.lancamentos) {
      const key = l.fornecedorNome || "Sem Fornecedor";
      const g = map.get(key) || { total: 0, qtde: 0 };
      g.total += l.valor;
      g.qtde++;
      map.set(key, g);
    }
    grupos = Array.from(map.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([label, g]) => ({ label, total: g.total, qtde: g.qtde }));
  } else {
    cols = [
      { header: "CONTA", width: 230, align: "left" },
      { header: "TIPO", width: 80, align: "left" },
      { header: "ENTRADAS", width: 130, align: "right" },
      { header: "SAÍDAS", width: 130, align: "right" },
      { header: "SALDO", width: 130, align: "right" },
      { header: "QTDE", width: 78, align: "right" },
    ];
    const map = new Map<
      string,
      {
        nome: string;
        tipo: string;
        entradas: number;
        saidas: number;
        qtde: number;
      }
    >();
    for (const c of data.contas) {
      map.set(c.id, {
        nome: c.nome,
        tipo: labelTipoConta(c.tipo),
        entradas: 0,
        saidas: 0,
        qtde: 0,
      });
    }
    for (const l of data.lancamentos) {
      const key = l.contaId;
      if (!key) continue;
      const g = map.get(key) || {
        nome: l.contaNome || "-",
        tipo: labelTipoConta(l.contaTipo || ""),
        entradas: 0,
        saidas: 0,
        qtde: 0,
      };
      if (l.tipo === "entrada") g.entradas += l.valor;
      else g.saidas += l.valor;
      g.qtde++;
      map.set(key, g);
    }
    grupos = Array.from(map.values())
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map((g) => ({
        label: g.nome,
        tipo: g.tipo,
        entradas: g.entradas,
        saidas: g.saidas,
        saldo: g.entradas - g.saidas,
        qtde: g.qtde,
      }));
  }

  let accX = margin;
  const colXs = cols.map((col) => {
    const x = accX;
    accX += col.width;
    return x;
  });

  // Table header
  ensureSpace(42);
  drawTableHeader(
    state.page,
    state.y - 32,
    cols.map((col) => ({
      label: col.header,
      width: col.width,
      align: col.align,
    })),
  );
  // 10px gap between table header and first row
  state.y = state.y - 32 - 10;

  const rowHeight = 28;

  const checkPageBreak = () => {
    if (state.y - rowHeight < margin + 40) {
      state.page = pdfDoc.addPage([pageWidth, pageHeight]);
      drawHeader(state.page);
      state.y = pageHeight - 140;
      drawTableHeader(
        state.page,
        state.y - 32,
        cols.map((col) => ({
          label: col.header,
          width: col.width,
          align: col.align,
        })),
      );
      state.y = state.y - 32 - 10;
    }
  };

  // Data rows
  if (template === "movimentacoes") {
    data.lancamentos.forEach((l, idx) => {
      checkPageBreak();
      const isEven = idx % 2 === 0;
      state.y -= rowHeight;

      state.page.drawRectangle({
        x: margin,
        y: state.y,
        width: pageWidth - margin * 2,
        height: rowHeight,
        color: isEven ? c.tableZebra : c.tableWhite,
      });

      const isEntrada = l.tipo === "entrada";
      const valorColor = isEntrada ? c.accentGreen : c.accentRed;
      const cells: Array<{
        text: string;
        x: number;
        width: number;
        align?: "left" | "right";
        color?: RGB;
        bold?: boolean;
      }> = [
        {
          text: formatDate(l.data),
          x: colXs[0],
          width: cols[0].width,
          bold: true,
        },
        {
          text: l.tipo === "entrada" ? "Entrada" : "Saída",
          x: colXs[1],
          width: cols[1].width,
          color: isEntrada ? c.accentGreen : c.accentRed,
          bold: true,
        },
        {
          text: truncatePdf(l.contaNome || "-", 20),
          x: colXs[2],
          width: cols[2].width,
        },
        {
          text: truncatePdf(labelCategoria(l.categoria), 26),
          x: colXs[3],
          width: cols[3].width,
        },
        {
          text: truncatePdf(l.descricao || "-", 36),
          x: colXs[4],
          width: cols[4].width,
        },
        {
          text: formatCurrency(l.valor),
          x: colXs[5],
          width: cols[5].width,
          align: "right",
          color: valorColor,
          bold: true,
        },
      ];

      for (const cell of cells) {
        const font = cell.bold ? boldFont : regularFont;
        const textW = font.widthOfTextAtSize(cell.text, 9);
        const tx =
          cell.align === "right"
            ? cell.x + cell.width - textW - 8
            : cell.x + 14;
        state.page.drawText(cell.text, {
          x: tx,
          y: state.y + rowHeight / 2 - 4.5,
          size: 9,
          font,
          color: cell.color || c.textDark,
        });
      }
    });
  } else {
    grupos.forEach((g, idx) => {
      checkPageBreak();
      const isEven = idx % 2 === 0;
      state.y -= rowHeight;

      state.page.drawRectangle({
        x: margin,
        y: state.y,
        width: pageWidth - margin * 2,
        height: rowHeight,
        color: isEven ? c.tableZebra : c.tableWhite,
      });

      const cells: Array<{
        text: string;
        x: number;
        width: number;
        align?: "left" | "right";
        color?: RGB;
        bold?: boolean;
      }> = [];

      if (template === "por_fornecedor") {
        cells.push({
          text: truncatePdf(g.label, 60),
          x: colXs[0],
          width: cols[0].width,
          bold: true,
        });
        cells.push({
          text: formatCurrency(g.total || 0),
          x: colXs[1],
          width: cols[1].width,
          align: "right",
          color: c.accentRed,
          bold: true,
        });
        cells.push({
          text: String(g.qtde),
          x: colXs[2],
          width: cols[2].width,
          align: "right",
        });
      } else if (template === "por_conta") {
        cells.push({
          text: truncatePdf(g.label, 36),
          x: colXs[0],
          width: cols[0].width,
          bold: true,
        });
        cells.push({ text: g.tipo || "", x: colXs[1], width: cols[1].width });
        cells.push({
          text: formatCurrency(g.entradas || 0),
          x: colXs[2],
          width: cols[2].width,
          align: "right",
          color: c.accentGreen,
          bold: true,
        });
        cells.push({
          text: formatCurrency(g.saidas || 0),
          x: colXs[3],
          width: cols[3].width,
          align: "right",
          color: c.accentRed,
          bold: true,
        });
        cells.push({
          text: formatCurrency(g.saldo || 0),
          x: colXs[4],
          width: cols[4].width,
          align: "right",
          color: (g.saldo || 0) >= 0 ? c.accentGreen : c.accentRed,
          bold: true,
        });
        cells.push({
          text: String(g.qtde),
          x: colXs[5],
          width: cols[5].width,
          align: "right",
        });
      } else {
        cells.push({
          text: truncatePdf(g.label, 42),
          x: colXs[0],
          width: cols[0].width,
          bold: true,
        });
        cells.push({
          text: formatCurrency(g.entradas || 0),
          x: colXs[1],
          width: cols[1].width,
          align: "right",
          color: c.accentGreen,
          bold: true,
        });
        cells.push({
          text: formatCurrency(g.saidas || 0),
          x: colXs[2],
          width: cols[2].width,
          align: "right",
          color: c.accentRed,
          bold: true,
        });
        cells.push({
          text: formatCurrency(g.saldo || 0),
          x: colXs[3],
          width: cols[3].width,
          align: "right",
          color: (g.saldo || 0) >= 0 ? c.accentGreen : c.accentRed,
          bold: true,
        });
        cells.push({
          text: String(g.qtde),
          x: colXs[4],
          width: cols[4].width,
          align: "right",
        });
      }

      for (const cell of cells) {
        const font = cell.bold ? boldFont : regularFont;
        const textW = font.widthOfTextAtSize(cell.text, 9);
        const tx =
          cell.align === "right"
            ? cell.x + cell.width - textW - 8
            : cell.x + 14;
        state.page.drawText(cell.text, {
          x: tx,
          y: state.y + rowHeight / 2 - 4.5,
          size: 9,
          font,
          color: cell.color || c.textDark,
        });
      }
    });
  }

  // Total row
  const totalRowHeight = 30;
  if (state.y - totalRowHeight < margin + 40) {
    state.page = pdfDoc.addPage([pageWidth, pageHeight]);
    drawHeader(state.page);
    state.y = pageHeight - 140;
    drawTableHeader(
      state.page,
      state.y - 32,
      cols.map((col) => ({
        label: col.header,
        width: col.width,
        align: col.align,
      })),
    );
    state.y = state.y - 32 - 10;
  }

  state.y -= totalRowHeight;
  state.page.drawRectangle({
    x: margin,
    y: state.y,
    width: pageWidth - margin * 2,
    height: totalRowHeight,
    color: rgb(0.05, 0.12, 0.23),
  });

  const totalE =
    template === "por_fornecedor"
      ? 0
      : grupos.reduce((s, g) => s + (g.entradas || 0), 0);
  const totalS =
    template === "por_fornecedor"
      ? 0
      : grupos.reduce((s, g) => s + (g.saidas || 0), 0);
  const totalSaldo = totalE - totalS;
  const totalQtde = grupos.reduce((s, g) => s + g.qtde, 0);

  const totalCells: Array<{
    text: string;
    x: number;
    width: number;
    align?: "left" | "right";
    color?: RGB;
  }> = [];
  if (template === "por_fornecedor") {
    totalCells.push({
      text: "TOTAL",
      x: colXs[0],
      width: cols[0].width,
      color: rgb(1, 1, 1),
    });
    totalCells.push({
      text: formatCurrency(grupos.reduce((s, g) => s + (g.total || 0), 0)),
      x: colXs[1],
      width: cols[1].width,
      align: "right",
      color: rgb(1, 0.45, 0.45),
    });
    totalCells.push({
      text: String(totalQtde),
      x: colXs[2],
      width: cols[2].width,
      align: "right",
      color: rgb(1, 1, 1),
    });
  } else if (template === "por_conta") {
    totalCells.push({
      text: "TOTAL CONSOLIDADO",
      x: colXs[0],
      width: cols[0].width,
      color: rgb(1, 1, 1),
    });
    totalCells.push({ text: "", x: colXs[1], width: cols[1].width });
    totalCells.push({
      text: formatCurrency(totalE),
      x: colXs[2],
      width: cols[2].width,
      align: "right",
      color: rgb(0.4, 0.95, 0.65),
    });
    totalCells.push({
      text: formatCurrency(totalS),
      x: colXs[3],
      width: cols[3].width,
      align: "right",
      color: rgb(1, 0.45, 0.45),
    });
    totalCells.push({
      text: formatCurrency(totalSaldo),
      x: colXs[4],
      width: cols[4].width,
      align: "right",
      color: totalSaldo >= 0 ? rgb(0.4, 0.95, 0.65) : rgb(1, 0.45, 0.45),
    });
    totalCells.push({
      text: String(totalQtde),
      x: colXs[5],
      width: cols[5].width,
      align: "right",
      color: rgb(1, 1, 1),
    });
  } else if (template === "movimentacoes") {
    totalCells.push({
      text: "SALDO",
      x: colXs[4],
      width: cols[4].width,
      align: "right",
      color: rgb(1, 1, 1),
    });
    totalCells.push({
      text: formatCurrency(saldo),
      x: colXs[5],
      width: cols[5].width,
      align: "right",
      color: saldo >= 0 ? rgb(0.4, 0.95, 0.65) : rgb(1, 0.45, 0.45),
    });
  } else {
    totalCells.push({
      text: "TOTAL",
      x: colXs[0],
      width: cols[0].width,
      color: rgb(1, 1, 1),
    });
    totalCells.push({
      text: formatCurrency(totalE),
      x: colXs[1],
      width: cols[1].width,
      align: "right",
      color: rgb(0.4, 0.95, 0.65),
    });
    totalCells.push({
      text: formatCurrency(totalS),
      x: colXs[2],
      width: cols[2].width,
      align: "right",
      color: rgb(1, 0.45, 0.45),
    });
    totalCells.push({
      text: formatCurrency(totalSaldo),
      x: colXs[3],
      width: cols[3].width,
      align: "right",
      color: totalSaldo >= 0 ? rgb(0.4, 0.95, 0.65) : rgb(1, 0.45, 0.45),
    });
    totalCells.push({
      text: String(totalQtde),
      x: colXs[4],
      width: cols[4].width,
      align: "right",
      color: rgb(1, 1, 1),
    });
  }

  for (const cell of totalCells) {
    if (!cell.text) continue;
    const textW = boldFont.widthOfTextAtSize(cell.text, 10);
    const tx =
      cell.align === "right" ? cell.x + cell.width - textW - 8 : cell.x + 14;
    state.page.drawText(cell.text, {
      x: tx,
      y: state.y + totalRowHeight / 2 - 4.5,
      size: 10,
      font: boldFont,
      color: cell.color || rgb(1, 1, 1),
    });
  }

  // ── Footer on all pages ──
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  pages.forEach((page, i) => {
    drawFooter(page, i + 1, totalPages);
  });

  const pdfBytes = new Uint8Array(await pdfDoc.save());
  const fileName = `caixa-${TEMPLATE_FILE_LABEL[data.filters.template]}-${data.periodLabel.replace(/\s/g, "_")}.pdf`;

  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

function truncatePdf(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

// =============================================================================
// Handler
// =============================================================================

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (!(await hasCaixaAccess(user.id))) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const url = new URL(request.url);
    const filters = parseQuery(url.searchParams);

    if (!filters.dataInicio || !filters.dataFim) {
      return NextResponse.json(
        { error: "dataInicio e dataFim são obrigatórios." },
        { status: 400 },
      );
    }
    if (filters.dataInicio > filters.dataFim) {
      return NextResponse.json(
        { error: "Data inicial maior que a data final." },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    const data = await fetchReportData(filters, adminClient);

    if (data.lancamentos.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhum lançamento encontrado para os filtros aplicados no período selecionado.",
        },
        { status: 404 },
      );
    }

    if (filters.format === "xlsx") {
      return await generateXlsx(data);
    }

    return await generatePdf(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[Caixa Relatorio Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// sanitizeFileName é usado em exports futuros; manter import ativo
void sanitizeFileName;
