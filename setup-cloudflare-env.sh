#!/bin/bash

# Script para configurar variáveis de ambiente no Cloudflare Pages
# Execute este script após fazer login com: npx wrangler auth login

echo "Configurando variáveis de ambiente no Cloudflare Pages..."

# Variáveis públicas
echo "1. NEXT_PUBLIC_SUPABASE_URL"
npx wrangler pages project env add portalgeolog-web production NEXT_PUBLIC_SUPABASE_URL "https://hzpgfapvjwqtjclriisz.supabase.co"

echo "2. NEXT_PUBLIC_SUPABASE_ANON_KEY"
npx wrangler pages project env add portalgeolog-web production NEXT_PUBLIC_SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cGdmYXB2andxdGpjbHJpaXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjkzMzksImV4cCI6MjA5MDA0NTMzOX0.bBxEZTNuPuIcXE-eCTewsULdlHyLaoMU3HtqA3qSriA"

# Secrets (variáveis privadas)
echo "3. SUPABASE_SERVICE_ROLE_KEY"
echo "Coloque a chave aqui: " && read -s SERVICE_ROLE && echo $SERVICE_ROLE | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

echo "4. RESEND_API_KEY"
echo "Coloque a chave aqui: " && read -s RESEND_KEY && echo $RESEND_KEY | npx wrangler secret put RESEND_API_KEY

echo "Variáveis configuradas com sucesso!"
echo "Execute 'npx wrangler pages project env list portalgeolog-web' para verificar"
