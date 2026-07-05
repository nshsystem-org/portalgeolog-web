#!/bin/bash

# Script alternativo usando npm para instalação local (sem sudo)
# Execute: ./setup-supabase-npm.sh

echo "=== Configuração do Supabase CLI (modo local) ==="

# Verifica se npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado. Por favor, instale Node.js 22+ primeiro."
    exit 1
fi

# Instala Supabase CLI localmente no projeto
echo "Instalando Supabase CLI via npm (local)..."
npm install --save-dev supabase

# Cria script npm para facilitar uso
echo "Criando scripts npm..."
npm pkg set scripts.supabase="supabase"
npm pkg set scripts.supabase:start="supabase start"
npm pkg set scripts.supabase:stop="supabase stop"
npm pkg set scripts.supabase:status="supabase status"
npm pkg set scripts.supabase:db:pull="supabase db pull"
npm pkg set scripts.supabase:db:push="supabase db push"

echo "✅ Supabase CLI instalado localmente!"

# Pergunta as credenciais
echo ""
echo "=== Configurando credenciais do Supabase ==="
echo "Encontre suas credenciais em: https://supabase.com/dashboard/project/_/settings/api"
echo ""

read -p "URL do Supabase (ex: https://xxxxxx.supabase.co): " SUPABASE_URL
read -p "NEXT_PUBLIC_SUPABASE_ANON_KEY: " ANON_KEY
read -p "SUPABASE_SERVICE_ROLE_KEY: " SERVICE_ROLE_KEY

# Cria arquivo .env.local
echo ""
echo "=== Criando arquivo .env.local ==="
cat > .env.local << EOF
# Supabase Configuration
# Find these at: https://supabase.com/dashboard/project/_/settings/api

NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
SUPABASE_DB_URL=$SUPABASE_URL
EOF

echo "✅ Arquivo .env.local criado!"

# Tenta fazer link com o projeto remoto
if [ -n "$SUPABASE_URL" ]; then
    PROJECT_REF=$(echo $SUPABASE_URL | grep -o 'https://[^.]*' | sed 's/https:\/\///')
    if [ -n "$PROJECT_REF" ]; then
        echo ""
        echo "=== Linkando projeto ao Supabase ==="
        npx supabase link --project-ref $PROJECT_REF
    fi
fi

echo ""
echo "🎉 Configuração concluída!"
echo ""
echo "Próximos passos:"
echo "1. Execute 'npm run supabase:start' para iniciar o ambiente local"
echo "2. Execute 'npm run supabase:db:pull' para buscar o schema remoto"
echo "3. Ou use 'npx supabase <comando>' para comandos avulsos"
echo ""
echo "Comandos úteis definidos no package.json:"
npm run | grep supabase
