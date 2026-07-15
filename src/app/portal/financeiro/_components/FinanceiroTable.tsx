import {
  BadgeInfo,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileUp,
  HandCoins,
  Handshake,
  Link2,
  MoreVertical,
  Percent,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { MutableRefObject, ReactElement } from "react";
import { useState } from "react";
import { DataTable } from "@/components/ui/DataTable";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import type { Driver, OrderService } from "@/context/DataContext";
import {
  normalizeFinanceStatus,
  parseHoraExtraMinutes,
  calcHoraExtraCliente,
  calcHoraExtraMotorista,
} from "@/lib/financeiro";
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

function ValorCell({ item }: { item: OrderService }): ReactElement {
  const [expanded, setExpanded] = useState(false);

  const brutoBase = Number(item.valorBruto || 0);
  const custoBase = Number(item.custo || 0);
  const imposto = Number(item.imposto || 0);
  const lucro = Number(item.lucro || 0);
  const heMin = parseHoraExtraMinutes(item.horaExtra);
  const heCliente = calcHoraExtraCliente(heMin);
  const heMotorista = calcHoraExtraMotorista(heMin);
  const noShowFator = item.noShow
    ? (item.noShowPercentual ?? 100) / 100
    : 1;
  const bruto = item.noShow
    ? (brutoBase + heCliente) * noShowFator
    : brutoBase + heCliente;
  const custo = item.noShow
    ? (custoBase + heMotorista) * noShowFator
    : custoBase + heMotorista;
  const isentoVB = Boolean(item.isentoValorBruto);
  const isentoCusto = Boolean(item.isentoCusto);

  return (
    <div className="pr-6 text-right">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="group inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 transition-colors hover:bg-slate-50 cursor-pointer"
      >
        <span className={`text-base font-black ${isentoVB ? "text-slate-400" : "text-emerald-600"}`}>
          {isentoVB ? "Isento" : formatCurrency(bruto)}
        </span>
        <ChevronRight
          size={14}
          className={`shrink-0 text-blue-600 opacity-0 transition-all duration-200 group-hover:opacity-100 ${
            expanded ? "rotate-[-90deg]" : "rotate-90"
          }`}
        />
      </button>
      {expanded ? (
        <div className="mt-1.5 flex flex-col items-end gap-0.5 text-[11px] font-medium animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="flex items-center justify-end gap-1">
            <TrendingUp size={11} className="shrink-0 text-emerald-500" />
            <span className="text-slate-400">Lucro</span>
            <span className="font-bold text-emerald-600">
              {formatCurrency(lucro)}
            </span>
          </span>
          <span className="flex items-center justify-end gap-1">
            <TrendingDown size={11} className="shrink-0 text-red-400" />
            <span className="text-slate-400">Repasse</span>
            <span className={`font-bold ${isentoCusto ? "text-slate-400" : "text-red-500"}`}>
              {isentoCusto ? "Isento" : formatCurrency(custo)}
            </span>
          </span>
          <span className="flex items-center justify-end gap-1">
            <Percent size={11} className="shrink-0 text-amber-500" />
            <span className="text-slate-400">Imposto</span>
            <span className="font-bold text-amber-600">
              {formatCurrency(imposto)}
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

type FinanceiroTableProps = {
  items: OrderService[];
  loading: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  pagination: FinanceiroTablePagination;
  drivers: Driver[];
  driverId: string;
  onDriverChange: (value: string) => void;
  driverTipoFilter: string;
  onDriverTipoChange: (value: string) => void;
  pendingRepasseValue: number;
  repassePeriodStart?: string;
  repassePeriodEnd?: string;
  statsLoading: boolean;
  onOpenRepasseLote: () => void;
  customerMap: Map<string, string>;
  centerMap: Map<string, string>;
  driverMap: Map<string, string>;
  partnerMap: Map<string, string>;
  driverPartnerMap: Map<string, string>;
  driverVinculoMap: Map<string, string>;
  actionMenuRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  openActionMenuId: string | null;
  onToggleActionMenu: (id: string) => void;
  onViewOS: (os: OrderService) => void | Promise<void>;
  onOpenAttachment: (target: FinanceActionTarget) => void | Promise<void>;
  onOpenFaturar: (os: OrderService) => void;
  onOpenRecebimento: (os: OrderService) => void;
  onOpenRepasse: (os: OrderService) => void;
};

export function FinanceiroTable({
  items,
  loading,
  searchTerm,
  onSearchChange,
  pagination,
  drivers,
  driverId,
  onDriverChange,
  driverTipoFilter,
  onDriverTipoChange,
  pendingRepasseValue,
  repassePeriodStart,
  repassePeriodEnd,
  statsLoading,
  onOpenRepasseLote,
  customerMap,
  centerMap,
  driverMap,
  partnerMap,
  driverPartnerMap,
  driverVinculoMap,
  actionMenuRefs,
  openActionMenuId,
  onToggleActionMenu,
  onViewOS,
  onOpenAttachment,
  onOpenFaturar,
  onOpenRecebimento,
  onOpenRepasse,
}: FinanceiroTableProps): ReactElement {
  // key = driverId+value at dismiss time; banner reappears if driver or value changes
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const bannerKey = `${driverId}:${pendingRepasseValue}`;
  const bannerDismissed = dismissedKey === bannerKey;

  const formatShortName = (fullName: string) => {
    const parts = fullName.split(" ").filter(Boolean);
    if (parts.length <= 2) return fullName;
    return `${parts[0]} ${parts[1]}`;
  };

  const driverOptions = [
    { id: "", nome: "Todos os Motoristas" },
    ...drivers
      .filter((d) => d.status !== "inactive")
      .filter((d) => !driverTipoFilter || d.vinculo_tipo === driverTipoFilter)
      .map((d) => ({
        id: d.id,
        nome: formatShortName(d.name),
        photoUrl: d.avatar_url,
      })),
  ];

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
        showHeader={false}
        actionButton={
          <div className="flex shrink-0 items-center gap-2">
            <div className="w-[180px]">
              <GeologSearchableSelect
                options={[
                  { id: "", nome: "Todos", icon: <Users size={15} className="text-slate-400" /> },
                  { id: "interno", nome: "Internos", icon: <Briefcase size={15} className="text-blue-500" /> },
                  { id: "autonomo", nome: "Autônomos", icon: <Truck size={15} className="text-amber-500" /> },
                  { id: "parceiro", nome: "Parceiros", icon: <Handshake size={15} className="text-teal-500" /> },
                ]}
                value={driverTipoFilter}
                onChange={(value) => {
                  onDriverTipoChange(value);
                  onDriverChange("");
                }}
                disableSearch
                compact
                triggerClassName="!px-4 !py-2 text-sm w-full !rounded-2xl !border !h-[46px] !items-center"
                placeholder="Tipo"
                dropdownPosition="down"
              />
            </div>
            <div className="w-[280px]">
              <GeologSearchableSelect
                options={driverOptions}
                value={driverId}
                onChange={onDriverChange}
                onClear={() => onDriverChange("")}
                disableSearch={false}
                compact
                triggerClassName="!px-4 !py-2 text-sm w-full !rounded-2xl !border !h-[46px] !items-center"
                placeholder="Todos os Motoristas"
                dropdownPosition="down"
              />
            </div>
          </div>
        }
        headerContent={
          driverId && !statsLoading && pendingRepasseValue > 0 && !bannerDismissed ? (
            <div className="mx-2 mb-2 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-100 p-2">
                  <HandCoins size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-black tracking-tight">
                    <span className="text-emerald-700">
                      {formatCurrency(pendingRepasseValue)}
                    </span>{" "}
                    <span style={{ color: "rgba(116, 90, 74, 1)" }}>
                      em repasses pendentes
                      {repassePeriodStart && repassePeriodEnd
                        ? (() => {
                            const fmt = (iso: string) => {
                              const [y, m, d] = iso.split("-");
                              return `${d}/${m}/${y}`;
                            };
                            return (
                              <>
                                {" de "}
                                <strong style={{ color: "rgb(180, 83, 9)" }}>{fmt(repassePeriodStart)}</strong>
                                {" á "}
                                <strong style={{ color: "rgb(180, 83, 9)" }}>{fmt(repassePeriodEnd)}</strong>
                              </>
                            );
                          })()
                        : null}
                    </span>
                  </p>
                  <p
                    className="text-xs font-medium"
                    style={{ color: "rgb(169, 138, 107)" }}
                  >
                    Marque todas as OS deste período como pagas de uma vez
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenRepasseLote}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-emerald-100 transition-all hover:bg-emerald-700 active:scale-95 cursor-pointer"
                >
                  <HandCoins size={14} />
                  Marcar todas como Pagas
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedKey(bannerKey)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-amber-200 bg-amber-100 text-amber-500 transition-colors hover:bg-amber-200 hover:text-amber-700 cursor-pointer"
                  aria-label="Fechar aviso"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : null
        }
        columns={[
          {
            key: "documento",
            title: "Protocolo",
            render: (_value, item) => (
              <div className="space-y-1">
                <p className="font-black text-base text-slate-800 tracking-tight">
                  {item.protocolo}
                </p>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "rgb(97, 130, 209)" }}
                >
                  {formatDate(item.data)}
                  {item.hora && (
                    <span className="ml-1 text-slate-500">
                      · {item.hora.slice(0, 5)}
                    </span>
                  )}
                </p>
              </div>
            ),
          },
          {
            key: "cliente",
            title: "Cliente / Centro de custo",
            render: (_value, item) => (
              <div className="max-w-[280px] space-y-1">
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
                item.tipo !== "freelance" && item.driverId
                  ? driverPartnerMap.get(item.driverId)
                  : undefined;
              const partnerName = driverPartnerId
                ? partnerMap.get(driverPartnerId)
                : undefined;

              const isFreelanceRow = item.tipo === "freelance";
              const rowDriverVinculo = item.driverId
                ? driverVinculoMap.get(item.driverId)
                : undefined;
              const isAutonomoRow = rowDriverVinculo === "autonomo";
              const isParceiroRow = rowDriverVinculo === "parceiro";
              const showRepasse = isFreelanceRow || isAutonomoRow || isParceiroRow;

              return (
                <div className="max-w-[240px] space-y-1">
                  <p className="truncate text-base font-bold text-slate-800">
                    {driverName || item.motorista || "Sem motorista"}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {isFreelanceRow ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                        <Truck size={10} className="shrink-0" />
                        Freelance
                      </span>
                    ) : (
                      <>
                        <Truck size={12} className="shrink-0 text-slate-400" />
                        <span className="truncate text-slate-400">
                          {partnerName ||
                            (isAutonomoRow
                              ? "Autônomo"
                              : "Interno")}
                        </span>
                      </>
                    )}
                  </div>
                  {showRepasse ? (
                    item.repassePago ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                        <CheckCircle2 size={10} className="shrink-0" />
                        Pago
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-600">
                        <HandCoins size={10} className="shrink-0" />
                        Pendente
                      </span>
                    )
                  ) : null}
                </div>
              );
            },
          },
          {
            key: "valores",
            title: "Valores",
            align: "right",
            render: (_value, item) => <ValorCell item={item} />,
          },
          {
            key: "financeiro",
            title: "Status",
            render: (_value, item) => {
              const displayStatus = getFinanceDisplayStatus(item);
              const attachment = item.financeiroAnexos?.[0];
              const isLiberado = displayStatus === "Liberado";

              return (
                <div className="min-w-[90px] space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.3em] ${
                        isLiberado
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : statusStyle(displayStatus)
                      }`}
                    >
                      {isLiberado ? (
                        <Wallet size={12} className="text-blue-600" />
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
              const isFreelance = item.tipo === "freelance";
              const driverVinculo = item.driverId
                ? driverVinculoMap.get(item.driverId)
                : undefined;
              const isAutonomo = driverVinculo === "autonomo";
              const isParceiro = driverVinculo === "parceiro";
              const canRegistrarRepasse =
                !item.repassePago && (isFreelance || isAutonomo || isParceiro);

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
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 hover:shadow-md cursor-pointer"
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
                        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
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
                          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer"
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
                          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 cursor-pointer"
                        >
                          <CheckCircle2
                            size={16}
                            className="text-emerald-600"
                          />
                          Confirmar Recebimento
                        </button>
                      ) : null}
                      {canRegistrarRepasse ? (
                        <button
                          type="button"
                          onClick={() => {
                            onToggleActionMenu(item.id);
                            onOpenRepasse(item);
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 cursor-pointer"
                        >
                          <HandCoins size={16} className="text-emerald-600" />
                          Registrar Repasse
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
