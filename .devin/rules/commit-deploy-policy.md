---
description: "Bloqueio explícito de commit, push e deploy + fluxo obrigatório de 5 passos"
trigger: always_on
---

## Autorização

Nunca faça `git commit`, `git push`, `wrangler deploy`, `npm run deploy` ou `npm run publish:app-version` sem solicitação explícita do usuário no chat. Se não houver pedido direto e claro, pare e aguarde confirmação.

## Fluxo de Deploy OBRIGATÓRIO (5 passos)

Quando o usuário pedir deploy (qualquer forma: "deploy", "faça deploy", "deploy wrangler", etc.), execute RIGOROSAMENTE estes 5 passos em ordem. NUNCA pule nenhum:

1. **Build:** `npm run build` — garantir zero erros
2. **Lint:** `npm run lint` — garantir zero erros
3. **Secrets:** `wrangler secret list --config wrangler.workers.toml` + validar cada um:
   - `SUPABASE_SERVICE_ROLE_KEY` — query simples ao Supabase
   - `RESEND_API_KEY` — validar formato `re_`
   - `META_WHATSAPP_ACCESS_TOKEN` — validar via Graph API
   - `META_PHONE_NUMBER_ID` — validar formato
   - `META_BUSINESS_ACCOUNT_ID` — validar formato
   - Se algum falhar, re-enviar do `.env` via `wrangler secret put`
4. **Deploy:** `node ./scripts/ensure-wrangler-config.mjs && npx wrangler deploy --config wrangler.workers.toml`
5. **Versão:** `npm run publish:app-version` (dispara auto-reload)

**PROIBIDO:** fazer `wrangler deploy` sem rebuildar primeiro. O `dist/client` deve sempre refletir o código atual do commit. Pular o build causa deploy de assets stale (já aconteceu — bug do ícone "Remover veículo" em produção).

**PROIBIDO:** pular o passo 3 (validação de secrets) mesmo se o deploy anterior funcionou. Secrets podem expirar ou ser rotacionados.

**PROIBIDO:** usar `npm run deploy:cf` / `vinext deploy` — derruba produção (404 em todas as rotas).
