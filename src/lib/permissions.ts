/**
 * Sistema centralizado de permissões (RBAC) do Portal Geolog.
 *
 * Matriz de acesso por categoria:
 *
 * | Página        | administrador | financeiro | operador |
 * |---------------|---------------|------------|----------|
 * | dashboard     | ✅            | ✅         | ✅       |
 * | os            | ✅            | ❌*        | ✅       |
 * | motoristas    | ✅            | ❌*        | ✅       |
 * | veiculos      | ✅            | ❌*        | ✅       |
 * | passageiros   | ✅            | ❌*        | ✅       |
 * | clientes      | ✅            | ❌*        | ✅       |
 * | parcerias     | ✅            | ❌*        | ✅       |
 * | financeiro    | ✅            | ✅         | ❌*      |
 * | caixa         | ✅            | ✅         | ❌*      |
 * | config        | ✅            | ❌         | ❌       |
 *
 * ❌* = pode ser liberado via specific_permissions.{modulo}.page_access === true
 *
 * Estrutura de specific_permissions (JSONB em user_roles):
 * {
 *   "financeiro": { "page_access": true },
 *   "cadastros":  { "page_access": true },
 *   "os":         { "page_access": true },
 *   "config":     { "page_access": true }
 * }
 */

export type Categoria = "administrador" | "financeiro" | "operador";

export type PageKey =
  | "dashboard"
  | "os"
  | "motoristas"
  | "veiculos"
  | "passageiros"
  | "clientes"
  | "parcerias"
  | "financeiro"
  | "caixa"
  | "config-acessos"
  | "config-perfil"
  | "config-financeiro"
  | "config-notificacoes";

interface ProfileLike {
  categoria: string;
  specific_permissions?: Record<string, unknown> | null;
}

/**
 * Acesso base por categoria (sem specific_permissions).
 */
const BASE_ACCESS: Record<Categoria, Partial<Record<PageKey, boolean>>> = {
  administrador: {
    dashboard: true,
    os: true,
    motoristas: true,
    veiculos: true,
    passageiros: true,
    clientes: true,
    parcerias: true,
    financeiro: true,
    caixa: true,
    "config-acessos": true,
    "config-perfil": true,
    "config-financeiro": true,
    "config-notificacoes": true,
  },
  financeiro: {
    dashboard: true,
    financeiro: true,
    caixa: true,
    "config-perfil": true,
    "config-financeiro": true,
    "config-notificacoes": true,
  },
  operador: {
    dashboard: true,
    os: true,
    motoristas: true,
    veiculos: true,
    passageiros: true,
    clientes: true,
    parcerias: true,
    "config-perfil": true,
    "config-notificacoes": true,
  },
};

/**
 * Mapeia PageKey → módulo em specific_permissions.
 * Se a página não tem override via specific_permissions, retorna null.
 */
const PAGE_TO_PERMISSION_MODULE: Partial<Record<PageKey, string>> = {
  financeiro: "financeiro",
  caixa: "financeiro", // caixa reutiliza o mesmo perfil do financeiro
  os: "os",
  motoristas: "cadastros",
  veiculos: "cadastros",
  passageiros: "cadastros",
  clientes: "cadastros",
  parcerias: "cadastros",
  "config-acessos": "config",
  "config-financeiro": "config",
};

/**
 * Verifica se o usuário tem acesso a uma página.
 *
 * Lógica:
 * 1. administrador → sempre true
 * 2. Se a categoria base permite → true
 * 3. Se há specific_permissions para o módulo correspondente → page_access === true
 * 4. Caso contrário → false
 */
export function hasPageAccess(
  profile: ProfileLike | null | undefined,
  page: PageKey,
): boolean {
  if (!profile) return false;

  const categoria = profile.categoria as Categoria;

  // Administradores têm acesso a tudo
  if (categoria === "administrador") return true;

  // Acesso base por categoria
  const baseAllowed = BASE_ACCESS[categoria]?.[page] === true;
  if (baseAllowed) return true;

  // Verificar specific_permissions
  const permModule = PAGE_TO_PERMISSION_MODULE[page];
  if (!permModule) return false;

  const specificPermissions = profile.specific_permissions ?? {};
  const modulePerms = specificPermissions[permModule] as
    | Record<string, unknown>
    | undefined;

  if (!modulePerms) return false;

  return modulePerms.page_access === true;
}

/**
 * Verifica se o usuário é administrador.
 */
export function isAdmin(profile: ProfileLike | null | undefined): boolean {
  return profile?.categoria === "administrador";
}

/**
 * Retorna a lista de páginas que o usuário pode acessar.
 * Útil para validar rotas dinamicamente.
 */
export function getAccessiblePages(
  profile: ProfileLike | null | undefined,
): PageKey[] {
  const allPages: PageKey[] = [
    "dashboard",
    "os",
    "motoristas",
    "veiculos",
    "passageiros",
    "clientes",
    "parcerias",
    "financeiro",
    "caixa",
    "config-acessos",
    "config-perfil",
    "config-financeiro",
    "config-notificacoes",
  ];
  return allPages.filter((page) => hasPageAccess(profile, page));
}

/**
 * Mapeia pathname → PageKey.
 * Retorna null se o pathname não corresponde a nenhuma página conhecida.
 */
export function pathnameToPageKey(pathname: string): PageKey | null {
  const map: Record<string, PageKey> = {
    "/portal/dashboard": "dashboard",
    "/portal/os": "os",
    "/portal/motoristas": "motoristas",
    "/portal/veiculos": "veiculos",
    "/portal/passageiros": "passageiros",
    "/portal/clientes": "clientes",
    "/portal/parcerias": "parcerias",
    "/portal/financeiro": "financeiro",
    "/portal/caixa": "caixa",
    "/portal/config": "config-perfil", // redirect target
    "/portal/config/acessos": "config-acessos",
    "/portal/config/perfil": "config-perfil",
    "/portal/config/financeiro": "config-financeiro",
    "/portal/config/notificacoes": "config-notificacoes",
  };
  return map[pathname] ?? null;
}
