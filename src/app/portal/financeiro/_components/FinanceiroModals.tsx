import {
  CheckCircle2,
  Eye,
  FileText,
  FileUp,
  RotateCcw,
  Upload,
} from "lucide-react";
import type { ReactElement, ReactNode, RefObject } from "react";
import StandardModal from "@/components/StandardModal";
import type { OrderService } from "@/context/DataContext";
import { normalizeFinanceStatus } from "@/lib/financeiro";
import {
  formatCurrency,
  formatDate,
  getFinanceDisplayStatus,
  type FinanceActionTarget,
} from "../_lib/financeiro-page";

type FinanceiroModalsProps = {
  viewingOS: OrderService | null;
  viewingOSLoading: boolean;
  actionTarget: FinanceActionTarget | null;
  uploading: boolean;
  faturarFile: File | null;
  faturarTipoDocumento: string;
  faturarObservacao: string;
  recebimentoObservacao: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  customerMap: Map<string, string>;
  centerMap: Map<string, string>;
  driverMap: Map<string, string>;
  partnerMap: Map<string, string>;
  driverPartnerMap: Map<string, string>;
  onCloseViewingOS: () => void;
  onCloseActionModal: () => void;
  onFaturarTipoDocumentoChange: (value: string) => void;
  onFaturarFileChange: (value: File | null) => void;
  onFaturarObservacaoChange: (value: string) => void;
  onRecebimentoObservacaoChange: (value: string) => void;
  onUploadFaturamento: () => Promise<void>;
  onConfirmRecebimento: () => Promise<void>;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

export function FinanceiroModals({
  viewingOS,
  viewingOSLoading,
  actionTarget,
  uploading,
  faturarFile,
  faturarTipoDocumento,
  faturarObservacao,
  recebimentoObservacao,
  fileInputRef,
  customerMap,
  centerMap,
  driverMap,
  partnerMap,
  driverPartnerMap,
  onCloseViewingOS,
  onCloseActionModal,
  onFaturarTipoDocumentoChange,
  onFaturarFileChange,
  onFaturarObservacaoChange,
  onRecebimentoObservacaoChange,
  onUploadFaturamento,
  onConfirmRecebimento,
}: FinanceiroModalsProps): ReactElement {
  return (
    <>
      {viewingOS ? (
        <StandardModal
          title={`Visualizar OS ${viewingOS.os || "Sem número"}`}
          subtitle={`Protocolo ${viewingOS.protocolo || viewingOS.id.slice(0, 8)}`}
          icon={<Eye size={22} />}
          onClose={onCloseViewingOS}
          maxWidthClassName="max-w-3xl"
          bodyClassName="space-y-6 p-6 md:p-8"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                Cliente
              </p>
              <p className="mt-2 text-base font-black text-slate-800">
                {customerMap.get(viewingOS.clienteId) || "Sem cliente"}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                Centro de custo
              </p>
              <p className="mt-2 text-base font-black text-slate-800">
                {centerMap.get(viewingOS.centroCustoId || "") ||
                  viewingOS.centroCustoId ||
                  "Geral"}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                Motorista
              </p>
              <p className="mt-2 text-base font-black text-slate-800">
                {viewingOS.driverId
                  ? driverMap.get(viewingOS.driverId) ||
                    viewingOS.motorista ||
                    "Sem motorista"
                  : viewingOS.motorista || "Sem motorista"}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                Parceiro
              </p>
              <p className="mt-2 text-base font-black text-slate-800">
                {viewingOS.driverId
                  ? partnerMap.get(
                      driverPartnerMap.get(viewingOS.driverId) || "",
                    ) || "Sem parceiro"
                  : "Sem parceiro"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-500">
                Status financeiro
              </p>
              <p className="mt-2 text-lg font-black text-blue-700">
                {getFinanceDisplayStatus(viewingOS)}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                Data da OS
              </p>
              <p className="mt-2 text-lg font-black text-slate-800">
                {formatDate(viewingOS.data)}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                Status operacional
              </p>
              <p className="mt-2 text-lg font-black text-slate-800">
                {viewingOS.status.operacional || "-"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                Valor bruto
              </p>
              <p className="mt-2 text-xl font-black text-slate-800">
                {formatCurrency(Number(viewingOS.valorBruto || 0))}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                Custo
              </p>
              <p className="mt-2 text-xl font-black text-red-500">
                {formatCurrency(Number(viewingOS.custo || 0))}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                Lucro
              </p>
              <p className="mt-2 text-xl font-black text-emerald-600">
                {formatCurrency(Number(viewingOS.lucro || 0))}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              Datas financeiras
            </p>
            <div className="mt-3 space-y-2 text-sm font-bold text-slate-700">
              <p>Faturado em: {formatDate(viewingOS.financeiroFaturadoEm)}</p>
              <p>Recebido em: {formatDate(viewingOS.financeiroRecebidoEm)}</p>
              <p>Anexos: {viewingOS.financeiroAnexos?.length || 0}</p>
            </div>
          </div>

          {viewingOSLoading ? (
            <div className="flex items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
              <RotateCcw size={16} className="animate-spin" />
              Carregando detalhes mais recentes...
            </div>
          ) : null}
        </StandardModal>
      ) : null}

      {actionTarget ? (
        <StandardModal
          title={
            normalizeFinanceStatus(actionTarget.os.status.financeiro) ===
            "Pendente"
              ? "Faturar Ordem de Serviço"
              : "Confirmar Recebimento"
          }
          subtitle={`OS #${actionTarget.os.os || actionTarget.os.protocolo || actionTarget.os.id.slice(0, 8)}`}
          icon={
            normalizeFinanceStatus(actionTarget.os.status.financeiro) ===
            "Pendente" ? (
              <FileUp size={22} />
            ) : (
              <CheckCircle2 size={22} />
            )
          }
          onClose={onCloseActionModal}
          maxWidthClassName="max-w-2xl"
          bodyClassName="space-y-6 p-6 md:p-8"
          footer={
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 md:px-8">
              <button
                type="button"
                onClick={onCloseActionModal}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition-all hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              {normalizeFinanceStatus(actionTarget.os.status.financeiro) ===
              "Pendente" ? (
                <button
                  type="button"
                  onClick={() => void onUploadFaturamento()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
                >
                  {uploading ? (
                    <RotateCcw size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  Confirmar Faturamento
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void onConfirmRecebimento()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
                >
                  {uploading ? (
                    <RotateCcw size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Confirmar Recebimento
                </button>
              )}
            </div>
          }
        >
          {normalizeFinanceStatus(actionTarget.os.status.financeiro) ===
          "Pendente" ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-blue-100 bg-blue-50/50 p-5 text-sm text-blue-800">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em]">
                  Atenção: Comprovante Obrigatório
                </p>
                <p className="font-medium leading-relaxed">
                  Para faturar esta OS, anexe o comprovante (Nota Fiscal, Recibo
                  ou PDF). Isso atualizará o status financeiro para permitir a
                  baixa futura.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Tipo do Documento">
                  <select
                    value={faturarTipoDocumento}
                    onChange={(event) =>
                      onFaturarTipoDocumentoChange(event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="nota_fiscal">Nota Fiscal Eletrônica</option>
                    <option value="fatura">Fatura / Invoice</option>
                    <option value="comprovante">Comprovante de Serviço</option>
                    <option value="outro">Outro Documento</option>
                  </select>
                </Field>
                <Field label="Arquivo (PDF ou Imagem)">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={(event) =>
                      onFaturarFileChange(event.target.files?.[0] || null)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition-all file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-xs file:font-black file:text-white hover:file:bg-blue-700"
                  />
                </Field>
              </div>
              <Field label="Observações do Faturamento">
                <textarea
                  value={faturarObservacao}
                  onChange={(event) =>
                    onFaturarObservacaoChange(event.target.value)
                  }
                  rows={3}
                  placeholder="Informações adicionais para o registro financeiro..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </Field>
              {faturarFile ? (
                <div className="flex items-center gap-3 rounded-3xl border border-dashed border-blue-200 bg-blue-50/30 p-4">
                  <div className="rounded-xl bg-blue-100 p-2 text-blue-600">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-800">
                      {faturarFile.name}
                    </p>
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      {(faturarFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-5 text-sm text-emerald-800">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em]">
                  Confirmação de Recebimento
                </p>
                <p className="font-medium leading-relaxed">
                  Ao dar baixa, você confirma que o valor de{" "}
                  <strong>
                    {formatCurrency(Number(actionTarget.os.valorBruto || 0))}
                  </strong>{" "}
                  entrou efetivamente na conta da empresa.
                </p>
              </div>
              <Field label="Observações da Baixa / Recebimento">
                <textarea
                  value={recebimentoObservacao}
                  onChange={(event) =>
                    onRecebimentoObservacaoChange(event.target.value)
                  }
                  rows={4}
                  placeholder="Ex.: Valor conciliado via extrato bancário, banco Itaú..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </Field>
            </div>
          )}
        </StandardModal>
      ) : null}
    </>
  );
}
