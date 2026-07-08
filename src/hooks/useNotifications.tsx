import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { getThumbnailUrl } from "@/utils/avatar";
import { toast } from "sonner";
import {
  X,
  Info,
  CheckCircle,
  CircleCheckBig,
  FilePlus,
  AlertTriangle,
  AlertCircle,
  Archive,
  RotateCcw,
  RefreshCw,
  HandCoins,
} from "lucide-react";

// Função helper para formatar mensagem de notificação com protocolo em azul
export function formatNotificationMessage(message: string): React.ReactNode {
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
  read?: boolean;
  metadata?: Record<string, unknown> | null;
  /**
   * "sistema": eventos administrativos/operacionais (novo atendimento,
   * repasse, docagem, etc.) — exibidos no sino.
   * "motorista": movimentação de motorista (visualizou detalhes, iniciou/
   * finalizou rota, mensagem enviada/entregue, atraso) — exibidos no
   * dropdown "Motoristas" separado.
   */
  category: "sistema" | "motorista";
}

const AUTO_DISMISS_MS = 6000;
const COOLDOWN_MS = 5000;

function getNotificationIcon(notif: AppNotification) {
  // Casos específicos baseados no título
  if (
    notif.title === "OS Arquivada" ||
    notif.title === "Atendimento arquivado"
  ) {
    return {
      icon: <Archive size={20} className="text-red-500" />,
      bgClass: "bg-red-50",
      gradientClass: "from-red-500 to-red-600",
      borderClass: "hover:border-red-200",
      ringClass: "ring-red-100",
    };
  }

  if (notif.title === "OS Reaberta" || notif.title === "Atendimento reaberto") {
    return {
      icon: <RotateCcw size={20} className="text-blue-500" />,
      bgClass: "bg-blue-50",
      gradientClass: "from-blue-500 to-blue-600",
      borderClass: "hover:border-blue-200",
      ringClass: "ring-blue-100",
    };
  }

  if (notif.title === "Atendimento finalizado") {
    return {
      icon: <CircleCheckBig size={20} className="text-green-500" />,
      bgClass: "bg-green-50",
      gradientClass: "from-green-500 to-green-600",
      borderClass: "hover:border-green-200",
      ringClass: "ring-green-100",
    };
  }

  if (notif.title === "Repasse em lote registrado") {
    return {
      icon: <HandCoins size={20} className="text-emerald-600" />,
      bgClass: "bg-emerald-50",
      gradientClass: "from-emerald-500 to-emerald-600",
      borderClass: "hover:border-emerald-200",
      ringClass: "ring-emerald-100",
    };
  }

  if (notif.title === "Status do atendimento atualizado") {
    return {
      icon: <RefreshCw size={20} className="text-sky-400" />,
      bgClass: "bg-sky-50",
      gradientClass: "from-sky-400 to-sky-500",
      borderClass: "hover:border-sky-200",
      ringClass: "ring-sky-100",
    };
  }

  if (notif.title === "Novo atendimento") {
    return {
      icon: <FilePlus size={20} className="text-green-500" />,
      bgClass: "bg-green-50",
      gradientClass: "from-green-500 to-green-600",
      borderClass: "hover:border-green-200",
      ringClass: "ring-green-100",
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
        icon: <AlertTriangle size={20} className="text-red-500" />,
        bgClass: "bg-red-50",
        gradientClass: "from-red-500 to-red-600",
        borderClass: "hover:border-red-200",
        ringClass: "ring-red-100",
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

  const cleanMessage = notif.message.replace(/\s*\[OS_ID:[a-f0-9-]+\]/gi, "");
  const body = `${notif.created_by_name ? notif.created_by_name + ": " : ""}${cleanMessage}`;
  const icon = getThumbnailUrl(notif.created_by_avatar_url, 100) || "/logo.png";

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
            src={getThumbnailUrl(notif.created_by_avatar_url, 88) || ""}
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

export function useNotifications(options?: {
  onPendenciaAlert?: (counts: {
    semValor: number;
    atrasadas: number;
    docagens: number;
    total: number;
  }) => void;
}) {
  const { user, loading } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const supabase = createClient();
  const knownIdsRef = useRef<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const pendenciaAlertCbRef = useRef(options?.onPendenciaAlert);

  // Mantém a ref do callback atualizada sem reexecutar o useEffect do realtime
  useEffect(() => {
    pendenciaAlertCbRef.current = options?.onPendenciaAlert;
  }, [options?.onPendenciaAlert]);

  const showNotificationToast = (notif: AppNotification) => {
    toast.custom((t) => <NotificationToastItem toastId={t} notif={notif} />, {
      duration: Infinity,
    });
  };

  /**
   * Verifica se a notificação é um alerta de pendências (cron 2h).
   * Se for, chama o callback registrado e retorna true (não mostra toast).
   */
  const maybeHandlePendenciaAlert = (notif: AppNotification): boolean => {
    const meta = notif.metadata as Record<string, unknown> | null;
    if (meta?.kind !== "pendencia_alert") return false;
    const counts = meta.counts as
      | { semValor: number; atrasadas: number; docagens: number; total: number }
      | undefined;
    if (!counts || counts.total === 0) return false;
    pendenciaAlertCbRef.current?.(counts);
    return true;
  };

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Aguarda a auth terminar de inicializar antes de buscar notificações.
    // Isso evita race conditions no reload onde o user oscila null → user.
    if (!user || loading) return;

    // Cancela fetch anterior se o efeito reexecutar (ex: onAuthStateChange)
    if (abortRef.current) {
      abortRef.current.abort();
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 1500;

    const fetchNotifications = async (attempt: number) => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/app-notifications", {
          signal: controller.signal,
        });

        if (!isMountedRef.current) return;

        if (res.ok) {
          const data = (await res.json()) as AppNotification[];
          if (!isMountedRef.current) return;
          knownIdsRef.current = new Set(data.map((n) => n.id));
          setNotifications(data);

          // No load inicial, verifica se a notificação mais recente é um
          // alerta de pendências (cron 2h). Se for, dispara o modal — caso
          // contrário o usuário que carregou a página depois do cron nunca
          // veria o modal, apenas a notificação no sino.
          const latest = data[0];
          if (latest) {
            maybeHandlePendenciaAlert(latest);
          }
          return;
        }

        // Status não-OK: loga mas só mostra toast se for erro de servidor (5xx)
        const errText = await res.text().catch(() => "Erro desconhecido");
        console.error("Erro ao buscar notificações:", res.status, errText);

        if (res.status >= 500 && attempt < MAX_RETRIES) {
          scheduleRetry(attempt);
          return;
        }

        // 401/403/etc: não mostra toast vermelho (sessão pode estar expirando)
        if (res.status >= 500) {
          toast.error(`Falha ao carregar notificações: ${res.status}`);
        }
      } catch (error) {
        if (!isMountedRef.current) return;

        // AbortError: fetch cancelado pelo re-run do efeito — silencioso
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Erro de rede ao buscar notificações:", error);

        // Retry com backoff exponencial para erros transitórios
        if (attempt < MAX_RETRIES) {
          scheduleRetry(attempt);
          return;
        }

        // Só mostra o toast após esgotar retries
        toast.error("Erro de rede ao carregar notificações");
      }
    };

    const scheduleRetry = (attempt: number) => {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      retryTimerRef.current = setTimeout(() => {
        if (isMountedRef.current && user) {
          fetchNotifications(attempt + 1);
        }
      }, delay);
    };

    fetchNotifications(0);

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
            // Alertas de pendências (cron 2h) abrem modal bloqueante em vez
            // do toast padrão. O callback é registrado via options.onPendenciaAlert.
            if (maybeHandlePendenciaAlert(notif)) return;
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
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [user, loading, supabase]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    try {
      await fetch("/api/app-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [id] }),
      });
    } catch {
      // Silencioso: se falhar, o estado local já está atualizado
    }
  };

  const markAllAsRead = async (category?: "sistema" | "motorista") => {
    setNotifications((prev) =>
      prev.map((n) =>
        !category || n.category === category ? { ...n, read: true } : n,
      ),
    );
    try {
      await fetch("/api/app-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true, category }),
      });
    } catch {
      // Silencioso
    }
  };

  const dismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const dismissAll = () => setNotifications([]);

  // Eventos de sistema (sino) vs. movimentação de motorista (dropdown azul
  // "Motoristas"), mantidos separados para não lotar um com o outro.
  const systemNotifications = useMemo(
    () => notifications.filter((n) => n.category !== "motorista"),
    [notifications],
  );
  const driverNotifications = useMemo(
    () => notifications.filter((n) => n.category === "motorista"),
    [notifications],
  );

  const unreadCount = systemNotifications.filter((n) => !n.read).length;
  const driverUnreadCount = driverNotifications.filter((n) => !n.read).length;

  return {
    notifications,
    systemNotifications,
    driverNotifications,
    unreadCount,
    driverUnreadCount,
    markAsRead,
    markAllAsRead,
    dismiss,
    dismissAll,
    realtimeConnected,
  };
}
