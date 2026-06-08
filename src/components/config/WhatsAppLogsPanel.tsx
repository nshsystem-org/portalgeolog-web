"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, MessageCircle, RefreshCw, Send } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/DataTable";
import type { WhatsAppLogRow } from "@/lib/whatsapp-logs";

type WhatsAppLogView = {
  id: string;
  created_at: string;
  source: string;
  event_type: string;
  destination: string;
  summary: string;
  result: string;
  payload: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function formatDateTime(value: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function extractNestedValue(
  payload: Record<string, unknown>,
  paths: string[][],
): string {
  for (const path of paths) {
    let current: unknown = payload;

    for (const key of path) {
      if (!isRecord(current)) {
        current = null;
        break;
      }
      current = current[key];
    }

    const candidate = getString(current);
    if (candidate) return candidate;
  }

  return "";
}

function getFromPayload<T>(
  payload: Record<string, unknown>,
  paths: string[][],
): T | null {
  for (const path of paths) {
    let current: unknown = payload;
    for (const key of path) {
      if (!isRecord(current)) {
        current = null;
        break;
      }
      current = current[key];
    }
    if (current !== null && current !== undefined) return current as T;
  }
  return null;
}

function getMetaMessageType(payload: Record<string, unknown>): string | null {
  return getFromPayload<string>(payload, [
    ["entry", "0", "changes", "0", "value", "messages", "0", "type"],
  ]);
}

function getMetaButtonText(payload: Record<string, unknown>): string | null {
  return (
    getFromPayload<string>(payload, [
      [
        "entry",
        "0",
        "changes",
        "0",
        "value",
        "messages",
        "0",
        "button",
        "text",
      ],
    ]) ||
    getFromPayload<string>(payload, [
      [
        "entry",
        "0",
        "changes",
        "0",
        "value",
        "messages",
        "0",
        "button",
        "payload",
      ],
    ])
  );
}

function getMetaStatus(payload: Record<string, unknown>): string | null {
  return getFromPayload<string>(payload, [
    ["entry", "0", "changes", "0", "value", "statuses", "0", "status"],
  ]);
}

function getMetaErrorMessage(payload: Record<string, unknown>): string | null {
  return getFromPayload<string>(payload, [
    [
      "entry",
      "0",
      "changes",
      "0",
      "value",
      "statuses",
      "0",
      "errors",
      "0",
      "title",
    ],
    ["entry", "0", "changes", "0", "value", "errors", "0", "title"],
    ["error", "message"],
  ]);
}

function getMetaErrorCode(payload: Record<string, unknown>): string | null {
  return getFromPayload<string>(payload, [
    [
      "entry",
      "0",
      "changes",
      "0",
      "value",
      "statuses",
      "0",
      "errors",
      "0",
      "code",
    ],
    ["error", "code"],
  ]);
}

function getMetaContextId(payload: Record<string, unknown>): string | null {
  return getFromPayload<string>(payload, [
    ["entry", "0", "changes", "0", "value", "messages", "0", "context", "id"],
  ]);
}

function getMetaProfileName(payload: Record<string, unknown>): string | null {
  return getFromPayload<string>(payload, [
    ["entry", "0", "changes", "0", "value", "contacts", "0", "profile", "name"],
  ]);
}

function buildOldWebhookSummary(payload: Record<string, unknown>): string {
  const msgType = getMetaMessageType(payload);
  const buttonText = getMetaButtonText(payload);
  const status = getMetaStatus(payload);
  const profileName = getMetaProfileName(payload);
  const errorMsg = getMetaErrorMessage(payload);
  const errorCode = getMetaErrorCode(payload);

  if (errorMsg) {
    return `Erro da Meta${errorCode ? ` (${errorCode})` : ""}: ${errorMsg}`;
  }

  if (msgType === "button" && buttonText) {
    return `Botão "${buttonText}" clicado${profileName ? ` por ${profileName}` : ""}`;
  }

  if (msgType === "text") {
    const textBody = getFromPayload<string>(payload, [
      ["entry", "0", "changes", "0", "value", "messages", "0", "text", "body"],
    ]);
    return `Mensagem de texto${textBody ? `: "${textBody.slice(0, 60)}"` : ""}`;
  }

  if (status) {
    const recipient = getFromPayload<string>(payload, [
      ["entry", "0", "changes", "0", "value", "statuses", "0", "recipient_id"],
    ]);
    return `Status "${status.toUpperCase()}"${recipient ? ` para ${recipient}` : ""}`;
  }

  if (msgType) {
    return `Mensagem tipo "${msgType}" recebida`;
  }

  return "Webhook bruto recebido da Meta";
}

function buildOldWebhookDetail(payload: Record<string, unknown>): string {
  const contextId = getMetaContextId(payload);
  const msgId = getFromPayload<string>(payload, [
    ["entry", "0", "changes", "0", "value", "messages", "0", "id"],
  ]);
  const statusId = getFromPayload<string>(payload, [
    ["entry", "0", "changes", "0", "value", "statuses", "0", "id"],
  ]);
  const templateName = getString(payload.templateName);
  const messageId = getString(payload.messageId);

  if (templateName) return `Template: ${templateName}`;
  if (messageId) return `Message ID: ${messageId}`;
  if (msgId) return `Wamid: ${msgId.slice(0, 40)}...`;
  if (statusId) return `Wamid: ${statusId.slice(0, 40)}...`;
  if (contextId) return `Context: ${contextId.slice(0, 40)}...`;
  return "Sem detalhe adicional";
}

function buildSummary(
  eventType: string,
  payload: Record<string, unknown>,
): string {
  const templateName = getString(payload.templateName);
  const messageId = getString(payload.messageId);
  const phone = getString(payload.normalizedPhone) || getString(payload.phone);
  const msgType = getString(payload.msgType);
  const contextId = getString(payload.contextId);
  const buttonText = getString(payload.buttonText);
  const error = getString(payload.error);

  if (eventType === "webhook_payload") {
    return buildOldWebhookSummary(payload);
  }
  if (eventType === "sem_evento") {
    return buildOldWebhookSummary(payload);
  }
  if (eventType === "message_received") {
    return `Mensagem ${msgType || "recebida"} de ${phone || "número não informado"}`;
  }
  if (eventType === "message_duplicate_ignored") {
    return `Mensagem duplicada ignorada${messageId ? ` (${messageId})` : ""}`;
  }
  if (eventType === "flow_completed_detected") {
    return `Flow completado detectado${contextId ? ` — contexto ${contextId}` : ""}`;
  }
  if (eventType === "button_interactive_detected") {
    return `Botão interativo${buttonText ? ` — ${buttonText}` : ""}`;
  }
  if (eventType === "quick_reply_detected") {
    return `Quick reply${buttonText ? ` — ${buttonText}` : ""}`;
  }
  if (eventType === "details_requested") {
    return `Disparo de detalhes (${payload.trigger ? String(payload.trigger) : "whatsapp"})`;
  }
  if (eventType === "text_context_detected") {
    return "Texto com contexto detectado";
  }
  if (eventType === "message_unhandled") {
    return `Mensagem não tratada${msgType ? ` — ${msgType}` : ""}`;
  }
  if (eventType === "send_template_success") {
    return `Template ${templateName || "não informado"} enviado`;
  }
  if (eventType === "send_template_error") {
    return `Falha ao enviar template ${templateName || "não informado"}`;
  }
  if (eventType === "send_template_exception") {
    return `Exceção ao enviar template ${templateName || "não informado"}`;
  }
  if (eventType === "send_message_success") {
    return "Mensagem de texto enviada";
  }
  if (eventType === "send_message_error") {
    return "Falha ao enviar mensagem de texto";
  }
  if (eventType === "send_message_exception") {
    return "Exceção ao enviar mensagem de texto";
  }

  if (error) return error;
  if (templateName) return templateName;
  return eventType;
}

function buildDestination(payload: Record<string, unknown>): string {
  const direct = [
    getString(payload.normalizedPhone),
    getString(payload.phone),
    getString(payload.to),
    getString(payload.recipient_id),
    getString(payload.contextPhone),
  ].find(Boolean);

  if (direct) return direct;

  const nested = extractNestedValue(payload, [
    ["entry", "0", "changes", "0", "value", "messages", "0", "from"],
    ["entry", "0", "changes", "0", "value", "statuses", "0", "recipient_id"],
    ["entry", "0", "changes", "0", "value", "contacts", "0", "wa_id"],
  ]);

  if (nested) return nested;

  const contextFrom = getFromPayload<string>(payload, [
    ["entry", "0", "changes", "0", "value", "messages", "0", "context", "from"],
  ]);

  if (contextFrom) return contextFrom;

  return "";
}

function buildResult(
  eventType: string,
  payload: Record<string, unknown>,
): string {
  if (eventType.includes("success")) return "Sucesso";
  if (eventType.includes("error") || eventType.includes("exception"))
    return "Erro";

  const metaError = getMetaErrorMessage(payload);
  const metaStatus = getMetaStatus(payload);

  if (metaError) return "Erro";
  if (metaStatus === "failed") return "Erro";

  return "Info";
}

function getSourceLabel(source: string): string {
  if (source === "meta-webhook") return "Webhook Meta";
  if (source === "whatsapp") return "Envio WhatsApp";
  return source;
}

function getSourceTone(source: string): string {
  if (source === "meta-webhook")
    return "bg-blue-50 text-blue-700 border-blue-200";
  if (source === "whatsapp")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function getResultTone(result: string): string {
  if (result === "Sucesso")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (result === "Erro") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function normalizeLog(row: WhatsAppLogRow): WhatsAppLogView {
  const payload = isRecord(row.payload) ? row.payload : {};
  const eventType = row.event_type || "sem_evento";

  return {
    id: row.id,
    created_at: row.created_at,
    source: row.source,
    event_type: eventType,
    destination: buildDestination(payload),
    summary: buildSummary(eventType, payload),
    result: buildResult(eventType, payload),
    payload,
  };
}

export function WhatsAppLogsPanel() {
  const [logs, setLogs] = useState<WhatsAppLogView[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch("/api/whatsapp-logs");
      const data = (await res.json()) as WhatsAppLogRow[] | { error?: string };

      if (!res.ok) {
        throw new Error(
          typeof data === "object" && data && "error" in data && data.error
            ? data.error
            : "Não foi possível carregar os logs do WhatsApp.",
        );
      }

      const items = Array.isArray(data) ? data.map(normalizeLog) : [];
      setLogs(items);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro inesperado ao carregar logs.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const stats = useMemo(() => {
    const total = logs.length;
    const incoming = logs.filter((log) => log.source === "meta-webhook").length;
    const outgoing = logs.filter((log) => log.source === "whatsapp").length;
    const errors = logs.filter((log) => log.result === "Erro").length;

    return { total, incoming, outgoing, errors };
  }, [logs]);

  const columns = useMemo<Column<WhatsAppLogView>[]>(
    () => [
      {
        key: "created_at",
        title: "Data",
        width: "180px",
        render: (value: unknown, item: WhatsAppLogView) => (
          <div className="space-y-1">
            <div className="font-bold text-slate-800">
              {formatDateTime(String(value))}
            </div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-[0.2em]">
              {item.id.slice(0, 8)}
            </div>
          </div>
        ),
      },
      {
        key: "source",
        title: "Origem",
        width: "150px",
        render: (value: unknown) => {
          const source = String(value || "");
          return (
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black uppercase tracking-[0.2em] ${getSourceTone(source)}`}
            >
              {source === "whatsapp" ? (
                <Send size={12} />
              ) : (
                <MessageCircle size={12} />
              )}
              {getSourceLabel(source)}
            </span>
          );
        },
      },
      {
        key: "event_type",
        title: "Evento",
        width: "220px",
        render: (value: unknown) => (
          <div className="font-bold text-slate-800">{String(value || "")}</div>
        ),
      },
      {
        key: "destination",
        title: "Destino",
        width: "170px",
        render: (value: unknown) => (
          <div className="font-bold text-slate-700">{String(value || "—")}</div>
        ),
      },
      {
        key: "summary",
        title: "Resumo",
        render: (value: unknown, item: WhatsAppLogView) => {
          const detail =
            item.event_type === "sem_evento" ||
            item.event_type === "webhook_payload"
              ? buildOldWebhookDetail(item.payload)
              : item.payload.templateName
                ? `Template: ${String(item.payload.templateName)}`
                : item.payload.messageId
                  ? `Message ID: ${String(item.payload.messageId)}`
                  : item.payload.contextId
                    ? `Context ID: ${String(item.payload.contextId)}`
                    : "Sem detalhe adicional";
          return (
            <div className="space-y-1">
              <div className="font-bold text-slate-800">
                {String(value || "")}
              </div>
              {detail && detail !== "Sem detalhe adicional" && (
                <div className="text-xs font-medium text-slate-500">
                  {detail}
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: "result",
        title: "Resultado",
        width: "130px",
        align: "center",
        render: (value: unknown, item: WhatsAppLogView) => {
          const result = String(value || "Info");
          return (
            <span
              className={`inline-flex items-center justify-center px-3 py-1.5 rounded-full border text-xs font-black uppercase tracking-[0.2em] ${getResultTone(result)}`}
            >
              {result === "Erro" ? <AlertTriangle size={12} /> : null}
              {item.result}
            </span>
          );
        },
      },
    ],
    [],
  );

  return (
    <DataTable
      data={logs}
      columns={columns}
      loading={isLoading}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Buscar logs do WhatsApp..."
      emptyMessage="Nenhum log de WhatsApp encontrado."
      emptyIcon={<MessageCircle size={48} />}
      actionButton={
        <button
          type="button"
          onClick={() => void loadLogs()}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-600 font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      }
      headerContent={
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-slate-400">
              Total
            </p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {stats.total}
            </p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-blue-500">
              Webhooks
            </p>
            <p className="mt-2 text-2xl font-black text-blue-700">
              {stats.incoming}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-emerald-500">
              Envios
            </p>
            <p className="mt-2 text-2xl font-black text-emerald-700">
              {stats.outgoing}
            </p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-rose-500">
              Erros
            </p>
            <p className="mt-2 text-2xl font-black text-rose-700">
              {stats.errors}
            </p>
          </div>
          {lastUpdatedAt && (
            <p className="col-span-full text-xs font-black uppercase tracking-[0.3em] text-slate-400">
              Última atualização: {formatDateTime(lastUpdatedAt)}
            </p>
          )}
          {error && (
            <div className="col-span-full rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}
        </div>
      }
    />
  );
}
