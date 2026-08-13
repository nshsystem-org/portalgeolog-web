import { ShieldCheck } from "lucide-react";
import type { ReactElement } from "react";

interface AccessDeniedProps {
  /** Nome do módulo/página para exibir na mensagem (ex: "Cadastros", "Configurações") */
  module?: string;
}

/**
 * Componente genérico de tela de acesso negado.
 * Usado quando um usuário tenta acessar uma página sem permissão.
 */
export function AccessDenied({ module }: AccessDeniedProps): ReactElement {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-500">
        <ShieldCheck size={40} />
      </div>
      <h2 className="text-2xl font-black text-slate-800">Acesso restrito</h2>
      <p className="max-w-md text-slate-500">
        {module
          ? `Esta página é exclusiva para usuários com acesso ao módulo ${module}.`
          : "Você não tem permissão para acessar esta página."}
      </p>
    </div>
  );
}
