"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CreditCard,
  Edit2,
  Plus,
  RotateCcw,
} from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import StandardModal from "@/components/StandardModal";
import RequiredAsterisk from "@/components/ui/RequiredAsterisk";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useConfirm } from "@/hooks/useConfirm";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { useAuth } from "@/context/AuthContext";
import { hasPageAccess } from "@/lib/permissions";
import { useServerPaginatedTable } from "@/hooks/useServerPaginatedTable";
import { toast } from "sonner";
import {
  fetchCaixaFormasPagamentoPaginated,
  insertCaixaFormaPagamento,
  updateCaixaFormaPagamento,
  setCaixaFormaPagamentoAtivo,
  type CaixaFormaPagamento,
} from "@/lib/supabase/queries";

const TABLE_PAGE_SIZE = 10;

type FormaFormData = {
  nome: string;
  ordem: number;
};

const initialForm = (): FormaFormData => ({
  nome: "",
  ordem: 0,
});

export default function FormasPagamentoPage() {
  const { profile } = useAuth();
  const { confirm, confirmState, closeConfirm, handleConfirm } = useConfirm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingForma, setEditingForma] =
    useState<CaixaFormaPagamento | null>(null);
  const [formData, setFormData] = useState<FormaFormData>(initialForm());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showInativosOnly, setShowInativosOnly] = useState(false);
  const [isInativosFilterLoading, setIsInativosFilterLoading] =
    useState(false);

  const fetchFormasPage = useCallback(
    (params: { page: number; pageSize: number; searchTerm: string }) =>
      fetchCaixaFormasPagamentoPaginated({
        page: params.page,
        pageSize: params.pageSize,
        searchTerm: params.searchTerm,
        showInativos: showInativosOnly,
      }),
    [showInativosOnly],
  );

  const formaTable = useServerPaginatedTable(
    fetchFormasPage,
    TABLE_PAGE_SIZE,
  );

  useEffect(() => {
    if (!isInativosFilterLoading) return;
    if (!formaTable.loading) setIsInativosFilterLoading(false);
  }, [formaTable.loading, isInativosFilterLoading]);

  if (!hasPageAccess(profile, "formas-pagamento")) {
    return <AccessDenied module="Financeiro" />;
  }

  const resetForm = () => {
    setEditingForma(null);
    setFormData(initialForm());
  };

  const handleOpenModal = (forma?: CaixaFormaPagamento) => {
    if (forma) {
      setEditingForma(forma);
      setFormData({ nome: forma.nome, ordem: forma.ordem });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeTrim = formData.nome.trim();
    if (!nomeTrim) {
      toast.error("Informe o nome da forma de pagamento.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingForma) {
        await updateCaixaFormaPagamento(editingForma.id, {
          nome: nomeTrim,
          ordem: formData.ordem,
        });
        toast.success("Forma de pagamento atualizada com sucesso!");
      } else {
        await insertCaixaFormaPagamento(nomeTrim, formData.ordem);
        toast.success("Forma de pagamento criada com sucesso!");
      }
      await formaTable.refresh();
      handleCloseModal();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("Já existe uma forma de pagamento com esse nome.");
      } else {
        toast.error("Não foi possível salvar a forma de pagamento.");
        console.error(error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleAtivo = async (forma: CaixaFormaPagamento) => {
    const nextAtivo = !forma.ativo;
    const action = nextAtivo ? "Desarquivar" : "Arquivar";
    const confirmed = await confirm({
      title: `${action} Forma de Pagamento`,
      message: `Tem certeza que deseja ${action.toLowerCase()} a forma de pagamento "${forma.nome}"?`,
      confirmText: `Sim, ${action.toLowerCase()}`,
      cancelText: "Cancelar",
      type: nextAtivo ? "success" : "danger",
    });
    if (!confirmed) return;
    try {
      await setCaixaFormaPagamentoAtivo(forma.id, nextAtivo);
      await formaTable.refresh();
      toast.success(`Forma de pagamento ${nextAtivo ? "desarquivada" : "arquivada"} com sucesso!`);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível alterar o status da forma de pagamento.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Formas de Pagamento"
        icon={<CreditCard size={20} />}
      />

      <DataTable
        data={formaTable.items}
        loading={formaTable.loading}
        searchTerm={formaTable.searchTerm}
        onSearchChange={formaTable.setSearchTerm}
        disableClientSearch
        pagination={{
          page: formaTable.page,
          pageSize: formaTable.pageSize,
          totalItems: formaTable.totalCount,
          onPageChange: formaTable.setPage,
        }}
        actionButton={
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsInativosFilterLoading(true);
                setShowInativosOnly((prev) => !prev);
              }}
              className={`flex items-center gap-2 px-4 py-3.5 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all shadow-sm border cursor-pointer shrink-0 ${
                showInativosOnly
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Archive size={16} />
              {showInativosOnly ? "Ocultar" : "Arquivadas"}
            </button>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-[var(--color-geolog-blue)] text-white px-5 py-3.5 rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer shadow-lg shadow-blue-900/20 whitespace-nowrap"
            >
              <Plus size={18} />
              Nova Forma
            </button>
          </div>
        }
        columns={[
          {
            key: "ordem",
            title: "",
            width: "80px",
            align: "center",
            render: (value: unknown) => (
              <span className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1 rounded-xl bg-slate-100 text-sm font-black text-slate-700 tabular-nums border border-slate-200">
                {Number(value)}
              </span>
            ),
          },
          {
            key: "nome",
            title: "Nome",
            width: "auto",
            render: (value: unknown) => (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
                  <CreditCard size={16} />
                </div>
                <span className="font-bold text-slate-800 text-base">
                  {String(value)}
                </span>
              </div>
            ),
          },
          {
            key: "ativo",
            title: "Status",
            width: "200px",
            align: "center",
            render: (_value: unknown, item: CaixaFormaPagamento) => (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.15em] ${
                  item.ativo
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : "bg-slate-100 text-slate-500 border border-slate-200"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${item.ativo ? "bg-emerald-500" : "bg-slate-400"}`}
                />
                {item.ativo ? "Ativo" : "Arquivado"}
              </span>
            ),
          },
          {
            key: "acoes",
            title: "Ações",
            align: "center",
            width: "160px",
            render: (_value: unknown, item: CaixaFormaPagamento) => (
              <div className="flex items-center justify-center gap-2">
                {item.ativo && (
                  <button
                    onClick={() => handleOpenModal(item)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                    title="Editar Forma de Pagamento"
                    aria-label={`Editar forma de pagamento ${item.nome}`}
                  >
                    <Edit2 size={18} />
                  </button>
                )}
                <button
                  onClick={() => handleToggleAtivo(item)}
                  className={`p-2 rounded-lg transition-all cursor-pointer ${
                    item.ativo
                      ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
                      : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                  }`}
                  title={item.ativo ? "Arquivar" : "Desarquivar"}
                  aria-label={`${item.ativo ? "Arquivar" : "Desarquivar"} forma de pagamento ${item.nome}`}
                >
                  {item.ativo ? <Archive size={18} /> : <ArchiveRestore size={18} />}
                </button>
              </div>
            ),
          },
        ]}
        searchPlaceholder="Buscar por nome ou slug..."
        emptyMessage="Nenhuma forma de pagamento encontrada."
        emptyIcon={<CreditCard size={48} />}
      />

      {isInativosFilterLoading && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 p-16 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-slate-400">
            <RotateCcw size={40} className="text-blue-500 animate-spin" />
            <p className="font-bold text-lg text-slate-500">
              Carregando formas de pagamento...
            </p>
          </div>
        </div>
      )}

      {isModalOpen && (
        <StandardModal
          onClose={handleCloseModal}
          title={editingForma ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}
          subtitle="Formas de pagamento usadas nos lançamentos do Fluxo de Caixa"
          icon={<CreditCard size={24} />}
          maxWidthClassName="max-w-2xl"
          bodyClassName="p-6 md:p-8 space-y-6"
          footer={
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-4 shrink-0">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-6 py-3 text-slate-600 font-bold hover:text-slate-900 transition-colors text-sm uppercase tracking-widest cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="forma-form"
                disabled={isSubmitting}
                className="px-8 py-3 bg-[var(--color-geolog-blue)] text-white font-black rounded-xl shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isSubmitting
                  ? "Salvando..."
                  : editingForma
                    ? "Atualizar"
                    : "Criar Forma"}
              </button>
            </div>
          }
        >
          <form id="forma-form" onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-1 block mb-2">
                Nome <RequiredAsterisk />
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, nome: e.target.value }))
                }
                placeholder="Ex: Pix, Dinheiro, Cartão de Crédito..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-900 shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 block mb-2">
                Ordem
              </label>
              <input
                type="number"
                min={0}
                value={formData.ordem}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    ordem: Number(e.target.value) || 0,
                  }))
                }
                className="w-full md:w-48 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-900 shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 tabular-nums"
              />
              <p className="mt-2 text-xs text-slate-400">
                Menor número aparece primeiro nas listagens.
              </p>
            </div>
          </form>
        </StandardModal>
      )}

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
        onConfirm={handleConfirm}
        onClose={closeConfirm}
      />
    </div>
  );
}
