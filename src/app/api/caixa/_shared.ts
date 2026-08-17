import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const CAIXA_ATTACHMENT_BUCKET = "financeiro-comprovantes";
export const CAIXA_ATTACHMENT_PREFIX = "caixa";

export const CAIXA_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const CAIXA_MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

type UserRoleRow = {
  id: string;
  categoria: string | null;
  specific_permissions: Record<string, unknown> | null;
};

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function createAdminClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

export async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );
}

export async function getAuthUser() {
  const authClient = await createAuthClient();
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function hasCaixaAccess(userId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("user_roles")
    .select("categoria, specific_permissions")
    .eq("id", userId)
    .single();
  if (error || !data) return false;
  const row = data as UserRoleRow;
  if (row.categoria === "administrador" || row.categoria === "financeiro") {
    return true;
  }
  const permissions = row.specific_permissions as Record<
    string,
    Record<string, unknown>
  > | null;
  // Reusa o bloco "financeiro" de permissões — caixa compartilha o mesmo perfil.
  const financePermissions = permissions?.financeiro;
  return financePermissions?.page_access === true;
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

// Tipos de domínio compartilhados entre as rotas
export type CaixaBancoRow = {
  id?: string;
  nome: string | null;
  sigla: string | null;
  cor: string | null;
};

export type CaixaContaRow = {
  id: string;
  nome: string;
  tipo: string;
  saldo_inicial: number | string | null;
  ativa: boolean | null;
  is_default: boolean | null;
  created_at: string | null;
  banco_id?: string | null;
  bancos?: CaixaBancoRow | CaixaBancoRow[] | null;
};

export type CaixaLancamentoJoinRow = {
  id: string;
  conta_id: string;
  tipo: string;
  valor: number | string | null;
  data: string | null;
  descricao: string | null;
  categoria: string | null;
  forma_pagamento: string | null;
  cliente_id: string | null;
  parceiro_id: string | null;
  driver_id: string | null;
  fornecedor_id: string | null;
  os_id: string | null;
  origem: string | null;
  anexo_path: string | null;
  created_by: string | null;
  created_at: string | null;
  conta?: { nome: string; tipo: string } | null;
  cliente?: { nome: string } | null;
  driver?: { name: string } | null;
  fornecedor?: { nome: string } | null;
  os?: { protocolo: string } | null;
};

export const mapCaixaContaRow = (row: CaixaContaRow) => {
  const banco = pickJoin(row.bancos);
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo as "caixa" | "banco" | "pix" | "carteira",
    saldoInicial: Number(row.saldo_inicial || 0),
    ativa: row.ativa !== false,
    isDefault: row.is_default === true,
    createdAt: row.created_at || "",
    bancoId: row.banco_id ?? null,
    banco: banco
      ? {
          nome: banco.nome || "",
          sigla: banco.sigla || "",
          cor: banco.cor || "",
        }
      : null,
  };
};

// Supabase retorna joins como array; normaliza para objeto único.
const pickJoin = <T>(value: T | T[] | null | undefined): T | null => {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};

export const mapCaixaLancamentoRow = (row: CaixaLancamentoJoinRow) => {
  const conta = pickJoin(row.conta);
  const cliente = pickJoin(row.cliente);
  const driver = pickJoin(row.driver);
  const fornecedor = pickJoin(row.fornecedor);
  const os = pickJoin(row.os);
  return {
    id: row.id,
    contaId: row.conta_id,
    tipo: row.tipo as "entrada" | "saida",
    valor: Number(row.valor || 0),
    data: row.data || "",
    descricao: row.descricao || "",
    categoria: row.categoria || "outros",
    formaPagamento: (row.forma_pagamento || "outro") as
      | "pix"
      | "dinheiro"
      | "cartao_credito"
      | "cartao_debito"
      | "transferencia"
      | "boleto"
      | "outro",
    clienteId: row.cliente_id,
    parceiroId: row.parceiro_id,
    driverId: row.driver_id,
    fornecedorId: row.fornecedor_id,
    osId: row.os_id,
    origem: (row.origem || "manual") as
      | "manual"
      | "os_recebimento"
      | "os_repasse",
    anexoPath: row.anexo_path,
    contaNome: conta?.nome,
    contaTipo:
      (conta?.tipo as "caixa" | "banco" | "pix" | "carteira") ?? undefined,
    clienteNome: cliente?.nome ?? null,
    driverNome: driver?.name ?? null,
    fornecedorNome: fornecedor?.nome ?? null,
    osProtocolo: os?.protocolo ?? null,
    createdAt: row.created_at || "",
  };
};

export const CAIXA_LANCAMENTO_SELECT =
  "id, conta_id, tipo, valor, data, descricao, categoria, forma_pagamento, cliente_id, parceiro_id, driver_id, fornecedor_id, os_id, origem, anexo_path, created_by, created_at, conta:caixa_contas(nome, tipo), cliente:clientes(nome), driver:drivers(name), fornecedor:fornecedores(nome), os:ordens_servico(protocolo)";
