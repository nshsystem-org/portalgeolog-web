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

// Faz parse de uma string "v1.0.4" -> { major, minor, patch }.
// Retorna null se o formato for inválido.
function parseDisplayVersion(raw) {
  if (!raw) return null;
  const match = String(raw)
    .trim()
    .match(/^v?(\d+)\.(\d+)\.(\d+)$/i);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function formatDisplayVersion({ major, minor, patch }) {
  return `v${major}.${minor}.${patch}`;
}

// Busca a última display_version gravada no banco e retorna o próximo patch.
// Se não houver histórico válido, começa em v0.1.0.
async function computeNextDisplayVersion(supabase, override) {
  const explicit = parseDisplayVersion(override);
  if (explicit) return formatDisplayVersion(explicit);

  const { data, error } = await supabase
    .from("app_versions")
    .select("display_version")
    .order("deployed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(
      `Aviso: não foi possível buscar a última display_version (${error.message}). Iniciando em v0.1.0.`,
    );
    return "v0.1.0";
  }

  const lastParsed = parseDisplayVersion(data?.display_version);
  if (!lastParsed) return "v0.1.0";

  return formatDisplayVersion({
    major: lastParsed.major,
    minor: lastParsed.minor,
    patch: lastParsed.patch + 1,
  });
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

  const displayVersionOverride =
    getArgValue("--display-version") || process.env.APP_DISPLAY_VERSION;
  const displayVersion = await computeNextDisplayVersion(
    supabase,
    displayVersionOverride,
  );

  const { error } = await supabase.from("app_versions").insert({
    version,
    build_hash: buildHash,
    deployed_by: deployedBy,
    notes,
    display_version: displayVersion,
  });

  if (error) {
    throw new Error(`Falha ao publicar versão: ${error.message}`);
  }

  console.log(`Versão publicada com sucesso: ${version}`);
  console.log(`Display version: ${displayVersion}`);
  console.log(`Build hash: ${buildHash}`);
  console.log(`Deployed by: ${deployedBy}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
