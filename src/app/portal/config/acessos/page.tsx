"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { hasPageAccess, getEffectivePageAccess } from "@/lib/permissions";
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
  DollarSign,
  Crown,
  ClipboardList,
  PencilLine,
  Eye,
  Building2,
} from "lucide-react";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import StandardModal from "@/components/StandardModal";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";

interface UserWithAuth extends UserProfile {
  email: string;
}

/**
 * Retorna um avatar circular com ícone e cor específicos para cada categoria
 * de usuário. Usado no dropdown de seleção de role e no trigger do select.
 */
function RoleAvatar({ categoria }: { categoria: string }) {
  const config: Record<
    string,
    { icon: React.ReactNode; bg: string; border: string; text: string }
  > = {
    administrador: {
      icon: <Crown size={16} />,
      bg: "bg-indigo-100",
      border: "border-indigo-300",
      text: "text-indigo-600",
    },
    diretoria: {
      icon: <Briefcase size={16} />,
      bg: "bg-violet-100",
      border: "border-violet-300",
      text: "text-violet-600",
    },
    gestor: {
      icon: <ClipboardList size={16} />,
      bg: "bg-blue-100",
      border: "border-blue-300",
      text: "text-blue-600",
    },
    operador: {
      icon: <PencilLine size={16} />,
      bg: "bg-emerald-100",
      border: "border-emerald-300",
      text: "text-emerald-600",
    },
    financeiro: {
      icon: <DollarSign size={16} />,
      bg: "bg-amber-100",
      border: "border-amber-300",
      text: "text-amber-600",
    },
    "jovem aprendiz": {
      icon: <Eye size={16} />,
      bg: "bg-teal-100",
      border: "border-teal-300",
      text: "text-teal-600",
    },
  };
  const c = config[categoria] ?? {
    icon: <User size={16} />,
    bg: "bg-slate-100",
    border: "border-slate-200",
    text: "text-slate-400",
  };
  return (
    <div
      className={`w-9 h-9 rounded-full ${c.bg} flex items-center justify-center flex-shrink-0 border-2 ${c.border} ${c.text}`}
    >
      {c.icon}
    </div>
  );
}

/**
 * Rótulo de exibição para uma categoria de usuário. Usado nos textos de
 * "concedido automaticamente pelo perfil X" no modal de permissões, para que
 * a mensagem reflita a categoria real do usuário (ex: Diretoria, Financeiro).
 */
const CATEGORIA_LABEL: Record<string, string> = {
  administrador: "Administrador",
  diretoria: "Diretoria",
  financeiro: "Financeiro",
  operador: "Operador",
  gestor: "Gestor",
  "jovem aprendiz": "Jovem Aprendiz",
};

function categoriaLabel(categoria: string | undefined | null): string {
  if (!categoria) return "categoria";
  return CATEGORIA_LABEL[categoria] ?? categoria;
}

/**
 * Retorna um avatar circular específico para o tipo de usuário:
 * - "interno" (Geolog) → logotipo do sistema
 * - "gestor" (cliente externo) → ícone de edifício (Building2) em ciano
 */
function TipoUsuarioAvatar({ tipo }: { tipo: string }) {
  if (tipo === "interno") {
    return (
      <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0 border-2 border-slate-300 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Geolog"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-cyan-100 flex items-center justify-center flex-shrink-0 border-2 border-cyan-300 text-cyan-600">
      <Building2 size={16} />
    </div>
  );
}

export default function AcessosPage() {
  const { user, profile } = useAuth();
  const { confirm, confirmState, closeConfirm, handleConfirm } = useConfirm();

  const isAccessAdmin = profile?.categoria === "administrador";
  const isAccessDiretoria = profile?.categoria === "diretoria";
  const canManageUsers = isAccessAdmin || isAccessDiretoria;

  const [users, setUsers] = useState<UserWithAuth[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] =
    useState<UserWithAuth | null>(null);
  const [activePermissionTab, setActivePermissionTab] = useState("financeiro");
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
    if (canManageUsers) {
      void fetchUsers();
    }
  }, [canManageUsers, fetchUsers]);

  const updateUserRole = async (
    userId: string,
    field: string,
    value: string | boolean | Record<string, unknown>,
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

  // Opções de categoria disponíveis no dropdown.
  // Diretoria não pode selecionar "Administrador" — nem para promover,
  // nem para criar novos usuários admin.
  const categoriaOptions = [
    { id: "administrador", nome: "Administrador", icon: <RoleAvatar categoria="administrador" /> },
    { id: "diretoria", nome: "Diretoria", icon: <RoleAvatar categoria="diretoria" /> },
    { id: "gestor", nome: "Gestor", icon: <RoleAvatar categoria="gestor" /> },
    { id: "operador", nome: "Operador", icon: <RoleAvatar categoria="operador" /> },
    { id: "financeiro", nome: "Financeiro", icon: <RoleAvatar categoria="financeiro" /> },
    { id: "jovem aprendiz", nome: "Jovem Aprendiz", icon: <RoleAvatar categoria="jovem aprendiz" /> },
  ].filter((opt) => isAccessAdmin || opt.id !== "administrador");

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
    setIsPermissionsModalOpen(true);
  };

  // Mantém o modal de permissões sincronizado com a lista de usuários: se a
  // categoria ou o status "Ativo" mudar (via dropdown na tabela) enquanto o
  // modal está aberto, os toggles devem refletir o novo estado imediatamente.
  useEffect(() => {
    if (!selectedUserForPermissions) return;
    const updated = users.find(
      (u) => u.id === selectedUserForPermissions.id,
    );
    if (updated && updated !== selectedUserForPermissions) {
      setSelectedUserForPermissions(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

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

        {!canManageUsers ? (
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
                            icon: <TipoUsuarioAvatar tipo="interno" />,
                          },
                          {
                            id: "gestor",
                            nome: "Gestor",
                            sublabel: "Externo/Terceiro",
                            icon: <TipoUsuarioAvatar tipo="gestor" />,
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
                        options={categoriaOptions}
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
                        {canManageUsers && (
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
              canManageUsers ? (
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
                      icon: <TipoUsuarioAvatar tipo="interno" />,
                    },
                    {
                      id: "gestor",
                      nome: "Gestor",
                      sublabel: "Externo/Terceiro",
                      icon: <TipoUsuarioAvatar tipo="gestor" />,
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
                  options={categoriaOptions}
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
                <label
                  className={`relative inline-flex items-center ${
                    selectedUserForPermissions.id === user?.id
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer"
                  }`}
                  title={
                    selectedUserForPermissions.id === user?.id
                      ? "Você não pode desativar a si mesmo"
                      : ""
                  }
                >
                  <input
                    type="checkbox"
                    checked={
                      selectedUserForPermissions.is_active !== false
                    }
                    disabled={
                      selectedUserForPermissions.id === user?.id
                    }
                    onChange={(e) => {
                      const nextActive = e.target.checked;
                      setSelectedUserForPermissions((prev) =>
                        prev ? { ...prev, is_active: nextActive } : prev,
                      );
                      void updateUserRole(
                        selectedUserForPermissions.id,
                        "is_active",
                        nextActive,
                      );
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:border-blue-600"></div>
                </label>
                <span className="text-sm font-semibold text-slate-600">
                  {selectedUserForPermissions.is_active === false
                    ? "Desativado"
                    : "Ativo"}
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
                  { id: "cadastros", label: "Cadastros", icon: User },
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
                    {(() => {
                      const eff = getEffectivePageAccess(
                        selectedUserForPermissions,
                        "financeiro",
                      );
                      const locked = eff.lockedByCategoria;
                      const hint = locked
                        ? eff.source === "administrador"
                          ? "Concedido automaticamente pelo perfil Administrador"
                          : eff.source === "categoria-base"
                            ? `Concedido automaticamente pelo perfil ${categoriaLabel(selectedUserForPermissions?.categoria)}`
                            : "Bloqueado pela categoria"
                        : "Permite acessar Financeiro, Caixa, Fornecedores, Categorias e Formas de Pagamento";
                      return (
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                          <div>
                            <p className="font-bold text-sm text-slate-800">
                              Acesso à Página
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              {hint}
                            </p>
                          </div>
                          <label
                            className={`relative inline-flex items-center ${
                              locked
                                ? "cursor-not-allowed"
                                : "cursor-pointer"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={eff.access}
                              disabled={locked}
                              onChange={(e) => {
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
                      );
                    })()}

                    {getEffectivePageAccess(
                      selectedUserForPermissions,
                      "financeiro",
                    ).access && (
                      <>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 opacity-60">
                          <div>
                            <p className="font-bold text-sm text-slate-800">
                              Visualizar Faturamento
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              Acesso a relatórios financeiros · Em breve
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-not-allowed">
                            <input
                              type="checkbox"
                              defaultChecked
                              disabled
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-checked:after:border-green-600"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 opacity-60">
                          <div>
                            <p className="font-bold text-sm text-slate-800">
                              Editar Taxas
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              Modificar porcentagens · Em breve
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-not-allowed">
                            <input
                              type="checkbox"
                              defaultChecked={false}
                              disabled
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-checked:after:border-green-600"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 opacity-60">
                          <div>
                            <p className="font-bold text-sm text-slate-800">
                              Exportar Relatórios
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              Download de dados · Em breve
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-not-allowed">
                            <input
                              type="checkbox"
                              defaultChecked={false}
                              disabled
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-checked:after:border-green-600"></div>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activePermissionTab === "os" && (
                  <div className="space-y-3">
                    {(() => {
                      const eff = getEffectivePageAccess(
                        selectedUserForPermissions,
                        "os",
                      );
                      const locked = eff.lockedByCategoria;
                      const hint = locked
                        ? eff.source === "administrador"
                          ? "Concedido automaticamente pelo perfil Administrador"
                          : eff.source === "categoria-base"
                            ? `Concedido automaticamente pelo perfil ${categoriaLabel(selectedUserForPermissions?.categoria)}`
                            : "Bloqueado pela categoria"
                        : "Permite acessar o módulo de Ordens de Serviço";
                      return (
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                          <div>
                            <p className="font-bold text-sm text-slate-800">
                              Acesso à Página
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              {hint}
                            </p>
                          </div>
                          <label
                            className={`relative inline-flex items-center ${
                              locked
                                ? "cursor-not-allowed"
                                : "cursor-pointer"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={eff.access}
                              disabled={locked}
                              onChange={(e) => {
                                const currentPerms =
                                  ((
                                    (selectedUserForPermissions.specific_permissions as Record<
                                      string,
                                      unknown
                                    >) || {}
                                  ).os as Record<string, unknown>) || {};
                                void updateSpecificPermissions(
                                  selectedUserForPermissions.id,
                                  "os",
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
                      );
                    })()}

                    {getEffectivePageAccess(selectedUserForPermissions, "os")
                      .access && (
                      <>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 opacity-60">
                          <div>
                            <p className="font-bold text-sm text-slate-800">
                              Criar OS
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              Nova ordem de serviço · Em breve
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-not-allowed">
                            <input
                              type="checkbox"
                              defaultChecked
                              disabled
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:border-blue-600"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 opacity-60">
                          <div>
                            <p className="font-bold text-sm text-slate-800">
                              Editar OS
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              Modificar ordens existentes · Em breve
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-not-allowed">
                            <input
                              type="checkbox"
                              defaultChecked
                              disabled
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:border-blue-600"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 opacity-60">
                          <div>
                            <p className="font-bold text-sm text-slate-800">
                              Deletar OS
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              Remover ordens de serviço · Em breve
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-not-allowed">
                            <input
                              type="checkbox"
                              defaultChecked={false}
                              disabled
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:after:border-red-600"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 opacity-60">
                          <div>
                            <p className="font-bold text-sm text-slate-800">
                              Cancelar OS
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              Cancelar ordens em andamento · Em breve
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-not-allowed">
                            <input
                              type="checkbox"
                              defaultChecked={false}
                              disabled
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600 peer-checked:after:border-orange-600"></div>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activePermissionTab === "cadastros" && (
                  <div className="space-y-3">
                    {(() => {
                      const eff = getEffectivePageAccess(
                        selectedUserForPermissions,
                        "clientes",
                      );
                      const locked = eff.lockedByCategoria;
                      const hint = locked
                        ? eff.source === "administrador"
                          ? "Concedido automaticamente pelo perfil Administrador"
                          : eff.source === "categoria-base"
                            ? `Concedido automaticamente pelo perfil ${categoriaLabel(selectedUserForPermissions?.categoria)}`
                            : "Bloqueado pela categoria"
                        : "Permite acessar Clientes, Motoristas, Veículos, Passageiros e Parcerias";
                      return (
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                          <div>
                            <p className="font-bold text-sm text-slate-800">
                              Acesso à Página
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              {hint}
                            </p>
                          </div>
                          <label
                            className={`relative inline-flex items-center ${
                              locked
                                ? "cursor-not-allowed"
                                : "cursor-pointer"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={eff.access}
                              disabled={locked}
                              onChange={(e) => {
                                const currentPerms =
                                  ((
                                    (selectedUserForPermissions.specific_permissions as Record<
                                      string,
                                      unknown
                                    >) || {}
                                  ).cadastros as Record<string, unknown>) || {};
                                void updateSpecificPermissions(
                                  selectedUserForPermissions.id,
                                  "cadastros",
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
                      );
                    })()}
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
