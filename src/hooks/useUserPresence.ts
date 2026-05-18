import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export interface PresenceUser {
  id: string;
  nome: string;
  tipo_usuario: string;
  categoria: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen_at: string | null;
}

const HEARTBEAT_INTERVAL_MS = 60000;

function getTimeAgoLabel(dateStr: string | null): string {
  if (!dateStr) return "Nunca ativo";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "Agora mesmo";
  if (diff < 3600000) return `Há ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Há ${Math.floor(diff / 3600000)} h`;
  return `Há ${Math.floor(diff / 86400000)} dias`;
}

export function useUserPresence() {
  const { user } = useAuth();
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const prevStatusRef = useRef<Record<string, boolean>>({});
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const onlineCount = users.filter((u) => u.is_online).length;

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/presence/users");
      if (!res.ok) {
        const text = await res.text().catch(() => "Erro desconhecido");
        throw new Error(text);
      }
      const data = (await res.json()) as PresenceUser[];
      console.log("[Presence] Users fetched:", data.length, "online:", data.filter(u => u.is_online).length);

      // Detectar transições offline -> online para notificar
      const prevStatus = prevStatusRef.current;
      data.forEach((u) => {
        const wasOnline = prevStatus[u.id];
        if (!wasOnline && u.is_online && knownIdsRef.current.has(u.id) && u.id !== user?.id) {
          toast.success(`${u.nome} entrou no portal`, {
            icon: "🟢",
            duration: 4000,
          });
        }
      });

      // Atualizar estado conhecido
      prevStatusRef.current = data.reduce(
        (acc, u) => {
          acc[u.id] = u.is_online;
          return acc;
        },
        {} as Record<string, boolean>,
      );
      data.forEach((u) => knownIdsRef.current.add(u.id));

      // Online primeiro, depois por nome
      const sorted = data.sort((a, b) => {
        if (a.is_online === b.is_online) {
          return a.nome.localeCompare(b.nome);
        }
        return a.is_online ? -1 : 1;
      });

      setUsers(sorted);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao carregar presença";
      setError(message);
      console.error("useUserPresence fetch error:", message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const sendHeartbeat = useCallback(async () => {
    if (!user) {
      console.log("[Presence] Heartbeat skipped: no user");
      return;
    }
    try {
      const res = await fetch("/api/presence/heartbeat", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        console.log("[Presence] Heartbeat OK", user.id);
      } else {
        const text = await res.text().catch(() => "unknown");
        console.error("[Presence] Heartbeat failed:", res.status, text);
      }
    } catch (err) {
      console.error("[Presence] Heartbeat error:", err);
    }
  }, [user]);

  // Carregar inicial e heartbeat
  useEffect(() => {
    if (!user) {
      setUsers([]);
      setLoading(false);
      return;
    }

    fetchUsers();

    // Heartbeat inicial
    sendHeartbeat();

    // Heartbeat periódico
    heartbeatTimerRef.current = setInterval(() => {
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
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
        () => {
          // Recarrega a lista para manter consistência
          fetchUsers();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, fetchUsers]);

  // O status offline é inferido pelo servidor quando last_seen_at > 2 min
  // Não é necessário enviar beacon ao sair

  return {
    users,
    onlineCount,
    loading,
    error,
    refresh: fetchUsers,
    getTimeAgo: getTimeAgoLabel,
  };
}
