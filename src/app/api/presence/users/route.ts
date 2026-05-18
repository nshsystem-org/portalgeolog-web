import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "edge";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
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
        setAll() {
          // No-op em rotas API
        },
      },
    },
  );
}

export async function GET() {
  try {
    const authClient = await createAuthClient();
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Buscar user_roles e user_presence separadamente (mais confiável que relação aninhada)
    const [{ data: rolesData, error: rolesError }, { data: presenceData, error: presenceError }] =
      await Promise.all([
        adminClient
          .from("user_roles")
          .select("id, nome, tipo_usuario, categoria, avatar_url")
          .order("nome", { ascending: true }),
        adminClient
          .from("user_presence")
          .select("user_id, last_seen_at, status"),
      ]);

    if (rolesError) {
      console.error("Erro ao buscar user_roles:", rolesError);
      throw rolesError;
    }
    if (presenceError) {
      console.error("Erro ao buscar user_presence:", presenceError);
      throw presenceError;
    }

    const presenceMap = new Map<
      string,
      { last_seen_at: string; status: string }
    >();
    (presenceData ?? []).forEach((p: unknown) => {
      const row = p as { user_id: string; last_seen_at: string; status: string };
      presenceMap.set(row.user_id, {
        last_seen_at: row.last_seen_at,
        status: row.status,
      });
    });

    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;

    const users = (rolesData ?? []).map((u: unknown) => {
      const row = u as {
        id: string;
        nome: string;
        tipo_usuario: string;
        categoria: string;
        avatar_url: string | null;
      };

      const presence = presenceMap.get(row.id);
      const lastSeen = presence?.last_seen_at
        ? new Date(presence.last_seen_at).getTime()
        : 0;
      const isOnline =
        lastSeen > twoMinutesAgo && presence?.status === "online";

      return {
        id: row.id,
        nome: row.nome || "Desconhecido",
        tipo_usuario: row.tipo_usuario || "interno",
        categoria: row.categoria || "operador",
        avatar_url: row.avatar_url,
        is_online: isOnline,
        last_seen_at: presence?.last_seen_at ?? null,
      };
    });

    return NextResponse.json(users);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
