"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  DollarSign,
  TrendingUp,
  Download,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { DataTable } from "@/components/ui/DataTable";
import { useServerPaginatedTable } from "@/hooks/useServerPaginatedTable";
import { fetchOSFinancePage, fetchOSFinanceStats } from "@/lib/supabase/queries";

export default function MedicaoFinanceiraPage() {
  const { clientes, updateOSStatus, impostoPercentual } = useData();
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7),
  ); // YYYY-MM
  const [stats, setStats] = useState({
    totalOS: 0,
    totalBruto: 0,
    totalCusto: 0,
    totalImposto: 0,
    totalLucro: 0,
  });

  const financeTable = useServerPaginatedTable(
    useCallback(
      async (params) => fetchOSFinancePage({ ...params, month: selectedMonth }),
      [selectedMonth],
    ),
    10,
  );

  // Simulating Admin check (since real role isn't in AuthContext yet)
  const isAdmin = user?.email?.includes("admin") || true; // Force true for demo or if admin email is used

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Stats via RPC server-side
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchOSFinanceStats(selectedMonth);
        if (!cancelled) setStats(data);
      } catch (err) {
        console.error("Erro ao carregar stats financeiros:", err);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedMonth]);

  const handleDarBaixa = (id: string) => {
    updateOSStatus(id, { financeiro: "Faturado" });
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800">Acesso Restrito</h2>
        <p className="text-slate-500 max-w-md">
          Esta página é exclusiva para usuários com perfil
          administrativo/financeiro.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col gap-3 rounded-[1.75rem] border border-slate-200 bg-white/80 px-4 py-4 shadow-sm shadow-slate-200/50 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-end">
        <div className="relative">
          <CalendarRange
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="month"
            className="h-11 min-w-[180px] rounded-2xl border border-slate-200 bg-slate-50 px-11 py-2 text-sm font-bold text-slate-700 shadow-sm outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
        <button className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-black text-emerald-700 shadow-sm shadow-emerald-100/60 transition-all hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800 active:scale-[0.98]">
          <Download size={17} />
          Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <FinanceStatCard
          label="Total faturamento mensal"
          value={formatCurrency(stats.totalBruto)}
          subValue={`Impostos retidos: ${formatCurrency(stats.totalImposto)}`}
          icon={<DollarSign className="text-blue-600" size={28} />}
          color="blue"
        />
        <FinanceStatCard
          label="Repasse a motoristas"
          value={formatCurrency(stats.totalCusto)}
          subValue={`${stats.totalOS} ordens de serviço executadas`}
          icon={<AlertCircle className="text-orange-600" size={28} />}
          color="orange"
        />
        <FinanceStatCard
          label="Lucro líquido disponível"
          value={formatCurrency(stats.totalLucro)}
          subValue={`Margem operacional de ${((stats.totalLucro / (stats.totalBruto || 1)) * 100).toFixed(1)}%`}
          icon={<TrendingUp className="text-emerald-600" size={28} />}
          color="emerald"
        />
      </div>

      {/* Finance Table */}
      <DataTable
        data={financeTable.items}
        loading={financeTable.loading}
        pagination={{
          page: financeTable.page,
          pageSize: financeTable.pageSize,
          totalItems: financeTable.totalCount,
          onPageChange: financeTable.setPage,
        }}
        searchTerm={financeTable.searchTerm}
        onSearchChange={financeTable.setSearchTerm}
        searchPlaceholder="Buscar por OS, Cliente ou Motorista..."
        columns={[
          {
            key: "documento",
            title: "Documento / Data",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            render: (_: any, item: any) => (
              <div className="flex flex-col gap-2">
                <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-black text-slate-800 shadow-sm">
                  #{item.os}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {new Date(item.data).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ),
          },
          {
            key: "cliente",
            title: "Cliente",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            render: (_: unknown, item: any) => {
              const clienteNome =
                clientes.find((c) => c.id === item.clienteId)?.nome || "N/A";
              return (
                <span className="text-base font-semibold text-slate-700">
                  {clienteNome}
                </span>
              );
            },
          },
          {
            key: "itinerario",
            title: "Itinerário / KM",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            render: (_: any, item: any) => (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-800">
                  {item.rota?.waypoints?.filter(
                    (waypoint: { label: string }) =>
                      waypoint.label.trim() !== "",
                  ).length
                    ? `${item.rota.waypoints.filter((waypoint: { label: string }) => waypoint.label.trim() !== "").length} pontos`
                    : "Sem pontos"}
                </span>
                {item.distancia && (
                  <span className="inline-flex w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700 shadow-sm">
                    {item.distancia} KM
                  </span>
                )}
              </div>
            ),
          },
          {
            key: "valorBruto",
            title: "Faturamento (R$)",
            align: "right",
            render: (value: unknown) => (
              <span className="text-right font-black text-slate-900 tabular-nums text-lg">
                {formatCurrency(value as number)}
              </span>
            ),
          },
          {
            key: "imposto",
            title: `Deduções (${impostoPercentual}%)`,
            align: "right",
            render: (value: unknown) => (
              <span className="text-right font-bold text-red-500 tabular-nums text-sm">
                -{formatCurrency(value as number)}
              </span>
            ),
          },
          {
            key: "custo",
            title: "Repasse (R$)",
            align: "right",
            render: (value: unknown) => (
              <span className="text-right font-bold text-slate-600 tabular-nums text-sm">
                {formatCurrency(value as number)}
              </span>
            ),
          },
          {
            key: "lucro",
            title: "Lucro Líquido",
            align: "right",
            render: (value: unknown) => (
              <span
                className={`text-right text-lg font-black tabular-nums ${(value as number) >= 0 ? "text-emerald-600" : "text-red-600"}`}
              >
                {formatCurrency(value as number)}
              </span>
            ),
          },
          {
            key: "status",
            title: "Status",
            align: "center",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            render: (_: any, item: any) => (
              <div className="flex justify-center">
                {item.status.financeiro === "Faturado" ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-700 shadow-sm shadow-emerald-100/50">
                    <CheckCircle2 size={15} />
                    Faturado
                  </span>
                ) : (
                  <button
                    onClick={() => handleDarBaixa(item.id)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-blue-700 shadow-sm shadow-blue-100/60 transition-all hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800 active:scale-[0.98]"
                  >
                    <CheckCircle2 size={15} />
                    Dar Baixa
                  </button>
                )}
              </div>
            ),
          },
        ]}
        emptyMessage="Nenhuma transação financeira encontrada."
        emptyIcon={<DollarSign size={48} />}
      />
    </div>
  );
}

function FinanceStatCard({
  label,
  value,
  subValue,
  icon,
  color,
}: {
  label: string;
  value: string;
  subValue: string;
  icon: React.ReactNode;
  color: string;
}) {
  const bgColors: Record<string, string> = {
    blue: "bg-blue-50/80 border-blue-100 text-blue-600",
    orange: "bg-orange-50/80 border-orange-100 text-orange-600",
    emerald: "bg-emerald-50/80 border-emerald-100 text-emerald-600",
  };

  return (
    <div className="flex items-start gap-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/40 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className={`rounded-2xl border p-4 shadow-sm ${bgColors[color]}`}>
        <div className="[&>svg]:h-7 [&>svg]:w-7">{icon}</div>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
          {label}
        </p>
        <h3 className="text-3xl font-black tracking-tighter text-slate-800 tabular-nums">
          {value}
        </h3>
        <p className="mt-2 text-sm font-semibold text-slate-500">{subValue}</p>
      </div>
    </div>
  );
}
