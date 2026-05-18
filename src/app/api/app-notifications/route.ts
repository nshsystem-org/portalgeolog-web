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
          // No-op em rotas API; o middleware mantém a sessão atualizada
        },
      },
    },
  );
}

type CreateAppNotificationBody = {
  type?: "success" | "info" | "warning" | "error";
  title?: string;
  message?: string;
  targetAudience?: "interno" | "gestor" | "all";
  targetUserId?: string | null;
};

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

    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("tipo_usuario")
      .eq("id", user.id)
      .single();

    const tipoUsuario = roleRow?.tipo_usuario ?? "interno";

    const { data, error } = await adminClient
      .from("app_notifications")
      .select("*")
      .in("target_audience", [tipoUsuario, "all"])
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw error;

    const notifications = data ?? [];

    // Buscar nomes e avatares atuais dos autores para evitar dados desatualizados
    const uniqueCreatorIds = [
      ...new Set(
        notifications
          .map((n) => n.created_by)
          .filter((id): id is string => !!id),
      ),
    ];

    let currentNames: Record<string, string> = {};
    let currentAvatars: Record<string, string | null> = {};
    if (uniqueCreatorIds.length > 0) {
      const { data: usersData } = await adminClient
        .from("user_roles")
        .select("id, nome, avatar_url")
        .in("id", uniqueCreatorIds);

      currentNames = (usersData ?? []).reduce(
        (acc, u) => {
          if (u.id && u.nome) acc[u.id] = u.nome;
          return acc;
        },
        {} as Record<string, string>,
      );

      currentAvatars = (usersData ?? []).reduce(
        (acc, u) => {
          if (u.id) acc[u.id] = u.avatar_url ?? null;
          return acc;
        },
        {} as Record<string, string | null>,
      );
    }

    const enriched = notifications.map((n) => ({
      ...n,
      created_by_name:
        n.created_by && currentNames[n.created_by]
          ? currentNames[n.created_by]
          : n.created_by_name,
      created_by_avatar_url:
        n.created_by && currentAvatars[n.created_by] !== undefined
          ? currentAvatars[n.created_by]
          : n.created_by_avatar_url,
    }));

    return NextResponse.json(enriched);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

    const body = (await request.json()) as CreateAppNotificationBody;
    const type = body.type;
    const title = body.title?.trim();
    const message = body.message?.trim();
    const targetAudience = body.targetAudience ?? "all";
    const targetUserId = body.targetUserId ?? null;

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: "Campos obrigatórios faltando" },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();

    // Buscar nome e avatar do usuário se não estiver no metadata
    let authorName = user.user_metadata?.nome || user.user_metadata?.full_name;
    let authorAvatar: string | null = null;

    const { data: profile } = await adminClient
      .from("user_roles")
      .select("nome, avatar_url")
      .eq("id", user.id)
      .single();

    if (profile?.nome) authorName = profile.nome;
    if (profile?.avatar_url) authorAvatar = profile.avatar_url;

    if (!authorName) authorName = user.email?.split("@")[0] || "Sistema";

    const { error } = await adminClient.from("app_notifications").insert({
      type,
      title,
      message,
      target_audience: targetAudience,
      target_user_id: targetUserId,
      empresa_id: null,
      created_by: user.id,
      created_by_name: authorName,
      created_by_avatar_url: authorAvatar,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
