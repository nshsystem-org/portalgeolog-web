import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tipos de evento auditáveis na lifecycle de um motorista.
 * Espelham o CHECK constraint da tabela public.driver_logs.
 */
export type DriverLogType =
  | "create"
  | "update"
  | "vehicle_link"
  | "vehicle_unlink"
  | "archive"
  | "restore"
  | "avatar_update";

export interface DriverLogActor {
  id: string;
  nome: string;
  avatar_url?: string | null;
}

export interface DriverLogEntry {
  id: string;
  driver_id: string;
  type: DriverLogType;
  actor_name: string;
  actor_id: string | null;
  actor_avatar_url: string | null;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface InsertPayload {
  driver_id: string;
  type: DriverLogType;
  actor_name: string;
  actor_id?: string | null;
  actor_avatar_url?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Insere um log de auditoria na tabela driver_logs.
 *
 * Falhas são silenciosas (apenas console.error) para nunca bloquear a
 * operação principal do motorista — o log é best-effort.
 */
export async function logDriverEvent(
  payload: InsertPayload,
  client?: SupabaseClient,
): Promise<void> {
  try {
    const supabase = client ?? createClient();
    const { error } = await supabase.from("driver_logs").insert({
      driver_id: payload.driver_id,
      type: payload.type,
      actor_name: payload.actor_name,
      actor_id: payload.actor_id ?? null,
      actor_avatar_url: payload.actor_avatar_url ?? null,
      description: payload.description,
      metadata: payload.metadata ?? {},
    });
    if (error) {
      console.error("[driver_logs] Erro ao inserir log:", error);
    }
  } catch (err) {
    console.error("[driver_logs] Exceção ao inserir log:", err);
  }
}

/**
 * Busca os logs de um motorista ordenados do mais recente para o mais antigo.
 */
export async function fetchDriverLogs(
  driverId: string,
  limit = 50,
  client?: SupabaseClient,
): Promise<DriverLogEntry[]> {
  const supabase = client ?? createClient();
  const { data, error } = await supabase
    .from("driver_logs")
    .select(
      "id, driver_id, type, actor_name, actor_id, actor_avatar_url, description, metadata, created_at",
    )
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[driver_logs] Erro ao buscar logs:", error);
    return [];
  }

  return (data ?? []) as unknown as DriverLogEntry[];
}

/**
 * Helper conveniente para construir o payload do ator a partir do perfil.
 */
export function buildActorFromProfile(
  profile: {
    id: string;
    nome: string;
    avatar_url?: string | null;
  } | null,
): {
  actor_name: string;
  actor_id: string | null;
  actor_avatar_url: string | null;
} {
  if (!profile) {
    return { actor_name: "Sistema", actor_id: null, actor_avatar_url: null };
  }
  return {
    actor_name: profile.nome,
    actor_id: profile.id,
    actor_avatar_url: profile.avatar_url ?? null,
  };
}
