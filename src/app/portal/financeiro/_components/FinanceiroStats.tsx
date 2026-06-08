import {
  CheckCircle2,
  Handshake,
  ReceiptText,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import type { FinanceOverview } from "../_lib/financeiro-page";
import { formatCurrency } from "../_lib/financeiro-page";

type FinanceCardTone =
  | "blue"
  | "emerald"
  | "amber"
  | "slate"
  | "light-blue"
  | "purple"
  | "orange";

type FinanceCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  tone: FinanceCardTone;
  valueColor?: string;
};

type FinanceiroStatsProps = {
  stats: FinanceOverview;
  showMotorista: boolean;
};

function FinanceCard({
  title,
  value,
  subtitle,
  icon,
  tone,
  valueColor,
}: FinanceCardProps): ReactElement {
  const toneMap: Record<FinanceCardTone, string> = {
    blue: "bg-blue-50/80 border-blue-100 text-blue-600 shadow-blue-100/50",
    "light-blue":
      "bg-blue-50/40 border-blue-200 text-blue-400 shadow-blue-50/30",
    emerald: "bg-teal-50/80 border-teal-100 text-teal-500 shadow-teal-100/50",
    amber: "bg-amber-50/80 border-amber-100 text-amber-600 shadow-amber-100/50",
    slate: "bg-slate-50/80 border-slate-200 text-slate-600 shadow-slate-100/50",
    purple:
      "bg-purple-50/80 border-purple-100 text-purple-600 shadow-purple-100/50",
    orange:
      "bg-orange-50/80 border-orange-100 text-orange-600 shadow-orange-100/50",
  };

  const titleColorMap: Record<FinanceCardTone, string> = {
    blue: "text-blue-900",
    "light-blue": "text-blue-400",
    emerald: "text-teal-500",
    amber: "text-[rgb(135,138,28)]",
    slate: "text-slate-800",
    purple: "text-purple-900",
    orange: "text-orange-900",
  };

  const valueColorMap: Record<FinanceCardTone, string> = {
    blue: "text-blue-950",
    "light-blue": "text-blue-600",
    emerald: "text-teal-600",
    amber: "text-[rgb(100,102,20)]",
    slate: "text-slate-900",
    purple: "text-purple-950",
    orange: "text-orange-950",
  };

  const isLiberado = title === "Liberado";
  const isFaturado = title === "Faturado";
  const isRecebido = title === "Recebido";

  const iconDivClass = (() => {
    if (isLiberado) {
      return "inline-flex items-center gap-2 rounded-full border border-blue-300 bg-gradient-to-r from-blue-300 via-cyan-300 to-emerald-300 bg-[length:200%_100%] animate-gradient shadow-lg shadow-blue-400/60 hover:shadow-2xl hover:shadow-cyan-500/80 hover:scale-105 transition-all duration-300";
    }
    if (isFaturado) {
      return "inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-gradient-to-r from-yellow-100 via-yellow-200 to-yellow-300 bg-[length:200%_100%] animate-gradient shadow-md shadow-yellow-300/50 hover:shadow-xl hover:shadow-yellow-400/70 hover:scale-105 transition-all duration-300";
    }
    if (isRecebido) {
      return "inline-flex items-center gap-2 rounded-full border border-teal-200 bg-gradient-to-r from-teal-100 via-teal-200 to-teal-300 bg-[length:200%_100%] animate-gradient shadow-lg shadow-teal-300/60 hover:shadow-2xl hover:shadow-teal-400/80 hover:scale-105 transition-all duration-300";
    }
    return toneMap[tone];
  })();

  const iconColorClass = (() => {
    if (isFaturado) return "text-[rgb(135,138,28)]";
    if (isRecebido) return "text-teal-500";
    return "";
  })();

  const actualValueColor = valueColor || valueColorMap[tone];

  return (
    <div className="flex items-start gap-5 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-200/50">
      <div className={`rounded-2xl border p-4 shadow-sm ${iconDivClass}`}>
        <div className={`[&>svg]:h-7 [&>svg]:w-7 ${iconColorClass}`}>
          {icon}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`mb-1.5 truncate text-[11px] font-black uppercase tracking-[0.2em] ${titleColorMap[tone]}`}
        >
          {title}
        </p>
        <h3
          className={`truncate text-2xl font-black tracking-tighter tabular-nums ${actualValueColor}`}
        >
          {value}
        </h3>
        <p className="mt-2 truncate text-xs font-medium text-slate-400">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export function FinanceiroStats({
  stats,
  showMotorista,
}: FinanceiroStatsProps): ReactElement {
  const baseCards: FinanceCardProps[] = [
    {
      title: "Liberado",
      value: formatCurrency(stats.totalLiberadoFaturamento),
      subtitle: "Já podem ser faturados",
      icon: <Wallet size={28} className="text-blue-700" />,
      tone: "light-blue",
    },
    {
      title: "Faturado",
      value: formatCurrency(stats.totalFaturado),
      subtitle: "Aguardando recebimento",
      icon: <ReceiptText size={28} className="text-[rgb(135,138,28)]" />,
      tone: "amber",
    },
    {
      title: "Recebido",
      value: formatCurrency(stats.totalRecebido),
      subtitle: "Valores recebidos em conta",
      icon: <CheckCircle2 size={28} className="text-teal-500" />,
      tone: "emerald",
    },
  ];

  const calculoTotalCard: FinanceCardProps = {
    title: "CÁLCULO TOTAL",
    value: formatCurrency(stats.totalBruto),
    subtitle: "Valor total de todas as OS",
    icon: <TrendingUp size={28} className="text-blue-700" />,
    tone: "blue",
  };

  const repasseMotoristaCard: FinanceCardProps = {
    title: "Repasse Autônomos",
    value: formatCurrency(stats.totalCustoAutonomos),
    subtitle: "Precisam ser repassados",
    icon: <User size={28} className="text-orange-500" />,
    tone: "slate",
  };

  const pagoAutonomosCard: FinanceCardProps = {
    title: "Pagos Autônomos",
    value: formatCurrency(stats.totalPagoAutonomos),
    subtitle: "Já repassados",
    icon: <User size={28} className="text-slate-600" />,
    tone: "slate",
    valueColor: "text-emerald-600",
  };

  const repasseParceirosCard: FinanceCardProps = {
    title: "Repasse Parceiros",
    value: formatCurrency(stats.totalCustoParceiros),
    subtitle: "Precisam ser repassados",
    icon: <Handshake size={28} className="text-teal-500" />,
    tone: "slate",
  };

  const pagoParceirosCard: FinanceCardProps = {
    title: "Pagos Parceiros",
    value: formatCurrency(stats.totalPagoParceiros),
    subtitle: "Já repassados",
    icon: <Handshake size={28} className="text-slate-600" />,
    tone: "slate",
    valueColor: "text-emerald-600",
  };

  const statsCards = [calculoTotalCard, ...baseCards];

  return (
    <>
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((card) => (
          <FinanceCard key={card.title} {...card} />
        ))}
      </section>

      {showMotorista ? (
        <>
          <div className="flex items-center gap-4 py-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
            <span className="text-sm font-black uppercase tracking-[0.3em] text-slate-500">
              Motoristas
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
          </div>

          <section className="relative grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <FinanceCard {...repasseMotoristaCard} />
              <div className="absolute top-1/2 left-full z-10 hidden h-px w-5 -translate-y-1/2 bg-slate-300 md:block">
                <div className="absolute left-0 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-400 shadow-sm" />
                <div className="absolute right-0 top-1/2 h-2 w-2 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-400 shadow-sm" />
              </div>
            </div>
            <div className="relative">
              <FinanceCard {...pagoAutonomosCard} />
            </div>
            <div className="relative">
              <FinanceCard {...repasseParceirosCard} />
              <div className="absolute top-1/2 left-full z-10 hidden h-px w-5 -translate-y-1/2 bg-slate-300 md:block">
                <div className="absolute left-0 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-400 shadow-sm" />
                <div className="absolute right-0 top-1/2 h-2 w-2 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-400 shadow-sm" />
              </div>
            </div>
            <div className="relative">
              <FinanceCard {...pagoParceirosCard} />
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
