/**
 * Helpers para webhook: retry, rate limiting, métricas e timeouts
 */

import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "./meta";

// Tipo genérico para resultado de query Supabase
type SupabaseResult<T> = { data: T | null; error: { message: string } | null };

// ============================================================================
// Timeout Helper
// ============================================================================

export function createAbortSignal(timeoutMs: number = 5000): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

// Aceita PromiseLike (inclui PostgrestBuilder do Supabase, que é thenable mas não Promise completo)
export function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number = 5000,
  errorMessage: string = "Operation timed out",
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs),
  );

  return Promise.race([Promise.resolve(promise), timeoutPromise]);
}

// Helper interno para chamadas RPC com timeout, tratando o tipo corretamente
async function callRpc<T>(
  supabase: ReturnType<typeof createClient>,
  fnName: string,
  args: Record<string, unknown>,
  timeoutMs = 5000,
): Promise<SupabaseResult<T>> {
  return withTimeout<SupabaseResult<T>>(
    supabase.rpc(fnName, args as never) as unknown as PromiseLike<SupabaseResult<T>>,
    timeoutMs,
  );
}

// ============================================================================
// Rate Limiting
// ============================================================================

export async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  phone: string,
  eventType: string,
  maxPerMinute: number = 10,
): Promise<{ allowed: boolean; count: number; resetAt: string }> {
  try {
    const { data, error } = await callRpc<{ allowed: boolean; count: number; resetAt: string }>(
      supabase,
      "check_rate_limit",
      { p_phone: phone, p_event_type: eventType, p_max_per_minute: maxPerMinute },
      3000,
    );

    if (error) {
      console.error("[webhook-helpers] Erro ao verificar rate limit:", error);
      return { allowed: true, count: 0, resetAt: new Date().toISOString() };
    }

    return data ?? { allowed: true, count: 0, resetAt: new Date().toISOString() };
  } catch (err) {
    console.error("[webhook-helpers] Timeout ao verificar rate limit:", err);
    return { allowed: true, count: 0, resetAt: new Date().toISOString() };
  }
}

// ============================================================================
// Métricas
// ============================================================================

export async function recordMetric(
  supabase: ReturnType<typeof createClient>,
  eventType: string,
  options: {
    osId?: string;
    phone?: string;
    durationMs?: number;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    // Fire-and-forget (não aguardar resposta)
    supabase
      .rpc("record_webhook_metric", {
        p_event_type: eventType,
        p_os_id: options.osId ?? null,
        p_phone: options.phone ?? null,
        p_duration_ms: options.durationMs ?? null,
        p_success: options.success,
        p_error_message: options.errorMessage ?? null,
        p_metadata: options.metadata ?? null,
      } as never)
      .then((result) => {
        const r = result as SupabaseResult<unknown>;
        if (r.error) {
          console.error("[webhook-helpers] Erro ao registrar métrica:", r.error);
        }
      });
  } catch (err) {
    console.error("[webhook-helpers] Erro ao registrar métrica:", err);
  }
}

// ============================================================================
// Retry de Templates WhatsApp
// ============================================================================

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
}

export async function sendTemplateWithRetry(
  phone: string,
  templateName: string,
  language: string,
  components: Array<Record<string, unknown>>,
  options: RetryOptions = {},
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    backoffMultiplier = 2,
  } = options;

  let lastError: string = "";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await sendWhatsAppTemplate(
        phone,
        templateName,
        language,
        components,
      );

      if (result.success && result.messageId) {
        return { success: true, messageId: result.messageId };
      }

      lastError = result.error || "Unknown error";

      // Se não for erro de rate limit, não tentar novamente
      if (
        !lastError.includes("rate") &&
        !lastError.includes("timeout") &&
        !lastError.includes("429")
      ) {
        break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < maxRetries - 1) {
      const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return { success: false, error: lastError };
}

export async function sendMessageWithRetry(
  phone: string,
  message: string,
  options: RetryOptions = {},
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    backoffMultiplier = 2,
  } = options;

  let lastError: string = "";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await sendWhatsAppMessage(phone, message);

      if (result.success && result.messageId) {
        return { success: true, messageId: result.messageId };
      }

      lastError = result.error || "Unknown error";

      if (
        !lastError.includes("rate") &&
        !lastError.includes("timeout") &&
        !lastError.includes("429")
      ) {
        break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < maxRetries - 1) {
      const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return { success: false, error: lastError };
}

// ============================================================================
// Fila de Retry (Fallback para mensagens que falharam)
// ============================================================================

export async function enqueuePendingMessage(
  supabase: ReturnType<typeof createClient>,
  phone: string,
  messageType: "template" | "text",
  options: {
    osId?: string;
    templateName?: string;
    templateComponents?: Array<Record<string, unknown>>;
    messageText?: string;
    maxRetries?: number;
  },
): Promise<void> {
  try {
    const nextRetryAt = new Date(Date.now() + 60000); // 1 minuto

    await supabase.from("pending_whatsapp_messages").insert({
      phone,
      message_type: messageType,
      template_name: options.templateName ?? null,
      template_components: options.templateComponents ?? null,
      message_text: options.messageText ?? null,
      os_id: options.osId ?? null,
      max_retries: options.maxRetries ?? 3,
      next_retry_at: nextRetryAt.toISOString(),
      status: "pending",
    } as never);

    console.log(
      "[webhook-helpers] Mensagem enfileirada para retry:",
      phone,
      messageType,
    );
  } catch (err) {
    console.error("[webhook-helpers] Erro ao enfileirar mensagem:", err);
  }
}

// ============================================================================
// Idempotência de Flow Events
// ============================================================================

export async function checkAndClaimFlowEvent(
  supabase: ReturnType<typeof createClient>,
  contextId: string,
  flowType: "start" | "finish",
  osId: string,
  cycleIndex: number,
  kmValue?: number,
  payload?: Record<string, unknown>,
): Promise<{ success: boolean; alreadyProcessed: boolean; eventId?: string }> {
  try {
    const { data, error } = await callRpc<{
      success: boolean;
      alreadyProcessed: boolean;
      eventId?: string;
    }>(
      supabase,
      "check_and_claim_flow_event",
      {
        p_context_id: contextId,
        p_flow_type: flowType,
        p_os_id: osId,
        p_cycle_index: cycleIndex,
        p_km_value: kmValue ?? null,
        p_payload: payload ?? null,
      },
      3000,
    );

    if (error) {
      console.error("[webhook-helpers] Erro ao verificar idempotência:", error);
      return { success: false, alreadyProcessed: false };
    }

    return data ?? { success: false, alreadyProcessed: false };
  } catch (err) {
    console.error("[webhook-helpers] Timeout ao verificar idempotência:", err);
    return { success: false, alreadyProcessed: false };
  }
}

// ============================================================================
// Processamento Atômico de KM
// ============================================================================

export async function processKmStart(
  supabase: ReturnType<typeof createClient>,
  osId: string,
  cycleIndex: number,
  kmInitial: number,
  actorName: string,
  messageId?: string,
): Promise<{
  success: boolean;
  updatedCycles?: unknown;
  statusOperacional?: string;
  error?: string;
}> {
  try {
    const { data, error } = await callRpc<{
      success: boolean;
      updatedCycles?: unknown;
      statusOperacional?: string;
      error?: string;
    }>(
      supabase,
      "process_driver_km_start",
      {
        p_os_id: osId,
        p_cycle_index: cycleIndex,
        p_km_initial: kmInitial,
        p_actor_name: actorName,
        p_message_id: messageId ?? null,
      },
      5000,
    );

    if (error) {
      console.error("[webhook-helpers] Erro ao processar KM inicial:", error);
      return { success: false, error: error.message };
    }

    return data ?? { success: false, error: "No data returned" };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[webhook-helpers] Timeout ao processar KM inicial:", err);
    return { success: false, error: errorMsg };
  }
}

// ============================================================================
// Odômetro Global do Veículo
// ============================================================================

export async function validateVehicleKm(
  supabase: ReturnType<typeof createClient>,
  veiculoId: string,
  osId: string,
  kmValue: number,
  kmType: "initial" | "final",
  driverName?: string,
): Promise<{
  success: boolean;
  error?: string;
  currentKm?: number;
  currentKmType?: string;
  previousKm?: number;
}> {
  try {
    const { data, error } = await callRpc<{
      success: boolean;
      error?: string;
      message?: string;
      currentKm?: number;
      currentKmType?: string;
      previousKm?: number;
      rejectedKm?: number;
    }>(
      supabase,
      "validate_and_update_vehicle_km",
      {
        p_veiculo_id: veiculoId,
        p_os_id: osId,
        p_km_value: kmValue,
        p_km_type: kmType,
        p_driver_name: driverName ?? null,
        p_recorded_via: "webhook",
      },
      5000,
    );

    if (error) {
      console.error("[webhook-helpers] Erro ao validar odômetro do veículo:", error);
      return { success: false, error: error.message };
    }

    return data ?? { success: false, error: "No data returned from odometer RPC" };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[webhook-helpers] Timeout ao validar odômetro:", err);
    return { success: false, error: errorMsg };
  }
}

export async function processKmFinish(
  supabase: ReturnType<typeof createClient>,
  osId: string,
  cycleIndex: number,
  kmFinal: number,
  actorName: string,
  validateKm: boolean = true,
): Promise<{
  success: boolean;
  hasNextCycle?: boolean;
  nextCycle?: unknown;
  updatedCycles?: unknown;
  statusOperacional?: string;
  error?: string;
  kmInitial?: number;
  kmFinal?: number;
}> {
  try {
    const { data, error } = await callRpc<{
      success: boolean;
      hasNextCycle?: boolean;
      nextCycle?: unknown;
      updatedCycles?: unknown;
      statusOperacional?: string;
      error?: string;
      kmInitial?: number;
      kmFinal?: number;
    }>(
      supabase,
      "process_driver_km_finish",
      {
        p_os_id: osId,
        p_cycle_index: cycleIndex,
        p_km_final: kmFinal,
        p_actor_name: actorName,
        p_validate_km: validateKm,
      },
      5000,
    );

    if (error) {
      console.error("[webhook-helpers] Erro ao processar KM final:", error);
      return { success: false, error: error.message };
    }

    return data ?? { success: false, error: "No data returned" };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[webhook-helpers] Timeout ao processar KM final:", err);
    return { success: false, error: errorMsg };
  }
}
