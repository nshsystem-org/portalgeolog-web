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
      observacao?: string;
    };

    const osId = String(body.osId || "").trim();
    const observacao = String(body.observacao || "").trim() || null;

    if (!osId) {
      return NextResponse.json(
        { error: "osId é obrigatório" },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    const { data: osRow, error: osError } = await adminClient
      .from("ordens_servico")
      .select("id, status_financeiro")
      .eq("id", osId)
      .single();

    if (osError || !osRow) {
      return NextResponse.json(
        { error: "OS não encontrada." },
        { status: 404 },
      );
    }

    const currentStatus = osRow.status_financeiro || "Pendente";
    if (currentStatus !== "Faturado") {
      return NextResponse.json(
        { error: "A baixa só pode ser dada após o faturamento." },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from("ordens_servico")
      .update({
        status_financeiro: "Recebido",
        financeiro_recebido_em: now,
      })
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
      description: "OS marcada como recebida financeiramente",
      actor_name: profile?.nome || user.email || "Sistema",
      actor_id: user.id,
      metadata: {
        observacao,
        status_financeiro: "Recebido",
      },
    });

    return NextResponse.json({
      success: true,
      statusFinanceiro: "Recebido",
      financeiroRecebidoEm: now,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
