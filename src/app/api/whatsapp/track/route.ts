import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * API route para rastrear message_ids enviados pela Meta.
 *
 * Recebe POST com:
 *   {
 *     osId: string,
 *     messageId: string,
 *     phone: string,
 *     motorista: string,
 *     cycleIndex: number
 *   }
 *
 * Usa SUPABASE_SERVICE_ROLE_KEY para bypassar o RLS da tabela
 * whatsapp_message_tracking (o client do navegador era bloqueado
 * pela policy service_role_only, entao o webhook nao conseguia
 * correlacionar delivery/read updates da Meta).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { osId, messageId, phone, motorista, cycleIndex } = body as {
      osId?: string;
      messageId?: string;
      phone?: string;
      motorista?: string;
      cycleIndex?: number;
    };

    if (!osId || !messageId || !phone) {
      return NextResponse.json(
        { error: "osId, messageId e phone sao obrigatorios" },
        { status: 400 },
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { error } = await (
      supabase.from("whatsapp_message_tracking") as unknown as {
        insert: (
          values: Record<string, unknown>,
        ) => Promise<{ error: unknown }>;
      }
    ).insert({
      os_id: osId,
      message_id: messageId,
      phone,
      motorista: motorista || "Motorista",
      cycle_index: cycleIndex ?? 0,
      status: "sent",
    });

    if (error) {
      console.error("[api/whatsapp/track] Erro ao inserir tracking:", error);
      return NextResponse.json(
        { error: "Falha ao rastrear mensagem" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[api/whatsapp/track] Erro:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
