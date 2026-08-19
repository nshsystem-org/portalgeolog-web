"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { hasPageAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { toast } from "sonner";
import { Bell, MessageSquareWarning, Truck, Users, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function NotificacoesPage() {
  const { profile } = useAuth();

  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [isLoadingReminders, setIsLoadingReminders] = useState(false);
  const [isSavingReminders, setIsSavingReminders] = useState(false);
  // Flags de destinatarios de notificacao automatica (modal de OS)
  const [notifyFlags, setNotifyFlags] = useState({
    driver: true,
    passengers: false,
    solicitante: false,
  });
  const [isLoadingNotifyFlags, setIsLoadingNotifyFlags] = useState(false);
  const [isSavingNotifyFlag, setIsSavingNotifyFlag] = useState<string | null>(
    null,
  );

  const formatErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && "message" in err) {
      const message = (err as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
    return "Falha inesperada ao salvar a configuração.";
  };

  useEffect(() => {
    const NOTIFY_KEYS = [
      "os_notify_driver_enabled",
      "os_notify_passengers_enabled",
      "os_notify_solicitante_enabled",
    ];
    const load = async () => {
      setIsLoadingReminders(true);
      setIsLoadingNotifyFlags(true);
      try {
        const supabase = createClient();
        // Carregar flag de avisos de atraso
        const { data: remindersData } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "os_reminders_enabled")
          .maybeSingle();
        setRemindersEnabled(remindersData?.value !== "false");

        // Carregar flags de destinatarios de notificacao
        const { data: flagsData } = await supabase
          .from("app_settings")
          .select("key, value")
          .in("key", NOTIFY_KEYS);
        const map: Record<string, string> = {};
        for (const row of flagsData ?? []) map[row.key] = row.value;
        setNotifyFlags({
          driver: map["os_notify_driver_enabled"] !== "false",
          passengers: map["os_notify_passengers_enabled"] === "true",
          solicitante: map["os_notify_solicitante_enabled"] === "true",
        });
      } catch {
        // silently keep defaults
      } finally {
        setIsLoadingReminders(false);
        setIsLoadingNotifyFlags(false);
      }
    };
    void load();

    // Realtime: refletir mudancas feitas por outros admins em tempo real
    const supabase = createClient();
    const channel = supabase
      .channel("config-notify-flags-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "app_settings",
        },
        (payload) => {
          const newRow = payload.new as { key: string; value: string } | null;
          if (!newRow) return;
          if (newRow.key === "os_reminders_enabled") {
            setRemindersEnabled(newRow.value !== "false");
          } else if (NOTIFY_KEYS.includes(newRow.key)) {
            setNotifyFlags((prev) => {
              if (newRow.key === "os_notify_driver_enabled")
                return { ...prev, driver: newRow.value !== "false" };
              if (newRow.key === "os_notify_passengers_enabled")
                return { ...prev, passengers: newRow.value === "true" };
              if (newRow.key === "os_notify_solicitante_enabled")
                return { ...prev, solicitante: newRow.value === "true" };
              return prev;
            });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const handleToggleReminders = async (value: boolean) => {
    setIsSavingReminders(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("app_settings").upsert(
        {
          key: "os_reminders_enabled",
          value: String(value),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
      if (error) throw error;
      setRemindersEnabled(value);
      toast.success(
        value
          ? "Avisos de atraso ativados com sucesso!"
          : "Avisos de atraso desativados com sucesso!",
      );
    } catch (err: unknown) {
      toast.error("Erro ao salvar configuração: " + formatErrorMessage(err));
    } finally {
      setIsSavingReminders(false);
    }
  };

  const handleToggleNotifyFlag = async (
    flag: "driver" | "passengers" | "solicitante",
    value: boolean,
  ) => {
    const keyMap = {
      driver: "os_notify_driver_enabled",
      passengers: "os_notify_passengers_enabled",
      solicitante: "os_notify_solicitante_enabled",
    } as const;
    const labelMap = {
      driver: "Motorista Alocado",
      passengers: "Passageiros da Rota",
      solicitante: "Solicitante da Empresa",
    } as const;
    setIsSavingNotifyFlag(flag);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("app_settings").upsert(
        {
          key: keyMap[flag],
          value: String(value),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
      if (error) throw error;
      setNotifyFlags((prev) => ({ ...prev, [flag]: value }));
      toast.success(
        `${labelMap[flag]} ${value ? "ativado" : "desativado"} com sucesso!`,
      );
    } catch (err: unknown) {
      toast.error("Erro ao salvar configuração: " + formatErrorMessage(err));
    } finally {
      setIsSavingNotifyFlag(null);
    }
  };

  if (!hasPageAccess(profile, "config-notificacoes"))
    return <AccessDenied module="Notificações" />;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-10 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center">
            <Bell size={26} className="text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800">Notificações</h2>
            <p className="text-sm font-medium text-slate-400">
              Gerencie o envio automático de avisos via WhatsApp
            </p>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Toggle: Avisos de atraso */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
              <MessageSquareWarning size={20} className="text-amber-500" />
            </div>
            <div>
              <p className="text-base font-black text-slate-800">
                Avisos de atraso para motoristas
              </p>
              <p className="text-sm font-medium text-slate-400 mt-1 leading-relaxed">
                Envia mensagem automática via WhatsApp quando um motorista não
                inicia o atendimento no horário previsto (T+5min e T+30min).
              </p>
            </div>
          </div>

          {/* Toggle switch */}
          <button
            type="button"
            disabled={isLoadingReminders || isSavingReminders}
            onClick={() => void handleToggleReminders(!remindersEnabled)}
            className={`
              relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent
              transition-colors duration-200 ease-in-out focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              ${remindersEnabled ? "bg-violet-600" : "bg-slate-200"}
            `}
            aria-label="Ativar/desativar avisos de atraso"
          >
            <span
              className={`
                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0
                transition duration-200 ease-in-out
                ${remindersEnabled ? "translate-x-5" : "translate-x-0.5"}
              `}
            />
          </button>
        </div>

        {/* Status badge */}
        {!isLoadingReminders && (
          <div
            className={`
              flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold
              ${
                remindersEnabled
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }
            `}
          >
            <div
              className={`w-2 h-2 rounded-full ${remindersEnabled ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}
            />
            {remindersEnabled
              ? "Avisos ativos — o sistema enviará mensagens de atraso automaticamente"
              : "Avisos pausados — nenhuma mensagem de atraso será enviada"}
          </div>
        )}

        {isLoadingReminders && (
          <div className="flex items-center gap-3 text-slate-400 text-sm font-medium">
            <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
            Carregando configuração...
          </div>
        )}

        <div className="h-px bg-slate-100" />

        {/* Secao: Destinatarios de notificacao automatica na criacao de OS */}
        <div className="flex items-center gap-3 pt-2">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Bell size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-base font-black text-slate-800">
              Notificações automáticas ao cadastrar OS
            </p>
            <p className="text-sm font-medium text-slate-400 mt-0.5 leading-relaxed">
              Controla quais destinatários podem ser notificados no modal de
              nova OS
            </p>
          </div>
        </div>

        {/* Toggle: Motorista Alocado */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
              <Truck size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-base font-black text-slate-800">
                Motorista Alocado
              </p>
              <p className="text-sm font-medium text-slate-400 mt-1 leading-relaxed">
                Permite enviar template do WhatsApp ao motorista ao
                cadastrar/editar OS. Quando desativado, o toggle fica bloqueado
                no modal de notificações.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isLoadingNotifyFlags || isSavingNotifyFlag === "driver"}
            onClick={() =>
              void handleToggleNotifyFlag("driver", !notifyFlags.driver)
            }
            className={`
              relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent
              transition-colors duration-200 ease-in-out focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              ${notifyFlags.driver ? "bg-blue-600" : "bg-slate-200"}
            `}
            aria-label="Ativar/desativar notificação ao motorista"
          >
            <span
              className={`
                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0
                transition duration-200 ease-in-out
                ${notifyFlags.driver ? "translate-x-5" : "translate-x-0.5"}
              `}
            />
          </button>
        </div>

        {/* Toggle: Passageiros da Rota */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
              <Users size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-base font-black text-slate-800">
                Passageiros da Rota
              </p>
              <p className="text-sm font-medium text-slate-400 mt-1 leading-relaxed">
                Permite notificar passageiros da rota ao cadastrar OS. Quando
                desativado, o toggle fica bloqueado no modal de notificações.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={
              isLoadingNotifyFlags || isSavingNotifyFlag === "passengers"
            }
            onClick={() =>
              void handleToggleNotifyFlag("passengers", !notifyFlags.passengers)
            }
            className={`
              relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent
              transition-colors duration-200 ease-in-out focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              ${notifyFlags.passengers ? "bg-emerald-600" : "bg-slate-200"}
            `}
            aria-label="Ativar/desativar notificação aos passageiros"
          >
            <span
              className={`
                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0
                transition duration-200 ease-in-out
                ${notifyFlags.passengers ? "translate-x-5" : "translate-x-0.5"}
              `}
            />
          </button>
        </div>

        {/* Toggle: Solicitante da Empresa */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
              <User size={20} className="text-violet-600" />
            </div>
            <div>
              <p className="text-base font-black text-slate-800">
                Solicitante da Empresa
              </p>
              <p className="text-sm font-medium text-slate-400 mt-1 leading-relaxed">
                Permite notificar o solicitante da empresa ao cadastrar OS.
                Quando desativado, o toggle fica bloqueado no modal de
                notificações.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={
              isLoadingNotifyFlags || isSavingNotifyFlag === "solicitante"
            }
            onClick={() =>
              void handleToggleNotifyFlag(
                "solicitante",
                !notifyFlags.solicitante,
              )
            }
            className={`
              relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent
              transition-colors duration-200 ease-in-out focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              ${notifyFlags.solicitante ? "bg-violet-600" : "bg-slate-200"}
            `}
            aria-label="Ativar/desativar notificação ao solicitante"
          >
            <span
              className={`
                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0
                transition duration-200 ease-in-out
                ${notifyFlags.solicitante ? "translate-x-5" : "translate-x-0.5"}
              `}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
