"use client";

import React, { useState } from "react";
import {
  useData,
  Cliente,
  Solicitante,
  CentroCusto,
} from "@/context/DataContext";
import StandardModal from "@/components/StandardModal";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useConfirm } from "@/hooks/useConfirm";
import {
  Plus,
  Search,
  Building,
  User,
  Trash2,
  Edit2,
  Copy,
  Check,
  Hash,
  LayoutGrid,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { hasPageAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/ui/AccessDenied";

export default function ClientesPage() {
  const { profile } = useAuth();
  const {
    clientes,
    solicitantes,
    addCliente,
    updateCliente,
    deleteCliente,
    addSolicitante,
    updateSolicitante,
    deleteSolicitante,
    addCentroCusto,
    updateCentroCusto,
    deleteCentroCusto,
    getCentrosCustoByCliente,
  } = useData();

  const { confirm, confirmState, closeConfirm, handleConfirm } = useConfirm();

  const [searchTerm, setSearchTerm] = useState("");

  // Modal states
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [isCentroCustoModalOpen, setIsCentroCustoModalOpen] = useState(false);
  const [isSolicitanteModalOpen, setIsSolicitanteModalOpen] = useState(false);

  // Selection states
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(
    null,
  );
  const [selectedCentroCustoId, setSelectedCentroCustoId] = useState<
    string | null
  >(null);

  // Editing states
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [editingCentroCusto, setEditingCentroCusto] =
    useState<CentroCusto | null>(null);
  const [editingSolicitante, setEditingSolicitante] =
    useState<Solicitante | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states
  const [newCliente, setNewCliente] = useState({ nome: "", contato: "" });
  const [newCentroCusto, setNewCentroCusto] = useState({
    nome: "",
    clienteId: "",
  });
  const [newSolicitante, setNewSolicitante] = useState({
    nome: "",
    clienteId: "",
    centroCustoId: "",
  });

  if (!hasPageAccess(profile, "clientes")) {
    return <AccessDenied module="Cadastros" />;
  }

  const filteredClientes = clientes.filter((c) =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectedCliente = clientes.find((c) => c.id === selectedClienteId);

  // Handlers for Cliente
  const handleCreateCliente = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newCliente.nome) {
      try {
        if (editingCliente) {
          await updateCliente(editingCliente.id, newCliente);
          setEditingCliente(null);
        } else {
          await addCliente(newCliente.nome, newCliente.contato);
        }

        setNewCliente({ nome: "", contato: "" });
        setIsClienteModalOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a empresa.",
        );
      }
    }
  };

  const handleEditCliente = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setNewCliente({ nome: cliente.nome, contato: cliente.contato || "" });
    setIsClienteModalOpen(true);
  };

  const handleDeleteCliente = async (id: string) => {
    const cliente = clientes.find((c) => c.id === id);
    if (!cliente) return;

    const confirmed = await confirm({
      title: "Arquivar Cliente",
      message: `Tem certeza que deseja arquivar o cliente "${cliente.nome}"? Ele não aparecerá mais na lista, mas poderá ser recuperado posteriormente.`,
      confirmText: "Sim, arquivar",
      cancelText: "Cancelar",
      type: "danger",
    });

    if (confirmed) {
      deleteCliente(id);
      if (selectedClienteId === id) {
        setSelectedClienteId(null);
      }
      toast.success("Cliente arquivado com sucesso!");
    }
  };

  // Handlers for Centro de Custo
  const handleCreateCentroCusto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCentroCusto.nome && selectedClienteId) {
      try {
        if (editingCentroCusto) {
          updateCentroCusto(editingCentroCusto.id, {
            nome: newCentroCusto.nome,
            clienteId: selectedClienteId,
          });
          setEditingCentroCusto(null);
        } else {
          await addCentroCusto(newCentroCusto.nome, selectedClienteId);
        }
        setNewCentroCusto({ nome: "", clienteId: "" });
        setIsCentroCustoModalOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o centro de custo.",
        );
      }
    }
  };

  const handleEditCentroCusto = (cc: CentroCusto) => {
    setEditingCentroCusto(cc);
    setNewCentroCusto({ nome: cc.nome, clienteId: cc.clienteId });
    setIsCentroCustoModalOpen(true);
  };

  const handleDeleteCentroCusto = async (id: string) => {
    if (!selectedClienteId) return;
    const centroCusto = getCentrosCustoByCliente(selectedClienteId).find(
      (cc) => cc.id === id,
    );
    if (!centroCusto) return;

    const confirmed = await confirm({
      title: "Arquivar Centro de Custo",
      message: `Tem certeza que deseja arquivar o centro de custo "${centroCusto.nome}"? Ele não aparecerá mais na lista, mas poderá ser recuperado posteriormente.`,
      confirmText: "Sim, arquivar",
      cancelText: "Cancelar",
      type: "danger",
    });

    if (confirmed) {
      deleteCentroCusto(id);
      if (selectedCentroCustoId === id) setSelectedCentroCustoId(null);
      toast.success("Centro de custo arquivado com sucesso!");
    }
  };

  // Handlers for Solicitante
  const handleCreateSolicitante = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar se o nome tem pelo menos nome e sobrenome (mínimo 2 palavras)
    const nomeParts = newSolicitante.nome.trim().split(/\s+/);
    if (nomeParts.length < 2) {
      toast.error("O nome completo deve conter pelo menos nome e sobrenome.");
      return;
    }

    if (newSolicitante.nome && selectedClienteId) {
      const data = {
        nome: newSolicitante.nome,
        clienteId: selectedClienteId,
        centroCustoId: newSolicitante.centroCustoId || undefined,
      };

      try {
        if (editingSolicitante) {
          updateSolicitante(editingSolicitante.id, {
            nome: data.nome,
            centroCustoId: data.centroCustoId,
          });
          setEditingSolicitante(null);
        } else {
          await addSolicitante(data.nome, data.clienteId, data.centroCustoId);
        }
        setNewSolicitante({ nome: "", clienteId: "", centroCustoId: "" });
        setIsSolicitanteModalOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o solicitante.",
        );
      }
    }
  };

  const handleEditSolicitante = (s: Solicitante) => {
    setEditingSolicitante(s);
    setNewSolicitante({
      nome: s.nome,
      clienteId: s.clienteId,
      centroCustoId: s.centroCustoId || "",
    });
    setIsSolicitanteModalOpen(true);
  };

  const handleDeleteSolicitante = async (id: string) => {
    const solicitante = solicitantes.find((s) => s.id === id);
    if (!solicitante) return;

    const confirmed = await confirm({
      title: "Arquivar Solicitante",
      message: `Tem certeza que deseja arquivar o solicitante "${solicitante.nome}"? Ele não aparecerá mais na lista, mas poderá ser recuperado posteriormente.`,
      confirmText: "Sim, arquivar",
      cancelText: "Cancelar",
      type: "danger",
    });

    if (confirmed) {
      deleteSolicitante(id);
      toast.success("Solicitante arquivado com sucesso!");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Hierarquia Geolog" icon={<Building size={20} />} />

      <div className="flex gap-3 items-center">
        <div className="relative group flex-1">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
            size={18}
          />
          <input
            type="text"
            placeholder="Buscar por empresa..."
            className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 font-bold text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setIsClienteModalOpen(true)}
          className="flex items-center gap-2 bg-[var(--color-geolog-blue)] text-white px-5 py-3.5 rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer shadow-lg shadow-blue-900/20 whitespace-nowrap"
        >
          <Plus size={18} />
          Nova Empresa
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COL 1: Empresas */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
              Base de Clientes
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {filteredClientes.map((cliente) => (
              <div
                key={cliente.id}
                onClick={() => {
                  setSelectedClienteId(cliente.id);
                  setSelectedCentroCustoId(null);
                }}
                className={`w-full text-left p-4 transition-all flex items-center justify-between group cursor-pointer ${
                  selectedClienteId === cliente.id
                    ? "bg-blue-50/50"
                    : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      selectedClienteId === cliente.id
                        ? "bg-blue-600 text-white scale-110 shadow-md"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <Building size={18} />
                  </div>
                  <div className="max-w-[340px]">
                    <p
                      className={`text-base font-black truncate ${selectedClienteId === cliente.id ? "text-blue-700" : "text-slate-700"}`}
                    >
                      {cliente.nome}
                    </p>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (cliente.contato)
                          copyToClipboard(cliente.contato, cliente.id);
                      }}
                      className="flex items-center gap-1.5 text-base text-slate-400 font-medium hover:text-blue-600 transition-all cursor-pointer group/copy"
                      title="Clique para copiar"
                    >
                      <span className="truncate">
                        {cliente.contato || "Sem contato"}
                      </span>
                      {cliente.contato &&
                        (copiedId === cliente.id ? (
                          <Check
                            size={14}
                            className="text-green-500 shrink-0"
                          />
                        ) : (
                          <Copy
                            size={14}
                            className="opacity-0 group-hover/copy:opacity-100 transition-opacity shrink-0"
                          />
                        ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditCliente(cliente);
                    }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCliente(cliente.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                    title="Arquivar Empresa"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COL 2: Centros de Custo */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
              Centros de Custo
            </h3>
            {selectedClienteId && (
              <button
                onClick={() => {
                  setNewCentroCusto({
                    ...newCentroCusto,
                    clienteId: selectedClienteId,
                  });
                  setIsCentroCustoModalOpen(true);
                }}
                className="p-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {!selectedClienteId ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 opacity-50">
                <LayoutGrid size={40} />
                <p className="text-[13px] font-black uppercase">
                  Selecione uma empresa
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {selectedCliente?.centrosCusto.map((cc) => (
                  <div
                    key={cc.id}
                    onClick={() => setSelectedCentroCustoId(cc.id)}
                    className={`p-4 flex items-center justify-between group cursor-pointer transition-all ${
                      selectedCentroCustoId === cc.id
                        ? "bg-emerald-50/50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          selectedCentroCustoId === cc.id
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <Hash size={14} />
                      </div>
                      <span
                        className={`text-base font-black ${selectedCentroCustoId === cc.id ? "text-emerald-700" : "text-slate-600"}`}
                      >
                        {cc.nome}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCentroCusto(cc);
                        }}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 cursor-pointer"
                        title="Editar Centro"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCentroCusto(cc.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                        title="Arquivar Centro"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {selectedCliente?.centrosCusto.length === 0 && (
                  <p className="text-center py-8 text-slate-400 text-[13px] font-bold uppercase italic px-6">
                    Sem centros de custo.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* COL 3: Solicitantes */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
              Solicitantes
            </h3>
            {selectedClienteId && (
              <button
                onClick={() => {
                  setNewSolicitante({
                    ...newSolicitante,
                    clienteId: selectedClienteId,
                    centroCustoId: selectedCentroCustoId || "",
                  });
                  setIsSolicitanteModalOpen(true);
                }}
                className="p-1 bg-slate-100 text-slate-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {!selectedClienteId ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 opacity-50">
                <User size={40} />
                <p className="text-[13px] font-black uppercase">
                  Selecione uma empresa
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {solicitantes
                  .filter(
                    (s) =>
                      s.clienteId === selectedClienteId &&
                      (!selectedCentroCustoId ||
                        s.centroCustoId === selectedCentroCustoId),
                  )
                  .map((s) => (
                    <div
                      key={s.id}
                      className="p-4 flex items-center justify-between group hover:bg-slate-50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                          <User size={14} />
                        </div>
                        <div>
                          <p className="text-base font-black text-slate-700">
                            {s.nome}
                          </p>
                          {s.centroCustoId && (
                            <p className="text-xs font-medium text-blue-400 uppercase tracking-wider flex items-center gap-1">
                              <Hash size={8} />{" "}
                              {
                                selectedCliente?.centrosCusto.find(
                                  (cc) => cc.id === s.centroCustoId,
                                )?.nome
                              }
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => handleEditSolicitante(s)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                          title="Editar Solicitante"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteSolicitante(s.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                          title="Arquivar Solicitante"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                {solicitantes.filter(
                  (s) =>
                    s.clienteId === selectedClienteId &&
                    (!selectedCentroCustoId ||
                      s.centroCustoId === selectedCentroCustoId),
                ).length === 0 && (
                  <p className="text-center py-8 text-slate-400 text-[13px] font-bold uppercase italic px-6">
                    {selectedCentroCustoId
                      ? "Ninguém neste centro de custo."
                      : "Sem solicitantes cadastrados."}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals are unchanged except for field updates */}
      {isClienteModalOpen && (
        <StandardModal
          onClose={() => {
            setIsClienteModalOpen(false);
            setEditingCliente(null);
            setNewCliente({ nome: "", contato: "" });
          }}
          title={editingCliente ? "Editar Empresa" : "Nova Empresa"}
          icon={<Building size={24} />}
          maxWidthClassName="max-w-2xl"
        >
          <form onSubmit={handleCreateCliente} className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">
                  Razão Social / Nome
                </label>
                <input
                  required
                  className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-blue-600"
                  value={newCliente.nome}
                  onChange={(e) =>
                    setNewCliente({ ...newCliente, nome: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">
                  Contato principal
                </label>
                <input
                  className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-blue-600"
                  value={newCliente.contato}
                  onChange={(e) =>
                    setNewCliente({ ...newCliente, contato: e.target.value })
                  }
                />
              </div>
            </div>
            <button className="w-full py-4.5 bg-blue-600 text-white font-black rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer">
              Salvar Empresa
            </button>
          </form>
        </StandardModal>
      )}

      {isCentroCustoModalOpen && (
        <StandardModal
          onClose={() => {
            setIsCentroCustoModalOpen(false);
            setEditingCentroCusto(null);
            setNewCentroCusto({ nome: "", clienteId: "" });
          }}
          title={editingCentroCusto ? "Editar Centro" : "Novo Centro"}
          icon={<Hash size={24} />}
          maxWidthClassName="max-w-2xl"
        >
          <form onSubmit={handleCreateCentroCusto} className="space-y-6">
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl mb-4">
              <span className="text-xs font-black text-emerald-600 uppercase">
                Vinculando à empresa:
              </span>
              <p className="font-black text-lg text-slate-700">
                {selectedCliente?.nome}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">
                Nome do Centro de Custo
              </label>
              <input
                required
                placeholder="Ex: Logística"
                className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-emerald-600"
                value={newCentroCusto.nome}
                onChange={(e) =>
                  setNewCentroCusto({ ...newCentroCusto, nome: e.target.value })
                }
              />
            </div>
            <button className="w-full py-4.5 bg-emerald-600 text-white font-black rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer">
              Salvar Centro de Custo
            </button>
          </form>
        </StandardModal>
      )}

      {isSolicitanteModalOpen && (
        <StandardModal
          onClose={() => {
            setIsSolicitanteModalOpen(false);
            setEditingSolicitante(null);
            setNewSolicitante({ nome: "", clienteId: "", centroCustoId: "" });
          }}
          title={editingSolicitante ? "Editar Solicitante" : "Novo Solicitante"}
          icon={<User size={24} />}
          maxWidthClassName="max-w-2xl"
        >
          <form onSubmit={handleCreateSolicitante} className="space-y-6">
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl mb-4">
              <span className="text-xs font-black text-slate-400 uppercase">
                Vinculando à empresa:
              </span>
              <p className="font-black text-lg text-slate-700">
                {selectedCliente?.nome}
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">
                  Nome Completo
                </label>
                <input
                  required
                  className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-blue-500"
                  value={newSolicitante.nome}
                  onChange={(e) =>
                    setNewSolicitante({
                      ...newSolicitante,
                      nome: e.target.value,
                    })
                  }
                />
              </div>
              <GeologSearchableSelect
                label="Vincular a um Centro de Custo"
                value={newSolicitante.centroCustoId}
                onChange={(id) =>
                  setNewSolicitante({ ...newSolicitante, centroCustoId: id })
                }
                placeholder="Pesquisar centro de custo..."
                options={[
                  { id: "", nome: "Sem centro de custo específico" },
                  ...(selectedCliente?.centrosCusto.map((cc) => ({
                    id: cc.id,
                    nome: cc.nome,
                  })) || []),
                ]}
              />
            </div>
            <button className="w-full py-4.5 bg-slate-800 text-white font-black rounded-xl shadow-lg hover:bg-blue-600 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer">
              Salvar Solicitante
            </button>
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
