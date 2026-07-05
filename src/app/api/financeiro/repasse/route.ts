import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "edge";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function createAdminClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );
}

export async function POST(request: Request) {
  try {
    const authClient = await createAuthClient();
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = (await request.json()) as {
      osId?: string;
    };

    const osId = String(body.osId || "").trim();

    if (!osId) {
      return NextResponse.json(
        { error: "osId é obrigatório" },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();

    const { data: osRow, error: osError } = await adminClient
      .from("ordens_servico")
      .select("id, driver_id, tipo, repasse_pago")
      .eq("id", osId)
      .single();

    if (osError || !osRow) {
      return NextResponse.json(
        { error: "OS não encontrada." },
        { status: 404 },
      );
    }

    if (osRow.repasse_pago) {
      return NextResponse.json(
        { error: "O repasse desta OS já está registrado." },
        { status: 409 },
      );
    }

    const isFreelance = osRow.tipo === "freelance";
    let canMark = isFreelance;

    if (!isFreelance && osRow.driver_id) {
      const { data: driver } = await adminClient
        .from("drivers")
        .select("id, vinculo_tipo")
        .eq("id", osRow.driver_id)
        .single();
      canMark =
        driver?.vinculo_tipo === "autonomo" ||
        driver?.vinculo_tipo === "parceiro";
    }

    if (!canMark) {
      return NextResponse.json(
        { error: "Só é possível registrar repasse para autônomos, parceiros ou OS freelance." },
        { status: 409 },
      );
    }

    const { error: updateError } = await adminClient
      .from("ordens_servico")
      .update({ repasse_pago: true })
      .eq("id", osId);

    if (updateError) {
      throw updateError;
    }

    const { data: profile } = await adminClient
      .from("user_roles")
      .select("nome")
      .eq("id", user.id)
      .single();

    await adminClient.from("os_logs").insert({
      os_id: osId,
      type: "status_change",
      description: "Repasse ao motorista registrado como pago",
      actor_name: profile?.nome || user.email || "Sistema",
      actor_id: user.id,
      metadata: {
        repasse_pago: true,
      },
    });

    return NextResponse.json({
      success: true,
      repassePago: true,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
