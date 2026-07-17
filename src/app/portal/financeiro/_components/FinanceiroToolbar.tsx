import {
  ArrowRightLeft,
  ArrowRight,
  CalendarClock,
  Download,
  Filter,
  ReceiptText,
  RotateCcw,
} from "lucide-react";
import type { ReactElement } from "react";
import GeologDateInput from "@/components/ui/GeologDateInput";

type FinanceiroToolbarProps = {
  dataInicio: string;
  dataFim: string;
  showFilters: boolean;
  activeQuickRange: "today" | "week" | "month" | "custom" | null;
  reportLoading: boolean;
  faturamentoLoteLoading: boolean;
  onToggleFilters: () => void;
  onSetQuickRange: (mode: "today" | "week" | "month") => void;
  onOpenReportModal: () => void;
  onOpenFaturamentoLote: () => void;
  onDataInicioChange: (value: string) => void;
  onDataFimChange: (value: string) => void;
};

const quickRangeButtonClass = (isActive: boolean): string =>
  `inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black shadow-sm transition-all active:scale-95 ${
    isActive
      ? "border-blue-400 bg-blue-50 text-blue-700"
      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
  }`;

export function FinanceiroToolbar({
  dataInicio,
  dataFim,
  showFilters,
  activeQuickRange,
  reportLoading,
  faturamentoLoteLoading,
  onToggleFilters,
  onSetQuickRange,
  onOpenReportModal,
  onOpenFaturamentoLote,
  onDataInicioChange,
  onDataFimChange,
}: FinanceiroToolbarProps): ReactElement {
  return (
    <section className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 transition-all">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <div className="w-[150px]">
            <GeologDateInput
              label="Data Inicial"
              value={dataInicio}
              onChange={onDataInicioChange}
              compact
              placeholder="DD/MM/AAAA"
            />
          </div>
          <ArrowRight size={16} className="shrink-0 text-slate-300" />
          <div className="w-[150px]">
            <GeologDateInput
              label="Data Final"
              value={dataFim}
              onChange={onDataFimChange}
              compact
              placeholder="DD/MM/AAAA"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onToggleFilters}
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black shadow-sm transition-all active:scale-95 cursor-pointer ${
              showFilters
                ? "border-blue-400 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            }`}
          >
            <Filter size={16} />
            Filtros
          </button>
          <button
            type="button"
            onClick={() => onSetQuickRange("today")}
            className={`${quickRangeButtonClass(activeQuickRange === "today")} cursor-pointer`}
          >
            <CalendarClock size={16} />
            Hoje
          </button>
          <button
            type="button"
            onClick={() => onSetQuickRange("week")}
            className={`${quickRangeButtonClass(activeQuickRange === "week")} cursor-pointer`}
          >
            <ArrowRightLeft size={16} />
            Semana
          </button>
          <button
            type="button"
            onClick={() => onSetQuickRange("month")}
            className={`${quickRangeButtonClass(activeQuickRange === "month")} cursor-pointer`}
          >
            <ReceiptText size={16} />
            Mês
          </button>
          <button
            type="button"
            onClick={onOpenReportModal}
            disabled={reportLoading}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70 active:scale-95 cursor-pointer"
          >
            {reportLoading ? (
              <RotateCcw size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Exportar Relatório
          </button>
          <button
            type="button"
            onClick={onOpenFaturamentoLote}
            disabled={faturamentoLoteLoading}
            className="inline-flex items-center gap-2 rounded-2xl border border-yellow-300 bg-gradient-to-r from-yellow-50 via-yellow-100 to-yellow-200 bg-[length:200%_100%] animate-gradient px-4 py-2.5 text-sm font-black text-[rgb(100,102,20)] transition-all duration-300 hover:from-yellow-100 hover:via-yellow-200 hover:to-yellow-300 disabled:cursor-not-allowed disabled:opacity-70 active:scale-95 cursor-pointer"
          >
            {faturamentoLoteLoading ? (
              <RotateCcw size={16} className="animate-spin" />
            ) : (
              <ReceiptText size={16} />
            )}
            Faturar
          </button>
        </div>
      </div>
    </section>
  );
}
