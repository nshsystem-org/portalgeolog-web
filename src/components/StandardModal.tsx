"use client";

import React, { useEffect, useId } from "react";
import { X } from "lucide-react";

interface StandardModalProps {
  children: React.ReactNode;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClassName?: string;
  containerClassName?: string;
  bodyClassName?: string;
  headerClassName?: string;
  headerGlowClassName?: string;
  headerStyle?: React.CSSProperties;
  subtitleClassName?: string;
  titleClassName?: string;
  iconContainerClassName?: string;
  iconClassName?: string;
  closeButtonClassName?: string;
  disableBackdropClose?: boolean;
}

export default function StandardModal({
  children,
  onClose,
  title,
  subtitle,
  icon,
  footer,
  maxWidthClassName = "max-w-2xl",
  containerClassName = "",
  bodyClassName = "p-6 md:p-10 pb-16 space-y-12",
  headerClassName = "bg-[var(--color-geolog-blue)]",
  headerGlowClassName = "bg-blue-500/10",
  headerStyle,
  subtitleClassName = "text-blue-300/80",
  titleClassName = "text-white",
  iconContainerClassName = "bg-white/10 border-white/20",
  iconClassName = "text-white",
  closeButtonClassName = "text-white/40 hover:text-white hover:bg-white/10",
  disableBackdropClose = false,
}: StandardModalProps) {
  const titleId = useId();
  const subtitleId = `${titleId}-subtitle`;

  useEffect(() => {
    // Salvar posição de scroll atual
    const scrollY = window.scrollY;

    // Bloquear scroll do body quando modal está aberto
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.top = `-${scrollY}px`;

    return () => {
      // Restaurar scroll quando modal fecha
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      // Restaurar posição de scroll
      window.scrollTo(0, scrollY);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 modal-font">
      <div
        className="absolute inset-0 bg-[#001C3A]/60 backdrop-blur-md"
        onClick={() => !disableBackdropClose && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`modal-title-${titleId}`}
        aria-describedby={subtitle ? subtitleId : undefined}
        className={`relative bg-white w-full ${maxWidthClassName} max-h-[92vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 border border-slate-200 modal-content ${containerClassName}`}
        style={{ textRendering: "geometricPrecision" }}
      >
        <div
          className={`${headerClassName} p-6 md:p-8 flex items-center justify-between shrink-0 relative overflow-hidden`}
          style={{ paddingBottom: "1.75rem", ...headerStyle }}
        >
          <div
            className={`absolute top-0 right-0 w-64 h-64 rounded-full -mr-32 -mt-32 blur-3xl opacity-50 ${headerGlowClassName}`}
          />
          <div className="flex items-center gap-5 relative z-10">
            <div
              className={`w-12 h-12 md:w-14 md:h-14 ${iconContainerClassName} rounded-2xl flex items-center justify-center ${iconClassName} backdrop-blur-xl`}
            >
              {icon}
            </div>
            <div>
              <h2
                id={`modal-title-${titleId}`}
                className={`text-2xl md:text-3xl font-black tracking-tight ${titleClassName}`}
                style={{ lineHeight: "1.2", marginBottom: "0.25rem" }}
              >
                {title}
              </h2>
              {subtitle && (
                <div
                  id={subtitleId}
                  className={`text-[11px] font-bold uppercase tracking-[0.2em] ${subtitleClassName}`}
                  style={{ lineHeight: "1.3" }}
                >
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-3 ${closeButtonClassName} rounded-xl transition-all relative z-10 cursor-pointer`}
            aria-label="Fechar modal"
          >
            <X size={24} />
          </button>
        </div>

        <div
          className={`flex-1 overflow-y-auto overflow-hidden custom-scrollbar ${bodyClassName}`}
        >
          {children}
        </div>

        {footer && <div className="shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
