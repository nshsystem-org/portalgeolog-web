import { NextResponse } from "next/server";
import {
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
  sendWhatsAppButtonMessage,
} from "@/lib/meta";
import { createClient as createSupabaseAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
const getAdmin = () => {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
  }
  return _supabaseAdmin;
};

export async function POST(request: Request) {
  try {
    const authClient = await createSupabaseAuthClient();
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Não autenticado." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const {
      phone,
      message,
      useTemplate,
      templateName,
      templateVariables,
      language,
      buttonText,
      buttonUrl,
      components,
      os_id,
      cycle_index,
    } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Parâmetro phone é obrigatório." },
        { status: 400 },
      );
    }

    // Validação de estado do ciclo operacional para templates de início de rota.
    // Outros templates (ex: reset, remarcação) não são bloqueados aqui pois são
    // enviados intencionalmente para ciclos já em andamento.
    const INITIAL_ROUTE_TEMPLATES = [
      "appointment_scheduling",
      "inicio_viagem_motorista",
    ];
    if (
      os_id &&
      Number.isFinite(cycle_index) &&
      templateName &&
      INITIAL_ROUTE_TEMPLATES.includes(templateName)
    ) {
      const { data: cycleRow } = await getAdmin()
        .from("os_operational_cycles")
        .select("state, started_at")
        .eq("ordem_servico_id", os_id)
        .eq("itinerary_index", cycle_index)
        .maybeSingle() as unknown as {
        data: { state: string; started_at: string | null } | null;
      };

      if (
        cycleRow &&
        (cycleRow.state === "awaiting_finish" ||
          cycleRow.state === "completed" ||
          cycleRow.started_at)
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Este ciclo já está em andamento ou finalizado. Mensagem inicial não pode ser enviada.",
          },
          { status: 400 },
        );
      }
    }

    // Se usar template
    if (useTemplate && templateName) {
      // Se components foi fornecido (para flows), usa diretamente
      // Se não, converte templateVariables para formato da Meta API
      let templateComponents: Array<Record<string, unknown>> = [];

      if (components && Array.isArray(components)) {
        templateComponents = components;
      } else if (templateVariables && Array.isArray(templateVariables)) {
        // Todas as variáveis do body devem estar em um ÚNICO componente 'body'
        templateComponents = [
          {
            type: "body",
            parameters: templateVariables.map((text: string) => ({
              type: "text",
              text,
            })),
          },
        ];
      }

      const result = await sendWhatsAppTemplate(
        phone,
        templateName,
        language || "pt_BR",
        templateComponents,
      );

      if (result.success) {
        return NextResponse.json({
          success: true,
          messageId: result.messageId,
        });
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 },
        );
      }
    }

    // Se usar mensagem com botão
    if (buttonText && buttonUrl && message) {
      const result = await sendWhatsAppButtonMessage(
        phone,
        message,
        buttonText,
        buttonUrl,
      );

      if (result.success) {
        return NextResponse.json({
          success: true,
          messageId: result.messageId,
        });
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 },
        );
      }
    }

    // Se usar mensagem de texto simples
    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: "Parâmetro message é obrigatório quando não usa template.",
        },
        { status: 400 },
      );
    }

    const result = await sendWhatsAppMessage(phone, message);

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Erro ao enviar mensagem WhatsApp:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}
