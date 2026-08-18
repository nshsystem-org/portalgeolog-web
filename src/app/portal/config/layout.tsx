import type { ReactElement } from "react";

/**
 * Layout wrapper para todas as sub-páginas de /portal/config/*.
 * Apenas centraliza o conteúdo com largura máxima; o padding
 * vertical já é fornecido por <main> do portal/layout.tsx.
 */
export default function ConfigLayout({
  children,
}: {
  children: ReactElement;
}): ReactElement {
  return (
    <div className="max-w-[1600px] mx-auto pb-6 px-4 md:px-10">
      {children}
    </div>
  );
}
