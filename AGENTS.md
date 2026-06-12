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

- **Key Management:** A `RESEND_API_KEY` deve residir apenas no `.env.local`. Nunca exponha essa chave no cliente.
- **E-mails Transacionais:** Use templates HTML profissionais para boas-vindas, redefinição de senha e alertas críticos.
- **Atomicidade:** Sempre que criar um usuário no Auth, registre-o simultaneamente na tabela `user_roles` e dispare o e-mail de boas-vindas com as credenciais.

---

# Estrutura de Autenticação e Git

## 1. Perfis e Diretórios de Configuração

Existem dois perfis de autenticação isolados via variáveis de ambiente. NUNCA utilize `gh auth login` ou `git push` sem os prefixos de diretório abaixo:

### Perfil: Principal (git-portalgeolog)

- **GitHub CLI Config:** `~/.gh-config1`
- **GitHub Desktop Data:** `~/.gh-app1`
- **Alias recomendado:** `gh1` (env GH_CONFIG_DIR=~/.gh-config1 gh)

## 2. Comandos Obrigatórios para o Agente

Ao executar comandos no terminal para o usuário, você deve injetar a variável de ambiente correspondente ao perfil desejado:

- **Para checar status:** `GH_CONFIG_DIR=~/.gh-config1 gh auth status`.

- **Para clonar ou gerenciar repositórios:** Sempre use `GH_CONFIG_DIR=~/.gh-config[X]` antes de qualquer comando `gh`.

- **Operações de Git (Push/Pull):**
  Certifique-se de que o `user.name` e `user.email` no repositório local (`git config`) correspondem ao perfil autenticado no diretório de configuração fornecido.

## 3. Prevenção de Erros Conhecidos

- **ERRO KIO CLIENT:** Se o sistema solicitar login via navegador, pare. A autenticação deve ser feita via CLI com as pastas acima para evitar o erro de protocolo `x-github-desktop-dev-auth`.
- **SANDBOX:** Ao sugerir a abertura do GitHub Desktop (AppImage), sempre inclua a flag `--no-sandbox` e a variável `XDG_CONFIG_HOME` correta.

## 4. Solução de Problemas (Troubleshooting)

- **Usuário Incorreto no GitHub:** Se `gh` reportar um usuário diferente do esperado (ex: `nshsystem` em vez de `git-portalgeolog`), o token no diretório de configuração está incorreto.
- **Como corrigir:** Execute `echo "SEU_TOKEN" | GH_CONFIG_DIR=~/.gh-config1 gh auth login --with-token` para re-vincular o perfil ao token correto.
- **Verificação:** Sempre valide com `GH_CONFIG_DIR=~/.gh-config1 gh api user --jq .login` antes de realizar operações de escrita (push/create repo).

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
   - Se algum secret falhar na validação, re-enviar automaticamente do `.env.production`:
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

- **GitHub:** [https://github.com/git-portalgeolog/portalgeolog-web](https://github.com/git-portalgeolog/portalgeolog-web)
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

### Regra Obrigatória

**Antes de sugerir qualquer solução envolvendo Supabase ou Cloudflare, o agente DEVE primeiro consultar os MCPs disponíveis.** Não faça suposições sobre schema ou configuração.
