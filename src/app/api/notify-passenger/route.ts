import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppTemplate } from "@/lib/meta";
import { createClient as createSupabaseAuthClient } from "@/lib/supabase/server";
import { normalizeBrazilPhone } from "@/lib/phone";

export const runtime = "edge";

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
const getAdmin = () => {
  if (!_supabaseAdmin)
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  return _supabaseAdmin;
};

type OSPassengerConfirmationRow = {
  id: string;
  token: string;
};

type OSLinkShortcutRow = {
  slug: string;
};

type OSPublicRow = {
  id: string;
  motorista: string | null;
  veiculo_id: string | null;
  data: string | null;
  hora: string | null;
  protocolo: string | null;
  os_number: string | null;
};

type DriverCandidateRow = {
  name: string | null;
  phone: string | null;
};

export async function POST(request: Request) {
  try {
    const authClient = await createSupabaseAuthClient();
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = getAdmin() as any;

    const body = await request.json();
    console.log("[notify-passenger] body:", JSON.stringify(body));
    const {
      type,
      passengerPhone,
      passengerName,
      osId,
      passageiroId,
      acceptUrl,
    } = body;

    const results: { whatsapp?: boolean } = {};

    const normalizeName = (value: string): string =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    const escapeLikePattern = (value: string): string =>
      value.replace(/[\\%_]/g, "\\$&");

    let token: string | undefined;

    if (osId && passageiroId) {
      const { data: existing, error: existingError } = await (admin
        .from("os_passenger_confirmations")
        .select("id, token")
        .eq("os_id", osId)
        .eq("passageiro_id", passageiroId)
        .single() as Promise<{
        data: OSPassengerConfirmationRow | null;
        error: unknown | null;
      }>);

      console.log(
        "[notify-passenger] existing token lookup:",
        existing,
        existingError,
      );

      if (existing) {
        token = (existing as { id: string; token: string }).token;
      } else {
        const newToken = crypto.randomUUID(); // Usar UUID padrão
        const confirmationInsert: {
          os_id: string;
          passageiro_id: string;
          token: string;
        } = {
          os_id: osId,
          passageiro_id: passageiroId,
          token: newToken,
        };
        const { data: inserted, error: insertError } = await admin
          .from("os_passenger_confirmations")
          .insert(confirmationInsert)
          .select("token")
          .single();
        console.log(
          "[notify-passenger] inserted token:",
          inserted,
          insertError,
        );
        if (inserted) token = (inserted as { token: string }).token;
      }
    }

    let shortSlug = token;
    if (token) {
      try {
        const { data: existingShortcut } = await (admin
          .from("os_link_shortcuts")
          .select("slug")
          .eq("os_id", token)
          .eq("type", "passenger")
          .maybeSingle() as Promise<{ data: OSLinkShortcutRow | null }>);

        if (existingShortcut) {
          shortSlug = (existingShortcut as { slug: string }).slug;
        } else {
          const newSlug = Math.random().toString(36).slice(2, 17);
          const shortcutInsert: {
            os_id: string;
            slug: string;
            type: "passenger";
          } = {
            os_id: token,
            slug: newSlug,
            type: "passenger",
          };
          const { data: insertedShortcut } = await admin
            .from("os_link_shortcuts")
            .insert(shortcutInsert)
            .select("slug")
            .maybeSingle();

          if (insertedShortcut) {
            shortSlug = (insertedShortcut as { slug: string }).slug;
          }
        }
      } catch {
        shortSlug = token;
      }
    }

    const confirmationLink =
      shortSlug && acceptUrl ? `${acceptUrl}/${shortSlug}` : undefined;
    console.log("[notify-passenger] confirmationLink:", confirmationLink);

    let driverName = "Não informado";

    if (osId) {
      const { data: osData } = (await admin
        .from("ordens_servico")
        .select("id, motorista, veiculo_id, data, hora, protocolo, os_number")
        .eq("id", osId)
        .maybeSingle()) as { data: OSPublicRow | null };

      if (osData?.motorista) {
        driverName = osData.motorista;
        const motoristaNormalized = normalizeName(osData.motorista);

        const { data: driverCandidates } = await (admin
          .from("drivers")
          .select("name, phone")
          .ilike("name", `%${escapeLikePattern(osData.motorista.trim())}%`)
          .limit(10) as Promise<{ data: DriverCandidateRow[] | null }>);

        const matchedDriver =
          driverCandidates?.find(
            (candidate: DriverCandidateRow) =>
              normalizeName(candidate.name || "") === motoristaNormalized,
          ) ||
          driverCandidates?.find((candidate: DriverCandidateRow) =>
            normalizeName(candidate.name || "").includes(motoristaNormalized),
          );

        if (matchedDriver) {
          driverName = matchedDriver.name || driverName;
        }
      }
    }

    // WhatsApp temporariamente desativado - Meta API em configuração
    // if ((type === 'whatsapp' || type === 'both') && !confirmationLink) {
    //   return NextResponse.json(
    //     {
    //       success: false,
    //       error: 'Não foi possível gerar o link de confirmação do passageiro.',
    //       results,
    //       token,
    //     },
    //     { status: 400, headers: getRateLimitHeaders(request) }
    //   );
    // }

    // Envio de WhatsApp via Meta API usando template aprovado
    if (type !== "whatsapp" && type !== "both") {
      return NextResponse.json(
        {
          success: false,
          error: `Tipo de notificação "${type}" não suportado. Apenas WhatsApp está disponível.`,
          results,
          token,
        },
        { status: 400 },
      );
    }

    if ((type === "whatsapp" || type === "both") && passengerPhone) {
      const cleanPhone = normalizeBrazilPhone(passengerPhone);

      console.log(
        "[notify-passenger] sending WhatsApp template to",
        passengerPhone,
      );

      try {
        const templateComponents: Record<string, unknown>[] = [
          {
            type: "body",
            parameters: [{ type: "text", text: driverName }],
          },
        ];

        // Adiciona parâmetro do botão URL se tiver shortSlug
        if (shortSlug) {
          templateComponents.push({
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: shortSlug }],
          });
        }

        const templateResult = await sendWhatsAppTemplate(
          cleanPhone,
          "nova_viagem_passageiros",
          "pt_BR",
          templateComponents,
        );

        if (templateResult.success && templateResult.messageId) {
          results.whatsapp = true;

          // Persistir messageId para rastreamento de cliques no botão do template
          if (token) {
            await admin
              .from("os_passenger_confirmations")
              .update({ template_message_id: templateResult.messageId })
              .eq("token", token);
          }
        } else {
          const msg = templateResult.error || "Erro ao enviar template";
          console.error("❌ Erro Meta API template:", msg);
          results.whatsapp = false;
          return NextResponse.json(
            { success: false, error: msg, results, token },
            { status: 502 },
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("❌ Erro Meta API:", msg);
        results.whatsapp = false;
        return NextResponse.json(
          { success: false, error: msg, results, token },
          { status: 502 },
        );
      }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from("os_logs") as any).insert({
        os_id: osId,
        type: "passenger_notify",
        actor_name: "Sistema",
        description: `Notificação enviada para passageiro: ${passengerName || "N/A"} (${type})`,
        metadata: { passageiro_id: passageiroId, type },
      });
    } catch (logErr) {
      console.error("[notify-passenger] Erro ao registrar log:", logErr);
    }

    return NextResponse.json(
      { success: true, results, token },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("🔥 Erro Crítico notify-passenger:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
