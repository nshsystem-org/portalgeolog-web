#!/bin/bash

# Script para configurar Supabase CLI e conectar ao projeto
# Execute: ./setup-supabase.sh

echo "=== Configurando Supabase CLI ==="

# Verifica se o Homebrew está disponível (macOS/Linux)
if command -v brew &> /dev/null; then
    echo "Homebrew encontrado. Instalando Supabase CLI..."
    brew install supabase/tap/supabase
# Verifica se é Linux e tenta com curl
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Linux detectado. Instalando Supabase CLI via script oficial..."
    # URL atualizado de acordo com a documentação oficial
    curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | bash
else
    echo "Sistema operacional não suportado para instalação automática."
    echo "Tente: npm install -g supabase"
    echo "Ou instale manualmente: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Verifica a instalação
if ! command -v supabase &> /dev/null; then
    echo "Erro: Supabase CLI não foi instalado corretamente."
    echo "Verifique o PATH ou tente instalar manualmente."
    exit 1
fi

echo "✅ Supabase CLI instalado com sucesso!"

# Pergunta as credenciais
echo "\n=== Configurando credenciais do Supabase ==="
read -p "URL do Supabase (ex: https://xxxxxx.supabase.co): " SUPABASE_URL
read -p "Service Role Key: " SUPABASE_SERVICE_ROLE_KEY

# Cria arquivo .env.local
echo "\n=== Criando arquivo .env.local ==="
cat > .env.local << EOF
# Supabase
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Seu anon key
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL=$SUPABASE_URL
EOF

echo "✅ Arquivo .env.local criado!"

# Linka o projeto local ao Supabase remoto
echo "\n=== Linkando projeto ao Supabase ==="
supabase link --project-ref $(echo $SUPABASE_URL | grep -o 'https://[^.]*' | sed 's/https:\/\///')

# Sincroniza schema do banco remoto
echo "\n=== Sincronizando schema do banco de dados ==="
supabase db pull

echo "\n🎉 Configuração concluída!"
echo "\nPróximos passos:"
echo "1. Execute 'supabase start' para iniciar o ambiente local"
echo "2. Execute 'supabase db reset' para aplicar as migrações"
echo "3. Use 'supabase functions serve' para desenvolver Edge Functions"
