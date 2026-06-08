import {
  ArrowRightLeft,
  Calendar,
  CalendarClock,
  ChevronDown,
  Download,
  Filter,
  ReceiptText,
  RotateCcw,
  Truck,
} from "lucide-react";
import type { ReactElement } from "react";
import { formatDate } from "../_lib/financeiro-page";

type FinanceiroToolbarProps = {
  dataInicio: string;
  dataFim: string;
  showFilters: boolean;
  showMotorista: boolean;
  activeQuickRange: "today" | "week" | "month" | "custom" | null;
  reportLoading: boolean;
  onToggleFilters: () => void;
  onToggleMotorista: () => void;
  onSetQuickRange: (mode: "today" | "week" | "month") => void;
  onOpenReportModal: () => void;
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
  showMotorista,
  activeQuickRange,
  reportLoading,
  onToggleFilters,
  onToggleMotorista,
  onSetQuickRange,
  onOpenReportModal,
}: FinanceiroToolbarProps): ReactElement {
  return (
    <section className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 transition-all">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
          <Calendar size={14} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">
            {formatDate(dataInicio)} - {formatDate(dataFim)}
          </span>
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
            <ChevronDown
              size={16}
              className={`transition-transform ${showFilters ? "rotate-180" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={onToggleMotorista}
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black shadow-sm transition-all active:scale-95 cursor-pointer ${
              showMotorista
                ? "border-slate-400 bg-slate-100 text-slate-800"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            <Truck size={16} />
            Motorista
            <ChevronDown
              size={16}
              className={`transition-transform ${showMotorista ? "rotate-180" : ""}`}
            />
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
        </div>
      </div>
    </section>
  );
}
