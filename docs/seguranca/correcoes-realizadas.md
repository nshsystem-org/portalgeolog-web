# Correções de Segurança Realizadas

> **PR:** [#2 — fix(security): correção de vulnerabilidades críticas](https://github.com/nshsystem-org/portalgeolog-web/pull/2)  
> **Data:** 2026-06-07  
> **Branch:** `devin/1780804583-security-fixes`

---

## Checklist de Correções

- [x] **CRÍTICO** — `/api/users` sem autenticação (GET/POST/PATCH/DELETE)
- [x] **CRÍTICO** — `/api/admin-notify-os` sem autenticação
- [x] **CRÍTICO** — `/api/os-manual-cycle` sem autenticação
- [x] **CRÍTICO** — `/api/frontend-logs/list` sem autenticação
- [x] **CRÍTICO** — Senha padrão hardcoded `12345678`
- [x] **ALTO** — Token Meta (`META_WEBHOOK_VERIFY_TOKEN`) exposto no `.env.example`
- [x] **ALTO** — XSS via `dangerouslySetInnerHTML` sem sanitização
- [x] **ALTO** — Ausência de Security Headers HTTP

---

## Detalhes por Correção

### 1. Autenticação em `/api/users`

| Item | Antes | Depois |
|------|-------|--------|
| GET (listar users) | Público | Requer sessão + role `admin` |
| POST (criar user) | Público | Requer sessão + role `admin` |
| PATCH (editar role) | Público | Requer sessão + role `admin` |
| DELETE (remover user) | Público | Requer sessão + role `admin` |

**Arquivo:** `src/app/api/users/route.ts`  
**Função adicionada:** `requireAdmin()` — verifica cookie de sessão + consulta `user_roles.categoria === "admin"`

---

### 2. Autenticação em `/api/admin-notify-os`

| Item | Antes | Depois |
|------|-------|--------|
| POST (enviar emails) | Público | Requer sessão válida |

**Arquivo:** `src/app/api/admin-notify-os/route.ts`

---

### 3. Autenticação em `/api/os-manual-cycle`

| Item | Antes | Depois |
|------|-------|--------|
| POST (manipular ciclos) | Público | Requer sessão válida |

**Arquivo:** `src/app/api/os-manual-cycle/route.ts`

---

### 4. Autenticação em `/api/frontend-logs/list`

| Item | Antes | Depois |
|------|-------|--------|
| GET (listar logs) | Público | Requer sessão válida |

**Arquivo:** `src/app/api/frontend-logs/list/route.ts`

---

### 5. Senha Padrão

| Item | Antes | Depois |
|------|-------|--------|
| Senha de novos usuários | `"12345678"` (fixa) | `crypto.randomUUID().slice(0, 12)` (aleatória) |

**Arquivo:** `src/app/api/users/route.ts:129`

---

### 6. Token Meta Exposto

| Item | Antes | Depois |
|------|-------|--------|
| `.env.example` | Continha valor real do token | Placeholder genérico |

**Ação adicional necessária:** Gerar novo token e atualizar no Meta Business Manager.

---

### 7. XSS via dangerouslySetInnerHTML

| Item | Antes | Depois |
|------|-------|--------|
| `AnnouncementBanner.tsx` | `{{ __html: message }}` | `{{ __html: DOMPurify.sanitize(message) }}` |
| `admin/page.tsx` | `{{ __html: message }}` | `{{ __html: DOMPurify.sanitize(message) }}` |

**Dependência adicionada:** `dompurify` + `@types/dompurify`

---

### 8. Security Headers

Headers adicionados em `next.config.ts`:

| Header | Valor |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-DNS-Prefetch-Control` | `on` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

---

*Última atualização: 2026-06-07*
