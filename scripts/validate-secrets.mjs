#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID ?? "";
const META_BUSINESS_ACCOUNT_ID = process.env.META_BUSINESS_ACCOUNT_ID ?? "";
const META_WHATSAPP_ACCESS_TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN ?? "";

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
  ["RESEND_API_KEY", RESEND_API_KEY],
  ["META_PHONE_NUMBER_ID", META_PHONE_NUMBER_ID],
  ["META_BUSINESS_ACCOUNT_ID", META_BUSINESS_ACCOUNT_ID],
  ["META_WHATSAPP_ACCESS_TOKEN", META_WHATSAPP_ACCESS_TOKEN],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  console.error("❌ Secrets ausentes no ambiente:", missing.join(", "));
  process.exit(1);
}

console.log("Validando SUPABASE_SERVICE_ROLE_KEY...");

try {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from("app_versions").select("id").limit(1);

  if (error) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY inválido:", error.message);
    process.exit(1);
  }

  console.log("✅ SUPABASE_SERVICE_ROLE_KEY válido");
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("❌ Erro ao validar SUPABASE_SERVICE_ROLE_KEY:", message);
  process.exit(1);
}

console.log("Validando formato dos secrets...");

if (!RESEND_API_KEY.startsWith("re_")) {
  console.error("❌ RESEND_API_KEY formato inválido");
  process.exit(1);
}
console.log("✅ RESEND_API_KEY formato válido");

if (!/^\d+$/.test(META_PHONE_NUMBER_ID)) {
  console.error("❌ META_PHONE_NUMBER_ID formato inválido");
  process.exit(1);
}
console.log("✅ META_PHONE_NUMBER_ID formato válido");

if (!/^\d+$/.test(META_BUSINESS_ACCOUNT_ID)) {
  console.error("❌ META_BUSINESS_ACCOUNT_ID formato inválido");
  process.exit(1);
}
console.log("✅ META_BUSINESS_ACCOUNT_ID formato válido");

if (!META_WHATSAPP_ACCESS_TOKEN.startsWith("EAA")) {
  console.error("❌ META_WHATSAPP_ACCESS_TOKEN formato inválido");
  process.exit(1);
}
console.log("✅ META_WHATSAPP_ACCESS_TOKEN formato válido");

console.log("Validando token da Meta via Graph API...");

const graphResponse = await fetch(
  `https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}?fields=id,display_phone_number,verified_name`,
  {
    headers: { Authorization: `Bearer ${META_WHATSAPP_ACCESS_TOKEN}` },
  },
);
const graphBody = await graphResponse.json();

if (!graphResponse.ok) {
  const graphMessage =
    graphBody && typeof graphBody === "object" && "error" in graphBody
      ? JSON.stringify(graphBody.error)
      : `HTTP ${graphResponse.status}`;
  console.error("❌ META Graph API inválida:", graphMessage);
  process.exit(1);
}

console.log("✅ META Graph API válida");
console.log("\n✅ Todos os secrets validados com sucesso!");
