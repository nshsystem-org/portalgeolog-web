# Auditoria de Segurança — Portal Geolog Web

**Data:** 2026-06-07  
**Escopo:** Código-fonte completo (API routes, middleware, autenticação, configuração)  
**Método:** Code review estático de todos os endpoints em `src/app/api/`

---

## Resumo Executivo

| Severidade | Quantidade | Corrigidas | Pendentes |
|-----------|-----------|-----------|-----------|
| 🔴 CRÍTICO | 5 | 5 | 0 |
| 🟠 ALTO | 4 | 3 | 1 |
| 🟡 MÉDIO | 5 | 0 | 5 |
| 🟢 BAIXO | 2 | 0 | 2 |
| **Total** | **16** | **8** | **8** |

---

## Todas as Vulnerabilidades Encontradas

### 🔴 CRÍTICAS (5) — Todas Corrigidas

| # | Endpoint | Vulnerabilidade | Status |
|---|----------|----------------|--------|
| 1 | `/api/users` | CRUD completo sem autenticação | ✅ Corrigido |
| 2 | `/api/admin-notify-os` | Envio de emails sem autenticação | ✅ Corrigido |
| 3 | `/api/os-manual-cycle` | Manipulação de OS sem autenticação | ✅ Corrigido |
| 4 | `/api/frontend-logs/list` | Exposição de logs sem autenticação | ✅ Corrigido |
| 5 | `/api/users` (POST) | Senha padrão fixa `12345678` | ✅ Corrigido |

### 🟠 ALTAS (4) — 3 Corrigidas, 1 Pendente

| # | Local | Vulnerabilidade | Status |
|---|-------|----------------|--------|
| 6 | Endpoints públicos de OS | IDOR — qualquer UUID aceito sem validação | ⏳ Pendente |
| 7 | `.env.example` | Token Meta real exposto no repositório | ✅ Corrigido |
| 8 | `AnnouncementBanner` + `admin/page` | XSS via dangerouslySetInnerHTML | ✅ Corrigido |
| 9 | `next.config.ts` | Ausência total de security headers | ✅ Corrigido |

### 🟡 MÉDIAS (5) — Todas Pendentes

| # | Local | Vulnerabilidade | Status |
|---|-------|----------------|--------|
| 10 | `next.config.ts` | Build ignora ESLint e TypeScript errors | ⏳ Pendente |
| 11 | `middleware.ts` | Middleware não cobre rotas `/api/*` | ⏳ Pendente |
| 12 | Todos os endpoints | Sem rate limiting | ⏳ Pendente |
| 13 | `frontend-logs/list` | `ilike` sem sanitização de wildcards | ⏳ Pendente |
| 14 | `driver-docs`, `financeiro/faturar` | Upload sem validação de magic bytes | ⏳ Pendente |

### 🟢 BAIXAS (2) — Todas Pendentes

| # | Local | Vulnerabilidade | Status |
|---|-------|----------------|--------|
| 15 | Vários endpoints | console.log com dados sensíveis | ⏳ Pendente |
| 16 | Vários endpoints | Singleton de admin client no Edge | ⏳ Pendente |

---

## Endpoints Auditados

### Com autenticação adequada ✅

| Endpoint | Método | Auth |
|----------|--------|------|
| `/api/whatsapp` | POST | `auth.getUser()` |
| `/api/financeiro/faturar` | POST | `auth.getUser()` |
| `/api/financeiro/baixar` | POST | `auth.getUser()` |
| `/api/financeiro/relatorio` | GET | `auth.getUser()` |
| `/api/app-notifications` | GET/POST | `auth.getUser()` |
| `/api/presence/heartbeat` | POST | `auth.getUser()` |
| `/api/presence/users` | GET | `auth.getUser()` |
| `/api/whatsapp-logs` | GET | `auth.getUser()` |
| `/api/driver-docs` | POST | `auth.getUser()` |
| `/api/notify-passenger` | POST | `auth.getUser()` |

### Intencionalmente públicos (design correto)

| Endpoint | Justificativa |
|----------|---------------|
| `/api/meta-webhook` | Webhook do Facebook — validação via `hub.verify_token` |
| `/api/os-public-details` | Link enviado via WhatsApp para motoristas/passageiros |
| `/api/os-driver-accept` | Aceite de viagem via link direto |
| `/api/passenger-accept` | Confirmação de passageiro via token |
| `/api/frontend-logs` (POST) | Logging de erros do frontend (write-only) |

### Corrigidos nesta auditoria

| Endpoint | Antes | Depois |
|----------|-------|--------|
| `/api/users` | Público | Admin only |
| `/api/admin-notify-os` | Público | Sessão obrigatória |
| `/api/os-manual-cycle` | Público | Sessão obrigatória |
| `/api/frontend-logs/list` | Público | Sessão obrigatória |

---

## Metodologia

1. **Mapeamento:** Listagem de todos os arquivos em `src/app/api/`
2. **Análise de autenticação:** Verificação de `auth.getUser()` ou equivalente em cada handler
3. **Análise de autorização:** Verificação de roles/permissões após autenticação
4. **Busca de secrets:** Grep por hardcoded tokens, passwords, keys
5. **Análise de input:** Verificação de validação/sanitização de parâmetros
6. **Análise de output:** Verificação de XSS, information disclosure
7. **Configuração:** Revisão de headers, CORS, middleware

---

## Próximos Passos

Ver: [Correções Pendentes](./correcoes-pendentes.md)

---

*Auditor: Devin AI | Solicitante: NSH | Data: 2026-06-07*
