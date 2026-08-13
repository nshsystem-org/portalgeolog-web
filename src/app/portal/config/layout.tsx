import type { ReactElement } from "react";

/**
 * Layout wrapper para todas as sub-páginas de /portal/config/*.
 * Mantém o padding consistente com a versão anterior de tabs.
 */
export default function ConfigLayout({
  children,
}: {
  children: ReactElement;
}): ReactElement {
  return (
    <div className="max-w-[1600px] mx-auto pt-36 pb-6 px-4 md:px-10">
      {children}
    </div>
  );
}
