import type { ReactElement } from "react";

type BankMeta = {
  color: string;
  textColor: string;
  label: ReactElement | string;
  rounded?: string;
};

interface BankLogoProps {
  name?: string;
  sigla?: string | null;
  color?: string | null;
  type?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const bankMetaByName: Record<string, BankMeta> = {
  itaú: {
    color: "#FF8200",
    textColor: "#FFFFFF",
    label: "itaú",
  },
  itau: {
    color: "#FF8200",
    textColor: "#FFFFFF",
    label: "itaú",
  },
  bradesco: {
    color: "#CC092F",
    textColor: "#FFFFFF",
    label: (
      <svg viewBox="0 0 40 40" fill="none" className="w-[55%] h-[55%]">
        <circle cx="20" cy="14" r="3.5" fill="currentColor" />
        <path
          d="M13 28C13 23 16 19 20 15C23 19 25 22 25 26C25 29 23 30 20 30C17 30 15 29 15 26Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  "banco do brasil": {
    color: "#FCDB00",
    textColor: "#003882",
    label: "BB",
  },
  brasil: {
    color: "#FCDB00",
    textColor: "#003882",
    label: "BB",
  },
  santander: {
    color: "#EC0000",
    textColor: "#FFFFFF",
    label: "S",
  },
  nubank: {
    color: "#820AD1",
    textColor: "#FFFFFF",
    label: "nu",
  },
  caixa: {
    color: "#005CA9",
    textColor: "#FFFFFF",
    label: "C",
  },
  cef: {
    color: "#005CA9",
    textColor: "#FFFFFF",
    label: "C",
  },
  "caixa econômica": {
    color: "#005CA9",
    textColor: "#FFFFFF",
    label: "C",
  },
  inter: {
    color: "#FF7A00",
    textColor: "#FFFFFF",
    label: "inter",
  },
  sicoob: {
    color: "#003641",
    textColor: "#00AE9D",
    label: "sicoob",
  },
  sicredi: {
    color: "#007A33",
    textColor: "#FFFFFF",
    label: "sicredi",
  },
  c6: {
    color: "#242424",
    textColor: "#FFFFFF",
    label: "C6",
  },
  "mercado pago": {
    color: "#009EE3",
    textColor: "#FFFFFF",
    label: "MP",
  },
  mercado: {
    color: "#009EE3",
    textColor: "#FFFFFF",
    label: "MP",
  },
  original: {
    color: "#6324A0",
    textColor: "#FFFFFF",
    label: "O",
  },
  banrisul: {
    color: "#005CA9",
    textColor: "#FFFFFF",
    label: "BR",
  },
  next: {
    color: "#212121",
    textColor: "#FFFFFF",
    label: "next",
  },
};

export interface BankBrand {
  color: string;
  textColor: string;
  label: ReactElement | string;
}

const typeFallback: Record<string, BankBrand> = {
  caixa: { color: "#14B8A6", textColor: "#FFFFFF", label: "CX" },
  carteira: { color: "#F59E0B", textColor: "#FFFFFF", label: "CT" },
  investimento: { color: "#8B5CF6", textColor: "#FFFFFF", label: "IV" },
};

export function getBankBrand(
  name = "",
  sigla?: string | null,
  color?: string | null,
  type = "",
): BankBrand {
  const cleanName = name.toLowerCase().trim();
  const cleanType = type.toLowerCase().trim();

  if (sigla && color) {
    return {
      color,
      textColor: isLightColor(color) ? "#111827" : "#FFFFFF",
      label: sigla.toUpperCase(),
    };
  }

  const foundKey = Object.keys(bankMetaByName).find(
    (key) => cleanName === key || cleanName.includes(key),
  );
  if (foundKey) {
    const meta = bankMetaByName[foundKey];
    return { color: meta.color, textColor: meta.textColor, label: meta.label };
  }

  if (typeFallback[cleanType]) return typeFallback[cleanType];

  return {
    color: "#3B82F6",
    textColor: "#FFFFFF",
    label: makeSigla(name || "Banco"),
  };
}

export function BankLogo({
  name = "",
  sigla,
  color,
  type = "",
  size = "md",
  className = "",
}: BankLogoProps): ReactElement {
  const cleanName = (name || "").toLowerCase().trim();
  const cleanType = (type || "").toLowerCase().trim();

  // 1. Prioridade: props sigla + color vindo da OS (página OS)
  if (sigla && color) {
    return (
      <Badge color={color} size={size} className={className}>
        {sigla.toUpperCase()}
      </Badge>
    );
  }

  // 2. Busca por nome conhecido
  const foundKey = Object.keys(bankMetaByName).find(
    (key) => cleanName === key || cleanName.includes(key),
  );

  if (foundKey) {
    const meta = bankMetaByName[foundKey];
    return (
      <Badge
        color={meta.color}
        textColor={meta.textColor}
        size={size}
        className={className}
      >
        {meta.label}
      </Badge>
    );
  }

  // 3. Fallbacks por tipo
  if (cleanType === "caixa") {
    return (
      <Badge
        color="#14B8A6"
        textColor="#FFFFFF"
        size={size}
        className={className}
      >
        CX
      </Badge>
    );
  }
  if (cleanType === "carteira") {
    return (
      <Badge
        color="#F59E0B"
        textColor="#FFFFFF"
        size={size}
        className={className}
      >
        CT
      </Badge>
    );
  }
  if (cleanType === "investimento") {
    return (
      <Badge
        color="#8B5CF6"
        textColor="#FFFFFF"
        size={size}
        className={className}
      >
        IV
      </Badge>
    );
  }

  // 4. Fallback genérico
  return (
    <Badge
      color="#3B82F6"
      textColor="#FFFFFF"
      size={size}
      className={className}
    >
      {makeSigla(name || "Banco")}
    </Badge>
  );
}

interface BadgeProps {
  children: ReactElement | string;
  color: string;
  textColor?: string;
  size: "sm" | "md" | "lg";
  className?: string;
}

function Badge({
  children,
  color,
  textColor = "#FFFFFF",
  size,
  className,
}: BadgeProps): ReactElement {
  const sizeClasses = {
    sm: "w-8 h-8 text-[10px] rounded-lg",
    md: "w-10 h-10 text-[12px] rounded-xl",
    lg: "w-12 h-12 text-sm rounded-2xl",
  }[size];

  const isText = typeof children === "string";
  const isItau = isText && children.toLowerCase() === "itaú";

  return (
    <div
      className={`flex items-center justify-center font-black leading-none shadow-sm shrink-0 select-none overflow-hidden ${sizeClasses} ${className}`}
      style={{
        backgroundColor: color,
        color: textColor,
        fontStyle: isItau ? "italic" : "normal",
      }}
      title={isText ? children : "Banco"}
    >
      {isText ? <span className="truncate px-1">{children}</span> : children}
    </div>
  );
}

function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2) || "0", 16);
  const g = parseInt(hex.substring(2, 4) || "0", 16);
  const b = parseInt(hex.substring(4, 6) || "0", 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65;
}

function makeSigla(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "BK";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
}
