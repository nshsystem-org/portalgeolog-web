import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AppDatabase } from "@/lib/supabase/app-database";

export const runtime = "edge";

// Cache do cliente admin em nível de módulo para reuso no Edge
let _adminClient: SupabaseClient<AppDatabase> | null = null;

function getAdminClient() {
  if (!_adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    _adminClient = createClient<AppDatabase>(url, key);
  }
  return _adminClient;
}

async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {}, // No-op em rotas API
      },
    },
  );
}

export async function GET() {
  try {
    const authClient = await createAuthClient();
    
    const { data: { user }, error: userError } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const adminClient = getAdminClient();

    // Uma única query com JOIN (embedded resource) para máxima performance
    const { data, error } = await adminClient
      .from("user_roles")
      .select("id, nome, tipo_usuario, categoria, avatar_url, user_presence(last_seen_at, status)")
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro ao buscar usuários e presença:", error);
      throw error;
    }

    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;

    interface UserRow {
      id: string;
      nome: string | null;
      tipo_usuario: string | null;
      categoria: string | null;
      avatar_url: string | null;
      user_presence: { last_seen_at: string; status: string } | { last_seen_at: string; status: string }[] | null;
    }

    const users = ((data as unknown) as UserRow[] ?? []).map((row) => {
      // user_presence retorna como objeto ou array dependendo da versão do postgrest, tratamos ambos
      const presence = Array.isArray(row.user_presence) ? row.user_presence[0] : row.user_presence;
      
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
