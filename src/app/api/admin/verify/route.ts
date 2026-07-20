import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_TOKEN_COOKIE,
  ADMIN_TOKEN_TTL_SECONDS,
  signAdminToken,
} from "@/lib/admin-jwt";

// Edge Runtime — Cloudflare Workers
export const runtime = "edge";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

/**
 * Cria um client Supabase efêmero (sem persistir sessão) apenas para
 * verificar a senha sem sobrescrever a sessão atual do usuário.
 */
function createEphemeralAuthClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function createServiceRoleClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

interface VerifyBody {
  password?: string;
}

/**
 * POST /api/admin/verify
 *
 * Re-autentica um usuário já loggado para acessar /admin.
 * Fluxo:
 *   1. Lê sessão Supabase atual (cookie) — deve haver usuário.
 *   2. Recebe senha no body e re-valida via signInWithPassword em client
 *      efêmero (não afeta a sessão atual).
 *   3. Confirma via service role que user_roles.categoria === 'administrador'.
 *   4. Emite JWT HMAC-SHA256 de curta duração (15min) vinculado ao user_id
 *      e armazena em cookie httpOnly/secure/sameSite=strict.
 */
export async function POST(request: Request) {
  let body: VerifyBody;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return NextResponse.json(
      { error: "Payload inválido." },
      { status: 400 },
    );
  }

  const password = body.password?.trim();
  if (!password) {
    return NextResponse.json(
      { error: "Senha é obrigatória." },
      { status: 400 },
    );
  }

  // 1. Sessão atual (via cookies) — usa client SSR que lê request cookies.
  const cookieStore = await cookies();
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const { createServerClient } = await import("@supabase/ssr");
  const supabaseSession = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        /* read-only neste contexto */
      },
    },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabaseSession.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json(
      { error: "Sessão expirada. Faça login novamente." },
      { status: 401 },
    );
  }

  // 2. Re-valida senha sem persistir nova sessão.
  const ephemeral = createEphemeralAuthClient();
  const { data: signInData, error: signInErr } =
    await ephemeral.auth.signInWithPassword({
      email: user.email ?? "",
      password,
    });

  if (signInErr || !signInData.user) {
    return NextResponse.json(
      { error: "Senha incorreta." },
      { status: 403 },
    );
  }

  // 3. Confirma role administrador (service role bypassa RLS).
  const admin = createServiceRoleClient();
  const { data: roleRow, error: roleErr } = await admin
    .from("user_roles")
    .select("categoria")
    .eq("id", user.id)
    .single();

  if (roleErr || !roleRow || roleRow.categoria !== "administrador") {
    return NextResponse.json(
      { error: "Acesso negado. Acesso restrito a administradores." },
      { status: 403 },
    );
  }

  // 4. Emite JWT de curta duração.
  const token = await signAdminToken({
    userId: user.id,
    role: roleRow.categoria,
  });

  const res = NextResponse.json({
    ok: true,
    expires_in: ADMIN_TOKEN_TTL_SECONDS,
  });
  res.cookies.set(ADMIN_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_TOKEN_TTL_SECONDS,
  });
  return res;
}

/**
 * DELETE /api/admin/verify
 * Revoga o token de admin imediatamente (logout do modo admin).
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_TOKEN_COOKIE);
  return res;
}
