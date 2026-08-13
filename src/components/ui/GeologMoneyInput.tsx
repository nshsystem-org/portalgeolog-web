"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  formatMoneyDisplay,
  parseMoneyInput,
  maskMoneyInput,
  calculateMoneyCursorPos,
} from "@/lib/money";

interface GeologMoneyInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  rightIcon?: React.ReactNode;
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
  rightIcon,
  compact = false,
  disabled = false,
}: GeologMoneyInputProps) {
  const isEditingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCursorRef = useRef<number | null>(null);
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

  // Aplica uma string bruta + posição de cursor: mascara, atualiza o
  // display e propaga o valor numérico. Compartilhado entre onChange
  // (digitação normal) e onKeyDown (atalho do "." como decimal).
  const applyRawChange = useCallback(
    (raw: string, rawCursor: number) => {
      isEditingRef.current = true;
      const masked = maskMoneyInput(raw);
      // Calcula onde o cursor deve ficar após a reformatação da máscara
      // (separadores de milhar mudam a posição bruta dos dígitos)
      pendingCursorRef.current = calculateMoneyCursorPos(
        raw,
        rawCursor,
        masked,
      );
      setDisplayValue(masked);
      onChange(parseMoneyInput(masked) ?? 0);
    },
    [onChange],
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      applyRawChange(input.value, input.selectionStart ?? input.value.length);
    },
    [applyRawChange],
  );

  // Alguns teclados numéricos (ex: numpad com layout US) enviam "." como
  // tecla de decimal mesmo em locale pt-BR. Como maskMoneyInput só aceita
  // vírgula, o "." era descartado silenciosamente e parecia que a tecla
  // não fazia nada. Aqui interceptamos o "." e o tratamos como vírgula.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== ".") return;
      event.preventDefault();
      const input = event.currentTarget;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      // Se já existe uma vírgula fora da seleção atual, ignora (evita
      // criar uma segunda vírgula decimal).
      const selectionHasComma = input.value.slice(start, end).includes(",");
      if (input.value.includes(",") && !selectionHasComma) return;
      const raw = `${input.value.slice(0, start)},${input.value.slice(end)}`;
      applyRawChange(raw, start + 1);
    },
    [applyRawChange],
  );

  // Restaura a posição do cursor depois que o React atualiza o DOM com o
  // valor mascarado. Sem isso, o navegador posiciona o cursor no lugar
  // errado quando a máscara insere/remove separadores de milhar.
  useLayoutEffect(() => {
    const pos = pendingCursorRef.current;
    if (pos === null) return;
    pendingCursorRef.current = null;
    const input = inputRef.current;
    if (!input) return;
    try {
      input.setSelectionRange(pos, pos);
    } catch {
      // input sem suporte a selection (ex: type não-texto) — ignora
    }
  }, [displayValue]);

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

  // Evita conflito de font-size: "text-sm"/"text-base" (padrão) e um
  // tamanho customizado em inputClassName têm a mesma especificidade CSS,
  // então qual vence depende da ordem de geração do Tailwind, não da ordem
  // no atributo class — resultando em comportamento inconsistente. Omite
  // o tamanho padrão quando o chamador já define um.
  const hasCustomFontSize = /\btext-(\[|xs\b|sm\b|base\b|lg\b|xl\b|\d)/.test(
    inputClassName,
  );

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
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={label}
          className={
            compact
              ? `w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-11 pr-4 ${hasCustomFontSize ? "" : "text-sm"} font-bold tabular-nums text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60 ${inputClassName}`
              : `w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-4 pl-12 pr-5 font-black ${hasCustomFontSize ? "" : "text-base"} tabular-nums text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60 ${inputClassName}`
          }
        />
        {rightIcon && (
          <span className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
            {rightIcon}
          </span>
        )}
      </div>
    </div>
  );
}
