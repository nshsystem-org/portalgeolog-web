#!/bin/bash

echo "🧹 Limpando cache do Next.js..."
rm -rf .next
rm -rf node_modules/.cache

echo "📦 Instalando dependências (se necessário)..."
npm install --silent

echo "🚀 Iniciando dev server com otimizações..."
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
