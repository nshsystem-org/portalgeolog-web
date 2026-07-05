import {
  CheckCircle2,
  ClipboardList,
  HandCoins,
  ReceiptText,
  TrendingUp,
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
  titleColor?: string;
  valueColor?: string;
  iconColor?: string;
  largeValue?: boolean;
};

type FinanceiroStatsProps = {
  stats: FinanceOverview;
  driverId: string;
};

function FinanceCard({
  title,
  value,
  subtitle,
  icon,
  tone,
  titleColor,
  valueColor,
  iconColor,
  largeValue,
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
    if (iconColor) return iconColor;
    if (isFaturado) return "text-[rgb(135,138,28)]";
    if (isRecebido) return "text-teal-500";
    return "";
  })();

  const actualTitleColor = titleColor || titleColorMap[tone];
  const actualValueColor = valueColor || valueColorMap[tone];

  return (
    <div className="flex items-start gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 px-7 shadow-xl shadow-slate-200/40 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-200/50">
      <div className={`rounded-2xl border p-3 shadow-sm ${iconDivClass}`}>
        <div className={`[&>svg]:h-6 [&>svg]:w-6 ${iconColorClass}`}>
          {icon}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`mb-1 truncate text-[11px] font-black uppercase tracking-[0.18em] ${actualTitleColor}`}
        >
          {title}
        </p>
        <h3
          className={`truncate font-black tracking-wide tabular-nums ${largeValue ? "text-2xl" : "text-xl"} ${actualValueColor}`}
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

export function FinanceiroStats({
  stats,
  driverId,
}: FinanceiroStatsProps): ReactElement {
  const baseCards: FinanceCardProps[] = [
    {
      title: "Liberado",
      value: formatCurrency(stats.totalLiberadoFaturamento),
      subtitle: "Já podem ser faturados",
      icon: <Wallet size={22} className="text-blue-700" />,
      tone: "light-blue",
      largeValue: true,
    },
    {
      title: "Faturado",
      value: formatCurrency(stats.totalFaturado),
      subtitle: "Aguardando recebimento",
      icon: <ReceiptText size={22} className="text-[rgb(135,138,28)]" />,
      tone: "amber",
      largeValue: true,
    },
    {
      title: "Recebido",
      value: formatCurrency(stats.totalRecebido),
      subtitle: "Valores recebidos em conta",
      icon: <CheckCircle2 size={22} className="text-teal-500" />,
      tone: "emerald",
      largeValue: true,
    },
  ];

  const calculoTotalCard: FinanceCardProps = {
    title: "CÁLCULO TOTAL",
    value: formatCurrency(stats.totalBruto),
    subtitle: "Valor total de todas as OS",
    icon: <TrendingUp size={22} className="text-blue-700" />,
    tone: "blue",
    largeValue: true,
  };

  // Cards focados no motorista (Option A)
  const totalRepasse =
    stats.totalCustoAutonomos + stats.totalCustoParceiros;
  const totalPago = stats.totalPagoAutonomos + stats.totalPagoParceiros;
  const aReceber = totalRepasse - totalPago;

  const motoristaCards: FinanceCardProps[] = [
    {
      title: "Total de Serviços",
      value: String(stats.totalOS),
      subtitle: "OS no período filtrado",
      icon: <ClipboardList size={22} className="text-blue-700" />,
      tone: "blue",
    },
    {
      title: "Valor Cliente",
      value: formatCurrency(stats.totalBruto),
      subtitle: "Total faturado ao cliente",
      icon: <TrendingUp size={22} className="text-blue-700" />,
      tone: "light-blue",
    },
    {
      title: "Valor Motorista",
      value: formatCurrency(totalRepasse),
      subtitle: "Repassar ao motorista",
      icon: <Wallet size={22} className="text-[rgb(105,49,153)]" />,
      tone: "purple",
      titleColor: "text-[rgb(176,154,193)]",
      valueColor: "text-[rgb(100,40,151)]",
      iconColor: "text-[rgb(105,49,153)]",
    },
    {
      title: "Pago",
      value: formatCurrency(totalPago),
      subtitle: "Valor já quitado",
      icon: <CheckCircle2 size={22} className="text-teal-500" />,
      tone: "emerald",
    },
    {
      title: "Pendente",
      value: formatCurrency(aReceber),
      subtitle: "Falta pagar",
      icon: <HandCoins size={22} className="text-[rgb(179,127,81)]" />,
      tone: "amber",
      titleColor: "text-[rgb(230,194,163)]",
      valueColor: "text-[rgb(179,127,81)]",
    },
  ];

  const statsCards = driverId
    ? motoristaCards
    : [calculoTotalCard, ...baseCards];

  return (
    <section
      className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${
        driverId ? "lg:grid-cols-5" : "lg:grid-cols-4"
      }`}
    >
      {statsCards.map((card) => (
        <FinanceCard key={card.title} {...card} />
      ))}
    </section>
  );
}
