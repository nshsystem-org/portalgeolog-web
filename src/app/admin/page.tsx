"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  Shield,
  ArrowLeft,
  LogOut,
  LayoutDashboard,
  Activity,
  Bell,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
} from "lucide-react";
import LogsViewer from "@/components/LogsViewer";
import RichTextEditor from "@/components/RichTextEditor";
import { logInfo } from "@/lib/frontend-logger";
import Link from "next/link";
import {
  fetchAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "@/lib/supabase/queries";
import { toast } from "sonner";

type AdminTab = "logs" | "dashboard" | "avisos";

interface Announcement {
  id: string;
  title: string;
  subtitle: string | null;
  message: string;
  type: "info" | "warning" | "error" | "success";
  is_active: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  created_by: string | null;
}

export default function AdminPage() {
  const { user, profile, loading, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>("logs");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    message: "",
    type: "info" as "info" | "warning" | "error" | "success",
    expires_at: "",
  });

  useEffect(() => {
    if (!loading && (!user || profile?.categoria !== "administrador")) {
      router.push("/portal/dashboard");
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (profile?.categoria === "administrador") {
      logInfo("AdminPage", "Página de administração acessada");
    }
  }, [profile]);

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/verify", { method: "DELETE" });
    } catch {
      // não bloqueia logout por falha de revogação de token
    }
    await logout();
    router.push("/login");
  };

  const loadAnnouncements = async () => {
    try {
      setAnnouncementsLoading(true);
      const data = await fetchAllAnnouncements();
      setAnnouncements(data);
    } catch (error) {
      console.error("Erro ao carregar avisos:", error);
      toast.error("Erro ao carregar avisos");
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "avisos") {
      loadAnnouncements();
    }
  }, [activeTab]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await createAnnouncement(
        formData.title,
        formData.subtitle || null,
        formData.message,
        formData.type,
        formData.expires_at || undefined,
        user?.id,
      );
      toast.success("Aviso criado com sucesso!");
      setIsAnnouncementModalOpen(false);
      setFormData({
        title: "",
        subtitle: "",
        message: "",
        type: "info",
        expires_at: "",
      });
      loadAnnouncements();
    } catch (error) {
      console.error("Erro ao criar aviso:", error);
      toast.error("Erro ao criar aviso");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnnouncement) return;
    try {
      setIsSubmitting(true);
      await updateAnnouncement(editingAnnouncement.id, {
        title: formData.title,
        subtitle: formData.subtitle || null,
        message: formData.message,
        type: formData.type,
        expires_at: formData.expires_at || null,
      });
      toast.success("Aviso atualizado com sucesso!");
      setIsAnnouncementModalOpen(false);
      setEditingAnnouncement(null);
      setFormData({
        title: "",
        subtitle: "",
        message: "",
        type: "info",
        expires_at: "",
      });
      loadAnnouncements();
    } catch (error) {
      console.error("Erro ao atualizar aviso:", error);
      toast.error("Erro ao atualizar aviso");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteAnnouncement(id);
      toast.success("Aviso excluído com sucesso!");
      loadAnnouncements();
    } catch (error) {
      console.error("Erro ao excluir aviso:", error);
      toast.error("Erro ao excluir aviso");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateAnnouncement(id, { is_active: !isActive });
      toast.success(isActive ? "Aviso desativado" : "Aviso ativado");
      loadAnnouncements();
    } catch (error) {
      console.error("Erro ao alterar status do aviso:", error);
      toast.error("Erro ao alterar status do aviso");
    }
  };

  const openCreateModal = () => {
    setEditingAnnouncement(null);
    setFormData({
      title: "",
      subtitle: "",
      message: "",
      type: "info",
      expires_at: "",
    });
    setIsAnnouncementModalOpen(true);
  };

  const openEditModal = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      subtitle: announcement.subtitle || "",
      message: announcement.message,
      type: announcement.type,
      expires_at: announcement.expires_at
        ? announcement.expires_at.split("T")[0]
        : "",
    });
    setIsAnnouncementModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || profile?.categoria !== "administrador") {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF]">
      {/* Admin Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 shadow-sm z-50">
        <div className="w-full px-5">
          <div className="flex items-center justify-between h-16">
            {/* Left side - Logo and Back */}
            <div className="flex items-center gap-4">
              <Link
                href="/portal/dashboard"
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="font-medium">Voltar ao Portal</span>
              </Link>
              <div className="h-6 w-px bg-slate-200"></div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-600 rounded-lg">
                  <Shield className="text-white" size={18} />
                </div>
                <span className="font-black text-[var(--color-geolog-blue)] text-lg">
                  Admin
                </span>
              </div>
            </div>

            {/* Center - Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setActiveTab("logs")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  activeTab === "logs"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Activity size={16} />
                Logs
              </button>
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  activeTab === "dashboard"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutDashboard size={16} />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab("avisos")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  activeTab === "avisos"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Bell size={16} />
                Avisos
              </button>
            </div>

            {/* Right side - User and Logout */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">
                  {profile?.nome}
                </p>
                <p className="text-xs text-slate-500">Administrador</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-bold text-sm transition-colors"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 pb-8 px-5">
        <div className="max-w-7xl mx-auto">
          {activeTab === "logs" && (
            <div className="space-y-6">
              <div className="mb-6">
                <h1 className="text-2xl font-black text-[var(--color-geolog-blue)] mb-2">
                  Histórico de Logs
                </h1>
                <p className="text-gray-600">
                  Visualize e monitore os logs do sistema em tempo real
                </p>
              </div>
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 p-6">
                <LogsViewer />
              </div>
            </div>
          )}

          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <div className="mb-6">
                <h1 className="text-2xl font-black text-[var(--color-geolog-blue)] mb-2">
                  Dashboard Administrativo
                </h1>
                <p className="text-gray-600">
                  Visão geral das métricas e estatísticas do sistema
                </p>
              </div>
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-slate-100 rounded-full">
                    <LayoutDashboard size={48} className="text-slate-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-700">
                    Dashboard em desenvolvimento
                  </h2>
                  <p className="text-slate-500 max-w-md">
                    Esta funcionalidade estará disponível em breve. Por
                    enquanto, utilize a aba de Logs para monitorar o sistema.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "avisos" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-black text-[var(--color-geolog-blue)] mb-2">
                    Avisos do Sistema
                  </h1>
                  <p className="text-gray-600">
                    Gerencie avisos e comunicados para os usuários
                  </p>
                </div>
                <button
                  onClick={openCreateModal}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
                >
                  <Plus size={16} />
                  Novo Aviso
                </button>
              </div>

              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 p-6">
                {announcementsLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Carregando avisos...</p>
                  </div>
                ) : announcements.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="p-4 bg-slate-100 rounded-full inline-block mb-4">
                      <Bell size={48} className="text-slate-400" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-700 mb-2">
                      Nenhum aviso cadastrado
                    </h2>
                    <p className="text-slate-500 max-w-md mx-auto">
                      Crie avisos para informar os usuários sobre manutenções,
                      atualizações ou comunicados importantes.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {announcements.map((announcement) => (
                      <div
                        key={announcement.id}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          announcement.is_active
                            ? "border-slate-200 bg-white"
                            : "border-slate-100 bg-slate-50 opacity-60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${
                                  announcement.type === "info"
                                    ? "bg-blue-100 text-blue-700"
                                    : announcement.type === "warning"
                                      ? "bg-amber-100 text-amber-700"
                                      : announcement.type === "error"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-green-100 text-green-700"
                                }`}
                              >
                                {announcement.type}
                              </span>
                              {!announcement.is_active && (
                                <span className="px-2 py-1 rounded-md text-xs font-bold uppercase bg-slate-200 text-slate-600">
                                  Inativo
                                </span>
                              )}
                            </div>
                            <h3 className="font-bold text-slate-800 mb-1">
                              {announcement.title}
                            </h3>
                            {announcement.subtitle && (
                              <p className="text-sm text-slate-500 mb-1 italic">
                                {announcement.subtitle}
                              </p>
                            )}
                            <div
                              className="text-sm text-slate-600 mb-2 prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{
                                __html: announcement.message,
                              }}
                            />
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              <span>
                                Criado em{" "}
                                {new Date(
                                  announcement.created_at,
                                ).toLocaleDateString("pt-BR")}
                              </span>
                              {announcement.expires_at && (
                                <span>
                                  Expira em{" "}
                                  {new Date(
                                    announcement.expires_at,
                                  ).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                handleToggleActive(
                                  announcement.id,
                                  announcement.is_active,
                                )
                              }
                              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                              title={
                                announcement.is_active
                                  ? "Desativar aviso"
                                  : "Ativar aviso"
                              }
                            >
                              {announcement.is_active ? (
                                <X size={16} className="text-slate-500" />
                              ) : (
                                <Check size={16} className="text-green-500" />
                              )}
                            </button>
                            <button
                              onClick={() => openEditModal(announcement)}
                              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Editar aviso"
                            >
                              <Edit2 size={16} className="text-slate-500" />
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteAnnouncement(announcement.id)
                              }
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir aviso"
                            >
                              <Trash2 size={16} className="text-red-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal de Criação/Edição de Aviso */}
          {isAnnouncementModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="p-6 border-b border-slate-200">
                  <h2 className="text-xl font-black text-slate-800">
                    {editingAnnouncement ? "Editar Aviso" : "Novo Aviso"}
                  </h2>
                </div>
                <form
                  onSubmit={
                    editingAnnouncement
                      ? handleEditAnnouncement
                      : handleCreateAnnouncement
                  }
                  className="p-6 space-y-4"
                >
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Título
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Subtítulo (opcional)
                    </label>
                    <input
                      type="text"
                      value={formData.subtitle}
                      onChange={(e) =>
                        setFormData({ ...formData, subtitle: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Mensagem
                    </label>
                    <RichTextEditor
                      content={formData.message}
                      onChange={(content) =>
                        setFormData({ ...formData, message: content })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        Tipo
                      </label>
                      <select
                        value={formData.type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            type: e.target.value as
                              | "info"
                              | "warning"
                              | "error"
                              | "success",
                          })
                        }
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="info">Info</option>
                        <option value="warning">Aviso</option>
                        <option value="error">Erro</option>
                        <option value="success">Sucesso</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Data de Expiração (opcional)
                    </label>
                    <input
                      type="date"
                      value={formData.expires_at}
                      onChange={(e) =>
                        setFormData({ ...formData, expires_at: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAnnouncementModalOpen(false);
                        setEditingAnnouncement(null);
                        setFormData({
                          title: "",
                          subtitle: "",
                          message: "",
                          type: "info",
                          expires_at: "",
                        });
                      }}
                      className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting
                        ? "Salvando..."
                        : editingAnnouncement
                          ? "Atualizar"
                          : "Criar"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
