import { ShieldCheck } from "lucide-react";
import type { ReactElement } from "react";

export function FinanceiroAccessDenied(): ReactElement {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-500">
        <ShieldCheck size={40} />
      </div>
      <h2 className="text-2xl font-black text-slate-800">Acesso restrito</h2>
      <p className="max-w-md text-slate-500">
        Esta página é exclusiva para usuários com acesso ao módulo financeiro.
      </p>
    </div>
  );
}
