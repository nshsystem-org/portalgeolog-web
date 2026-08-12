"use client";

import React, { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ActionMenuPortalProps {
  /**
   * Indica se o painel do menu está aberto.
   */
  isOpen: boolean;
  /**
   * Função que retorna o elemento DOM do trigger (wrapper relativo).
   * Usada para calcular as coordenadas de posicionamento do painel.
   */
  getTriggerEl: () => HTMLElement | null;
  /**
   * Alinhamento do painel em relação ao trigger.
   * - "right": alinha a borda direita do painel com a borda direita do trigger.
   * - "left": alinha a borda esquerda do painel com a borda esquerda do trigger.
   */
  align?: "left" | "right";
  /**
   * Largura do painel em pixels.
   */
  width?: number;
  /**
   * Classes extras aplicadas ao painel (borda, bg, padding, rounding, etc).
   */
  panelClassName?: string;
  /**
   * Conteúdo do menu (botões de ação).
   */
  children: ReactNode;
}

/**
 * Renderiza o painel de um menu de ações via portal (document.body) com
 * posicionamento `fixed`, evitando que containers ancestrais com
 * `overflow-hidden` (ex: DataTable) cortem o dropdown.
 *
 * O seletor `.geolog-action-menu-portal` pode ser usado por handlers de
 * click-outside para ignorar cliques dentro do painel.
 */
export function ActionMenuPortal({
  isOpen,
  getTriggerEl,
  align = "right",
  width = 176,
  panelClassName = "",
  children,
}: ActionMenuPortalProps): ReactElement | null {
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    openUpwards: boolean;
  }>({ top: 0, left: 0, openUpwards: false });

  useEffect(() => {
    if (!isOpen) return;

    const updateCoords = () => {
      const el = getTriggerEl();
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Abre para cima apenas quando o espaço abaixo é insuficiente e há
      // mais espaço acima (mesma heurística do GeologSearchableSelect).
      const openUpwards = spaceBelow < 300 && spaceAbove > spaceBelow;

      const left =
        align === "right" ? Math.max(8, rect.right - width) : rect.left;

      setCoords({
        top: openUpwards ? Math.max(8, rect.top - 8) : rect.bottom + 4,
        left,
        openUpwards,
      });
    };

    updateCoords();
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);

    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen, align, width, getTriggerEl]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`geolog-action-menu-portal fixed z-[9999] ${panelClassName}`}
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${width}px`,
        // Quando abre para cima, ancoramos pelo topo do painel na parte
        // superior do trigger; caso contrário, logo abaixo do trigger.
        transform: coords.openUpwards ? "translateY(-100%)" : "none",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
