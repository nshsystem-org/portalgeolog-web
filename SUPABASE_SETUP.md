# Configuração do Supabase CLI

Este guia ajuda a configurar o Supabase CLI e conectar ao projeto existente.

## Pré-requisitos

- Node.js 22+
- npm ou yarn
- Projeto Supabase existente

## Quick Setup

1. **Instalar Supabase CLI** (se ainda não instalado):

```bash
# macOS
brew install supabase/tap/supabase

# Linux
curl -fsSL https://raw.githubusercontent.com/supabase/supabase/master/install.sh | bash

# ou via npm (recomendado para desenvolvimento)
npm install -g supabase
```

2. **Executar script de setup**:

```bash
./setup-supabase.sh
```

3. **Ou configurar manualmente**:

```bash
# Criar .env
cp .env .env.bak  # backup opcional

# Preencher com suas credenciais do Supabase:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY

# Linkar projeto
supabase link --project-ref SEU_PROJECT_ID

# Puxar schema do banco
supabase db pull
```

## Credenciais

Encontre suas credenciais em: https://supabase.com/dashboard/project/_/settings/api

- **Project URL**: `https://xxxxx.supabase.co`
- **Project Reference**: `xxxxx` (parte do URL)
- **Public API Key**: Usado no frontend
- **Service Role Key**: Usado no backend (mantenha seguro!)

## Comandos Úteis

```bash
# Iniciar ambiente local
supabase start

# Parar ambiente local
supabase stop

# Verificar status
supabase status

# Puxar schema do banco remoto
supabase db pull

# Aplicar migrações locais
supabase db push

# Desenvolver Edge Functions
supabase functions serve

# Logs
supabase functions logs --tail

# Studio (interface web)
# Acesse: http://localhost:54323
```

## Estrutura do Projeto

```
supabase/
├── config.toml      # Configuração do Supabase
├── migrations/      # Migrações de banco
├── seed.sql         # Dados iniciais
└── functions/       # Edge Functions
```

## Links Úteis

- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Local Development](https://supabase.com/docs/guides/local-development)
- [Edge Functions](https://supabase.com/docs/guides/functions)

## Troubleshooting

Se encontrar problemas com permissões de instalação:

```bash
# Usar npm global sem sudo
npm config set prefix ~/.npm-global
# Adicione ao ~/.bashrc ou ~/.zshrc:
export PATH="$HOME/.npm-global/bin:$PATH"
```
