#!/usr/bin/env node
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ler .env.production
const envPath = join(__dirname, "..", ".env.production");
const envContent = readFileSync(envPath, "utf-8");
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [key, ...values] = line.split("=");
      return [key, values.join("=")];
    }),
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Erro: variáveis de ambiente não encontradas");
  process.exit(1);
}

console.log("🚀 Aplicando migration: add_os_tipo_column...\n");

// Executar cada statement via fetch direto
const statements = [
  // 1. Adicionar coluna tipo
  `ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'os'`,

  // 2. Migrar dados existentes
  `UPDATE public.ordens_servico SET tipo = 'freelance' WHERE is_freelance = true AND tipo = 'os'`,

  // 3. Adicionar constraint
  `ALTER TABLE public.ordens_servico DROP CONSTRAINT IF EXISTS chk_ordens_servico_tipo`,

  `ALTER TABLE public.ordens_servico ADD CONSTRAINT chk_ordens_servico_tipo CHECK (tipo IN ('os', 'freelance', 'rascunho'))`,
];

// Usar PostgREST para executar SQL via função personalizada
// Como não temos função RPC, vamos usar uma abordagem alternativa:
// Executar via client Supabase com operações diretas

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Tentar adicionar a coluna via ALTER TABLE simulado com upsert
console.log("📝 Verificando se coluna tipo já existe...");

const { data: testData, error: testError } = await supabase
  .from("ordens_servico")
  .select("id, tipo")
  .limit(1);

if (testError && testError.code === "42703") {
  console.log(
    '❌ Coluna "tipo" não existe. Precisa ser criada via SQL direto.',
  );
  console.log("\n⚠️  AÇÃO NECESSÁRIA:");
  console.log(
    "Execute o seguinte SQL manualmente no Supabase Dashboard (SQL Editor):",
  );
  console.log("\n" + "=".repeat(80));

  const migrationPath = join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260625000000_add_os_tipo_column.sql",
  );
  const migrationSQL = readFileSync(migrationPath, "utf-8");
  console.log(migrationSQL);
  console.log("=".repeat(80) + "\n");

  console.log(
    "📍 Ou acesse: " +
      supabaseUrl.replace(
        "https://",
        "https://supabase.com/dashboard/project/",
      ) +
      "/sql",
  );
  process.exit(1);
} else if (testError) {
  console.error("❌ Erro ao verificar coluna:", testError);
  process.exit(1);
} else {
  console.log('✅ Coluna "tipo" já existe!');
  console.log("📊 Dados de exemplo:", testData);
  console.log("\n🎉 Migration já foi aplicada anteriormente.");
}
