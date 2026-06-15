/**
 * Validação de payloads do webhook Meta usando Zod
 * Garante type safety e validação em runtime
 */

import { z } from "zod";

// ============================================================================
// Schemas de Validação
// ============================================================================

export const FlowResponseSchema = z.object({
  screen_0_TextInput_0: z.string().optional(),
  km_inicial: z.string().optional(),
  km_final: z.string().optional(),
});

export const MetaWebhookMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.enum([
    "text",
    "interactive",
    "button",
    "image",
    "document",
    "audio",
    "video",
  ]),
  interactive: z
    .object({
      type: z.enum(["button_reply", "list_reply", "nfm_reply"]),
      button_reply: z
        .object({
          id: z.string(),
          title: z.string(),
        })
        .optional(),
      nfm_reply: z
        .object({
          response_json: z.string(),
          body: z.string(),
          name: z.string(),
        })
        .optional(),
    })
    .optional(),
  context: z
    .object({
      from: z.string(),
      id: z.string(),
    })
    .optional(),
});

export const MetaWebhookEntrySchema = z.object({
  id: z.string(),
  changes: z.array(
    z.object({
      value: z.object({
        messaging_product: z.literal("whatsapp"),
        metadata: z.object({
          display_phone_number: z.string(),
          phone_number_id: z.string(),
        }),
        contacts: z
          .array(
            z.object({
              profile: z.object({
                name: z.string(),
              }),
              wa_id: z.string(),
            }),
          )
          .optional(),
        messages: z.array(MetaWebhookMessageSchema).optional(),
        statuses: z.array(z.any()).optional(),
      }),
      field: z.literal("messages"),
    }),
  ),
});

export const MetaWebhookPayloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(MetaWebhookEntrySchema),
});

// ============================================================================
// Types Inferidos
// ============================================================================

export type FlowResponse = z.infer<typeof FlowResponseSchema>;
export type MetaWebhookMessage = z.infer<typeof MetaWebhookMessageSchema>;
export type MetaWebhookEntry = z.infer<typeof MetaWebhookEntrySchema>;
export type MetaWebhookPayload = z.infer<typeof MetaWebhookPayloadSchema>;

// ============================================================================
// Funções de Validação
// ============================================================================

export function validateWebhookPayload(payload: unknown): {
  success: boolean;
  data?: MetaWebhookPayload;
  error?: string;
} {
  try {
    const validated = MetaWebhookPayloadSchema.parse(payload);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation error: ${error.issues.map((e: { path: (string | number)[]; message: string }) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      };
    }
    return { success: false, error: "Unknown validation error" };
  }
}

export function validateFlowResponse(response: unknown): {
  success: boolean;
  data?: FlowResponse;
  error?: string;
} {
  try {
    const validated = FlowResponseSchema.parse(response);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Flow response validation error: ${error.issues.map((e: { path: (string | number)[]; message: string }) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      };
    }
    return { success: false, error: "Unknown validation error" };
  }
}

export function extractKmFromFlowResponse(
  response: FlowResponse,
): number | null {
  // Tentar extrair de diferentes campos possíveis
  const kmStr =
    response.km_inicial ||
    response.km_final ||
    response.screen_0_TextInput_0 ||
    "";

  // Remover caracteres não numéricos (exceto ponto e vírgula)
  const cleaned = kmStr.replace(/[^\d.,]/g, "").replace(",", ".");

  const km = parseFloat(cleaned);

  if (isNaN(km) || km < 0) {
    return null;
  }

  return km;
}
