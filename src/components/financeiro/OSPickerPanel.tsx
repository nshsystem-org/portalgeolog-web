"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  AlertCircle,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Receipt,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { fetchOSFinancePage } from "@/lib/supabase/queries";
import type { FinanceQueryFilters } from "@/lib/supabase/queries";
import type { OrderService } from "@/context/DataContext";
import {
  formatCurrency,
  getBrazilDate,
  getFinanceDisplayStatus,
  statusStyle,
} from "@/app/portal/financeiro/_lib/financeiro-page";

/**
 * Filtros de status financeiro expostos no painel de seleção.
 * "liberado" é um estado derivado (Pendente + Finalizado).
 */
export type OSPickerStatusFilter =
  | "all"
  | "pendente"
  | "liberado"
  | "faturado"
  | "recebido";

export interface OSPickerPanelProps {
  clienteId: string;
  defaultDataInicio: string;
  defaultDataFim: string;
  defaultStatusFilter?: OSPickerStatusFilter;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  /**
   * Notifica o valor total (R$) das OS atualmente selecionadas. O somatório
   * considera apenas OS não-isentas.
   */
  onSelectedTotalChange?: (total: number) => void;
  /**
   * Notifica o rótulo do mês atualmente exibido no calendário (ex: "Junho 2026"),
   * para exibição no cabeçalho do modal.
   */
  onMonthLabelChange?: (label: string) => void;
}

const STATUS_OPTIONS: Array<{
  value: OSPickerStatusFilter;
  label: string;
  activeClass: string;
}> = [
  {
    value: "all",
    label: "Todos",
    activeClass:
      "border-slate-400 bg-slate-50 text-slate-700 shadow-md shadow-slate-100/50",
  },
  {
    value: "pendente",
    label: "Pendentes",
    activeClass:
      "border-amber-400 bg-amber-50 text-amber-900 shadow-md shadow-amber-100/50",
  },
  {
    value: "liberado",
    label: "Liberados",
    activeClass:
      "border-blue-400 bg-blue-50 text-blue-700 shadow-md shadow-blue-100/50",
  },
  {
    value: "faturado",
    label: "Faturados",
    activeClass:
      "border-orange-400 bg-orange-50 text-orange-800 shadow-md shadow-orange-100/50",
  },
  {
    value: "recebido",
    label: "Recebidos",
    activeClass:
      "border-emerald-400 bg-emerald-50 text-emerald-900 shadow-md shadow-emerald-100/50",
  },
];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function buildFilters(
  clienteId: string,
  month: string,
  statusFilter: OSPickerStatusFilter,
): FinanceQueryFilters {
  const base: FinanceQueryFilters = { clienteId, month };

  // No servidor buscamos um superconjunto e refinamos no cliente via
  // getFinanceDisplayStatus, pois "Liberado" = Pendente + Finalizado/Concluído.
  switch (statusFilter) {
    case "pendente":
    case "liberado":
      return { ...base, statusFinanceiro: "Pendente" };
    case "faturado":
      return { ...base, statusFinanceiro: "Faturado" };
    case "recebido":
      return { ...base, statusFinanceiro: "Recebido" };
    case "all":
    default:
      return base;
  }
}

const STATUS_FILTER_LABEL: Record<OSPickerStatusFilter, string> = {
  all: "Todos",
  pendente: "Pendente",
  liberado: "Liberado",
  faturado: "Faturado",
  recebido: "Recebido",
};

function dateToMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthKeyLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_LABELS[m - 1]} ${y}`;
}

function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return dateToMonthKey(date);
}

function buildCalendarCells(monthKey: string): Array<{
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
}> {
  const [y, m] = monthKey.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const startWeekday = firstDay.getDay();

  const cells: Array<{
    date: string;
    dayNumber: number;
    isCurrentMonth: boolean;
  }> = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(y, m - 1, -i);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    cells.push({
      date: `${d.getFullYear()}-${mm}-${dd}`,
      dayNumber: d.getDate(),
      isCurrentMonth: false,
    });
  }

  const lastDay = new Date(y, m, 0).getDate();
  for (let day = 1; day <= lastDay; day++) {
    const dd = String(day).padStart(2, "0");
    cells.push({
      date: `${y}-${String(m).padStart(2, "0")}-${dd}`,
      dayNumber: day,
      isCurrentMonth: true,
    });
  }

  while (cells.length < 42) {
    const lastCell = cells[cells.length - 1];
    const [ly, lm, ld] = lastCell.date.split("-").map(Number);
    const next = new Date(ly, lm - 1, ld + 1);
    const dd = String(next.getDate()).padStart(2, "0");
    const mm = String(next.getMonth() + 1).padStart(2, "0");
    cells.push({
      date: `${next.getFullYear()}-${mm}-${dd}`,
      dayNumber: next.getDate(),
      isCurrentMonth: false,
    });
  }

  return cells;
}

function abbreviateMotorista(nome?: string | null): string {
  if (!nome) return "—";
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export default function OSPickerPanel({
  clienteId,
  defaultDataInicio,
  defaultDataFim,
  defaultStatusFilter = "pendente",
  selectedIds,
  onSelectionChange,
  onSelectedTotalChange,
  onMonthLabelChange,
}: OSPickerPanelProps): ReactElement {
  const initialMonth = useMemo(() => {
    if (!defaultDataInicio) return dateToMonthKey(getBrazilDate());
    const isoMatch = defaultDataInicio.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;
    const brMatch = defaultDataInicio.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) return `${brMatch[3]}-${brMatch[2]}`;
    return dateToMonthKey(getBrazilDate());
  }, [defaultDataInicio]);

  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [statusFilter, setStatusFilter] =
    useState<OSPickerStatusFilter>(defaultStatusFilter);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [osList, setOsList] = useState<OrderService[]>([]);

  // Mapeia cada OS já vista (em qualquer mês navegado) ao seu mês de
  // competência, para permitir o resumo "Mês - selecionadas/total" no header,
  // mesmo que a seleção abranja múltiplos meses.
  const [itemMonthMap, setItemMonthMap] = useState<Map<string, string>>(
    () => new Map(),
  );
  // Total de OS visíveis (considerando o filtro de status atual) por mês já
  // navegado.
  const [monthTotals, setMonthTotals] = useState<Map<string, number>>(
    () => new Map(),
  );

  const filters = useMemo(
    () => buildFilters(clienteId, currentMonth, statusFilter),
    [clienteId, currentMonth, statusFilter],
  );

  useEffect(() => {
    if (!clienteId) {
      setOsList([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchOSFinancePage({
      page: 1,
      pageSize: 1000,
      searchTerm: searchTerm.trim(),
      ...filters,
    })
      .then((result) => {
        if (cancelled) return;
        setOsList(result.items);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("OSPickerPanel: erro ao buscar OS", err);
        setError("Falha ao carregar OS. Tente novamente.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, searchTerm, clienteId]);

  useEffect(() => {
    setItemMonthMap((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const os of osList) {
        if (!os.data) continue;
        const monthKey = os.data.slice(0, 7);
        if (next.get(os.id) !== monthKey) {
          next.set(os.id, monthKey);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [osList]);

  // Restringe a exibição às OS dentro do período "De"/"Até" definido no
  // formulário de configuração, mesmo que o usuário navegue por outros meses.
  // Também refina o filtro de status via getFinanceDisplayStatus (display),
  // pois o servidor retorna um superconjunto (ex: "Pendente" inclui "Liberado").
  const visibleOsList = useMemo(() => {
    const expectedStatus = STATUS_FILTER_LABEL[statusFilter];
    return osList.filter((os) => {
      if (statusFilter !== "all" && getFinanceDisplayStatus(os) !== expectedStatus)
        return false;
      if (!defaultDataInicio || !defaultDataFim) return true;
      if (!os.data) return false;
      const dateKey = os.data.slice(0, 10);
      return dateKey >= defaultDataInicio && dateKey <= defaultDataFim;
    });
  }, [osList, statusFilter, defaultDataInicio, defaultDataFim]);

  useEffect(() => {
    setMonthTotals((prev) => {
      if (prev.get(currentMonth) === visibleOsList.length) return prev;
      const next = new Map(prev);
      next.set(currentMonth, visibleOsList.length);
      return next;
    });
  }, [currentMonth, visibleOsList.length]);

  // Resumo "Mês - selecionadas/total" cobrindo todos os meses com OS
  // selecionadas, mesmo que o usuário já tenha navegado para outro mês.
  const selectionSummaryByMonth = useMemo(() => {
    const counts = new Map<string, number>();
    for (const id of selectedIds) {
      const monthKey = itemMonthMap.get(id);
      if (!monthKey) continue;
      counts.set(monthKey, (counts.get(monthKey) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, selected]) => ({
        monthKey,
        label: monthKeyLabel(monthKey),
        selected,
        total: monthTotals.get(monthKey),
      }));
  }, [selectedIds, itemMonthMap, monthTotals]);

  const osByDate = useMemo(() => {
    const map = new Map<string, OrderService[]>();
    for (const os of visibleOsList) {
      if (!os.data) continue;
      const dateKey = os.data.slice(0, 10);
      const arr = map.get(dateKey) ?? [];
      arr.push(os);
      map.set(dateKey, arr);
    }
    return map;
  }, [visibleOsList]);

  const calendarCells = useMemo(
    () => buildCalendarCells(currentMonth),
    [currentMonth],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedValuesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const cache = selectedValuesRef.current;
    let changed = false;
    osList.forEach((item) => {
      if (cache.has(item.id)) {
        const valor = item.isentoValorBruto ? 0 : Number(item.valorBruto || 0);
        if (cache.get(item.id) !== valor) {
          cache.set(item.id, valor);
          changed = true;
        }
      }
    });
    if (changed && onSelectedTotalChange) {
      const total = Array.from(cache.values()).reduce((acc, v) => acc + v, 0);
      onSelectedTotalChange(total);
    }
  }, [osList, onSelectedTotalChange]);

  useEffect(() => {
    const cache = selectedValuesRef.current;
    for (const id of Array.from(cache.keys())) {
      if (!selectedSet.has(id)) cache.delete(id);
    }
    osList.forEach((item) => {
      if (selectedSet.has(item.id) && !cache.has(item.id)) {
        cache.set(item.id, item.isentoValorBruto ? 0 : Number(item.valorBruto || 0));
      }
    });
    if (onSelectedTotalChange) {
      const total = Array.from(cache.values()).reduce((acc, v) => acc + v, 0);
      onSelectedTotalChange(total);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  const toggleItem = useCallback(
    (id: string) => {
      const cache = selectedValuesRef.current;
      const item = visibleOsList.find((os) => os.id === id);
      if (selectedSet.has(id)) {
        cache.delete(id);
        onSelectionChange(selectedIds.filter((existing) => existing !== id));
      } else {
        if (item) {
          cache.set(id, item.isentoValorBruto ? 0 : Number(item.valorBruto || 0));
        }
        onSelectionChange([...selectedIds, id]);
      }
    },
    [selectedIds, selectedSet, onSelectionChange, visibleOsList],
  );

  const selectAllVisible = useCallback(() => {
    const cache = selectedValuesRef.current;
    const next = new Set(selectedIds);
    visibleOsList.forEach((item) => {
      next.add(item.id);
      cache.set(item.id, item.isentoValorBruto ? 0 : Number(item.valorBruto || 0));
    });
    onSelectionChange(Array.from(next));
  }, [selectedIds, visibleOsList, onSelectionChange]);

  const clearVisibleSelection = useCallback(() => {
    const cache = selectedValuesRef.current;
    const visibleIds = new Set(visibleOsList.map((item) => item.id));
    visibleIds.forEach((id) => cache.delete(id));
    onSelectionChange(selectedIds.filter((id) => !visibleIds.has(id)));
  }, [selectedIds, visibleOsList, onSelectionChange]);

  const clearAll = useCallback(() => {
    selectedValuesRef.current.clear();
    onSelectionChange([]);
  }, [onSelectionChange]);

  const visibleSelectedCount = useMemo(
    () => visibleOsList.filter((item) => selectedSet.has(item.id)).length,
    [visibleOsList, selectedSet],
  );

  const currentMonthLabel = monthKeyLabel(currentMonth);

  useEffect(() => {
    onMonthLabelChange?.(currentMonthLabel);
  }, [currentMonthLabel, onMonthLabelChange]);
  const brazilToday = useMemo(() => getBrazilDate(), []);
  const todayDateKey = useMemo(() => {
    const d = brazilToday;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [brazilToday]);

  return (
    <div className="flex h-full flex-col space-y-3">
      {/* Header: título + totais */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blue-50 px-5 py-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <Receipt size={20} className="text-blue-600" />
          {selectionSummaryByMonth.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {selectionSummaryByMonth.map((entry, idx) => (
                <span key={entry.monthKey} className="flex items-stretch gap-3 whitespace-nowrap">
                  {idx > 0 && (
                    <span className="w-px bg-blue-800/30 mx-1 -my-2" aria-hidden="true" />
                  )}
                  <p className="self-center text-base font-black uppercase tracking-widest text-slate-700 flex items-baseline gap-0.5">
                    {(() => {
                      const [m, y] = entry.label.split(' ');
                      return (
                        <>
                          {m}
                          <span className="text-[11px] font-bold text-slate-400 self-center">
                            {y}
                          </span>
                        </>
                      );
                    })()}
                  </p>
                  <span className="self-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-black tabular-nums tracking-widest text-emerald-700 ring-1 ring-emerald-200">
                    {(() => {
                      const allSelected = entry.total !== undefined && entry.selected === entry.total;
                      const selectedClass = allSelected
                        ? "font-black text-emerald-700"
                        : "font-semibold text-[rgb(87,160,114)]";
                      return (
                        <>
                          <span className={selectedClass}>{entry.selected}</span>
                          {entry.total !== undefined && (
                            <>
                              <span className="text-[rgb(120,202,152)]">/</span>
                              {entry.total}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-black tabular-nums tracking-widest text-emerald-700 ring-1 ring-emerald-200">
              <span className="font-semibold text-[rgb(87,160,114)]">0</span>
            </span>
          )}
        </div>
      </div>

      {/* Navegação de mês + Filtros + Busca + Ações em lote */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => shiftMonthKey(m, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 cursor-pointer"
            title="Mês anterior"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((option) => {
            const isActive = statusFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                aria-pressed={isActive}
                className={`rounded-xl border-2 px-3 py-1 text-xs font-black tracking-tight transition-all cursor-pointer ${
                  isActive
                    ? option.activeClass
                    : "border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50/50"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative group min-w-[200px] flex-1 sm:flex-initial">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar OS, protocolo..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-xs font-bold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
          <button
            type="button"
            onClick={selectAllVisible}
            disabled={loading || visibleOsList.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 transition-all hover:bg-emerald-100 hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <CheckCheck size={14} />
            Selecionar mês
          </button>
          <button
            type="button"
            onClick={clearVisibleSelection}
            disabled={loading || visibleSelectedCount === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <X size={14} />
            Limpar mês
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={selectedIds.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-red-600 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <Trash2 size={14} />
            Limpar tudo
          </button>
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => shiftMonthKey(m, 1))}
            className="ml-8 flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 cursor-pointer"
            title="Próximo mês"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Calendário */}
      <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 shrink-0">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-2 py-2 text-center text-xs font-black uppercase tracking-wider text-slate-600"
            >
              {label}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-xs font-bold text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            Carregando OS de {currentMonthLabel}...
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-xs font-bold text-red-500">
            <AlertCircle size={20} />
            {error}
          </div>
        ) : visibleOsList.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-300">
            <Receipt size={40} />
            <p className="text-xs font-bold text-slate-400">
              Nenhuma OS encontrada dentro do período selecionado em{" "}
              {currentMonthLabel}.
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-7 flex-1 min-h-0 overflow-y-auto custom-scrollbar"
            style={{ gridTemplateRows: "repeat(6, minmax(280px, 1fr))" }}
          >
            {calendarCells.map((cell, index) => {
              const dayOS = osByDate.get(cell.date) ?? [];
              const selectedInDay = dayOS.filter((os) =>
                selectedSet.has(os.id),
              ).length;
              const isToday = cell.date === todayDateKey;

              return (
                <div
                  key={cell.date}
                  className={`relative border-b border-r border-slate-100 p-2 flex flex-col overflow-hidden min-h-0 ${
                    cell.isCurrentMonth ? "bg-white" : "bg-slate-200/70"
                  } ${(index + 1) % 7 === 0 ? "border-r-0" : ""}`}
                >
                  {!cell.isCurrentMonth && (
                    <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[30deg] whitespace-nowrap text-[12px] font-black uppercase tracking-widest text-slate-300">
                      {MONTH_LABELS[Number(cell.date.slice(5, 7)) - 1]}
                    </span>
                  )}
                  <div className="mb-1.5 flex items-center justify-between shrink-0">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${
                        isToday
                          ? "bg-blue-600 text-white"
                          : cell.isCurrentMonth
                            ? "text-slate-700"
                            : "text-slate-400"
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    {selectedInDay > 0 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">
                        {selectedInDay} OS
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto custom-scrollbar">
                    {dayOS.map((os, idx) => {
                      const isSelected = selectedSet.has(os.id);
                      const status = getFinanceDisplayStatus(os);
                      const valor = Number(os.valorBruto || 0);
                      // Numeração crescente de cima pra baixo: primeiro card = 1
                      const cardNumber = idx + 1;
                      return (
                        <button
                          key={os.id}
                          type="button"
                          onClick={() => toggleItem(os.id)}
                          className={`group relative mr-[15px] w-[calc(100%-15px)] overflow-hidden rounded-xl border p-2 pl-[30px] text-left transition-all cursor-pointer ${
                            isSelected
                              ? "border-emerald-400 bg-emerald-50/90 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                          title={`${os.protocolo} · ${abbreviateMotorista(os.motorista)} · ${formatCurrency(valor)}`}
                        >
                          {/* Numeração no canto superior esquerdo */}
                          <span
                            className={`absolute left-[2px] top-[2px] flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black tabular-nums text-white shadow-sm ${
                              isSelected ? "bg-emerald-700" : "bg-slate-600"
                            }`}
                          >
                            {cardNumber}
                          </span>

                          {/* Tarja no canto superior direito quando selecionado */}
                          {isSelected && (
                            <div className="absolute -right-6 -top-6 h-12 w-12 rotate-45 bg-emerald-500 shadow-sm" />
                          )}

                          <p
                            className={`-mt-1 truncate text-xs font-black tracking-tight ${
                              isSelected ? "text-emerald-900" : "text-slate-800"
                            }`}
                          >
                            {os.protocolo}
                          </p>
                          <p className="truncate text-[11px] font-medium text-slate-500 mt-0.5">
                            {abbreviateMotorista(os.motorista)}
                          </p>
                          <div className="mt-1.5 flex items-center justify-between gap-1.5 -ml-[30px] -mr-2">
                            <span
                              className={`inline-flex items-center gap-0.5 rounded-full rounded-l-none border border-l-0 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-sm shadow-slate-400/30 ${statusStyle(status)}`}
                            >
                              {status}
                            </span>
                            <span
                              className={`mr-[5px] shrink-0 text-[11px] font-black ${
                                os.isentoValorBruto
                                  ? "text-slate-400"
                                  : "text-emerald-600"
                              }`}
                            >
                              {os.isentoValorBruto
                                ? "Isento"
                                : formatCurrency(valor)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
