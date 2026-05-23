"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  AlertTriangle,
  Info,
  AlertCircle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Search,
  MessageCircle,
  User as UserIcon,
  Settings,
  LayoutDashboard,
  FileText,
  DollarSign,
  Users,
  Truck,
  UserSquare2,
  Building,
  Handshake,
  UserCheck,
  Building2,
  Percent,
  History,
  Calendar as CalendarIcon,
  X,
  Edit2,
  Archive,
  RotateCcw,
} from "lucide-react";

interface SystemLogEntry {
  id: string;
  user_id: string | null;
  user?: { nome: string } | null;
  error_level: "info" | "warning" | "error" | "critical";
  component: string | null;
  function_name: string | null;
  error_message: string | null;
  error_stack: string | null;
  error_details: Record<string, unknown> | null;
  url: string | null;
  user_agent: string | null;
  created_at: string;
}

interface WhatsAppLogEntry {
  id: string;
  source: string;
  event_type: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface UserProfile {
  id: string;
  nome: string;
}

type LogSource = "system" | "whatsapp";

type LogEntry = {
  id: string;
  source: LogSource;
  created_at: string;
  title: string;
  summary: string;
  detail?: string;
  result?: string;
  userName?: string;
  level?: "info" | "warning" | "error" | "critical";
  component?: string | null;
  function_name?: string | null;
  error_message?: string | null;
  error_stack?: string | null;
  error_details?: Record<string, unknown> | null;
  url?: string | null;
  user_agent?: string | null;
  payload?: Record<string, unknown> | null;
};

interface LogsResponse {
  logs: SystemLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

type TabType = "sistema" | "whatsapp";

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const TABS: TabConfig[] = [
  {
    id: "sistema",
    label: "Sistema",
    icon: <AlertCircle size={16} />,
    color: "text-blue-600",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: <MessageCircle size={16} />,
    color: "text-green-600",
  },
];

const LEVEL_COLORS = {
  info: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: Info },
  warning: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", icon: AlertTriangle },
  error: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: XCircle },
  critical: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: AlertCircle },
};

export default function LogsViewer() {
  const [activeTab, setActiveTab] = useState<TabType>("sistema");
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppLogEntry[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE = 50;

  const fetchLogs = useCallback(async (tab?: TabType) => {
    const targetTab = tab || activeTab;
    setLoading(true);
    try {
      if (targetTab === "sistema") {
        const offset = (currentPage - 1) * PAGE_SIZE;
        const systemParams = new URLSearchParams({
          limit: PAGE_SIZE.toString(),
          offset: offset.toString(),
        });

        if (searchTerm) {
          systemParams.append("component", searchTerm);
        }

        if (selectedUserId !== "all") {
          systemParams.append("userId", selectedUserId);
        }

        if (startDate) {
          systemParams.append("startDate", startDate);
        }

        if (endDate) {
          systemParams.append("endDate", endDate);
        }

        const systemResponse = await fetch(`/api/frontend-logs/list?${systemParams}`);
        const systemData: LogsResponse = await systemResponse.json();
        setSystemLogs(systemData.logs || []);
        setTotalRecords(systemData.total || 0);
      } else if (targetTab === "whatsapp") {
        const whatsappResponse = await fetch("/api/whatsapp-logs");
        const whatsappData = (await whatsappResponse.json()) as
          | WhatsAppLogEntry[]
          | { error?: string };
        setWhatsappLogs(Array.isArray(whatsappData) ? whatsappData : []);
      }
    } catch (error) {
      console.error("Erro ao buscar logs:", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchTerm, selectedUserId, currentPage, startDate, endDate]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/presence/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data || []);
      }
    } catch (error) {
      console.error("Erro ao buscar usuários para filtro:", error);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchLogs();
  }, [activeTab, selectedUserId, fetchLogs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedUserId, startDate, endDate]);

  useEffect(() => {
    if (activeTab !== "sistema") return;

    const timer = window.setTimeout(() => {
      void fetchLogs();
    }, 10000);

    return () => window.clearTimeout(timer);
  }, [activeTab, fetchLogs]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      void fetchLogs();
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, fetchLogs]);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedLogs(newExpanded);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatSummary = (summary: string, errorDetails?: Record<string, unknown> | null): React.ReactNode => {
    const pageMap: Record<string, { icon: React.ReactNode; name: string; color: string }> = {
      "/portal/dashboard": { icon: <LayoutDashboard size={12} />, name: "Dashboard", color: "bg-purple-50 text-purple-700" },
      "/portal/os": { icon: <FileText size={12} />, name: "Ordem de Serviço", color: "bg-blue-50 text-blue-700" },
      "/portal/financeiro": { icon: <DollarSign size={12} />, name: "Medição Financeira", color: "bg-green-50 text-green-700" },
      "/portal/motoristas": { icon: <Users size={12} />, name: "Motoristas", color: "bg-orange-50 text-orange-700" },
      "/portal/veiculos": { icon: <Truck size={12} />, name: "Veículos", color: "bg-indigo-50 text-indigo-700" },
      "/portal/passageiros": { icon: <UserSquare2 size={12} />, name: "Passageiros", color: "bg-pink-50 text-pink-700" },
      "/portal/clientes": { icon: <Building size={12} />, name: "Clientes", color: "bg-cyan-50 text-cyan-700" },
      "/portal/parcerias": { icon: <Handshake size={12} />, name: "Parceiros de Serviço", color: "bg-amber-50 text-amber-700" },
      "/portal/config": { icon: <Settings size={12} />, name: "Configurações", color: "bg-slate-50 text-slate-700" },
    };

    for (const [pathname, config] of Object.entries(pageMap)) {
      if (summary === `Acesso à página: ${pathname}`) {
        return (
          <>
            Acessou a página{" "}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-xs uppercase tracking-wider ${config.color}`}>
              {config.icon}
              {config.name}
            </span>
          </>
        );
      }
    }

    if (summary === "Dados básicos carregados (empresas, solicitantes, motoristas, imposto)" && errorDetails) {
      const details = errorDetails as Record<string, unknown>;
      const clientes = typeof details.clientes === "number" ? details.clientes : 0;
      const solicitantes = typeof details.solicitantes === "number" ? details.solicitantes : 0;
      const drivers = typeof details.drivers === "number" ? details.drivers : 0;
      const impostoPercentual = typeof details.impostoPercentual === "number" ? details.impostoPercentual : 0;

      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">Dados básicos carregados:</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded-md font-bold text-xs">
            <Building2 size={12} />
            {clientes} empresas
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md font-bold text-xs">
            <UserCheck size={12} />
            {solicitantes} solicitantes
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-bold text-xs">
            <Users size={12} />
            {drivers} motoristas
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-md font-bold text-xs">
            <Percent size={12} />
            {impostoPercentual}% imposto
          </span>
        </div>
      );
    }

    if (summary === "Dados complementares carregados (passageiros, parceiros, contagens de OS)" && errorDetails) {
      const details = errorDetails as Record<string, unknown>;
      const passageiros = typeof details.passageiros === "number" ? details.passageiros : 0;
      const parceiros = typeof details.parceiros === "number" ? details.parceiros : 0;
      const osCounts = typeof details.osCounts === "object" ? details.osCounts as Record<string, unknown> : null;

      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">Dados complementares carregados:</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-pink-50 text-pink-700 rounded-md font-bold text-xs">
            <UserSquare2 size={12} />
            {passageiros} passageiros
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md font-bold text-xs">
            <Handshake size={12} />
            {parceiros} parceiros
          </span>
          {osCounts && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-bold text-xs">
              <FileText size={12} />
              {Object.values(osCounts).reduce((sum: number, val) => sum + (typeof val === "number" ? val : 0), 0)} OS totais
            </span>
          )}
        </div>
      );
    }

    if (summary === "Histórico de logs aberto") {
      return (
        <>
          Acessou módulo{" "}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-700 rounded-md font-bold text-xs uppercase tracking-wider">
            <History size={12} />
            Histórico de logs
          </span>
        </>
      );
    }

    // Formatar logs de calendário
    if (summary.startsWith("Calendário carregado:")) {
      const match = summary.match(/Calendário carregado: (\d+) OS no período ([\d-]+) a ([\d-]+)(?: \((.+)\))?/);
      if (match && errorDetails) {
        const [, count, from, to, extra] = match;
        const fromDate = new Date(from);
        const toDate = new Date(to);
        const formatDate = (date: Date) => date.toLocaleDateString("pt-BR");

        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Calendário carregado:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-bold text-xs">
              <CalendarIcon size={12} />
              {count} OS
            </span>
            <span className="text-xs text-slate-500">de</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-md font-bold text-xs">
              {formatDate(fromDate)}
            </span>
            <span className="text-xs text-slate-500">até</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-md font-bold text-xs">
              {formatDate(toDate)}
            </span>
            {extra && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md font-bold text-xs">
                {extra}
              </span>
            )}
          </div>
        );
      }
    }

    // Formatar logs de tabela
    if (summary.startsWith("Tabela carregada:")) {
      const match = summary.match(/Tabela carregada: página (\d+), (\d+) OS totais(?: \(filtros: (.+)\))?/);
      if (match) {
        const [, page, total, filters] = match;

        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Tabela carregada:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md font-bold text-xs">
              Página {page}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-bold text-xs">
              <FileText size={12} />
              {total} OS
            </span>
            {filters && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-bold text-xs">
                Filtros: {filters}
              </span>
            )}
          </div>
        );
      }
    }

    // Formatar logs de visualização de OS
    if (summary.startsWith("Abriu visualização da OS protocolo")) {
      const match = summary.match(/Abriu visualização da OS protocolo (\d+)/);
      if (match) {
        const [, protocolo] = match;

        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Abriu visualização da OS</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-bold text-xs">
              <FileText size={12} />
              Protocolo {protocolo}
            </span>
          </div>
        );
      }
    }

    // Formatar logs de visualização via notificação
    if (summary.startsWith("Abriu visualização via notificação")) {
      const match = summary.match(/Abriu visualização via notificação: protocolo (\d+)/);
      if (match) {
        const [, protocolo] = match;

        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Visualização via notificação</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-bold text-xs">
              <FileText size={12} />
              Protocolo {protocolo}
            </span>
          </div>
        );
      }
    }

    // Formatar logs de visualização via URL
    if (summary.startsWith("Abriu visualização via URL")) {
      const match = summary.match(/Abriu visualização via URL: protocolo (\d+)/);
      if (match) {
        const [, protocolo] = match;

        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Visualização via URL</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-bold text-xs">
              <FileText size={12} />
              Protocolo {protocolo}
            </span>
          </div>
        );
      }
    }

    // Formatar logs de edição de OS
    if (summary.startsWith("Abriu edição da OS protocolo")) {
      const match = summary.match(/Abriu edição da OS protocolo (\d+)/);
      if (match) {
        const [, protocolo] = match;

        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Abriu edição da OS</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md font-bold text-xs">
              <Edit2 size={12} />
              Protocolo {protocolo}
            </span>
          </div>
        );
      }
    }

    // Formatar logs de arquivo/desarquivo
    if (summary.startsWith("Arquivou OS protocolo")) {
      const match = summary.match(/Arquivou OS protocolo (\d+)/);
      if (match) {
        const [, protocolo] = match;

        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Arquivou OS</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded-md font-bold text-xs">
              <Archive size={12} />
              Protocolo {protocolo}
            </span>
          </div>
        );
      }
    }

    if (summary.startsWith("Desarquivou OS protocolo")) {
      const match = summary.match(/Desarquivou OS protocolo (\d+)/);
      if (match) {
        const [, protocolo] = match;

        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Desarquivou OS</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-md font-bold text-xs">
              <RotateCcw size={12} />
              Protocolo {protocolo}
            </span>
          </div>
        );
      }
    }

    return summary;
  };

  const formatSystemLog = (log: SystemLogEntry): LogEntry => ({
    id: log.id,
    source: "system",
    created_at: log.created_at,
    title: log.component || "Sistema",
    summary: log.error_message || "Sem mensagem de erro",
    detail: log.function_name || undefined,
    userName: log.user?.nome || "Sistema",
    level: log.error_level,
    component: log.component,
    function_name: log.function_name,
    error_message: log.error_message,
    error_stack: log.error_stack,
    error_details: log.error_details,
    url: log.url,
    user_agent: log.user_agent,
  });

  const getValue = (payload: Record<string, unknown>, keys: string[]): string => {
    let current: unknown = payload;
    for (const key of keys) {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        return "";
      }
      current = (current as Record<string, unknown>)[key];
    }
    return typeof current === "string" ? current : "";
  };

  const formatWhatsAppLog = (log: WhatsAppLogEntry): LogEntry => {
    const payload = log.payload || {};
    const eventType = log.event_type || "sem_evento";
    const phone =
      getValue(payload, ["normalizedPhone"]) ||
      getValue(payload, ["phone"]) ||
      getValue(payload, ["to"]) ||
      getValue(payload, ["recipient_id"]);
    const templateName = getValue(payload, ["templateName"]);
    const buttonText = getValue(payload, ["buttonText"]);
    const errorMessage = getValue(payload, ["error"]);
    const messageId = getValue(payload, ["messageId"]);

    const summaryMap: Record<string, string> = {
      webhook_payload: "Webhook bruto recebido da Meta",
      message_received: `Mensagem recebida${phone ? ` de ${phone}` : ""}`,
      message_duplicate_ignored: `Mensagem duplicada ignorada${messageId ? ` (${messageId})` : ""}`,
      flow_completed_detected: `Flow completado detectado${phone ? ` — ${phone}` : ""}`,
      button_interactive_detected: `Botão interativo${buttonText ? ` — ${buttonText}` : ""}`,
      quick_reply_detected: `Quick reply${buttonText ? ` — ${buttonText}` : ""}`,
      details_requested: `Detalhes solicitados${phone ? ` — ${phone}` : ""}`,
      text_context_detected: "Texto com contexto detectado",
      message_unhandled: `Mensagem não tratada${getValue(payload, ["msgType"]) ? ` — ${getValue(payload, ["msgType"])} ` : ""}`,
      send_message_attempt: `Envio de mensagem${phone ? ` para ${phone}` : ""}`,
      send_message_success: `Mensagem enviada${phone ? ` para ${phone}` : ""}`,
      send_message_error: `Falha ao enviar mensagem${phone ? ` para ${phone}` : ""}`,
      send_message_exception: `Exceção ao enviar mensagem${phone ? ` para ${phone}` : ""}`,
      send_template_success: `Template ${templateName || "não informado"} enviado`,
      send_template_error: `Falha ao enviar template ${templateName || "não informado"}`,
      send_template_exception: `Exceção ao enviar template ${templateName || "não informado"}`,
    };

    const title = log.source === "meta-webhook" ? "Webhook Meta" : "Envio WhatsApp";

    return {
      id: log.id,
      source: "whatsapp",
      created_at: log.created_at,
      title,
      summary: summaryMap[eventType] || eventType,
      detail:
        errorMessage || templateName || getValue(payload, ["contextId"]) || eventType,
      result: eventType.includes("error") || eventType.includes("exception") ? "Erro" : "Info",
      payload,
    };
  };

  const normalizedSystemLogs = systemLogs.map(formatSystemLog);
  const normalizedWhatsappLogs = whatsappLogs.map(formatWhatsAppLog);

  const baseLogs = activeTab === "whatsapp" ? normalizedWhatsappLogs : normalizedSystemLogs;

  const filteredLogs = baseLogs.filter((log) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [
      log.title,
      log.summary,
      log.detail || "",
      log.component || "",
      log.function_name || "",
      log.error_message || "",
      log.result || "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  const systemCount = systemLogs.length;
  const whatsappCount = whatsappLogs.length;

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-wider">
            Histórico de Logs
          </h2>
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wider transition-all ${
                activeTab === tab.id
                  ? "bg-[var(--color-geolog-blue)] text-white shadow-md"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-white/20">
                {tab.id === "sistema" ? systemCount : whatsappCount}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por componente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {activeTab === "sistema" && (
            <>
              <div className="relative w-full md:w-64">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                >
                  <option value="all">Todos Usuários</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>

              <div className="flex items-center gap-2 w-full lg:w-auto">
                <div className="relative flex-1">
                  <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <span className="text-slate-400 font-bold">→</span>
                <div className="relative flex-1">
                  <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                    }}
                    className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 hover:bg-red-100 transition-colors"
                    title="Limpar filtro de data"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Logs List */}
      <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-4 text-slate-400">
            <RefreshCw size={48} className="text-blue-500 animate-spin" />
            <p className="font-bold text-lg text-slate-500">Carregando logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center gap-4 text-slate-400">
            <AlertCircle size={64} className="text-slate-300" />
            <p className="font-bold text-lg">
              Nenhum log {activeTab === "whatsapp" ? "de WhatsApp" : "de sistema"} encontrado.
            </p>
            {activeTab === "sistema" && (
              <p className="text-sm text-slate-500 max-w-md text-center">
                Ainda não há logs de sistema gravados. Abra a aba Histórico, aguarde alguns segundos ou provoque uma ação no sistema para gerar eventos.
              </p>
            )}
          </div>
        ) : (
          filteredLogs.map((log) => {
            const levelConfig = log.level ? LEVEL_COLORS[log.level] : LEVEL_COLORS.info;
            const LevelIcon = levelConfig.icon;
            const isExpanded = expandedLogs.has(log.id);

            return (
              <div
                key={log.id}
                className={`p-4 hover:bg-slate-50/50 transition-colors ${
                  isExpanded ? "bg-slate-50/50" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Level Icon */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-xl ${levelConfig.bg} ${levelConfig.border} border flex items-center justify-center`}
                  >
                    <LevelIcon size={20} className={levelConfig.text} />
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-wider ${levelConfig.bg} ${levelConfig.text}`}
                      >
                        {log.level || log.result || "info"}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {log.title}
                      </span>
                      {log.detail && (
                        <span className="text-xs font-medium text-slate-400">
                          / {log.detail}
                        </span>
                      )}
                      {log.userName && (
                        <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                          <UserIcon size={10} />
                          {log.userName}
                        </span>
                      )}
                    </div>

                    {log.summary && (
                      <p className="text-sm font-semibold text-slate-700 mb-1">
                        {formatSummary(log.summary, log.error_details)}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="font-bold">{formatTimestamp(log.created_at)}</span>
                      {log.url && (
                        <span>{log.url}</span>
                      )}
                    </div>
                  </div>

                  {/* Expand Button */}
                  {(log.error_stack || log.error_details || log.payload) && (
                    <button
                      onClick={() => toggleExpand(log.id)}
                      className="flex-shrink-0 p-2 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-slate-500" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-500" />
                      )}
                    </button>
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 ml-14 space-y-3">
                    {log.error_stack && (
                      <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                        <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">
                          {log.error_stack}
                        </pre>
                      </div>
                    )}
                    {log.error_details && (
                      <div className="bg-slate-100 rounded-xl p-4">
                        <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">
                          Detalhes Adicionais
                        </p>
                        <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap">
                          {JSON.stringify(log.error_details, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.payload && activeTab === "whatsapp" && (
                      <div className="bg-slate-100 rounded-xl p-4">
                        <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">
                          Payload WhatsApp
                        </p>
                        <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50">
        {activeTab === "sistema" && totalRecords > 0 ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              <span className="font-bold uppercase tracking-wider">
                Total: {totalRecords} logs
              </span>
              <span className="font-medium ml-2">
                Página {currentPage} de {Math.ceil(totalRecords / PAGE_SIZE)}
              </span>
              <span className="font-medium ml-2">
                ({Math.min((currentPage - 1) * PAGE_SIZE + 1, totalRecords)}-{Math.min(currentPage * PAGE_SIZE, totalRecords)})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loading}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, Math.ceil(totalRecords / PAGE_SIZE)) }, (_, i) => {
                  let pageNum;
                  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      disabled={loading}
                      className={`w-10 h-10 rounded-lg text-sm font-bold transition-colors ${
                        currentPage === pageNum
                          ? "bg-[var(--color-geolog-blue)] text-white"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(Math.ceil(totalRecords / PAGE_SIZE), prev + 1))}
                disabled={currentPage === Math.ceil(totalRecords / PAGE_SIZE) || loading}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider">
              Total: {activeTab === "whatsapp" ? whatsappCount : systemLogs.length} logs
            </span>
            <span className="font-medium">
              Exibindo: {filteredLogs.length} logs
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
