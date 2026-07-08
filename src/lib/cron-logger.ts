/**
 * Logger server-side para crons — insere diretamente em frontend_error_logs
 * via Supabase admin client (service_role). Visível na página Admin > Logs.
 */

import { createClient } from "@supabase/supabase-js";

type CronLogLevel = "info" | "warning" | "error";

let _adminClient: ReturnType<typeof createClient> | null = null;

function getAdminClient(): ReturnType<typeof createClient> {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return _adminClient;
}

/**
 * Registra um log de cron em frontend_error_logs.
 * Non-blocking: não quebra o fluxo se falhar.
 */
export async function logCron(
  component: string,
  message: string,
  level: CronLogLevel = "info",
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = getAdminClient();
    const { error } = await supabase.from("frontend_error_logs").insert({
      error_level: level,
      component,
      error_message: message,
      error_details: details ?? null,
      url: null,
      user_agent: "cron-worker",
    });
    if (error) {
      console.error(`[cron-logger] Falha ao inserir log:`, error);
    }
  } catch (e) {
    console.error(`[cron-logger] Erro:`, e);
  }
}
