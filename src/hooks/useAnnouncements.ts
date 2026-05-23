import { useState, useEffect, useCallback } from "react";
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

  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchActiveAnnouncements();
      setAnnouncements(data);
    } catch (error) {
      console.error("Erro ao carregar avisos:", error);
    } finally {
      setLoading(false);
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

  return { announcements, loading, refetch: loadAnnouncements };
}
