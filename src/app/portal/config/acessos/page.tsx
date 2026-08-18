"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { hasPageAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/ui/AccessDenied";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useConfirm } from "@/hooks/useConfirm";
import { toast } from "sonner";
import {
  Shield,
  Mail,
  User,
  ChevronRight,
  ShieldCheck,
  Briefcase,
  Plus,
  Trash2,
  Check,
  X,
  DollarSign,
  Car,
} from "lucide-react";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import StandardModal from "@/components/StandardModal";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";

interface UserWithAuth extends UserProfile {
  email: string;
}

export default function AcessosPage() {
  const { user, profile } = useAuth();
  const { confirm, confirmState, closeConfirm, handleConfirm } = useConfirm();

  const [users, setUsers] = useState<UserWithAuth[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] =
    useState<UserWithAuth | null>(null);
  const [activePermissionTab, setActivePermissionTab] = useState("financeiro");
  const [financeiroPageAccess, setFinanceiroPageAccess] = useState(false);
  const [newUser, setNewUser] = useState({
    primeiroNome: "",
    sobrenome: "",
    email: "",
    password: "",
    tipo_usuario: "interno",
    categoria: "operador",
  });

  const formatErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && "message" in err) {
      const message = (err as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
    return "Falha inesperada ao salvar a configuração.";
  };

  const fetchUsers = useCallback(async () => {
    try {
      setIsUsersLoading(true);

      const res = await fetch("/api/users");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Não foi possível carregar a gestão de acesso neste momento.",
        );
      }

      setUsers(data);
    } catch (err: unknown) {
      console.error("Erro ao carregar usuários:", err);
    } finally {
      setIsUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.categoria === "administrador") {
      void fetchUsers();
    }
  }, [profile?.categoria, fetchUsers]);

  const updateUserRole = async (
    userId: string,
    field: string,
    value: string | Record<string, unknown>,
  ) => {
    try {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, [field]: value } : u)),
      );

      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, updates: { [field]: value } }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success("Permissão atualizada com sucesso!");
      void fetchUsers();
    } catch (err: unknown) {
      toast.error("Erro ao atualizar permissão: " + formatErrorMessage(err));
      fetchUsers();
    }
  };

  const updateSpecificPermissions = async (
    userId: string,
    module: string,
    permissions: Record<string, unknown>,
  ) => {
    try {
      const user = users.find((u) => u.id === userId);
      if (!user) return;

      const currentPermissions =
        (user.specific_permissions as Record<string, unknown>) || {};
      const updatedPermissions = {
        ...currentPermissions,
        [module]: permissions,
      };

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, specific_permissions: updatedPermissions }
            : u,
        ),
      );
      setSelectedUserForPermissions((prev) =>
        prev?.id === userId
          ? { ...prev, specific_permissions: updatedPermissions }
          : prev,
      );

      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          updates: { specific_permissions: updatedPermissions },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success("Permissões específicas atualizadas com sucesso!");
      void fetchUsers();
    } catch (err: unknown) {
      toast.error("Erro ao atualizar permissões: " + formatErrorMessage(err));
      fetchUsers();
    }
  };

  const isAccessAdmin = profile?.categoria === "administrador";

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreatingUser(true);
      const nomeCompleto = `${newUser.primeiroNome.trim()} ${newUser.sobrenome.trim()}`;

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newUser,
          nome: nomeCompleto,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar usuário");

      toast.success("Usuário criado com sucesso!");
      setIsCreateModalOpen(false);
      setNewUser({
        primeiroNome: "",
        sobrenome: "",
        email: "",
        password: "",
        tipo_usuario: "interno",
        categoria: "operador",
      });
      fetchUsers();
    } catch (err: unknown) {
      toast.error(
        "Erro ao criar login: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === user?.id) {
      toast.error("Você não pode excluir seu próprio acesso.");
      return;
    }

    if (
      !(await confirm({
        title: "Excluir Acesso",
        message:
          "Tem certeza que deseja excluir permanentemente este acesso? Esta ação não pode ser desfeita.",
        confirmText: "Sim, excluir",
        cancelText: "Cancelar",
        type: "danger",
      }))
    )
      return;

    try {
      const res = await fetch(`/api/users?id=${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success("Acesso removido com sucesso.");
      fetchUsers();
    } catch (err: unknown) {
      toast.error(
        "Erro ao excluir: " +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  };

  const openPermissionsModal = (user: UserWithAuth) => {
    setSelectedUserForPermissions(user);
    const perms = (user.specific_permissions as Record<string, unknown>) || {};
    const financeiroPerms = (perms.financeiro as Record<string, unknown>) || {};
    setFinanceiroPageAccess((financeiroPerms.page_access as boolean) || false);
    setIsPermissionsModalOpen(true);
  };

  if (!hasPageAccess(profile, "config-acessos")) {
    return <AccessDenied module="Gestão de Acessos" />;
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Gestão de Acessos"
          icon={<Shield size={20} />}
        />

        {!isAccessAdmin ? (
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden flex items-center justify-center p-10 text-center">
            <div className="max-w-lg space-y-4">
              <div className="mx-auto w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500">
                <ShieldCheck size={28} />
              </div>
              <h3 className="text-xl font-black text-slate-800">
                Gestão de acesso restrita
              </h3>
              <p className="text-slate-500 font-semibold leading-relaxed">
                Apenas administradores podem visualizar e alterar os usuários
                do sistema.
              </p>
            </div>
          </div>
        ) : (
          <DataTable
            data={users}
            columns={[
                  {
                    key: "nome",
                    title: "Usuário",
                    render: (value) => (
                      <p className="font-black text-sm text-slate-800 tracking-tight uppercase">
                        {value as string}
                      </p>
                    ),
                  },
                  {
                    key: "email",
                    title: "E-mail",
                    render: (value) => (
                      <div className="flex items-center gap-2 text-slate-700">
                        <Mail
                          size={16}
                          className="text-blue-500 flex-shrink-0"
                        />
                        <span className="text-sm font-medium truncate max-w-[200px]">
                          {value as string}
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "tipo_usuario",
                    title: "Tipo",
                    render: (value, item) => (
                      <GeologSearchableSelect
                        compact
                        disableSearch
                        className="max-w-[180px]"
                        options={[
                          {
                            id: "interno",
                            nome: "Geolog",
                            sublabel: "Equipe Própria",
                          },
                          {
                            id: "gestor",
                            nome: "Gestor",
                            sublabel: "Externo/Terceiro",
                          },
                        ]}
                        value={value as string}
                        onChange={(val) =>
                          updateUserRole(
                            (item as UserWithAuth).id,
                            "tipo_usuario",
                            val,
                          )
                        }
                      />
                    ),
                  },
                  {
                    key: "categoria",
                    title: "Permissão",
                    render: (value, item) => (
                      <GeologSearchableSelect
                        compact
                        disableSearch
                        className="max-w-[200px]"
                        disabled={
                          (item as UserWithAuth).tipo_usuario === "gestor"
                        }
                        options={[
                          {
                            id: "administrador",
                            nome: "Administrador",
                            sublabel: "Total / Config",
                          },
                          {
                            id: "gestor",
                            nome: "Gestor",
                            sublabel: "Controle de Fluxo",
                          },
                          {
                            id: "operador",
                            nome: "Operador",
                            sublabel: "Lançamentos",
                          },
                          {
                            id: "financeiro",
                            nome: "Financeiro",
                            sublabel: "Faturamento",
                          },
                          {
                            id: "jovem aprendiz",
                            nome: "Jovem Aprendiz",
                            sublabel: "Visualização",
                          },
                        ]}
                        value={value as string}
                        onChange={(val) =>
                          updateUserRole(
                            (item as UserWithAuth).id,
                            "categoria",
                            val,
                          )
                        }
                      />
                    ),
                  },
                  {
                    key: "actions",
                    title: "Ações",
                    align: "center",
                    render: (_, item) => (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() =>
                            openPermissionsModal(item as UserWithAuth)
                          }
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <ShieldCheck size={18} />
                        </button>
                        {isAccessAdmin && (
                          <button
                            onClick={() =>
                              handleDeleteUser((item as UserWithAuth).id)
                            }
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    ),
                  },
                ]}
            loading={isUsersLoading}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Pesquisar por nome, e-mail..."
            emptyMessage="Nenhum usuário encontrado."
            emptyIcon={<ShieldCheck size={48} />}
            actionButton={
              isAccessAdmin ? (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center justify-center gap-2 bg-[var(--color-geolog-blue)] text-white px-7 py-3.5 rounded-2xl font-black shadow-lg shadow-blue-900/10 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-widest shrink-0 w-full md:w-auto cursor-pointer whitespace-nowrap"
                >
                  <Plus size={18} strokeWidth={3} />
                  Novo Login
                </button>
              ) : undefined
            }
          />
        )}
      </div>

      {/* Modal Criar Usuário */}
      {isCreateModalOpen && (
        <StandardModal
          title="Novo Login de Acesso"
          subtitle="Criação direta no banco de dados"
          icon={<ShieldCheck size={24} />}
          onClose={() => setIsCreateModalOpen(false)}
          maxWidthClassName="max-w-2xl"
        >
          <form onSubmit={handleCreateUser} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                  Nome
                </label>
                <div className="relative group">
                  <User
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                    size={18}
                  />
                  <input
                    required
                    type="text"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-base outline-none focus:border-blue-600 transition-colors"
                    value={newUser.primeiroNome}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        primeiroNome: e.target.value.replace(/\s/g, ""),
                      })
                    }
                    placeholder="Ex: Acacio"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                  Sobrenome
                </label>
                <div className="relative group">
                  <User
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                    size={18}
                  />
                  <input
                    required
                    type="text"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-base outline-none focus:border-blue-600 transition-colors"
                    value={newUser.sobrenome}
                    onChange={(e) =>
                      setNewUser({ ...newUser, sobrenome: e.target.value })
                    }
                    placeholder="Ex: Vieira"
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                  E-mail Operacional
                </label>
                <div className="relative group">
                  <Mail
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                    size={18}
                  />
                  <input
                    required
                    type="email"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-base outline-none focus:border-blue-600 transition-colors"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                    placeholder="nome@empresa.com"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t-2 border-slate-50 mt-8 relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-xs font-black text-slate-300 uppercase tracking-widest">
                Controle de Acessos
              </div>
              <div className="space-y-2 z-10">
                <GeologSearchableSelect
                  label="Tipo de Conta"
                  options={[
                    {
                      id: "interno",
                      nome: "Geolog",
                      sublabel: "Equipe Própria",
                    },
                    {
                      id: "gestor",
                      nome: "Gestor",
                      sublabel: "Externo/Terceiro",
                    },
                  ]}
                  value={newUser.tipo_usuario}
                  onChange={(val) =>
                    setNewUser({
                      ...newUser,
                      tipo_usuario: val,
                      categoria:
                        val === "gestor" ? "operador" : newUser.categoria,
                    })
                  }
                />
              </div>
              <div className="space-y-2 z-20">
                <GeologSearchableSelect
                  label="Nível Inicial"
                  disabled={newUser.tipo_usuario === "gestor"}
                  options={[
                    {
                      id: "administrador",
                      nome: "Administrador",
                      sublabel: "Total / Config",
                    },
                    {
                      id: "gestor",
                      nome: "Gestor",
                      sublabel: "Controle de Fluxo",
                    },
                    {
                      id: "operador",
                      nome: "Operador",
                      sublabel: "Lançamentos",
                    },
                    {
                      id: "financeiro",
                      nome: "Financeiro",
                      sublabel: "Faturamento",
                    },
                    {
                      id: "jovem aprendiz",
                      nome: "Jovem Aprendiz",
                      sublabel: "Visualização",
                    },
                  ]}
                  value={newUser.categoria}
                  onChange={(val) => setNewUser({ ...newUser, categoria: val })}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreatingUser}
              className="w-full mt-10 py-4.5 bg-blue-600 text-white font-black rounded-xl shadow-lg hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.98] transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-70 flex justify-center items-center gap-3 relative overflow-hidden group"
            >
              {isCreatingUser ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Salvando Credenciais...
                </>
              ) : (
                <>
                  Registrar Usuário
                  <ChevronRight
                    size={18}
                    className="absolute right-6 opacity-0 group-hover:opacity-100 group-hover:right-4 transition-all"
                    strokeWidth={3}
                  />
                </>
              )}
            </button>
          </form>
        </StandardModal>
      )}

      {/* Modal de Permissões do Usuário */}
      {isPermissionsModalOpen && selectedUserForPermissions && (
        <StandardModal
          title="Gerenciar Permissões"
          subtitle={`Configurar acessos para ${selectedUserForPermissions.nome}`}
          icon={<ShieldCheck size={24} />}
          onClose={() => setIsPermissionsModalOpen(false)}
          maxWidthClassName="max-w-2xl"
        >
          <div className="space-y-6">
            {/* Status do Usuário */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-lg">
                  {selectedUserForPermissions.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-black text-base text-slate-800">
                    {selectedUserForPermissions.nome}
                  </p>
                  <p className="text-sm font-semibold text-slate-400">
                    {selectedUserForPermissions.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      selectedUserForPermissions.email ===
                      selectedUserForPermissions.email
                    }
                    onChange={() => {
                      // Implementar lógica de ativar/desativar usuário
                      toast.info(
                        "Funcionalidade de ativar/desativar usuário em breve",
                      );
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:border-blue-600"></div>
                </label>
                <span className="text-sm font-semibold text-slate-600">
                  Ativo
                </span>
              </div>
            </div>

            {/* Permissões Específicas com Toggles */}
            <div className="space-y-4 pt-6 border-t-2 border-slate-50">
              <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest">
                Permissões Específicas
              </h3>

              {/* TabControl para Permissões Específicas */}
              <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl">
                {[
                  { id: "financeiro", label: "Financeiro", icon: DollarSign },
                  { id: "os", label: "Ordens", icon: Briefcase },
                  { id: "clientes", label: "Clientes", icon: User },
                  { id: "motoristas", label: "Motoristas", icon: Briefcase },
                  { id: "veiculos", label: "Veículos", icon: Car },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActivePermissionTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer relative ${
                        activePermissionTab === tab.id
                          ? "bg-white text-blue-600 shadow-sm"
                          : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                      }`}
                    >
                      <Icon size={16} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Conteúdo das Tabs de Permissões Específicas */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                {activePermissionTab === "financeiro" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                          Acesso à Página
                        </p>
                        <p className="text-xs font-semibold text-slate-400">
                          Permite acessar o módulo financeiro
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={financeiroPageAccess}
                          onChange={(e) => {
                            setFinanceiroPageAccess(e.target.checked);
                            const currentPerms =
                              ((
                                (selectedUserForPermissions.specific_permissions as Record<
                                  string,
                                  unknown
                                >) || {}
                              ).financeiro as Record<string, unknown>) || {};
                            void updateSpecificPermissions(
                              selectedUserForPermissions.id,
                              "financeiro",
                              {
                                ...currentPerms,
                                page_access: e.target.checked,
                              },
                            );
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-checked:after:border-green-600"></div>
                      </label>
                    </div>

                    {financeiroPageAccess && (
                      <>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                          <div>
                            <p className="font-bold text-sm text-slate-800">
                              Visualizar Faturamento
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              Acesso a relatórios financeiros
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              defaultChecked
                              onChange={() => {
                                toast.info("Permissão atualizada");
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-checked:after:border-green-600"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                          <div>
                            <p className="font-bold text-sm text-slate-800">
                              Editar Taxas
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              Modificar porcentagens
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              defaultChecked={false}
                              onChange={() => {
                                toast.info("Permissão atualizada");
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-checked:after:border-green-600"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                          <div>
                            <p className="font-bold text-sm text-slate-800">
                              Exportar Relatórios
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              Download de dados
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              defaultChecked={false}
                              onChange={() => {
                                toast.info("Permissão atualizada");
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-checked:after:border-green-600"></div>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activePermissionTab === "os" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                          Criar OS
                        </p>
                        <p className="text-xs font-semibold text-slate-400">
                          Nova ordem de serviço
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          onChange={() => {
                            toast.info("Permissão atualizada");
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:border-blue-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                          Editar OS
                        </p>
                        <p className="text-xs font-semibold text-slate-400">
                          Modificar ordens existentes
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          onChange={() => {
                            toast.info("Permissão atualizada");
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:border-blue-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                          Deletar OS
                        </p>
                        <p className="text-xs font-semibold text-slate-400">
                          Remover ordens de serviço
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked={false}
                          onChange={() => {
                            toast.info("Permissão atualizada");
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:after:border-red-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                          Cancelar OS
                        </p>
                        <p className="text-xs font-semibold text-slate-400">
                          Cancelar ordens em andamento
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked={false}
                          onChange={() => {
                            toast.info("Permissão atualizada");
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600 peer-checked:after:border-orange-600"></div>
                      </label>
                    </div>
                  </div>
                )}

                {activePermissionTab === "clientes" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                          Criar Cliente
                        </p>
                        <p className="text-xs font-semibold text-slate-400">
                          Novo cadastro
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          onChange={() => {
                            toast.info("Permissão atualizada");
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-checked:after:border-purple-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                          Editar Cliente
                        </p>
                        <p className="text-xs font-semibold text-slate-400">
                          Modificar dados
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          onChange={() => {
                            toast.info("Permissão atualizada");
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-checked:after:border-purple-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                          Deletar Cliente
                        </p>
                        <p className="text-xs font-semibold text-slate-400">
                          Remover cadastro
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked={false}
                          onChange={() => {
                            toast.info("Permissão atualizada");
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:after:border-red-600"></div>
                      </label>
                    </div>
                  </div>
                )}

                {activePermissionTab === "motoristas" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                          Criar Motorista
                        </p>
                        <p className="text-xs font-semibold text-slate-400">
                          Novo cadastro
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          onChange={() => {
                            toast.info("Permissão atualizada");
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600 peer-checked:after:border-orange-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                          Editar Motorista
                        </p>
                        <p className="text-xs font-semibold text-slate-400">
                          Modificar dados
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          onChange={() => {
                            toast.info("Permissão atualizada");
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600 peer-checked:after:border-orange-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                          Deletar Motorista
                        </p>
                        <p className="text-xs font-semibold text-slate-400">
                          Remover cadastro
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked={false}
                          onChange={() => {
                            toast.info("Permissão atualizada");
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:after:border-red-600"></div>
                      </label>
                    </div>
                  </div>
                )}

                {activePermissionTab === "veiculos" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                          Criar Veículo
                        </p>
                        <p className="text-xs font-semibold text-slate-400">
                          Novo cadastro
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          onChange={() => {
                            toast.info("Permissão atualizada");
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600 peer-checked:after:border-teal-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                          Editar Veículo
                        </p>
                        <p className="text-xs font-semibold text-slate-400">
                          Modificar dados
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          onChange={() => {
                            toast.info("Permissão atualizada");
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600 peer-checked:after:border-teal-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                          Deletar Veículo
                        </p>
                        <p className="text-xs font-semibold text-slate-400">
                          Remover cadastro
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked={false}
                          onChange={() => {
                            toast.info("Permissão atualizada");
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:after:border-red-600"></div>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t-2 border-slate-50">
              <button
                onClick={() => setIsPermissionsModalOpen(false)}
                className="w-full py-4 bg-blue-600 text-white font-black rounded-xl shadow-lg hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.98] transition-all text-sm uppercase tracking-widest cursor-pointer"
              >
                Fechar
              </button>
            </div>
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
    </>
  );
}
