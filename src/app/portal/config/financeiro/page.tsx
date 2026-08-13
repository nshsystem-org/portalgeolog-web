"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { hasPageAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { useData } from "@/context/DataContext";
import { toast } from "sonner";
import { Calendar, Check, Percent } from "lucide-react";
import StandardModal from "@/components/StandardModal";

export default function ConfigFinanceiroPage() {
  const { profile } = useAuth();
  const { impostoPercentual, setImpostoPercentual } = useData();

  const [jurosInput, setJurosInput] = useState(String(impostoPercentual));
  const [isSavingJuros, setIsSavingJuros] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const formatErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && "message" in err) {
      const message = (err as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
    return "Falha inesperada ao salvar a configuração.";
  };

  if (!hasPageAccess(profile, "config-financeiro")) {
    return <AccessDenied module="Configurações Financeiras" />;
  }

  return (
    <>
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-10 space-y-10">
          <div className="flex items-center gap-4 pb-6 border-b-2 border-slate-50">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Percent size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">
                Configurações Financeiras
              </h2>
              <p className="text-slate-500 font-bold">
                Controle global de taxas e deduções das ordens de serviço.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                Porcentagem de Juros / Dedução (%)
              </label>
              <div className="relative group">
                <Percent
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                  size={18}
                />
                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  %
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full pl-12 pr-16 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-base outline-none focus:border-blue-600 transition-colors"
                  value={jurosInput}
                  onChange={(e) => setJurosInput(e.target.value)}
                  placeholder="Ex: 12,5%"
                />
              </div>
              <p className="text-sm font-semibold text-slate-400 ml-1">
                Digite apenas o valor numérico, com vírgula ou ponto se
                necessário. Exemplo: 15, 15,5 ou 15%.
              </p>
            </div>

            <button
              onClick={() => {
                setIsDateModalOpen(true);
                setEffectiveDate(
                  new Date().toISOString().split("T")[0],
                );
              }}
              className="w-full py-4 bg-blue-600 text-white font-black rounded-xl shadow-lg hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.98] transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-70 flex justify-center items-center gap-3"
            >
              <Check size={18} />
              Salvar Configuração
            </button>
          </div>
        </div>
      </div>

      {/* Modal Data de Vigência */}
      {isDateModalOpen && (
        <StandardModal
          title="Data de Vigência"
          subtitle="A partir de qual dia a nova configuração deve valer?"
          icon={<Calendar size={24} />}
          onClose={() => setIsDateModalOpen(false)}
          maxWidthClassName="max-w-md"
        >
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                Aplicar a partir de
              </label>
              <div className="relative group">
                <Calendar
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                  size={18}
                />
                <input
                  type="date"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-base outline-none focus:border-blue-600 transition-colors"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
              </div>
              <p className="text-sm font-semibold text-slate-400 ml-1">
                Alterações retroativas afetam o cálculo de impostos de OS
                criadas a partir desta data.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsDateModalOpen(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    setIsSavingJuros(true);
                    setIsDateModalOpen(false);
                    const normalizedJuros = Number(
                      String(jurosInput)
                        .replace("%", "")
                        .replace(",", ".")
                        .trim(),
                    );

                    if (!Number.isFinite(normalizedJuros)) {
                      toast.error("Informe uma porcentagem válida.");
                      return;
                    }

                    await setImpostoPercentual(normalizedJuros, effectiveDate);
                    toast.success(
                      `Porcentagem de juros atualizada com sucesso! Vigente a partir de ${new Date(effectiveDate + "T00:00:00").toLocaleDateString("pt-BR")}.`,
                    );
                  } catch (err: unknown) {
                    toast.error(`Erro ao salvar: ${formatErrorMessage(err)}`);
                  } finally {
                    setIsSavingJuros(false);
                  }
                }}
                disabled={isSavingJuros || !effectiveDate}
                className="flex-1 py-4 bg-blue-600 text-white font-black rounded-xl shadow-lg hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.98] transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-70 flex justify-center items-center gap-3"
              >
                {isSavingJuros ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Aplicar Retroativo
                  </>
                )}
              </button>
            </div>
          </div>
        </StandardModal>
      )}
    </>
  );
}
