# Instruções para Deploy no Cloudflare Workers

## Problema Identificado

Após o deploy, o site não funciona porque as variáveis de ambiente não estão disponíveis no runtime do Cloudflare Workers.

## Solução Implementada

### 1. Configurações Atualizadas

**Arquivos modificados:**

- `vite.config.ts` - Agora injeta todas as variáveis SUPABASE* e NEXT*PUBLIC\* no build
- `worker/index.js` - Melhorado o Proxy para process.env que copia variáveis do Cloudflare env
- `wrangler.toml` e `wrangler.workers.toml` - Adicionados placeholders para todas as variáveis necessárias

### 2. Passos para Deploy

#### Opção A: Deploy com variáveis de ambiente no build

```bash
# Exportar todas as variáveis necessárias
export SUPABASE_SERVICE_ROLE_KEY="sua_chave_aqui"
export WHATSAPP_HOOK_HMAC_KEY="sua_chave_aqui"
export RESEND_API_KEY="sua_chave_aqui"

# Fazer build e deploy
npm run build
npx wrangler deploy --config wrangler.workers.toml
```

#### Opção B: Usar wrangler secret put (recomendado para produção)

```bash
# Fazer build
npm run build

# Configurar secrets no Cloudflare
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put WHATSAPP_HOOK_HMAC_KEY
npx wrangler secret put RESEND_API_KEY

# Fazer deploy
npx wrangler deploy --config wrangler.workers.toml
```

#### Opção C: Deploy com GitHub Actions/CI/CD

Configure as variáveis de ambiente no seu CI/CD:

- `SUPABASE_SERVICE_ROLE_KEY`
- `WHATSAPP_HOOK_HMAC_KEY`
- `RESEND_API_KEY`

### 3. Verificação

Para verificar se as variáveis estão funcionando:

1. Acesse `/api/test-env` no seu site deployado
2. Deve retornar um JSON mostrando todas as variáveis

### 4. Resumo das Mudanças

1. **Injeção no Build**: Todas as variáveis necessárias são injetadas no código durante o build
2. **Runtime no Cloudflare**: O worker/index.js copia variáveis do Cloudflare env para process.env
3. **Placeholders**: Os arquivos wrangler.toml têm placeholders para todas as variáveis

### 5. Comandos de Teste

```bash
# Testar build localmente
npm run build

# Testar servidor localmente
npm run start

# Verificar endpoint de teste
curl http://localhost:3000/api/test-env
```

### 6. Variáveis Necessárias

**Públicas (NEXT*PUBLIC*):**

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
  **Supabase:**

- SUPABASE_SERVICE_ROLE_KEY

**Outras:**

- WHATSAPP_HOOK_HMAC_KEY
- RESEND_API_KEY
