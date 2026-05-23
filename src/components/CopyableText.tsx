"use client";

import { useState } from "react";

interface CopyableTextProps {
  text: string;
  className?: string;
  copiedClassName?: string;
  children?: React.ReactNode;
}

export function CopyableText({
  text,
  className = "",
  copiedClassName = "",
  children,
}: CopyableTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={[
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 transition-colors cursor-pointer select-none",
        copied
          ? "bg-emerald-50 text-emerald-700 " + copiedClassName
          : "hover:bg-slate-100 " + className,
      ].join(" ")}
      title={copied ? "Copiado!" : `Clique para copiar: ${text}`}
    >
      {children}
      {copied && (
        <span className="text-[10px] font-black uppercase tracking-wider">
          Copiado
        </span>
      )}
    </button>
  );
}
