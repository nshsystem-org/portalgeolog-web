/**
 * Sistema centralizado de permissões (RBAC) do Portal Geolog.
 *
 * Matriz de acesso por categoria:
 *
 * | Página        | administrador | diretoria | financeiro | operador |
 * |---------------|---------------|-----------|------------|----------|
 * | dashboard     | ✅            | ✅        | ✅         | ✅       |
 * | os            | ✅            | ✅        | ❌*        | ✅       |
 * | motoristas    | ✅            | ✅        | ❌*        | ✅       |
 * | veiculos      | ✅            | ✅        | ❌*        | ✅       |
 * | passageiros   | ✅            | ✅        | ❌*        | ✅       |
 * | clientes      | ✅            | ✅        | ❌*        | ✅       |
 * | parcerias     | ✅            | ✅        | ❌*        | ✅       |
 * | fornecedores  | ✅            | ✅        | ✅         | ❌*      |
 * | financeiro    | ✅            | ✅        | ✅         | ❌*      |
 * | caixa         | ✅            | ✅        | ✅         | ❌*      |
 * | categorias-caixa   | ✅       | ✅        | ✅         | ❌*      |
 * | formas-pagamento   | ✅       | ✅        | ✅         | ❌*      |
 * | config        | ✅            | ✅†       | ❌         | ❌       |
 *
 * ❌* = pode ser liberado via specific_permissions.{modulo}.page_access === true
 * † = diretoria acessa config-acessos, mas não vê/edita administradores
 *
 * Estrutura de specific_permissions (JSONB em user_roles):
 * {
 *   "financeiro": { "page_access": true },
 *   "cadastros":  { "page_access": true },
 *   "os":         { "page_access": true },
 *   "config":     { "page_access": true }
 * }
 */

export type Categoria = "administrador" | "diretoria" | "financeiro" | "operador";

export type PageKey =
  | "dashboard"
  | "os"
  | "motoristas"
  | "veiculos"
  | "passageiros"
  | "clientes"
  | "parcerias"
  | "fornecedores"
  | "financeiro"
  | "caixa"
  | "categorias-caixa"
  | "formas-pagamento"
  | "config-acessos"
  | "config-perfil"
  | "config-financeiro"
  | "config-notificacoes";

interface ProfileLike {
  categoria: string;
  specific_permissions?: Record<string, unknown> | null;
  is_active?: boolean | null;
}

/**
 * Origem do acesso efetivo de um usuário a uma página/módulo.
 */
export type AccessSource = "inativo" | "administrador" | "categoria-base" | "override" | "nenhum";

export interface EffectiveAccess {
  access: boolean;
  source: AccessSource;
  /** true quando o acesso é herdado da categoria (não editável via specific_permissions) */
  lockedByCategoria: boolean;
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
    fornecedores: true,
    financeiro: true,
    caixa: true,
    "categorias-caixa": true,
    "formas-pagamento": true,
    "config-acessos": true,
    "config-perfil": true,
    "config-financeiro": true,
    "config-notificacoes": true,
  },
  diretoria: {
    dashboard: true,
    os: true,
    motoristas: true,
    veiculos: true,
    passageiros: true,
    clientes: true,
    parcerias: true,
    fornecedores: true,
    financeiro: true,
    caixa: true,
    "categorias-caixa": true,
    "formas-pagamento": true,
    "config-acessos": true,
    "config-perfil": true,
    "config-financeiro": true,
    "config-notificacoes": true,
  },
  financeiro: {
    dashboard: true,
    financeiro: true,
    caixa: true,
    "categorias-caixa": true,
    "formas-pagamento": true,
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
  fornecedores: "financeiro", // fornecedores é cadastro de domínio financeiro
  "categorias-caixa": "financeiro",
  "formas-pagamento": "financeiro",
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
 * Tipos de ação controláveis por página dentro de um módulo.
 * 2. administrador → acesso total, não editável via specific_permissions
 * 3. Acesso base da categoria → concedido pela categoria, não editável
 * 4. specific_permissions.{modulo}.page_access → override editável
 * 5. Caso contrário → sem acesso
 */
/**
 * Tipos de ação controláveis por página dentro de um módulo.
 * - view: visualizar/acessar a página
 * - create: criar e editar registros
 * - delete: excluir registros
 * - sensitive: ações sensíveis (faturar, baixar, exportar, arquivar)
 */
export type PageAction = "view" | "create" | "delete" | "sensitive";

/**
 * Estrutura granular de permissões por página dentro do módulo financeiro.
 * Cada chave é um PageKey do módulo financeiro.
 */
type GranularPagePerms = Record<PageAction, boolean>;

/**
 * Estrutura completa do módulo financeiro em specific_permissions:
 *   "financeiro": {
 *     "page_access": true,           // legacy: concede tudo se não houver "pages"
 *     "pages": {
 *       "financeiro":       { "view": true, "create": true, "delete": true, "sensitive": true },
 *       "caixa":            { "view": true, "create": true, "delete": true, "sensitive": true },
 *       "fornecedores":     { "view": true, "create": true, "delete": true, "sensitive": true },
 *       "categorias-caixa": { "view": true, "create": true, "delete": true, "sensitive": true },
 *       "formas-pagamento": { "view": true, "create": true, "delete": true, "sensitive": true }
 *     }
 *   }
 *
 * Compatibilidade: se "page_access" existir sem "pages", concede view de todas
 * as páginas do módulo (legacy). Se "pages" existir, usa granular.
 */
/**
 * Lista das 5 páginas do módulo financeiro, para uso na UI de permissões.
 */
export const FINANCEIRO_PAGES: PageKey[] = [
  "financeiro",
  "caixa",
  "fornecedores",
  "categorias-caixa",
  "formas-pagamento",
];

/**
 * Lê as permissões granulares de uma página específica do módulo financeiro.
 * Retorna null se não houver estrutura "pages" definida.
 */
function getGranularPagePerms(
  modulePerms: Record<string, unknown> | undefined,
  page: PageKey,
): GranularPagePerms | null {
  if (!modulePerms) return null;
  const pages = modulePerms["pages"] as Record<string, Partial<GranularPagePerms>> | undefined;
  if (!pages) return null;
  const pagePerms = pages[page];
  if (!pagePerms) return null;
  return {
    view: pagePerms.view ?? false,
    create: pagePerms.create ?? false,
    delete: pagePerms.delete ?? false,
    sensitive: pagePerms.sensitive ?? false,
  };
}

/**
 * Verifica se o usuário tem acesso a uma página.
 *
 * Lógica:
 * 1. administrador → sempre true
 * 2. Se a categoria base permite → true
 * 3. Se há specific_permissions para o módulo correspondente:
 *    a. Se há estrutura granular "pages" → checa pages[page].view
 *    b. Senão, checa page_access (legacy, concede tudo do módulo)
 * 4. Caso contrário → false
 */
export function hasPageAccess(
  profile: ProfileLike | null | undefined,
  page: PageKey,
): boolean {
  return getEffectivePageAccess(profile, page).access;
}

/**
 * Calcula o acesso efetivo de um usuário a uma página, junto com a origem
 * dessa decisão. Usado tanto para gate de rotas (via `hasPageAccess`) quanto
 * para a UI de gestão de acessos, que precisa saber se um toggle de
 * `specific_permissions` é editável ou apenas um reflexo do que a categoria
 * já concede.
 *
 * Ordem de precedência:
 * 1. Usuário inativo (`is_active === false`) → sem acesso a nada
 * 2. administrador → acesso total, não editável via specific_permissions
 * 3. Acesso base da categoria → concedido pela categoria, não editável
 * 4. specific_permissions.{modulo}:
 *    a. Se há "pages" granular → pages[page].view
 *    b. Senão, page_access (legacy, concede view de todo o módulo)
 * 5. Caso contrário → sem acesso
 */
export function getEffectivePageAccess(
  profile: ProfileLike | null | undefined,
  page: PageKey,
): EffectiveAccess {
  if (!profile) {
    return { access: false, source: "nenhum", lockedByCategoria: false };
  }

  if (profile.is_active === false) {
    return { access: false, source: "inativo", lockedByCategoria: true };
  }

  const categoria = profile.categoria as Categoria;

  if (categoria === "administrador") {
    return { access: true, source: "administrador", lockedByCategoria: true };
  }

  const baseAllowed = BASE_ACCESS[categoria]?.[page] === true;
  if (baseAllowed) {
    return { access: true, source: "categoria-base", lockedByCategoria: true };
  }

  const permModule = PAGE_TO_PERMISSION_MODULE[page];
  if (!permModule) {
    return { access: false, source: "nenhum", lockedByCategoria: false };
  }

  const specificPermissions = profile.specific_permissions ?? {};
  const modulePerms = specificPermissions[permModule] as
    | Record<string, unknown>
    | undefined;

  // Estrutura granular por página (nova)
  const granular = getGranularPagePerms(modulePerms, page);
  if (granular) {
    return {
      access: granular.view,
      source: granular.view ? "override" : "nenhum",
      lockedByCategoria: false,
    };
  }

  // Legacy: page_access concede view de todo o módulo
  const access = modulePerms?.page_access === true;
  return {
    access,
    source: access ? "override" : "nenhum",
    lockedByCategoria: false,
  };
}

/**
 * Verifica se o usuário pode executar uma ação específica em uma página.
 *
 * Lógica:
 * 1. administrador → sempre true
 * 2. Categoria base concede a página → true para todas as ações
 * 3. specific_permissions granular → pages[page].{action}
 * 4. Legacy page_access → true para todas as ações (compatibilidade)
 * 5. Caso contrário → false
 */
export function hasPageAction(
  profile: ProfileLike | null | undefined,
  page: PageKey,
  action: PageAction,
): boolean {
  if (!profile) return false;
  if (profile.is_active === false) return false;

  const categoria = profile.categoria as Categoria;

  if (categoria === "administrador") return true;

  // Categoria base concede a página → todas as ações permitidas
  const baseAllowed = BASE_ACCESS[categoria]?.[page] === true;
  if (baseAllowed) return true;

  const permModule = PAGE_TO_PERMISSION_MODULE[page];
  if (!permModule) return false;

  const specificPermissions = profile.specific_permissions ?? {};
  const modulePerms = specificPermissions[permModule] as
    | Record<string, unknown>
    | undefined;

  // Estrutura granular
  const granular = getGranularPagePerms(modulePerms, page);
  if (granular) {
    return granular[action];
  }

  // Legacy: page_access concede tudo
  return modulePerms?.page_access === true;
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
    "fornecedores",
    "financeiro",
    "caixa",
    "categorias-caixa",
    "formas-pagamento",
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
    "/portal/fornecedores": "fornecedores",
    "/portal/financeiro": "financeiro",
    "/portal/caixa": "caixa",
    "/portal/financeiro/categorias": "categorias-caixa",
    "/portal/financeiro/formas-pagamento": "formas-pagamento",
    "/portal/config": "config-perfil", // redirect target
    "/portal/config/acessos": "config-acessos",
    "/portal/config/perfil": "config-perfil",
    "/portal/config/financeiro": "config-financeiro",
    "/portal/config/notificacoes": "config-notificacoes",
  };
  return map[pathname] ?? null;
}
