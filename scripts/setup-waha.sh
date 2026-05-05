#!/bin/bash
# ==============================================================
# Setup WAHA no VPS (Contabo) para envio de WhatsApp
# Rode no VPS: bash setup-waha.sh
# ==============================================================
set -euo pipefail

INSTALL_DIR="/opt/waha"
# WAHA_API_KEY deve ser passada como variável de ambiente ou definida manualmente
WAHA_API_KEY=${WAHA_API_KEY:-"DEFINA_SUA_CHAVE_AQUI"}
SESSION_NAME="geolog"
DOMAIN="wppconnect.portalgeolog.com.br"

cat <<'EOF'
==============================================
  🚀 Setup WAHA v2
==============================================
EOF

# 1. Parar instâncias antigas do WPPConnect, se existirem
if [ -d /opt/wppconnect ]; then
  echo ">> Parando WPPConnect legado..."
  (cd /opt/wppconnect && docker compose down) 2>/dev/null || true
fi

# 2. Preparar diretório
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# 3. Criar .env
cat > .env <<EOF
WAHA_API_KEY=${WAHA_API_KEY}
WAHA_SESSION=${SESSION_NAME}
WAHA_API_URL=https://${DOMAIN}
WHATSAPP_HOOK_HMAC_KEY=
EOF

# 4. Criar docker-compose.yml
cat > docker-compose.yml <<'EOF'
services:
  waha:
    container_name: waha
    image: devlikeapro/waha:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:8080"
    env_file:
      - .env
    volumes:
      - waha_instances:/app/.waha

volumes:
  waha_instances:
EOF

# 5. Atualizar Caddy
cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN} {
    reverse_proxy localhost:8080
}
EOF
systemctl reload caddy

# 6. Subir container

docker compose pull

docker compose up -d

# 7. Mostrar status inicial
sleep 10
curl -s -H "X-Api-Key: ${WAHA_API_KEY}" "http://localhost:8080/api/sessions?all=true" || true

echo ""
echo "=============================================="
echo "  ✅ WAHA configurado"
echo "=============================================="
echo ""
echo "  API Key:   ${WAHA_API_KEY}"
echo "  Sessão:    ${SESSION_NAME}"
echo "  URL:       https://${DOMAIN}"
echo ""
echo "  Para iniciar a sessão:"
echo "    curl -s -X POST 'http://localhost:8080/api/sessions/${SESSION_NAME}/start' -H 'X-Api-Key: ${WAHA_API_KEY}' -H 'Content-Type: application/json' -d '{}'"
echo ""
echo "  Para testar mensagem:"
echo "    curl -s -X POST 'http://localhost:8080/api/sendText' -H 'Content-Type: application/json' -H 'X-Api-Key: ${WAHA_API_KEY}' -d '{\"session\":\"${SESSION_NAME}\",\"chatId\":\"5522992495653@c.us\",\"text\":\"Teste WAHA\"}'"
