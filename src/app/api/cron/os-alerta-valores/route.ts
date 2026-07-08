import { NextRequest, NextResponse } from "next/server";
import {
  getFinalizadasSemValor,
  sendAlertaValoresEmail,
} from "@/lib/os-alerta-valores";
import { logCron } from "@/lib/cron-logger";

export const runtime = "nodejs";

/**
 * GET — Preview (sem auth) das OS finalizadas sem valores.
 * Útil para teste rápido e diagnóstico.
 */
export async function GET() {
  try {
    const itens = await getFinalizadasSemValor();
    return NextResponse.json({
      success: true,
      total: itens.length,
      itens,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[api/cron/os-alerta-valores] GET Erro:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST — Envia o email consolidado de alerta.
 * Auth via CRON_SECRET (mesmo padrão do /api/cron/os-reminders).
 * Disparado pelo cron do Cloudflare Workers às 8h e 16h BRT.
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
    const resultado = await sendAlertaValoresEmail();

    await logCron(
      "cron/os-alerta-valores",
      `Email de alerta enviado — ${resultado.totalOS} OS sem valor, ${resultado.enviados} email(s) enviado(s)`,
      "info",
      { enviados: resultado.enviados, totalOS: resultado.totalOS },
    );

    return NextResponse.json({
      success: true,
      enviados: resultado.enviados,
      totalOS: resultado.totalOS,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[api/cron/os-alerta-valores] POST Erro:", error);

    await logCron(
      "cron/os-alerta-valores",
      `Erro ao enviar email de alerta: ${message}`,
      "error",
      { error: message },
    );

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
