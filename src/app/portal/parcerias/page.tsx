"use client";

import React, { useEffect, useState } from "react";
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
  Power,
  Trash2,
  Users,
  Plus,
} from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useConfirm } from "@/hooks/useConfirm";
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
  stripBrazilCountryCode,
} from "@/lib/phone";

const PESSOA_TIPO_OPTIONS = [
  { id: "juridica", nome: "Pessoa jurídica" },
  { id: "fisica", nome: "Pessoa física" },
];

const formatDocument = (
  value: string,
  pessoaTipo: "fisica" | "juridica",
): string => {
  const digits = value
    .replace(/\D/g, "")
    .slice(0, pessoaTipo === "juridica" ? 14 : 11);

  if (pessoaTipo === "juridica") {
    return digits
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }

  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

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
  referencia?: string;
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
  referencia: "",
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
    toggleParceiro,
    deleteParceiro,
  } = useData();
  const { confirm, confirmState, closeConfirm, handleConfirm } = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParceiro, setEditingParceiro] =
    useState<ParceiroServico | null>(null);
  const [viewingParceiro, setViewingParceiro] =
    useState<ParceiroServico | null>(null);
  const [formData, setFormData] = useState<ParceiroFormData>(initialForm());
  const parceiroTable = useServerPaginatedTable(fetchParceirosPage, 10);
  const searchTerm = parceiroTable.searchTerm;

  // Refresh automático da tabela quando dados mudam via realtime
  useEffect(() => {
    void parceiroTable.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parceiros.length]);

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
                referencia: filial.referencia || "",
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
      referencia: filial.referencia?.trim() || "",
    })),
  });

  const validateCPF = (cpf: string): boolean => {
    const cpfClean = cpf.replace(/\D/g, "");
    if (cpfClean.length !== 11) return false;

    if (/^(\d)\1{10}$/.test(cpfClean)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpfClean.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpfClean.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpfClean.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpfClean.charAt(10))) return false;

    return true;
  };

  const validateCNPJ = (cnpj: string): boolean => {
    const cnpjClean = cnpj.replace(/\D/g, "");
    if (cnpjClean.length !== 14) return false;

    if (/^(\d)\1{13}$/.test(cnpjClean)) return false;

    const weightsFirst = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weightsSecond = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cnpjClean.charAt(i)) * weightsFirst[i];
    }
    let remainder = sum % 11;
    const firstDigit = remainder < 2 ? 0 : 11 - remainder;
    if (firstDigit !== parseInt(cnpjClean.charAt(12))) return false;

    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cnpjClean.charAt(i)) * weightsSecond[i];
    }
    remainder = sum % 11;
    const secondDigit = remainder < 2 ? 0 : 11 - remainder;
    if (secondDigit !== parseInt(cnpjClean.charAt(13))) return false;

    return true;
  };

  const validateCelular = (celular: string): boolean => {
    const celularClean = stripBrazilCountryCode(celular);

    if (celularClean.length !== 11) return false;

    if (/^(\d)\1{10}$/.test(celularClean)) return false;

    const ddd = celularClean.substring(0, 2);
    if (ddd < "11" || ddd > "99") return false;

    return true;
  };

  const normalizeDigits = (value: string): string => value.replace(/\D/g, "");
  const normalizeText = (value: string): string => value.trim().toLowerCase();

  const validateForm = (): string | null => {
    if (!formData.razaoSocialOuNomeCompleto.trim()) {
      return "Razão Social/Nome completo é obrigatório";
    }

    if (!formData.documento.trim()) {
      return "CNPJ/CPF é obrigatório";
    }

    const documentoLimpo = normalizeDigits(formData.documento);
    if (formData.pessoaTipo === "juridica") {
      if (documentoLimpo.length !== 14) {
        return "CNPJ deve ter 14 dígitos completos";
      }
      if (!validateCNPJ(formData.documento)) {
        return "CNPJ inválido";
      }
    } else {
      if (documentoLimpo.length !== 11) {
        return "CPF deve ter 11 dígitos completos";
      }
      if (!validateCPF(formData.documento)) {
        return "CPF inválido";
      }
    }

    // Verificar documento duplicado entre outros parceiros
    const existingDocParceiro = parceiros.find(
      (p) =>
        p.id !== editingParceiro?.id &&
        normalizeDigits(p.documento) === documentoLimpo,
    );
    if (existingDocParceiro) {
      return `CNPJ/CPF já está sendo usado pelo parceiro "${existingDocParceiro.razaoSocialOuNomeCompleto}".`;
    }

    const primeiroContato = formData.contatos[0];
    if (!primeiroContato.setor.trim()) {
      return "Setor do primeiro contato é obrigatório";
    }
    if (!primeiroContato.celular.trim()) {
      return "Celular do primeiro contato é obrigatório";
    }
    if (!primeiroContato.responsavel.trim()) {
      return "Responsável do primeiro contato é obrigatório";
    }

    const celularLimpo = stripBrazilCountryCode(primeiroContato.celular);
    if (celularLimpo.length !== 11) {
      return "Celular deve ter 11 dígitos completos: (00) 00000-0000";
    }
    if (!validateCelular(primeiroContato.celular)) {
      return "Celular inválido";
    }

    if (primeiroContato.email && primeiroContato.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(primeiroContato.email.trim())) {
        return "E-mail inválido";
      }
    }

    // Verificar duplicados entre os próprios contatos do formulário
    const formCelulares = new Map<string, number>();
    const formEmails = new Map<string, number>();
    for (let i = 0; i < formData.contatos.length; i++) {
      const c = formData.contatos[i];
      const cell = normalizeBrazilPhone(c.celular);
      if (cell && formCelulares.has(cell)) {
        return `Celular ${c.celular} está duplicado entre os contatos deste parceiro.`;
      }
      formCelulares.set(cell, i);

      const email = normalizeText(c.email || "");
      if (email && formEmails.has(email)) {
        return `E-mail ${c.email} está duplicado entre os contatos deste parceiro.`;
      }
      formEmails.set(email, i);
    }

    // Verificar celular/email duplicados em outros parceiros
    for (const contato of formData.contatos) {
      const cell = normalizeBrazilPhone(contato.celular);
      if (cell) {
        for (const parceiro of parceiros) {
          if (parceiro.id === editingParceiro?.id) continue;
          const found = parceiro.contatos.find(
            (c) => normalizeBrazilPhone(c.celular) === cell,
          );
          if (found) {
            return `Celular ${contato.celular} já está sendo usado no contato "${found.setor}" do parceiro "${parceiro.razaoSocialOuNomeCompleto}".`;
          }
        }
      }
      const email = normalizeText(contato.email || "");
      if (email) {
        for (const parceiro of parceiros) {
          if (parceiro.id === editingParceiro?.id) continue;
          const found = parceiro.contatos.find(
            (c) => normalizeText(c.email || "") === email,
          );
          if (found) {
            return `E-mail ${contato.email} já está sendo usado no contato "${found.setor}" do parceiro "${parceiro.razaoSocialOuNomeCompleto}".`;
          }
        }
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const cleanForm = cleanParceiro(formData);

    try {
      if (editingParceiro) {
        await updateParceiro(editingParceiro.id, cleanForm);
        toast.success("Parceiro atualizado com sucesso!");
      } else {
        await addParceiro(cleanForm);
        toast.success("Parceiro cadastrado com sucesso!");
      }

      await parceiroTable.refresh();

      handleCloseModal();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o parceiro.",
      );
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
          `Não é possível excluir este parceiro. Existem vínculos ativos: ${mensagens.join("; ")}`,
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
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-[var(--color-geolog-blue)] text-white px-5 py-3.5 rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer shadow-lg shadow-blue-900/20 whitespace-nowrap"
          >
            <Plus size={18} />
            Novo Parceiro
          </button>
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
            render: (value: unknown, item: ParceiroServico) => {
              void value;

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
            render: (value: unknown, item: ParceiroServico) => {
              void value;

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
            title: "Status",
            align: "center",
            render: (value: unknown) => {
              const status = String(value) as "ativo" | "inativo";
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
                >
                  <Eye size={18} />
                </button>
                <button
                  onClick={() => handleOpenModal(item)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                  title="Editar Parceiro"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={async () => {
                    try {
                      await toggleParceiro(item.id);
                      toast.success(
                        `Parceiro ${item.status === "ativo" ? "inativado" : "ativado"} com sucesso!`,
                      );
                    } catch {
                      toast.error("Erro ao alterar status do parceiro.");
                    }
                  }}
                  className={`p-2 rounded-lg transition-all cursor-pointer ${
                    item.status === "ativo"
                      ? "text-slate-400 hover:text-orange-500 hover:bg-orange-50"
                      : "text-slate-400 hover:text-emerald-500 hover:bg-emerald-50"
                  }`}
                  title={
                    item.status === "ativo"
                      ? "Inativar Parceiro"
                      : "Ativar Parceiro"
                  }
                >
                  <Power size={18} />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                  title="Arquivar Parceiro"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ),
          },
        ]}
        searchPlaceholder="Buscar por nome, CPF/CNPJ, contato ou cidade..."
        emptyMessage="Nenhum parceiro cadastrado."
        emptyIcon={<Handshake size={48} />}
      />

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
                    {formData.pessoaTipo === "juridica"
                      ? "Razão social"
                      : "Nome completo"}
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
                    placeholder={
                      formData.pessoaTipo === "juridica"
                        ? "Ex: Silva Logística LTDA"
                        : "Ex: João da Silva"
                    }
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[2px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    {formData.pessoaTipo === "juridica" ? "CNPJ" : "CPF"}
                  </label>
                  <input
                    required
                    value={formData.documento}
                    onChange={(event) =>
                      handleInputChange("documento", event.target.value)
                    }
                    placeholder={
                      formData.pessoaTipo === "juridica"
                        ? "00.000.000/0001-00"
                        : "000.000.000-00"
                    }
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
                >
                  <PlusCircle size={14} /> Nova filial
                </button>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="hidden md:grid grid-cols-[1.2fr_2fr_1fr_auto] gap-4 bg-slate-50/80 border-b border-slate-200 px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-600">
                  <span>Rótulo</span>
                  <span>Endereço completo</span>
                  <span>Referência</span>
                  <span className="text-right">Ações</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto custom-scrollbar">
                  {formData.filiais.map((filial, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-[1.2fr_2fr_1fr_auto] gap-4 items-start px-6 py-5"
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
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Referência
                        </label>
                        <input
                          placeholder="Portão azul, bloco B..."
                          value={filial.referencia || ""}
                          onChange={(event) =>
                            handleFilialChange(
                              index,
                              "referencia",
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
                className="px-12 py-4 bg-[var(--color-geolog-blue)] text-white font-black rounded-xl shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer"
              >
                {editingParceiro ? "Salvar alterações" : "Salvar parceiro"}
              </button>
            </div>
          </form>
        </StandardModal>
      )}

      {viewingParceiro && (
        <StandardModal
          onClose={() => setViewingParceiro(null)}
          title={viewingParceiro.razaoSocialOuNomeCompleto}
          subtitle={
            viewingParceiro.pessoaTipo === "juridica"
              ? `Pessoa Jurídica · ${viewingParceiro.documento}`
              : `Pessoa Física · ${viewingParceiro.documento}`
          }
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
                <div className="hidden md:grid grid-cols-[1.2fr_2fr_1fr] gap-4 bg-slate-50/80 border-b border-slate-200 px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-600">
                  <span>Rótulo</span>
                  <span>Endereço completo</span>
                  <span>Referência</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {viewingParceiro.filiais.map((filial) => (
                    <div
                      key={filial.id}
                      className="grid grid-cols-1 md:grid-cols-[1.2fr_2fr_1fr] gap-4 items-center px-6 py-4"
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
                      <div>
                        <span className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">
                          Referência
                        </span>
                        <p className="text-sm font-medium text-slate-500">
                          {filial.referencia || (
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
