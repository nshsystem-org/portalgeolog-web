#!/usr/bin/env node

/**
 * Script para verificar e obter as credenciais corretas da Meta WhatsApp API
 *
 * Uso:
 * 1. Acesse: https://business.facebook.com/settings/whatsapp-business-accounts
 * 2. Selecione sua conta WhatsApp Business
 * 3. Vá em "Configurações" > "Números de telefone"
 * 4. Copie o Phone Number ID do número que deseja usar
 * 5. O WABA ID está na URL: https://business.facebook.com/wa/manage/phone-numbers/?waba_id=XXXXXXXX
 *
 * Execute este script para testar as credenciais:
 * node scripts/verify-meta-credentials.js
 */

const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
const businessAccountId = process.env.META_BUSINESS_ACCOUNT_ID;

console.log("🔍 Verificando credenciais da Meta WhatsApp API...\n");

if (!accessToken) {
  console.error("❌ META_WHATSAPP_ACCESS_TOKEN não encontrado");
  process.exit(1);
}

if (!phoneNumberId) {
  console.error("❌ META_PHONE_NUMBER_ID não encontrado");
  process.exit(1);
}

if (!businessAccountId) {
  console.error("❌ META_BUSINESS_ACCOUNT_ID não encontrado");
  process.exit(1);
}

console.log("✅ Variáveis de ambiente encontradas");
console.log(`   Phone Number ID: ${phoneNumberId}`);
console.log(`   Business Account ID: ${businessAccountId}`);
console.log(`   Access Token: ${accessToken.substring(0, 20)}...`);
console.log("");

// Verificar token
async function verifyToken() {
  console.log("🔐 Verificando token de acesso...");

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}&access_token=${accessToken}`,
    );
    const data = await response.json();

    if (data.error) {
      console.error("❌ Erro ao verificar token:", data.error.message);
      return false;
    }

    if (!data.data.is_valid) {
      console.error("❌ Token inválido ou expirado");
      return false;
    }

    console.log("✅ Token válido");
    console.log(`   App: ${data.data.application}`);
    console.log(`   Tipo: ${data.data.type}`);
    console.log(`   Permissões: ${data.data.scopes.join(", ")}`);
    console.log("");

    return true;
  } catch (error) {
    console.error("❌ Erro ao verificar token:", error.message);
    return false;
  }
}

// Verificar Phone Number
async function verifyPhoneNumber() {
  console.log("📱 Verificando Phone Number ID...");

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}?access_token=${accessToken}`,
    );
    const data = await response.json();

    if (data.error) {
      console.error("❌ Erro ao verificar Phone Number:", data.error.message);
      console.error("   Código:", data.error.code);
      console.error("   Subcódigo:", data.error.error_subcode);
      console.log("");
      console.log("💡 Dica: Verifique se o Phone Number ID está correto em:");
      console.log(
        "   https://business.facebook.com/settings/whatsapp-business-accounts",
      );
      return false;
    }

    console.log("✅ Phone Number válido");
    console.log(`   Número: ${data.display_phone_number || "N/A"}`);
    console.log(`   Nome verificado: ${data.verified_name || "N/A"}`);
    console.log("");

    return true;
  } catch (error) {
    console.error("❌ Erro ao verificar Phone Number:", error.message);
    return false;
  }
}

// Verificar Business Account
async function verifyBusinessAccount() {
  console.log("🏢 Verificando Business Account ID...");

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${businessAccountId}?access_token=${accessToken}`,
    );
    const data = await response.json();

    if (data.error) {
      console.error(
        "❌ Erro ao verificar Business Account:",
        data.error.message,
      );
      console.error("   Código:", data.error.code);
      console.error("   Subcódigo:", data.error.error_subcode);
      console.log("");
      console.log("💡 Dica: O WABA ID está na URL ao acessar:");
      console.log(
        "   https://business.facebook.com/wa/manage/phone-numbers/?waba_id=XXXXXXXX",
      );
      return false;
    }

    console.log("✅ Business Account válido");
    console.log(`   Nome: ${data.name || "N/A"}`);
    console.log("");

    return true;
  } catch (error) {
    console.error("❌ Erro ao verificar Business Account:", error.message);
    return false;
  }
}

// Testar envio de mensagem
async function testMessage() {
  console.log("📤 Testando envio de mensagem...");

  const testPhone = "5522997599213"; // Número de teste

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: testPhone,
          type: "text",
          text: {
            body: "✅ Teste de configuração da Meta WhatsApp API - Portal Geolog",
          },
        }),
      },
    );

    const data = await response.json();

    if (data.error) {
      console.error("❌ Erro ao enviar mensagem:", data.error.message);
      console.error("   Código:", data.error.code);
      if (data.error.error_subcode) {
        console.error("   Subcódigo:", data.error.error_subcode);
      }
      return false;
    }

    console.log("✅ Mensagem enviada com sucesso!");
    console.log(`   Message ID: ${data.messages[0].id}`);
    console.log(`   Para: ${testPhone}`);
    console.log("");

    return true;
  } catch (error) {
    console.error("❌ Erro ao enviar mensagem:", error.message);
    return false;
  }
}

// Executar verificações
(async () => {
  const tokenOk = await verifyToken();
  if (!tokenOk) {
    console.log("\n❌ Verificação falhou. Corrija o token de acesso.");
    process.exit(1);
  }

  const phoneOk = await verifyPhoneNumber();
  const businessOk = await verifyBusinessAccount();

  if (!phoneOk || !businessOk) {
    console.log(
      "\n❌ Verificação falhou. Corrija as credenciais no .env.production",
    );
    console.log("\n📖 Guia de correção:");
    console.log(
      "1. Acesse: https://business.facebook.com/settings/whatsapp-business-accounts",
    );
    console.log("2. Selecione sua conta WhatsApp Business");
    console.log("3. Copie o WABA ID da URL (waba_id=XXXXXXXX)");
    console.log('4. Vá em "Números de telefone" e copie o Phone Number ID');
    console.log("5. Atualize o .env.production com os valores corretos");
    process.exit(1);
  }

  const messageOk = await testMessage();

  if (messageOk) {
    console.log(
      "🎉 Todas as verificações passaram! A API está configurada corretamente.",
    );
  } else {
    console.log("\n⚠️  As credenciais estão corretas, mas o envio falhou.");
    console.log(
      "   Verifique se o número de destino está registrado ou se há limites de envio.",
    );
  }
})();
