"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calendar } from "lucide-react";

interface GeologDateInputProps {
  label: string;
  value: string; // ISO value: YYYY-MM-DD or YYYY-MM
  onChange: (value: string) => void;
  type?: "date" | "month";
  className?: string;
  labelClassName?: string;
}

const pad = (value: string): string => value.padStart(2, "0");

const formatIsoToDisplay = (value: string, type: "date" | "month"): string => {
  if (!value) return "";
  if (type === "month") {
    const [year, month] = value.split("-");
    return year && month ? `${month}/${year}` : "";
  }

  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
};

const maskDigits = (value: string, type: "date" | "month"): string => {
  const digits = value.replace(/\D/g, "");

  if (type === "month") {
    const truncated = digits.slice(0, 6);
    if (truncated.length <= 2) return truncated;
    return `${truncated.slice(0, 2)}/${truncated.slice(2)}`;
  }

  const truncated = digits.slice(0, 8);
  if (truncated.length <= 2) return truncated;
  if (truncated.length <= 4)
    return `${truncated.slice(0, 2)}/${truncated.slice(2)}`;
  return `${truncated.slice(0, 2)}/${truncated.slice(2, 4)}/${truncated.slice(4)}`;
};

const parseDisplayToIso = (
  value: string,
  type: "date" | "month",
): string | null => {
  if (type === "month") {
    const [monthRaw, yearRaw] = value.split("/");
    if (
      !monthRaw ||
      !yearRaw ||
      monthRaw.length !== 2 ||
      yearRaw.length !== 4
    ) {
      return null;
    }

    const month = Number(monthRaw);
    const year = Number(yearRaw);
    if (
      !Number.isInteger(month) ||
      !Number.isInteger(year) ||
      month < 1 ||
      month > 12
    ) {
      return null;
    }

    return `${yearRaw}-${pad(monthRaw)}`;
  }

  const [dayRaw, monthRaw, yearRaw] = value.split("/");
  if (
    !dayRaw ||
    !monthRaw ||
    !yearRaw ||
    dayRaw.length !== 2 ||
    monthRaw.length !== 2 ||
    yearRaw.length !== 4
  ) {
    return null;
  }

  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${yearRaw}-${pad(monthRaw)}-${pad(dayRaw)}`;
};

export default function GeologDateInput({
  label,
  value,
  onChange,
  type = "date",
  className = "",
  labelClassName = "",
}: GeologDateInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [displayValue, setDisplayValue] = useState(() =>
    formatIsoToDisplay(value, type),
  );

  useEffect(() => {
    setDisplayValue(formatIsoToDisplay(value, type));
  }, [value, type]);

  const placeholder = useMemo(
    () => (type === "month" ? "MM/AAAA" : "DD/MM/AAAA"),
    [type],
  );

  const openPicker = () => {
    const input = pickerRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.click();
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskDigits(event.target.value, type);
    setDisplayValue(masked);

    const parsed = parseDisplayToIso(masked, type);
    onChange(parsed || "");
  };

  const handleTextBlur = () => {
    const parsed = parseDisplayToIso(displayValue, type);
    if (!parsed) {
      setDisplayValue(formatIsoToDisplay(value, type));
    }
  };

  return (
    <div className={`space-y-2 group ${className}`}>
      <label
        className={`ml-1 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400 ${labelClassName}`}
      >
        {label}
      </label>

      <div className="relative">
        <input
          type="text"
          value={displayValue}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          maxLength={type === "month" ? 7 : 10}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-base font-bold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
        />

        <button
          type="button"
          onClick={openPicker}
          className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors hover:bg-blue-50 rounded-lg p-1 cursor-pointer"
          aria-label={`Abrir calendário de ${label}`}
        >
          <Calendar
            size={18}
            className="text-slate-400 transition-colors hover:text-blue-500"
          />
        </button>

        <input
          ref={pickerRef}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute left-0 top-0 h-px w-px opacity-0 pointer-events-none"
        />
      </div>
    </div>
  );
}
