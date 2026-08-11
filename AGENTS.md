# 🤖 Agentic Guidelines: Certify Web (2026 Edition)

Este documento é a "Fonte da Verdade" para agentes de IA operando neste repositório. Siga estas instruções rigorosamente para manter a integridade do código, a economia de tokens e a precisão das refatorações.

---

## 🛠 1. Comandos de Operação (Build/Lint/Test)

Sempre verifique o `package.json` antes de executar, mas prefira estes padrões:

### Build & Instalação

- **Instalar:** `npm install` (mantenha o `package-lock.json` atualizado).
- **Build:** `npm run build` - Verifique a pasta `dist/` ou `.next/` após a execução.
- **Dev Mode:** `npm run dev` - Use para validar mudanças em tempo real.

### Linting & Formatação

- **Check:** `npm run lint`
- **Fix:** `npm run lint -- --fix`
- **Prettier:** `npx prettier --write .` (execute obrigatoriamente antes de cada commit).

### Git & Commits (PRIORIDADE ABSOLUTA)

- **NÃO FAÇA COMMITS automaticamente.** Só execute `git commit` quando o usuário pedir explicitamente no chat.
- **NÃO FAÇA PUSH** sem autorização explícita do usuário.
- **NÃO FAÇA DEPLOY** (incluindo `wrangler deploy`, `npm run deploy` ou `npm run publish:app-version`) sem autorização explícita do usuário.
- **Regra de Ouro:** build, lint, commit, push e deploy só podem ocorrer quando eu pedir explicitamente no chat; na dúvida, pare e aguarde confirmação.
- **Canal de execução GitHub:** Qualquer operação remota no GitHub (push, PR, issue, review, branch, comentário) DEVE ser feita via `github-mcp-server` (ver seção 9). Não use `gh` CLI nem `git push` direto quando houver tool MCP equivalente. O MCP é o canal, não a autorização — a regra de ouro acima continua valendo.

### 🧪 Testes (Protocolo de Validação)

- **Fluxo de Trabalho:** Modificar código -> Rodar Lint no arquivo -> Rodar Teste Unitário específico.
- **Rodar teste único:** `npx jest path/to/file.test.ts` ou `npm test -- path/to/file.test.ts`
- **Economia de Recursos:** Não execute a suite completa de testes (`npm test`) para mudanças triviais em arquivos isolados.

---

## 🎨 2. Diretrizes de Estilo e Arquitetura

### Importações & Organização

- **Caminhos:** Use Aliases (`@/components/...`). Caminhos relativos (`../../`) são permitidos apenas para arquivos na mesma pasta.
- **Ordem de Importação:**
  1. React/Next.js Core
  2. Bibliotecas externas (npm)
  3. Aliases de Projeto (`@/hooks`, `@/utils`, `@/services`)
  4. Imports relativos e CSS.
- **Exports:** Use `Named Exports` (`export const ...`). `Default exports` são exclusivos para componentes de Página (Next.js Pages/App Router).

### Naming Conventions

- **Componentes:** `PascalCase.tsx` (ex: `LoginCard.tsx`).
- **Lógica/Utils:** `kebab-case.ts` (ex: `auth-validator.ts`).
- **Variáveis/Funções:** `camelCase`.
- **Booleanos:** Iniciar com `is`/`has`/`should` (ex: `isLoading`, `hasPermission`).
- **Types/Interfaces:** `PascalCase`. Proibido prefixo `I` (use `User`, não `IUser`).

### TypeScript & Tipagem Estrita

- **No Any:** O uso de `any` é proibido. Use `unknown` com Type Guards ou defina a interface correta.
- **Async:** Nunca use `.then()`. Use sempre `async/await` com blocos `try/catch`.
- **Explicicidade:** Funções exportadas devem ter tipos de retorno definidos.

### Campos Obrigatórios com Asteriscos (PRIORIDADE ABSOLUTA)

- **Componente:** `@/components/ui/RequiredAsterisk.tsx`
- **Classe CSS:** `.required-asterisk` (definida em `globals.css`)
- **OBRIGATÓRIO:** Sempre que asterisco for solicitado, usar `<RequiredAsterisk />`
- **Estilo Padrão:** Vermelho claro (#fca5a5), tamanho base, alinhamento baseline
- **Uso Correto:** `<label>Campo <RequiredAsterisk /></label>`
- **PROIBIDO:** Asteriscos manuais (`*`, `<span>*</span>`, `className="text-red-500"`)

---

## 📊 10. Estilo Global de Tabelas (PRIORIDADE ABSOLUTA)

### Componente Padrão: DataTable

- **Localização:** `@/components/ui/DataTable.tsx`
- **OBRIGATÓRIO:** Todas as novas páginas com listagens devem usar `DataTable`

### Padrão Visual Consistente

```tsx
// Estrutura obrigatória para todas as tabelas
<DataTable
  data={dados}
  columns={[
    {
      key: 'campo',
      title: 'Título da Coluna',
      render: (value, item) => (
        // Render customizado seguindo padrões visuais
      ),
      align: 'left' | 'center' | 'right'
    }
  ]}
  searchTerm={searchTerm}
  onSearchChange={setSearchTerm}
  searchPlaceholder="Buscar por..."
  emptyMessage="Nenhum registro encontrado."
  emptyIcon={<Icone size={48} />}
/>
```

### Estilo Visual Obrigatório

- **Container:** `bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40`
- **Header:** `bg-slate-50/80 border-b border-slate-200`
- **Títulos:** `text-[12px] font-black uppercase tracking-widest text-slate-600`
- **Padding:** `px-6 py-4` (padrão) ou `px-4 py-2` (compact)
- **Hover:** `hover:bg-slate-50/50 transition-colors`
- **Divisores:** `divide-y divide-slate-100`

### Padrões de Conteúdo

- **Texto principal:** `font-bold text-slate-800 text-base`
- **Texto secundário:** `text-sm text-slate-500 font-medium`
- **Ícones:** Tamanho 18px para ações, 14px para informações
- **Botões de ação:** `p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg`

### Search Integrado

- **Input:** `pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl`
- **Ícone:** `<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />`
- **Contador:** `text-xs font-black uppercase tracking-[0.3em] text-slate-400`

### Páginas que Seguem Este Padrão

- ✅ `/portal/servicos` - Implementado
- ✅ `/portal/fornecedores` - Implementado
- ✅ `/portal/passageiros` - Implementado
- ✅ `/portal/motoristas` - Implementado
- ✅ `/portal/financeiro` - Implementado
- ✅ `/portal/os` - Implementado

### Regra de Ouro

**NUNCA** criar tabelas HTML manualmente em novas páginas. **SEMPRE** usar `DataTable` para garantir consistência visual e comportamental em todo o sistema.

---

## 🌐 3. Internacionalização (i18n) - PRIORIDADE 2026

Ao refatorar para i18n no `certify-web`:

- **Zero Hardcoding:** Nenhuma string visível ao usuário deve permanecer no JSX.
- **Hook de Tradução:** Use o padrão estabelecido (ex: `useTranslation` do `next-intl`).
- **Padrão de Chaves:** Use nomes semânticos e hierárquicos: `contexto.subcontexto.elemento_propriedade`.
  - _Exemplo:_ `auth.login.button_label` em vez de `btn_entrar`.
- **Sincronização:** Toda chave adicionada em `pt-BR.json` deve ter sua contraparte (mesmo que vazia ou em inglês) em `en.json`.

---

## 📂 4. Mapeamento de Lógica (Contexto Específico)

Ao buscar por funcionalidades centrais, priorize:

1. **Auth/Login:** `src/pages/login/`, `src/components/auth/`, `src/hooks/useAuth.ts`.
2. **Traduções:** `public/locales/` ou `src/messages/`.
3. **Serviços de API:** `src/services/` ou `src/api/`.
4. **Envio de E-mails:** `src/app/api/users/route.ts` (exemplo de integração com Resend).

---

## 📏 5. Regras de Eficiência do Agente (Token Economy)

- **Busca Cirúrgica:** Use `grep` ou `list_dir` antes de ler arquivos. Não leia arquivos com mais de 500 linhas inteiros se precisar apenas de uma função; peça a leitura de linhas específicas.
- **Proibição de Leitura:** Nunca tente ler as pastas `node_modules`, `.next`, `dist` ou `.git`.
- **Respostas Concisas:** Retorne apenas o código modificado ou explicações técnicas breves. Evite introduções educadas como "Com certeza, vou te ajudar...".
- **Refatoração Atômica:** Não tente refatorar múltiplos componentes de uma vez. Faça um por um, valide com lint/test, e siga para o próximo.

---

## 🧠 6. Integração com IDE

- **Preservação:** Não apague comentários de lógica complexa ou anotações de outros desenvolvedores sem justificativa clara no chat.
- **Documentação de Exceção:** Se encontrar um padrão que viole este guia mas seja necessário para o projeto, comente no topo do arquivo e sugira a atualização deste `AGENTS.md`.

---

## 🔔 7. Sistema de Notificações & RBAC (Real-time)

O sistema utiliza uma arquitetura baseada em banco de dados para notificações, garantindo segurança e separação entre usuários **Internos** e **Gestores**.

### Arquitetura de Notificações

- **Tabela Mestre:** `public.app_notifications`. Nunca dispare `toast()` no frontend baseado em listeners de tabelas de negócio (ex: `clientes`, `os`).
- **Geração de Mensagens:** Exclusivamente via **PostgreSQL Triggers**. Toda lógica de _o que_ e _para quem_ notificar deve residir no banco de dados.
- **Segurança (RLS):** A filtragem de público (`target_audience`) é feita via **Row-Level Security**. Internos nunca recebem pacotes de Gestores e vice-versa.
- **Frontend (Listener):** O `DataContext.tsx` possui um único listener dedicado a `app_notifications`. Ele apenas renderiza o que o banco envia.

### Controle de Acesso (RBAC)

- **Tabela de Perfis:** `public.user_roles`.
- **Sincronização:** O `AuthContext.tsx` monitora mudanças na categoria do usuário logado em tempo real. Se um acesso for revogado, o sistema deve deslogar o usuário imediatamente.
- **Caminho da Gestão:** `/portal/config` é a página central para administração desses perfis.

---

## 🛡 8. Segurança e Operações de Admin (Supabase & Resend)

### Supabase Admin

- **Escalação de Privilégios:** Operações de criação/modificação de usuários `auth` devem ser feitas exclusivamente via Server Actions ou API Routes usando a `SUPABASE_SERVICE_ROLE_KEY`.
- **Bypass de RLS:** A Service Role ignora todas as políticas de RLS. Use com extrema cautela e valide permissões de admin no código antes de executar.

### Comunicação (Resend)

- **Key Management:** A `RESEND_API_KEY` deve residir apenas no `.env`. Nunca exponha essa chave no cliente.
- **E-mails Transacionais:** Use templates HTML profissionais para boas-vindas, redefinição de senha e alertas críticos.
- **Atomicidade:** Sempre que criar um usuário no Auth, registre-o simultaneamente na tabela `user_roles` e dispare o e-mail de boas-vindas com as credenciais.

---

# Estrutura de Autenticação e Git

## 1. Perfis e Autenticação

A máquina possui o `gh` (GitHub CLI) configurado com **duas contas** autenticadas via keyring:

| Conta | Função | Status |
|---|---|---|
| `git-portalgeolog` | Admin da org `nshsystem-org` | **Ativa** (padrão) |
| `nshsystem` | User individual | Inativa |

**Repositório:** `nshsystem-org/portalgeolog-web` (organização, pertence ao `git-portalgeolog` que é admin).

### Configuração do Git (`~/.gitconfig`)

O `~/.gitconfig` global usa `includeIf` para alternar perfis por pasta:

- `~/github-geolog/` → `git-portalgeolog / portalgeolog@proton.me`
- `~/github-nshsystem/` → `nshsystem / nshsystem@protonmail.com`
- Outras pastas → `Thorfinn / nshsystem@protonmail.com` (default global)

**Importante:** O projeto em `~/Documents/web` **não** é coberto por nenhum `includeIf`. A config local do repo deve ser definida manualmente:

```bash
git config user.name "git-portalgeolog"
git config user.email "portalgeolog@proton.me"
```

## 2. Comandos para o Agente

- **Verificar auth:** `gh auth status` (mostra contas ativas)
- **Verificar usuário ativo:** `gh api user --jq .login` (deve retornar `git-portalgeolog`)
- **Operações de Git (Push/Pull):** Usar `gh` diretamente (sem `GH_CONFIG_DIR`). O credential helper já está configurado em `~/.gitconfig` para usar `gh auth git-credential`.
- **Verificar permissão de push:** `git push --dry-run origin main` antes de fazer push real.

## 3. Solução de Problemas (Troubleshooting)

- **Usuário Incorreto no GitHub:** Se `gh api user --jq .login` retornar algo diferente de `git-portalgeolog`, troque a conta ativa com `gh auth switch --user git-portalgeolog`.
- **Erro de Auth no Push:** Se `git push` falhar com erro 403, verifique se o credential helper está configurado: `git config --global credential.helper` deve incluir `gh auth git-credential`.
- **Clone correto:** `git clone https://github.com/nshsystem-org/portalgeolog-web.git`

## 🚀 5. Deploy & Infraestrutura (Cloudflare Workers)

### Cloudflare CLI (Wrangler)

- **Autenticação:** Configure via `wrangler login` ou use `CLOUDFLARE_API_TOKEN`.
- **REGRA DE OURO:** Só faça deploy quando o usuário pedir explicitamente no chat. Nunca inicie um deploy por conta própria.

### Sistema de Versionamento Automático

O sistema possui um mecanismo de versionamento que força o auto-reload de todos os usuários conectados após um deploy.

**Como funciona:**

- **Tabela:** `public.app_versions` armazena cada versão deployada (hash + timestamp)
- **Frontend Hook:** `useAppVersion` monitora a tabela via Supabase Realtime e polling (30s)
- **Sidebar:** Mostra a versão atual acima do botão de logout
- **Auto-reload:** Quando detecta nova versão, exibe toast com contagem regressiva (10s) e recarrega
- **Logs:** Após reload bem-sucedido, grava log em `frontend_error_logs` visível na página Config

**Arquivos envolvidos:**

- Hook: `src/hooks/useAppVersion.ts`
- Layout: `src/app/portal/layout.tsx` (display da versão)
- Script: `scripts/publish-app-version.mjs` (publica versão no banco)
- Migration: `supabase/migrations/20260520000004_app_version_tracking.sql`

### Deploy Manual (Fluxo Obrigatório)

Quando o usuário solicitar "faça deploy manual wrangler", o agente DEVE seguir este fluxo exato:

1. **Verificar Build Interno:** Executar `npm run build` e garantir que não há erros
2. **Verificar ESLint:** Executar `npm run lint` e garantir que não há erros
3. **Validar e Atualizar Secrets:**
   - Listar secrets do Worker: `wrangler secret list --config wrangler.workers.toml`
   - Testar cada secret obrigatório usando o client do Supabase (para `SUPABASE_SERVICE_ROLE_KEY`) ou curl simples (para outros)
   - Se algum secret falhar na validação, re-enviar automaticamente do `.env`:
     - `SUPABASE_SERVICE_ROLE_KEY` - testar com query simples ao Supabase
     - `RESEND_API_KEY` - validar formato
     - `META_WHATSAPP_ACCESS_TOKEN` - validar formato
     - `META_PHONE_NUMBER_ID` - validar formato
     - `META_BUSINESS_ACCOUNT_ID` - validar formato
   - Usar script Python ou Node.js para automatizar o re-envio via `echo "valor" | wrangler secret put NOME --config wrangler.workers.toml`
4. **Deploy Direto:** Executar `wrangler deploy --config wrangler.workers.toml`
5. **Publicar Versão (OBRIGATÓRIO):** Executar `npm run publish:app-version` para:
   - Inserir nova linha em `app_versions` com hash do commit atual + timestamp
   - Disparar evento Realtime que força reload em todos os usuários conectados
   - Gerar log quando usuários recarregarem para nova versão

**Fluxo Alternativo (Comando Único):**

- Use `npm run deploy:workers:versioned` para executar build + deploy + publicação em um único comando

**IMPORTANTE:** NUNCA executar `npx @cloudflare/next-on-pages@1` nem buildar via Cloudflare Pages. Use sempre o build interno do Next.js e faça o deploy direto para Workers.

**Secrets Obrigatórios:** O sistema requer 5 secrets configurados (todos relacionados à META):

- `SUPABASE_SERVICE_ROLE_KEY` - Chave de serviço do Supabase
- `RESEND_API_KEY` - Chave da API Resend para e-mails
- `META_WHATSAPP_ACCESS_TOKEN` - Token de acesso da Meta WhatsApp
- `META_PHONE_NUMBER_ID` - ID do número de telefone da Meta
- `META_BUSINESS_ACCOUNT_ID` - ID da conta de negócio da Meta

**IMPORTANTE:** WAHA e Evolution API NÃO são mais usados. NUNCA configurar secrets como `WAHA_API_KEY`, `WAHA_SSH_PASSWORD`, `WHATSAPP_HOOK_HMAC_KEY`, `EVOLUTION_API_KEY`, `EVOLUTION_API_URL` ou `EVOLUTION_INSTANCE`. O sistema usa exclusivamente a API oficial da Meta para WhatsApp.

**Publicação de Versão:** Sempre que fizer deploy manual, DEVE executar `npm run publish:app-version` (ou usar `deploy:workers:versioned`) para ativar o auto-reload. Sem isso, usuários ficarão na versão antiga até recarregar manualmente.

### Links de Referência

- **GitHub:** [https://github.com/nshsystem-org/portalgeolog-web](https://github.com/nshsystem-org/portalgeolog-web)
- **Produção:** [https://portalgeolog.com.br](https://portalgeolog.com.br)

---

_Assinado: Certify Web Core Team (2026)_

---

## 🔌 9. MCP Servers Disponíveis

O agente possui acesso aos seguintes MCP servers para operações diretas:

### Supabase MCP

- **Usar para:** Operações de banco de dados, deploy de Edge Functions, gerenciamento de projetos/branches.
- **Ferramentas principais:**
  - `mcp1_execute_sql` - Executar queries SQL
  - `mcp1_list_tables` - Listar tabelas
  - `mcp1_get_advisors` - Verificar segurança/performance
  - `mcp1_deploy_edge_function` - Deploy de Edge Functions
  - `mcp1_list_projects` - Listar projetos do usuário
- **Quando usar:** SEMPRE que for necessário verificar schema, executar migrations ou debugar problemas de dados.

### Cloudflare Docs MCP

- **Usar para:** Buscar documentação oficial do Cloudflare.
- **Ferramentas principais:**
  - `mcp0_search_cloudflare_documentation` - Buscar na documentação
  - `mcp0_migrate_pages_to_workers_guide` - Guia de migração Pages → Workers
- **Quando usar:** SEMPRE que houver dúvidas sobre deploy, configuração ou features do Cloudflare.

### GitHub MCP (`github-mcp-server`)

- **Usar para:** QUALQUER operação no GitHub — commits remotos, push, pull requests, issues, reviews, branches, comentários, reactions, busca de código/PRs/issues.
- **Server:** `github-mcp-server` (configurado via URL `https://api.githubcopilot.com/mcp`).
- **Ferramentas principais:**
  - `create_pull_request` - Abrir PR (sempre busque template em `.github/PULL_REQUEST_TEMPLATE` antes)
  - `search_pull_requests` / `search_issues` / `search_code` / `search_repositories` - Buscas direcionadas
  - `list_pulls` / `list_issues` - Listagens amplas com paginação (5-10 itens/batch)
  - `pull_request_review_write` (method `create` → `add_comment_to_pending_review` → `submit_pending`) - Fluxo de review com comentários linha-a-linha
  - `add_issue_comment` - Comentar em issue/PR (não usar para review comments)
  - `add_reply_to_pull_request_comment` - Responder a comentário de review
  - `get_me` - Sempre chamar PRIMEIRO para entender permissões/contexto do usuário
  - `list_branches` / `get_branch` / `create_branch` - Gerenciamento de branches
  - `create_or_update_file` - Commit de arquivo único via API (quando apropriado)
- **Padrões obrigatórios:**
  1. **Chamar `get_me` primeiro** em qualquer sessão que envolva GitHub, para confirmar o usuário autenticado (`git-portalgeolog`).
  2. **`search_*` antes de `create_*`**: buscar issues/PRs duplicados antes de criar.
  3. **Paginação**: batches de 5-10 itens; usar `minimal_output: true` quando o conteúdo completo não for necessário.
  4. **Sort em `search_*`**: passar `sort` e `order` como parâmetros separados, nunca como prefixo `sort:` na query string. A query deve conter apenas critérios (ex: `org:google language:python`).
  5. **Issues**: usar `list_issue_types` primeiro em organizações para usar os issue types corretos; sempre definir `state_reason` ao fechar.
  6. **PR template**: antes de criar PR, buscar `pull_request_template.md` ou `.github/PULL_REQUEST_TEMPLATE` e usar o conteúdo para estruturar a descrição.
  7. **Reviews complexos**: criar pending review → adicionar comentários → submit. NÃO submeter review inline com comentários linha-a-linha.
  8. **Contexto do repo**: owner=`nshsystem-org`, repo=`portalgeolog-web` (a menos que explicitamente informado outro).

### Git MCP local (`git`)

- **Usar para:** Operações de git LOCAL (status, log, diff, commit, branch) quando o `github-mcp-server` não cobrir.
- **Server:** `git` (stdio via `uvx --with "mcp<2" mcp-server-git --repository <repo>`).
- **IMPORTANTE - Pin de versão:** O `mcp` SDK 2.0.0 quebrou a API `list_tools` usada pelo `mcp-server-git`. A config DEVE incluir `--with "mcp<2"` nos args do `uvx`, senão o servidor crasha com `AttributeError: 'Server' object has no attribute 'list_tools'` e o handshake `initialize` falha com "connection closed".
- **Caminho do repo:** O `--repository` DEVE apontar para `/home/hodu/Projetos/portalgeolog/portalgeolog-web` (NÃO para o pai `/home/hodu/Projetos/portalgeolog`, que é um repo vazio sem commits).
- **Quando usar:** Operações de leitura local (status, log, diff, blame) e commit local. Para push e operações remotas, prefira `github-mcp-server`.

### Regra Obrigatória

**Antes de sugerir qualquer solução envolvendo Supabase, Cloudflare ou GitHub, o agente DEVE primeiro consultar os MCPs disponíveis.** Não faça suposições sobre schema, configuração ou estado do repositório remoto.

**QUALQUER operação no GitHub (commit remoto, push, PR, issue, review, branch, comentário) DEVE ser feita via `github-mcp-server`, nunca via `git` CLI direto nem `gh` CLI quando houver tool MCP equivalente.** Isso garante rastreabilidade, tratamento de erros consistente e evita problemas de credencial/auth. Exceção: `git` CLI local para diff/status/log quando mais rápido, e `gh` CLI apenas como fallback se o MCP estiver indisponível (informe o usuário).

**Lembrete de política:** Mesmo via MCP, commit/push/PR/merge SÓ ocorrem com autorização explícita do usuário no chat (ver seção 1 — "Git & Commits (PRIORIDADE ABSOLUTA)"). O MCP é o canal de execução, não uma autorização.
