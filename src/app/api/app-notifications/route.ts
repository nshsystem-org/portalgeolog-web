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
    const adminClient = getAdminClient();

    // 1. Buscar o tipo_usuario do logado
    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("tipo_usuario")
      .eq("id", user.id)
      .single();

    const tipoUsuario = roleRow?.tipo_usuario ?? "interno";

    // 2. Buscar notificações e autores em uma única query (JOIN)
    // Nota: O join user_roles!created_by assume que existe uma FK ou que o nome da coluna é explícito
    // Como app_notifications(created_by) -> auth.users(id) e user_roles(id) -> auth.users(id),
    // o PostgREST pode precisar de ajuda se não houver FK direta entre app_notifications e user_roles.
    // Usaremos a abordagem otimizada de dois passos se o JOIN falhar ou for complexo, mas com cache.

    const { data: notifications, error: notifError } = await adminClient
      .from("app_notifications")
      .select("*")
      .in("target_audience", [tipoUsuario, "all"])
      .order("created_at", { ascending: false })
      .limit(30);

    if (notifError) throw notifError;

    const notifs = notifications ?? [];

    // 3. Buscar nomes e avatares atuais dos autores de forma eficiente
    const uniqueCreatorIds = Array.from(
      new Set(
        notifs.map((n) => n.created_by).filter((id): id is string => !!id),
      ),
    );

    const currentNames: Record<string, string> = {};
    const currentAvatars: Record<string, string | null> = {};

    if (uniqueCreatorIds.length > 0) {
      const { data: usersData } = await adminClient
        .from("user_roles")
        .select("id, nome, avatar_url")
        .in("id", uniqueCreatorIds);

      (usersData ?? []).forEach((u) => {
        if (u.id) {
          if (u.nome) currentNames[u.id] = u.nome;
          currentAvatars[u.id] = u.avatar_url ?? null;
        }
      });
    }

    const enriched = notifs.map((n) => ({
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

    const adminClient = getAdminClient();

    // Buscar nome e avatar do usuário se não estiver no metadata
    const userMetadata = user.user_metadata as
      | Record<string, unknown>
      | undefined;
    let authorName: string | null =
      (typeof userMetadata?.nome === "string" ? userMetadata.nome : null) ||
      (typeof userMetadata?.full_name === "string"
        ? userMetadata.full_name
        : null);
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
