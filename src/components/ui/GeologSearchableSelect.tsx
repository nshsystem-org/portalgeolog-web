"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Plus, User } from "lucide-react";
import { getThumbnailUrl } from "@/utils/avatar";

function VehiclePlate({
  plate,
  size = "sm",
  withNegativeMargin = false,
}: {
  plate: string;
  size?: "sm" | "xs";
  withNegativeMargin?: boolean;
}) {
  const dims =
    size === "xs"
      ? {
          w: "w-[100px]",
          h: "h-[40px]",
          bar: "h-[4px]",
          text: "text-[14px]",
          pad: "pt-[9px] pb-[5px] px-2",
          margin: withNegativeMargin ? "-my-[6px]" : "",
        }
      : {
          w: "w-[110px]",
          h: "h-[48px]",
          bar: "h-[5px]",
          text: "text-[14px]",
          pad: "py-2.5 px-3",
          margin: "",
        };
  return (
    <div
      className={`${dims.w} ${dims.h} ${dims.margin} bg-white border-2 border-slate-500 rounded-lg overflow-hidden shadow-sm flex flex-col items-center flex-shrink-0 min-w-max`}
    >
      <div
        className={`bg-blue-700 ${dims.bar}`}
        style={{ width: "100%", minWidth: "100%" }}
      />
      <div className={`${dims.pad} flex items-center justify-center w-full`}>
        <span
          className={`${dims.text} font-black text-slate-900 uppercase tracking-widest leading-none whitespace-nowrap`}
        >
          {plate}
        </span>
      </div>
    </div>
  );
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local =
    digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;

  if (local.length === 11) {
    return `+55  ${local.slice(0, 2)}  ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `+55  ${local.slice(0, 2)}  ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return value;
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizePhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) {
    return digits.slice(2);
  }
  return digits;
}

interface Option {
  id: string;
  nome: string;
  sublabel?: string;
  photoUrl?: string;
  plate?: string;
}

interface GeologSearchableSelectProps {
  label?: string;
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
  required?: boolean;
  onQuickAdd?: () => void;
  triggerClassName?: string;
  className?: string;
  disableSearch?: boolean;
  dropdownPosition?: "auto" | "down" | "up";
}

export default function GeologSearchableSelect({
  label,
  options,
  value,
  onChange,
  disabled = false,
  placeholder = "Pesquisar...",
  compact = false,
  required = false,
  onQuickAdd,
  triggerClassName = "",
  className = "",
  disableSearch = false,
  dropdownPosition = "auto",
}: GeologSearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [coords, setCoords] = useState({
    top: 0,
    left: 0,
    width: 0,
    bottom: 0,
    openUpwards: false,
  });
  const mounted = true;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);
  const triggerPaddingClass = compact ? "px-2 py-1.5" : "px-5 py-4";
  const triggerTextClass = triggerClassName?.includes("text-")
    ? ""
    : compact
      ? "text-sm"
      : "text-lg";
  const triggerIconSize = triggerClassName?.includes("text-base")
    ? 18
    : compact
      ? 16
      : 20;

  // Pré-carrega as fotos ao abrir o dropdown (mesmo modelo das notificações)
  const preloadedPhotosRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isOpen) return;
    options.forEach((opt) => {
      const url = opt.photoUrl;
      if (!url || preloadedPhotosRef.current.has(url)) return;
      const img = document.createElement("img");
      img.src = getThumbnailUrl(url, 64) || url;
      preloadedPhotosRef.current.add(url);
    });
  }, [isOpen, options]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isInsideWrapper = wrapperRef.current?.contains(target);
      const isInsidePortal = (target as HTMLElement).closest?.(
        ".geolog-select-portal",
      );

      if (!isInsideWrapper && !isInsidePortal) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Atualiza a posição quando abre ou quando há redimensionamento/scroll
  useEffect(() => {
    const updateCoords = () => {
      if (triggerRef.current && isOpen) {
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        let needsUpwards: boolean;
        if (dropdownPosition === "down") {
          needsUpwards = false;
        } else if (dropdownPosition === "up") {
          needsUpwards = true;
        } else {
          // Abre para cima apenas se o espaço abaixo for crítico (< 250px)
          // e se estivermos em uma resolução vertical reduzida (< 880px)
          // ou se houver significativamente mais espaço acima.
          needsUpwards =
            (window.innerHeight < 880 || spaceBelow < 150) &&
            spaceBelow < 250 &&
            spaceAbove > spaceBelow;
        }

        setCoords({
          top: rect.bottom,
          bottom: window.innerHeight - rect.top,
          left: rect.left,
          width: rect.width,
          openUpwards: needsUpwards,
        });
      }
    };

    if (isOpen) {
      updateCoords();
      window.addEventListener("scroll", updateCoords, true);
      window.addEventListener("resize", updateCoords);
    }

    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen, dropdownPosition]);

  const normalizedSearch = normalizeSearch(searchTerm);
  const searchDigits = normalizePhoneDigits(searchTerm);
  const filteredOptions = options.filter((opt) => {
    const matchesText =
      normalizeSearch(opt.nome).includes(normalizedSearch) ||
      (opt.sublabel &&
        normalizeSearch(opt.sublabel).includes(normalizedSearch));

    if (matchesText) {
      return true;
    }

    if (!searchDigits || !opt.sublabel) {
      return false;
    }

    const optionDigits = normalizePhoneDigits(opt.sublabel);
    return optionDigits.includes(searchDigits);
  });

  const dropdownContent = (
    <div
      className={`geolog-select-portal fixed z-[9999] bg-white border-2 border-slate-100 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] rounded-3xl overflow-hidden animate-in fade-in duration-200 ${
        coords.openUpwards ? "slide-in-from-bottom-2" : "slide-in-from-top-2"
      }`}
      style={{
        top: coords.openUpwards ? "auto" : `${coords.top + 8}px`,
        bottom: coords.openUpwards ? `${coords.bottom + 8}px` : "auto",
        left: `${coords.left}px`,
        width: `${coords.width}px`,
      }}
    >
      {!disableSearch && (
        <div className="p-4 border-b-2 border-slate-50 relative bg-slate-50/50">
          <Search
            size={18}
            className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            autoFocus
            type="text"
            placeholder="Digite para filtrar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white rounded-xl text-sm font-bold text-slate-900 outline-none border-2 border-transparent focus:border-blue-500 shadow-sm"
          />
        </div>
      )}

      <div className="max-h-60 overflow-y-auto custom-scrollbar">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((opt) => (
            <div
              key={opt.id}
              onClick={() => {
                onChange(opt.id);
                setIsOpen(false);
                setSearchTerm("");
              }}
              className={`px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center gap-3 transition-colors border-l-4 border-transparent ${value === opt.id ? "bg-blue-50/50 border-blue-600" : ""}`}
            >
              {opt.photoUrl ? (
                <img
                  src={getThumbnailUrl(opt.photoUrl, 64) || ""}
                  alt={opt.nome}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0 border-2 border-slate-200"
                  loading="lazy"
                />
              ) : opt.plate ? (
                <VehiclePlate plate={opt.plate} size="xs" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 border-2 border-slate-200">
                  <User size={16} className="text-slate-400" />
                </div>
              )}
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="font-bold text-slate-900 text-sm truncate">
                  {opt.nome}
                </span>
                {opt.sublabel && (
                  <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-black text-blue-900">
                    {formatPhone(opt.sublabel)}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="px-4 py-6 text-center text-slate-400 font-bold text-sm">
            Nenhum resultado
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`group relative ${className}`} ref={wrapperRef}>
      {(label || required) && (
        <label
          className={`font-black uppercase text-slate-400 tracking-[0.25em] ml-1 ${compact ? "text-[10px]" : "text-[11px]"} flex items-center gap-1 mb-2`}
        >
          {label}
          {required && <span className="text-rose-300 text-base">*</span>}
        </label>
      )}

      <div
        ref={triggerRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`geolog-searchable-trigger w-full bg-slate-50 border-2 border-slate-200 rounded-xl flex items-center justify-between cursor-pointer transition-all hover:bg-white hover:border-blue-300 ${isOpen ? "ring-4 ring-blue-500/10 border-blue-500 bg-white" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""} shadow-sm ${triggerPaddingClass} ${triggerClassName}`}
      >
        <span
          className={`font-bold leading-none flex items-center gap-2.5 ${selectedOption ? "text-slate-900" : "text-slate-400"} ${triggerTextClass}`}
        >
          {selectedOption?.photoUrl ? (
            <img
              src={getThumbnailUrl(selectedOption.photoUrl, 64) || ""}
              alt={selectedOption.nome}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 border-2 border-slate-200"
              loading="lazy"
            />
          ) : selectedOption?.plate ? (
            <VehiclePlate
              plate={selectedOption.plate}
              size="xs"
              withNegativeMargin
            />
          ) : selectedOption ? (
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 border-2 border-slate-200">
              <User size={15} className="text-slate-400" />
            </div>
          ) : null}
          {selectedOption ? (
            <>
              {selectedOption.nome}
              {selectedOption.sublabel && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-black text-blue-900">
                  {formatPhone(selectedOption.sublabel)}
                </span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <div className="flex items-center gap-1">
          {onQuickAdd && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onQuickAdd();
              }}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
              title="Cadastrar novo"
            >
              <Plus size={16} />
            </button>
          )}
          <ChevronDown
            size={triggerIconSize}
            className={`text-slate-400 transition-transform ${isOpen ? "rotate-180 text-blue-500" : ""}`}
          />
        </div>
      </div>

      {isOpen &&
        !disabled &&
        mounted &&
        createPortal(dropdownContent, document.body)}
    </div>
  );
}
