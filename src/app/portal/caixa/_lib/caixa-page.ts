import type { Cliente, Driver } from "@/context/DataContext";
import type { ParceiroServico } from "@/lib/supabase/queries";

// =============================================================================
// Tipos de domínio
// =============================================================================

export type CaixaContaTipo = "caixa" | "banco" | "pix" | "carteira";

export type CaixaContaBanco = {
  nome: string;
  sigla: string;
  cor: string;
};

export type CaixaConta = {
  id: string;
  nome: string;
  tipo: CaixaContaTipo;
  saldoInicial: number;
  ativa: boolean;
  isDefault: boolean;
  createdAt: string;
  bancoId?: string | null;
  banco?: CaixaContaBanco | null;
};

export type CaixaFormaPagamento =
  | "pix"
  | "dinheiro"
  | "cartao_credito"
  | "cartao_debito"
  | "transferencia"
  | "boleto"
  | "outro";

export type CaixaLancamentoOrigem = "manual" | "os_recebimento" | "os_repasse";

export type CaixaLancamento = {
  id: string;
  contaId: string;
  tipo: "entrada" | "saida";
  valor: number;
  data: string;
  descricao: string;
  categoria: string;
  formaPagamento: CaixaFormaPagamento;
  clienteId: string | null;
  parceiroId: string | null;
  driverId: string | null;
  fornecedorId: string | null;
  osId: string | null;
  origem: CaixaLancamentoOrigem;
  anexoPath: string | null;
  contaNome?: string;
  contaTipo?: CaixaContaTipo;
  clienteNome?: string | null;
  parceiroNome?: string | null;
  driverNome?: string | null;
  fornecedorNome?: string | null;
  osProtocolo?: string | null;
  createdAt: string;
};

export type CaixaOverview = {
  totalEntradas: number;
  totalSaidas: number;
  saldoPeriodo: number;
  saldoConsolidado: number;
  totalLancamentos: number;
  saldosPorConta: Array<{
    contaId: string;
    contaNome: string;
    contaTipo: CaixaContaTipo;
    saldo: number;
  }>;
};

export const EMPTY_CAIXA_OVERVIEW: CaixaOverview = {
  totalEntradas: 0,
  totalSaidas: 0,
  saldoPeriodo: 0,
  saldoConsolidado: 0,
  totalLancamentos: 0,
  saldosPorConta: [],
};

// =============================================================================
// Lookup maps
// =============================================================================

export type CaixaLookupMaps = {
  contaMap: Map<string, CaixaConta>;
  customerMap: Map<string, string>;
  driverMap: Map<string, string>;
  partnerMap: Map<string, string>;
};

type ClienteLike = Pick<Cliente, "id" | "nome">;
type DriverLike = Pick<Driver, "id" | "name">;
type ParceiroLike = Pick<ParceiroServico, "id" | "razaoSocialOuNomeCompleto">;

export const createCaixaLookupMaps = (
  contas: CaixaConta[],
  clientes: ClienteLike[],
  drivers: DriverLike[],
  parceiros: ParceiroLike[],
): CaixaLookupMaps => {
  const contaMap = new Map<string, CaixaConta>();
  contas.forEach((conta) => contaMap.set(conta.id, conta));

  const customerMap = new Map<string, string>();
  clientes.forEach((c) => customerMap.set(c.id, c.nome));

  const driverMap = new Map<string, string>();
  drivers.forEach((d) => driverMap.set(d.id, d.name));

  const partnerMap = new Map<string, string>();
  parceiros.forEach((p) => partnerMap.set(p.id, p.razaoSocialOuNomeCompleto));

  return { contaMap, customerMap, driverMap, partnerMap };
};

// =============================================================================
// Formatação (mantém paridade com financeiro-page.ts)
// =============================================================================

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
});

export const formatCurrency = (value: number): string =>
  currencyFormatter.format(value);

export const formatDate = (value?: string | null): string => {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return dateFormatter.format(new Date(year, month - 1, day));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return dateFormatter.format(parsed);
};

// =============================================================================
// Helpers de data (fuso de Brasília)
// =============================================================================

export const getBrazilDate = (): Date => {
  const br = new Date().toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
  });
  return new Date(br);
};

export const startOfWeek = (date = getBrazilDate()): Date => {
  const clone = new Date(date);
  const day = clone.getDay();
  const diff = day === 0 ? 6 : day - 1;
  clone.setDate(clone.getDate() - diff);
  clone.setHours(0, 0, 0, 0);
  return clone;
};

export const endOfWeek = (date = getBrazilDate()): Date => {
  const clone = new Date(date);
  const day = clone.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  clone.setDate(clone.getDate() + diff);
  clone.setHours(23, 59, 59, 999);
  return clone;
};

export const startOfMonth = (date = getBrazilDate()): Date => {
  const clone = new Date(date);
  clone.setDate(1);
  clone.setHours(0, 0, 0, 0);
  return clone;
};

export const endOfMonth = (date = getBrazilDate()): Date => {
  const clone = new Date(date);
  clone.setMonth(clone.getMonth() + 1, 0);
  clone.setHours(23, 59, 59, 999);
  return clone;
};

export const normalizeToInputDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// =============================================================================
// Labels / constantes de exibição
// =============================================================================

export const CATEGORIAS_ENTRADA: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "recebimento_cliente", label: "Recebimento de Cliente" },
  { value: "repasse_recebido", label: "Repasse Recebido" },
  { value: "estorno", label: "Estorno" },
  { value: "rendimento", label: "Rendimento / Juros" },
  { value: "emprestimo", label: "Empréstimo / Aporte" },
  { value: "outros", label: "Outros" },
];

export const CATEGORIAS_SAIDA: ReadonlyArray<{ value: string; label: string }> =
  [
    { value: "repasse_motorista", label: "Repasse a Motorista" },
    { value: "combustivel", label: "Combustível" },
    { value: "manutencao", label: "Manutenção" },
    { value: "aluguel", label: "Aluguel" },
    { value: "salarios", label: "Salários / Pró-labore" },
    { value: "impostos", label: "Impostos" },
    { value: "fornecedores", label: "Fornecedores" },
    { value: "despesas_fixas", label: "Despesas Fixas" },
    { value: "despesas_variaveis", label: "Despesas Variáveis" },
    { value: "investimento", label: "Investimento" },
    { value: "outros", label: "Outros" },
  ];

export const FORMAS_PAGAMENTO: ReadonlyArray<{
  value: CaixaFormaPagamento;
  label: string;
}> = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "outro", label: "Outro" },
];

export const TIPOS_CONTA: ReadonlyArray<{
  value: CaixaContaTipo;
  label: string;
}> = [
  { value: "caixa", label: "Caixa" },
  { value: "banco", label: "Banco" },
  { value: "pix", label: "Pix" },
  { value: "carteira", label: "Carteira" },
];

export const labelOf = <T extends string>(
  list: ReadonlyArray<{ value: T; label: string }>,
  value: T | string | null | undefined,
): string => {
  if (!value) return "-";
  const found = list.find((item) => item.value === value);
  return found ? found.label : String(value);
};

export const labelCategoria = (
  categoria: string | null | undefined,
): string => {
  if (!categoria) return "-";
  const inEntrada = CATEGORIAS_ENTRADA.find((c) => c.value === categoria);
  if (inEntrada) return inEntrada.label;
  const inSaida = CATEGORIAS_SAIDA.find((c) => c.value === categoria);
  if (inSaida) return inSaida.label;
  return categoria;
};

export const labelFormaPagamento = (
  forma: CaixaFormaPagamento | string | null | undefined,
): string => labelOf(FORMAS_PAGAMENTO, forma);

export const labelTipoConta = (
  tipo: CaixaContaTipo | string | null | undefined,
): string => labelOf(TIPOS_CONTA, tipo);

export const labelOrigem = (
  origem: CaixaLancamentoOrigem | string | null | undefined,
): string => {
  switch (origem) {
    case "os_recebimento":
      return "Recebimento de OS";
    case "os_repasse":
      return "Repasse de OS";
    case "manual":
      return "Manual";
    default:
      return String(origem ?? "-");
  }
};

// =============================================================================
// Filtros de query
// =============================================================================

export type CaixaQueryFilters = {
  dataInicio?: string;
  dataFim?: string;
  contaId?: string;
  tipo?: "entrada" | "saida";
  categoria?: string;
  formaPagamento?: CaixaFormaPagamento;
  clienteId?: string;
  parceiroId?: string;
  driverId?: string;
  origem?: CaixaLancamentoOrigem;
  page?: number;
  pageSize?: number;
  searchTerm?: string;
};

export const createCaixaFilters = (filters: {
  dataInicio: string;
  dataFim: string;
  contaId: string;
  tipo: string;
  categoria: string;
  formaPagamento: string;
  clienteId: string;
  parceiroId: string;
  driverId: string;
  origem: string;
}): CaixaQueryFilters => ({
  dataInicio: filters.dataInicio || undefined,
  dataFim: filters.dataFim || undefined,
  contaId: filters.contaId || undefined,
  tipo: (filters.tipo as "entrada" | "saida") || undefined,
  categoria: filters.categoria || undefined,
  formaPagamento: (filters.formaPagamento as CaixaFormaPagamento) || undefined,
  clienteId: filters.clienteId || undefined,
  parceiroId: filters.parceiroId || undefined,
  driverId: filters.driverId || undefined,
  origem: (filters.origem as CaixaLancamentoOrigem) || undefined,
});
