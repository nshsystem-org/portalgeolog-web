import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  X,
  Info,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Archive,
  RotateCcw,
} from "lucide-react";

// Função helper para formatar mensagem de notificação com protocolo em azul
function formatNotificationMessage(message: string): React.ReactNode {
  // Remove o [OS_ID:xxx] se existir
  let cleanMessage = message.replace(/\[OS_ID:[a-f0-9-]+\]/, "");

  // Extrai o protocolo em mensagens novas ("A OS ...") e aplica formatação azul
  const osRefMatch = cleanMessage.match(/\bA OS ([^\s.]+)/);
  if (osRefMatch) {
    const osRef = osRefMatch[1];
    const parts = cleanMessage.split(`A OS ${osRef}`);
    return (
      <>
        {parts[0]}
        <span className="text-blue-600 font-semibold">A OS {osRef}</span>
        {parts[1] || ""}
      </>
    );
  }

  // Extrai o protocolo (com ou sem #) e aplica formatação azul
  const protocoloMatch = cleanMessage.match(/Protocolo #?(\d+)/);
  if (protocoloMatch) {
    const protocolo = protocoloMatch[1];
    cleanMessage = cleanMessage.replace(
      /Protocolo #?\d+/,
      `Protocolo ${protocolo}`,
    );
    // Divide a mensagem e destaca o protocolo em azul
    const parts = cleanMessage.split(`Protocolo ${protocolo}`);
    return (
      <>
        {parts[0]}
        <span className="text-blue-600 font-semibold">{protocolo}</span>
        {parts[1] || ""}
      </>
    );
  }

  // Extrai protocolo entre aspas para OS arquivada/reaberta
  const quotesProtocoloMatch = cleanMessage.match(/"(\d{10})"/);
  if (quotesProtocoloMatch) {
    const protocolo = quotesProtocoloMatch[1];
    const parts = cleanMessage.split(`"${protocolo}"`);
    return (
      <>
        {parts[0]}
        <span className="text-blue-600 font-semibold">{protocolo}</span>
        {parts[1] || ""}
      </>
    );
  }

  return cleanMessage;
}

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

function getNotificationIcon(notif: AppNotification) {
  // Casos específicos baseados no título
  if (notif.title === "OS Arquivada") {
    return {
      icon: <Archive size={20} className="text-red-500" />,
      bgClass: "bg-red-50",
      gradientClass: "from-red-500 to-red-600",
      borderClass: "hover:border-red-200",
      ringClass: "ring-red-100",
    };
  }

  if (notif.title === "OS Reaberta") {
    return {
      icon: <RotateCcw size={20} className="text-emerald-500" />,
      bgClass: "bg-emerald-50",
      gradientClass: "from-emerald-500 to-emerald-600",
      borderClass: "hover:border-emerald-200",
      ringClass: "ring-emerald-100",
    };
  }

  // Mapeamento padrão baseado no tipo
  switch (notif.type) {
    case "success":
      return {
        icon: <CheckCircle size={20} className="text-emerald-500" />,
        bgClass: "bg-emerald-50",
        gradientClass: "from-emerald-500 to-emerald-600",
        borderClass: "hover:border-emerald-200",
        ringClass: "ring-emerald-100",
      };
    case "warning":
      return {
        icon: <AlertTriangle size={20} className="text-amber-500" />,
        bgClass: "bg-amber-50",
        gradientClass: "from-amber-500 to-amber-600",
        borderClass: "hover:border-amber-200",
        ringClass: "ring-amber-100",
      };
    case "error":
      return {
        icon: <AlertCircle size={20} className="text-red-500" />,
        bgClass: "bg-red-50",
        gradientClass: "from-red-500 to-red-600",
        borderClass: "hover:border-red-200",
        ringClass: "ring-red-100",
      };
    case "info":
    default:
      return {
        icon: <Info size={20} className="text-blue-500" />,
        bgClass: "bg-blue-50",
        gradientClass: "from-blue-500 to-blue-600",
        borderClass: "hover:border-blue-200",
        ringClass: "ring-blue-100",
      };
  }
}

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

    // Extrair ID da OS da mensagem se existir
    const osIdMatch = notif.message.match(/\[OS_ID:([a-f0-9-]+)\]/);
    if (osIdMatch) {
      const osId = osIdMatch[1];
      window.dispatchEvent(
        new CustomEvent("open-os-modal", { bubbles: true, detail: { osId } }),
      );
    } else {
      window.dispatchEvent(
        new CustomEvent("open-notifications-dropdown", { bubbles: true }),
      );
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast.dismiss(toastId);
  };

  const initials = (notif.created_by_name || "S").charAt(0).toUpperCase();
  const { icon, bgClass, gradientClass, borderClass, ringClass } =
    getNotificationIcon(notif);

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
        ${borderClass}
        animate-toast-in
        ${isHovered ? `ring-2 ${ringClass}` : ""}
      `}
    >
      {/* Indicador lateral colorido */}
      <div
        className={`absolute left-0 top-4 bottom-4 w-1 rounded-full bg-gradient-to-b ${gradientClass}`}
      />

      {/* Ícone do tipo de notificação */}
      <div className={`ml-1 flex-shrink-0 p-2 rounded-xl ${bgClass}`}>
        {icon}
      </div>

      {/* Avatar */}
      <div className="relative flex-shrink-0">
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
          {formatNotificationMessage(notif.message)}
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
    toast.custom((t) => <NotificationToastItem toastId={t} notif={notif} />, {
      duration: Infinity,
    });
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
