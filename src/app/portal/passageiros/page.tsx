"use client";

import React, { useState } from "react";
import {
  UserSquare2,
  Plus,
  Edit,
  Eye,
  Archive,
  X,
  Mail,
  Phone,
  MapPin,
  Layers,
  IdCard,
  PlusCircle,
} from "lucide-react";
import {
  useData,
  type Passageiro,
  type PassageiroEndereco,
} from "@/context/DataContext";
import StandardModal from "@/components/StandardModal";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import RequiredAsterisk from "@/components/ui/RequiredAsterisk";
import { fetchPassageirosPage } from "@/lib/supabase/queries";
import { useServerPaginatedTable } from "@/hooks/useServerPaginatedTable";
import { formatBrazilPhone, stripBrazilCountryCode } from "@/lib/phone";

interface NewPassengerForm {
  nomeCompleto: string;
  email?: string;
  celular: string;
  cpf?: string;
  notificar: string;
  genero: string;
  enderecos: Array<Omit<PassageiroEndereco, "id">>;
}

const initialEndereco = {
  rotulo: "RESIDENCIAL",
  enderecoCompleto: "",
  referencia: "",
};

const initialForm: NewPassengerForm = {
  nomeCompleto: "",
  email: "",
  celular: "",
  cpf: "",
  enderecos: [{ ...initialEndereco }],
  notificar: "Sim",
  genero: "Sem resposta",
};

export default function PassageirosPage() {
  const { addPassageiro, updatePassageiro, archivePassageiro } = useData();
  const { confirm, confirmState, closeConfirm, handleConfirm } = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPassenger, setSelectedPassenger] = useState<Passageiro | null>(
    null,
  );
  const [formData, setFormData] = useState<NewPassengerForm>(initialForm);
  const [isEstrangeiro, setIsEstrangeiro] = useState(false);
  const passengerTable = useServerPaginatedTable(fetchPassageirosPage, 10);

  const handleAddEndereco = () => {
    setFormData((prev) => ({
      ...prev,
      enderecos: [
        ...prev.enderecos,
        { ...initialEndereco, rotulo: `Endereço ${prev.enderecos.length + 1}` },
      ],
    }));
  };

  const handleRemoveEndereco = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      enderecos: prev.enderecos.filter((_, idx) => idx !== index),
    }));
  };

  const handleEnderecoChange = (
    index: number,
    field: keyof Omit<PassageiroEndereco, "id">,
    value: string,
  ) => {
    let formattedValue = value;

    if (field === "rotulo") {
      formattedValue = formatUppercase(value);
    }

    setFormData((prev) => ({
      ...prev,
      enderecos: prev.enderecos.map((endereco, idx) =>
        idx === index ? { ...endereco, [field]: formattedValue } : endereco,
      ),
    }));
  };

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const formatPhone = (value: string) => {
    if (isEstrangeiro) {
      return value.replace(/\D/g, "").slice(0, 15);
    }
    return formatBrazilPhone(value);
  };

  const formatUppercase = (value: string) => {
    return value.toUpperCase();
  };

  const formatLowercase = (value: string) => {
    return value.toLowerCase();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const celularDigits = stripBrazilCountryCode(formData.celular);
    if (isEstrangeiro && celularDigits.length !== 11) {
      toast.error(
        "Celular brasileiro deve conter 11 dígitos (DDD + 9 + número).",
      );
      return;
    }

    // Validar CPF (opcional, mas se preenchido precisa ter 11 dígitos)
    const cpfDigits = formData.cpf?.replace(/\D/g, "") || "";
    if (cpfDigits.length > 0 && cpfDigits.length !== 11) {
      toast.error("CPF deve conter exatamente 11 dígitos.");
      return;
    }

    try {
      await addPassageiro({
        nomeCompleto: formData.nomeCompleto.trim().toUpperCase(),
        email: formData.email?.trim(),
        celular: formatPhone(formData.celular),
        cpf: formData.cpf?.trim(),
        enderecos: formData.enderecos
          .filter(
            (endereco) =>
              endereco.rotulo.trim() ||
              endereco.enderecoCompleto.trim() ||
              endereco.referencia?.trim(),
          )
          .map((endereco) => ({
            rotulo: endereco.rotulo.trim() || "Principal",
            enderecoCompleto: endereco.enderecoCompleto.trim(),
            referencia: endereco.referencia?.trim() || "",
          })),
      });

      await new Promise((resolve) => setTimeout(resolve, 300));
      await passengerTable.refresh();
      setFormData(initialForm);
      setIsModalOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o passageiro.",
      );
    }
  };

  const handleEditSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedPassenger) return;

    const celularDigits = formData.celular.replace(/\D/g, "");
    if (isEstrangeiro && celularDigits.length !== 11) {
      toast.error(
        "Celular brasileiro deve conter 11 dígitos (DDD + 9 + número).",
      );
      return;
    }

    const cpfDigits = formData.cpf?.replace(/\D/g, "") || "";
    if (cpfDigits.length > 0 && cpfDigits.length !== 11) {
      toast.error("CPF deve conter exatamente 11 dígitos.");
      return;
    }

    try {
      await updatePassageiro(selectedPassenger.id, {
        nomeCompleto: formData.nomeCompleto.trim().toUpperCase(),
        email: formData.email?.trim(),
        celular: formatPhone(formData.celular),
        cpf: formData.cpf?.trim(),
        enderecos: formData.enderecos
          .filter(
            (endereco) =>
              endereco.rotulo.trim() ||
              endereco.enderecoCompleto.trim() ||
              endereco.referencia?.trim(),
          )
          .map((endereco) => ({
            rotulo: endereco.rotulo.trim() || "Principal",
            enderecoCompleto: endereco.enderecoCompleto.trim(),
            referencia: endereco.referencia?.trim() || "",
          })),
        notificar: formData.notificar === "Sim",
        genero: formData.genero,
      });

      await new Promise((resolve) => setTimeout(resolve, 300));
      await passengerTable.refresh();
      setFormData(initialForm);
      setSelectedPassenger(null);
      setIsEditModalOpen(false);
      toast.success("Passageiro atualizado com sucesso.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o passageiro.",
      );
    }
  };

  const resetForm = () => {
    setFormData(initialForm);
    setSelectedPassenger(null);
  };

  const handleInputChange = (
    field: keyof Omit<NewPassengerForm, "enderecos">,
    value: string,
  ) => {
    let formattedValue = value;

    if (field === "cpf") {
      formattedValue = formatCPF(value);
    }

    if (field === "celular") {
      formattedValue = formatPhone(value);
    }

    if (field === "nomeCompleto") {
      formattedValue = formatUppercase(value);
    }

    if (field === "email") {
      formattedValue = formatLowercase(value);
    }

    setFormData((prev) => ({
      ...prev,
      [field]: formattedValue,
    }));
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Passageiros Cadastrados"
        icon={<UserSquare2 size={20} />}
      />

      <DataTable
        data={passengerTable.items}
        loading={passengerTable.loading}
        searchTerm={passengerTable.searchTerm}
        onSearchChange={passengerTable.setSearchTerm}
        disableClientSearch
        pagination={{
          page: passengerTable.page,
          pageSize: passengerTable.pageSize,
          totalItems: passengerTable.totalCount,
          onPageChange: passengerTable.setPage,
        }}
        actionButton={
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[var(--color-geolog-blue)] text-white px-5 py-3.5 rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer shadow-lg shadow-blue-900/20 whitespace-nowrap"
          >
            <Plus size={18} />
            Novo Passageiro
          </button>
        }
        columns={[
          {
            key: "nomeCompleto",
            title: "Passageiro",
            render: (value: unknown) => (
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-bold text-slate-800">{String(value)}</p>
                </div>
              </div>
            ),
          },
          {
            key: "contato",
            title: "Contato e ID",
            render: (value: unknown, item: Passageiro) => {
              void value;

              return (
                <div className="space-y-2 text-sm">
                  {item.email && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail size={14} className="text-blue-500" />
                      <span className="font-medium">{item.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone size={14} className="text-blue-500" />
                    <span className="font-medium">{formatPhone(item.celular)}</span>
                  </div>
                  {item.cpf && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <IdCard size={14} className="text-blue-500" />
                      <span className="font-medium">{item.cpf}</span>
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            key: "notificacao",
            title: "Notificação",
            render: (value: unknown, item: Passageiro) => {
              void value;

              if (item.notificar === true) {
                return (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-black uppercase tracking-wider">
                    Enviar
                  </div>
                );
              }

              return (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-black uppercase tracking-wider">
                  Não enviar
                </div>
              );
            },
          },
          {
            key: "enderecos",
            title: "Endereços",
            render: (value: unknown, item: Passageiro) => {
              void value;

              return (
                <div className="space-y-2">
                  {item.enderecos.slice(0, 2).map((endereco) => (
                    <div
                      key={endereco.id}
                      className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        <MapPin size={12} className="text-blue-500" />
                        {endereco.rotulo}
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-700 leading-snug">
                        {endereco.enderecoCompleto}
                      </p>
                    </div>
                  ))}
                  {item.enderecos.length > 2 && (
                    <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">
                      <Layers size={12} />+{item.enderecos.length - 2} endereços
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            key: "acoes",
            title: "Ações",
            align: "center" as const,
            render: (value: unknown, item: Passageiro) => {
              void value;

              const handleArchive = async () => {
                const confirmed = await confirm({
                  title: "Arquivar Passageiro",
                  message: `Tem certeza que deseja arquivar o passageiro "${item.nomeCompleto}"? Ele não aparecerá mais na lista, mas poderá ser recuperado posteriormente.`,
                  confirmText: "Sim, arquivar",
                  cancelText: "Cancelar",
                  type: "danger",
                });

                if (confirmed) {
                  await archivePassageiro(item.id);
                  await passengerTable.refresh();
                  toast.success("Passageiro arquivado com sucesso!");
                }
              };

              const handleEdit = () => {
                setSelectedPassenger(item);
                setFormData({
                  nomeCompleto: item.nomeCompleto,
                  email: item.email || "",
                  celular: formatPhone(item.celular),
                  cpf: item.cpf || "",
                  enderecos: item.enderecos.map((e) => ({
                    rotulo: e.rotulo,
                    enderecoCompleto: e.enderecoCompleto,
                    referencia: e.referencia || "",
                  })),
                  notificar: item.notificar === true ? "Sim" : "Não",
                  genero: item.genero || "Sem resposta",
                });
                setIsEditModalOpen(true);
              };

              const handleView = () => {
                setSelectedPassenger(item);
                setIsViewModalOpen(true);
              };

              return (
                <div className="flex items-center gap-2 justify-center">
                  <button
                    onClick={handleView}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    title="Visualizar"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    onClick={handleEdit}
                    className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
                    title="Editar"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={handleArchive}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Arquivar"
                  >
                    <Archive size={18} />
                  </button>
                </div>
              );
            },
          },
        ]}
        searchPlaceholder="Buscar por nome, CPF ou e-mail"
        emptyMessage="Nenhum passageiro encontrado."
        emptyIcon={<UserSquare2 size={48} />}
      />

      {isModalOpen && (
        <StandardModal
          onClose={() => setIsModalOpen(false)}
          title="Novo Passageiro"
          subtitle="Cadastro prioritário e monitoramento de endereços habituais"
          icon={<UserSquare2 className="w-6 h-6 md:w-7 md:h-7" />}
          maxWidthClassName="max-w-5xl"
          bodyClassName="p-6 md:p-10 pb-16 space-y-12"
        >
          <form onSubmit={handleSubmit} className="space-y-12">
            <section className="space-y-6">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <UserSquare2 size={20} className="text-slate-500" /> Detalhes
                  do Passageiro
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="space-y-2 flex-[2]">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      Nome completo <RequiredAsterisk />
                    </label>
                    <input
                      required
                      placeholder="Ex: Marina Costa"
                      value={formData.nomeCompleto}
                      onChange={(event) =>
                        handleInputChange("nomeCompleto", event.target.value)
                      }
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                        Celular <RequiredAsterisk />
                      </label>
                      <div
                        className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1"
                        style={{ marginTop: "-4px" }}
                      >
                        <input
                          type="checkbox"
                          id="isEstrangeiroNew"
                          checked={isEstrangeiro}
                          onChange={(e) => {
                            setIsEstrangeiro(e.target.checked);
                            // Limpa o campo do celular ao mudar o modo para evitar erros de máscara
                            setFormData((prev) => ({ ...prev, celular: "" }));
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <label
                          htmlFor="isEstrangeiroNew"
                          className="text-xs font-bold text-slate-700 cursor-pointer"
                        >
                          Estrangeiro
                        </label>
                      </div>
                    </div>
                    <input
                      required={isEstrangeiro}
                      placeholder={
                        isEstrangeiro ? "+00 123456789" : "(22) 99999-0000"
                      }
                      value={formData.celular}
                      onChange={(event) =>
                        handleInputChange("celular", event.target.value)
                      }
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                  <div
                    className="space-y-2 flex-[0.8]"
                    style={{ marginTop: "-4px" }}
                  >
                    <GeologSearchableSelect
                      label="Notificar"
                      options={[
                        { id: "Sim", nome: "Sim" },
                        { id: "Não", nome: "Não" },
                      ]}
                      value={formData.notificar}
                      onChange={(value) =>
                        setFormData({ ...formData, notificar: value })
                      }
                      triggerClassName="mt-1 h-[56px] py-3"
                      required
                      disableSearch
                    />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="space-y-2 flex-[1.5]">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      E-mail
                    </label>
                    <input
                      type="email"
                      placeholder="contato@exemplo.com"
                      value={formData.email}
                      onChange={(event) =>
                        handleInputChange("email", event.target.value)
                      }
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 flex-[0.7]">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      CPF
                    </label>
                    <input
                      placeholder="000.000.000-00"
                      value={formData.cpf}
                      onChange={(event) =>
                        handleInputChange("cpf", event.target.value)
                      }
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 flex-[0.8]">
                    <GeologSearchableSelect
                      label="Gênero"
                      options={[
                        { id: "Masculino", nome: "Masculino" },
                        { id: "Feminino", nome: "Feminino" },
                        { id: "Sem resposta", nome: "Sem resposta" },
                      ]}
                      value={formData.genero}
                      onChange={(value) =>
                        setFormData({ ...formData, genero: value })
                      }
                      triggerClassName="mt-1 h-[56px] py-3"
                      disableSearch
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div
                className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <div>
                  <h3
                    className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                    style={{ lineHeight: "1.3" }}
                  >
                    <MapPin size={20} className="text-blue-600" /> Endereços
                    monitorados
                  </h3>
                  <p className="text-sm text-slate-500 mt-2">
                    Registre bases fixas, hotéis, residências e referências
                    operacionais (opcional).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddEndereco}
                  className="flex items-center gap-3 px-4 py-3 bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-200 transition-all shadow-sm"
                >
                  <PlusCircle size={14} /> Adicionar endereço
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
                  {formData.enderecos.map((endereco, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-[1.2fr_2fr_1fr_auto] gap-4 items-start px-6 py-5"
                    >
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Rótulo
                        </label>
                        <input
                          placeholder="Residencial, Base, Hotel..."
                          value={endereco.rotulo}
                          onChange={(event) =>
                            handleEnderecoChange(
                              index,
                              "rotulo",
                              event.target.value,
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
                          value={endereco.enderecoCompleto}
                          onChange={(event) =>
                            handleEnderecoChange(
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
                          value={endereco.referencia || ""}
                          onChange={(event) =>
                            handleEnderecoChange(
                              index,
                              "referencia",
                              event.target.value,
                            )
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="flex md:pt-1 justify-end">
                        {formData.enderecos.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveEndereco(index)}
                            className="inline-flex items-center justify-center p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            aria-label="Remover endereço"
                          >
                            <X size={16} />
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

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="px-12 py-4 bg-green-600 text-white font-black rounded-xl shadow-xl shadow-green-900/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer"
              >
                Salvar passageiro
              </button>
            </div>
          </form>
        </StandardModal>
      )}

      {isViewModalOpen && selectedPassenger && (
        <StandardModal
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedPassenger(null);
          }}
          title="Detalhes do Passageiro"
          subtitle="Informações completas do passageiro selecionado"
          icon={<Eye className="w-6 h-6 md:w-7 md:h-7" />}
        >
          <div className="space-y-6 py-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <UserSquare2 size={24} className="text-blue-600" />
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-[0.1em]">
                  Informações Pessoais
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Nome Completo
                  </label>
                  <p className="text-base font-bold text-slate-800 mt-1">
                    {selectedPassenger.nomeCompleto}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Celular
                  </label>
                  <p className="text-base font-bold text-slate-800 mt-1">
                    {formatPhone(selectedPassenger.celular)}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                    E-mail
                  </label>
                  <p className="text-base font-bold text-slate-800 mt-1">
                    {selectedPassenger.email || "Não informado"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                    CPF
                  </label>
                  <p className="text-base font-bold text-slate-800 mt-1">
                    {selectedPassenger.cpf || "Não informado"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <MapPin size={24} className="text-blue-600" />
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-[0.1em]">
                  Endereços
                </h3>
              </div>
              <div className="space-y-3">
                {selectedPassenger.enderecos.map((endereco) => (
                  <div
                    key={endereco.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                      <MapPin size={14} className="text-blue-500" />
                      {endereco.rotulo}
                    </div>
                    <p className="text-base font-bold text-slate-700">
                      {endereco.enderecoCompleto}
                    </p>
                    {endereco.referencia && (
                      <p className="text-sm font-medium text-slate-500 mt-1">
                        Referência: {endereco.referencia}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </StandardModal>
      )}

      {isEditModalOpen && (
        <StandardModal
          onClose={() => {
            setIsEditModalOpen(false);
            resetForm();
          }}
          title="Editar Passageiro"
          subtitle="Atualize as informações do passageiro"
          icon={<Edit className="w-6 h-6 md:w-7 md:h-7" />}
          maxWidthClassName="max-w-5xl"
          bodyClassName="p-6 md:p-10 pb-16 space-y-12"
        >
          <form onSubmit={handleEditSubmit} className="space-y-12">
            <section className="space-y-6">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <UserSquare2 size={20} className="text-slate-500" /> Detalhes
                  do Passageiro
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="space-y-2 flex-[2]">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      Nome completo <RequiredAsterisk />
                    </label>
                    <input
                      required
                      placeholder="Ex: Marina Costa"
                      value={formData.nomeCompleto}
                      onChange={(event) =>
                        handleInputChange("nomeCompleto", event.target.value)
                      }
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                        Celular <RequiredAsterisk />
                      </label>
                      <div
                        className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1"
                        style={{ marginTop: "-4px" }}
                      >
                        <input
                          type="checkbox"
                          id="isEstrangeiroEdit"
                          checked={isEstrangeiro}
                          onChange={(e) => {
                            setIsEstrangeiro(e.target.checked);
                            setFormData((prev) => ({ ...prev, celular: "" }));
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <label
                          htmlFor="isEstrangeiroEdit"
                          className="text-xs font-bold text-slate-700 cursor-pointer"
                        >
                          Estrangeiro
                        </label>
                      </div>
                    </div>
                    <input
                      required={isEstrangeiro}
                      placeholder={
                        isEstrangeiro ? "+00 123456789" : "(22) 99999-0000"
                      }
                      value={formData.celular}
                      onChange={(event) =>
                        handleInputChange("celular", event.target.value)
                      }
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                  <div
                    className="space-y-2 flex-[0.8]"
                    style={{ marginTop: "-4px" }}
                  >
                    <GeologSearchableSelect
                      label="Notificar"
                      options={[
                        { id: "Sim", nome: "Sim" },
                        { id: "Não", nome: "Não" },
                      ]}
                      value={formData.notificar}
                      onChange={(value) =>
                        setFormData({ ...formData, notificar: value })
                      }
                      triggerClassName="mt-1 h-[56px] py-3"
                      required
                      disableSearch
                    />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="space-y-2 flex-[1.5]">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      E-mail
                    </label>
                    <input
                      type="email"
                      placeholder="contato@exemplo.com"
                      value={formData.email}
                      onChange={(event) =>
                        handleInputChange("email", event.target.value)
                      }
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 flex-[0.7]">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      CPF
                    </label>
                    <input
                      placeholder="000.000.000-00"
                      value={formData.cpf}
                      onChange={(event) =>
                        handleInputChange("cpf", event.target.value)
                      }
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 flex-[0.8]">
                    <GeologSearchableSelect
                      label="Gênero"
                      options={[
                        { id: "Masculino", nome: "Masculino" },
                        { id: "Feminino", nome: "Feminino" },
                        { id: "Sem resposta", nome: "Sem resposta" },
                      ]}
                      value={formData.genero}
                      onChange={(value) =>
                        setFormData({ ...formData, genero: value })
                      }
                      triggerClassName="mt-1 h-[56px] py-3"
                      disableSearch
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div
                className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <div>
                  <h3
                    className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                    style={{ lineHeight: "1.3" }}
                  >
                    <MapPin size={20} className="text-blue-600" /> Endereços
                    monitorados
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Adicione endereços quando necessário (opcional)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddEndereco}
                  className="flex items-center gap-3 px-4 py-3 bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-200 transition-all shadow-sm"
                >
                  <PlusCircle size={14} /> Adicionar endereço
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
                  {formData.enderecos.map((endereco, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-[1.2fr_2fr_1fr_auto] gap-4 items-start px-6 py-5"
                    >
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Rótulo
                        </label>
                        <input
                          placeholder="Residencial, Base, Hotel..."
                          value={endereco.rotulo}
                          onChange={(event) =>
                            handleEnderecoChange(
                              index,
                              "rotulo",
                              event.target.value,
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
                          value={endereco.enderecoCompleto}
                          onChange={(event) =>
                            handleEnderecoChange(
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
                          value={endereco.referencia || ""}
                          onChange={(event) =>
                            handleEnderecoChange(
                              index,
                              "referencia",
                              event.target.value,
                            )
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="flex md:pt-1 justify-end">
                        {formData.enderecos.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveEndereco(index)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remover endereço"
                          >
                            <X size={18} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="px-12 py-4 bg-green-600 text-white font-black rounded-xl shadow-xl shadow-green-900/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer"
              >
                Atualizar passageiro
              </button>
            </div>
          </form>
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
