// Helpers compartilhados entre os dropdowns de notificação do header
// (sino de sistema em portal/layout.tsx e o dropdown de motoristas em
// MotoristaNotifications.tsx) para evitar duplicar lógica de formatação.

export function formatShortName(fullName: string | null | undefined): string {
  if (!fullName) return "";
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1]}`;
}

export function extractNotificationProtocolo(
  message: string,
  metadata?: Record<string, unknown> | null,
): {
  protocolo: string | null;
  cleanMessage: string;
} {
  let cleanMessage = message.replace(/\[OS_ID:[a-f0-9-]+\]/, "").trim();

  // "OS 2026061284 finalizada com sucesso."
  const osPrefixMatch = cleanMessage.match(/^OS\s+(\d{10})\b/);
  if (osPrefixMatch) {
    cleanMessage = cleanMessage
      .replace(osPrefixMatch[1], "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // "A OS 2026051030 foi atualizada por..."
  const osMatch = cleanMessage.match(/A\s+OS\s+(\d+)/);
  if (osMatch) {
    cleanMessage = cleanMessage.replace(osMatch[0], "").trim();
  }

  // "Protocolo #2026061274 foi gerado."
  const protocoloMatch = cleanMessage.match(/Protocolo\s+#?(\d+)/);
  if (protocoloMatch) {
    cleanMessage = cleanMessage.replace(protocoloMatch[0], "").trim();
  }

  // "2026061117" entre aspas
  const quotesMatch = cleanMessage.match(/"(\d{10})"/);
  if (quotesMatch) {
    cleanMessage = cleanMessage.replace(quotesMatch[0], "").trim();
  }

  // Capitaliza primeira letra se necessario
  if (
    cleanMessage.length > 0 &&
    cleanMessage[0] === cleanMessage[0].toLowerCase()
  ) {
    cleanMessage = cleanMessage[0].toUpperCase() + cleanMessage.slice(1);
  }

  const protocolo =
    osPrefixMatch?.[1] ??
    osMatch?.[1] ??
    protocoloMatch?.[1] ??
    quotesMatch?.[1] ??
    (typeof metadata?.protocolo === "string" ? metadata.protocolo : null);
  return { protocolo, cleanMessage };
}

export function timeAgo(date: string, now: number): string {
  const d =
    date.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(date) ? date : date + "Z";
  const diff = Math.max(now - new Date(d).getTime(), 0);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `${minutes} min`;
  if (hours < 24) return `${hours} h`;
  if (days === 1) return "Ontem";
  return `${days} d`;
}
