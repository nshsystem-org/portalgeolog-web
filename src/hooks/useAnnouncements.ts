import { useState, useEffect, useCallback } from "react";
import React from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchActiveAnnouncements } from "@/lib/supabase/queries";

export interface Announcement {
  id: string;
  title: string;
  subtitle: string | null;
  message: string;
  type: "info" | "warning" | "error" | "success";
  created_at: string;
  expires_at: string | null;
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const dismissedIdsRef = React.useRef<Set<string>>(new Set());

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
        .select("announcement_id")
        .eq("user_id", user.id);

      const dismissedSet = new Set(dismissed?.map(d => d.announcement_id) || []);
      dismissedIdsRef.current = dismissedSet;

      // Filtrar anúncios que não foram dispensados
      const filtered = announcements.filter(a => !dismissedSet.has(a.id));
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
        .insert({ user_id: user.id, announcement_id: announcementId });

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
