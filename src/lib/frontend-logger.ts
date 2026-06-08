/**
 * Utilitário para enviar logs de erro do frontend para o Supabase
 */

type LogLevel = "info" | "warning" | "error" | "critical";

interface LogEntry {
  errorLevel: LogLevel;
  component?: string;
  functionName?: string;
  errorMessage?: string;
  errorStack?: string;
  errorDetails?: Record<string, unknown>;
  url?: string;
  userAgent?: string;
}

/**
 * Envia um log de erro para o Supabase
 * Usa fetch sem await para não bloquear a execução
 */
export async function logError(entry: LogEntry): Promise<void> {
  try {
    const url =
      entry.url ||
      (typeof window !== "undefined" ? window.location.href : undefined);
    const userAgent =
      entry.userAgent ||
      (typeof navigator !== "undefined" ? navigator.userAgent : undefined);

    await fetch("/api/frontend-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...entry,
        url,
        userAgent,
      }),
    }).catch((e) => {
      // Se falhar ao enviar o log, apenas loga no console
      console.error("Falha ao enviar log para Supabase:", e);
    });
  } catch (error) {
    // Se houver erro no processo de logging, não quebra a aplicação
    console.error("Erro ao processar log de erro:", error);
  }
}

/**
 * Wrapper para logar erros de forma assíncrona (non-blocking)
 */
export function logErrorAsync(entry: LogEntry): void {
  // Executa sem await para não bloquear
  logError(entry).catch(() => {
    // Silencia erros do processo de logging
  });
}

/**
 * Log de nível INFO
 */
export function logInfo(
  component: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  logErrorAsync({
    errorLevel: "info",
    component,
    errorMessage: message,
    errorDetails: details,
  });
}

/**
 * Log de nível WARNING
 */
export function logWarning(
  component: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  logErrorAsync({
    errorLevel: "warning",
    component,
    errorMessage: message,
    errorDetails: details,
  });
}

/**
 * Log de nível ERROR
 */
export function logErrorEntry(
  component: string,
  message: string,
  error?: Error,
  details?: Record<string, unknown>,
): void {
  logErrorAsync({
    errorLevel: "error",
    component,
    errorMessage: message,
    errorStack: error?.stack,
    errorDetails: {
      ...details,
      errorName: error?.name,
      errorMessage: error?.message,
    },
  });
}

/**
 * Log de nível CRITICAL
 */
export function logCritical(
  component: string,
  message: string,
  error?: Error,
  details?: Record<string, unknown>,
): void {
  logErrorAsync({
    errorLevel: "critical",
    component,
    errorMessage: message,
    errorStack: error?.stack,
    errorDetails: {
      ...details,
      errorName: error?.name,
      errorMessage: error?.message,
    },
  });
}

/**
 * Log de acesso à página
 */
export function logPageView(
  pathname: string,
  details?: Record<string, unknown>,
): void {
  logErrorAsync({
    errorLevel: "info",
    component: "Navigation",
    errorMessage: `Acesso à página: ${pathname}`,
    errorDetails: {
      ...details,
      pathname,
    },
  });
}
