#!/bin/bash

# Supabase CLI Wrappers - Execute comandos do Supabase facilmente
# Use: source ./supabase-cmds.sh
# Depois execute: sb-start, sb-status, sb-db-pull, etc.

# Carregar variáveis de ambiente
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Desenvolvimento Local
sb-start() {
    npx supabase start
}

sb-stop() {
    npx supabase stop
}

sb-status() {
    npx supabase status
}

# Operações no Banco de Dados
sb-db-pull() {
    npx supabase db pull
}

sb-db-push() {
    npx supabase db push
}

sb-db-reset() {
    npx supabase db reset
}

sb-db-diff() {
    npx supabase db diff
}

# Edge Functions
sb-fn-list() {
    npx supabase functions list
}

sb-fn-deploy() {
    if [ -z "$1" ]; then
        echo "Uso: sb-fn-deploy <nome-da-function>"
        return 1
    fi
    npx supabase functions deploy "$1"
}

sb-fn-logs() {
    if [ -z "$1" ]; then
        echo "Uso: sb-fn-logs <nome-da-function>"
        return 1
    fi
    npx supabase functions logs --tail --func "$1"
}

# Secrets
sb-secret-list() {
    npx supabase secrets list
}

sb-secret-set() {
    if [ -z "$1" ] || [ -z "$2" ]; then
        echo "Uso: sb-secret-set NOME VALOR"
        return 1
    fi
    npx supabase secrets set "$1=$2"
}

# Link do Projeto
sb-link() {
    npx supabase link --project-ref hzpgfapvjwqtjclriisz
}

sb-unlink() {
    npx supabase unlink
}

# Inspect (inspecionar)
sb-inspect-db() {
    npx supabase inspect db
}

sb-inspect-cache() {
    npx supabase inspect cache
}

sb-inspect-storage() {
    npx supabase inspect storage
}

# Backup
sb-backup-list() {
    npx supabase backup list
}

sb-backup-restore() {
    if [ -z "$1" ]; then
        echo "Uso: sb-backup-restore <backup-id>"
        return 1
    fi
    npx supabase backup restore "$1"
}

# Branch
sb-branch-list() {
    npx supabase branches list
}

# Services (versões)
sb-services() {
    npx supabase services
}

# Todos os comandos disponíveis
sb-help() {
    cat << 'EOF'
Comandos do Supabase:

Desenvolvimento Local:
  sb-start          - Iniciar ambiente local
  sb-stop           - Parar ambiente local
  sb-status         - Ver status do ambiente local

Banco de Dados:
  sb-db-pull        - Baixar schema do banco remoto
  sb-db-push        - Aplicar migrações locais ao remoto
  sb-db-reset       - Resetar banco de dados local
  sb-db-diff        - Mostrar diferenças no schema

Edge Functions:
  sb-fn-list        - Listar todas as functions
  sb-fn-deploy <nome>  - Deploy de uma function
  sb-fn-logs <nome>  - Ver logs de uma function

Segredos (Secrets):
  sb-secret-list    - Listar todos os secrets
  sb-secret-set nome valor  - Definir um novo secret

Inspecionar:
  sb-inspect-db     - Inspecionar banco de dados
  sb-inspect-cache  - Inspecionar cache
  sb-inspect-storage - Inspecionar storage

Backup:
  sb-backup-list    - Listar backups disponíveis
  sb-backup-restore id  - Restaurar backup

Branch:
  sb-branch-list    - Listar branches

Link:
  sb-link           - Linkar ao projeto (já linkado)
  sb-unlink         - Deslinkar projeto

Info:
  sb-services       - Mostrar versões dos serviços
EOF
}

# Aliases curtos
alias sb="npx supabase"
alias sb-ls="sb-status"
alias sb-deploy="sb-db-push"
alias sb-secrets="sb-secret-list"
