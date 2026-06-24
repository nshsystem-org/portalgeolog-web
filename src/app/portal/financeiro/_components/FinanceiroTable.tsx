import {
  BadgeInfo,
  Building2,
  CalendarRange,
  CheckCircle2,
  Eye,
  FileUp,
  Link2,
  MoreVertical,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";
import type { MutableRefObject, ReactElement } from "react";
import { DataTable } from "@/components/ui/DataTable";
import type { OrderService } from "@/context/DataContext";
import { normalizeFinanceStatus } from "@/lib/financeiro";
import {
  getFinanceDisplayStatus,
  formatCurrency,
  formatDate,
  statusStyle,
  type FinanceActionTarget,
} from "../_lib/financeiro-page";

type FinanceiroTablePagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

type FinanceiroTableProps = {
  items: OrderService[];
  loading: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  pagination: FinanceiroTablePagination;
  customerMap: Map<string, string>;
  centerMap: Map<string, string>;
  driverMap: Map<string, string>;
  partnerMap: Map<string, string>;
  driverPartnerMap: Map<string, string>;
  actionMenuRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  openActionMenuId: string | null;
  onToggleActionMenu: (id: string) => void;
  onViewOS: (os: OrderService) => void | Promise<void>;
  onOpenAttachment: (target: FinanceActionTarget) => void | Promise<void>;
  onOpenFaturar: (os: OrderService) => void;
  onOpenRecebimento: (os: OrderService) => void;
};

export function FinanceiroTable({
  items,
  loading,
  searchTerm,
  onSearchChange,
  pagination,
  customerMap,
  centerMap,
  driverMap,
  partnerMap,
  driverPartnerMap,
  actionMenuRefs,
  openActionMenuId,
  onToggleActionMenu,
  onViewOS,
  onOpenAttachment,
  onOpenFaturar,
  onOpenRecebimento,
}: FinanceiroTableProps): ReactElement {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/40">
      <DataTable<OrderService>
        data={items}
        loading={loading}
        disableClientSearch
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        searchPlaceholder="Buscar por OS, protocolo, cliente ou motorista..."
        pagination={pagination}
        emptyMessage="Nenhuma transação financeira encontrada para este filtro."
        emptyIcon={<Wallet size={48} className="text-slate-200" />}
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
                    {centerMap.get(item.centroCustoId || "") ||
                      item.centroCustoId ||
                      "Geral"}
                  </span>
                </div>
              </div>
            ),
          },
          {
            key: "motorista",
            title: "Motorista / Repasse",
            render: (_value, item) => {
              const driverName = item.driverId
                ? driverMap.get(item.driverId)
                : undefined;
              const driverPartnerId =
                !item.isFreelance && item.driverId
                  ? driverPartnerMap.get(item.driverId)
                  : undefined;
              const partnerName = driverPartnerId
                ? partnerMap.get(driverPartnerId)
                : undefined;

              return (
                <div className="max-w-[200px] space-y-1">
                  <p className="truncate text-base font-bold text-slate-800">
                    {driverName || item.motorista || "Sem motorista"}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {item.isFreelance ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                        <Truck size={10} className="shrink-0" />
                        Freelance
                      </span>
                    ) : (
                      <>
                        <Truck size={12} className="shrink-0 text-slate-400" />
                        <span className="truncate text-slate-400">
                          {partnerName || "Autônomo / Interno"}
                        </span>
                      </>
                    )}
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
                  <p className="text-base font-black text-slate-800">
                    {formatCurrency(bruto)}
                  </p>
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
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.3em] ${
                        isLiberado
                          ? "border-blue-100 bg-gradient-to-r from-blue-100 via-cyan-100 to-emerald-100 bg-[length:200%_100%] animate-gradient text-blue-500 shadow-lg shadow-blue-400/60 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/80"
                          : statusStyle(displayStatus)
                      }`}
                    >
                      {isLiberado ? (
                        <Wallet size={12} className="text-blue-500" />
                      ) : (
                        <BadgeInfo size={12} />
                      )}
                      {displayStatus}
                    </span>
                    {attachment ? (
                      <button
                        type="button"
                        onClick={() => void onOpenAttachment({ os: item })}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100 cursor-pointer"
                        title="Ver comprovante"
                      >
                        <Link2 size={12} />
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {item.financeiroFaturadoEm ? (
                      <span>
                        Faturado: {formatDate(item.financeiroFaturadoEm)}
                      </span>
                    ) : null}
                    {item.financeiroRecebidoEm ? (
                      <span className="text-emerald-500">
                        Recebido: {formatDate(item.financeiroRecebidoEm)}
                      </span>
                    ) : null}
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
                  ref={(el) => {
                    if (el) {
                      actionMenuRefs.current[item.id] = el;
                    } else {
                      delete actionMenuRefs.current[item.id];
                    }
                  }}
                  className="relative ml-auto inline-block"
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleActionMenu(item.id);
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600 hover:shadow-md"
                    aria-label="Abrir ações"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {openActionMenuId === item.id ? (
                    <div className="absolute right-0 z-20 mt-2 w-56 rounded-3xl border border-slate-200 bg-white p-2.5 shadow-2xl shadow-slate-200/50">
                      <button
                        type="button"
                        onClick={() => {
                          onToggleActionMenu(item.id);
                          void onViewOS(item);
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Eye size={16} className="text-slate-500" />
                        Visualizar OS
                      </button>
                      {canFaturar ? (
                        <button
                          type="button"
                          onClick={() => {
                            onToggleActionMenu(item.id);
                            onOpenFaturar(item);
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50"
                        >
                          <FileUp size={16} className="text-blue-600" />
                          Faturar OS
                        </button>
                      ) : null}
                      {canBaixar ? (
                        <button
                          type="button"
                          onClick={() => {
                            onToggleActionMenu(item.id);
                            onOpenRecebimento(item);
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
                        >
                          <CheckCircle2
                            size={16}
                            className="text-emerald-600"
                          />
                          Confirmar Recebimento
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            },
          },
        ]}
      />
    </div>
  );
}
