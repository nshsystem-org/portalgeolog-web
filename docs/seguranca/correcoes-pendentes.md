# Correções de Segurança Pendentes

> **Auditoria:** 2026-06-07  
> **Status:** Aguardando implementação em próximos sprints

---

## Checklist de Próximas Correções

- [ ] **ALTO** — IDOR em endpoints públicos de OS (links sem assinatura)
- [ ] **ALTO** — Middleware não protege rotas `/api/*`
- [ ] **MÉDIO** — Ausência de rate limiting em todos os endpoints
- [ ] **MÉDIO** — Build ignora ESLint e TypeScript errors
- [ ] **MÉDIO** — `ilike` com input não sanitizado (wildcards)
- [ ] **MÉDIO** — Upload de arquivos sem validação de magic bytes
- [ ] **BAIXO** — `console.log` extensivo com dados sensíveis em produção
- [ ] **BAIXO** — Singleton de Supabase Admin no Edge (potencial leak entre requests)

---

## Tabela de Priorização

| # | Severidade | Vulnerabilidade | Esforço | Sprint Sugerido |
|---|-----------|----------------|---------|-----------------|
| 1 | 🟠 ALTO | IDOR — endpoints públicos de OS aceitam qualquer UUID | 2-4h | Sprint 1 |
| 2 | 🟠 ALTO | Middleware só cobre `/portal/*`, APIs expostas | 1h | Sprint 1 |
| 3 | 🟡 MÉDIO | Sem rate limiting (força bruta, enumeração, spam) | 2-3h | Sprint 1 |
| 4 | 🟡 MÉDIO | Build com `ignoreBuildErrors: true` | 5min | Sprint 2 |
| 5 | 🟡 MÉDIO | `ilike` sem escape de `%` e `_` no component filter | 15min | Sprint 2 |
| 6 | 🟡 MÉDIO | Upload aceita qualquer MIME type forjado pelo cliente | 1h | Sprint 2 |
| 7 | 🟢 BAIXO | Logs com dados pessoais (telefones, payloads) | 30min | Sprint 3 |
| 8 | 🟢 BAIXO | Singleton de admin client pode vazar entre isolates | 15min | Sprint 3 |

---

## Detalhes e Soluções Propostas

### 1. IDOR em Endpoints Públicos de OS

**Endpoints afetados:**
- `/api/os-public-details`
- `/api/os-driver-accept`
- `/api/os-start-route`
- `/api/os-finish-route`
- `/api/passenger-accept`

**Problema:** Aceitam qualquer UUID sem validar identidade do chamador. A segurança depende apenas do UUID ser difícil de adivinhar.

**Solução proposta:**
```
Opção A: HMAC nos links
  URL: /api/os-driver-accept?os_id=UUID&sig=HMAC-SHA256(UUID, SERVER_SECRET)
  - Gerar assinatura no backend ao criar o link
  - Validar assinatura antes de processar

Opção B: Tokens opacos de uso único (já existe para passageiros)
  - Estender o pattern de os_passenger_confirmations para motoristas
  - Token expira após X horas ou primeiro uso
```

---

### 2. Middleware Não Protege APIs

**Problema:** `src/lib/supabase/middleware.ts` só redireciona para login paths `/portal/*`. Rotas `/api/*` não passam pelo middleware.

**Solução proposta:**
```typescript
// No middleware, adicionar verificação para rotas /api/* que não são públicas
const PUBLIC_API_ROUTES = [
  '/api/meta-webhook',
  '/api/os-public-details',
  '/api/os-driver-accept',
  '/api/passenger-accept',
  '/api/frontend-logs', // POST de log anônimo
];

if (pathname.startsWith('/api/') && !PUBLIC_API_ROUTES.some(r => pathname.startsWith(r))) {
  // Verificar sessão
}
```

---

### 3. Rate Limiting

**Problema:** Nenhum endpoint tem rate limiting. Permite força bruta em login, enumeração de UUIDs, spam de e-mails.

**Solução proposta:**
```
Opção A: Cloudflare Rate Limiting Rules (painel da Cloudflare)
  - /api/users: 10 req/min por IP
  - /api/admin-notify-os: 5 req/min por IP
  - /api/whatsapp: 20 req/min por IP

Opção B: Middleware com upstash/ratelimit
  npm install @upstash/ratelimit @upstash/redis
  - Sliding window de 60s
  - Limites por endpoint
```

---

### 4. Build sem Checks

**Arquivo:** `next.config.ts`

```typescript
// Remover ou condicionar a ambiente:
eslint: { ignoreDuringBuilds: process.env.NODE_ENV !== 'production' },
typescript: { ignoreBuildErrors: process.env.NODE_ENV !== 'production' },
```

**Nota:** Requer corrigir todos os erros de TypeScript/ESLint existentes antes de habilitar em produção.

---

### 5. ilike sem Sanitização

**Arquivo:** `src/app/api/frontend-logs/list/route.ts:63`

```typescript
// Antes:
query = query.ilike("component", `%${component}%`);

// Depois:
const safeComponent = component.replace(/[%_\\]/g, '\\$&');
query = query.ilike("component", `%${safeComponent}%`);
```

---

### 6. Upload sem Validação de Magic Bytes

**Arquivos:** `driver-docs/route.ts`, `financeiro/faturar/route.ts`

**Solução proposta:**
```typescript
import { fileTypeFromBuffer } from 'file-type';

const buffer = await file.arrayBuffer();
const detected = await fileTypeFromBuffer(new Uint8Array(buffer));

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'application/pdf'];
if (!detected || !ALLOWED_MIMES.includes(detected.mime)) {
  return NextResponse.json({ error: "Tipo de arquivo não permitido" }, { status: 400 });
}
```

---

### 7. Console.log com Dados Sensíveis

**Solução:** Já existe `removeConsole: true` no `next.config.ts` para produção, mas isso só funciona com o compilador SWC do Next.js. Verificar se o build Cloudflare Workers respeita essa config.

**Alternativa:** Usar um logger estruturado que redacta campos sensíveis (telefone, email) automaticamente.

---

### 8. Singleton de Admin Client

**Solução:** Trocar o pattern de singleton global por instância por request:

```typescript
// Antes (singleton — pode compartilhar entre requests):
let _supabaseAdmin = null;
const getAdmin = () => { if (!_supabaseAdmin) ... };

// Depois (instância por request):
function getAdmin() {
  return createClient(url, key, { auth: { ... } });
}
```

**Nota:** O impacto real é baixo pois o Supabase client não armazena estado de request, mas é uma boa prática.

---

## Ação Recomendada

| Sprint | Itens | Estimativa |
|--------|-------|-----------|
| Sprint 1 (esta semana) | #1, #2, #3 | 5-8 horas |
| Sprint 2 (próxima semana) | #4, #5, #6 | 2 horas |
| Sprint 3 (quando possível) | #7, #8 | 1 hora |

---

*Última atualização: 2026-06-07*
