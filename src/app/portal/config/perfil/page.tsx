"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { hasPageAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { AvatarUploader } from "@/components/ui/AvatarUploader";
import { toast } from "sonner";
import {
  Check,
  X,
  Edit2,
  LogOut,
  Mail,
  Fingerprint,
  Briefcase,
  CheckCircle,
} from "lucide-react";

export default function PerfilPage() {
  const { user, profile, logout } = useAuth();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  if (!hasPageAccess(profile, "config-perfil")) {
    return <AccessDenied module="Meu Perfil" />;
  }

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

  const startEditingName = () => {
    setEditingName(profile?.nome || "");
    setIsEditingName(true);
  };

  const cancelEditingName = () => {
    setIsEditingName(false);
    setEditingName("");
  };

  return (
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
              <div className="text-xl font-black text-slate-800">42</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">
                Desde
              </div>
              <div className="text-xl font-black text-slate-800">2026</div>
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
              Você pode editar seu nome de exibição clicando no ícone de edição
              ao lado do seu nome. Para alterar sua senha ou outras permissões,
              entre em contato com o suporte de TI interno.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
