"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarRange,
  CheckCircle2,
  Download,
  Filter,
  FileText,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
  Upload,
  Wallet,
  CircleDollarSign,
  Building2,
  CalendarClock,
  ArrowRightLeft,
  Clock3,
  Link2,
  FileUp,
  BadgeInfo,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useData, type OrderService } from "@/context/DataContext";
import { DataTable } from "@/components/ui/DataTable";
import StandardModal from "@/components/StandardModal";
import { useServerPaginatedTable } from "@/hooks/useServerPaginatedTable";
import {
  fetchOSFinanceOverview,
  fetchOSFinancePage,
  fetchOSFinanceStats,
  type FinanceQueryFilters,
} from "@/lib/supabase/queries";
import {
  normalizeFinanceStatus,
} from "@/lib/financeiro";

type FinanceActionTarget = {
  os: OrderService;
  attachmentId?: string;
};

type FinanceOverview = {
  totalOS: number;
  totalBruto: number;
  totalCusto: number;
  totalImposto: number;
  totalLucro: number;
  totalFaturado: number;
  totalRecebido: number;
  totalPendente: number;
};

type GroupSummary = {
  id: string;
  label: string;
  total: number;
  count: number;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR");

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return dateFormatter.format(parsed);
}

function startOfWeek(date = new Date()): Date {
  const clone = new Date(date);
  const day = clone.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  clone.setDate(clone.getDate() + diff);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function endOfWeek(date = new Date()): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function normalizeToInputDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getStatusLabel(status: string): string {
  return normalizeFinanceStatus(status);
}

function statusStyle(status: string): string {
  const normalized = normalizeFinanceStatus(status);
  switch (normalized) {
    case "Faturado":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Recebido":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function sumGroup<T>(
  items: T[],
  getKey: (item: T) => string,
  getLabel: (item: T) => string,
  getValue: (item: T) => number,
): GroupSummary[] {
  const map = new Map<string, GroupSummary>();
  items.forEach((item) => {
    const key = getKey(item) || "sem-id";
    const current = map.get(key) ?? {
      id: key,
      label: getLabel(item),
      total: 0,
      count: 0,
    };
    current.total += getValue(item);
    current.count += 1;
    map.set(key, current);
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function FinanceCard({
  title,
  value,
  subtitle,
  icon,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  tone: "blue" | "emerald" | "amber" | "slate";
}) {
  const toneMap: Record<typeof tone, string> = {
    blue: "bg-blue-50/80 border-blue-100 text-blue-600 shadow-blue-100/50",
    emerald: "bg-emerald-50/80 border-emerald-100 text-emerald-600 shadow-emerald-100/50",
    amber: "bg-amber-50/80 border-amber-100 text-amber-600 shadow-amber-100/50",
    slate: "bg-slate-50/80 border-slate-200 text-slate-600 shadow-slate-100/50",
  };

  return (
    <div className="flex items-start gap-5 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-200/50">
      <div className={`rounded-2xl border p-4 shadow-sm ${toneMap[tone]}`}>
        <div className="[&>svg]:h-7 [&>svg]:w-7">{icon}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 truncate">
          {title}
        </p>
        <h3 className="text-3xl font-black tracking-tighter text-slate-800 tabular-nums truncate">
          {value}
        </h3>
        <p className="mt-2 text-sm font-bold text-slate-500 truncate">{subtitle}</p>
      </div>
    </div>
  );
}

export default function MedicaoFinanceiraPage() {
  const { profile } = useAuth();
  const { clientes, drivers, parceiros, loading: dataLoading, lastOSUpdate } = useData();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [parceiroId, setParceiroId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [motorista, setMotorista] = useState("");
  const [statusOperacional, setStatusOperacional] = useState("");
  const [statusFinanceiro, setStatusFinanceiro] = useState("");
  const [stats, setStats] = useState<FinanceOverview>({
    totalOS: 0,
    totalBruto: 0,
    totalCusto: 0,
    totalImposto: 0,
    totalLucro: 0,
    totalFaturado: 0,
    totalRecebido: 0,
    totalPendente: 0,
  });
  const [overviewRows, setOverviewRows] = useState<OrderService[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [actionTarget, setActionTarget] = useState<FinanceActionTarget | null>(null);
  const [faturarFile, setFaturarFile] = useState<File | null>(null);
  const [faturarTipoDocumento, setFaturarTipoDocumento] = useState("nota_fiscal");
  const [faturarObservacao, setFaturarObservacao] = useState("");
  const [recebimentoObservacao, setRecebimentoObservacao] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filters = useMemo<FinanceQueryFilters>(
    () => ({
      month: selectedMonth,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      clienteId: clienteId || undefined,
      centroCustoId: centroCustoId || undefined,
      motorista: motorista || undefined,
      driverId: driverId || undefined,
      parceiroId: parceiroId || undefined,
      statusOperacional: statusOperacional || undefined,
      statusFinanceiro: statusFinanceiro || undefined,
    }),
    [
      selectedMonth,
      dataInicio,
      dataFim,
      clienteId,
      centroCustoId,
      motorista,
      driverId,
      parceiroId,
      statusOperacional,
      statusFinanceiro,
    ],
  );

  const financeTable = useServerPaginatedTable(
    useCallback(async (params) => fetchOSFinancePage({ ...params, ...filters }), [filters]),
    10,
    true,
    "Financeiro",
  );

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    clientes.forEach((cliente) => {
      map.set(cliente.id, cliente.nome);
    });
    return map;
  }, [clientes]);

  const centerMap = useMemo(() => {
    const map = new Map<string, string>();
    clientes.forEach((cliente) => {
      cliente.centrosCusto.forEach((centro) => {
        map.set(centro.id, centro.nome);
      });
    });
    return map;
  }, [clientes]);

  const driverMap = useMemo(() => {
    const map = new Map<string, string>();
    drivers.forEach((driver) => {
      map.set(driver.id, driver.name);
    });
    return map;
  }, [drivers]);

  const partnerMap = useMemo(() => {
    const map = new Map<string, string>();
    parceiros.forEach((parceiro) => {
      map.set(parceiro.id, parceiro.razaoSocialOuNomeCompleto);
    });
    return map;
  }, [parceiros]);

  const hasFinanceiroAccess = useMemo((): boolean => {
    if (!profile) return false;
    if (profile.categoria === "administrador") return true;
    const specificPermissions = (profile.specific_permissions as Record<string, unknown>) || {};
    const financeiroPerms = (specificPermissions.financeiro as Record<string, unknown>) || {};
    if (Object.keys(financeiroPerms).length > 0) {
      return financeiroPerms.page_access === true;
    }
    return profile.categoria === "financeiro";
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    const loadStats = async () => {
      setOverviewLoading(true);
      try {
        const [statsData, overviewData] = await Promise.all([
          fetchOSFinanceStats(filters),
          fetchOSFinanceOverview(filters),
        ]);
        if (cancelled) return;
        setStats(statsData);
        setOverviewRows(overviewData);
      } catch (error) {
        console.error("Erro ao carregar dashboard financeiro:", error);
        if (!cancelled) {
          setStats({
            totalOS: 0,
            totalBruto: 0,
            totalCusto: 0,
            totalImposto: 0,
            totalLucro: 0,
            totalFaturado: 0,
            totalRecebido: 0,
            totalPendente: 0,
          });
          setOverviewRows([]);
        }
      } finally {
        if (!cancelled) setOverviewLoading(false);
      }
    };

    void loadStats();
    return () => {
      cancelled = true;
    };
  }, [filters, lastOSUpdate]);

  const weeklyProvision = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    const weekEnd = endOfWeek(new Date());
    return overviewRows
      .filter((row) => {
        if (!row.data) return false;
        const date = new Date(`${row.data}T00:00:00`);
        const normalized = normalizeFinanceStatus(row.status.financeiro);
        return date >= weekStart && date <= weekEnd && normalized !== "Recebido";
      })
      .reduce((sum, row) => sum + Number(row.valorBruto || 0), 0);
  }, [overviewRows]);

  const topCustomers = useMemo(
    () =>
      sumGroup(
        overviewRows,
        (row) => row.clienteId || "",
        (row) => customerMap.get(row.clienteId || "") || "Sem cliente",
        (row) => Number(row.valorBruto || 0),
      ).slice(0, 5),
    [overviewRows, customerMap],
  );

  const topDrivers = useMemo(
    () =>
      sumGroup(
        overviewRows,
        (row) => row.driverId || row.motorista || "",
        (row) => {
          const driverName = row.driverId ? driverMap.get(row.driverId) : undefined;
          const partnerName = row.driverId
            ? parceiros.find((partner) => partner.id === drivers.find((driver) => driver.id === row.driverId)?.parceiro_id)?.razaoSocialOuNomeCompleto
            : undefined;
          return driverName || row.motorista || partnerName || "Sem motorista";
        },
        (row) => Number(row.custo || 0),
      ).slice(0, 5),
    [overviewRows, driverMap, drivers, parceiros],
  );

  const topCenters = useMemo(
    () =>
      sumGroup(
        overviewRows,
        (row) => row.centroCustoId || "",
        (row) => centerMap.get(row.centroCustoId || "") || "Sem centro",
        (row) => Number(row.valorBruto || 0),
      ).slice(0, 5),
    [overviewRows, centerMap],
  );

  const resetFilters = useCallback(() => {
    setSelectedMonth(new Date().toISOString().slice(0, 7));
    setDataInicio("");
    setDataFim("");
    setClienteId("");
    setCentroCustoId("");
    setParceiroId("");
    setDriverId("");
    setMotorista("");
    setStatusOperacional("");
    setStatusFinanceiro("");
  }, []);

  const setQuickRange = useCallback((mode: "week" | "month" | "today") => {
    const now = new Date();
    if (mode === "today") {
      const today = normalizeToInputDate(now);
      setDataInicio(today);
      setDataFim(today);
      return;
    }
    if (mode === "week") {
      setDataInicio(normalizeToInputDate(startOfWeek(now)));
      setDataFim(normalizeToInputDate(endOfWeek(now)));
      setSelectedMonth(now.toISOString().slice(0, 7));
      return;
    }
    setSelectedMonth(now.toISOString().slice(0, 7));
    setDataInicio("");
    setDataFim("");
  }, []);

  const handleOpenFaturar = (os: OrderService) => {
    setActionTarget({ os });
    setFaturarFile(null);
    setFaturarTipoDocumento("nota_fiscal");
    setFaturarObservacao("");
    setRecebimentoObservacao("");
  };

  const handleOpenRecebimento = (os: OrderService) => {
    setActionTarget({ os });
    setRecebimentoObservacao("");
    setFaturarFile(null);
  };

  const closeActionModal = () => {
    setActionTarget(null);
    setFaturarFile(null);
    setRecebimentoObservacao("");
    setFaturarObservacao("");
  };

  const uploadFaturamento = async () => {
    if (!actionTarget) return;
    if (!faturarFile) {
      toast.error("Selecione um arquivo PDF ou imagem.");
      return;
    }

    const formData = new FormData();
    formData.append("osId", actionTarget.os.id);
    formData.append("file", faturarFile);
    formData.append("tipoDocumento", faturarTipoDocumento);
    formData.append("observacao", faturarObservacao);

    setUploading(true);
    try {
      const response = await fetch("/api/financeiro/faturar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao faturar a OS.");
      }

      toast.success("OS faturada com comprovante anexado.");
      closeActionModal();
      await Promise.all([financeTable.refresh()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao faturar.");
    } finally {
      setUploading(false);
    }
  };

  const confirmRecebimento = async () => {
    if (!actionTarget) return;
    setUploading(true);
    try {
      const response = await fetch("/api/financeiro/baixar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          osId: actionTarget.os.id,
          observacao: recebimentoObservacao,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao registrar recebimento.");
      }
      toast.success("Valor marcado como recebido.");
      closeActionModal();
      await financeTable.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao dar baixa.");
    } finally {
      setUploading(false);
    }
  };

  const handleExportPdf = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, String(value));
      });
      const response = await fetch(`/api/financeiro/relatorio?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Falha ao gerar PDF.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `medicao-financeira-${selectedMonth || "periodo"}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao exportar PDF.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleOpenAttachment = async (target: FinanceActionTarget) => {
    const attachmentId = target.os.financeiroAnexos?.[0]?.id;
    if (!attachmentId) {
      toast.error("Nenhum comprovante disponível.");
      return;
    }

    try {
      const response = await fetch(`/api/financeiro/anexos/${attachmentId}`, {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; signedUrl?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao abrir comprovante.");
      }
      if (payload?.signedUrl) {
        window.open(payload.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao abrir comprovante.");
    }
  };

  if (!hasFinanceiroAccess) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-500">
          <ShieldCheck size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800">Acesso restrito</h2>
        <p className="max-w-md text-slate-500">
          Esta página é exclusiva para usuários com acesso ao módulo financeiro.
        </p>
      </div>
    );
  }

  const statsCards = [
    {
      title: "Total Faturamento",
      value: formatCurrency(stats.totalBruto),
      subtitle: `Provisionamento mensal: ${formatCurrency(stats.totalPendente + stats.totalFaturado)}`,
      icon: <CircleDollarSign size={28} className="text-blue-600" />,
      tone: "blue" as const,
    },
    {
      title: "Recebido",
      value: formatCurrency(stats.totalRecebido),
      subtitle: "Valores em conta",
      icon: <CheckCircle2 size={28} className="text-emerald-600" />,
      tone: "emerald" as const,
    },
    {
      title: "A Receber (Faturado)",
      value: formatCurrency(stats.totalFaturado),
      subtitle: `A faturar (Pendente): ${formatCurrency(stats.totalPendente)}`,
      icon: <Clock3 size={28} className="text-amber-600" />,
      tone: "amber" as const,
    },
    {
      title: "Repasse Motoristas",
      value: formatCurrency(stats.totalCusto),
      subtitle: `Provisão semana: ${formatCurrency(weeklyProvision)}`,
      icon: <Truck size={28} className="text-slate-600" />,
      tone: "slate" as const,
    },
  ];

  return (
    <div className="space-y-6 pb-10">
      <section className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 transition-all">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-blue-700">
              <Wallet size={14} />
              Gestão Financeira Geolog
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setQuickRange("today")}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-95"
            >
              <CalendarClock size={16} />
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setQuickRange("week")}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-95"
            >
              <ArrowRightLeft size={16} />
              Semana
            </button>
            <button
              type="button"
              onClick={() => setQuickRange("month")}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-95"
            >
              <ReceiptText size={16} />
              Mês
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={reportLoading}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70 active:scale-95"
            >
              {reportLoading ? <RotateCcw size={16} className="animate-spin" /> : <Download size={16} />}
              Exportar Medição
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((card, idx) => (
          <FinanceCard key={idx} {...card} />
        ))}
      </section>

      <section className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Filtros Avançados</h2>
            <p className="text-sm font-medium text-slate-500">
              Refine os dados por período, cliente, centro de custo ou status.
            </p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-black text-slate-700 transition-all hover:bg-slate-100 active:scale-95"
          >
            <Filter size={16} />
            Limpar Filtros
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Field label="Mês de Referência">
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </Field>
          <Field label="Data Inicial">
            <input
              type="date"
              value={dataInicio}
              onChange={(event) => setDataInicio(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </Field>
          <Field label="Data Final">
            <input
              type="date"
              value={dataFim}
              onChange={(event) => setDataFim(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </Field>
          <Field label="Empresa / Cliente">
            <select
              value={clienteId}
              onChange={(event) => setClienteId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Todos os Clientes</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Centro de Custo">
            <select
              value={centroCustoId}
              onChange={(event) => setCentroCustoId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Todos os Centros</option>
              {clientes.flatMap((cliente) => cliente.centrosCusto).map((centro) => (
                <option key={centro.id} value={centro.id}>
                  {centro.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Parceiro Estratégico">
            <select
              value={parceiroId}
              onChange={(event) => setParceiroId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Todos os Parceiros</option>
              {parceiros.map((parceiro) => (
                <option key={parceiro.id} value={parceiro.id}>
                  {parceiro.razaoSocialOuNomeCompleto}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Motorista Específico">
            <select
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Todos os Motoristas</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status Operacional">
            <select
              value={statusOperacional}
              onChange={(event) => setStatusOperacional(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Todos os Estados</option>
              <option value="Finalizado">Concluídas</option>
              <option value="Pendente">Pendentes</option>
              <option value="Em Rota">Em Rota</option>
              <option value="Cancelado">Canceladas</option>
            </select>
          </Field>
          <Field label="Situação Financeira">
            <select
              value={statusFinanceiro}
              onChange={(event) => setStatusFinanceiro(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Todas as Situações</option>
              <option value="Pendente">A Faturar</option>
              <option value="Faturado">Faturado (A Receber)</option>
              <option value="Recebido">Recebido</option>
              <option value="Pago">Pago (Legado)</option>
            </select>
          </Field>
          <Field label="Busca Direta">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={motorista}
                onChange={(event) => setMotorista(event.target.value)}
                placeholder="Nome do motorista..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </Field>
        </div>
      </section>

      <div className="rounded-[2.5rem] border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/40 overflow-hidden">
        <DataTable<OrderService>
          data={financeTable.items}
          loading={financeTable.loading}
          disableClientSearch
          searchTerm={financeTable.searchTerm}
          onSearchChange={financeTable.setSearchTerm}
          searchPlaceholder="Buscar por OS, protocolo, cliente ou motorista..."
          pagination={{
            page: financeTable.page,
            pageSize: financeTable.pageSize,
            totalItems: financeTable.totalCount,
            onPageChange: financeTable.setPage,
          }}
          emptyMessage="Nenhuma transação financeira encontrada para este filtro."
          emptyIcon={<ReceiptText size={48} className="text-slate-200" />}
          columns={[
            {
              key: "documento",
              title: "OS / Data",
              render: (_value, item) => (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-base font-black text-slate-800">
                      #{item.os || item.protocolo || item.id.slice(0, 6)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <CalendarRange size={12} />
                    {formatDate(item.data)}
                  </div>
                </div>
              ),
            },
            {
              key: "cliente",
              title: "Cliente / Centro de custo",
              render: (_value, item) => (
                <div className="max-w-[200px] space-y-1">
                  <p className="truncate text-base font-bold text-slate-800">
                    {customerMap.get(item.clienteId) || "Sem cliente"}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <Building2 size={12} className="shrink-0" />
                    <span className="truncate">
                      {centerMap.get(item.centroCustoId || "") || item.centroCustoId || "Geral"}
                    </span>
                  </div>
                </div>
              ),
            },
            {
              key: "motorista",
              title: "Motorista / Repasse",
              render: (_value, item) => {
                const driverName = item.driverId ? driverMap.get(item.driverId) : undefined;
                const partnerName = item.driverId
                  ? partnerMap.get(drivers.find((driver) => driver.id === item.driverId)?.parceiro_id || "")
                  : undefined;
                return (
                  <div className="max-w-[200px] space-y-1">
                    <p className="truncate text-base font-bold text-slate-800">
                      {driverName || item.motorista || "Sem motorista"}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                      <Truck size={12} className="shrink-0" />
                      <span className="truncate">{partnerName || "Autônomo / Interno"}</span>
                    </div>
                  </div>
                );
              },
            },
            {
              key: "valores",
              title: "Valores",
              align: "right",
              render: (_value, item) => {
                const bruto = Number(item.valorBruto || 0);
                const custo = Number(item.custo || 0);
                const lucro = Number(item.lucro || 0);
                return (
                  <div className="space-y-1 text-right">
                    <p className="text-base font-black text-slate-800">{formatCurrency(bruto)}</p>
                    <div className="flex items-center justify-end gap-2 text-[10px] font-bold uppercase text-slate-400">
                      <span className="text-orange-500/80">Custo {formatCurrency(custo)}</span>
                      <span className="text-emerald-500/80">Líq {formatCurrency(lucro)}</span>
                    </div>
                  </div>
                );
              },
            },
            {
              key: "financeiro",
              title: "Status & Datas",
              render: (_value, item) => {
                const normalized = normalizeFinanceStatus(item.status.financeiro);
                const attachment = item.financeiroAnexos?.[0];
                
                return (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${statusStyle(normalized)}`}>
                        <BadgeInfo size={12} />
                        {getStatusLabel(normalized)}
                      </span>
                      {attachment && (
                        <button
                          onClick={() => handleOpenAttachment({ os: item })}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                          title="Ver comprovante"
                        >
                          <Link2 size={12} />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {item.financeiroFaturadoEm && (
                        <span>Faturado: {formatDate(item.financeiroFaturadoEm)}</span>
                      )}
                      {item.financeiroRecebidoEm && (
                        <span className="text-emerald-500">Recebido: {formatDate(item.financeiroRecebidoEm)}</span>
                      )}
                    </div>
                  </div>
                );
              },
            },
            {
              key: "acoes",
              title: "Ações",
              align: "right",
              render: (_value, item) => {
                const normalized = normalizeFinanceStatus(item.status.financeiro);
                const canFaturar = item.status.operacional === "Finalizado" && normalized === "Pendente";
                const canBaixar = normalized === "Faturado";

                return (
                  <div className="flex justify-end gap-2">
                    {canFaturar && (
                      <button
                        onClick={() => handleOpenFaturar(item)}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-md shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95"
                      >
                        <FileUp size={14} />
                        Faturar
                      </button>
                    )}
                    {canBaixar && (
                      <button
                        onClick={() => handleOpenRecebimento(item)}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-md shadow-emerald-200 transition-all hover:bg-emerald-700 active:scale-95"
                      >
                        <CircleDollarSign size={14} />
                        Baixar
                      </button>
                    )}
                    {!canFaturar && !canBaixar && (
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-300">
                        <ShieldCheck size={18} />
                      </div>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
      </div>

      {actionTarget ? (
        <StandardModal
          title={normalizeFinanceStatus(actionTarget.os.status.financeiro) === "Pendente" ? "Faturar Ordem de Serviço" : "Confirmar Recebimento"}
          subtitle={`OS #${actionTarget.os.os || actionTarget.os.protocolo || actionTarget.os.id.slice(0, 8)}`}
          icon={
            normalizeFinanceStatus(actionTarget.os.status.financeiro) === "Pendente" ? (
              <FileUp size={22} />
            ) : (
              <CheckCircle2 size={22} />
            )
          }
          onClose={closeActionModal}
          maxWidthClassName="max-w-2xl"
          bodyClassName="p-6 md:p-8 space-y-6"
          footer={
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 md:px-8">
              <button
                type="button"
                onClick={closeActionModal}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition-all hover:bg-slate-50"
              >
                Cancelar
              </button>
              {normalizeFinanceStatus(actionTarget.os.status.financeiro) === "Pendente" ? (
                <button
                  type="button"
                  onClick={uploadFaturamento}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-600 px-6 py-3 text-sm font-black text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 shadow-lg shadow-blue-100"
                >
                  {uploading ? <RotateCcw size={16} className="animate-spin" /> : <Upload size={16} />}
                  Confirmar Faturamento
                </button>
              ) : (
                <button
                  type="button"
                  onClick={confirmRecebimento}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-600 px-6 py-3 text-sm font-black text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 shadow-lg shadow-emerald-100"
                >
                  {uploading ? <RotateCcw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Confirmar Recebimento
                </button>
              )}
            </div>
          }
        >
          {normalizeFinanceStatus(actionTarget.os.status.financeiro) === "Pendente" ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-blue-100 bg-blue-50/50 p-5 text-sm text-blue-800">
                <p className="font-black uppercase tracking-[0.25em] text-[10px] mb-2">Atenção: Comprovante Obrigatório</p>
                <p className="font-medium leading-relaxed">
                  Para faturar esta OS, anexe o comprovante (Nota Fiscal, Recibo ou PDF). Isso atualizará o status financeiro para permitir a baixa futura.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Tipo do Documento">
                  <select
                    value={faturarTipoDocumento}
                    onChange={(event) => setFaturarTipoDocumento(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="nota_fiscal">Nota Fiscal Eletrônica</option>
                    <option value="fatura">Fatura / Invoice</option>
                    <option value="comprovante">Comprovante de Serviço</option>
                    <option value="outro">Outro Documento</option>
                  </select>
                </Field>
                <Field label="Arquivo (PDF ou Imagem)">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={(event) => setFaturarFile(event.target.files?.[0] || null)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition-all file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-xs file:font-black file:text-white hover:file:bg-blue-700"
                  />
                </Field>
              </div>
              <Field label="Observações do Faturamento">
                <textarea
                  value={faturarObservacao}
                  onChange={(event) => setFaturarObservacao(event.target.value)}
                  rows={3}
                  placeholder="Informações adicionais para o registro financeiro..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </Field>
              {faturarFile && (
                <div className="rounded-3xl border border-dashed border-blue-200 bg-blue-50/30 p-4 flex items-center gap-3">
                  <div className="rounded-xl bg-blue-100 p-2 text-blue-600">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-800 truncate">{faturarFile.name}</p>
                    <p className="text-[10px] font-bold uppercase text-slate-400">{(faturarFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-5 text-sm text-emerald-800">
                <p className="font-black uppercase tracking-[0.25em] text-[10px] mb-2">Confirmação de Recebimento</p>
                <p className="font-medium leading-relaxed">
                  Ao dar baixa, você confirma que o valor de <strong>{formatCurrency(Number(actionTarget.os.valorBruto || 0))}</strong> entrou efetivamente na conta da empresa.
                </p>
              </div>
              <Field label="Observações da Baixa / Recebimento">
                <textarea
                  value={recebimentoObservacao}
                  onChange={(event) => setRecebimentoObservacao(event.target.value)}
                  rows={4}
                  placeholder="Ex.: Valor conciliado via extrato bancário, banco Itaú..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </Field>
            </div>
          )}
        </StandardModal>
      ) : null}

      {overviewLoading || dataLoading ? (
        <div className="fixed bottom-8 right-8 z-50 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-6 py-4 font-black text-slate-800 shadow-2xl backdrop-blur-md">
          <RotateCcw size={20} className="animate-spin text-blue-600" />
          Atualizando Dashboard...
        </div>
      ) : null}
    </div>
  );
}
