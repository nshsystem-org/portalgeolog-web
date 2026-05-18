import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { X } from "lucide-react";

export interface AppNotification {
  id: string;
  type: "success" | "info" | "warning" | "error";
  title: string;
  message: string;
  target_audience: "interno" | "gestor" | "all";
  target_user_id: string | null;
  empresa_id: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_by_avatar_url: string | null;
  created_at: string;
}

const AUTO_DISMISS_MS = 6000;
const COOLDOWN_MS = 5000;

function showNativeNotification(notif: AppNotification): void {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const body = `${notif.created_by_name ? notif.created_by_name + ": " : ""}${notif.message}`;
  const icon = notif.created_by_avatar_url || "/logo.png";

  const native = new Notification(notif.title, {
    body,
    icon,
    badge: "/logo.png",
    tag: notif.id,
    requireInteraction: false,
    silent: false,
  });

  native.onclick = () => {
    window.focus();
    window.dispatchEvent(
      new CustomEvent("open-notifications-dropdown", { bubbles: true }),
    );
    native.close();
  };
}

function NotificationToastItem({
  toastId,
  notif,
}: {
  toastId: string | number;
  notif: AppNotification;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleDismiss = useCallback(
    (delay: number) => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        toast.dismiss(toastId);
      }, delay);
    },
    [toastId, clearTimer],
  );

  useEffect(() => {
    scheduleDismiss(AUTO_DISMISS_MS);
    return clearTimer;
  }, [scheduleDismiss, clearTimer]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    clearTimer();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    scheduleDismiss(COOLDOWN_MS);
  };

  const handleClick = () => {
    toast.dismiss(toastId);
    window.dispatchEvent(
      new CustomEvent("open-notifications-dropdown", { bubbles: true }),
    );
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast.dismiss(toastId);
  };

  const initials = (notif.created_by_name || "S").charAt(0).toUpperCase();

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`
        relative flex items-start gap-3 w-full min-w-[360px] max-w-[420px]
        bg-white rounded-2xl shadow-2xl shadow-slate-300/40
        border border-slate-100 p-4 cursor-pointer
        transition-all duration-300 ease-out
        hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)]
        hover:scale-[1.02]
        hover:border-blue-200
        animate-toast-in
        ${isHovered ? "ring-2 ring-blue-100" : ""}
      `}
    >
      {/* Indicador lateral colorido */}
      <div className="absolute left-0 top-4 bottom-4 w-1 rounded-full bg-gradient-to-b from-blue-500 to-blue-600" />

      {/* Avatar */}
      <div className="relative ml-1 flex-shrink-0">
        {notif.created_by_avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={notif.created_by_avatar_url}
            alt={notif.created_by_name || ""}
            className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-md"
          />
        ) : (
          <span className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white text-sm font-black flex items-center justify-center border-2 border-white shadow-md">
            {initials}
          </span>
        )}
        {/* Badge online sutil */}
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 pr-6">
        <p className="text-[13px] font-black text-slate-900 leading-tight tracking-tight">
          {notif.title}
        </p>
        <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed line-clamp-2">
          {notif.created_by_name ? (
            <span className="text-slate-700 font-semibold">
              {notif.created_by_name}
            </span>
          ) : null}
          {notif.created_by_name ? (
            <span className="text-slate-400 mx-1">•</span>
          ) : null}
          {notif.message}
        </p>
        <p className="text-[10px] text-slate-400 font-semibold mt-2 uppercase tracking-wider">
          {new Date(notif.created_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {isHovered && (
            <span className="ml-2 text-blue-400 normal-case tracking-normal">
              Clique para abrir
            </span>
          )}
        </p>
      </div>

      {/* Botão fechar */}
      <button
        onClick={handleClose}
        className="absolute top-3 right-3 p-1 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
        title="Fechar"
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const supabase = createClient();
  const knownIdsRef = useRef<Set<string>>(new Set());

  const showNotificationToast = (notif: AppNotification) => {
    toast.custom(
      (t) => <NotificationToastItem toastId={t} notif={notif} />,
      { duration: Infinity },
    );
  };

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const res = await fetch("/api/app-notifications");
        if (res.ok) {
          const data = (await res.json()) as AppNotification[];
          knownIdsRef.current = new Set(data.map((n) => n.id));
          setNotifications(data);
        } else {
          const errText = await res.text().catch(() => "Erro desconhecido");
          toast.error(`Falha ao carregar notificações: ${res.status}`);
          console.error("Erro ao buscar notificações:", res.status, errText);
        }
      } catch (error) {
        toast.error("Erro de rede ao carregar notificações");
        console.error("Erro ao buscar notificações:", error);
      }
    };

    fetchNotifications();

    // Solicitar permissão de notificações do sistema na primeira vez
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {
          // Silencioso: usuário pode bloquear
        });
      }
    }

    const channel = supabase
      .channel("app_notifications_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "app_notifications" },
        (payload: { new: Record<string, unknown> }) => {
          const notif = payload.new as unknown as AppNotification;
          const isNew = !knownIdsRef.current.has(notif.id);

          setNotifications((prev) => {
            if (prev.some((n) => n.id === notif.id)) return prev;
            return [notif, ...prev];
          });

          if (isNew) {
            knownIdsRef.current.add(notif.id);
            showNotificationToast(notif);
            showNativeNotification(notif);
          }
        },
      )
      .subscribe((status: string) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  const dismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const dismissAll = () => setNotifications([]);

  return {
    notifications,
    unreadCount: notifications.length,
    dismiss,
    dismissAll,
    realtimeConnected,
  };
}
