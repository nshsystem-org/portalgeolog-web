import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Helpers de autorização server-side (RBAC) do Portal Geolog.
 *
 * Diferente de `@/lib/permissions.ts` (que contém apenas lógica pura, segura
 * para uso em componentes client), este arquivo busca o perfil do usuário
 * diretamente no Supabase usando a service role key. Deve ser importado
 * SOMENTE por API routes / código server-only — nunca por componentes com
 * "use client".
 *
 * Todas as funções incluem o check de `is_active`, então um usuário
 * desativado perde acesso a todas as rotas que usam esses helpers, mesmo que
 * sua sessão Supabase ainda seja válida.
 */

type ServerProfileRow = {
  categoria: string | null;
  specific_permissions: Record<string, unknown> | null;
  is_active: boolean | null;
};

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  return url;
}

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  return key;
}

/**
 * Busca o perfil server-side de um usuário (categoria, specific_permissions,
 * is_active). Retorna null se o usuário não tiver perfil.
 */
export async function getServerProfile(
  userId: string,
): Promise<ServerProfileRow | null> {
  const admin = createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin
    .from("user_roles")
    .select("categoria, specific_permissions, is_active")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return data as ServerProfileRow;
}

/**
 * Verifica se o usuário tem acesso a um módulo específico (server-side).
 * Inclui check de `is_active`: usuários desativados sempre retornam false.
 *
 * @param userId - ID do usuário no Supabase Auth
 * @param module - Nome do módulo em specific_permissions ("financeiro", "os", "cadastros", "config")
 * @param baseCategorias - Categorias que têm acesso base ao módulo (ex: ["administrador", "financeiro"])
 */
export async function hasModuleAccess(
  userId: string,
  module: string,
  baseCategorias: string[],
): Promise<boolean> {
  const profile = await getServerProfile(userId);
  if (!profile) return false;
  if (profile.is_active === false) return false;
  if (profile.categoria === "administrador") return true;
  if (profile.categoria && baseCategorias.includes(profile.categoria)) {
    return true;
  }
  const modulePerms = profile.specific_permissions?.[module] as
    | Record<string, unknown>
    | undefined;
  return modulePerms?.page_access === true;
}

export type PageAction = "view" | "create" | "delete" | "sensitive";

export type FinanceiroPageKey =
  | "financeiro"
  | "caixa"
  | "fornecedores"
  | "categorias-caixa"
  | "formas-pagamento";

/**
 * Verifica se o usuário tem acesso a uma página/ação específica do módulo financeiro (server-side).
 *
 * Lógica:
 * 1. Desativado -> false
 * 2. Administrador / Diretoria / Financeiro -> true para todas as ações
 * 3. specific_permissions.financeiro.pages[page][action] -> granular (se definido)
 * 4. specific_permissions.financeiro.page_access -> legacy (concede tudo se true)
 * 5. Caso contrário -> false
 */
export async function hasFinancePageAccess(
  userId: string,
  page: FinanceiroPageKey = "financeiro",
  action: PageAction = "view",
): Promise<boolean> {
  const profile = await getServerProfile(userId);
  if (!profile) return false;
  if (profile.is_active === false) return false;
  if (profile.categoria === "administrador") return true;
  if (profile.categoria === "financeiro" || profile.categoria === "diretoria") {
    return true;
  }

  const finPerms = profile.specific_permissions?.financeiro as
    | Record<string, unknown>
    | undefined;
  if (!finPerms) return false;

  const pages = finPerms["pages"] as
    | Record<string, Partial<Record<PageAction, boolean>>>
    | undefined;
  if (pages && pages[page]) {
    return pages[page][action] === true;
  }

  // Legacy: page_access concede tudo do módulo
  return finPerms.page_access === true;
}

/**
 * Verifica se o usuário tem acesso ao módulo financeiro (server-side).
 * Suporta checagem de ação específica (padrão: "view").
 */
export async function hasFinanceAccess(
  userId: string,
  action: PageAction = "view",
): Promise<boolean> {
  return hasFinancePageAccess(userId, "financeiro", action);
}

/**
 * Verifica se o usuário tem acesso ao módulo de caixa (server-side).
 * Suporta checagem de ação específica (padrão: "view").
 */
export async function hasCaixaAccess(
  userId: string,
  action: PageAction = "view",
): Promise<boolean> {
  return hasFinancePageAccess(userId, "caixa", action);
}

/**
 * Verifica se o usuário tem acesso ao módulo de OS (server-side).
 */
export async function hasOSAccess(userId: string): Promise<boolean> {
  return hasModuleAccess(userId, "os", ["operador", "diretoria"]);
}

/**
 * Verifica se o usuário tem acesso ao módulo de cadastros (server-side).
 * Clientes, motoristas, veículos, passageiros, parcerias, fornecedores.
 */
export async function hasCadastrosAccess(userId: string): Promise<boolean> {
  return hasModuleAccess(userId, "cadastros", ["operador", "diretoria"]);
}

/**
 * Verifica se o usuário é administrador ativo (server-side).
 * Usuários desativados sempre retornam false.
 */
export async function isServerAdmin(userId: string): Promise<boolean> {
  const profile = await getServerProfile(userId);
  if (!profile) return false;
  if (profile.is_active === false) return false;
  return profile.categoria === "administrador";
}

/**
 * Verifica se o usuário é da diretoria ativo (server-side).
 * Usuários desativados sempre retornam false.
 */
export async function isServerDiretoria(userId: string): Promise<boolean> {
  const profile = await getServerProfile(userId);
  if (!profile) return false;
  if (profile.is_active === false) return false;
  return profile.categoria === "diretoria";
}

/**
 * Verifica se o usuário pode acessar a gestão de usuários
 * (admin OU diretoria). Ambos têm acesso à página de acessos,
 * mas com escopos diferentes:
 * - admin: vê e edita todos os usuários
 * - diretoria: vê e edita todos exceto administradores
 */
export async function hasUserManagementAccess(
  userId: string,
): Promise<boolean> {
  const admin = await isServerAdmin(userId);
  if (admin) return true;
  return isServerDiretoria(userId);
}
