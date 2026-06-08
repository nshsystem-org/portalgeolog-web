import type { Cliente, Driver, OrderService } from "@/context/DataContext";
import type {
  FinanceQueryFilters,
  ParceiroServico,
} from "@/lib/supabase/queries";
import {
  isLiberadoParaFaturamento,
  normalizeFinanceStatus,
} from "@/lib/financeiro";

export type FinanceActionTarget = {
  os: OrderService;
  attachmentId?: string;
};

export type FinanceOverview = {
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

export type FinanceLookupMaps = {
  customerMap: Map<string, string>;
  centerMap: Map<string, string>;
  driverMap: Map<string, string>;
  driverPartnerMap: Map<string, string>;
  partnerMap: Map<string, string>;
};

export const EMPTY_FINANCE_OVERVIEW: FinanceOverview = {
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

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR");

type ClienteLike = Pick<Cliente, "id" | "nome" | "centrosCusto">;
type DriverLike = Pick<Driver, "id" | "name" | "parceiro_id">;
type ParceiroLike = Pick<ParceiroServico, "id" | "razaoSocialOuNomeCompleto">;

export const formatCurrency = (value: number): string =>
  currencyFormatter.format(value);

export const formatDate = (value?: string | null): string => {
  if (!value) return "-";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return dateFormatter.format(date);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return dateFormatter.format(parsed);
};

export const startOfWeek = (date = new Date()): Date => {
  const clone = new Date(date);
  const day = clone.getDay();
  const diff = day === 0 ? 6 : day - 1;
  clone.setDate(clone.getDate() - diff);
  clone.setHours(0, 0, 0, 0);
  return clone;
};

export const endOfWeek = (date = new Date()): Date => {
  const clone = new Date(date);
  const day = clone.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  clone.setDate(clone.getDate() + diff);
  clone.setHours(23, 59, 59, 999);
  return clone;
};

export const normalizeToInputDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getFinanceDisplayStatus = (os: OrderService): string => {
  const normalized = normalizeFinanceStatus(os.status.financeiro);
  if (
    normalized === "Pendente" &&
    isLiberadoParaFaturamento(os.status.operacional)
  ) {
    return "Liberado";
  }
  return normalized;
};

export const statusStyle = (status: string): string => {
  switch (status) {
    case "Liberado":
      return "border-blue-200 bg-blue-50 text-blue-600";
    case "Faturado":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Recebido":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
};

export const createFinanceLookupMaps = (
  clientes: ClienteLike[],
  drivers: DriverLike[],
  parceiros: ParceiroLike[],
): FinanceLookupMaps => {
  const customerMap = new Map<string, string>();
  const centerMap = new Map<string, string>();
  const driverMap = new Map<string, string>();
  const driverPartnerMap = new Map<string, string>();
  const partnerMap = new Map<string, string>();

  clientes.forEach((cliente) => {
    customerMap.set(cliente.id, cliente.nome);
    cliente.centrosCusto.forEach((centro) => {
      centerMap.set(centro.id, centro.nome);
    });
  });

  drivers.forEach((driver) => {
    driverMap.set(driver.id, driver.name);
    if (driver.parceiro_id) {
      driverPartnerMap.set(driver.id, driver.parceiro_id);
    }
  });

  parceiros.forEach((parceiro) => {
    partnerMap.set(parceiro.id, parceiro.razaoSocialOuNomeCompleto);
  });

  return {
    customerMap,
    centerMap,
    driverMap,
    driverPartnerMap,
    partnerMap,
  };
};

export const createFinanceFilters = (filters: {
  dataInicio: string;
  dataFim: string;
  clienteId: string;
  centroCustoId: string;
  driverId: string;
  parceiroId: string;
  statusOperacional: string;
  statusFinanceiro: string;
}): FinanceQueryFilters => ({
  month: undefined,
  dataInicio: filters.dataInicio || undefined,
  dataFim: filters.dataFim || undefined,
  clienteId: filters.clienteId || undefined,
  centroCustoId: filters.centroCustoId || undefined,
  driverId: filters.driverId || undefined,
  parceiroId: filters.parceiroId || undefined,
  statusOperacional: filters.statusOperacional || undefined,
  statusFinanceiro: filters.statusFinanceiro || undefined,
});
