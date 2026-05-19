/**
 * Meta WhatsApp Business API - Placeholder Module
 *
 * Este módulo prepara a estrutura para integração com a API oficial da Meta.
 * Atualmente, todas as funções retornam sucesso sem enviar mensagens,
 * aguardando configuração das credenciais da Meta.
 *
 * Documentação oficial:
 * - https://developers.facebook.com/docs/whatsapp/cloud-api
 * - https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
 */

import { normalizeBrazilPhone } from "@/lib/phone";
import { recordWhatsAppLog } from "@/lib/whatsapp-logs";

export interface MetaConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
}

export interface MetaMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Normaliza telefones para o formato esperado pela Meta.
 * Remove qualquer máscara e garante o DDI do Brasil quando o número é local.
 */
export function normalizeWhatsAppPhone(phone: string): string {
  return normalizeBrazilPhone(phone);
}

/**
 * Obtém configuração da Meta API
 * Retorna null se as variáveis não estiverem configuradas
 */
export function getMetaConfig(): MetaConfig | null {
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const businessAccountId = process.env.META_BUSINESS_ACCOUNT_ID;

  if (!accessToken || !phoneNumberId || !businessAccountId) {
    return null;
  }

  return {
    accessToken,
    phoneNumberId,
    businessAccountId,
  };
}

/**
 * Verifica se a API da Meta está configurada
 */
export function isMetaConfigured(): boolean {
  return getMetaConfig() !== null;
}

/**
 * Envia mensagem de texto via Meta WhatsApp Business API
 * NOTA: Mensagens de texto simples só funcionam dentro de janela de 24h de conversa
 * Para notificações, use sendWhatsAppTemplate com templates aprovados
 *
 * @param phone - Número do destinatário (com código do país, ex: 5521999999999)
 * @param message - Conteúdo da mensagem
 * @returns Resultado do envio
 *
 * @example
 * ```ts
 * const result = await sendWhatsAppMessage('5521999999999', 'Olá!');
 * if (result.success) {
 *   console.log('Mensagem enviada:', result.messageId);
 * } else {
 *   console.error('Erro:', result.error);
 * }
 * ```
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string,
): Promise<MetaMessageResult> {
  const config = getMetaConfig();
  const normalizedPhone = normalizeWhatsAppPhone(phone);

  // Se não estiver configurado, retorna erro
  if (!config) {
    console.error(
      "[Meta API] Não configurada - variáveis de ambiente ausentes:",
      {
        hasToken: !!process.env.META_WHATSAPP_ACCESS_TOKEN,
        hasPhoneId: !!process.env.META_PHONE_NUMBER_ID,
        hasBusinessId: !!process.env.META_BUSINESS_ACCOUNT_ID,
      },
    );
    return {
      success: false,
      error: "API da Meta não configurada. Variáveis de ambiente ausentes.",
    };
  }

  void recordWhatsAppLog({
    source: "whatsapp",
    eventType: "send_message_attempt",
    payload: {
      phone,
      normalizedPhone,
      messageLength: message.length,
    },
  });

  console.log("[Meta API] Configurada - enviando mensagem:", {
    phone,
    normalizedPhone,
    messageLength: message.length,
  });

  if (!normalizedPhone) {
    void recordWhatsAppLog({
      source: "whatsapp",
      eventType: "send_message_error",
      payload: {
        phone,
        normalizedPhone,
        error: "Telefone inválido para envio.",
      },
    });

    return {
      success: false,
      error: "Telefone inválido para envio.",
    };
  }

  try {
    const phoneNumberId = config.phoneNumberId;
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "text",
        text: {
          body: message,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Meta API] Erro na resposta:", data);
      void recordWhatsAppLog({
        source: "whatsapp",
        eventType: "send_message_error",
        payload: {
          phone,
          normalizedPhone,
          response: data,
        },
      });
      return {
        success: false,
        error: data.error?.message || "Erro ao enviar mensagem",
      };
    }

    console.log("[Meta API] Mensagem enviada com sucesso:", {
      messageId: data.messages?.[0]?.id,
    });
    void recordWhatsAppLog({
      source: "whatsapp",
      eventType: "send_message_success",
      payload: {
        phone,
        normalizedPhone,
        messageId: data.messages?.[0]?.id || null,
      },
    });
    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    console.error("[Meta API] Exceção:", error);
    void recordWhatsAppLog({
      source: "whatsapp",
      eventType: "send_message_exception",
      payload: {
        phone,
        normalizedPhone,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Envia mensagem usando template aprovado da Meta
 *
 * @param phone - Número do destinatário (com código do país, ex: 5521999999999)
 * @param templateName - Nome do template aprovado (ex: 'os_notification_driver')
 * @param language - Código do idioma (ex: 'pt_BR')
 * @param components - Array de componentes com as variáveis do template
 * @returns Resultado do envio
 *
 * @example
 * ```ts
 * const result = await sendWhatsAppTemplate(
 *   '5521999999999',
 *   'os_notification_driver',
 *   'pt_BR',
 *   [
 *     { type: 'body', parameters: [{ type: 'text', text: '12345' }] },
 *     { type: 'body', parameters: [{ type: 'text', text: 'Empresa X' }] }
 *   ]
 * );
 * ```
 */
export async function sendWhatsAppTemplate(
  phone: string,
  templateName: string,
  language: string = "pt_BR",
  components: Array<Record<string, unknown>> = [],
): Promise<MetaMessageResult> {
  const config = getMetaConfig();
  const normalizedPhone = normalizeWhatsAppPhone(phone);

  if (!config) {
    console.error(
      "[Meta API] Não configurada - variáveis de ambiente ausentes:",
      {
        hasToken: !!process.env.META_WHATSAPP_ACCESS_TOKEN,
        hasPhoneId: !!process.env.META_PHONE_NUMBER_ID,
        hasBusinessId: !!process.env.META_BUSINESS_ACCOUNT_ID,
      },
    );
    return {
      success: false,
      error: "API da Meta não configurada. Variáveis de ambiente ausentes.",
    };
  }

  void recordWhatsAppLog({
    source: "whatsapp",
    eventType: "send_template_attempt",
    payload: {
      phone,
      normalizedPhone,
      templateName,
      language,
      componentsCount: components.length,
    },
  });

  console.log("[Meta API] Enviando template:", {
    templateName,
    phone,
    normalizedPhone,
    componentsCount: components.length,
  });

  if (!normalizedPhone) {
    void recordWhatsAppLog({
      source: "whatsapp",
      eventType: "send_template_error",
      payload: {
        phone,
        normalizedPhone,
        templateName,
        error: "Telefone inválido para envio.",
      },
    });

    return {
      success: false,
      error: "Telefone inválido para envio.",
    };
  }

  try {
    const phoneNumberId = config.phoneNumberId;
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: language },
          components,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Meta API] Erro no template:", data);
      void recordWhatsAppLog({
        source: "whatsapp",
        eventType: "send_template_error",
        payload: {
          phone,
          normalizedPhone,
          templateName,
          response: data,
        },
      });
      return {
        success: false,
        error: data.error?.message || "Erro ao enviar template",
      };
    }

    console.log("[Meta API] Template enviado com sucesso:", {
      messageId: data.messages?.[0]?.id,
    });
    void recordWhatsAppLog({
      source: "whatsapp",
      eventType: "send_template_success",
      payload: {
        phone,
        normalizedPhone,
        templateName,
        messageId: data.messages?.[0]?.id || null,
      },
    });
    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    console.error("[Meta API] Exceção:", error);
    void recordWhatsAppLog({
      source: "whatsapp",
      eventType: "send_template_exception",
      payload: {
        phone,
        normalizedPhone,
        templateName,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Envia mensagem para grupo (requer API Business avançada)
 * Nota: A API oficial da Meta não suporta envio para grupos diretamente.
 * Esta função é um placeholder para futura implementação via workaround.
 */
export async function sendWhatsAppGroupMessage(
  _groupId: string,
  _message: string,
  _sessionName?: string,
): Promise<MetaMessageResult> {
  void _groupId;
  void _message;
  void _sessionName;
  console.warn(
    "[Meta API] Envio para grupos não é suportado pela API oficial.",
  );
  return {
    success: false,
    error: "Envio para grupos não suportado pela API da Meta",
  };
}

/**
 * Envia mensagem com lista de opções (requer template aprovado)
 */
export async function sendWhatsAppList(
  _phone: string,
  _listData: {
    header?: string;
    body: string;
    footer?: string;
    action: {
      button: string;
      sections: Array<{
        title: string;
        rows: Array<{ id: string; title: string; description?: string }>;
      }>;
    };
  },
): Promise<MetaMessageResult> {
  void _phone;
  void _listData;
  const config = getMetaConfig();

  if (!config) {
    console.log("[Meta API] Lista não enviada - API não configurada");
    return { success: true };
  }

  // Implementação futura com templates aprovados
  console.warn(
    "[Meta API] Envio de listas requer template aprovado. Implementação pendente.",
  );
  return {
    success: false,
    error: "Funcionalidade de listas requer implementação com templates",
  };
}

/**
 * Envia enquete (requer template aprovado)
 */
export async function sendWhatsAppPoll(
  _phone: string,
  _question: string,
  _options: string[],
): Promise<MetaMessageResult> {
  void _phone;
  void _question;
  void _options;
  const config = getMetaConfig();

  if (!config) {
    console.log("[Meta API] Enquete não enviada - API não configurada");
    return { success: true };
  }

  console.warn(
    "[Meta API] Envio de enquetes requer template aprovado. Implementação pendente.",
  );
  return {
    success: false,
    error: "Funcionalidade de enquetes requer implementação com templates",
  };
}

/**
 * Busca status da conexão com a Meta API.
 * A API da Meta é stateless; retorna "aberto" se configurada.
 */
export async function getMetaConnectionStatus(): Promise<{
  state: "open" | "close";
  isConnected: boolean;
}> {
  const config = getMetaConfig();

  if (config) {
    return { state: "open", isConnected: true };
  }

  return { state: "close", isConnected: false };
}

/**
 * Tipos de rate limiting da Meta API
 * - Business: 1000 requests/segundo
 * - Phone number: 80 messages/segundo
 * - Template: 1000 messages/segundo
 */
export const META_RATE_LIMITS = {
  business: 1000,
  phoneNumber: 80,
  template: 1000,
} as const;

/**
 * Níveis de tier de mensagens da Meta
 * - Tier 1: 1K mensagens/24h (padrão)
 * - Tier 2: 10K mensagens/24h
 * - Tier 3: 100K mensagens/24h
 * - Tier 4: Ilimitado
 */
export type MetaMessageTier = "tier_1" | "tier_2" | "tier_3" | "tier_4";

export const META_TIERS: Record<MetaMessageTier, number> = {
  tier_1: 1000,
  tier_2: 10000,
  tier_3: 100000,
  tier_4: Infinity,
} as const;
