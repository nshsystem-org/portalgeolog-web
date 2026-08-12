"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  formatMoneyDisplay,
  parseMoneyInput,
  maskMoneyInput,
} from "@/lib/money";

interface GeologMoneyInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  compact?: boolean;
  disabled?: boolean;
}

/**
 * Input de moeda pt-BR com máscara automática.
 * - Estado interno como string formatada (ex: "1.234,56")
 * - Saída via onChange como number (ex: 1234.56)
 * - Aceita colagem de "R$ 1.234,56", "1234.56", etc.
 *
 * Sincronização: o display só é sobrescrito pelo valor externo quando
 * o usuário não está editando E o valor externo difere do que o display
 * atual parseia. Isso evita clobbering enquanto o usuário digita e
 * elimina loops de sync desnecessários.
 */
export default function GeologMoneyInput({
  label,
  value,
  onChange,
  placeholder = "0,00",
  className = "",
  labelClassName = "",
  inputClassName = "",
  compact = false,
  disabled = false,
}: GeologMoneyInputProps) {
  const isEditingRef = useRef(false);
  const [displayValue, setDisplayValue] = useState(() =>
    value > 0 ? formatMoneyDisplay(value) : "",
  );

  // Sincroniza do exterior só quando:
  // 1. Não está editando
  // 2. O valor externo difere do que o display atual parseia
  useEffect(() => {
    if (isEditingRef.current) return;
    const currentParsed = parseMoneyInput(displayValue);
    const currentNum = currentParsed ?? 0;
    if (currentNum === value) return;
    const formatted = value > 0 ? formatMoneyDisplay(value) : "";
    setDisplayValue(formatted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      isEditingRef.current = true;
      const masked = maskMoneyInput(event.target.value);
      setDisplayValue(masked);
      onChange(parseMoneyInput(masked) ?? 0);
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    isEditingRef.current = false;
    const parsed = parseMoneyInput(displayValue);
    if (parsed !== null && parsed > 0) {
      setDisplayValue(formatMoneyDisplay(parsed));
    } else {
      setDisplayValue("");
    }
  }, [displayValue]);

  const handleFocus = useCallback(() => {
    isEditingRef.current = true;
  }, []);

  return (
    <div className={compact ? className : `space-y-2 ${className}`}>
      {label && !compact && (
        <label
          className={`ml-1 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400 ${labelClassName}`}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 pointer-events-none">
          R$
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={label}
          className={
            compact
              ? `w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-11 pr-4 text-sm font-bold tabular-nums text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60 ${inputClassName}`
              : `w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-4 pl-12 pr-5 font-black text-base tabular-nums text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60 ${inputClassName}`
          }
        />
      </div>
    </div>
  );
}
