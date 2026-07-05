#!/bin/bash

# Script simples para conectar ao Supabase após a instalação
# Use após executar setup-supabase.sh

echo "=== Conectando ao Supabase ==="

# Verifica se as variáveis estão definidas
if [ -f ".env.local" ]; then
    echo "Carregando variáveis de .env.local..."
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Testa a conexão
echo "Verificando conexão com Supabase..."
curl -s "$SUPABASE_DB_URL/health" > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ Conexão bem-sucedida!"
    echo ""
    echo "Comandos úteis:"
    echo "supabase start          # Iniciar ambiente local"
    echo "supabase db pull       # Puxar schema do banco remoto"
    echo "supabase functions serve # Desenvolver Edge Functions"
    echo "supabase status        # Verificar status"
else
    echo "❌ Falha na conexão. Verifique suas credenciais."
fi
