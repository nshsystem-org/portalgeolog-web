#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ler variáveis de ambiente do .env.production
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
  console.error(
    "❌ Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env.production",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Ler migration SQL
const migrationPath = join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260625000000_add_os_tipo_column.sql",
);
const migrationSQL = readFileSync(migrationPath, "utf-8");

console.log("🚀 Aplicando migration: add_os_tipo_column...\n");

// Executar migration via RPC (usando a função exec do Supabase)
const { data, error } = await supabase.rpc("exec", { sql: migrationSQL });

if (error) {
  console.error("❌ Erro ao aplicar migration:", error);
  process.exit(1);
}

console.log("✅ Migration aplicada com sucesso!");
console.log("\n📊 Verificando coluna tipo...");

// Verificar se a coluna foi criada
const { data: columns, error: checkError } = await supabase
  .from("ordens_servico")
  .select("tipo")
  .limit(1);

if (checkError) {
  console.error("❌ Erro ao verificar coluna:", checkError);
  process.exit(1);
}

console.log('✅ Coluna "tipo" verificada com sucesso!');
console.log("\n🎉 Migration concluída. Recarregue a aplicação.");
