"use client";

import { FileText, Layers, ReceiptText, RotateCcw, Upload } from "lucide-react";
import { useMemo, useState, type ReactElement } from "react";
import StandardModal from "@/components/StandardModal";
import GeologDateInput from "@/components/ui/GeologDateInput";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import type { Cliente } from "@/context/DataContext";
import type {
  FaturamentoLotePayload,
  FaturamentoLotePreview,
} from "../_services/financeiro.service";
import { formatCurrency, formatDate } from "../_lib/financeiro-page";

type FaturamentoLoteModalProps = {
  isOpen: boolean;
  defaultDataInicio: string;
  defaultDataFim: string;
  clientes: Cliente[];
  preview: FaturamentoLotePreview | null;
  loading: boolean;
  onClose: () => void;
  onBack: () => void;
  onPreview: (payload: FaturamentoLotePayload) => Promise<void>;
  onConfirm: () => Promise<void>;
};

export function FaturamentoLoteModal({
  isOpen,
  defaultDataInicio,
  defaultDataFim,
  clientes,
  preview,
  loading,
  onClose,
  onBack,
  onPreview,
  onConfirm,
}: FaturamentoLoteModalProps): ReactElement | null {
  const [dataInicio, setDataInicio] = useState(defaultDataInicio);
  const [dataFim, setDataFim] = useState(defaultDataFim);
  const [clienteId, setClienteId] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tipoDocumento, setTipoDocumento] = useState("nota_fiscal");

  const centerOptions = useMemo(
    () =>
      clientes
        .find((cliente) => cliente.id === clienteId)
        ?.centrosCusto.map((center) => ({ id: center.id, nome: center.nome })) ?? [],
    [clienteId, clientes],
  );

  if (!isOpen) return null;

  if (preview) {
    return (
      <StandardModal
        title="Confirmar Faturamento em Lote"
        subtitle="Revise os dados antes de faturar"
        icon={<Layers size={22} />}
        onClose={onClose}
        maxWidthClassName="max-w-2xl"
        bodyClassName="space-y-6 p-6 md:p-8"
        headerClassName="bg-gradient-to-r from-yellow-100 via-yellow-200 to-yellow-300"
        headerGlowClassName="bg-yellow-400/30"
        titleClassName="text-[rgb(100,102,20)]"
        subtitleClassName="text-[rgb(135,138,28)]"
        iconContainerClassName="border border-yellow-300 bg-white/50"
        iconClassName="text-[rgb(135,138,28)]"
        closeButtonClassName="text-[rgb(135,138,28)]/60 hover:bg-white/50 hover:text-[rgb(100,102,20)]"
        footer={
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 md:px-8">
            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-70 cursor-pointer"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={loading || preview.count === 0}
              className="inline-flex items-center gap-2 rounded-2xl border border-yellow-300 bg-gradient-to-r from-yellow-100 via-yellow-200 to-yellow-300 px-6 py-3 text-sm font-black text-[rgb(100,102,20)] shadow-md shadow-yellow-300/40 transition-all hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <RotateCcw size={16} className="animate-spin" />
              ) : (
                <ReceiptText size={16} />
              )}
              Confirmar Faturamento
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:col-span-2">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              Empresa
            </p>
            <p className="mt-2 text-lg font-black text-slate-800">
              {preview.customerName}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              Centro de custo
            </p>
            <p className="mt-2 font-black text-slate-800">
              {preview.centerName || "Todos os centros"}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              Período
            </p>
            <p className="mt-2 font-black text-slate-800">
              {formatDate(dataInicio)} a {formatDate(dataFim)}
            </p>
          </div>
          <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[rgb(135,138,28)]">
              OS elegíveis
            </p>
            <p className="mt-2 text-2xl font-black text-[rgb(100,102,20)]">
              {preview.count}
            </p>
          </div>
          <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[rgb(135,138,28)]">
              Valor total
            </p>
            <p className="mt-2 text-2xl font-black text-[rgb(100,102,20)]">
              {formatCurrency(preview.totalValue)}
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-relaxed text-amber-800">
          Somente OS finalizadas ou concluídas, pendentes de faturamento e não
          isentas serão marcadas como faturadas.
        </div>
      </StandardModal>
    );
  }

  const canPreview = Boolean(dataInicio && dataFim && clienteId);

  return (
    <StandardModal
      title="Faturar em Lote"
      subtitle="Selecione o período, a empresa e o centro de custo"
      icon={<ReceiptText size={22} />}
      onClose={onClose}
      maxWidthClassName="max-w-3xl"
      bodyClassName="space-y-6 p-6 md:p-8"
      headerClassName="bg-gradient-to-r from-yellow-100 via-yellow-200 to-yellow-300"
      headerGlowClassName="bg-yellow-400/30"
      titleClassName="text-[rgb(100,102,20)]"
      subtitleClassName="text-[rgb(135,138,28)]"
      iconContainerClassName="border border-yellow-300 bg-white/50"
      iconClassName="text-[rgb(135,138,28)]"
      closeButtonClassName="text-[rgb(135,138,28)]/60 hover:bg-white/50 hover:text-[rgb(100,102,20)]"
      footer={
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 md:px-8">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition-all hover:bg-slate-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() =>
              void onPreview({
                dataInicio,
                dataFim,
                clienteId,
                centroCustoId,
                file,
                tipoDocumento,
              })
            }
            disabled={!canPreview || loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-yellow-300 bg-gradient-to-r from-yellow-100 via-yellow-200 to-yellow-300 px-6 py-3 text-sm font-black text-[rgb(100,102,20)] shadow-md shadow-yellow-300/40 transition-all hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <RotateCcw size={16} className="animate-spin" />
            ) : (
              <FileText size={16} />
            )}
            Visualizar Faturamento
          </button>
        </div>
      }
    >
      <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-5">
        <p className="mb-4 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
          Período obrigatório
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GeologDateInput
            label="Data Inicial"
            value={dataInicio}
            onChange={setDataInicio}
            labelClassName="text-[rgb(135,138,28)]"
          />
          <GeologDateInput
            label="Data Final"
            value={dataFim}
            onChange={setDataFim}
            labelClassName="text-[rgb(135,138,28)]"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <GeologSearchableSelect
            label="Empresa / Cliente"
            options={clientes.map((cliente) => ({
              id: cliente.id,
              nome: cliente.nome,
            }))}
            value={clienteId}
            onChange={(value) => {
              setClienteId(value);
              setCentroCustoId("");
            }}
            placeholder="Selecione uma empresa..."
            triggerClassName="px-4 py-3 text-base"
          />
          <GeologSearchableSelect
            label="Centro de Custo"
            options={centerOptions}
            value={centroCustoId}
            onChange={setCentroCustoId}
            onClear={() => setCentroCustoId("")}
            disabled={!clienteId}
            placeholder="Todos os centros"
            triggerClassName="px-4 py-3 text-base"
          />
        </div>
        <p className="mt-4 text-xs font-semibold text-slate-500">
          Sem centro de custo selecionado, todas as OS elegíveis da empresa no
          período serão faturadas.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-5">
        <p className="mb-4 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
          Documento fiscal opcional
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <GeologSearchableSelect
            label="Tipo de Documento"
            options={[
              { id: "nota_fiscal", nome: "Nota Fiscal" },
              { id: "fatura", nome: "Fatura" },
              { id: "comprovante", nome: "Comprovante" },
            ]}
            value={tipoDocumento}
            onChange={setTipoDocumento}
            disableSearch
            triggerClassName="px-4 py-3 text-base"
          />
          <label className="block space-y-2">
            <span className="ml-1 block text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
              Arquivo
            </span>
            <span className="flex min-h-[58px] cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition-all hover:border-yellow-300 hover:bg-yellow-50/50">
              <Upload size={18} className="shrink-0 text-[rgb(135,138,28)]" />
              <span className="truncate">{file?.name || "Selecionar PDF ou imagem"}</span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="hidden"
              />
            </span>
          </label>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-500">
          Formatos aceitos: PDF, PNG, JPG ou WEBP. Tamanho máximo: 20 MB.
        </p>
      </div>
    </StandardModal>
  );
}
