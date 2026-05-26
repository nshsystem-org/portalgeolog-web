import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchActiveAnnouncements } from "@/lib/supabase/queries";

export interface Announcement {
  id: string;
  title: string;
  subtitle: string | null;
  message: string;
  type: "info" | "warning" | "error" | "success";
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const dismissedIdsRef = useRef<Set<string>>(new Set());

  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        const data = await fetchActiveAnnouncements();
        setAnnouncements(data);
        return;
      }

      // Buscar anúncios ativos
      const announcements = await fetchActiveAnnouncements();

      // Buscar anúncios já dispensados pelo usuário
      const { data: dismissed } = await supabase
        .from("announcement_dismissals")
        .select("announcement_id, dismissed_at")
        .eq("user_id", user.id);

      const dismissedRows = (dismissed ?? []) as Array<{
        announcement_id: string;
        dismissed_at: string;
      }>;
      const dismissedMap = new Map(
        dismissedRows.map((item) => [item.announcement_id, item.dismissed_at]),
      );
      dismissedIdsRef.current = new Set(dismissedMap.keys());

      // Exibir novamente se o aviso foi atualizado depois do último dismiss
      const filtered = announcements.filter((announcement) => {
        const dismissedAt = dismissedMap.get(announcement.id);
        if (!dismissedAt) return true;

        return (
          new Date(dismissedAt).getTime() <
          new Date(announcement.updated_at).getTime()
        );
      });
      setAnnouncements(filtered);
    } catch (error) {
      console.error("Erro ao carregar avisos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const dismissAnnouncement = useCallback(async (announcementId: string) => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      await supabase
        .from("announcement_dismissals")
        .delete()
        .eq("user_id", user.id)
        .eq("announcement_id", announcementId);

      await supabase.from("announcement_dismissals").insert({
        user_id: user.id,
        announcement_id: announcementId,
      });

      // Atualizar estado local
      dismissedIdsRef.current.add(announcementId);
      setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
    } catch (error) {
      console.error("Erro ao dispensar aviso:", error);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();

    // Setup realtime subscription
    const supabase = createClient();
    const channel = supabase
      .channel("system_announcements_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "system_announcements",
        },
        () => {
          // Reload announcements on any change
          loadAnnouncements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAnnouncements]);

  return { announcements, loading, refetch: loadAnnouncements, dismissAnnouncement };
}
