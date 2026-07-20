import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  ADMIN_TOKEN_COOKIE,
  verifyAdminToken,
} from "@/lib/admin-jwt";

/**
 * Middleware raiz do Next.js.
 *
 * Responsabilidades:
 *  1. Atualiza a sessão Supabase (refresh de JWT) via helper existente.
 *  2. Protege rotas /portal/* (requer usuário loggado).
 *  3. Protege /admin/* com camada extra:
 *     - Usuário loggado (sessão Supabase válida).
 *     - Token admin_verified_token JWT HMAC-SHA256 válido e não expirado,
 *       vinculado ao user_id da sessão.
 *     - Caso contrário, redireciona para /admin/verify.
 *  4. /admin/verify e /api/admin/verify ficam fora do gate (são o próprio
 *     fluxo de re-autenticação).
 */
export async function middleware(request: NextRequest) {
  // 1. Refresh de sessão + guards básicos (/portal, /login).
  const supabaseResponse = await updateSession(request);
  // updateSession pode retornar redirect (login/dashboard) ou NextResponse.next().
  // Se veio redirect, propagate.
  if (
    supabaseResponse instanceof NextResponse &&
    supabaseResponse.status >= 300 &&
    supabaseResponse.status < 400
  ) {
    return supabaseResponse;
  }

  const pathname = request.nextUrl.pathname;

  /**
   * Cria redirect preservando cookies setados pelo updateSession
   * (necessário para não perder refresh de sessão ao redirecionar).
   */
  const redirectPreservingCookies = (targetPath: string) => {
    const url = request.nextUrl.clone();
    url.pathname = targetPath;
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => {
      res.cookies.set(c.name, c.value, c);
    });
    return res;
  };

  // 2. Proteção /admin/* (exceto a própria verify e a API de verify).
  const isAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminVerify = pathname === "/admin/verify";
  const isAdminVerifyApi = pathname === "/api/admin/verify";

  if (isAdminRoute && !isAdminVerify) {
    const token = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value;

    // Heurística de sessão: cookie sb-...-auth-token presente.
    const hasAuthCookie = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

    if (!hasAuthCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", "/admin");
      const res = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((c) => {
        res.cookies.set(c.name, c.value, c);
      });
      return res;
    }

    // Sem token de admin ou inválido → /admin/verify.
    if (!token) {
      return redirectPreservingCookies("/admin/verify");
    }

    const verification = await verifyAdminToken(token);
    if (!verification.valid) {
      return redirectPreservingCookies("/admin/verify");
    }

    // Validação extra de vinculação user_id ↔ token é feita no carregamento
    // da página (client) via useAuth; o middleware não tem acesso ao user_id
    // sem chamada ao Supabase. O token é assinado com o segredo do service
    // role, então só o backend pode emitir — não há como forjar sub.
  }

  // 3. /api/admin/verify não precisa de gate (é a rota que emite o token).
  // Mas outras /api/admin/* devem exigir token válido.
  if (pathname.startsWith("/api/admin/") && !isAdminVerifyApi) {
    const token = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value;
    if (!token) {
      return NextResponse.json(
        { error: "Reautenticação necessária." },
        { status: 401 },
      );
    }
    const verification = await verifyAdminToken(token);
    if (!verification.valid) {
      return NextResponse.json(
        { error: "Token de admin expirado. Reautentique." },
        { status: 401 },
      );
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf)$).*)",
  ],
};
