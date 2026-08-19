"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gauge,
  Loader2,
  Users,
  UserSquare2,
  Handshake,
  Building,
  Truck,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  DollarSign,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { hasPageAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/ui/AccessDenied";
import {
  fetchDesempenhoOverview,
  fetchMotoristasDesempenho,
  fetchFuncionariosDesempenho,
  fetchParceirosDesempenho,
  fetchClientesDesempenho,
  fetchVeiculosDesempenho,
  type DesempenhoOverview,
  type MotoristaMetricas,
  type FuncionarioMetricas,
  type ParceiroMetricas,
  type ClienteMetricas,
  type VeiculoMetricas,
  type DesempenhoFilters,
} from "@/lib/supabase/queries";

type TabKey =
  | "overview"
  | "motoristas"
  | "funcionarios"
  | "parceiros"
  | "clientes"
  | "veiculos";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Visão Geral", icon: <Gauge size={16} /> },
  { key: "motoristas", label: "Motoristas", icon: <Users size={16} /> },
  {
    key: "funcionarios",
    label: "Funcionários",
    icon: <UserSquare2 size={16} />,
  },
  { key: "parceiros", label: "Parceiros", icon: <Handshake size={16} /> },
  { key: "clientes", label: "Clientes", icon: <Building size={16} /> },
  { key: "veiculos", label: "Veículos", icon: <Truck size={16} /> },
];

const currencyFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const numberFmt = new Intl.NumberFormat("pt-BR");

function formatCurrency(v: number): string {
  return currencyFmt.format(v);
}
function formatNumber(v: number): string {
  return numberFmt.format(v);
}
function formatPercent(v: number): string {
  return `${v.toFixed(1)}%`;
}

// ── Animated Counter ──────────────────────────────────────
function AnimatedCounter({
  value,
  format,
  duration = 0.8,
}: {
  value: number;
  format: (v: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const startVal = 0;
    const delta = value - startVal;

    function tick(now: number) {
      const elapsed = (now - start) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(startVal + delta * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{format(display)}</>;
}

// ── KPI Card ──────────────────────────────────────────────
function KpiCard({
  icon,
  label,
  value,
  format,
  color,
  delay = 0,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  format: (v: number) => string;
  color: "blue" | "green" | "amber" | "rose" | "violet" | "slate";
  delay?: number;
  subtitle?: string;
}) {
  const colorMap = {
    blue: "from-blue-500 to-blue-600 text-white",
    green: "from-emerald-500 to-emerald-600 text-white",
    amber: "from-amber-500 to-amber-600 text-white",
    rose: "from-rose-500 to-rose-600 text-white",
    violet: "from-violet-500 to-violet-600 text-white",
    slate: "from-slate-600 to-slate-700 text-white",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 120, damping: 15 }}
      className={`rounded-3xl bg-gradient-to-br ${colorMap[color]} p-5 shadow-xl shadow-slate-200/50`}
    >
      <div className="flex items-start justify-between">
        <div className="rounded-2xl bg-white/20 p-2.5 backdrop-blur-sm">
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-white/70">
          {label}
        </p>
        <p className="mt-1 text-2xl font-black tracking-tight">
          <AnimatedCounter value={value} format={format} />
        </p>
        {subtitle && (
          <p className="mt-0.5 text-xs font-semibold text-white/60">
            {subtitle}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ── Progress Bar ──────────────────────────────────────────
function ProgressBar({
  value,
  max,
  color = "bg-blue-500",
  delay = 0,
}: {
  value: number;
  max: number;
  color?: string;
  delay?: number;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ delay, duration: 0.6, ease: "easeOut" }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  );
}

// ── Sortable Table Header ─────────────────────────────────
type SortDir = "asc" | "desc";
function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "center" | "right";
}) {
  return (
    <th
      className={`px-4 py-3 text-[12px] font-black uppercase tracking-widest text-slate-600 cursor-pointer select-none hover:bg-slate-100/60 transition-colors ${
        align === "right"
          ? "text-right"
          : align === "center"
            ? "text-center"
            : "text-left"
      }`}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active &&
          (dir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
      </span>
    </th>
  );
}

// ── Status Badge ──────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    inactive: "bg-slate-100 text-slate-500",
    ativo: "bg-emerald-100 text-emerald-700",
    inativo: "bg-slate-100 text-slate-500",
    manutencao: "bg-amber-100 text-amber-700",
  };
  const cls = map[status] || "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}
    >
      {status}
    </span>
  );
}

// ── Table Container ───────────────────────────────────────
function TableShell({
  children,
  emptyMessage,
  isEmpty,
}: {
  children: React.ReactNode;
  emptyMessage: string;
  isEmpty: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/40">
      <div className="overflow-x-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="mb-3 rounded-full bg-slate-100 p-4 text-slate-300">
              <Gauge size={32} />
            </div>
            <p className="text-sm font-bold text-slate-400">{emptyMessage}</p>
          </div>
        ) : (
          <table className="w-full divide-y divide-slate-100">{children}</table>
        )}
      </div>
    </div>
  );
}

function useSort<T>(data: T[], initialKey: keyof T) {
  const [sortKey, setSortKey] = useState<keyof T>(initialKey);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = String(av ?? "");
      const bs = String(bv ?? "");
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return arr;
  }, [data, sortKey, sortDir]);

  const toggleSort = useCallback(
    (key: keyof T) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey],
  );

  return { sorted, sortKey, sortDir, toggleSort };
}

// ── Row animation wrapper ─────────────────────────────────
function AnimatedRow({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.5), duration: 0.3 }}
      className="hover:bg-slate-50/50 transition-colors"
    >
      {children}
    </motion.tr>
  );
}

// ================================================================
// Main Page
// ================================================================
export default function DesempenhoPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<DesempenhoOverview | null>(null);
  const [motoristas, setMotoristas] = useState<MotoristaMetricas[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioMetricas[]>([]);
  const [parceiros, setParceiros] = useState<ParceiroMetricas[]>([]);
  const [clientes, setClientes] = useState<ClienteMetricas[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoMetricas[]>([]);
  const [periodo, setPeriodo] = useState<"mes" | "trimestre" | "ano" | "tudo">(
    "tudo",
  );

  const filters: DesempenhoFilters | undefined = useMemo(() => {
    if (periodo === "tudo") return undefined;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    if (periodo === "mes") {
      const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      const nextMonth = m === 11 ? 0 : m + 1;
      const nextY = m === 11 ? y + 1 : y;
      const end = `${nextY}-${String(nextMonth + 1).padStart(2, "0")}-01`;
      return { dataInicio: start, dataFim: end };
    }
    if (periodo === "trimestre") {
      const startMonth = Math.floor(m / 3) * 3;
      const start = `${y}-${String(startMonth + 1).padStart(2, "0")}-01`;
      return { dataInicio: start };
    }
    if (periodo === "ano") {
      return { dataInicio: `${y}-01-01` };
    }
    return undefined;
  }, [periodo]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, mot, func, parc, cli, vei] = await Promise.all([
        fetchDesempenhoOverview(filters),
        fetchMotoristasDesempenho(filters),
        fetchFuncionariosDesempenho(filters),
        fetchParceirosDesempenho(filters),
        fetchClientesDesempenho(filters),
        fetchVeiculosDesempenho(filters),
      ]);
      setOverview(ov);
      setMotoristas(mot);
      setFuncionarios(func);
      setParceiros(parc);
      setClientes(cli);
      setVeiculos(vei);
    } catch (error) {
      console.error("Erro ao carregar desempenho:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (!hasPageAccess(profile, "desempenho")) {
    return <AccessDenied module="Operacional" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Controle de Desempenho" icon={<Gauge size={22} />} />

      {/* Filtro de período */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">
          Período:
        </span>
        {(
          [
            { k: "mes", l: "Este Mês" },
            { k: "trimestre", l: "Trimestre" },
            { k: "ano", l: "Este Ano" },
            { k: "tudo", l: "Tudo" },
          ] as const
        ).map((p) => (
          <button
            key={p.k}
            onClick={() => setPeriodo(p.k)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              periodo === p.k
                ? "bg-[var(--color-geolog-blue)] text-white shadow-lg shadow-blue-900/20"
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
            }`}
          >
            {p.l}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-all cursor-pointer ${
              activeTab === tab.key
                ? "bg-[var(--color-geolog-blue)] text-white shadow-lg shadow-blue-900/20"
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="mb-3 h-10 w-10 animate-spin text-slate-300" />
          <p className="text-sm font-black uppercase tracking-widest text-slate-400">
            Calculando métricas...
          </p>
        </div>
      )}

      {/* Content */}
      {!loading && (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab === "overview" && overview && (
              <OverviewTab overview={overview} />
            )}
            {activeTab === "motoristas" && <MotoristasTab data={motoristas} />}
            {activeTab === "funcionarios" && (
              <FuncionariosTab data={funcionarios} />
            )}
            {activeTab === "parceiros" && <ParceirosTab data={parceiros} />}
            {activeTab === "clientes" && <ClientesTab data={clientes} />}
            {activeTab === "veiculos" && <VeiculosTab data={veiculos} />}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ================================================================
// Overview Tab
// ================================================================
function OverviewTab({ overview }: { overview: DesempenhoOverview }) {
  return (
    <div className="space-y-6">
      {/* KPIs principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<CheckCircle2 size={20} />}
          label="Total de OS"
          value={overview.totalOS}
          format={formatNumber}
          color="blue"
          delay={0}
          subtitle={`${overview.osConcluidas} concluídas`}
        />
        <KpiCard
          icon={<TrendingUp size={20} />}
          label="Taxa de Conclusão"
          value={overview.taxaConclusaoGeral}
          format={formatPercent}
          color="green"
          delay={0.1}
          subtitle={`${overview.osPendentes} pendentes`}
        />
        <KpiCard
          icon={<DollarSign size={20} />}
          label="Faturamento"
          value={overview.faturamentoTotal}
          format={formatCurrency}
          color="violet"
          delay={0.2}
          subtitle={`Lucro: ${formatCurrency(overview.lucroTotal)}`}
        />
        <KpiCard
          icon={<TrendingDown size={20} />}
          label="Custo Total"
          value={overview.custoTotal}
          format={formatCurrency}
          color="rose"
          delay={0.3}
          subtitle={`Margem: ${
            overview.faturamentoTotal > 0
              ? formatPercent(
                  Number(
                    (
                      (overview.lucroTotal / overview.faturamentoTotal) *
                      100
                    ).toFixed(1),
                  ),
                )
              : "0%"
          }`}
        />
      </div>

      {/* Entidades */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <EntityCard
          icon={<Users size={22} />}
          label="Motoristas"
          total={overview.totalMotoristas}
          ativos={overview.totalMotoristasAtivos}
          color="bg-blue-50 text-blue-600 border-blue-200"
          delay={0}
        />
        <EntityCard
          icon={<UserSquare2 size={22} />}
          label="Funcionários"
          total={overview.totalFuncionarios}
          ativos={overview.totalFuncionariosAtivos}
          color="bg-violet-50 text-violet-600 border-violet-200"
          delay={0.1}
        />
        <EntityCard
          icon={<Handshake size={22} />}
          label="Parceiros"
          total={overview.totalParceiros}
          ativos={overview.totalParceirosAtivos}
          color="bg-amber-50 text-amber-600 border-amber-200"
          delay={0.2}
        />
        <EntityCard
          icon={<Building size={22} />}
          label="Clientes"
          total={overview.totalClientes}
          ativos={overview.totalClientes}
          color="bg-emerald-50 text-emerald-600 border-emerald-200"
          delay={0.3}
        />
        <EntityCard
          icon={<Truck size={22} />}
          label="Veículos"
          total={overview.totalVeiculos}
          ativos={overview.totalVeiculosAtivos}
          color="bg-slate-50 text-slate-600 border-slate-200"
          delay={0.4}
          extra={`${overview.totalVeiculosManutencao} em manutenção`}
        />
        <EntityCard
          icon={<Clock size={22} />}
          label="OS Canceladas"
          total={overview.osCanceladas}
          ativos={overview.osPendentes}
          color="bg-rose-50 text-rose-600 border-rose-200"
          delay={0.5}
          ativosLabel="Pendentes"
        />
      </div>
    </div>
  );
}

function EntityCard({
  icon,
  label,
  total,
  ativos,
  color,
  delay,
  ativosLabel = "Ativos",
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  total: number;
  ativos: number;
  color: string;
  delay: number;
  ativosLabel?: string;
  extra?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 120, damping: 15 }}
      className={`rounded-3xl border p-5 ${color}`}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-white/60 p-2.5">{icon}</div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest opacity-70">
            {label}
          </p>
          <p className="text-2xl font-black">
            <AnimatedCounter value={total} format={formatNumber} />
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs font-bold">
        <span className="opacity-60">
          {ativosLabel}: {formatNumber(ativos)}
        </span>
        {extra && <span className="opacity-60">{extra}</span>}
      </div>
    </motion.div>
  );
}

// ================================================================
// Motoristas Tab
// ================================================================
function MotoristasTab({ data }: { data: MotoristaMetricas[] }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSort(data, "totalOS");
  const maxOS = Math.max(...data.map((d) => d.totalOS), 1);

  return (
    <TableShell
      isEmpty={data.length === 0}
      emptyMessage="Nenhum motorista encontrado."
    >
      <thead className="bg-slate-50/80 border-b border-slate-200">
        <tr>
          <SortHeader
            label="Motorista"
            active={sortKey === "nome"}
            dir={sortDir}
            onClick={() => toggleSort("nome")}
          />
          <SortHeader
            label="Vínculo"
            active={sortKey === "vinculo"}
            dir={sortDir}
            onClick={() => toggleSort("vinculo")}
          />
          <SortHeader
            label="Total OS"
            active={sortKey === "totalOS"}
            dir={sortDir}
            onClick={() => toggleSort("totalOS")}
            align="center"
          />
          <SortHeader
            label="Concluídas"
            active={sortKey === "osConcluidas"}
            dir={sortDir}
            onClick={() => toggleSort("osConcluidas")}
            align="center"
          />
          <SortHeader
            label="Taxa"
            active={sortKey === "taxaConclusao"}
            dir={sortDir}
            onClick={() => toggleSort("taxaConclusao")}
            align="center"
          />
          <SortHeader
            label="Faturamento"
            active={sortKey === "faturamento"}
            dir={sortDir}
            onClick={() => toggleSort("faturamento")}
            align="right"
          />
          <SortHeader
            label="Lucro"
            active={sortKey === "lucro"}
            dir={sortDir}
            onClick={() => toggleSort("lucro")}
            align="right"
          />
          <SortHeader
            label="KM Rodado"
            active={sortKey === "kmRodado"}
            dir={sortDir}
            onClick={() => toggleSort("kmRodado")}
            align="right"
          />
          <SortHeader
            label="Tempo Méd."
            active={sortKey === "tempoMedioRotaMin"}
            dir={sortDir}
            onClick={() => toggleSort("tempoMedioRotaMin")}
            align="right"
          />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {sorted.map((m, i) => (
          <AnimatedRow key={m.id} index={i}>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.avatarUrl}
                    alt={m.nome}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-400">
                    {m.nome.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-bold text-slate-800 text-sm">
                  {m.nome}
                </span>
              </div>
            </td>
            <td className="px-4 py-3">
              <span className="text-xs font-semibold text-slate-500 capitalize">
                {m.vinculo || "—"}
              </span>
            </td>
            <td className="px-4 py-3 text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="font-bold text-slate-800">{m.totalOS}</span>
                <div className="w-16">
                  <ProgressBar
                    value={m.totalOS}
                    max={maxOS}
                    color="bg-blue-500"
                    delay={i * 0.02}
                  />
                </div>
              </div>
            </td>
            <td className="px-4 py-3 text-center font-bold text-emerald-600">
              {m.osConcluidas}
            </td>
            <td className="px-4 py-3 text-center">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  m.taxaConclusao >= 80
                    ? "bg-emerald-100 text-emerald-700"
                    : m.taxaConclusao >= 50
                      ? "bg-amber-100 text-amber-700"
                      : "bg-rose-100 text-rose-700"
                }`}
              >
                {formatPercent(m.taxaConclusao)}
              </span>
            </td>
            <td className="px-4 py-3 text-right font-bold text-slate-700">
              {formatCurrency(m.faturamento)}
            </td>
            <td className="px-4 py-3 text-right">
              <span
                className={
                  m.lucro >= 0
                    ? "font-bold text-emerald-600"
                    : "font-bold text-rose-600"
                }
              >
                {formatCurrency(m.lucro)}
              </span>
            </td>
            <td className="px-4 py-3 text-right text-sm font-semibold text-slate-600">
              {m.kmRodado > 0 ? `${formatNumber(m.kmRodado)} km` : "—"}
            </td>
            <td className="px-4 py-3 text-right text-sm font-semibold text-slate-600">
              {m.tempoMedioRotaMin != null ? `${m.tempoMedioRotaMin} min` : "—"}
            </td>
          </AnimatedRow>
        ))}
      </tbody>
    </TableShell>
  );
}

// ================================================================
// Funcionários Tab
// ================================================================
function FuncionariosTab({ data }: { data: FuncionarioMetricas[] }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSort(data, "osCriadas");
  const maxOS = Math.max(...data.map((d) => d.osCriadas), 1);

  return (
    <TableShell
      isEmpty={data.length === 0}
      emptyMessage="Nenhum funcionário encontrado."
    >
      <thead className="bg-slate-50/80 border-b border-slate-200">
        <tr>
          <SortHeader
            label="Funcionário"
            active={sortKey === "nome"}
            dir={sortDir}
            onClick={() => toggleSort("nome")}
          />
          <SortHeader
            label="Categoria"
            active={sortKey === "categoria"}
            dir={sortDir}
            onClick={() => toggleSort("categoria")}
          />
          <SortHeader
            label="Status"
            active={sortKey === "ativo"}
            dir={sortDir}
            onClick={() => toggleSort("ativo")}
            align="center"
          />
          <SortHeader
            label="OS Criadas"
            active={sortKey === "osCriadas"}
            dir={sortDir}
            onClick={() => toggleSort("osCriadas")}
            align="center"
          />
          <SortHeader
            label="OS no Mês"
            active={sortKey === "osCriadasMes"}
            dir={sortDir}
            onClick={() => toggleSort("osCriadasMes")}
            align="center"
          />
          <SortHeader
            label="Interações"
            active={sortKey === "atualizacoesFeitas"}
            dir={sortDir}
            onClick={() => toggleSort("atualizacoesFeitas")}
            align="center"
          />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {sorted.map((f, i) => (
          <AnimatedRow key={f.id} index={i}>
            <td className="px-4 py-3 font-bold text-slate-800 text-sm">
              {f.nome}
            </td>
            <td className="px-4 py-3">
              <span className="text-xs font-semibold text-slate-500 capitalize">
                {f.categoria}
              </span>
            </td>
            <td className="px-4 py-3 text-center">
              <StatusBadge status={f.ativo ? "active" : "inactive"} />
            </td>
            <td className="px-4 py-3 text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="font-bold text-slate-800">{f.osCriadas}</span>
                <div className="w-16">
                  <ProgressBar
                    value={f.osCriadas}
                    max={maxOS}
                    color="bg-violet-500"
                    delay={i * 0.02}
                  />
                </div>
              </div>
            </td>
            <td className="px-4 py-3 text-center font-bold text-blue-600">
              {f.osCriadasMes}
            </td>
            <td className="px-4 py-3 text-center text-sm font-semibold text-slate-600">
              {formatNumber(f.atualizacoesFeitas)}
            </td>
          </AnimatedRow>
        ))}
      </tbody>
    </TableShell>
  );
}

// ================================================================
// Parceiros Tab
// ================================================================
function ParceirosTab({ data }: { data: ParceiroMetricas[] }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSort(data, "totalOS");
  const maxOS = Math.max(...data.map((d) => d.totalOS), 1);

  return (
    <TableShell
      isEmpty={data.length === 0}
      emptyMessage="Nenhum parceiro encontrado."
    >
      <thead className="bg-slate-50/80 border-b border-slate-200">
        <tr>
          <SortHeader
            label="Parceiro"
            active={sortKey === "nome"}
            dir={sortDir}
            onClick={() => toggleSort("nome")}
          />
          <SortHeader
            label="Status"
            active={sortKey === "status"}
            dir={sortDir}
            onClick={() => toggleSort("status")}
            align="center"
          />
          <SortHeader
            label="Motoristas"
            active={sortKey === "motoristasVinculados"}
            dir={sortDir}
            onClick={() => toggleSort("motoristasVinculados")}
            align="center"
          />
          <SortHeader
            label="Total OS"
            active={sortKey === "totalOS"}
            dir={sortDir}
            onClick={() => toggleSort("totalOS")}
            align="center"
          />
          <SortHeader
            label="Concluídas"
            active={sortKey === "osConcluidas"}
            dir={sortDir}
            onClick={() => toggleSort("osConcluidas")}
            align="center"
          />
          <SortHeader
            label="Faturamento"
            active={sortKey === "faturamento"}
            dir={sortDir}
            onClick={() => toggleSort("faturamento")}
            align="right"
          />
          <SortHeader
            label="Lucro"
            active={sortKey === "lucro"}
            dir={sortDir}
            onClick={() => toggleSort("lucro")}
            align="right"
          />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {sorted.map((p, i) => (
          <AnimatedRow key={p.id} index={i}>
            <td className="px-4 py-3 font-bold text-slate-800 text-sm">
              {p.nome}
            </td>
            <td className="px-4 py-3 text-center">
              <StatusBadge status={p.status} />
            </td>
            <td className="px-4 py-3 text-center font-bold text-slate-700">
              {p.motoristasVinculados}
            </td>
            <td className="px-4 py-3 text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="font-bold text-slate-800">{p.totalOS}</span>
                <div className="w-16">
                  <ProgressBar
                    value={p.totalOS}
                    max={maxOS}
                    color="bg-amber-500"
                    delay={i * 0.02}
                  />
                </div>
              </div>
            </td>
            <td className="px-4 py-3 text-center font-bold text-emerald-600">
              {p.osConcluidas}
            </td>
            <td className="px-4 py-3 text-right font-bold text-slate-700">
              {formatCurrency(p.faturamento)}
            </td>
            <td className="px-4 py-3 text-right">
              <span
                className={
                  p.lucro >= 0
                    ? "font-bold text-emerald-600"
                    : "font-bold text-rose-600"
                }
              >
                {formatCurrency(p.lucro)}
              </span>
            </td>
          </AnimatedRow>
        ))}
      </tbody>
    </TableShell>
  );
}

// ================================================================
// Clientes Tab
// ================================================================
function ClientesTab({ data }: { data: ClienteMetricas[] }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSort(data, "faturamento");
  const maxFat = Math.max(...data.map((d) => d.faturamento), 1);

  return (
    <TableShell
      isEmpty={data.length === 0}
      emptyMessage="Nenhum cliente encontrado."
    >
      <thead className="bg-slate-50/80 border-b border-slate-200">
        <tr>
          <SortHeader
            label="Cliente"
            active={sortKey === "nome"}
            dir={sortDir}
            onClick={() => toggleSort("nome")}
          />
          <SortHeader
            label="Total OS"
            active={sortKey === "totalOS"}
            dir={sortDir}
            onClick={() => toggleSort("totalOS")}
            align="center"
          />
          <SortHeader
            label="Concluídas"
            active={sortKey === "osConcluidas"}
            dir={sortDir}
            onClick={() => toggleSort("osConcluidas")}
            align="center"
          />
          <SortHeader
            label="OS no Mês"
            active={sortKey === "osMes"}
            dir={sortDir}
            onClick={() => toggleSort("osMes")}
            align="center"
          />
          <SortHeader
            label="Faturamento"
            active={sortKey === "faturamento"}
            dir={sortDir}
            onClick={() => toggleSort("faturamento")}
            align="right"
          />
          <SortHeader
            label="Lucro"
            active={sortKey === "lucro"}
            dir={sortDir}
            onClick={() => toggleSort("lucro")}
            align="right"
          />
          <SortHeader
            label="Ticket Médio"
            active={sortKey === "ticketMedio"}
            dir={sortDir}
            onClick={() => toggleSort("ticketMedio")}
            align="right"
          />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {sorted.map((c, i) => (
          <AnimatedRow key={c.id} index={i}>
            <td className="px-4 py-3 font-bold text-slate-800 text-sm">
              {c.nome}
            </td>
            <td className="px-4 py-3 text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="font-bold text-slate-800">{c.totalOS}</span>
                <div className="w-16">
                  <ProgressBar
                    value={c.faturamento}
                    max={maxFat}
                    color="bg-emerald-500"
                    delay={i * 0.02}
                  />
                </div>
              </div>
            </td>
            <td className="px-4 py-3 text-center font-bold text-emerald-600">
              {c.osConcluidas}
            </td>
            <td className="px-4 py-3 text-center font-bold text-blue-600">
              {c.osMes}
            </td>
            <td className="px-4 py-3 text-right font-bold text-slate-700">
              {formatCurrency(c.faturamento)}
            </td>
            <td className="px-4 py-3 text-right">
              <span
                className={
                  c.lucro >= 0
                    ? "font-bold text-emerald-600"
                    : "font-bold text-rose-600"
                }
              >
                {formatCurrency(c.lucro)}
              </span>
            </td>
            <td className="px-4 py-3 text-right text-sm font-semibold text-slate-600">
              {c.ticketMedio > 0 ? formatCurrency(c.ticketMedio) : "—"}
            </td>
          </AnimatedRow>
        ))}
      </tbody>
    </TableShell>
  );
}

// ================================================================
// Veículos Tab
// ================================================================
function VeiculosTab({ data }: { data: VeiculoMetricas[] }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSort(data, "totalOS");
  const maxOS = Math.max(...data.map((d) => d.totalOS), 1);
  const maxKm = Math.max(...data.map((d) => d.kmRodado), 1);

  return (
    <TableShell
      isEmpty={data.length === 0}
      emptyMessage="Nenhum veículo encontrado."
    >
      <thead className="bg-slate-50/80 border-b border-slate-200">
        <tr>
          <SortHeader
            label="Veículo"
            active={sortKey === "placa"}
            dir={sortDir}
            onClick={() => toggleSort("placa")}
          />
          <SortHeader
            label="Status"
            active={sortKey === "status"}
            dir={sortDir}
            onClick={() => toggleSort("status")}
            align="center"
          />
          <SortHeader
            label="Total OS"
            active={sortKey === "totalOS"}
            dir={sortDir}
            onClick={() => toggleSort("totalOS")}
            align="center"
          />
          <SortHeader
            label="KM Rodado"
            active={sortKey === "kmRodado"}
            dir={sortDir}
            onClick={() => toggleSort("kmRodado")}
            align="right"
          />
          <SortHeader
            label="Manut. Abertas"
            active={sortKey === "manutencoesAbertas"}
            dir={sortDir}
            onClick={() => toggleSort("manutencoesAbertas")}
            align="center"
          />
          <SortHeader
            label="Manut. Concl."
            active={sortKey === "manutencoesConcluidas"}
            dir={sortDir}
            onClick={() => toggleSort("manutencoesConcluidas")}
            align="center"
          />
          <SortHeader
            label="Custo Manut."
            active={sortKey === "custoManutencao"}
            dir={sortDir}
            onClick={() => toggleSort("custoManutencao")}
            align="right"
          />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {sorted.map((v, i) => (
          <AnimatedRow key={v.id} index={i}>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                  <Truck size={16} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{v.placa}</p>
                  <p className="text-xs text-slate-400">
                    {v.marca} {v.modelo}
                  </p>
                </div>
              </div>
            </td>
            <td className="px-4 py-3 text-center">
              <StatusBadge status={v.status} />
            </td>
            <td className="px-4 py-3 text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="font-bold text-slate-800">{v.totalOS}</span>
                <div className="w-16">
                  <ProgressBar
                    value={v.totalOS}
                    max={maxOS}
                    color="bg-slate-500"
                    delay={i * 0.02}
                  />
                </div>
              </div>
            </td>
            <td className="px-4 py-3 text-right">
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold text-slate-600">
                  {v.kmRodado > 0 ? `${formatNumber(v.kmRodado)} km` : "—"}
                </span>
                {v.kmRodado > 0 && (
                  <div className="w-16">
                    <ProgressBar
                      value={v.kmRodado}
                      max={maxKm}
                      color="bg-blue-400"
                      delay={i * 0.02}
                    />
                  </div>
                )}
              </div>
            </td>
            <td className="px-4 py-3 text-center">
              {v.manutencoesAbertas > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                  <AlertTriangle size={12} />
                  {v.manutencoesAbertas}
                </span>
              ) : (
                <span className="text-slate-300">0</span>
              )}
            </td>
            <td className="px-4 py-3 text-center font-bold text-emerald-600">
              {v.manutencoesConcluidas}
            </td>
            <td className="px-4 py-3 text-right text-sm font-semibold text-slate-600">
              {v.custoManutencao > 0 ? formatCurrency(v.custoManutencao) : "—"}
            </td>
          </AnimatedRow>
        ))}
      </tbody>
    </TableShell>
  );
}
