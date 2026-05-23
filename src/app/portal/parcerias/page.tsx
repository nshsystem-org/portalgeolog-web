"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  ParceiroServico,
  NovoParceiroInput,
  useData,
} from "@/context/DataContext";
import StandardModal from "@/components/StandardModal";
import {
  Building2,
  Briefcase,
  Edit2,
  Eye,
  Handshake,
  Mail,
  MapPin,
  Phone,
  PlusCircle,
  Trash2,
  Users,
  Plus,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useConfirm } from "@/hooks/useConfirm";
import { useParceiroValidation } from "@/hooks/useParceiroValidation";
import { useParceriasTranslation } from "@/hooks/useTranslation";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  fetchParceirosPage,
  checkParceiroVinculos,
} from "@/lib/supabase/queries";
import { useServerPaginatedTable } from "@/hooks/useServerPaginatedTable";
import {
  formatBrazilPhone,
  normalizeBrazilPhone,
} from "@/lib/phone";
import {
  formatDocument,
} from "@/lib/document-validator";

const PESSOA_TIPO_OPTIONS = [
  { id: "juridica", nome: "Pessoa jurídica" },
  { id: "fisica", nome: "Pessoa física" },
];

const TABLE_PAGE_SIZE = 10;

// Helper functions para eliminar código duplicado
const getPessoaTipoLabels = (pessoaTipo: "fisica" | "juridica") => ({
  razaoSocialLabel: pessoaTipo === "juridica" ? "Razão social" : "Nome completo",
  documentoLabel: pessoaTipo === "juridica" ? "CNPJ" : "CPF",
  documentoPlaceholder: pessoaTipo === "juridica" ? "00.000.000/0001-00" : "000.000.000-00",
  razaoSocialPlaceholder: pessoaTipo === "juridica" ? "Ex: Silva Logística LTDA" : "Ex: João da Silva",
  pessoaTipoLabel: pessoaTipo === "juridica" ? "Pessoa Jurídica" : "Pessoa Física",
});

const formatPhone = (value: string): string => formatBrazilPhone(value);

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightText = (text: string, term: string): React.ReactNode => {
  const cleanTerm = term.trim();

  if (!cleanTerm) {
    return text;
  }

  const regex = new RegExp(`(${escapeRegExp(cleanTerm)})`, "ig");
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark
        key={`${part}-${index}`}
        className="rounded-md bg-amber-100 px-1 text-amber-900"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    ),
  );
};

type ParceiroFormContato = {
  setor: string;
  celular: string;
  email?: string;
  responsavel: string;
};

type ParceiroFormFilial = {
  rotulo: string;
  enderecoCompleto: string;
};

interface ParceiroFormData extends NovoParceiroInput {
  contatos: ParceiroFormContato[];
  filiais: ParceiroFormFilial[];
}

const initialContato = (): ParceiroFormContato => ({
  setor: "",
  celular: "",
  email: "",
  responsavel: "",
});

const initialFilial = (): ParceiroFormFilial => ({
  rotulo: "",
  enderecoCompleto: "",
});

const initialForm = (): ParceiroFormData => ({
  pessoaTipo: "juridica",
  documento: "",
  razaoSocialOuNomeCompleto: "",
  contatos: [initialContato()],
  filiais: [initialFilial()],
});

export default function ParceriasPage() {
  const {
    parceiros,
    addParceiro,
    updateParceiro,
    deleteParceiro,
    unarchiveParceiro,
  } = useData();
  const { confirm, confirmState, closeConfirm, handleConfirm } = useConfirm();
  const { validateForm } = useParceiroValidation(parceiros);
  const t = useParceriasTranslation("pt-BR");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParceiro, setEditingParceiro] =
    useState<ParceiroServico | null>(null);
  const [viewingParceiro, setViewingParceiro] =
    useState<ParceiroServico | null>(null);
  const [formData, setFormData] = useState<ParceiroFormData>(initialForm());
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [isArchivedFilterLoading, setIsArchivedFilterLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Ref para evitar re-renders desnecessários no refresh da tabela
  const parceirosLengthRef = useRef(parceiros.length);
  const prevParceirosLengthRef = useRef(parceiros.length);

  const fetchParceirosPageWithFilters = useCallback(
    (params: { page: number; pageSize: number; searchTerm: string }) =>
      fetchParceirosPage({
        ...params,
        arquivado: showArchivedOnly,
      }),
    [showArchivedOnly],
  );

  const parceiroTable = useServerPaginatedTable(fetchParceirosPageWithFilters, TABLE_PAGE_SIZE);
  const searchTerm = parceiroTable.searchTerm;

  // Monitorar loading do filtro de arquivados
  useEffect(() => {
    if (!isArchivedFilterLoading) return;

    if (!parceiroTable.loading) {
      setIsArchivedFilterLoading(false);
    }
  }, [parceiroTable.loading, isArchivedFilterLoading]);

  // Refresh automático da tabela quando dados mudam via realtime
  // Otimizado com refs para evitar re-renders excessivos
  useEffect(() => {
    parceirosLengthRef.current = parceiros.length;
    
    // Apenas refresh se o comprimento realmente mudou
    if (parceirosLengthRef.current !== prevParceirosLengthRef.current) {
      void parceiroTable.refresh();
      prevParceirosLengthRef.current = parceirosLengthRef.current;
    }
  }, [parceiros.length, parceiroTable]);

  const resetForm = () => {
    setEditingParceiro(null);
    setFormData(initialForm());
  };

  const handleOpenModal = (parceiro?: ParceiroServico) => {
    if (parceiro) {
      setEditingParceiro(parceiro);
      setFormData({
        pessoaTipo: parceiro.pessoaTipo,
        documento: parceiro.documento,
        razaoSocialOuNomeCompleto: parceiro.razaoSocialOuNomeCompleto,
        contatos:
          parceiro.contatos.length > 0
            ? parceiro.contatos.map((contato) => ({
                setor: contato.setor,
                celular: formatBrazilPhone(contato.celular),
                email: contato.email || "",
                responsavel: contato.responsavel,
              }))
            : [initialContato()],
        filiais:
          parceiro.filiais.length > 0
            ? parceiro.filiais.map((filial) => ({
                rotulo: filial.rotulo,
                enderecoCompleto: filial.enderecoCompleto,
              }))
            : [initialFilial()],
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

  const handleInputChange = (
    field: keyof Omit<ParceiroFormData, "contatos" | "filiais">,
    value: string,
  ) => {
    if (field === "documento") {
      setFormData((prev) => ({
        ...prev,
        documento: formatDocument(value, prev.pessoaTipo),
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePessoaTipoChange = (pessoaTipo: "fisica" | "juridica") => {
    setFormData((prev) => ({
      ...prev,
      pessoaTipo,
      documento: formatDocument(prev.documento, pessoaTipo),
      razaoSocialOuNomeCompleto: "",
    }));
  };

  const handleContatoChange = (
    index: number,
    field: keyof ParceiroFormContato,
    value: string,
  ) => {
    const formattedValue = field === "celular" ? formatPhone(value) : value;

    setFormData((prev) => ({
      ...prev,
      contatos: prev.contatos.map((contato, idx) =>
        idx === index ? { ...contato, [field]: formattedValue } : contato,
      ),
    }));
  };

  const handleFilialChange = (
    index: number,
    field: keyof ParceiroFormFilial,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      filiais: prev.filiais.map((filial, idx) =>
        idx === index ? { ...filial, [field]: value } : filial,
      ),
    }));
  };

  const handleAddContato = () => {
    setFormData((prev) => ({
      ...prev,
      contatos: [...prev.contatos, initialContato()],
    }));
  };

  const handleRemoveContato = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      contatos:
        prev.contatos.length > 1
          ? prev.contatos.filter((_, idx) => idx !== index)
          : prev.contatos,
    }));
  };

  const handleAddFilial = () => {
    setFormData((prev) => ({
      ...prev,
      filiais: [...prev.filiais, initialFilial()],
    }));
  };

  const handleRemoveFilial = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      filiais:
        prev.filiais.length > 1
          ? prev.filiais.filter((_, idx) => idx !== index)
          : prev.filiais,
    }));
  };

  const cleanParceiro = (formData: ParceiroFormData): NovoParceiroInput => ({
    pessoaTipo: formData.pessoaTipo,
    documento: formData.documento.trim(),
    razaoSocialOuNomeCompleto: formData.razaoSocialOuNomeCompleto.trim(),
    contatos: formData.contatos.map((contato) => ({
      setor: contato.setor.trim(),
      celular: normalizeBrazilPhone(contato.celular),
      email: contato.email?.trim() || "",
      responsavel: contato.responsavel.trim(),
    })),
    filiais: formData.filiais.map((filial) => ({
      rotulo: filial.rotulo.trim(),
      enderecoCompleto: filial.enderecoCompleto.trim(),
    })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm(formData, editingParceiro?.id);
    if (validationError) {
      toast.error(validationError.message);
      return;
    }

    const cleanForm = cleanParceiro(formData);
    setIsSubmitting(true);

    try {
      if (editingParceiro) {
        await updateParceiro(editingParceiro.id, cleanForm);
        toast.success(t?.sucesso?.atualizado ?? "Parceiro atualizado com sucesso!");
      } else {
        await addParceiro(cleanForm);
        toast.success(t?.sucesso?.criado ?? "Parceiro cadastrado com sucesso!");
      }

      await parceiroTable.refresh();

      handleCloseModal();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Erro ao salvar parceiro:", error);
      
      // Tratamento específico para diferentes tipos de erro
      if (errorMessage.includes("duplicate") || errorMessage.includes("já existe")) {
        toast.error("Já existe um parceiro com esses dados.");
      } else if (errorMessage.includes("permission") || errorMessage.includes("permissão")) {
        toast.error("Você não tem permissão para realizar esta ação.");
      } else if (errorMessage.includes("network") || errorMessage.includes("rede")) {
        toast.error("Erro de conexão. Verifique sua internet.");
      } else {
        toast.error(t?.erros?.salvar ?? "Não foi possível salvar o parceiro.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnarchive = async (id: string) => {
    const parceiro = parceiros.find((p) => p.id === id);
    if (!parceiro) return;

    const confirmed = await confirm({
      title: "Desarquivar Parceiro",
      message: `Tem certeza que deseja desarquivar o parceiro "${parceiro.razaoSocialOuNomeCompleto}"? Ele voltará a aparecer na lista principal.`,
      confirmText: "Sim, desarquivar",
      cancelText: "Cancelar",
      type: "success",
    });

    if (confirmed) {
      try {
        await unarchiveParceiro(id);
        await parceiroTable.refresh();
        setViewingParceiro(null);
        toast.success("Parceiro desarquivado com sucesso!");
      } catch (error) {
        console.error("Erro ao desarquivar parceiro:", error);
        toast.error("Não foi possível desarquivar o parceiro.");
      }
    }
  };

  const handleDelete = async (id: string) => {
    const parceiro = parceiros.find((p) => p.id === id);
    if (!parceiro) return;

    try {
      const vinculos = await checkParceiroVinculos(id);
      if (vinculos.length > 0) {
        const mensagens = vinculos.map(
          (v) => `${v.tabela}: ${v.registros.map((r) => r.nome).join(", ")}`,
        );
        toast.error(
          `Não é possível arquivar este parceiro. Existem vínculos ativos: ${mensagens.join("; ")}`,
        );
        return;
      }
    } catch (err) {
      console.error("Erro ao verificar vínculos do parceiro:", err);
      toast.error("Não foi possível verificar os vínculos. Tente novamente.");
      return;
    }

    const confirmed = await confirm({
      title: "Arquivar Parceiro",
      message: `Tem certeza que deseja arquivar o parceiro "${parceiro.razaoSocialOuNomeCompleto}"? Ele não aparecerá mais na lista, mas poderá ser recuperado posteriormente.`,
      confirmText: "Sim, arquivar",
      cancelText: "Cancelar",
      type: "danger",
    });

    if (confirmed) {
      await deleteParceiro(id);
      await parceiroTable.refresh();
      toast.success("Parceiro arquivado com sucesso!");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Parceiros de Serviço" icon={<Handshake size={20} />} />

      <DataTable
        data={parceiroTable.items}
        loading={parceiroTable.loading}
        searchTerm={parceiroTable.searchTerm}
        onSearchChange={parceiroTable.setSearchTerm}
        disableClientSearch
        pagination={{
          page: parceiroTable.page,
          pageSize: parceiroTable.pageSize,
          totalItems: parceiroTable.totalCount,
          onPageChange: parceiroTable.setPage,
        }}
        actionButton={
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsArchivedFilterLoading(true);
                setShowArchivedOnly((prev) => !prev);
              }}
              className={`flex items-center gap-2 px-4 py-3.5 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all shadow-sm border cursor-pointer shrink-0 ${
                showArchivedOnly
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Archive size={16} />
              {showArchivedOnly ? "Ocultar" : "Arquivados"}
            </button>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-[var(--color-geolog-blue)] text-white px-5 py-3.5 rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer shadow-lg shadow-blue-900/20 whitespace-nowrap"
            >
              <Plus size={18} />
              Novo Parceiro
            </button>
          </div>
        }
        columns={[
          {
            key: "razaoSocialOuNomeCompleto",
            title: "Nome",
            render: (value: unknown) => (
              <div>
                <span className="font-bold text-slate-800 text-base">
                  {highlightText(String(value), searchTerm)}
                </span>
              </div>
            ),
          },
          {
            key: "documento",
            title: "Tipo / Doc",
            width: "140px",
            render: (value: unknown, item: ParceiroServico) => (
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
                  {item.pessoaTipo === "juridica" ? "Jurídica" : "Física"}
                </span>
                <p className="text-sm font-bold text-slate-700 whitespace-nowrap">
                  {String(value)}
                </p>
              </div>
            ),
          },
          {
            key: "contatos",
            title: "Contatos",
            render: (_value: unknown, item: ParceiroServico) => {

              return (
                <div className="text-sm">
                  {item.contatos.slice(0, 1).map((contato) => (
                    <div key={contato.id} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        {highlightText(contato.setor, searchTerm)}
                      </div>
                      <p className="font-bold text-slate-700 text-sm leading-snug">
                        {highlightText(contato.responsavel, searchTerm)}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500 font-medium whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Phone size={12} className="text-blue-500 shrink-0" />{" "}
                          {highlightText(formatPhone(contato.celular), searchTerm)}
                        </span>
                        {contato.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail
                              size={12}
                              className="text-blue-500 shrink-0"
                            />{" "}
                            {highlightText(contato.email, searchTerm)}
                          </span>
                        )}
                      </div>
                      {item.contatos.length > 1 && (
                        <div
                          className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 cursor-pointer hover:text-blue-700 transition-colors pt-0.5"
                          onClick={() => setViewingParceiro(item)}
                        >
                          +{item.contatos.length - 1} contato(s)
                        </div>
                      )}
                    </div>
                  ))}
                  {item.contatos.length === 0 && (
                    <div className="text-slate-400 text-xs">
                      Nenhum contato cadastrado
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            key: "filiais",
            title: "Filiais",
            render: (_value: unknown, item: ParceiroServico) => {

              return (
                <div className="space-y-2">
                  {item.filiais.slice(0, 1).map((filial) => (
                    <div
                      key={filial.id}
                      className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 space-y-1"
                    >
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        <MapPin size={12} className="text-blue-500" />
                        {highlightText(filial.rotulo, searchTerm)}
                      </div>
                      <p className="text-sm font-bold text-slate-700 leading-snug">
                        {highlightText(filial.enderecoCompleto, searchTerm)}
                      </p>
                      {item.filiais.length > 1 && (
                        <div
                          className="pt-1 text-[11px] font-black uppercase tracking-[0.2em] text-blue-500 cursor-pointer hover:text-blue-700 transition-colors"
                          onClick={() => setViewingParceiro(item)}
                        >
                          +{item.filiais.length - 1} filial(is)
                        </div>
                      )}
                    </div>
                  ))}
                  {item.filiais.length === 0 && (
                    <div className="text-slate-400 text-xs">
                      Nenhuma filial cadastrada
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            key: "status",
            title: showArchivedOnly ? "" : "Status",
            align: "center",
            render: (_value: unknown, item: ParceiroServico) => {
              if (showArchivedOnly) {
                return (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs md:text-sm font-bold uppercase tracking-wide border bg-red-50/50 border-red-100 text-red-400">
                    <Archive size={20} />
                    Arquivado
                  </span>
                );
              }

              const status = item.status;
              return (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.15em] ${
                    status === "ativo"
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      : "bg-red-50 text-red-500 border border-red-200"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${status === "ativo" ? "bg-emerald-500" : "bg-red-500"}`}
                  />
                  {status === "ativo" ? "Ativo" : "Inativo"}
                </span>
              );
            },
          },
          {
            key: "acoes",
            title: "Ações",
            align: "center",
            render: (value: unknown, item: ParceiroServico) => (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setViewingParceiro(item)}
                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                  title="Visualizar Parceiro"
                  aria-label={`Visualizar detalhes do parceiro ${item.razaoSocialOuNomeCompleto}`}
                >
                  <Eye size={18} />
                </button>
                {!showArchivedOnly && (
                  <button
                    onClick={() => handleOpenModal(item)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                    title="Editar Parceiro"
                    aria-label={`Editar parceiro ${item.razaoSocialOuNomeCompleto}`}
                  >
                    <Edit2 size={18} />
                  </button>
                )}
                {!showArchivedOnly && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                    title="Arquivar Parceiro"
                    aria-label={`Arquivar parceiro ${item.razaoSocialOuNomeCompleto}`}
                  >
                    <Archive size={18} />
                  </button>
                )}
              </div>
            ),
          },
        ]}
        searchPlaceholder="Buscar por nome, CPF/CNPJ, contato ou cidade..."
        emptyMessage="Nenhum parceiro cadastrado."
        emptyIcon={<Handshake size={48} />}
      />

      {/* Loader do filtro de arquivados */}
      {isArchivedFilterLoading && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 p-16 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-slate-400">
            <Archive size={48} className="text-blue-500 animate-spin" />
            <p className="font-bold text-lg text-slate-500">
              Carregando arquivados...
            </p>
          </div>
        </div>
      )}

      {isModalOpen && (
        <StandardModal
          onClose={handleCloseModal}
          title={editingParceiro ? "Editar Parceiro" : "Novo Parceiro"}
          subtitle="Cadastro de parceiros de serviço para vinculação de motoristas e veículos"
          icon={<Handshake size={24} />}
          maxWidthClassName="max-w-6xl"
          bodyClassName="p-6 md:p-10 pb-16 space-y-8"
        >
          <form onSubmit={handleSubmit} className="space-y-8">
            <section className="space-y-6">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <Building2 size={20} className="text-slate-500" /> Dados
                  principais
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[0.7fr_1.6fr_0.6fr] gap-6">
                <div className="space-y-2">
                  <GeologSearchableSelect
                    label="Tipo de pessoa"
                    options={PESSOA_TIPO_OPTIONS}
                    value={formData.pessoaTipo}
                    onChange={(value) =>
                      handlePessoaTipoChange(value as "fisica" | "juridica")
                    }
                    triggerClassName="px-5 py-3.5 !bg-slate-50 border-2 !border-slate-200 mt-[5px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    {getPessoaTipoLabels(formData.pessoaTipo).razaoSocialLabel}
                  </label>
                  <input
                    required
                    value={formData.razaoSocialOuNomeCompleto}
                    onChange={(event) =>
                      handleInputChange(
                        "razaoSocialOuNomeCompleto",
                        event.target.value,
                      )
                    }
                    placeholder={getPessoaTipoLabels(formData.pessoaTipo).razaoSocialPlaceholder}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[2px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    {getPessoaTipoLabels(formData.pessoaTipo).documentoLabel}
                  </label>
                  <input
                    required
                    value={formData.documento}
                    onChange={(event) =>
                      handleInputChange("documento", event.target.value)
                    }
                    placeholder={getPessoaTipoLabels(formData.pessoaTipo).documentoPlaceholder}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                  />
                </div>
              </div>
            </section>

            <div className="border-b-2 border-slate-100 my-10"></div>

            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3
                    className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                    style={{ lineHeight: "1.3" }}
                  >
                    <Users size={20} className="text-blue-600" /> Contatos por
                    unidade
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleAddContato}
                  className="flex items-center gap-3 px-4 py-3 bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-200 transition-all shadow-sm cursor-pointer"
                  aria-label="Adicionar novo contato"
                >
                  <PlusCircle size={14} /> Novo cadastro
                </button>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="hidden md:grid grid-cols-[1.2fr_0.8fr_1.2fr_1.1fr_auto] gap-4 bg-slate-50/80 border-b border-slate-200 px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-600">
                  <span>Setor</span>
                  <span>Celular</span>
                  <span>E-mail</span>
                  <span>Responsável</span>
                  <span className="text-right">Ações</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto custom-scrollbar">
                  {formData.contatos.map((contato, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_1.2fr_1.1fr_auto] gap-4 items-start px-6 py-5"
                    >
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Setor
                        </label>
                        <input
                          required
                          placeholder="Financeiro, Operação, Compras..."
                          value={contato.setor}
                          onChange={(event) =>
                            handleContatoChange(
                              index,
                              "setor",
                              event.target.value.toUpperCase(),
                            )
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Celular
                        </label>
                        <input
                          required
                          placeholder="(00) 00000-0000"
                          value={contato.celular}
                          onChange={(event) =>
                            handleContatoChange(
                              index,
                              "celular",
                              event.target.value,
                            )
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          E-mail
                        </label>
                        <input
                          type="email"
                          placeholder="contato@empresa.com"
                          value={contato.email || ""}
                          onChange={(event) =>
                            handleContatoChange(
                              index,
                              "email",
                              event.target.value.toLowerCase(),
                            )
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Responsável
                        </label>
                        <input
                          required
                          placeholder="Nome do responsável"
                          value={contato.responsavel}
                          onChange={(event) =>
                            handleContatoChange(
                              index,
                              "responsavel",
                              event.target.value.toUpperCase(),
                            )
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="flex md:pt-1 justify-end">
                        {formData.contatos.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveContato(index)}
                            className="inline-flex items-center justify-center p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            aria-label="Remover contato"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 pt-3">
                            Principal
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="border-b-2 border-slate-100 my-10"></div>

            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3
                    className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                    style={{ lineHeight: "1.3" }}
                  >
                    <MapPin size={20} className="text-blue-600" /> Filiais /
                    endereços
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleAddFilial}
                  className="flex items-center gap-3 px-4 py-3 bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-200 transition-all shadow-sm cursor-pointer"
                  aria-label="Adicionar nova filial"
                >
                  <PlusCircle size={14} /> Nova filial
                </button>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="hidden md:grid grid-cols-[1fr_3fr_auto] gap-4 bg-slate-50/80 border-b border-slate-200 px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-600">
                  <span>Rótulo</span>
                  <span>Endereço completo</span>
                  <span className="text-right">Ações</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto custom-scrollbar">
                  {formData.filiais.map((filial, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-[1fr_3fr_auto] gap-4 items-start px-6 py-5"
                    >
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Rótulo
                        </label>
                        <input
                          placeholder="Matriz, Filial Centro, Depósito..."
                          value={filial.rotulo}
                          onChange={(event) =>
                            handleFilialChange(
                              index,
                              "rotulo",
                              event.target.value.toUpperCase(),
                            )
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Endereço completo
                        </label>
                        <input
                          placeholder="Rua, número, bairro, cidade - UF"
                          value={filial.enderecoCompleto}
                          onChange={(event) =>
                            handleFilialChange(
                              index,
                              "enderecoCompleto",
                              event.target.value,
                            )
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="flex md:pt-1 justify-end">
                        {formData.filiais.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveFilial(index)}
                            className="inline-flex items-center justify-center p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            aria-label="Remover filial"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 pt-3">
                            Principal
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-8 py-4 bg-slate-100 text-slate-700 font-black rounded-xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-12 py-4 bg-[var(--color-geolog-blue)] text-white font-black rounded-xl shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isSubmitting ? "Salvando..." : (editingParceiro ? "Salvar alterações" : "Salvar parceiro")}
              </button>
            </div>
          </form>
        </StandardModal>
      )}

      {viewingParceiro && (
        <StandardModal
          onClose={() => setViewingParceiro(null)}
          title={viewingParceiro.razaoSocialOuNomeCompleto}
          subtitle={`${getPessoaTipoLabels(viewingParceiro.pessoaTipo).pessoaTipoLabel} · ${viewingParceiro.documento}`}
          icon={<Briefcase size={24} />}
          maxWidthClassName="max-w-4xl"
          bodyClassName="p-6 md:p-10 pb-10 space-y-8"
        >
          <section className="space-y-4">
            <h3 className="text-[13px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Users size={14} className="text-blue-500" /> Contatos
            </h3>
            {viewingParceiro.contatos.length === 0 ? (
              <p className="text-sm text-slate-400">
                Nenhum contato cadastrado.
              </p>
            ) : (
              <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="hidden md:grid grid-cols-[1.2fr_0.8fr_1.2fr_1.1fr] gap-4 bg-slate-50/80 border-b border-slate-200 px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-600">
                  <span>Setor</span>
                  <span>Celular</span>
                  <span>E-mail</span>
                  <span>Responsável</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {viewingParceiro.contatos.map((contato) => (
                    <div
                      key={contato.id}
                      className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_1.2fr_1.1fr] gap-4 items-center px-6 py-4"
                    >
                      <div>
                        <span className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">
                          Setor
                        </span>
                        <p className="font-bold text-slate-800 text-sm">
                          {contato.setor}
                        </p>
                      </div>
                      <div>
                        <span className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">
                          Celular
                        </span>
                        <p className="text-sm font-medium text-slate-600 flex items-center gap-1">
                          <Phone size={12} className="text-blue-500" />{" "}
                          {formatPhone(contato.celular)}
                        </p>
                      </div>
                      <div>
                        <span className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">
                          E-mail
                        </span>
                        <p className="text-sm font-medium text-slate-600 flex items-center gap-1">
                          {contato.email ? (
                            <>
                              <Mail
                                size={12}
                                className="text-blue-500 shrink-0"
                              />{" "}
                              {contato.email}
                            </>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">
                          Responsável
                        </span>
                        <p className="font-bold text-slate-800 text-sm">
                          {contato.responsavel}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="border-b-2 border-slate-100 my-2"></div>

          <section className="space-y-4">
            <h3 className="text-[13px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <MapPin size={14} className="text-blue-500" /> Filiais / Endereços
            </h3>
            {viewingParceiro.filiais.length === 0 ? (
              <p className="text-sm text-slate-400">
                Nenhuma filial cadastrada.
              </p>
            ) : (
              <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="hidden md:grid grid-cols-[1fr_3fr] gap-4 bg-slate-50/80 border-b border-slate-200 px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-600">
                  <span>Rótulo</span>
                  <span>Endereço completo</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {viewingParceiro.filiais.map((filial) => (
                    <div
                      key={filial.id}
                      className="grid grid-cols-1 md:grid-cols-[1fr_3fr] gap-4 items-center px-6 py-4"
                    >
                      <div>
                        <span className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">
                          Rótulo
                        </span>
                        <p className="font-bold text-slate-800 text-sm flex items-center gap-1">
                          <MapPin
                            size={12}
                            className="text-blue-500 shrink-0"
                          />{" "}
                          {filial.rotulo}
                        </p>
                      </div>
                      <div>
                        <span className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">
                          Endereço completo
                        </span>
                        <p className="text-sm font-medium text-slate-700">
                          {filial.enderecoCompleto || (
                            <span className="text-slate-300">—</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="flex justify-end gap-3 pt-2">
            {showArchivedOnly ? (
              <button
                type="button"
                onClick={() => {
                  if (viewingParceiro) {
                    void handleUnarchive(viewingParceiro.id);
                  }
                }}
                className="px-6 py-3 bg-emerald-50 text-emerald-700 font-black rounded-xl hover:bg-emerald-100 transition-all text-sm uppercase tracking-widest cursor-pointer flex items-center gap-2"
              >
                <ArchiveRestore size={14} /> Desarquivar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setViewingParceiro(null);
                  handleOpenModal(viewingParceiro);
                }}
                className="px-6 py-3 bg-blue-50 text-blue-700 font-black rounded-xl hover:bg-blue-100 transition-all text-sm uppercase tracking-widest cursor-pointer flex items-center gap-2"
              >
                <Edit2 size={14} /> Editar
              </button>
            )}
            <button
              type="button"
              onClick={() => setViewingParceiro(null)}
              className="px-8 py-3 bg-slate-100 text-slate-700 font-black rounded-xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </StandardModal>
      )}

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
      />
    </div>
  );
}
