"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth, UserProfile } from "@/context/AuthContext";

interface UserWithAuth extends UserProfile {
  email: string;
}
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useConfirm } from "@/hooks/useConfirm";
import { toast } from "sonner";
import {
  Shield,
  Mail,
  User,
  ChevronRight,
  Calendar,
  LogOut,
  Fingerprint,
  ShieldCheck,
  Briefcase,
  Plus,
  Trash2,
  Check,
  X,
  Edit2,
  CheckCircle,
  DollarSign,
  Percent,
  Car,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import StandardModal from "@/components/StandardModal";
import { AvatarUploader } from "@/components/ui/AvatarUploader";
import { useData } from "@/context/DataContext";
import { logInfo } from "@/lib/frontend-logger";
import { DataTable } from "@/components/ui/DataTable";
type TabType = "acesso" | "perfil" | "financeiro";

export default function ConfigPage() {
  const { user, profile, logout } = useAuth();
  const { confirm, confirmState, closeConfirm, handleConfirm } = useConfirm();
  const { impostoPercentual, setImpostoPercentual } = useData();
  const [activeTab, setActiveTab] = useState<TabType>("acesso");
  const [users, setUsers] = useState<UserWithAuth[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [jurosInput, setJurosInput] = useState(String(impostoPercentual));
  const [isSavingJuros, setIsSavingJuros] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] =
    useState<UserWithAuth | null>(null);
  const [activePermissionTab, setActivePermissionTab] = useState("financeiro");
  const [financeiroPageAccess, setFinanceiroPageAccess] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
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
    if (activeTab === "acesso" && profile?.categoria === "administrador") {
      void fetchUsers();
    }
  }, [activeTab, profile?.categoria, fetchUsers]);

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

      const currentPermissions = (user.specific_permissions as Record<string, unknown>) || {};
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

  const handleUpdateName = async () => {
    if (!editingName.trim()) {
      toast.error("Nome não pode estar vazio.");
      return;
    }

    try {
      setIsUpdatingName(true);
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user?.id,
          updates: { nome: editingName.trim() },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      // Enviar notificação para todos os usuários internos
      await sendNotificationToInternalUsers(
        "Atualização de Perfil",
        `${profile?.nome} alterou seu nome para "${editingName.trim()}"`,
        "profile_update",
      );

      toast.success("Nome atualizado com sucesso!");
      setIsEditingName(false);
      setEditingName("");
    } catch (err: unknown) {
      toast.error(
        "Erro ao atualizar nome: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setIsUpdatingName(false);
    }
  };

  const sendNotificationToInternalUsers = async (
    title: string,
    message: string,
    type: string,
  ) => {
    try {
      await fetch("/api/app-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          type,
          targetAudience: "interno",
        }),
      });
    } catch (error) {
      console.error("Erro ao enviar notificação:", error);
    }
  };

  const startEditingName = () => {
    setEditingName(profile?.nome || "");
    setIsEditingName(true);
  };

  const cancelEditingName = () => {
    setIsEditingName(false);
    setEditingName("");
  };

  const openPermissionsModal = (user: UserWithAuth) => {
    setSelectedUserForPermissions(user);
    const perms = (user.specific_permissions as Record<string, unknown>) || {};
    const financeiroPerms = perms.financeiro as Record<string, unknown> || {};
    setFinanceiroPageAccess((financeiroPerms.page_access as boolean) || false);
    setIsPermissionsModalOpen(true);
  };

  const tabs = [
    { id: "acesso", label: "Gestão de Acessos", icon: Shield },
    { id: "perfil", label: "Meu Perfil", icon: User },
    { id: "financeiro", label: "Financeiro", icon: DollarSign },
  ];

  return (
    <div className="max-w-[1600px] mx-auto pt-36 pb-6 px-4 md:px-10">
      {/* Tab Control - Fixed */}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-30 flex gap-2 p-1.5 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-lg">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`
                flex items-center gap-3 px-6 py-3 rounded-xl font-black text-sm transition-all cursor-pointer relative
                ${
                  activeTab === tab.id
                    ? "bg-white text-blue-600 shadow-md ring-1 ring-slate-200"
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                }
              `}
            >
              <Icon
                size={18}
                className={
                  activeTab === tab.id ? "text-blue-600" : "text-slate-400"
                }
              />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="tab-pill"
                  className="absolute inset-0 bg-white rounded-xl -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === "acesso" && (
              <div className="fixed top-44 left-4 right-4 md:left-24 md:right-10 bottom-10 z-10">
                <div className="max-w-[1000px] mx-auto h-full bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col overflow-hidden">
                  {/* Header - Fixed at top */}
                  <div className="p-6 md:p-8 border-b-2 border-slate-50 flex-shrink-0">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                        <Shield size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                          Membros da Equipe
                        </h2>
                        <p className="text-slate-500 font-bold text-sm md:text-base">
                          Gerencie {users.length} usuários ativos no sistema.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Table Area */}
                  <div className="flex-1 min-h-0 overflow-hidden p-4 md:p-6 bg-slate-50/30">
                    {!isAccessAdmin ? (
                      <div className="h-full bg-white rounded-2xl border-2 border-slate-100 shadow-sm overflow-hidden flex items-center justify-center p-10 text-center">
                        <div className="max-w-lg space-y-4">
                          <div className="mx-auto w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500">
                            <ShieldCheck size={28} />
                          </div>
                          <h3 className="text-xl font-black text-slate-800">
                            Gestão de acesso restrita
                          </h3>
                          <p className="text-slate-500 font-semibold leading-relaxed">
                            Apenas administradores podem visualizar e alterar os
                            usuários do sistema.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <DataTable
                        className="h-full min-h-0"
                        data={users}
                        maxHeight="100%"
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
                                  (item as UserWithAuth).tipo_usuario ===
                                  "gestor"
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
                                      handleDeleteUser(
                                        (item as UserWithAuth).id,
                                      )
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
                        searchPlaceholder="Buscar por nome, e-mail..."
                        emptyMessage="Nenhum usuário encontrado."
                        emptyIcon={<ShieldCheck size={48} />}
                        actionButton={
                          isAccessAdmin ? (
                            <button
                              onClick={() => setIsCreateModalOpen(true)}
                              className="flex items-center gap-2 bg-[var(--color-geolog-blue)] text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-blue-900/10 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-widest cursor-pointer"
                            >
                              <Plus size={18} strokeWidth={3} />
                              Novo Login
                            </button>
                          ) : undefined
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "perfil" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="md:col-span-1 space-y-8">
                  <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-10 text-center space-y-6">
                    <div className="relative inline-block">
                      <AvatarUploader
                        avatarUrl={profile?.avatar_url || null}
                        nome={profile?.nome || "Usuário"}
                        onAvatarChange={(url) => {
                          // O AuthContext atualizará automaticamente via realtime
                          void url;
                        }}
                        size="lg"
                      />
                    </div>

                    <div className="space-y-1">
                      {isEditingName ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-base text-slate-800 outline-none focus:border-blue-600 transition-all text-center"
                            placeholder="Seu nome"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleUpdateName}
                              disabled={isUpdatingName}
                              className="flex-1 py-2 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {isUpdatingName ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                  Salvando...
                                </>
                              ) : (
                                <>
                                  <Check size={16} />
                                  Salvar
                                </>
                              )}
                            </button>
                            <button
                              onClick={cancelEditingName}
                              className="flex-1 py-2 bg-slate-200 text-slate-600 font-black rounded-xl hover:bg-slate-300 transition-all flex items-center justify-center gap-2"
                            >
                              <X size={16} />
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-4">
                          <h2 className="text-2xl font-black text-slate-800 text-center flex-1">
                            {profile?.nome}
                          </h2>
                          <button
                            onClick={startEditingName}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Editar nome"
                          >
                            <Edit2 size={18} />
                          </button>
                        </div>
                      )}
                      <p className="text-blue-600 font-black uppercase tracking-widest text-xs italic">
                        {profile?.categoria} • {profile?.tipo_usuario}
                      </p>
                    </div>

                    <div className="pt-6 grid grid-cols-2 gap-3">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">
                          Logs
                        </div>
                        <div className="text-xl font-black text-slate-800">
                          42
                        </div>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">
                          Desde
                        </div>
                        <div className="text-xl font-black text-slate-800">
                          2026
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={logout}
                      className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-red-100 transition-all cursor-pointer border border-red-100 group"
                    >
                      <LogOut
                        size={20}
                        className="group-hover:-translate-x-1 transition-transform"
                      />
                      Encerrar Sessão
                    </button>
                  </div>
                </div>

                {/* Details Area */}
                <div className="md:col-span-2 space-y-8">
                  <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-10 space-y-10">
                    <div className="flex items-center gap-4 pb-6 border-b-2 border-slate-50">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500">
                        <Fingerprint size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-800">
                          Dados da Conta
                        </h3>
                        <p className="text-slate-500 font-bold">
                          Informações verificadas de acesso único.
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-10">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                          E-mail Corporativo
                        </label>
                        <div className="flex items-center gap-4 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700">
                          <Mail size={18} className="text-slate-400" />
                          {user?.email}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                          Função Atual
                        </label>
                        <div className="flex items-center gap-4 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 capitalize">
                          <Briefcase size={18} className="text-slate-400" />
                          {profile?.categoria}
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-green-50/50 rounded-3xl border-2 border-green-100 border-dashed flex items-start gap-4">
                      <CheckCircle
                        className="text-green-600 mt-1 flex-shrink-0"
                        size={20}
                      />
                      <div className="text-sm font-bold text-green-900 leading-relaxed">
                        Você pode editar seu nome de exibição clicando no ícone
                        de edição ao lado do seu nome. Para alterar sua senha ou
                        outras permissões, entre em contato com o suporte de TI
                        interno.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "financeiro" && (
              <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-10 space-y-10">
                  <div className="flex items-center gap-4 pb-6 border-b-2 border-slate-50">
                    <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                      <Percent size={28} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800">
                        Configurações Financeiras
                      </h2>
                      <p className="text-slate-500 font-bold">
                        Controle global de taxas e deduções das ordens de
                        serviço.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                        Porcentagem de Juros / Dedução (%)
                      </label>
                      <div className="relative group">
                        <Percent
                          className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                          size={18}
                        />
                        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                          %
                        </div>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full pl-12 pr-16 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-base outline-none focus:border-blue-600 transition-colors"
                          value={jurosInput}
                          onChange={(e) => setJurosInput(e.target.value)}
                          placeholder="Ex: 12,5%"
                        />
                      </div>
                      <p className="text-sm font-semibold text-slate-400 ml-1">
                        Digite apenas o valor numérico, com vírgula ou ponto se
                        necessário. Exemplo: 15, 15,5 ou 15%.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setIsDateModalOpen(true);
                        setEffectiveDate(
                          new Date().toISOString().split("T")[0],
                        );
                      }}
                      className="w-full py-4 bg-blue-600 text-white font-black rounded-xl shadow-lg hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.98] transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-70 flex justify-center items-center gap-3"
                    >
                      <Check size={18} />
                      Salvar Configuração
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
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
                                const currentPerms = ((selectedUserForPermissions.specific_permissions as Record<string, unknown>) || {}).financeiro as Record<string, unknown> || {};
                                void updateSpecificPermissions(
                                  selectedUserForPermissions.id,
                                  "financeiro",
                                  { ...currentPerms, page_access: e.target.checked },
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

      {/* Modal Data de Vigência */}
      {isDateModalOpen && (
        <StandardModal
          title="Data de Vigência"
          subtitle="A partir de qual dia a nova configuração deve valer?"
          icon={<Calendar size={24} />}
          onClose={() => setIsDateModalOpen(false)}
          maxWidthClassName="max-w-md"
        >
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                Aplicar a partir de
              </label>
              <div className="relative group">
                <Calendar
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                  size={18}
                />
                <input
                  type="date"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-base outline-none focus:border-blue-600 transition-colors"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
              </div>
              <p className="text-sm font-semibold text-slate-400 ml-1">
                Alterações retroativas afetam o cálculo de impostos de OS
                criadas a partir desta data.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsDateModalOpen(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    setIsSavingJuros(true);
                    setIsDateModalOpen(false);
                    const normalizedJuros = Number(
                      String(jurosInput)
                        .replace("%", "")
                        .replace(",", ".")
                        .trim(),
                    );

                    if (!Number.isFinite(normalizedJuros)) {
                      toast.error("Informe uma porcentagem válida.");
                      return;
                    }

                    await setImpostoPercentual(normalizedJuros, effectiveDate);
                    toast.success(
                      `Porcentagem de juros atualizada com sucesso! Vigente a partir de ${new Date(effectiveDate + "T00:00:00").toLocaleDateString("pt-BR")}.`,
                    );
                  } catch (err: unknown) {
                    toast.error(`Erro ao salvar: ${formatErrorMessage(err)}`);
                  } finally {
                    setIsSavingJuros(false);
                  }
                }}
                disabled={isSavingJuros || !effectiveDate}
                className="flex-1 py-4 bg-blue-600 text-white font-black rounded-xl shadow-lg hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.98] transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-70 flex justify-center items-center gap-3"
              >
                {isSavingJuros ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Aplicar Retroativo
                  </>
                )}
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
    </div>
  );
}
