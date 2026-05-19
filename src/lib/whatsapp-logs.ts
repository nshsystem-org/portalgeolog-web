import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppDatabase } from "@/lib/supabase/app-database";

export interface WhatsAppLogRow {
  id: string;
  source: string;
  event_type: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface WhatsAppLogEntry {
  source: string;
  eventType: string;
  payload: Record<string, unknown>;
}

let _adminClient: SupabaseClient<AppDatabase> | null = null;

function getAdminClient(): SupabaseClient<AppDatabase> {
  if (!_adminClient) {
    _adminClient = createClient<AppDatabase>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  return _adminClient;
}

export async function recordWhatsAppLog(entry: WhatsAppLogEntry): Promise<void> {
  try {
    await getAdminClient().from("webhook_logs").insert({
      source: entry.source,
      event_type: entry.eventType,
      payload: entry.payload,
    });
  } catch (error) {
    console.error("[whatsapp-logs] Falha ao registrar log:", error);
  }
}

export async function fetchWhatsAppLogs(
  limit = 200,
): Promise<WhatsAppLogRow[]> {
  const { data, error } = await getAdminClient()
    .from("webhook_logs")
    .select("id, source, event_type, payload, created_at")
    .in("source", ["meta-webhook", "whatsapp"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    source: row.source,
    event_type: row.event_type,
    payload: (row.payload as Record<string, unknown>) || null,
    created_at: row.created_at,
  }));
}
