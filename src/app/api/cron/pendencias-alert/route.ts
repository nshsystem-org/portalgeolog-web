import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logCron } from "@/lib/cron-logger";

export const runtime = "nodejs";

/**
 * Cron a cada 2h — lê as contagens de system_pendencias (mantida por triggers
 * + pg_cron a cada 15 min) e insere uma notificação em app_notifications com
 * metadata.kind = "pendencia_alert".
 *
 * O frontend escuta app_notifications via realtime e, ao detectar esse
 * kind, abre um modal bloqueante (PendenciaAlertModal) em vez do toast
 * padrão.
 *
 * Deduplicação: se já existir uma notificação pendencia_alert nas últimas
 * 2h, não insere outra.
 *
 * Auth via CRON_SECRET (mesmo padrão dos outros crons).
 */

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

interface PendenciaCounts {
  semValor: number;
  atrasadas: number;
  docagens: number;
  total: number;
}

/**
 * Lê as contagens diretamente da tabela system_pendencias, que é mantida
 * em tempo real por triggers em ordens_servico/docagem_instancias e
 * reconciliada por pg_cron a cada 15 min.
 */
async function getPendenciaCounts(): Promise<PendenciaCounts> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("system_pendencias")
    .select("motivo");

  if (error) {
    console.error("[cron/pendencias-alert] getPendenciaCounts:", error);
    return { semValor: 0, atrasadas: 0, docagens: 0, total: 0 };
  }

  const rows = (data || []) as { motivo: string }[];
  const semValor = rows.filter((r) => r.motivo === "sem_valor").length;
  const atrasadas = rows.filter((r) => r.motivo === "atrasada").length;
  const docagens = rows.filter((r) => r.motivo === "docagem").length;
  // Rascunhos não entram no total do alerta (são pessoais)
  const total = semValor + atrasadas + docagens;

  return { semValor, atrasadas, docagens, total };
}

/**
 * Verifica se já existe notificação pendencia_alert nas últimas 2h.
 */
async function existsRecentAlert(): Promise<boolean> {
  const supabase = getAdminClient();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("app_notifications")
    .select("id")
    .eq("type", "warning")
    .contains("metadata", { kind: "pendencia_alert" })
    .gte("created_at", twoHoursAgo)
    .limit(1);
  if (error) {
    console.error(
      "[cron/pendencias-alert] existsRecentAlert:",
      error,
    );
    return false;
  }
  return (data?.length ?? 0) > 0;
}

async function processPendenciasAlert(): Promise<PendenciaCounts> {
  const supabase = getAdminClient();
  const counts = await getPendenciaCounts();

  await logCron(
    "cron/pendencias-alert",
    `Cron executado — ${counts.total} pendências (semValor=${counts.semValor}, atrasadas=${counts.atrasadas}, docagens=${counts.docagens})`,
    "info",
    { counts },
  );

  if (counts.total === 0) {
    await logCron(
      "cron/pendencias-alert",
      "Sem pendências — notificação não inserida",
      "info",
    );
    return counts;
  }

  // Deduplicação: não insere se já existe alerta nas últimas 2h
  const jaExiste = await existsRecentAlert();
  if (jaExiste) {
    await logCron(
      "cron/pendencias-alert",
      "Notificação bloqueada por deduplicação (já existe alerta nas últimas 2h)",
      "info",
      { counts },
    );
    return counts;
  }

  const message = `${counts.total} pendência${counts.total > 1 ? "s" : ""} no sistema aguardando resolução`;

  const { error: insertError } = await (
    supabase.from("app_notifications") as unknown as {
      insert: (values: Record<string, unknown>) => Promise<{
        error: unknown;
      }>;
    }
  ).insert({
      type: "warning",
      title: "Pendências do sistema",
      message,
      target_audience: "all",
      target_user_id: null,
      empresa_id: null,
      created_by: null,
      created_by_name: "Sistema",
      created_by_avatar_url: null,
      metadata: {
        kind: "pendencia_alert",
        counts,
      },
    });

  if (insertError) {
    console.error(
      "[cron/pendencias-alert] Erro ao inserir notificação:",
      insertError,
    );
    await logCron(
      "cron/pendencias-alert",
      "Erro ao inserir notificação pendencia_alert",
      "error",
      { error: String(insertError), counts },
    );
  } else {
    await logCron(
      "cron/pendencias-alert",
      `Notificação pendencia_alert inserida — ${counts.total} pendências`,
      "info",
      { counts },
    );
  }

  return counts;
}

/**
 * GET — Preview (sem auth) das contagens de pendências.
 */
export async function GET() {
  try {
    const counts = await processPendenciasAlert();
    return NextResponse.json({ success: true, counts });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[api/cron/pendencias-alert] GET Erro:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST — Disparado pelo cron do Cloudflare Workers a cada 2h.
 * Auth via CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const expected = `Bearer ${cronSecret}`;
    if (!authHeader || authHeader !== expected) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  try {
    const counts = await processPendenciasAlert();
    return NextResponse.json({ success: true, counts });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[api/cron/pendencias-alert] POST Erro:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
