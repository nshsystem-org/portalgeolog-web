import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildOperationalCyclesFromWaypoints,
  findOperationalCycleByIndex,
  type OperationalCycle,
} from "@/lib/os-messages";

type OperationalCycleRow = {
  id: string;
  ordem_servico_id: string;
  itinerary_index: number;
  sequence_order: number;
  kind: "itinerary" | "return";
  ordinal: number;
  title: string;
  state: OperationalCycle["state"];
  message_sent_at: string | null;
  message_sent_by_id: string | null;
  accepted_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  km_initial: number | null;
  km_final: number | null;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
};

const OPERATIONAL_CYCLE_COLUMNS = [
  "id",
  "ordem_servico_id",
  "itinerary_index",
  "sequence_order",
  "kind",
  "ordinal",
  "title",
  "state",
  "message_sent_at",
  "message_sent_by_id",
  "accepted_at",
  "started_at",
  "finished_at",
  "km_initial",
  "km_final",
].join(", ");

const mapRowToOperationalCycle = (
  row: OperationalCycleRow,
): OperationalCycle => ({
  itineraryIndex: row.itinerary_index,
  sequenceOrder: row.sequence_order,
  kind: row.kind,
  ordinal: row.ordinal,
  title: row.title,
  state: row.state,
  messageSentAt: row.message_sent_at,
  messageSentById: row.message_sent_by_id,
  acceptedAt: row.accepted_at,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  kmInitial: row.km_initial,
  kmFinal: row.km_final,
});

const isMissingOperationalCyclesTableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const typedError = error as SupabaseLikeError;
  const messageMatches =
    typeof typedError.message === "string" &&
    typedError.message.includes("os_operational_cycles");

  return (
    typedError.code === "PGRST205" ||
    typedError.message ===
      "Could not find the table 'public.os_operational_cycles' in the schema cache" ||
    messageMatches
  );
};

export const getFirstActiveOperationalCycle = (
  cycles: OperationalCycle[],
): OperationalCycle | undefined =>
  cycles.find(
    (cycle) => cycle.state !== "completed" && cycle.state !== "cancelled",
  );

export const resolveOperationalCycleFromList = (
  cycles: OperationalCycle[],
  requestedCycleIndex: number | null,
): OperationalCycle | undefined => {
  if (requestedCycleIndex !== null) {
    return findOperationalCycleByIndex(cycles, requestedCycleIndex);
  }

  return getFirstActiveOperationalCycle(cycles) || cycles[0];
};

export async function loadOperationalCycleContextForOS(
  client: SupabaseClient,
  osId: string,
  requestedCycleIndex: number | null,
): Promise<{
  cycles: OperationalCycle[];
  cycle: OperationalCycle | undefined;
}> {
  const cycles = await fetchOperationalCyclesForOS(client, osId);
  const cycle = resolveOperationalCycleFromList(cycles, requestedCycleIndex);

  return { cycles, cycle };
}

export async function fetchOperationalCyclesForOS(
  client: SupabaseClient,
  osId: string,
): Promise<OperationalCycle[]> {
  const { data, error } = await client
    .from("os_operational_cycles")
    .select(OPERATIONAL_CYCLE_COLUMNS)
    .eq("ordem_servico_id", osId)
    .order("sequence_order");

  if (error) {
    if (isMissingOperationalCyclesTableError(error)) {
      return [];
    }
    throw error;
  }

  const rows = (data || []) as unknown as OperationalCycleRow[];

  // Se a tabela tem ciclos, retornar normalmente
  if (rows.length > 0) {
    return rows.map(mapRowToOperationalCycle);
  }

  // Fallback: reconstruir ciclos a partir dos waypoints para OS antigas
  // que ainda nao foram migradas para a tabela nova
  const { data: wpData } = await client
    .from("os_waypoints")
    .select("itinerary_index, position")
    .eq("ordem_servico_id", osId)
    .order("position");

  const waypoints = (wpData || []) as Array<{
    itinerary_index: number | null;
    position: number | null;
  }>;

  if (waypoints.length === 0) {
    return [];
  }

  const builtCycles = buildOperationalCyclesFromWaypoints(
    waypoints.map((w) => ({
      itineraryIndex: w.itinerary_index,
      position: w.position,
    })),
  );

  // Persistir os ciclos reconstruidos para que a proxima consulta
  // ja encontre na tabela e evite ficar recriando
  try {
    await replaceOperationalCyclesForOS(client, osId, builtCycles);
  } catch (persistErr) {
    console.warn(
      "[fetchOperationalCyclesForOS] Falha ao persistir ciclos reconstruidos:",
      persistErr,
    );
  }

  return builtCycles;
}

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

export async function fetchOperationalCyclesForOSIds(
  client: SupabaseClient,
  osIds: string[],
): Promise<Record<string, OperationalCycle[]>> {
  if (osIds.length === 0) return {};

  // Chunk em grupos de 50 para evitar URL muito longa (limite do PostgREST)
  const chunks = chunkArray(osIds, 50);
  const grouped: Record<string, OperationalCycle[]> = {};

  for (const chunk of chunks) {
    const { data, error } = await client
      .from("os_operational_cycles")
      .select(OPERATIONAL_CYCLE_COLUMNS)
      .in("ordem_servico_id", chunk)
      .order("sequence_order");

    if (error) {
      if (isMissingOperationalCyclesTableError(error)) {
        continue;
      }
      throw error;
    }

    const rows = (data || []) as unknown as OperationalCycleRow[];
    for (const row of rows) {
      if (!grouped[row.ordem_servico_id]) {
        grouped[row.ordem_servico_id] = [];
      }
      grouped[row.ordem_servico_id].push(mapRowToOperationalCycle(row));
    }
  }

  return grouped;
}

export async function replaceOperationalCyclesForOS(
  client: SupabaseClient,
  osId: string,
  cycles: OperationalCycle[],
): Promise<void> {
  const { error } = await client.rpc("replace_os_operational_cycles", {
    p_os_id: osId,
    p_cycles: cycles,
  });

  if (!error) return;

  throw error;
}
