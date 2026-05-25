"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarRange,
  CheckCircle2,
  Download,
  Eye,
  Filter,
  FileText,
  MoreVertical,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
  Upload,
  Wallet,
  Building2,
  CalendarClock,
  ArrowRightLeft,
  Link2,
  FileUp,
  BadgeInfo,
  ChevronDown,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useData, type OrderService } from "@/context/DataContext";
import { DataTable } from "@/components/ui/DataTable";
import StandardModal from "@/components/StandardModal";
import { useServerPaginatedTable } from "@/hooks/useServerPaginatedTable";
import {
  fetchOSById,
  fetchOSFinancePage,
  fetchOSFinanceStats,
  type FinanceQueryFilters,
} from "@/lib/supabase/queries";
import {
  normalizeFinanceStatus,
  isLiberadoParaFaturamento,
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
  totalLiberadoFaturamento: number;
  totalFaturado: number;
  totalRecebido: number;
  totalPendente: number;
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
  const diff = day; // No Brasil, semana começa no domingo (day 0)
  clone.setDate(clone.getDate() - diff);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function endOfWeek(date = new Date()): Date {
  const clone = new Date(date);
  const day = clone.getDay();
  const diff = 6 - day; // No Brasil, semana termina no sábado (day 6)
  clone.setDate(clone.getDate() + diff);
  clone.setHours(23, 59, 59, 999);
  return clone;
}

function normalizeToInputDate(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeToInputMonth(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function getFinanceDisplayStatus(os: OrderService): string {
  const normalized = normalizeFinanceStatus(os.status.financeiro);
  if (normalized === "Pendente" && isLiberadoParaFaturamento(os.status.operacional)) {
    return "Liberado";
  }
  return normalized;
}

function getStatusLabel(status: string): string {
  return status;
}

function statusStyle(status: string): string {
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
  tone: "blue" | "emerald" | "amber" | "slate" | "light-blue";
}) {
  const toneMap: Record<typeof tone, string> = {
    blue: "bg-blue-50/80 border-blue-100 text-blue-600 shadow-blue-100/50",
    "light-blue": "bg-blue-50/40 border-blue-200 text-blue-400 shadow-blue-50/30",
    emerald: "bg-teal-50/80 border-teal-100 text-teal-500 shadow-teal-100/50",
    amber: "bg-amber-50/80 border-amber-100 text-amber-600 shadow-amber-100/50",
    slate: "bg-slate-50/80 border-slate-200 text-slate-600 shadow-slate-100/50",
  };

  const titleColorMap: Record<typeof tone, string> = {
    blue: "text-blue-900",
    "light-blue": "text-blue-400",
    emerald: "text-teal-500",
    amber: "text-[rgb(135,138,28)]",
    slate: "text-slate-800",
  };

  const valueColorMap: Record<typeof tone, string> = {
    blue: "text-blue-950",
    "light-blue": "text-blue-600",
    emerald: "text-teal-600",
    amber: "text-[rgb(100,102,20)]",
    slate: "text-slate-900",
  };

  const isLiberado = title === "Liberado";
  const isFaturado = title === "Faturado";
  const isRecebido = title === "Recebido";

  const iconDivClass = (() => {
    if (isLiberado) {
      return "inline-flex items-center gap-2 rounded-full border border-blue-300 bg-gradient-to-r from-blue-300 via-cyan-300 to-emerald-300 bg-[length:200%_100%] animate-gradient shadow-lg shadow-blue-400/60 hover:shadow-2xl hover:shadow-cyan-500/80 hover:scale-105 transition-all duration-300";
    }
    if (isFaturado) {
      return "inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-gradient-to-r from-yellow-100 via-yellow-200 to-yellow-300 bg-[length:200%_100%] animate-gradient shadow-md shadow-yellow-300/50 hover:shadow-xl hover:shadow-yellow-400/70 hover:scale-105 transition-all duration-300";
    }
    if (isRecebido) {
      return "inline-flex items-center gap-2 rounded-full border border-teal-200 bg-gradient-to-r from-teal-100 via-teal-200 to-teal-300 bg-[length:200%_100%] animate-gradient shadow-lg shadow-teal-300/60 hover:shadow-2xl hover:shadow-teal-400/80 hover:scale-105 transition-all duration-300";
    }
    return toneMap[tone];
  })();

  const iconColorClass = (() => {
    if (isFaturado) return "text-[rgb(135,138,28)]";
    if (isRecebido) return "text-teal-500";
    return "";
  })();

  return (
    <div className="flex items-start gap-5 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-200/50">
      <div className={`rounded-2xl border p-4 shadow-sm ${iconDivClass}`}>
        <div className={`[&>svg]:h-7 [&>svg]:w-7 ${iconColorClass}`}>{icon}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`mb-1.5 text-[11px] font-black uppercase tracking-[0.2em] truncate ${titleColorMap[tone]}`}>
          {title}
        </p>
        <h3 className={`text-2xl font-black tracking-tighter tabular-nums truncate ${valueColorMap[tone]}`}>
          {value}
        </h3>
        <p className="mt-2 text-xs font-medium text-slate-400 truncate">{subtitle}</p>
      </div>
    </div>
  );
}

export default function MedicaoFinanceiraPage() {
  const { profile } = useAuth();
  const { clientes, drivers, parceiros, loading: dataLoading, lastOSUpdate } = useData();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(normalizeToInputMonth(now));
  const [dataInicio, setDataInicio] = useState(normalizeToInputDate(startOfWeek(now)));
  const [dataFim, setDataFim] = useState(normalizeToInputDate(endOfWeek(now)));
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
    totalLiberadoFaturamento: 0,
    totalFaturado: 0,
    totalRecebido: 0,
    totalPendente: 0,
  });
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [actionTarget, setActionTarget] = useState<FinanceActionTarget | null>(null);
  const [viewingOS, setViewingOS] = useState<OrderService | null>(null);
  const [viewingOSLoading, setViewingOSLoading] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [faturarFile, setFaturarFile] = useState<File | null>(null);
  const [faturarTipoDocumento, setFaturarTipoDocumento] = useState("nota_fiscal");
  const [faturarObservacao, setFaturarObservacao] = useState("");
  const [recebimentoObservacao, setRecebimentoObservacao] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeQuickRange, setActiveQuickRange] = useState<"today" | "week" | "month" | "custom" | null>("week");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const filters = useMemo<FinanceQueryFilters>(
    () => ({
      month: undefined,
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
        const statsData = await fetchOSFinanceStats(filters);
        if (cancelled) return;
        setStats(statsData);
      } catch (error) {
        console.error("Erro ao carregar dashboard financeiro:", error);
        if (!cancelled) {
          setStats({
            totalOS: 0,
            totalBruto: 0,
            totalCusto: 0,
            totalImposto: 0,
            totalLucro: 0,
            totalLiberadoFaturamento: 0,
            totalFaturado: 0,
            totalRecebido: 0,
            totalPendente: 0,
          });
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

  useEffect(() => {
    if (!openActionMenuId) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const currentMenu = actionMenuRefs.current[openActionMenuId];
      if (currentMenu && !currentMenu.contains(event.target as Node)) {
        setOpenActionMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [openActionMenuId]);

  const resetFilters = useCallback(() => {
    const now = new Date();
    setSelectedMonth(normalizeToInputMonth(now));
    setDataInicio(normalizeToInputDate(startOfWeek(now)));
    setDataFim(normalizeToInputDate(endOfWeek(now)));
    setClienteId("");
    setCentroCustoId("");
    setParceiroId("");
    setDriverId("");
    setMotorista("");
    setStatusOperacional("");
    setStatusFinanceiro("");
    setActiveQuickRange("week");
  }, []);

  const setQuickRange = useCallback((mode: "week" | "month" | "today") => {
    const now = new Date();
    if (mode === "today") {
      const today = normalizeToInputDate(now);
      setDataInicio(today);
      setDataFim(today);
      setActiveQuickRange("today");
      return;
    }
    if (mode === "week") {
      setDataInicio(normalizeToInputDate(startOfWeek(now)));
      setDataFim(normalizeToInputDate(endOfWeek(now)));
      setSelectedMonth(normalizeToInputMonth(now));
      setActiveQuickRange("week");
      return;
    }
    // month
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    setDataInicio(normalizeToInputDate(firstDay));
    setDataFim(normalizeToInputDate(lastDay));
    setSelectedMonth(normalizeToInputMonth(now));
    setActiveQuickRange("month");
  }, []);

  const quickRangeButtonClass = (mode: "today" | "week" | "month" | null) =>
    `inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black shadow-sm transition-all active:scale-95 ${
      activeQuickRange === mode
        ? "border-blue-400 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
    }`;

  const handleViewOS = useCallback(async (os: OrderService) => {
    setOpenActionMenuId(null);
    setViewingOS(os);
    setViewingOSLoading(true);
    try {
      const latest = await fetchOSById(os.id);
      if (latest) {
        setViewingOS(latest);
      }
    } catch (error) {
      console.error("Erro ao carregar detalhes da OS:", error);
      toast.error("Não foi possível carregar os detalhes da OS.");
    } finally {
      setViewingOSLoading(false);
    }
  }, []);

  const handleOpenFaturar = (os: OrderService) => {
    setOpenActionMenuId(null);
    setActionTarget({ os });
    setFaturarFile(null);
    setFaturarTipoDocumento("nota_fiscal");
    setFaturarObservacao("");
    setRecebimentoObservacao("");
  };

  const handleOpenRecebimento = (os: OrderService) => {
    setOpenActionMenuId(null);
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
      title: "Liberado",
      value: formatCurrency(stats.totalLiberadoFaturamento),
      subtitle: "Já podem ser faturados",
      icon: <Wallet size={28} className="text-blue-700" />,
      tone: "light-blue" as const,
    },
    {
      title: "Faturado",
      value: formatCurrency(stats.totalFaturado),
      subtitle: "Já faturados, aguardando receber",
      icon: <ReceiptText size={28} className="text-[rgb(135,138,28)]" />,
      tone: "amber" as const,
    },
    {
      title: "Recebido",
      value: formatCurrency(stats.totalRecebido),
      subtitle: "Valores recebidos em conta",
      icon: <CheckCircle2 size={28} className="text-teal-500" />,
      tone: "emerald" as const,
    },
    {
      title: "Repasse Motoristas",
      value: formatCurrency(stats.totalCusto),
      subtitle: "Precisam ser repassados",
      icon: <Truck size={28} className="text-slate-600" />,
      tone: "slate" as const,
    },
  ];

  const filterDateRange = (() => {
    if (dataInicio && dataFim) {
      const start = new Date(dataInicio + 'T00:00:00');
      const end = new Date(dataFim + 'T00:00:00');
      const startFormatted = start.toLocaleDateString('pt-BR');
      const endFormatted = end.toLocaleDateString('pt-BR');
      if (dataInicio === dataFim) {
        return <span className="font-medium text-slate-800">{startFormatted}</span>;
      }
      return (
        <>
          <span className="font-medium text-slate-800">{startFormatted}</span> <span className="text-slate-300">-</span> <span className="font-medium text-slate-800">{endFormatted}</span>
        </>
      );
    }
    if (dataInicio) {
      const start = new Date(dataInicio + 'T00:00:00');
      return <>A partir de <span className="font-medium text-slate-800">{start.toLocaleDateString('pt-BR')}</span></>;
    }
    if (dataFim) {
      const end = new Date(dataFim + 'T00:00:00');
      return <>Até <span className="font-medium text-slate-800">{end.toLocaleDateString('pt-BR')}</span></>;
    }
    return "Todas as datas";
  })();

  return (
    <div className="space-y-6 pb-10">
      <section className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 transition-all">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-gradient-to-r from-blue-100 via-cyan-100 to-emerald-100 bg-[length:200%_100%] animate-gradient px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-blue-800 shadow-md shadow-blue-300/50 hover:shadow-xl hover:shadow-cyan-400/70 hover:scale-105 transition-all duration-300">
              <Wallet size={14} className="transition-transform duration-300 hover:rotate-12" />
              Gestão Financeira
            </div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              {filterDateRange}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black shadow-sm transition-all active:scale-95 ${
                showFilters
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              <Filter size={16} />
              Filtros
              <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setQuickRange("today")}
              className={quickRangeButtonClass("today")}
            >
              <CalendarClock size={16} />
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setQuickRange("week")}
              className={quickRangeButtonClass("week")}
            >
              <ArrowRightLeft size={16} />
              Semana
            </button>
            <button
              type="button"
              onClick={() => setQuickRange("month")}
              className={quickRangeButtonClass("month")}
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

      {showFilters && (
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
                onChange={(event) => {
                  setSelectedMonth(event.target.value);
                  setActiveQuickRange("custom");
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
            </Field>
            <Field label="Data Inicial">
              <input
                type="date"
                value={dataInicio}
                onChange={(event) => {
                  setDataInicio(event.target.value);
                  setActiveQuickRange("custom");
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
            </Field>
            <Field label="Data Final">
              <input
                type="date"
                value={dataFim}
                onChange={(event) => {
                  setDataFim(event.target.value);
                  setActiveQuickRange("custom");
                }}
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
                <option value="Pendente">Liberado</option>
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
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/40 overflow-hidden">
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
              title: "Protocolo",
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
                    <div className="flex flex-col items-end gap-0.5 text-xs font-semibold">
                      <span className="flex items-center gap-1 text-emerald-500">
                        <TrendingUp size={12} />
                        {formatCurrency(lucro)}
                      </span>
                      <span className="flex items-center gap-1 text-red-500">
                        <TrendingDown size={12} />
                        {formatCurrency(custo)}
                      </span>
                    </div>
                  </div>
                );
              },
            },
            {
              key: "financeiro",
              title: "Status",
              render: (_value, item) => {
                const displayStatus = getFinanceDisplayStatus(item);
                const attachment = item.financeiroAnexos?.[0];
                const isLiberado = displayStatus === "Liberado";
                
                return (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.3em] ${
                        isLiberado
                          ? "border-blue-100 bg-gradient-to-r from-blue-100 via-cyan-100 to-emerald-100 bg-[length:200%_100%] animate-gradient shadow-lg shadow-blue-400/60 hover:shadow-2xl hover:shadow-cyan-500/80 hover:scale-105 transition-all duration-300 text-blue-500"
                          : statusStyle(displayStatus)
                      }`}>
                        {isLiberado ? <Wallet size={12} className="text-blue-500" /> : <BadgeInfo size={12} />}
                        {getStatusLabel(displayStatus)}
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
                const displayStatus = getFinanceDisplayStatus(item);
                const canFaturar = displayStatus === "Liberado";
                const canBaixar = normalized === "Faturado";

                return (
                  <div
                    className="relative ml-auto inline-block"
                    ref={(el) => {
                      if (el) {
                        actionMenuRefs.current[item.id] = el;
                      } else {
                        delete actionMenuRefs.current[item.id];
                      }
                    }}
                  >
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenActionMenuId((prev) => (prev === item.id ? null : item.id));
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600"
                      aria-haspopup="true"
                      aria-expanded={openActionMenuId === item.id}
                    >
                      <MoreVertical size={18} />
                    </button>
                    {openActionMenuId === item.id && (
                      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-[200px] space-y-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                        <button
                          type="button"
                          onClick={() => handleViewOS(item)}
                          className="group flex w-full items-center gap-3 rounded-xl px-4 py-2 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
                        >
                          <Eye size={16} className="text-slate-400 group-hover:text-cyan-600" />
                          Visualizar
                        </button>
                        {canFaturar && (
                          <button
                            type="button"
                            onClick={() => handleOpenFaturar(item)}
                            className="group flex w-full items-center gap-3 rounded-xl px-4 py-2 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                          >
                            <FileUp size={16} className="text-slate-400 group-hover:text-blue-600" />
                            Faturar
                          </button>
                        )}
                        {canBaixar && (
                          <button
                            type="button"
                            onClick={() => handleOpenRecebimento(item)}
                            className="group flex w-full items-center gap-3 rounded-xl px-4 py-2 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                          >
                            <Wallet size={16} className="text-slate-400 group-hover:text-emerald-600" />
                            Dar baixa
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
      </div>

      {viewingOS ? (
        <StandardModal
          title={`Visualizar OS ${viewingOS.os || "Sem número"}`}
          subtitle={`Protocolo ${viewingOS.protocolo || viewingOS.id.slice(0, 8)}`}
          icon={<Eye size={22} />}
          onClose={() => {
            setViewingOS(null);
            setViewingOSLoading(false);
          }}
          maxWidthClassName="max-w-3xl"
          bodyClassName="p-6 md:p-8 space-y-6"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Cliente</p>
              <p className="mt-2 text-base font-black text-slate-800">
                {customerMap.get(viewingOS.clienteId) || "Sem cliente"}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Centro de custo</p>
              <p className="mt-2 text-base font-black text-slate-800">
                {centerMap.get(viewingOS.centroCustoId || "") || viewingOS.centroCustoId || "Geral"}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Motorista</p>
              <p className="mt-2 text-base font-black text-slate-800">
                {viewingOS.driverId ? driverMap.get(viewingOS.driverId) || viewingOS.motorista || "Sem motorista" : viewingOS.motorista || "Sem motorista"}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Parceiro</p>
              <p className="mt-2 text-base font-black text-slate-800">
                {viewingOS.driverId
                  ? partnerMap.get(drivers.find((driver) => driver.id === viewingOS.driverId)?.parceiro_id || "") || "Sem parceiro"
                  : "Sem parceiro"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-500">Status financeiro</p>
              <p className="mt-2 text-lg font-black text-blue-700">
                {getFinanceDisplayStatus(viewingOS)}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Data da OS</p>
              <p className="mt-2 text-lg font-black text-slate-800">{formatDate(viewingOS.data)}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Status operacional</p>
              <p className="mt-2 text-lg font-black text-slate-800">{viewingOS.status.operacional || "-"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Valor bruto</p>
              <p className="mt-2 text-xl font-black text-slate-800">{formatCurrency(Number(viewingOS.valorBruto || 0))}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Custo</p>
              <p className="mt-2 text-xl font-black text-red-500">{formatCurrency(Number(viewingOS.custo || 0))}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Lucro</p>
              <p className="mt-2 text-xl font-black text-emerald-600">{formatCurrency(Number(viewingOS.lucro || 0))}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Datas financeiras</p>
            <div className="mt-3 space-y-2 text-sm font-bold text-slate-700">
              <p>Faturado em: {formatDate(viewingOS.financeiroFaturadoEm)}</p>
              <p>Recebido em: {formatDate(viewingOS.financeiroRecebidoEm)}</p>
              <p>Anexos: {viewingOS.financeiroAnexos?.length || 0}</p>
            </div>
          </div>

          {viewingOSLoading ? (
            <div className="flex items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
              <RotateCcw size={16} className="animate-spin" />
              Carregando detalhes mais recentes...
            </div>
          ) : null}
        </StandardModal>
      ) : null}

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
