import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AppDatabase } from "@/lib/supabase/app-database";

export const runtime = "edge";

// Cache do cliente admin
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
        setAll: () => {},
      },
    },
  );
}

export async function POST() {
  try {
    const authClient = await createAuthClient();

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const adminClient = getAdminClient();
    const now = new Date().toISOString();

    const { error } = await adminClient.from("user_presence").upsert(
      {
        user_id: user.id,
        status: "online",
        last_seen_at: now,
        last_activity_at: now,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      console.error("Erro ao atualizar presença:", error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
