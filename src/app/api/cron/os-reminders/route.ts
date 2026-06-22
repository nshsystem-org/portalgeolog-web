import { NextRequest, NextResponse } from "next/server";
import { getTodaysDelayedCycles, processOSReminders } from "@/lib/os-reminders";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const onlyToday = searchParams.get("today") !== "false";

    const results = await getTodaysDelayedCycles(onlyToday);
    return NextResponse.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[api/cron/os-reminders] Erro:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
    const results = await processOSReminders();
    return NextResponse.json({
      success: true,
      processed: results.length,
      sent: results.filter((r) => r.sent).length,
      results,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[api/cron/os-reminders] Erro:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
