"use client";

import { useData, type OrderService } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { useParceiros } from "@/hooks/useParceiros";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Building2, Truck, Landmark, Filter, RotateCcw } from "lucide-react";
import {
  fetchOSFinanceOverview,
  type FinanceQueryFilters,
} from "@/lib/supabase/queries";

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

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function MiniListPanel({
  title,
  rows,
  loading,
  icon,
}: {
  title: string;
  rows: GroupSummary[];
  loading: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-slate-500 shadow-sm">
            {icon}
          </div>
          <h3 className="text-lg font-black tracking-tight text-slate-900">
            {title}
          </h3>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
          Top 5
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/50 px-4 py-12 text-center">
          <RotateCcw className="mb-3 h-8 w-8 animate-spin text-slate-300" />
          <p className="text-sm font-black uppercase tracking-widest text-slate-400">
            Carregando dados...
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/50 px-4 py-12 text-center text-sm font-semibold text-slate-400">
          <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-300">
            <Filter size={24} />
          </div>
          Sem dados para o filtro selecionado.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="group flex items-center justify-between gap-4 rounded-[1.5rem] border border-slate-100 bg-slate-50/30 p-4 transition-all hover:border-blue-100 hover:bg-blue-50/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-slate-400 shadow-sm transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-800">
                    {row.label}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {row.count} OS executadas
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-slate-800 tabular-nums">
                  {formatCurrency(row.total)}
                </p>
                <div className="h-1 w-full rounded-full bg-slate-100 mt-1 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{
                      width: `${(row.total / (rows[0]?.total || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { parceiros } = useParceiros();
  const { drivers, clientes, loading: dataLoading, lastOSUpdate } = useData();
  const [overviewRows, setOverviewRows] = useState<OrderService[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const stats = useMemo(
    () => ({
      trips: 0,
      drivers: drivers.length,
      alerts: 0,
    }),
    [drivers.length],
  );

  // Load overview data for summary panels
  useEffect(() => {
    let cancelled = false;
    const loadOverview = async () => {
      if (cancelled) return;
      setOverviewLoading(true);
      try {
        const filters: FinanceQueryFilters = {
          month: new Date().toISOString().slice(0, 7),
        };
        const data = await fetchOSFinanceOverview(filters);
        if (!cancelled) setOverviewRows(data);
      } catch (error) {
        console.error("Failed to load overview data:", error);
      } finally {
        if (!cancelled) setOverviewLoading(false);
      }
    };

    void loadOverview();
    return () => {
      cancelled = true;
    };
  }, [lastOSUpdate]);

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

  const sumGroup = useCallback(
    (
      rows: OrderService[],
      keyFn: (row: OrderService) => string,
      labelFn: (row: OrderService) => string,
      valueFn: (row: OrderService) => number,
    ): GroupSummary[] => {
      const groups = new Map<string, { total: number; count: number }>();
      rows.forEach((row) => {
        const key = keyFn(row);
        if (!key) return;
        const current = groups.get(key) || { total: 0, count: 0 };
        groups.set(key, {
          total: current.total + valueFn(row),
          count: current.count + 1,
        });
      });
      return Array.from(groups.entries())
        .map(([id, data]) => ({
          id,
          label: labelFn(rows.find((r) => keyFn(r) === id) || rows[0]),
          total: data.total,
          count: data.count,
        }))
        .sort((a, b) => b.total - a.total);
    },
    [],
  );

  const topCustomers = useMemo(
    () =>
      sumGroup(
        overviewRows.filter((row) => !row.isentoValorBruto),
        (row) => row.clienteId || "",
        (row) => customerMap.get(row.clienteId || "") || "Sem cliente",
        (row) => Number(row.valorBruto || 0),
      ).slice(0, 5),
    [overviewRows, customerMap, sumGroup],
  );

  const topDrivers = useMemo(
    () =>
      sumGroup(
        overviewRows.filter((row) => !row.isentoCusto),
        (row) => row.driverId || row.motorista || "",
        (row) => {
          const driverName = row.driverId
            ? driverMap.get(row.driverId)
            : undefined;
          const partnerName = row.driverId
            ? parceiros.find(
                (partner) =>
                  partner.id ===
                  drivers.find((driver) => driver.id === row.driverId)
                    ?.parceiro_id,
              )?.razaoSocialOuNomeCompleto
            : undefined;
          return driverName || row.motorista || partnerName || "Sem motorista";
        },
        (row) => Number(row.custo || 0),
      ).slice(0, 5),
    [overviewRows, driverMap, drivers, parceiros, sumGroup],
  );

  const topCenters = useMemo(
    () =>
      sumGroup(
        overviewRows.filter((row) => !row.isentoValorBruto),
        (row) => row.centroCustoId || "",
        (row) => centerMap.get(row.centroCustoId || "") || "Sem centro",
        (row) => Number(row.valorBruto || 0),
      ).slice(0, 5),
    [overviewRows, centerMap, sumGroup],
  );

  if (!user) return null;

  return (
    <div>
      <div className="bg-[var(--color-geolog-secondary)] p-8 rounded-3xl shadow-2xl border border-white/5 overflow-hidden relative">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-400/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>

        <div className="relative z-10">
          <h2 className="text-4xl font-extrabold mb-4 text-white">
            Bem-vindo,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-300">
              {user?.email?.split("@")[0]}
            </span>
            ! 👋
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <StatCard
              title="Total de Viagens"
              value={stats.trips.toString()}
              color="border-l-blue-400"
            />
            <StatCard
              title="Motoristas Ativos"
              value={stats.drivers.toString()}
              color="border-l-cyan-400"
            />
            <StatCard
              title="Alertas Pendentes"
              value={stats.alerts.toString()}
              color="border-l-[var(--color-geolog-accent)]"
            />
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3 mt-8">
        <MiniListPanel
          title="Faturamento por Cliente"
          loading={overviewLoading || dataLoading}
          rows={topCustomers}
          icon={<Building2 size={22} />}
        />
        <MiniListPanel
          title="Custos por Motorista"
          loading={overviewLoading || dataLoading}
          rows={topDrivers}
          icon={<Truck size={22} />}
        />
        <MiniListPanel
          title="Centros de Custo"
          loading={overviewLoading || dataLoading}
          rows={topCenters}
          icon={<Landmark size={22} />}
        />
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className={`bg-[var(--color-geolog-blue)] p-8 rounded-2xl border border-white/5 hover:shadow-xl transition-all border-l-4 ${color}`}
    >
      <p className="text-sm font-bold text-[var(--color-geolog-accent)] uppercase tracking-widest mb-2">
        {title}
      </p>
      <div className="flex items-end gap-2">
        <p className="text-5xl font-black text-white">{value}</p>
        <span className="text-xs text-[var(--color-geolog-accent)] mb-2 font-bold">
          UNIDADES
        </span>
      </div>
    </div>
  );
}
