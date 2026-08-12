// Garante que wrangler.workers.toml existe e aponta para o entry point
// correto (worker/index.js) antes de qualquer deploy real para produção.
//
// Por que isso existe: wrangler.workers.toml fica fora do git (.gitignore)
// e há um comando concorrente (`npm run deploy:cf` / `vinext deploy`) que
// gera seu PRÓPRIO wrangler.json sem o campo `main`, apontando para um
// worker sem handler. Isso já causou 404 em produção. Este script bloqueia
// o deploy real se a config estiver ausente ou incorreta, e recria a
// partir do template versionado (wrangler.workers.toml.example) quando
// possível.

import { existsSync, copyFileSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, "wrangler.workers.toml");
const templatePath = path.join(projectRoot, "wrangler.workers.toml.example");

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

if (!existsSync(configPath)) {
  if (!existsSync(templatePath)) {
    fail(
      "wrangler.workers.toml não existe e wrangler.workers.toml.example também não foi encontrado. " +
        "Não é possível recriar a config de deploy automaticamente.",
    );
  }
  console.warn(
    "⚠️  wrangler.workers.toml não encontrado. Recriando a partir de wrangler.workers.toml.example...",
  );
  copyFileSync(templatePath, configPath);
}

const content = readFileSync(configPath, "utf8");

if (!/^\s*main\s*=\s*["']worker\/index\.js["']/m.test(content)) {
  fail(
    'wrangler.workers.toml está sem `main = "worker/index.js"` (ou aponta para outro arquivo). ' +
      "Sem isso o Worker sobe sem handler e todas as rotas retornam 404. " +
      "Restaure com: cp wrangler.workers.toml.example wrangler.workers.toml",
  );
}

if (
  !/\[assets\]/.test(content) ||
  !/directory\s*=\s*["']dist\/client["']/.test(content)
) {
  fail(
    'wrangler.workers.toml está sem [assets] directory = "dist/client" configurado corretamente.',
  );
}

console.log(
  "✅ wrangler.workers.toml validado (main=worker/index.js, assets=dist/client).",
);
