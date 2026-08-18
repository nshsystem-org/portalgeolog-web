import {
  ArrowDownCircle,
  ArrowUpCircle,
  Layers,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { BankLogo, getBankBrand } from "@/components/ui/BankLogo";
import {
  formatCurrency,
  labelTipoConta,
  type CaixaOverview,
} from "../_lib/caixa-page";

type CaixaCardTone = "blue" | "emerald" | "rose" | "slate" | "orange";

type CaixaCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  tone: CaixaCardTone;
  largeValue?: boolean;
};

const toneMap: Record<CaixaCardTone, string> = {
  blue: "bg-blue-50/80 border-blue-100 text-blue-600 shadow-blue-100/50",
  emerald: "bg-teal-50/80 border-teal-100 text-teal-500 shadow-teal-100/50",
  rose: "bg-rose-50/80 border-rose-100 text-rose-500 shadow-rose-100/50",
  slate: "bg-slate-50/80 border-slate-200 text-slate-600 shadow-slate-100/50",
  orange:
    "bg-orange-50/80 border-orange-100 text-orange-600 shadow-orange-100/50",
};

const titleColorMap: Record<CaixaCardTone, string> = {
  blue: "text-blue-900",
  emerald: "text-teal-600",
  rose: "text-rose-600",
  slate: "text-slate-800",
  orange: "text-orange-900",
};

const valueColorMap: Record<CaixaCardTone, string> = {
  blue: "text-blue-950",
  emerald: "text-teal-700",
  rose: "text-rose-700",
  slate: "text-slate-900",
  orange: "text-orange-950",
};

function CaixaCard({
  title,
  value,
  subtitle,
  icon,
  tone,
  largeValue,
}: CaixaCardProps): ReactElement {
  return (
    <div className="flex items-start gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 px-7 shadow-xl shadow-slate-200/40 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-200/50">
      <div className={`rounded-2xl border p-3 shadow-sm ${toneMap[tone]}`}>
        <div className="[&>svg]:h-6 [&>svg]:w-6">{icon}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`mb-1 truncate text-[11px] font-black uppercase tracking-[0.18em] ${titleColorMap[tone]}`}
        >
          {title}
        </p>
        <h3
          className={`truncate font-black tracking-wide tabular-nums ${largeValue ? "text-2xl" : "text-xl"} ${valueColorMap[tone]}`}
        >
          {value}
        </h3>
        <p className="mt-1.5 truncate text-xs font-medium text-slate-400">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

type CaixaStatsProps = {
  stats: CaixaOverview;
};

export function CaixaStats({ stats }: CaixaStatsProps): ReactElement {
  const cards: CaixaCardProps[] = [
    {
      title: "Saldo Consolidado",
      value: formatCurrency(stats.saldoConsolidado),
      subtitle: "Soma de todas as contas ativas",
      icon: <Wallet size={22} className="text-blue-700" />,
      tone: "blue",
      largeValue: true,
    },
    {
      title: "Entradas",
      value: formatCurrency(stats.totalEntradas),
      subtitle: "Recebimentos no período",
      icon: <ArrowUpCircle size={22} className="text-teal-600" />,
      tone: "emerald",
      largeValue: true,
    },
    {
      title: "Saídas",
      value: formatCurrency(stats.totalSaidas),
      subtitle: "Pagamentos no período",
      icon: <ArrowDownCircle size={22} className="text-rose-500" />,
      tone: "rose",
      largeValue: true,
    },
    {
      title: "Saldo do Período",
      value: formatCurrency(stats.saldoPeriodo),
      subtitle: `${stats.totalLancamentos} lançamento(s)`,
      icon: <TrendingUp size={22} className="text-slate-600" />,
      tone: stats.saldoPeriodo >= 0 ? "slate" : "rose",
      largeValue: true,
    },
  ];

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <CaixaCard key={card.title} {...card} />
        ))}
      </div>

      {stats.saldosPorConta.length > 0 ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40">
          <div className="mb-4 flex items-center gap-2">
            <Layers size={18} className="text-slate-500" />
            <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
              Saldo por Conta
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.saldosPorConta.map((conta) => {
              const brand = getBankBrand(
                conta.contaNome,
                undefined,
                undefined,
                conta.contaTipo,
              );
              const saldoPositivo = conta.saldo >= 0;

              return (
                <div
                  key={conta.contaId}
                  className="group relative flex items-center justify-between gap-3.5 rounded-2xl border p-4 xl:p-5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01] hover:shadow-xl overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${hexToRgba(brand.color, 0.06)} 0%, #ffffff 60%, ${hexToRgba(brand.color, 0.04)} 100%)`,
                    borderColor: hexToRgba(brand.color, 0.25),
                  }}
                >
                  {/* Faixa lateral animada */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-300 group-hover:w-2 group-hover:opacity-80"
                    style={{ backgroundColor: brand.color }}
                  />

                  {/* Brilho de movimentação no hover */}
                  <div
                    className="absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-0 group-hover:opacity-20 blur-3xl transition-all duration-500 group-hover:translate-x-2 group-hover:translate-y-2"
                    style={{ backgroundColor: brand.color }}
                  />

                  <div className="relative flex items-center gap-3.5 min-w-0 flex-1 pl-2">
                    <BankLogo
                      name={conta.contaNome}
                      type={conta.contaTipo}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-black text-slate-800 group-hover:text-[#020817] transition-colors">
                        {conta.contaNome}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider transition-colors duration-300"
                          style={{
                            backgroundColor: hexToRgba(brand.color, 0.12),
                            borderColor: hexToRgba(brand.color, 0.25),
                            color: brand.color,
                          }}
                        >
                          {labelTipoConta(conta.contaTipo)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="relative flex flex-col items-end shrink-0 pl-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                      Saldo
                    </span>
                    <div
                      className="flex items-center gap-1.5 text-base xl:text-lg font-black tabular-nums tracking-tight transition-colors duration-300"
                      style={{
                        color: saldoPositivo ? "#047857" : "#DC2626",
                      }}
                    >
                      <span className="inline-block transition-transform duration-300 group-hover:scale-110">
                        {saldoPositivo ? "+" : ""}
                      </span>
                      {formatCurrency(conta.saldo)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2) || "00", 16);
  const g = parseInt(clean.substring(2, 4) || "00", 16);
  const b = parseInt(clean.substring(4, 6) || "00", 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
