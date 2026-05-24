import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  PRESENCE_ACTIVE_NOW_TIMEOUT_MS,
  PRESENCE_ONLINE_TIMEOUT_MS,
} from "@/lib/presence";
import { toast } from "sonner";

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

export function useUserPresence() {
  const { user } = useAuth();
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const prevStatusRef = useRef<Record<string, boolean>>({});
  const lastHeartbeatSentAtRef = useRef(0);
  const knownIdsRef = useRef<Set<string>>(new Set());

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

        // Detectar transições offline -> online para notificar (apenas no fetch inicial)
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
              toast.success(`${u.nome} entrou no portal`, {
                icon: "🟢",
                duration: 4000,
              });
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
          err instanceof Error ? err.message : "Erro ao carregar presença";
        setError(message);
        console.error("useUserPresence fetch error:", message);
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [user?.id],
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
      return;
    }

    fetchUsers(true);

    // Heartbeat inicial para marcar a sessão como ativa sem esperar interação.
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

  // Realtime listener para mudanças de presença
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("user_presence_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        (payload) => {
          // Atualiza o estado local baseado na mudança recebida, evitando um novo fetch total
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
              toast.success(`${oldUser.nome} entrou no portal`, {
                icon: "🟢",
                duration: 4000,
              });
            }

            const updatedUser = {
              ...oldUser,
              is_online: isOnline,
              is_active_now: isActiveNow,
              last_seen_at: newRow.last_seen_at,
              last_activity_at:
                newRow.last_activity_at ?? oldUser.last_activity_at,
            };

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
  }, [user, supabase, fetchUsers]);

  // O status offline é inferido pelo servidor quando last_seen_at ultrapassa o timeout configurado.
  // Não é necessário enviar beacon ao sair

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
