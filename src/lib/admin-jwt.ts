/**
 * JWT HMAC-SHA256 assinado via Web Crypto API.
 *
 * Usado para emitir tokens de curta duração que comprovam que um
 * administrador re-autenticou recentemente para acessar /admin.
 *
 * - Sem dependências externas (jose/jsonwebtoken).
 * - Funciona em Cloudflare Workers (crypto.subtle global).
 * - Segredo derivado do SUPABASE_SERVICE_ROLE_KEY (já configurado como
 *   secret do Worker e disponível no middleware de edge).
 * - Token vinculado ao user_id + role; expira em 15 minutos.
 */

const TOKEN_TTL_SECONDS = 60 * 15; // 15 minutos
const COOKIE_NAME = "admin_verified_token";
const ISSUER = "portalgeolog-admin";

interface AdminTokenPayload {
  iss: string;
  sub: string; // user_id
  role: string; // categoria em user_roles
  iat: number; // emitido em (segundos)
  exp: number; // expira em (segundos)
  jti: string; // id único
}

function getSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurado — necessário para assinar/verificar admin JWT.",
    );
  }
  return secret;
}

async function importHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encodeJsonAsBase64Url(obj: unknown): string {
  const enc = new TextEncoder();
  return base64UrlEncode(enc.encode(JSON.stringify(obj)));
}

function decodeBase64UrlToJson<T>(str: string): T {
  const bytes = base64UrlDecode(str);
  const dec = new TextDecoder();
  return JSON.parse(dec.decode(bytes)) as T;
}

function generateJti(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export interface SignOptions {
  userId: string;
  role: string;
  /** TTL customizado em segundos (default 900 = 15min). */
  ttlSeconds?: number;
}

export interface VerifiedToken {
  payload: AdminTokenPayload;
  /** True quando assinatura válida e não expirado. */
  valid: boolean;
  /** Motivo caso inválido. */
  reason?: "invalid_signature" | "expired" | "malformed";
}

/**
 * Assina e retorna o JWT compacto (header.payload.signature).
 */
export async function signAdminToken(
  opts: SignOptions,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = opts.ttlSeconds ?? TOKEN_TTL_SECONDS;
  const payload: AdminTokenPayload = {
    iss: ISSUER,
    sub: opts.userId,
    role: opts.role,
    iat: now,
    exp: now + ttl,
    jti: generateJti(),
  };

  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = encodeJsonAsBase64Url(header);
  const payloadB64 = encodeJsonAsBase64Url(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importHmacKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput),
  );
  const sigB64 = base64UrlEncode(new Uint8Array(sig));
  return `${signingInput}.${sigB64}`;
}

/**
 * Verifica assinatura + expiração. Não lança — retorna { valid, reason }.
 */
export async function verifyAdminToken(
  token: string,
): Promise<VerifiedToken> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { payload: null as unknown as AdminTokenPayload, valid: false, reason: "malformed" };
  }
  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  try {
    const key = await importHmacKey();
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(sigB64),
      new TextEncoder().encode(signingInput),
    );
    if (!ok) {
      return {
        payload: null as unknown as AdminTokenPayload,
        valid: false,
        reason: "invalid_signature",
      };
    }
    const payload = decodeBase64UrlToJson<AdminTokenPayload>(payloadB64);
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== ISSUER || typeof payload.exp !== "number") {
      return {
        payload,
        valid: false,
        reason: "malformed",
      };
    }
    if (now >= payload.exp) {
      return { payload, valid: false, reason: "expired" };
    }
    return { payload, valid: true };
  } catch {
    return {
      payload: null as unknown as AdminTokenPayload,
      valid: false,
      reason: "malformed",
    };
  }
}

export const ADMIN_TOKEN_COOKIE = COOKIE_NAME;
export const ADMIN_TOKEN_TTL_SECONDS = TOKEN_TTL_SECONDS;
