# Supabase CLI - Comandos Rápidos

Esta documentação centraliza todos os comandos do Supabase CLI para facilitar o uso.

## Configuração Básica

O projeto já está configurado com:

- CLI versão 2.98.2
- Projeto linkado: `portalgeolog-web` (hzpgfapvjwqtjclriisz)
- Credenciais configuradas em `.env`

## Comandos Disponíveis

### Desenvolvimento Local

```bash
# Iniciar ambiente local
npm run supabase:start
# ou
npx supabase start

# Verificar status
npm run supabase:status
# ou
npx supabase status

# Parar ambiente local
npm run supabase:stop
# ou
npx supabase stop
```

### Operações no Banco de Dados

```bash
# Baixar schema do banco remoto
npm run supabase:db:pull
# ou
npx supabase db pull

# Aplicar migrações locais ao banco remoto
npm run supabase:db:push
# ou
npx supabase db push

# Gerenciar migrações
npx supabase migration list
npx supabase migration up
npx supabase migration down
```

### Edge Functions

```bash
# Criar nova function
npx supabase functions new meu-function

# Servir functions localmente
npx supabase functions serve

# Deploy de functions
npx supabase functions deploy meu-function

# Logs das functions
npx supabase functions logs --tail --func meu-function
```

### Configuração do Projeto

```bash
# Listar projetos (requere SUPABASE_ACCESS_TOKEN)
npm run supabase:login  # Primeiro faça login se necessário
npx supabase projects list

# Linkar projeto (já linkado a este projeto)
npm run supabase:link

# Deslinkar projeto
npm run supabase:unlink

# Listar branches
npx supabase branches list
```

### Secrets e Variáveis de Ambiente

```bash
# Listar secrets do projeto
npm run supabase:secrets:list
# ou
npx supabase secrets list

# Definir novo secret
npx supabase secrets set "MEU_SECRET=valor123"

# Remover secret
npx supabase secrets unset MEU_SECRET
```

### Domínios e Configuração

```bash
# Gerenciar domínios customizados
npm run supabase:domains
# ou
npx supabase domains

# Gerenciar SSL
npx supabase ssl-enforcement get
npx supabase ssl-enforcement update --require-ssl
```

### Backup e Restauração

```bash
# Listar backups
npx supabase backup list

# Restaurar backup
npx supabase backup restore <backup-id>
```

### Login (quando necessário)

```bash
# Primeiro, obtenha seu token de acesso pessoal em:
# https://supabase.com/dashboard/account/tokens

# Fazer login com token
npx supabase login

# O token é salvo e usado automaticamente para comandos gerenciais
```

## Supabase Access Token

Para usar comandos gerenciais como `projects list`, `secrets`, etc., você precisa configurar seu token de acesso:

1. Obtenha seu token em: https://supabase.com/dashboard/account/tokens
2. Faça login com: `npx supabase login`
3. O token será salvo automaticamente para comandos futuros

## Credenciais do Projeto

- **Project URL**: `https://hzpgfapvjwqtjclriisz.supabase.co`
- **Project Ref**: `hzpgfapvjwqtjclriisz`
- **Project Name**: `portalgeolog-web`
- **Region**: East US (Ohio)

## Comandos Úteis rápidos

```bash
# Ver tudo sobre o projeto
npx supabase inspect db
npx supabase inspect cache
npx supabase inspect storage

# Acessar Studio (interface gráfica)
# Inicie o ambiente local e acesse: http://localhost:54323

# Ver todas as versões dos serviços
npx supabase services

# Desfazer link
npx supabase unlink
```

## Mantendo-se Atualizado

```bash
# Atualizar Supabase CLI
npm update supabase

# Ver versão atual
npx supabase --version
```

## Documentação Oficial

Para comandos mais avançados, consulte:

- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Local Development](https://supabase.com/docs/guides/local-development)
- [Edge Functions](https://supabase.com/docs/guides/functions)
