import {
  ArrowDownCircle,
  ArrowUpCircle,
  Layers,
  PiggyBank,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { ReactElement, ReactNode } from "react";
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.saldosPorConta.map((conta) => (
              <div
                key={conta.contaId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">
                    {conta.contaNome}
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    {labelTipoConta(conta.contaTipo)}
                  </p>
                </div>
                <div
                  className={`flex items-center gap-1.5 font-black tabular-nums ${conta.saldo >= 0 ? "text-teal-700" : "text-rose-600"}`}
                >
                  <PiggyBank size={16} />
                  {formatCurrency(conta.saldo)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
