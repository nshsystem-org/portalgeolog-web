import { NextResponse } from "next/server";
import {
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
  sendWhatsAppButtonMessage,
} from "@/lib/meta";
import { createClient as createSupabaseAuthClient } from "@/lib/supabase/server";

export const runtime = "edge";

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
    } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Parâmetro phone é obrigatório." },
        { status: 400 },
      );
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
