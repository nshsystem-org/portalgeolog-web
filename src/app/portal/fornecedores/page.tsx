"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Package,
  Edit2,
  Archive,
  ArchiveRestore,
  Plus,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
} from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import StandardModal from "@/components/StandardModal";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import RequiredAsterisk from "@/components/ui/RequiredAsterisk";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useConfirm } from "@/hooks/useConfirm";
import { useFornecedores } from "@/hooks/useFornecedores";
import {
  useFornecedorValidation,
  type FornecedorFormData,
} from "@/hooks/useFornecedorValidation";
import { PageHeader } from "@/components/ui/PageHeader";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { hasPageAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/ui/AccessDenied";
import {
  fetchFornecedoresPage,
  insertFornecedor,
  updateFornecedorInDB,
  archiveFornecedorFromDB,
  unarchiveFornecedorFromDB,
  type Fornecedor,
} from "@/lib/supabase/queries";
import { useServerPaginatedTable } from "@/hooks/useServerPaginatedTable";
import { formatBrazilPhone, normalizeBrazilPhone } from "@/lib/phone";
import { formatDocument } from "@/lib/document-validator";

const PESSOA_TIPO_OPTIONS = [
  { id: "juridica", nome: "Pessoa jurídica" },
  { id: "fisica", nome: "Pessoa física" },
];

const UF_OPTIONS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
].map((uf) => ({ id: uf, nome: uf }));

const TABLE_PAGE_SIZE = 10;

const getPessoaTipoLabels = (pessoaTipo: "fisica" | "juridica") => ({
  nomeLabel: pessoaTipo === "juridica" ? "Razão social" : "Nome completo",
  documentoLabel: pessoaTipo === "juridica" ? "CNPJ" : "CPF",
  documentoPlaceholder:
    pessoaTipo === "juridica" ? "00.000.000/0001-00" : "000.000.000-00",
  nomePlaceholder:
    pessoaTipo === "juridica"
      ? "Ex: Silva Insumos Agrícolas LTDA"
      : "Ex: João da Silva",
});

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightText = (text: string, term: string): React.ReactNode => {
  const cleanTerm = term.trim();
  if (!cleanTerm) return text;
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

const initialForm = (): FornecedorFormData => ({
  nome: "",
  pessoaTipo: "juridica",
  documento: "",
  telefone: "",
  email: "",
  endereco: "",
  cidade: "",
  estado: "",
  cep: "",
  observacoes: "",
});

export default function FornecedoresPage() {
  const { profile } = useAuth();
  const { fornecedores } = useFornecedores();
  const { confirm, confirmState, closeConfirm, handleConfirm } = useConfirm();
  const { validateForm } = useFornecedorValidation(fornecedores);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] =
    useState<Fornecedor | null>(null);
  const [formData, setFormData] = useState<FornecedorFormData>(initialForm());
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [isArchivedFilterLoading, setIsArchivedFilterLoading] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fornecedoresLengthRef = useRef(fornecedores.length);
  const prevFornecedoresLengthRef = useRef(fornecedores.length);

  const fetchFornecedoresPageWithFilters = useCallback(
    (params: { page: number; pageSize: number; searchTerm: string }) =>
      fetchFornecedoresPage({
        ...params,
        arquivado: showArchivedOnly,
      }),
    [showArchivedOnly],
  );

  const fornecedorTable = useServerPaginatedTable(
    fetchFornecedoresPageWithFilters,
    TABLE_PAGE_SIZE,
  );
  const searchTerm = fornecedorTable.searchTerm;

  useEffect(() => {
    if (!isArchivedFilterLoading) return;
    if (!fornecedorTable.loading) {
      setIsArchivedFilterLoading(false);
    }
  }, [fornecedorTable.loading, isArchivedFilterLoading]);

  useEffect(() => {
    fornecedoresLengthRef.current = fornecedores.length;
    if (
      fornecedoresLengthRef.current !== prevFornecedoresLengthRef.current
    ) {
      void fornecedorTable.refresh();
      prevFornecedoresLengthRef.current = fornecedores.length;
    }
  }, [fornecedores.length, fornecedorTable]);

  if (!hasPageAccess(profile, "fornecedores")) {
    return <AccessDenied module="Cadastros" />;
  }

  const resetForm = () => {
    setEditingFornecedor(null);
    setFormData(initialForm());
  };

  const handleOpenModal = (fornecedor?: Fornecedor) => {
    if (fornecedor) {
      setEditingFornecedor(fornecedor);
      setFormData({
        nome: fornecedor.nome,
        pessoaTipo: fornecedor.pessoaTipo,
        documento: fornecedor.documento,
        telefone: fornecedor.telefone ? formatBrazilPhone(fornecedor.telefone) : "",
        email: fornecedor.email,
        endereco: fornecedor.endereco,
        cidade: fornecedor.cidade,
        estado: fornecedor.estado,
        cep: fornecedor.cep,
        observacoes: fornecedor.observacoes,
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
    field: keyof FornecedorFormData,
    value: string,
  ) => {
    if (field === "documento") {
      setFormData((prev) => ({
        ...prev,
        documento: formatDocument(value, prev.pessoaTipo),
      }));
      return;
    }
    if (field === "telefone") {
      setFormData((prev) => ({
        ...prev,
        telefone: formatBrazilPhone(value),
      }));
      return;
    }
    if (field === "email") {
      setFormData((prev) => ({ ...prev, email: value.toLowerCase() }));
      return;
    }
    if (field === "estado") {
      setFormData((prev) => ({ ...prev, estado: value.toUpperCase() }));
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePessoaTipoChange = (pessoaTipo: "fisica" | "juridica") => {
    setFormData((prev) => ({
      ...prev,
      pessoaTipo,
      documento: formatDocument(prev.documento, pessoaTipo),
    }));
  };

  const cleanFornecedor = (
    formData: FornecedorFormData,
  ) => ({
    nome: formData.nome.trim(),
    pessoaTipo: formData.pessoaTipo,
    documento: formData.documento.trim(),
    telefone: normalizeBrazilPhone(formData.telefone),
    email: formData.email.trim(),
    endereco: formData.endereco.trim(),
    cidade: formData.cidade.trim(),
    estado: formData.estado.trim(),
    cep: formData.cep.trim(),
    observacoes: formData.observacoes.trim(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm(formData, editingFornecedor?.id);
    if (validationError) {
      toast.error(validationError.message);
      return;
    }

    const cleanForm = cleanFornecedor(formData);
    setIsSubmitting(true);

    try {
      if (editingFornecedor) {
        await updateFornecedorInDB(editingFornecedor.id, cleanForm);
        toast.success("Fornecedor atualizado com sucesso!");
      } else {
        await insertFornecedor(cleanForm);
        toast.success("Fornecedor cadastrado com sucesso!");
      }

      await fornecedorTable.refresh();
      handleCloseModal();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Erro ao salvar fornecedor:", error);

      if (
        errorMessage.includes("duplicate") ||
        errorMessage.includes("já existe")
      ) {
        toast.error("Já existe um fornecedor com esses dados.");
      } else if (
        errorMessage.includes("permission") ||
        errorMessage.includes("permissão")
      ) {
        toast.error("Você não tem permissão para realizar esta ação.");
      } else {
        toast.error("Não foi possível salvar o fornecedor.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnarchive = async (id: string) => {
    const fornecedor =
      fornecedorTable.items.find((f) => f.id === id) ??
      fornecedores.find((f) => f.id === id);
    if (!fornecedor) return;

    const confirmed = await confirm({
      title: "Desarquivar Fornecedor",
      message: `Tem certeza que deseja desarquivar o fornecedor "${fornecedor.nome}"? Ele voltará a aparecer na lista principal.`,
      confirmText: "Sim, desarquivar",
      cancelText: "Cancelar",
      type: "success",
    });

    if (confirmed) {
      try {
        await unarchiveFornecedorFromDB(id);
        await fornecedorTable.refresh();
        toast.success("Fornecedor desarquivado com sucesso!");
      } catch (error) {
        console.error("Erro ao desarquivar fornecedor:", error);
        toast.error("Não foi possível desarquivar o fornecedor.");
      }
    }
  };

  const handleDelete = async (id: string) => {
    const fornecedor =
      fornecedorTable.items.find((f) => f.id === id) ??
      fornecedores.find((f) => f.id === id);
    if (!fornecedor) return;

    const confirmed = await confirm({
      title: "Arquivar Fornecedor",
      message: `Tem certeza que deseja arquivar o fornecedor "${fornecedor.nome}"? Ele não aparecerá mais na lista, mas poderá ser recuperado posteriormente.`,
      confirmText: "Sim, arquivar",
      cancelText: "Cancelar",
      type: "danger",
    });

    if (confirmed) {
      try {
        await archiveFornecedorFromDB(id);
        await fornecedorTable.refresh();
        toast.success("Fornecedor arquivado com sucesso!");
      } catch (error) {
        console.error("Erro ao arquivar fornecedor:", error);
        toast.error("Não foi possível arquivar o fornecedor.");
      }
    }
  };

  const labels = getPessoaTipoLabels(formData.pessoaTipo);

  return (
    <div className="space-y-6">
      <PageHeader title="Fornecedores" icon={<Package size={20} />} />

      <DataTable
        data={fornecedorTable.items}
        loading={fornecedorTable.loading}
        searchTerm={fornecedorTable.searchTerm}
        onSearchChange={fornecedorTable.setSearchTerm}
        disableClientSearch
        pagination={{
          page: fornecedorTable.page,
          pageSize: fornecedorTable.pageSize,
          totalItems: fornecedorTable.totalCount,
          onPageChange: fornecedorTable.setPage,
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
              Novo Fornecedor
            </button>
          </div>
        }
        columns={[
          {
            key: "nome",
            title: "Nome / Razão Social",
            render: (value: unknown, item: Fornecedor) => (
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    item.pessoaTipo === "juridica"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-violet-50 text-violet-600"
                  }`}
                >
                  {item.pessoaTipo === "juridica" ? (
                    <Building2 size={16} />
                  ) : (
                    <User size={16} />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-slate-800 text-base block">
                    {highlightText(String(value), searchTerm)}
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                    {item.pessoaTipo === "juridica"
                      ? "Pessoa Jurídica"
                      : "Pessoa Física"}
                  </span>
                </div>
              </div>
            ),
          },
          {
            key: "documento",
            title: "CNPJ / CPF",
            width: "180px",
            render: (value: unknown) =>
              value ? (
                <p className="text-sm font-bold text-slate-700 whitespace-nowrap">
                  {highlightText(String(value), searchTerm)}
                </p>
              ) : (
                <span className="text-slate-300 text-sm">—</span>
              ),
          },
          {
            key: "contato",
            title: "Contato",
            render: (_value: unknown, item: Fornecedor) => (
              <div className="flex flex-col gap-1 text-sm">
                {item.telefone && (
                  <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium whitespace-nowrap">
                    <Phone size={12} className="text-blue-500 shrink-0" />
                    {highlightText(formatBrazilPhone(item.telefone), searchTerm)}
                  </span>
                )}
                {item.email && (
                  <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium truncate">
                    <Mail size={12} className="text-blue-500 shrink-0" />
                    {highlightText(item.email, searchTerm)}
                  </span>
                )}
                {!item.telefone && !item.email && (
                  <span className="text-slate-300 text-xs">
                    Sem contato cadastrado
                  </span>
                )}
              </div>
            ),
          },
          {
            key: "localizacao",
            title: "Localização",
            render: (_value: unknown, item: Fornecedor) => {
              const local = [item.cidade, item.estado]
                .filter(Boolean)
                .join(" - ");
              if (!local) {
                return <span className="text-slate-300 text-sm">—</span>;
              }
              return (
                <div className="flex items-center gap-1.5 text-sm text-slate-600 font-medium">
                  <MapPin size={12} className="text-blue-500 shrink-0" />
                  {highlightText(local, searchTerm)}
                </div>
              );
            },
          },
          {
            key: "status",
            title: showArchivedOnly ? "" : "Status",
            align: "center",
            render: (_value: unknown, item: Fornecedor) => {
              if (showArchivedOnly) {
                return (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs md:text-sm font-bold uppercase tracking-wide border bg-red-50/50 border-red-100 text-red-400">
                    <Archive size={20} />
                    Arquivado
                  </span>
                );
              }
              return (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.15em] ${
                    item.status === "ativo"
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      : "bg-red-50 text-red-500 border border-red-200"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${item.status === "ativo" ? "bg-emerald-500" : "bg-red-500"}`}
                  />
                  {item.status === "ativo" ? "Ativo" : "Inativo"}
                </span>
              );
            },
          },
          {
            key: "acoes",
            title: "Ações",
            align: "center",
            render: (_value: unknown, item: Fornecedor) => (
              <div className="flex items-center justify-center gap-2">
                {!showArchivedOnly && (
                  <button
                    onClick={() => handleOpenModal(item)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                    title="Editar Fornecedor"
                    aria-label={`Editar fornecedor ${item.nome}`}
                  >
                    <Edit2 size={18} />
                  </button>
                )}
                {!showArchivedOnly && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                    title="Arquivar Fornecedor"
                    aria-label={`Arquivar fornecedor ${item.nome}`}
                  >
                    <Archive size={18} />
                  </button>
                )}
                {showArchivedOnly && (
                  <button
                    onClick={() => handleUnarchive(item.id)}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                    title="Desarquivar Fornecedor"
                    aria-label={`Desarquivar fornecedor ${item.nome}`}
                  >
                    <ArchiveRestore size={18} />
                  </button>
                )}
              </div>
            ),
          },
        ]}
        searchPlaceholder="Buscar por nome, CNPJ/CPF, contato ou cidade..."
        emptyMessage="Nenhum fornecedor cadastrado."
        emptyIcon={<Package size={48} />}
      />

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
          title={editingFornecedor ? "Editar Fornecedor" : "Novo Fornecedor"}
          subtitle="Cadastro de fornecedores para vinculação em lançamentos de caixa"
          icon={<Package size={24} />}
          maxWidthClassName="max-w-4xl"
          bodyClassName="p-6 md:p-10 pb-16 space-y-8"
          footer={
            <div className="p-8 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-5 shrink-0">
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-4 text-slate-600 font-bold hover:text-slate-900 transition-colors text-sm uppercase tracking-widest cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="fornecedor-form"
                  disabled={isSubmitting}
                  className="px-12 py-4 bg-[rgb(42,82,144)] text-white font-black rounded-xl shadow-xl shadow-[rgb(42,82,144)]/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isSubmitting
                    ? "Salvando..."
                    : editingFornecedor
                      ? "Atualizar Fornecedor"
                      : "Confirmar Fornecedor"}
                </button>
              </div>
            </div>
          }
        >
          <form
            id="fornecedor-form"
            onSubmit={handleSubmit}
            className="space-y-8"
          >
            {/* Seção: Dados principais */}
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

              <div className="grid grid-cols-1 md:grid-cols-[0.7fr_1.6fr_0.9fr] gap-6">
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
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                    {labels.nomeLabel} <RequiredAsterisk />
                  </label>
                  <input
                    required
                    value={formData.nome}
                    onChange={(e) =>
                      handleInputChange("nome", e.target.value)
                    }
                    placeholder={labels.nomePlaceholder}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[2px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    {labels.documentoLabel}
                  </label>
                  <input
                    value={formData.documento}
                    onChange={(e) =>
                      handleInputChange("documento", e.target.value)
                    }
                    placeholder={labels.documentoPlaceholder}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                  />
                </div>
              </div>
            </section>

            <div className="border-b-2 border-slate-100 my-10"></div>

            {/* Seção: Contato */}
            <section className="space-y-6">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <Phone size={20} className="text-blue-600" /> Contato
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Telefone / Celular
                  </label>
                  <input
                    value={formData.telefone}
                    onChange={(e) =>
                      handleInputChange("telefone", e.target.value)
                    }
                    placeholder="(00) 00000-0000"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      handleInputChange("email", e.target.value)
                    }
                    placeholder="contato@fornecedor.com"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                  />
                </div>
              </div>
            </section>

            <div className="border-b-2 border-slate-100 my-10"></div>

            {/* Seção: Endereço */}
            <section className="space-y-6">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <MapPin size={20} className="text-blue-600" /> Endereço
                </h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Endereço completo
                  </label>
                  <input
                    value={formData.endereco}
                    onChange={(e) =>
                      handleInputChange("endereco", e.target.value)
                    }
                    placeholder="Rua, número, bairro, complemento..."
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1.5fr_0.5fr_0.7fr] gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      Cidade
                    </label>
                    <input
                      value={formData.cidade}
                      onChange={(e) =>
                        handleInputChange("cidade", e.target.value)
                      }
                      placeholder="Cidade"
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      UF
                    </label>
                    <GeologSearchableSelect
                      options={UF_OPTIONS}
                      value={formData.estado}
                      onChange={(value) => handleInputChange("estado", value)}
                      placeholder="—"
                      disableSearch
                      hideTriggerAvatar
                      variant="form"
                      triggerClassName="px-5 py-3.5 !bg-slate-50 border-2 !border-slate-200 mt-[2px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      CEP
                    </label>
                    <input
                      value={formData.cep}
                      onChange={(e) => handleInputChange("cep", e.target.value)}
                      placeholder="00000-000"
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                </div>
              </div>
            </section>

            <div className="border-b-2 border-slate-100 my-10"></div>

            {/* Seção: Observações */}
            <section className="space-y-6">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <FileText size={20} className="text-slate-500" /> Observações
                </h3>
              </div>

              <div className="space-y-2">
                <textarea
                  value={formData.observacoes}
                  onChange={(e) =>
                    handleInputChange("observacoes", e.target.value)
                  }
                  placeholder="Observações opcionais sobre o fornecedor..."
                  rows={3}
                  className="w-full resize-none px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                />
              </div>
            </section>
          </form>
        </StandardModal>
      )}

      <ConfirmDialog
        open={confirmState.open}
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
