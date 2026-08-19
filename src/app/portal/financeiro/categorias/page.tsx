"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowUpCircle,
  ArrowDownCircle,
  Edit2,
  Plus,
  RotateCcw,
  Tags,
} from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import StandardModal from "@/components/StandardModal";
import RequiredAsterisk from "@/components/ui/RequiredAsterisk";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useConfirm } from "@/hooks/useConfirm";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { useAuth } from "@/context/AuthContext";
import { hasPageAccess, hasPageAction } from "@/lib/permissions";
import { useServerPaginatedTable } from "@/hooks/useServerPaginatedTable";
import { toast } from "sonner";
import {
  fetchCaixaCategoriasPaginated,
  insertCaixaCategoria,
  updateCaixaCategoria,
  setCaixaCategoriaAtivo,
  type CaixaCategoria,
} from "@/lib/supabase/queries";

type CategoriaTipo = "entrada" | "saida" | "ambos";

const TIPO_OPTIONS: Array<{ id: CategoriaTipo; nome: string }> = [
  { id: "entrada", nome: "Entrada" },
  { id: "saida", nome: "Saída" },
  { id: "ambos", nome: "Ambos" },
];

const TIPO_FILTER_OPTIONS: Array<{ id: string; nome: string }> = [
  { id: "todos", nome: "Todos os tipos" },
  { id: "entrada", nome: "Entrada" },
  { id: "saida", nome: "Saída" },
  { id: "ambos", nome: "Ambos" },
];

const TABLE_PAGE_SIZE = 10;

type CategoriaFormData = {
  nome: string;
  tipo: CategoriaTipo;
  ordem: number;
};

const initialForm = (): CategoriaFormData => ({
  nome: "",
  tipo: "saida",
  ordem: 0,
});

export default function CategoriasCaixaPage() {
  const { profile } = useAuth();
  const { confirm, confirmState, closeConfirm, handleConfirm } = useConfirm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] =
    useState<CaixaCategoria | null>(null);
  const [formData, setFormData] = useState<CategoriaFormData>(initialForm());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showInativosOnly, setShowInativosOnly] = useState(false);
  const [isInativosFilterLoading, setIsInativosFilterLoading] = useState(false);
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [isTipoFilterLoading, setIsTipoFilterLoading] = useState(false);

  const fetchCategoriasPage = useCallback(
    (params: { page: number; pageSize: number; searchTerm: string }) =>
      fetchCaixaCategoriasPaginated({
        page: params.page,
        pageSize: params.pageSize,
        searchTerm: params.searchTerm,
        showInativos: showInativosOnly,
        tipo:
          tipoFilter === "todos" ? undefined : (tipoFilter as CategoriaTipo),
      }),
    [showInativosOnly, tipoFilter],
  );

  const categoriaTable = useServerPaginatedTable(
    fetchCategoriasPage,
    TABLE_PAGE_SIZE,
  );

  useEffect(() => {
    if (!isInativosFilterLoading) return;
    if (!categoriaTable.loading) setIsInativosFilterLoading(false);
  }, [categoriaTable.loading, isInativosFilterLoading]);

  useEffect(() => {
    if (!isTipoFilterLoading) return;
    if (!categoriaTable.loading) setIsTipoFilterLoading(false);
  }, [categoriaTable.loading, isTipoFilterLoading]);

  const canCreate = hasPageAction(profile, "categorias-caixa", "create");
  const canDelete =
    hasPageAction(profile, "categorias-caixa", "delete") ||
    hasPageAction(profile, "categorias-caixa", "sensitive");

  if (!hasPageAccess(profile, "categorias-caixa")) {
    return <AccessDenied module="Financeiro" />;
  }

  const resetForm = () => {
    setEditingCategoria(null);
    setFormData(initialForm());
  };

  const handleOpenModal = (categoria?: CaixaCategoria) => {
    if (categoria) {
      setEditingCategoria(categoria);
      setFormData({
        nome: categoria.nome,
        tipo: categoria.tipo,
        ordem: categoria.ordem,
      });
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
      toast.error("Informe o nome da categoria.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingCategoria) {
        await updateCaixaCategoria(editingCategoria.id, {
          nome: nomeTrim,
          tipo: formData.tipo,
          ordem: formData.ordem,
        });
        toast.success("Categoria atualizada com sucesso!");
      } else {
        await insertCaixaCategoria(nomeTrim, formData.tipo, formData.ordem);
        toast.success("Categoria criada com sucesso!");
      }
      await categoriaTable.refresh();
      handleCloseModal();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("Já existe uma categoria com esse nome para este tipo.");
      } else {
        toast.error("Não foi possível salvar a categoria.");
        console.error(error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleAtivo = async (categoria: CaixaCategoria) => {
    const nextAtivo = !categoria.ativo;
    const action = nextAtivo ? "Desarquivar" : "Arquivar";
    const confirmed = await confirm({
      title: `${action} Categoria`,
      message: `Tem certeza que deseja ${action.toLowerCase()} a categoria "${categoria.nome}"?`,
      confirmText: `Sim, ${action.toLowerCase()}`,
      cancelText: "Cancelar",
      type: nextAtivo ? "success" : "danger",
    });
    if (!confirmed) return;
    try {
      await setCaixaCategoriaAtivo(categoria.id, nextAtivo);
      await categoriaTable.refresh();
      toast.success(
        `Categoria ${nextAtivo ? "desarquivada" : "arquivada"} com sucesso!`,
      );
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível alterar o status da categoria.");
    }
  };

  const tipoLabel = (tipo: CategoriaTipo): string =>
    TIPO_OPTIONS.find((t) => t.id === tipo)?.nome ?? tipo;

  const TipoIcon = ({ tipo }: { tipo: CategoriaTipo }) => {
    if (tipo === "entrada")
      return <ArrowUpCircle size={14} className="text-emerald-500" />;
    if (tipo === "saida")
      return <ArrowDownCircle size={14} className="text-red-500" />;
    return (
      <div className="flex items-center gap-0.5">
        <ArrowUpCircle size={12} className="text-emerald-500" />
        <ArrowDownCircle size={12} className="text-red-500" />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Categorias do Caixa" icon={<Tags size={20} />} />

      <DataTable
        data={categoriaTable.items}
        loading={categoriaTable.loading}
        searchTerm={categoriaTable.searchTerm}
        onSearchChange={categoriaTable.setSearchTerm}
        disableClientSearch
        pagination={{
          page: categoriaTable.page,
          pageSize: categoriaTable.pageSize,
          totalItems: categoriaTable.totalCount,
          onPageChange: categoriaTable.setPage,
        }}
        actionButton={
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={tipoFilter}
              onChange={(e) => {
                setIsTipoFilterLoading(true);
                setTipoFilter(e.target.value);
              }}
              className="px-4 py-3.5 rounded-2xl font-bold text-sm uppercase tracking-widest border border-slate-200 bg-white text-slate-600 cursor-pointer outline-none transition-all hover:bg-slate-50 focus:border-blue-400"
            >
              {TIPO_FILTER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.nome}
                </option>
              ))}
            </select>
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
            {canCreate && (
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 bg-[var(--color-geolog-blue)] text-white px-5 py-3.5 rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer shadow-lg shadow-blue-900/20 whitespace-nowrap"
              >
                <Plus size={18} />
                Nova Categoria
              </button>
            )}
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
              <span className="font-bold text-slate-800 text-base">
                {String(value)}
              </span>
            ),
          },
          {
            key: "tipo",
            title: "Tipo",
            width: "200px",
            render: (value: unknown) => {
              const tipo = value as CategoriaTipo;
              return (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.15em] ${
                    tipo === "entrada"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : tipo === "saida"
                        ? "bg-red-50 text-red-600 border border-red-200"
                        : "bg-violet-50 text-violet-600 border border-violet-200"
                  }`}
                >
                  <TipoIcon tipo={tipo} />
                  {tipoLabel(tipo)}
                </span>
              );
            },
          },
          {
            key: "ativo",
            title: "Status",
            width: "180px",
            align: "center",
            render: (value: unknown, item: CaixaCategoria) => (
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
            render: (_value: unknown, item: CaixaCategoria) => (
              <div className="flex items-center justify-center gap-2">
                {item.ativo && canCreate && (
                  <button
                    onClick={() => handleOpenModal(item)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                    title="Editar Categoria"
                    aria-label={`Editar categoria ${item.nome}`}
                  >
                    <Edit2 size={18} />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleToggleAtivo(item)}
                    className={`p-2 rounded-lg transition-all cursor-pointer ${
                      item.ativo
                        ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
                        : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                    }`}
                    title={
                      item.ativo
                        ? "Arquivar Categoria"
                        : "Desarquivar Categoria"
                    }
                    aria-label={`${item.ativo ? "Arquivar" : "Desarquivar"} categoria ${item.nome}`}
                  >
                    {item.ativo ? (
                      <Archive size={18} />
                    ) : (
                      <ArchiveRestore size={18} />
                    )}
                  </button>
                )}
              </div>
            ),
          },
        ]}
        searchPlaceholder="Buscar por nome ou slug..."
        emptyMessage="Nenhuma categoria encontrada."
        emptyIcon={<Tags size={48} />}
      />

      {(isInativosFilterLoading || isTipoFilterLoading) && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 p-16 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-slate-400">
            <RotateCcw size={40} className="text-blue-500 animate-spin" />
            <p className="font-bold text-lg text-slate-500">
              Carregando categorias...
            </p>
          </div>
        </div>
      )}

      {isModalOpen && (
        <StandardModal
          onClose={handleCloseModal}
          title={editingCategoria ? "Editar Categoria" : "Nova Categoria"}
          subtitle="Categorias usadas nos lançamentos do Fluxo de Caixa"
          icon={<Tags size={24} />}
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
                form="categoria-form"
                disabled={isSubmitting}
                className="px-8 py-3 bg-[var(--color-geolog-blue)] text-white font-black rounded-xl shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isSubmitting
                  ? "Salvando..."
                  : editingCategoria
                    ? "Atualizar"
                    : "Criar Categoria"}
              </button>
            </div>
          }
        >
          <form
            id="categoria-form"
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  placeholder="Ex: Combustível, Repasse a Motorista..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-900 shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 block mb-2">
                  Tipo <RequiredAsterisk />
                </label>
                <div className="flex flex-wrap gap-2">
                  {TIPO_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, tipo: t.id }))
                      }
                      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black transition-all cursor-pointer ${
                        formData.tipo === t.id
                          ? "border-blue-400 bg-blue-100 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <TipoIcon tipo={t.id} />
                      {t.nome}
                    </button>
                  ))}
                </div>
              </div>
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
