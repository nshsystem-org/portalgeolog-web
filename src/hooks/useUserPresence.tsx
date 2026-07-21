import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { getThumbnailUrl } from "@/utils/avatar";
import {
  PRESENCE_ACTIVE_NOW_TIMEOUT_MS,
  PRESENCE_ONLINE_TIMEOUT_MS,
} from "@/lib/presence";
import { toast } from "sonner";
import { X } from "lucide-react";

export interface PresenceUser {
  id: string;
  nome: string;
  tipo_usuario: string;
  categoria: string;
  avatar_url: string | null;
  is_online: boolean;
  is_active_now: boolean;
  last_seen_at: string | null;
  last_activity_at: string | null;
}

const HEARTBEAT_MIN_INTERVAL_MS = 60000;
const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "scroll",
  "touchstart",
] as const;

function getRelativeElapsedLabel(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "agora mesmo";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} h`;
  return `${Math.floor(diff / 86400000)} dias`;
}

function getTimeAgoLabel(dateStr: string | null): string {
  if (!dateStr) return "Nunca ativo";
  const relative = getRelativeElapsedLabel(dateStr);
  return relative === "agora mesmo" ? "Agora mesmo" : `Há ${relative}`;
}

function getPresenceStatusLabel(user: PresenceUser): string {
  if (user.is_active_now) return "Ativo agora";
  if (user.is_online) {
    const relative = getRelativeElapsedLabel(user.last_activity_at);
    return relative ? `Atividade recente há ${relative}` : "Online recente";
  }
  if (user.last_seen_at) {
    const relative = getRelativeElapsedLabel(user.last_seen_at);
    return relative ? `Offline há ${relative}` : "Nunca ativo";
  }
  return "Nunca ativo";
}

function showNativePresenceNotification(user: PresenceUser): void {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const native = new Notification(user.nome, {
    body: "entrou no portal",
    icon: user.avatar_url || "/logo.png",
    badge: "/logo.png",
    tag: `presence-${user.id}`,
    requireInteraction: false,
    silent: false,
  });

  native.onclick = () => {
    window.focus();
    window.dispatchEvent(
      new CustomEvent("open-employees-dropdown", { bubbles: true }),
    );
    native.close();
  };
}

function PresenceToastItem({
  toastId,
  user,
}: {
  toastId: string | number;
  user: PresenceUser;
}) {
  const initials = user.nome.charAt(0).toUpperCase();

  return (
    <div
      onClick={() => {
        toast.dismiss(toastId);
        window.dispatchEvent(
          new CustomEvent("open-employees-dropdown", { bubbles: true }),
        );
      }}
      className={`
        relative flex items-center gap-3 w-full min-w-[320px] max-w-[380px]
        bg-white rounded-2xl shadow-2xl shadow-slate-300/40
        border border-slate-100 p-4 cursor-pointer
        transition-all duration-300 ease-out
        hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)]
        hover:scale-[1.02] hover:ring-2 ring-emerald-100
        animate-toast-in
      `}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getThumbnailUrl(user.avatar_url, 88) || ""}
            alt={user.nome}
            className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-md"
          />
        ) : (
          <span className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white text-sm font-black flex items-center justify-center border-2 border-white shadow-md">
            {initials}
          </span>
        )}
        {/* Badge online */}
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
      </div>

      {/* Conteudo */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-black text-slate-900 leading-tight">
          {user.nome}
        </p>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          entrou no portal
        </p>
        <p className="text-[10px] text-emerald-500 font-bold mt-1 uppercase tracking-wider flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          Online
        </p>
      </div>

      {/* Fechar */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toast.dismiss(toastId);
        }}
        className="absolute top-3 right-3 p-1 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
        title="Fechar"
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function useUserPresence() {
  const { user } = useAuth();
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const prevStatusRef = useRef<Record<string, boolean>>({});
  const lastHeartbeatSentAtRef = useRef(0);
  const knownIdsRef = useRef<Set<string>>(new Set());
  // Dedup de notificacao "entrou no portal" por usuario. O fetch inicial e o
  // listener Realtime podem disparar a mesma transicao offline -> online em
  // sequencia (race condition), gerando toast/notificacao desktop duplicada.
  // Guardamos o timestamp da ultima notificacao por user_id e so notificamos
  // novamente apos PRESENCE_NOTIFY_DEDUP_MS.
  const PRESENCE_NOTIFY_DEDUP_MS = 30000;
  const lastNotifiedAtRef = useRef<Record<string, number>>({});

  // Notifica "entrou no portal" com dedup por user_id (toast + nativa).
  // Usa id fixo no toast do sonner para que uma nova chamada substitua a
  // anterior em vez de empilhar.
  const notifyUserEntered = useCallback((u: PresenceUser) => {
    const now = Date.now();
    const last = lastNotifiedAtRef.current[u.id] ?? 0;
    if (now - last < PRESENCE_NOTIFY_DEDUP_MS) return;
    lastNotifiedAtRef.current[u.id] = now;

    toast.custom((t) => <PresenceToastItem toastId={t} user={u} />, {
      id: `presence-entered-${u.id}`,
      duration: 4000,
    });
    showNativePresenceNotification(u);
  }, []);
  // Garante que apenas a primeira carga (por usuario) seja tratada como inicial,
  // evitando toasts duplicados em re-execucoes do efeito de mount (StrictMode,
  // re-emissao do objeto user, renovacao de token, etc.).
  const didInitialFetchRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  const onlineCount = users.filter((u) => u.is_online).length;
  const activeNowCount = users.filter((u) => u.is_active_now).length;

  const fetchUsers = useCallback(
    async (isInitial = false) => {
      try {
        if (isInitial) setLoading(true);
        const res = await fetch("/api/presence/users");
        if (!res.ok) {
          const text = await res.text().catch(() => "Erro desconhecido");
          throw new Error(text);
        }
        const data = (await res.json()) as PresenceUser[];
        console.log(
          "[Presence] Users fetched:",
          data.length,
          "online:",
          data.filter((u) => u.is_online).length,
        );

        // Detectar transicoes offline -> online para notificar (apenas no fetch inicial)
        if (isInitial) {
          const prevStatus = prevStatusRef.current;
          data.forEach((u) => {
            const wasOnline = prevStatus[u.id];
            if (
              !wasOnline &&
              u.is_online &&
              knownIdsRef.current.has(u.id) &&
              u.id !== user?.id
            ) {
              notifyUserEntered(u);
            }
          });
        }

        // Atualizar estado conhecido
        prevStatusRef.current = data.reduce(
          (acc, u) => {
            acc[u.id] = u.is_online;
            return acc;
          },
          {} as Record<string, boolean>,
        );
        data.forEach((u) => knownIdsRef.current.add(u.id));

        // Ativo agora primeiro, depois online recente, depois offline
        const sorted = data.sort((a, b) => {
          if (a.is_active_now !== b.is_active_now) {
            return a.is_active_now ? -1 : 1;
          }
          if (a.is_online !== b.is_online) {
            return a.is_online ? -1 : 1;
          }
          return a.nome.localeCompare(b.nome);
        });

        setUsers(sorted);
        setError(null);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Erro ao carregar presenca";
        setError(message);
        console.error("useUserPresence fetch error:", message);
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [user?.id, notifyUserEntered],
  );

  const sendHeartbeat = useCallback(
    async (force = false) => {
      if (!user) {
        return;
      }
      const now = Date.now();
      if (
        !force &&
        now - lastHeartbeatSentAtRef.current < HEARTBEAT_MIN_INTERVAL_MS
      ) {
        return;
      }
      lastHeartbeatSentAtRef.current = now;
      try {
        const res = await fetch("/api/presence/heartbeat", {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "unknown");
          console.error("[Presence] Heartbeat failed:", res.status, text);
        }
      } catch (err) {
        console.error("[Presence] Heartbeat error:", err);
      }
    },
    [user],
  );

  // Carregar inicial e heartbeat
  useEffect(() => {
    if (!user) {
      setUsers([]);
      setLoading(false);
      lastHeartbeatSentAtRef.current = 0;
      // Resetar o guard para que o proximo login seja tratado como carga inicial.
      didInitialFetchRef.current = false;
      lastUserIdRef.current = null;
      return;
    }

    // Resetar o guard quando o usuario muda de verdade (troca de conta na
    // mesma sessao SPA), para que o novo usuario receba a carga inicial.
    if (lastUserIdRef.current !== user.id) {
      lastUserIdRef.current = user.id;
      didInitialFetchRef.current = false;
    }

    // Marcar o guard ANTES do fetch (sincrono) para que re-execucoes concorrentes
    // (ex.: StrictMode em dev) nao disparem fetchUsers(true) duplicado.
    const shouldFetchInitial = !didInitialFetchRef.current;
    didInitialFetchRef.current = true;

    fetchUsers(shouldFetchInitial);

    // Heartbeat inicial para marcar a sessao como ativa sem esperar interacao.
    void sendHeartbeat(true);

    const handleActivity = () => {
      void sendHeartbeat();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void sendHeartbeat();
      }
    };

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, fetchUsers, sendHeartbeat]);

  // Realtime listener para mudancas de presenca
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("user_presence_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        (payload) => {
          // Atualiza o estado local baseado na mudanca recebida, evitando um novo fetch total
          const newRow = payload.new as {
            user_id: string;
            status: string;
            last_seen_at: string;
            last_activity_at?: string | null;
          };
          if (!newRow || !newRow.user_id) return;

          setUsers((prev) => {
            const userIndex = prev.findIndex((u) => u.id === newRow.user_id);
            if (userIndex === -1) return prev;

            const oldUser = prev[userIndex];
            const onlineCutoff = Date.now() - PRESENCE_ONLINE_TIMEOUT_MS;
            const activeNowCutoff = Date.now() - PRESENCE_ACTIVE_NOW_TIMEOUT_MS;
            const lastSeenAt = new Date(newRow.last_seen_at).getTime();
            const lastActivityAt = new Date(
              newRow.last_activity_at ?? newRow.last_seen_at,
            ).getTime();
            const isOnline =
              newRow.status === "online" && lastSeenAt > onlineCutoff;
            const isActiveNow =
              newRow.status === "online" && lastActivityAt > activeNowCutoff;

            // Notificar se mudou para online agora
            if (!oldUser.is_online && isOnline && oldUser.id !== user?.id) {
              notifyUserEntered(oldUser);
            }

            const updatedUser = {
              ...oldUser,
              is_online: isOnline,
              is_active_now: isActiveNow,
              last_seen_at: newRow.last_seen_at,
              last_activity_at:
                newRow.last_activity_at ?? oldUser.last_activity_at,
            };

            // Sincroniza o ref de status para que um fetchUsers(true) posterior
            // nao dispare novamente o toast para uma transicao ja tratada pelo
            // Realtime (causa do "entrou no portal" duplicado).
            prevStatusRef.current[oldUser.id] = isOnline;

            const nextUsers = [...prev];
            nextUsers[userIndex] = updatedUser;

            // Re-ordenar (ativo agora primeiro, depois online recente)
            return nextUsers.sort((a, b) => {
              if (a.is_active_now !== b.is_active_now) {
                return a.is_active_now ? -1 : 1;
              }
              if (a.is_online !== b.is_online) {
                return a.is_online ? -1 : 1;
              }
              return a.nome.localeCompare(b.nome);
            });
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, fetchUsers, notifyUserEntered]);

  // O status offline e inferido pelo servidor quando last_seen_at ultrapassa o timeout configurado.
  // Nao e necessario enviar beacon ao sair

  return {
    users,
    onlineCount,
    activeNowCount,
    loading,
    error,
    refresh: fetchUsers,
    getTimeAgo: getTimeAgoLabel,
    getPresenceStatusLabel,
  };
}
