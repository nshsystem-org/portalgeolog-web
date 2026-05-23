import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const projectRoot = process.cwd();
const envProductionPath = path.join(projectRoot, ".env.production");

if (existsSync(envProductionPath)) {
  dotenv.config({ path: envProductionPath });
}

dotenv.config();

function getGitShortHash() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function getVersionStamp() {
  const gitHash = getGitShortHash();
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `${gitHash}-${timestamp}`;
}

function getArgValue(flagName) {
  const index = process.argv.indexOf(flagName);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.",
    );
  }

  const version =
    getArgValue("--version") || process.env.APP_VERSION || getVersionStamp();
  const buildHash =
    getArgValue("--build-hash") || process.env.BUILD_HASH || getGitShortHash();
  const deployedBy =
    getArgValue("--deployed-by") ||
    process.env.DEPLOYED_BY ||
    "manual-wrangler";
  const notes =
    getArgValue("--notes") ||
    process.env.APP_VERSION_NOTES ||
    "Deploy manual via Wrangler";

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error } = await supabase.from("app_versions").insert({
    version,
    build_hash: buildHash,
    deployed_by: deployedBy,
    notes,
  });

  if (error) {
    throw new Error(`Falha ao publicar versão: ${error.message}`);
  }

  console.log(`Versão publicada com sucesso: ${version}`);
  console.log(`Build hash: ${buildHash}`);
  console.log(`Deployed by: ${deployedBy}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
