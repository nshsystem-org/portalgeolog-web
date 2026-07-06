"use client";

import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import type { OrderService } from "@/context/DataContext";
import type { DocagemInstance } from "@/lib/supabase/docagem-queries";
import { createNotification } from "@/lib/supabase/queries";
import {
  deriveCyclesOperationalStatus,
  getCycleDisplayStatus,
  isFinalizadoSemValor,
  isOsAtrasadaOuNaoIniciada,
  type CycleOperationalStatus,
} from "@/lib/os-messages";
import {
  Clock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  CircleDashed,
  Loader2,
  Route,
  User,
  MapPin,
  Package,
  ArrowRight,
  FileText,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Briefcase,
  Truck,
  Eye,
  EyeOff,
  Layers,
  Archive,
} from "lucide-react";
import { logInfo } from "@/lib/frontend-logger";
import { getThumbnailUrl } from "@/utils/avatar";

interface Cliente {
  id: string;
  nome: string;
}

interface Driver {
  id: string;
  name: string;
}

type CalendarEventKind =
  | "os"
  | "docagem"
  | "rascunho"
  | "freelance"
  | "divider";

interface EventContentProps {
  os?: OrderService;
  docagem?: DocagemInstance;
  clientes: Cliente[];
  drivers: Driver[];
  creatorAvatarMap?: Map<string, { name: string; avatar?: string }>;
  status: CycleOperationalStatus | "Docagem" | "Divider";
  isDocagemFlag?: boolean;
  eventKind?: CalendarEventKind;
  timeText?: string;
  eventStartStr?: string;
  displayDateTime?: string;
  startTime?: string;
  showArchivedOnly?: boolean;
  isMonthView?: boolean;
  isDayView?: boolean;
  dividerLabel?: string;
  dividerIcon?: typeof Route;
  dividerColor?: string;
}

interface OSCalendarProps {
  osList: OrderService[];
  docagemInstances?: DocagemInstance[];
  clientes: Cliente[];
  drivers: Driver[];
  creatorAvatarMap?: Map<string, { name: string; avatar?: string }>;
  onEventClick: (osId: string, position?: { x: number; y: number }) => void;
  onDocagemEventClick?: (
    instanceId: string,
    position?: { x: number; y: number },
  ) => void;
  loading?: boolean;
  hasLoaded?: boolean;
  showArchivedOnly?: boolean;
  hideStatusLegend?: boolean;
  onRangeChange?: (from: string, to: string) => void;
  docagemListFilter?: "all" | "os" | "docagem" | "rascunho" | "freelance";
  onFilterChange?: (
    filter: "all" | "os" | "docagem" | "rascunho" | "freelance",
  ) => void;
  onArchivedToggle?: () => void;
  onlyMyDrafts?: boolean;
  onToggleMyDrafts?: () => void;
}

type WeekStatus = "Pendente" | "Aguardando" | "Em Rota" | "Finalizado";

const weekStatusOrder: WeekStatus[] = [
  "Pendente",
  "Aguardando",
  "Em Rota",
  "Finalizado",
];

const weekStatusMeta: Record<
  WeekStatus,
  {
    label: string;
    icon: React.ComponentType<{
      size?: number;
      className?: string;
      strokeWidth?: number;
    }>;
    color: string;
    textColor: string;
  }
> = {
  Pendente: {
    label: "Pendente",
    icon: Clock,
    color: "#475569",
    textColor: "#1e293b",
  },
  Aguardando: {
    label: "Aguardando",
    icon: CircleDashed,
    color: "#6366f1",
    textColor: "#312e81",
  },
  "Em Rota": {
    label: "Em Rota",
    icon: Route,
    color: "#0ea5e9",
    textColor: "#0c4a6e",
  },
  Finalizado: {
    label: "Finalizado",
    icon: CheckCircle2,
    color: "#10b981",
    textColor: "#064e3b",
  },
};

type WeekStatusCounts = Record<WeekStatus, number> & {
  hasAlert?: boolean;
  alertCount?: number;
  totalEvents?: number;
  doneEvents?: number;
  allDone?: boolean;
};

const emptyWeekStatusCounts = (): WeekStatusCounts => ({
  Pendente: 0,
  Aguardando: 0,
  "Em Rota": 0,
  Finalizado: 0,
  hasAlert: false,
  alertCount: 0,
  totalEvents: 0,
  doneEvents: 0,
  allDone: false,
});

// Cores por status — backgrounds mais saturados para legibilidade no calendário
const statusColors: Record<
  string,
  {
    bg: string;
    border: string;
    text: string;
    dot: string;
    clockColor?: string;
    iconCircle?: string;
    badgeText?: string;
    badgeBg?: string;
  }
> = {
  Pendente: {
    bg: "#f1f5f9",
    border: "#64748b",
    text: "#1e293b",
    dot: "#cbd5e1",
    clockColor: "#64748b",
    iconCircle: "#475569",
    badgeText: "#475569",
    badgeBg: "#e2e8f0",
  },
  Aguardando: {
    bg: "#dbeafe",
    border: "#1e3a8a",
    text: "#172554",
    dot: "#1e40af",
  },
  "Em Rota": {
    bg: "#e0f6ff",
    border: "#7dd3fc",
    text: "#0c4a6e",
    dot: "#38bdf8",
  },
  Andamento: {
    bg: "#e0f6ff",
    border: "#7dd3fc",
    text: "#0c4a6e",
    dot: "#38bdf8",
  },
  Finalizado: {
    bg: "#d1fae5",
    border: "#059669",
    text: "#064e3b",
    dot: "#047857",
  },
  Cancelado: {
    bg: "#ffe4e6",
    border: "#e11d48",
    text: "#881337",
    dot: "#be123c",
  },
  Rascunho: {
    bg: "rgb(255, 248, 235)",
    border: "rgb(255, 212, 146)",
    text: "#a06418",
    dot: "rgb(220, 193, 158)",
    clockColor: "#a06418",
    iconCircle: "rgb(255, 234, 208)",
    badgeText: "#a06418",
    badgeBg: "rgb(255, 212, 146)",
  },
  Arquivado: {
    bg: "#fee2e2",
    border: "#f87171",
    text: "#dc2626",
    dot: "#ef4444",
    clockColor: "#ef4444",
  },
  Docagem: {
    bg: "#f5f3ff",
    border: "#8b5cf6",
    text: "#5b21b6",
    dot: "#7c3aed",
    clockColor: "#7c3aed",
  },
  "Docagem Andamento": {
    bg: "#ede9fe",
    border: "#7c3aed",
    text: "#4c1d95",
    dot: "#6d28d9",
    clockColor: "#6d28d9",
    iconCircle: "#6d28d9",
    badgeBg: "#e1cdff",
    badgeText: "#3d0a3c",
  },
};

// Mapeamento de tipo de evento → ícone + cor do círculo (canto superior esquerdo)
const typeIcons: Record<
  CalendarEventKind,
  { icon: typeof Route; color: string }
> = {
  os: { icon: Truck, color: "#2563eb" },
  docagem: { icon: Package, color: "#7c3aed" },
  rascunho: { icon: FileText, color: "#a06418" },
  freelance: { icon: Briefcase, color: "#059669" },
  divider: { icon: Route, color: "#64748b" },
};

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    kind: CalendarEventKind;
    os?: OrderService;
    docagem?: DocagemInstance;
    clienteNome: string;
    status: CycleOperationalStatus | "Docagem" | "Divider";
    itineraryLabel?: string;
    itineraryIndex?: number;
    displayDateTime?: string;
    startTime?: string;
    dividerLabel?: string;
    dividerIcon?: typeof Route;
    dividerColor?: string;
  };
};

const parseBrDateToIso = (dateStr?: string): string | undefined => {
  if (!dateStr) return undefined;
  if (dateStr.includes("-")) return dateStr; // já está em ISO
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return dateStr;
};

const formatCalendarDateTime = (
  date?: string,
  time?: string | null,
): string | null => {
  if (!date) return null;

  const normalizedTime = time || null;
  const [hours = "00", minutes = "00"] = normalizedTime
    ? normalizedTime.split(":")
    : ["00", "00"];
  return `${date}T${hours}:${minutes}:00`;
};

const extractTimeFromDateTime = (value?: string | null): string | undefined => {
  if (!value) return undefined;

  const trimmedValue = value.trim();
  if (!trimmedValue) return undefined;

  // Se já é hora pura (HH:MM ou HH:MM:SS), retornar direto
  if (/^\d{2}:\d{2}/.test(trimmedValue)) {
    return trimmedValue.slice(0, 5);
  }

  // Se tem T (ISO datetime), extrair a parte do horário
  if (trimmedValue.includes("T")) {
    const timePart = trimmedValue.split("T")[1];
    if (timePart && /^\d{2}:\d{2}/.test(timePart)) {
      return timePart.slice(0, 5);
    }
  }

  return undefined;
};

const getItineraryLabel = (itineraryIndex: number): string => {
  if (itineraryIndex < 0) {
    return "Retorno";
  }

  return `Itinerário ${itineraryIndex + 1}`;
};

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Componente de Evento Customizado
const EventContent = ({
  os,
  docagem,
  clientes,
  drivers,
  creatorAvatarMap,
  status,
  isDocagemFlag,
  eventKind,
  timeText,
  eventStartStr,
  displayDateTime,
  startTime: propStartTime,
  showArchivedOnly,
  isMonthView,
  isDayView,
  dividerLabel,
  dividerIcon: DividerIcon,
  dividerColor,
}: EventContentProps) => {
  if (eventKind === "divider") {
    const iconColor = dividerColor || "#64748b";
    return (
      <div
        className="fc-divider-event"
        data-period={dividerLabel}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "4px 0",
          margin: "8px 0 4px 0",
          pointerEvents: "none",
          width: "100%",
        }}
      >
        <div
          style={{
            height: "1px",
            flex: 1,
            background: `linear-gradient(90deg, transparent, ${iconColor}55 20%, ${iconColor}55 80%, transparent)`,
          }}
        />
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "10px",
            fontWeight: 900,
            color: iconColor,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            whiteSpace: "nowrap",
            backgroundColor: `${iconColor}15`,
            padding: "3px 10px",
            borderRadius: "6px",
            border: `1px solid ${iconColor}30`,
          }}
        >
          {DividerIcon && (
            <DividerIcon
              size={13}
              strokeWidth={2.5}
              style={{ color: iconColor, flexShrink: 0 }}
            />
          )}
          {dividerLabel}
        </span>
        <div
          style={{
            height: "1px",
            flex: 1,
            background: `linear-gradient(90deg, transparent, ${iconColor}55 20%, ${iconColor}55 80%, transparent)`,
          }}
        />
      </div>
    );
  }

  const isDocagem = isDocagemFlag ?? false;
  const kind: CalendarEventKind = eventKind ?? (isDocagem ? "docagem" : "os");
  const typeIconCfg = typeIcons[kind] || typeIcons.os;
  const TypeIcon = typeIconCfg.icon;
  const displayStatus = showArchivedOnly ? "Arquivado" : status;
  const colors = showArchivedOnly
    ? statusColors["Arquivado"]
    : isDocagem && status === "Andamento"
      ? statusColors["Docagem Andamento"]
      : statusColors[status] || statusColors["Pendente"];

  // Círculo do ícone: docagem pendente/andamento sempre roxo (exceto arquivados)
  const iconCircleColor = showArchivedOnly
    ? colors.iconCircle || colors.dot
    : isDocagem && (status === "Pendente" || status === "Andamento")
      ? "#7c3aed"
      : colors.iconCircle || colors.dot;

  // Cor de fundo do badge de horário: docagem pendente usa cinza escuro (igual OS)
  // Docagem andamento usa roxo escuro
  const docagemClockBg = showArchivedOnly
    ? colors.dot
    : isDocagem && status === "Pendente"
      ? "#475569"
      : isDocagem && status === "Andamento"
        ? "#5a2ca3"
        : iconCircleColor;

  const clienteNome = isDocagem
    ? clientes.find((c) => c.id === docagem?.clienteId)?.nome || "N/A"
    : clientes.find((c) => c.id === os?.clienteId)?.nome || "N/A";

  const firstWaypointHora = os?.rota?.waypoints?.[0]?.hora;

  const explicitTime = isDocagem
    ? extractTimeFromDateTime(docagem?.horarioInicio)
    : extractTimeFromDateTime(propStartTime) ||
      extractTimeFromDateTime(os?.hora) ||
      extractTimeFromDateTime(firstWaypointHora);

  const calendarFallbackTime =
    isMonthView === true
      ? undefined
      : extractTimeFromDateTime(timeText) ||
        extractTimeFromDateTime(eventStartStr) ||
        extractTimeFromDateTime(displayDateTime);

  const startTime = explicitTime || calendarFallbackTime || "--:--";

  const isFinalizado = !showArchivedOnly && status === "Finalizado";
  const temPendencia =
    !showArchivedOnly &&
    os &&
    (isFinalizadoSemValor(os) || isOsAtrasadaOuNaoIniciada(os));

  return (
    <div
      className="fc-event-custom group transition-all duration-200 hover:shadow-md"
      style={{
        backgroundColor: isFinalizado ? "#d3ffef" : colors.bg,
        borderLeft: `4px solid ${isFinalizado ? "#98cdbe" : colors.dot}`,
        padding: isDayView ? "32px 8px 12px 28px" : "28px 4px 5px 24px",
        borderRadius: "12px 8px 8px 12px",
        fontSize: isDayView ? "13px" : "11px",
        lineHeight: "1.4",
        color: colors.text,
        cursor: "pointer",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: isDayView ? "6px" : "2px",
        overflow: "visible",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        position: "relative",
        zIndex: 1,
        transition: "all 0.2s ease-in-out",
      }}
    >
      {/* Círculo com ícone do tipo (canto superior esquerdo) */}
      <div
        style={{
          position: "absolute",
          top: "6px",
          left: "6px",
          width: isDayView ? "28px" : "20px",
          height: isDayView ? "28px" : "20px",
          borderRadius: "50%",
          backgroundColor: showArchivedOnly
            ? colors.iconCircle || colors.dot
            : isFinalizado
              ? "#adead8"
              : status === "Pendente"
                ? "#f9fcff"
                : status === "Aguardando"
                  ? "#f7f9ff"
                  : status === "Rascunho"
                    ? "rgb(255, 234, 208)"
                    : iconCircleColor,
          color: showArchivedOnly
            ? "#ffffff"
            : isFinalizado
              ? "#497563"
              : status === "Pendente"
                ? "#475569"
                : status === "Aguardando"
                  ? "#1e40af"
                  : status === "Rascunho"
                    ? "rgb(177, 118, 90)"
                    : "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
          flexShrink: 0,
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      >
        <TypeIcon
          size={isDayView ? 16 : 12}
          strokeWidth={2.5}
          style={{ flexShrink: 0 }}
        />
      </div>

      {/* Avatar do criador (apenas rascunhos) — ao lado do círculo de identificação */}
      {os?.tipo === "rascunho" && os.createdBy && creatorAvatarMap?.get(os.createdBy)?.avatar && (
        <img
          src={getThumbnailUrl(creatorAvatarMap.get(os.createdBy)!.avatar!, 40) || ""}
          alt={creatorAvatarMap.get(os.createdBy)?.name || "Criador"}
          style={{
            position: "absolute",
            top: "6px",
            left: isDayView ? "40px" : "30px",
            width: isDayView ? "20px" : "16px",
            height: isDayView ? "20px" : "16px",
            borderRadius: "50%",
            objectFit: "cover",
            border: "1.5px solid #fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            zIndex: 2,
            flexShrink: 0,
          }}
        />
      )}

      {/* Badges no canto superior direito */}
      {statusColors[displayStatus] && (
        <span
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            backgroundColor: showArchivedOnly
              ? colors.badgeBg || colors.dot
              : isFinalizado
                ? "#b5eed3"
                : status === "Aguardando"
                  ? "#f7f9ff"
                  : status === "Rascunho"
                    ? "rgb(255, 237, 208)"
                    : colors.badgeBg || colors.dot,
            color: showArchivedOnly
              ? colors.badgeText || "#ffffff"
              : isFinalizado
                ? "#1b3c32"
                : status === "Aguardando"
                  ? "#1e40af"
                  : status === "Rascunho"
                    ? "rgb(151, 100, 34)"
                    : colors.badgeText || "#ffffff",
            padding: "3px 8px",
            borderRadius: "6px",
            fontSize: isDayView ? "9px" : "7px",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            gap: "3px",
          }}
        >
          {displayStatus}
        </span>
      )}

      {/* Linha 1: Cliente */}
      <div
        style={{
          fontWeight: 800,
          textTransform: "uppercase",
          color: "#0f172a",
          whiteSpace: isDayView ? "normal" : "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontSize: isDayView ? "13px" : "11px",
          letterSpacing: "0.01em",
          display: "-webkit-box",
          WebkitLineClamp: isDayView ? 2 : 1,
          WebkitBoxOrient: "vertical",
        }}
      >
        {clienteNome}
      </div>

      {/* Linha 2: Motorista (OS) ou Endereço (Docagem) */}
      {isDocagem ? (
        <div
          style={{
            color: "#475569",
            fontWeight: 700,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontSize: isDayView ? "12px" : "10.5px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <MapPin size={isDayView ? 12 : 8} strokeWidth={3} />
          {docagem?.endereco?.toUpperCase() || "DOCAGEM"}
        </div>
      ) : os?.motorista ? (
        <div
          style={{
            color: "#475569",
            fontWeight: 700,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontSize: isDayView ? "12px" : "10.5px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <User size={isDayView ? 12 : 8} strokeWidth={3} />
          {(() => {
            const partes = (os?.motorista ?? "").trim().split(/\s+/);
            if (partes.length === 1) return partes[0].toUpperCase();
            return `${partes[0]} ${partes[partes.length - 1]}`.toUpperCase();
          })()}
        </div>
      ) : null}

      {/* Linha 3: Solicitante (OS) ou Motorista alocado (Docagem) */}
      {isDocagem ? (
        <div
          style={{
            color: "#475569",
            fontWeight: 600,
            fontSize: isDayView ? "11px" : "8.5px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <div
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              backgroundColor: colors.dot,
            }}
          />
          {(() => {
            if (!docagem?.motoristaId) return "Sem motorista";
            const driverName =
              drivers.find((d) => d.id === docagem.motoristaId)?.name || "";
            if (!driverName) return "Motorista alocado";
            const partes = driverName.trim().split(/\s+/);
            if (partes.length === 1) return partes[0].toUpperCase();
            return `${partes[0]} ${partes[partes.length - 1]}`.toUpperCase();
          })()}
        </div>
      ) : os?.solicitante ? (
        <div
          style={{
            color: "#475569",
            fontWeight: 600,
            fontSize: isDayView ? "11px" : "8.5px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <div
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              backgroundColor: colors.dot,
            }}
          />
          {(os?.solicitante ?? "").toUpperCase()}
        </div>
      ) : null}

      {/* Linha 4: Horários (Docagem) */}
      {isDocagem && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "auto",
            marginBottom: isDayView ? "8px" : "4px",
            paddingTop: isDayView ? "12px" : "6px",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: docagemClockBg,
              color: "#ffffff",
              padding: "3px 10px",
              borderRadius: "8px",
              fontWeight: 800,
              fontSize: isDayView ? "11px" : "10px",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            <Clock size={14} strokeWidth={3} />
            {extractTimeFromDateTime(docagem?.horarioInicio) || "--:--"}
            <ArrowRight size={12} strokeWidth={3} style={{ opacity: 0.8 }} />
            {extractTimeFromDateTime(docagem?.horarioFim) || "--:--"}
          </span>
        </div>
      )}

      {/* Linha 4: Horário (apenas OS) */}
      {!isDocagem && (
        <div
          style={{
            marginTop: "auto",
            paddingTop: isDayView ? "8px" : "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: showArchivedOnly
                ? colors.clockColor || colors.dot
                : status === "Pendente"
                  ? "#475569"
                  : status === "Em Rota"
                    ? "#0284c7"
                    : colors.clockColor || colors.dot,
              color: "#ffffff",
              padding: isDayView ? "5px 12px" : "3px 8px",
              borderRadius: "8px",
              fontWeight: 800,
              fontSize: isDayView ? "12px" : "10px",
              textTransform: "uppercase",
            }}
          >
            <Clock size={isDayView ? 16 : 14} strokeWidth={3} />
            {startTime || "--:--"}
          </span>

          {temPendencia && (
              <div
                title={
                  os && isFinalizadoSemValor(os)
                    ? "Falta preencher valores"
                    : "Atendimento atrasado ou não iniciado"
                }
                style={{
                  width: isDayView ? "14px" : "12px",
                  height: isDayView ? "14px" : "12px",
                  borderRadius: "50%",
                  backgroundColor: "#ef4444",
                  border: "2px solid #ffffff",
                  boxShadow:
                    "0 0 0 1px #ef4444, 0 0 8px rgba(239, 68, 68, 0.5)",
                  flexShrink: 0,
                  marginRight: isDayView ? "6px" : "4px",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                }}
              />
            )}
        </div>
      )}
    </div>
  );
};

export default function OSCalendar({
  osList,
  docagemInstances = [],
  clientes,
  drivers = [],
  creatorAvatarMap,
  onEventClick,
  onDocagemEventClick,
  loading,
  hasLoaded,
  showArchivedOnly,
  hideStatusLegend,
  onRangeChange,
  docagemListFilter = "all",
  onFilterChange,
  onArchivedToggle,
  onlyMyDrafts = false,
  onToggleMyDrafts,
}: OSCalendarProps) {
  const [currentView, setCurrentView] = useState<
    "dayGridMonth" | "dayGridWeek" | "dayGridDay"
  >("dayGridWeek");
  const calendarRef = React.useRef<FullCalendar>(null);
  const lastRangeRef = React.useRef<{ from: string; to: string } | null>(null);
  const preloadedDraftAvatarsRef = useRef<Set<string>>(new Set());

  // Pré-carregar avatares dos criadores de rascunhos para evitar flash
  useEffect(() => {
    osList.forEach((os) => {
      if (os.tipo !== "rascunho" || !os.createdBy) return;
      const avatar = creatorAvatarMap?.get(os.createdBy)?.avatar;
      if (!avatar || preloadedDraftAvatarsRef.current.has(avatar)) return;
      const img = document.createElement("img");
      img.src = getThumbnailUrl(avatar, 40) || avatar;
      preloadedDraftAvatarsRef.current.add(avatar);
    });
  }, [osList, creatorAvatarMap]);

  // Estado do botão eye: qual dateKey está em foco
  const [focusedDateKey, setFocusedDateKey] = useState<string | null>(null);

  // Realtime: "agora" atualizado via timeouts precisos (sem polling)
  const [now, setNow] = useState<Date>(() => new Date());
  // Ref para acessar a lista atual de instâncias dentro de callbacks assíncronos
  const docagemInstancesRef = useRef(docagemInstances);
  useEffect(() => {
    docagemInstancesRef.current = docagemInstances;
  }, [docagemInstances]);
  // Notificações de "precisa finalizar" já disparadas nesta sessão
  const firedNotifRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const scheduled: ReturnType<typeof setTimeout>[] = [];
    const currentNow = new Date();

    docagemInstances.forEach((instance) => {
      if (instance.status === "finalizada" || instance.status === "excluida")
        return;

      const startDT = formatCalendarDateTime(
        instance.data,
        instance.horarioInicio,
      );
      const endDT = formatCalendarDateTime(instance.data, instance.horarioFim);
      if (!startDT) return;

      // Timeout preciso: atualiza `now` quando chegar a hora de início
      const msToStart = new Date(startDT).getTime() - currentNow.getTime();
      if (msToStart > 0) {
        scheduled.push(setTimeout(() => setNow(new Date()), msToStart));
      }

      // Notificação 5min após horário final
      if (endDT) {
        const notifKey = `${instance.id}-end-notif`;
        const msToNotif =
          new Date(endDT).getTime() + 5 * 60 * 1000 - currentNow.getTime();
        if (msToNotif > 0 && !firedNotifRef.current.has(notifKey)) {
          scheduled.push(
            setTimeout(async () => {
              // Verificar se ainda não foi finalizada no momento do disparo
              const current = docagemInstancesRef.current.find(
                (i) => i.id === instance.id,
              );
              if (!current || current.status === "finalizada") return;
              firedNotifRef.current.add(notifKey);
              const clienteNome =
                clientes.find((c) => c.id === instance.clienteId)?.nome ||
                "Docagem";
              const [ano, mes, dia] = instance.data.split("-");
              const dataFormatada = `${dia}/${mes}/${ano}`;
              const hora = instance.horarioFim?.slice(0, 5) || "";
              await createNotification(
                "warning",
                "Docagem precisa ser finalizada",
                `A docagem de <strong>${clienteNome}</strong> do dia <span style="color:#6d28d9;font-weight:700">${dataFormatada}</span> (término ${hora}) já passou 5 minutos do horário final e ainda não foi finalizada.`,
                "all",
              );
            }, msToNotif),
          );
        }
      }
    });

    return () => {
      scheduled.forEach(clearTimeout);
    };
  }, [docagemInstances, clientes]);

  // Converter OS para eventos do FullCalendar
  const events = useMemo(() => {
    const derivedEvents: CalendarEvent[] = [];

    osList.forEach((os) => {
      const clienteNome =
        clientes.find((c) => c.id === os.clienteId)?.nome || "N/A";
      const effectiveStatus =
        os.tipo === "rascunho"
          ? "Rascunho"
          : os.operationalCycles && os.operationalCycles.length > 0
            ? deriveCyclesOperationalStatus(os.operationalCycles)
            : os.status.operacional;
      const osKind: CalendarEventKind =
        os.tipo === "freelance"
          ? "freelance"
          : os.tipo === "rascunho"
            ? "rascunho"
            : "os";
      const waypoints = os.rota?.waypoints || [];

      const itineraries =
        waypoints.length > 0
          ? waypoints.reduce<
              Record<
                number,
                { waypoints: typeof waypoints; firstIndex: number }
              >
            >((acc, waypoint, index) => {
              const itineraryIndex = waypoint.itineraryIndex ?? 0;
              if (!acc[itineraryIndex]) {
                acc[itineraryIndex] = { waypoints: [], firstIndex: index };
              }
              acc[itineraryIndex].waypoints.push(waypoint);
              return acc;
            }, {})
          : {};

      const itineraryEntries = Object.entries(itineraries);

      if (itineraryEntries.length === 0) {
        // Só precisa de data para criar evento (sem hora = dia todo)
        if (!os.data) {
          return;
        }

        const startDateTime = formatCalendarDateTime(os.data, os.hora);
        if (!startDateTime) {
          return;
        }

        const timeStr = os.hora;
        const [hours = "00", minutes = "00"] = timeStr
          ? timeStr.split(":")
          : ["00", "00"];
        const endHour = Math.min(Number(hours) + 1, 23);
        const endMinutes = Number(hours) >= 23 ? "59" : minutes;
        const endDateTime = `${os.data}T${String(endHour).padStart(2, "0")}:${endMinutes}:00`;
        const colors =
          statusColors[effectiveStatus] || statusColors["Pendente"];

        derivedEvents.push({
          id: `${os.id}-${effectiveStatus}`,
          title: `${os.protocolo} - ${clienteNome}`,
          start: startDateTime,
          end: endDateTime,
          allDay: !os.hora,
          backgroundColor: "transparent",
          borderColor: "transparent",
          textColor: colors.text,
          extendedProps: {
            kind: osKind,
            os,
            clienteNome,
            status: effectiveStatus,
            displayDateTime: startDateTime,
            startTime: os.hora || undefined,
          },
        });
        return;
      }

      itineraryEntries
        .sort(([, a], [, b]) => a.firstIndex - b.firstIndex)
        .forEach(([itineraryIndexRaw, itinerary]) => {
          const itineraryIndex = Number(itineraryIndexRaw);
          const firstWaypoint = itinerary.waypoints[0];

          // Regra: primeiro itinerário (índice 0) sempre gera card, demais só se tiver data E hora
          const isFirstItinerary = itineraryIndex === 0;
          const hasDate = firstWaypoint?.data || os.data;
          const hasTime = firstWaypoint?.hora || os.hora;

          if (!hasDate) {
            return;
          }

          // Para itinerários > 0, exigir data E hora
          if (!isFirstItinerary && !hasTime) {
            return;
          }

          const dateStr = parseBrDateToIso(firstWaypoint?.data) || os.data;
          const timeStr = firstWaypoint?.hora || os.hora;
          const startDateTime = formatCalendarDateTime(dateStr, timeStr);
          if (!startDateTime) {
            return;
          }

          const [hours = "00", minutes = "00"] = timeStr
            ? timeStr.split(":")
            : ["00", "00"];
          const endHour = Math.min(Number(hours) + 1, 23);
          const endMinutes = Number(hours) >= 23 ? "59" : minutes;
          const endDateTime = `${dateStr}T${String(endHour).padStart(2, "0")}:${endMinutes}:00`;
          const cycle = os.operationalCycles?.find(
            (item) => item.itineraryIndex === itineraryIndex,
          );
          const eventStatus =
            os.tipo === "rascunho"
              ? "Rascunho"
              : cycle
                ? getCycleDisplayStatus(cycle.state)
                : effectiveStatus;
          const colors = statusColors[eventStatus] || statusColors["Pendente"];

          derivedEvents.push({
            id: `${os.id}-${itineraryIndex}-${eventStatus}`,
            title: `${os.protocolo} - ${clienteNome}`,
            start: startDateTime,
            end: endDateTime,
            allDay: !firstWaypoint?.hora && !os.hora,
            backgroundColor: "transparent",
            borderColor: "transparent",
            textColor: colors.text,
            extendedProps: {
              kind: osKind,
              os,
              clienteNome,
              status: eventStatus,
              itineraryIndex,
              itineraryLabel: getItineraryLabel(itineraryIndex),
              displayDateTime: startDateTime,
              startTime: firstWaypoint?.hora || os.hora || undefined,
            },
          });
        });
    });

    // Converter instâncias de docagem para eventos
    docagemInstances.forEach((instance) => {
      const clienteNome =
        clientes.find((c) => c.id === instance.clienteId)?.nome || "Docagem";
      const startDateTime = formatCalendarDateTime(
        instance.data,
        instance.horarioInicio,
      );
      if (!startDateTime) return;

      const endDateTime = formatCalendarDateTime(
        instance.data,
        instance.horarioFim,
      );
      const safeEndDateTime = endDateTime || startDateTime;
      const isFinalizada = instance.status === "finalizada";
      const isAndamento = !isFinalizada && new Date(startDateTime) <= now;
      const eventStatus = isFinalizada
        ? "Finalizado"
        : isAndamento
          ? "Andamento"
          : "Pendente";
      const colorKey =
        isAndamento && !isFinalizada ? "Docagem Andamento" : eventStatus;
      const colors = statusColors[colorKey] || statusColors["Docagem"];

      derivedEvents.push({
        id: `docagem-${instance.id}`,
        title: `Docagem - ${clienteNome}`,
        start: startDateTime,
        end: safeEndDateTime,
        allDay: false,
        backgroundColor: "transparent",
        borderColor: "transparent",
        textColor: colors.text,
        extendedProps: {
          kind: "docagem",
          docagem: instance,
          clienteNome,
          status: eventStatus,
          displayDateTime: startDateTime,
          startTime: instance.horarioInicio,
        },
      });
    });

    // Gerar eventos divisores de período do dia (Manhã/Tarde/Noite/Madrugada)
    // Apenas para visualizações de semana e dia
    if (currentView === "dayGridWeek" || currentView === "dayGridDay") {
      // Coletar todas as datas únicas dos eventos
      const dateSet = new Set<string>();
      derivedEvents.forEach((ev) => {
        if (ev.start) {
          dateSet.add(ev.start.split("T")[0]);
        }
      });

      const periods = [
        {
          label: "Madrugada",
          startHour: 0,
          endHour: 6,
          icon: Moon,
          color: "#a5b4fc",
        },
        {
          label: "Manhã",
          startHour: 6,
          endHour: 12,
          icon: Sunrise,
          color: "#fcd34d",
        },
        {
          label: "Tarde",
          startHour: 12,
          endHour: 18,
          icon: Sun,
          color: "#fdba74",
        },
        {
          label: "Noite",
          startHour: 18,
          endHour: 24,
          icon: Sunset,
          color: "#c4b5fd",
        },
      ];

      dateSet.forEach((dateStr) => {
        periods.forEach((period) => {
          const startDateTime = `${dateStr}T${String(period.startHour).padStart(2, "0")}:00:00`;
          const endDateTime = `${dateStr}T${String(period.endHour).padStart(2, "0")}:00:00`;
          derivedEvents.push({
            id: `divider-${dateStr}-${period.label}`,
            title: period.label,
            start: startDateTime,
            end: endDateTime,
            allDay: false,
            backgroundColor: "transparent",
            borderColor: "transparent",
            textColor: period.color,
            extendedProps: {
              kind: "divider",
              clienteNome: "",
              status: "Divider",
              displayDateTime: startDateTime,
              dividerLabel: period.label,
              dividerIcon: period.icon,
              dividerColor: period.color,
            },
          });
        });
      });
    }

    return derivedEvents;
  }, [osList, docagemInstances, clientes, now, currentView]);

  // Hover expandir coluna no modo semana
  // O FullCalendar renderiza DUAS tabelas separadas: header e body.
  // É necessário setar width diretamente nos <th> e <td> de ambas.
  useEffect(() => {
    if (currentView !== "dayGridWeek") return;

    const setupHover = () => {
      const weekView = document.querySelector(
        ".fc-dayGridWeek-view",
      ) as HTMLElement | null;
      if (!weekView) return null;

      // Cabeçalho: tabela fc-col-header
      const headerCells = Array.from(
        weekView.querySelectorAll(".fc-col-header-cell"),
      ) as HTMLElement[];
      // Body: primeira linha com .fc-daygrid-day
      const bodyCells = Array.from(
        weekView.querySelectorAll(".fc-daygrid-day"),
      ) as HTMLElement[];

      const n = headerCells.length;
      if (n === 0 || bodyCells.length === 0) return null;

      const BIG = 18; // % da coluna em hover (colunas comprimidas ficam maiores)
      const baseW = `${(100 / n).toFixed(3)}%`;
      const bigW = `${BIG}%`;
      const smallW = `${((100 - BIG) / (n - 1)).toFixed(3)}%`;

      // Forçar table-layout: fixed nas duas tabelas
      weekView
        .querySelectorAll("table")
        .forEach((t) => ((t as HTMLElement).style.tableLayout = "fixed"));

      // Hover: muda largura E aplica fundo escuro na coluna em hover
      const apply = (hovered: number | null) => {
        headerCells.forEach((cell, i) => {
          cell.style.width =
            hovered === null ? baseW : i === hovered ? bigW : smallW;
          cell.classList.toggle("fc-week-col-hovered", i === hovered);
        });
        bodyCells.forEach((cell, i) => {
          cell.style.width =
            hovered === null ? baseW : i === hovered ? bigW : smallW;
          cell.classList.toggle("fc-week-col-hovered", i === hovered);
        });
      };

      apply(null);

      type Handler = { el: HTMLElement; enter: () => void; leave: () => void };
      const handlers: Handler[] = [];

      const allCells = [...headerCells, ...bodyCells];
      allCells.forEach((cell, idx) => {
        const col = idx < n ? idx : idx - n;
        const enter = () => apply(col);
        const leave = () => apply(null);
        cell.addEventListener("mouseenter", enter);
        cell.addEventListener("mouseleave", leave);
        handlers.push({ el: cell, enter, leave });
      });

      return () => {
        handlers.forEach(({ el, enter, leave }) => {
          el.removeEventListener("mouseenter", enter);
          el.removeEventListener("mouseleave", leave);
        });
        apply(null);
      };
    };

    let cleanup: (() => void) | null = null;
    const timer = setTimeout(() => {
      cleanup = setupHover();
    }, 300);

    return () => {
      clearTimeout(timer);
      if (cleanup) cleanup();
    };
  }, [currentView, events, hasLoaded]);

  // Interceptar cliques no botão eye na fase de captura (antes do FullCalendar
  // e do React). Faz o toggle de foco aqui mesmo, pois stopImmediatePropagation
  // impede que o onClick do React (na fase de bubble) seja acionado.
  useEffect(() => {
    if (currentView !== "dayGridWeek") return;

    const blockNav = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest(".fc-week-eye-btn")) {
        e.stopPropagation();
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    const handleEyeClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest(".fc-week-eye-btn");
      if (!btn) return;
      e.stopPropagation();
      e.preventDefault();
      e.stopImmediatePropagation();
      const cell = btn.closest("[data-date]");
      const dateKey = cell?.getAttribute("data-date");
      if (!dateKey) return;
      setFocusedDateKey((prev) => (prev === dateKey ? null : dateKey));
    };

    // Bloqueia navlink em mousedown/pointerdown; faz o toggle no click
    document.addEventListener("mousedown", blockNav, true);
    document.addEventListener("pointerdown", blockNav, true);
    document.addEventListener("click", handleEyeClick, true);

    return () => {
      document.removeEventListener("mousedown", blockNav, true);
      document.removeEventListener("pointerdown", blockNav, true);
      document.removeEventListener("click", handleEyeClick, true);
    };
  }, [currentView, setFocusedDateKey]);

  // Aplicar/remover efeito de foco (eye button) nas colunas da semana
  useEffect(() => {
    if (currentView !== "dayGridWeek") return;

    const weekView = document.querySelector(
      ".fc-dayGridWeek-view",
    ) as HTMLElement | null;
    if (!weekView) return;

    const headerCells = Array.from(
      weekView.querySelectorAll(".fc-col-header-cell"),
    ) as HTMLElement[];
    const bodyCells = Array.from(
      weekView.querySelectorAll(".fc-daygrid-day"),
    ) as HTMLElement[];

    if (focusedDateKey === null) {
      weekView.classList.remove("fc-week-col-hover-active");
      [...headerCells, ...bodyCells].forEach((c) =>
        c.classList.remove("fc-week-col-focused"),
      );
      return;
    }

    // FullCalendar coloca data-date="YYYY-MM-DD" diretamente no <th> e <td>
    const idx = headerCells.findIndex(
      (cell) => cell.getAttribute("data-date") === focusedDateKey,
    );
    const bodyIdx = bodyCells.findIndex(
      (cell) => cell.getAttribute("data-date") === focusedDateKey,
    );
    const resolvedIdx = idx >= 0 ? idx : bodyIdx;

    if (resolvedIdx < 0) return;

    weekView.classList.add("fc-week-col-hover-active");
    headerCells.forEach((c, i) =>
      c.classList.toggle("fc-week-col-focused", i === resolvedIdx),
    );
    bodyCells.forEach((c, i) =>
      c.classList.toggle("fc-week-col-focused", i === resolvedIdx),
    );
  }, [focusedDateKey, currentView, events]);

  const weekStatusCountsByDate = useMemo(() => {
    const countsByDate: Record<string, WeekStatusCounts> = {};

    events.forEach((event) => {
      const status = event.extendedProps.status;
      const dateKey = event.start.split("T")[0];

      if (!countsByDate[dateKey]) {
        countsByDate[dateKey] = emptyWeekStatusCounts();
      }

      // Ignorar eventos divisores (não são atendimentos reais)
      if (event.extendedProps.kind === "divider") return;

      // Contabilizar status se for um status válido
      if (weekStatusOrder.includes(status as WeekStatus)) {
        countsByDate[dateKey][status as WeekStatus] += 1;
      }

      // Contar total de eventos reais e eventos finalizados/cancelados
      countsByDate[dateKey].totalEvents =
        (countsByDate[dateKey].totalEvents ?? 0) + 1;
      if (status === "Finalizado" || status === "Cancelado") {
        countsByDate[dateKey].doneEvents =
          (countsByDate[dateKey].doneEvents ?? 0) + 1;
      }

      // Verificar alerta (Finalizado sem valor OU OS atrasada/não iniciada)
      if (
        !showArchivedOnly &&
        event.extendedProps.kind === "os" &&
        event.extendedProps.os &&
        (isFinalizadoSemValor(event.extendedProps.os) ||
          isOsAtrasadaOuNaoIniciada(event.extendedProps.os))
      ) {
        countsByDate[dateKey].hasAlert = true;
        countsByDate[dateKey].alertCount =
          (countsByDate[dateKey].alertCount ?? 0) + 1;
      }
    });

    // Computar allDone: todos os eventos do dia estão finalizados/cancelados
    // e não há alertas
    for (const key of Object.keys(countsByDate)) {
      const c = countsByDate[key];
      c.allDone =
        (c.totalEvents ?? 0) > 0 &&
        (c.doneEvents ?? 0) === (c.totalEvents ?? 0) &&
        !c.hasAlert;
    }

    return countsByDate;
  }, [events, showArchivedOnly]);

  const handleEventClick = useCallback(
    (info: {
      jsEvent: MouseEvent;
      event: {
        id: string;
        extendedProps?: {
          kind?: CalendarEventKind;
          os?: OrderService;
          docagem?: DocagemInstance;
        };
      };
    }) => {
      info.jsEvent.preventDefault();
      const props = info.event.extendedProps;
      if (props?.kind === "divider") {
        info.jsEvent.stopPropagation();
        return;
      }
      const isDocagem = props?.kind === "docagem";
      if (isDocagem && props?.docagem && onDocagemEventClick) {
        onDocagemEventClick(props.docagem.id, {
          x: info.jsEvent.clientX,
          y: info.jsEvent.clientY,
        });
        return;
      }
      const osId = props?.os?.id || info.event.id;
      onEventClick(osId, { x: info.jsEvent.clientX, y: info.jsEvent.clientY });
    },
    [onEventClick, onDocagemEventClick],
  );

  const handleDateSelect = useCallback((selectInfo: { startStr: string }) => {
    // Poderia abrir modal de nova OS com a data pré-selecionada
    // Por agora, apenas logamos
    console.log("Data selecionada:", selectInfo.startStr);
  }, []);

  const viewLabelMap: Record<string, string> = {
    dayGridMonth: "Mês",
    dayGridWeek: "Semana",
    dayGridDay: "Dia",
  };

  const changeView = (view: "dayGridMonth" | "dayGridWeek" | "dayGridDay") => {
    setCurrentView(view);
    logInfo(
      "OSCalendar",
      `Mudou visualização do calendário para ${viewLabelMap[view]}`,
    );
    // We rely on the 'key={currentView}' on FullCalendar to force a clean re-mount
    // This solves issues with DOM elements from one view persisting in another.
  };

  const goToPrev = () => {
    logInfo(
      "OSCalendar",
      `Navegou para ${viewLabelMap[currentView] || "período"} anterior`,
    );
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.prev();
    }
  };

  const goToNext = () => {
    logInfo(
      "OSCalendar",
      `Navegou para próximo ${viewLabelMap[currentView] || "período"}`,
    );
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.next();
    }
  };

  const handleDatesSet = useCallback(
    (dateInfo: { start: Date; end: Date; view: { type: string } }) => {
      // Remove day-bottom elements after calendar renders to eliminate empty space
      setTimeout(() => {
        const dayBottoms = document.querySelectorAll(".fc-daygrid-day-bottom");
        dayBottoms.forEach((el) => {
          el.remove();
        });
      }, 100);

      if (!onRangeChange) return;
      const from = dateInfo.start.toISOString().split("T")[0];
      const endDate = new Date(dateInfo.end);
      endDate.setDate(endDate.getDate() - 1);
      const to = endDate.toISOString().split("T")[0];

      // Remover o bloqueio do lastRangeRef para permitir navegação correta
      // O FullCalendar pode disparar datesSet múltiplas vezes, mas o componente pai
      // já tem seu próprio mecanismo de cache via calendarRangeRef
      lastRangeRef.current = { from, to };
      onRangeChange(from, to);
    },
    [onRangeChange],
  );

  // Renderizador customizado de eventos
  const renderEventContent = useCallback(
    (eventInfo: {
      timeText?: string;
      event: {
        startStr?: string;
        extendedProps: {
          kind: CalendarEventKind;
          os?: OrderService;
          docagem?: DocagemInstance;
          status: CycleOperationalStatus | "Docagem" | "Divider";
          isDocagemFlag?: boolean;
          itineraryLabel?: string;
          displayDateTime?: string;
          startTime?: string;
          dividerLabel?: string;
          dividerIcon?: typeof Route;
          dividerColor?: string;
        };
      };
    }) => {
      const isDocagem = eventInfo.event.extendedProps.kind === "docagem";
      return (
        <EventContent
          os={isDocagem ? undefined : eventInfo.event.extendedProps.os}
          docagem={eventInfo.event.extendedProps.docagem}
          clientes={clientes}
          drivers={drivers}
          creatorAvatarMap={creatorAvatarMap}
          status={eventInfo.event.extendedProps.status}
          isDocagemFlag={isDocagem}
          eventKind={eventInfo.event.extendedProps.kind}
          timeText={eventInfo.timeText}
          eventStartStr={eventInfo.event.startStr}
          displayDateTime={eventInfo.event.extendedProps.displayDateTime}
          startTime={eventInfo.event.extendedProps.startTime}
          showArchivedOnly={showArchivedOnly}
          isMonthView={currentView === "dayGridMonth"}
          isDayView={currentView === "dayGridDay"}
          dividerLabel={eventInfo.event.extendedProps.dividerLabel}
          dividerIcon={eventInfo.event.extendedProps.dividerIcon}
          dividerColor={eventInfo.event.extendedProps.dividerColor}
        />
      );
    },
    [clientes, drivers, creatorAvatarMap, showArchivedOnly, currentView],
  );

  const renderMonthDayCellContent = useCallback(
    (arg: { date: Date; dayNumberText: string; view: { type: string } }) => {
      // Somente renderiza o resumo de chips no modo mês e garante limpeza absoluta em outros modos
      if (arg.view.type !== "dayGridMonth") {
        return (
          <span className="fc-daygrid-day-number-simple">
            {arg.dayNumberText}
          </span>
        );
      }

      const dateKey = toDateKey(arg.date);
      const counts = weekStatusCountsByDate[dateKey] ?? emptyWeekStatusCounts();
      const isToday = dateKey === toDateKey(new Date());

      return (
        <div className="fc-os-month-cell" key={`month-cell-${dateKey}`}>
          {counts.hasAlert && (
            <div
              title={`${counts.alertCount ?? 1} atendimento${(counts.alertCount ?? 1) > 1 ? "s" : ""} com pendência${(counts.alertCount ?? 1) > 1 ? "s" : ""} (valores ou atraso) neste dia`}
              style={{
                position: "absolute",
                top: "3px",
                left: "6px",
                display: "flex",
                alignItems: "center",
                gap: "3px",
                padding: "2px 6px 2px 4px",
                borderRadius: "999px",
                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                color: "#fff",
                fontSize: "11px",
                fontWeight: 800,
                lineHeight: 1,
                border: "1.5px solid #fff",
                boxShadow: "0 0 0 1px #ef4444, 0 1px 4px rgba(239, 68, 68, 0.45)",
                zIndex: 3,
              }}
            >
              <AlertTriangle size={11} strokeWidth={3} />
              {counts.alertCount ?? 1}
            </div>
          )}
          {counts.allDone && (
            <div
              title="Tudo finalizado — nenhum alerta neste dia"
              style={{
                position: "absolute",
                top: "3px",
                left: "6px",
                display: "flex",
                alignItems: "center",
                gap: "3px",
                padding: "2px 6px 2px 4px",
                borderRadius: "999px",
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff",
                fontSize: "11px",
                fontWeight: 800,
                lineHeight: 1,
                border: "1.5px solid #fff",
                boxShadow: "0 0 0 1px #10b981, 0 1px 4px rgba(16, 185, 129, 0.4)",
                zIndex: 3,
              }}
            >
              <CheckCircle2 size={11} strokeWidth={3} />
              OK
            </div>
          )}
          <span className="fc-os-month-cell__day-number">
            {arg.dayNumberText}
          </span>
          <div className="fc-os-month-cell__status-row">
            {weekStatusOrder.map((status) => {
              const meta = weekStatusMeta[status];
              const Icon = meta.icon;
              const count = counts[status];

              return (
                <div
                  key={status}
                  className="fc-os-month-cell__status-chip"
                  title={`${meta.label}: ${count}`}
                  aria-label={`${meta.label}: ${count}`}
                  style={{
                    color: meta.color,
                    borderColor: isToday
                      ? `${meta.color}CC`
                      : `${meta.color}80`,
                    backgroundColor: isToday
                      ? `${meta.color}4D`
                      : `${meta.color}33`,
                    opacity: isToday ? 1 : count === 0 ? 0.55 : 1,
                  }}
                >
                  <Icon size={18} strokeWidth={2.5} />
                  <span style={{ color: meta.textColor }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    },
    [weekStatusCountsByDate],
  );

  const renderDayHeaderContent = useCallback(
    (arg: { date: Date; text: string; view: { type: string } }) => {
      if (arg.view.type !== "dayGridWeek" && arg.view.type !== "dayGridDay") {
        return arg.text;
      }

      const dateKey = toDateKey(arg.date);
      const counts = weekStatusCountsByDate[dateKey] ?? emptyWeekStatusCounts();
      const headerVariant = arg.view.type === "dayGridDay" ? "day" : "week";

      const iconSize = headerVariant === "day" ? 16 : 12;
      const iconStrokeWidth = headerVariant === "day" ? 2 : 2.5;
      const isToday =
        arg.view.type === "dayGridWeek" && dateKey === toDateKey(new Date());

      const isFocused = focusedDateKey === dateKey;

      return (
        <div
          className={`fc-os-header fc-os-header--${headerVariant}`}
          key={`header-${dateKey}-${headerVariant}`}
        >
          {counts.hasAlert && (
            <div
              title={`${counts.alertCount ?? 1} atendimento${(counts.alertCount ?? 1) > 1 ? "s" : ""} com pendência${(counts.alertCount ?? 1) > 1 ? "s" : ""} (valores ou atraso) neste dia`}
              style={{
                position: "absolute",
                top: headerVariant === "day" ? "3px" : "1px",
                left: headerVariant === "day" ? "10px" : "6px",
                display: "flex",
                alignItems: "center",
                gap: "3px",
                padding: "2px 6px 2px 4px",
                borderRadius: "999px",
                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                color: "#fff",
                fontSize: "11px",
                fontWeight: 800,
                lineHeight: 1,
                border: "1.5px solid #fff",
                boxShadow: "0 0 0 1px #ef4444, 0 1px 4px rgba(239, 68, 68, 0.45)",
                zIndex: 3,
              }}
            >
              <AlertTriangle size={11} strokeWidth={3} />
              {counts.alertCount ?? 1}
            </div>
          )}
          {counts.allDone && (
            <div
              title="Tudo finalizado — nenhum alerta neste dia"
              style={{
                position: "absolute",
                top: headerVariant === "day" ? "3px" : "1px",
                left: headerVariant === "day" ? "10px" : "6px",
                display: "flex",
                alignItems: "center",
                gap: "3px",
                padding: "2px 6px 2px 4px",
                borderRadius: "999px",
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff",
                fontSize: "11px",
                fontWeight: 800,
                lineHeight: 1,
                border: "1.5px solid #fff",
                boxShadow: "0 0 0 1px #10b981, 0 1px 4px rgba(16, 185, 129, 0.4)",
                zIndex: 3,
              }}
            >
              <CheckCircle2 size={11} strokeWidth={3} />
              OK
            </div>
          )}
          {headerVariant === "week" && (
            <button
              className={`fc-week-eye-btn${isFocused ? " active" : ""}`}
              title={isFocused ? "Desfocar coluna" : "Focar nesta coluna"}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setFocusedDateKey((prev) =>
                  prev === dateKey ? null : dateKey,
                );
              }}
            >
              {isFocused ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
          <span className="fc-os-week-header__day">{arg.text}</span>
          <div className="fc-os-week-header__status-row">
            {weekStatusOrder.map((status) => {
              const meta = weekStatusMeta[status];
              const Icon = meta.icon;
              const count = counts[status];

              return (
                <div
                  key={status}
                  className="fc-os-week-header__status-chip"
                  title={`${meta.label}: ${count}`}
                  aria-label={`${meta.label}: ${count}`}
                  style={{
                    color: meta.color,
                    borderColor: "#e2e8f0",
                    backgroundColor: "#ffffff",
                    opacity: isToday ? 1 : count === 0 ? 0.55 : 1,
                  }}
                >
                  <Icon size={iconSize} strokeWidth={iconStrokeWidth} />
                  <span style={{ color: "#334155" }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    },
    [weekStatusCountsByDate, focusedDateKey, setFocusedDateKey],
  );

  // Lógica de exibição baseada em hasLoaded
  const isInitialLoading = !hasLoaded && loading;
  // Mostrar overlay de loading sempre que estiver carregando, independente de ter dados anteriores
  const showCalendarWithOverlay = loading;
  const isEmpty =
    !loading &&
    hasLoaded &&
    osList.length === 0 &&
    docagemInstances.length === 0;

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden relative">
      {/* Header do Calendário Customizado */}
      <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-200 bg-slate-50/50">
        {/* Navegação - Canto Esquerdo */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            className="p-2 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <ChevronLeft size={20} className="text-slate-600" />
          </button>
        </div>

        {/* Seletor de Visualização - Centralizado */}
        <div className="flex-1 flex items-center justify-center gap-3">
          {/* Toggle de Filtros: Todos | OS | Docagem | Rascunho | Freelance */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm">
            {[
              {
                key: "all" as const,
                label: "Todos",
                icon: Layers,
                activeClass: "bg-slate-800 text-white shadow-md",
                inactiveIconClass: "text-slate-500",
                inactiveHover: "hover:bg-slate-50",
              },
              {
                key: "os" as const,
                label: "OS",
                icon: Truck,
                activeClass: "bg-blue-500 text-white shadow-md",
                inactiveIconClass: "text-blue-500",
                inactiveHover: "hover:bg-blue-50",
              },
              {
                key: "docagem" as const,
                label: "Docagem",
                icon: Package,
                activeClass: "bg-violet-600 text-white shadow-md",
                inactiveIconClass: "text-violet-500",
                inactiveHover: "hover:bg-violet-50",
              },
              {
                key: "rascunho" as const,
                label: "Rascunho",
                icon: FileText,
                activeClass: "bg-[rgb(255,212,146)] text-[#a06418] shadow-md",
                inactiveIconClass: "text-[rgb(255,212,146)]",
                inactiveHover: "hover:bg-[rgb(255,212,146)]/40",
              },
              {
                key: "freelance" as const,
                label: "Freelance",
                icon: Briefcase,
                activeClass: "bg-emerald-600 text-white shadow-md",
                inactiveIconClass: "text-emerald-500",
                inactiveHover: "hover:bg-emerald-50",
              },
            ].map(
              ({
                key,
                label,
                icon: Icon,
                activeClass,
                inactiveIconClass,
                inactiveHover,
              }) => {
                const active = !showArchivedOnly && docagemListFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => onFilterChange?.(key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                      active ? activeClass : `text-slate-500 ${inactiveHover}`
                    }`}
                  >
                    <Icon
                      size={14}
                      className={active ? "text-white" : inactiveIconClass}
                    />
                    {label}
                  </button>
                );
              },
            )}
          </div>

          {/* Toggle de Visualização: Mês | Semana | Dia */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm">
            {[
              { key: "dayGridMonth", label: "Mês", icon: CalendarDays },
              { key: "dayGridWeek", label: "Semana", icon: CalendarDays },
              { key: "dayGridDay", label: "Dia", icon: Clock },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() =>
                  changeView(
                    key as "dayGridMonth" | "dayGridWeek" | "dayGridDay",
                  )
                }
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all cursor-pointer ${
                  currentView === key
                    ? "bg-[var(--color-geolog-blue)] text-white shadow-md"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Toggle "Meus rascunhos" — só aparece quando filtro rascunho ativo */}
          {docagemListFilter === "rascunho" && onToggleMyDrafts && (
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm">
              <button
                onClick={() => onlyMyDrafts && onToggleMyDrafts()}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  !onlyMyDrafts
                    ? "bg-[rgb(255,212,146)] text-[#a06418] shadow-md"
                    : "text-slate-500 hover:bg-amber-50 hover:text-[#a06418]"
                }`}
              >
                <FileText size={14} />
                Todos
              </button>
              <button
                onClick={() => !onlyMyDrafts && onToggleMyDrafts()}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  onlyMyDrafts
                    ? "bg-[rgb(255,234,208)] text-[#a06418] shadow-sm"
                    : "text-slate-500 hover:bg-amber-50 hover:text-[#a06418]"
                }`}
              >
                <FileText size={14} />
                Meus rascunhos
              </button>
            </div>
          )}
        </div>

        {/* Navegação - Canto Direito */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToNext}
            className="p-2 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <ChevronRight size={20} className="text-slate-600" />
          </button>
        </div>
      </div>

      {/* Calendário */}
      <div className="p-4 md:p-6 relative">
        {isInitialLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 text-slate-400 py-16">
            <Loader2 size={48} className="text-blue-500 animate-spin" />
            <p className="font-bold text-lg text-slate-500">
              Carregando ordens de serviço...
            </p>
          </div>
        ) : (
          <>
            <FullCalendar
              key={currentView}
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={currentView}
              locale={ptBrLocale}
              firstDay={1}
              events={events}
              eventClick={handleEventClick}
              selectable={true}
              unselectAuto={true}
              select={handleDateSelect}
              eventLongPressDelay={0}
              datesSet={handleDatesSet}
              headerToolbar={
                currentView === "dayGridMonth"
                  ? {
                      left: "",
                      center: "title",
                      right: "",
                    }
                  : false
              }
              titleFormat={{ year: "numeric", month: "long" }}
              eventContent={renderEventContent}
              eventDidMount={(info) => {
                // Remove tabindex e pointer-events que causam o overlay escuro no foco/botão direito
                info.el.removeAttribute("tabindex");
                info.el.style.outline = "none";
                info.el.style.userSelect = "none";
                info.el.style.webkitUserSelect = "none";
              }}
              dayCellContent={renderMonthDayCellContent}
              dayCellClassNames={(dateInfo) => {
                if (dateInfo.isOtherMonth) {
                  return "fc-day-other-month";
                }
                const dateKey = toDateKey(dateInfo.date);
                const counts = weekStatusCountsByDate[dateKey];
                if (counts?.allDone) return "fc-day-all-done";
                if (counts?.hasAlert) return "fc-day-has-alert";
                return "";
              }}
              dayHeaderClassNames={(dateInfo) => {
                const dateKey = toDateKey(dateInfo.date);
                const counts = weekStatusCountsByDate[dateKey];
                if (counts?.allDone) return "fc-day-all-done";
                if (counts?.hasAlert) return "fc-day-has-alert";
                return "";
              }}
              height="auto"
              contentHeight="auto"
              aspectRatio={1.8}
              dayMaxEvents={false}
              eventDisplay="block"
              slotEventOverlap={false}
              slotDuration="00:30:00"
              slotLabelInterval="01:00"
              eventTimeFormat={{
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }}
              slotLabelFormat={{
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }}
              dayHeaderFormat={{
                weekday: "short",
                day: "numeric",
                omitCommas: true,
              }}
              dayHeaderContent={renderDayHeaderContent}
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              allDaySlot={true}
              allDayText="Dia Todo"
              expandRows={false}
              stickyHeaderDates={true}
              nowIndicator={true}
              navLinks={true}
              weekNumbers={false}
              showNonCurrentDates={false}
              fixedWeekCount={false}
              businessHours={{
                daysOfWeek: [1, 2, 3, 4, 5, 6],
                startTime: "08:00",
                endTime: "18:00",
              }}
              buttonText={{
                today: "Hoje",
                month: "Mês",
                week: "Semana",
                day: "Dia",
              }}
            />
            <style>{`
          /* Estilos base para células do calendário */
          .fc .fc-daygrid-day-frame {
            min-height: 0 !important;
            height: auto !important;
          }

          /* Forçar altura mínima do calendário no modo Mês */
          .fc-dayGridMonth-view {
            min-height: auto !important;
            height: auto !important;
          }

          .fc-dayGridMonth-view .fc-scroller {
            overflow: visible !important;
            height: auto !important;
          }

          .fc-dayGridMonth-view .fc-scroller-harness {
            overflow: visible !important;
            height: auto !important;
          }

          .fc-dayGridMonth-view .fc-daygrid-body {
            width: 100% !important;
            height: auto !important;
          }

          .fc-dayGridMonth-view .fc-daygrid-body-unbalanced .fc-daygrid-day-events {
            min-height: 1em !important;
          }

          .fc-dayGridMonth-view .fc-daygrid-body {
            display: flex !important;
            flex-direction: column !important;
          }

          .fc-dayGridMonth-view .fc-daygrid-body-row {
            flex: 0 0 auto !important;
            height: auto !important;
          }

          .fc-dayGridMonth-view .fc-daygrid-day-frame {
            display: flex !important;
            flex-direction: column !important;
            height: auto !important;
          }

          .fc-dayGridMonth-view .fc-scrollgrid-sync-inner {
            height: auto !important;
            min-height: 0 !important;
          }

          /* Modo Mês: forçar altura mínima das células */
          /* No modo mês, mantemos uma altura base razoável para a grade */
          .fc-dayGridMonth-view .fc-daygrid-day-frame {
            min-height: 60px !important;
            height: auto !important;
            display: flex !important;
            flex-direction: column !important;
            padding: 0 !important;
            margin: 0 !important;
            align-items: stretch !important;
            flex: 1 !important;
          }

          .fc-dayGridMonth-view .fc-daygrid-day-events {
            padding-bottom: 0 !important;
            padding-top: 0 !important;
            margin: 0 !important;
            flex: 0 1 auto !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
          }

          .fc-dayGridMonth-view .fc-daygrid-day-bottom {
            margin-top: 0 !important;
            display: none !important;
            height: 0 !important;
            max-height: 0 !important;
            min-height: 0 !important;
            overflow: hidden !important;
            flex: 0 0 auto !important;
            padding: 0 !important;
            border: none !important;
            visibility: hidden !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 0 !important;
          }

          .fc-daygrid-day-bottom {
            margin-top: 0 !important;
            display: none !important;
            height: 0 !important;
            max-height: 0 !important;
            min-height: 0 !important;
            overflow: hidden !important;
            flex: 0 0 auto !important;
            padding: 0 !important;
            border: none !important;
            visibility: hidden !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 0 !important;
          }

          .fc-dayGridMonth-view .fc-daygrid-day-frame > *:last-child {
            margin-bottom: 0 !important;
          }

          .fc-dayGridMonth-view .fc-daygrid-event-harness {
            min-height: auto !important;
            margin-bottom: 4px !important;
            visibility: visible !important;
            display: block !important;
            position: relative !important;
            flex-shrink: 0 !important;
          }

          /* Ocultar cabeçalho padrão no modo mês */
          .fc-dayGridMonth-view .fc-col-header {
            display: none !important;
          }

          .fc-dayGridWeek-view .fc-col-header-cell {
            vertical-align: top !important;
          }

          /* Hover expandir coluna no modo semana (transições suaves) */
          .fc-dayGridWeek-view .fc-col-header-cell,
          .fc-dayGridWeek-view .fc-daygrid-day {
            transition:
              width 0.45s cubic-bezier(0.25, 0.1, 0.25, 1),
              opacity 0.4s ease,
              filter 0.4s ease,
              background 0.4s ease,
              background-color 0.4s ease !important;
            overflow: hidden !important;
          }

          /* Cards no modo semana: 98% normal, 90% no hover (diminui levemente) */
          .fc-dayGridWeek-view .fc-daygrid-event-harness,
          .fc-dayGridWeek-view .fc-daygrid-block-event {
            width: 98% !important;
            margin-left: 1% !important;
            margin-right: 1% !important;
            transition: width 0.35s cubic-bezier(0.25, 0.1, 0.25, 1),
              margin 0.35s cubic-bezier(0.25, 0.1, 0.25, 1) !important;
          }

          .fc-dayGridWeek-view .fc-daygrid-event-harness:hover,
          .fc-dayGridWeek-view .fc-daygrid-block-event:hover {
            width: 90% !important;
            margin-left: 5% !important;
            margin-right: 5% !important;
          }

          /* Coluna em hover: cards ocupam 98% (aproveitando a coluna expandida) */
          .fc-dayGridWeek-view
            .fc-daygrid-day.fc-week-col-hovered
            .fc-daygrid-event-harness,
          .fc-dayGridWeek-view
            .fc-daygrid-day.fc-week-col-hovered
            .fc-daygrid-block-event {
            width: 98% !important;
            margin-left: 1% !important;
            margin-right: 1% !important;
          }

          .fc-dayGridWeek-view
            .fc-daygrid-day.fc-week-col-hovered
            .fc-daygrid-event-harness:hover,
          .fc-dayGridWeek-view
            .fc-daygrid-day.fc-week-col-hovered
            .fc-daygrid-block-event:hover {
            width: 93% !important;
            margin-left: 3.5% !important;
            margin-right: 3.5% !important;
          }

          /* HOVER: coluna em hover ganha fundo azul degradê (escuro→claro) exceto hoje */
          .fc-dayGridWeek-view
            .fc-daygrid-day.fc-week-col-hovered:not(.fc-day-today),
          .fc-dayGridWeek-view
            .fc-daygrid-day.fc-week-col-hovered:not(.fc-day-today)
            .fc-daygrid-day-frame,
          .fc-dayGridWeek-view
            .fc-daygrid-day.fc-week-col-hovered:not(.fc-day-today)
            .fc-scrollgrid-sync-inner {
            background: linear-gradient(
              180deg,
              #1e4d8f 0%,
              #2e6db5 50%,
              #4a90d9 100%
            ) !important;
          }

          .fc-dayGridWeek-view
            .fc-col-header-cell.fc-week-col-hovered:not(.fc-day-today),
          .fc-dayGridWeek-view
            .fc-col-header-cell.fc-week-col-hovered:not(.fc-day-today)
            .fc-scrollgrid-sync-inner,
          .fc-dayGridWeek-view
            .fc-col-header-cell.fc-week-col-hovered:not(.fc-day-today)
            .fc-col-header-cell-cushion {
            background: linear-gradient(
              180deg,
              #1e4d8f 0%,
              #4a90d9 100%
            ) !important;
          }

          /* Chips de status mantêm cores originais mesmo com fundo escuro (hover) */
          .fc-dayGridWeek-view
            .fc-col-header-cell.fc-week-col-hovered:not(.fc-day-today)
            .fc-os-week-header__status-chip {
            background-color: white !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
          }

          /* EYE focus: colunas NÃO focadas ficam desfocadas/escurecidas */
          .fc-dayGridWeek-view.fc-week-col-hover-active
            .fc-col-header-cell:not(.fc-week-col-focused),
          .fc-dayGridWeek-view.fc-week-col-hover-active
            .fc-daygrid-day:not(.fc-week-col-focused) {
            opacity: 0.25 !important;
            filter: brightness(0.5) grayscale(0.3) !important;
          }

          /* Botão eye no header da semana */
          .fc-os-header--week {
            position: relative !important;
          }
          .fc-week-eye-btn {
            position: absolute;
            top: -8px;
            right: 0px;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            border: none;
            background: transparent;
            cursor: pointer;
            color: #94a3b8;
            opacity: 0;
            transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
            z-index: 10;
            padding: 0;
          }
          .fc-col-header-cell:hover .fc-week-eye-btn,
          .fc-week-eye-btn.active {
            opacity: 1 !important;
          }
          .fc-week-eye-btn:hover {
            background: rgba(255, 255, 255, 0.35);
            color: #ffffff;
          }
          .fc-week-eye-btn.active {
            color: #ffffff;
            background: rgba(255, 255, 255, 0.4);
          }

          .fc-dayGridMonth-view .fc-col-header-cell,
          .fc-dayGridDay-view .fc-col-header-cell {
            vertical-align: top !important;
          }

          .fc-dayGridWeek-view .fc-col-header-cell.fc-day-today {
            background-color: #feffd5 !important;
          }

          .fc-dayGridWeek-view .fc-col-header-cell.fc-day-today .fc-scrollgrid-sync-inner {
            background-color: #feffd5 !important;
          }

          .fc-dayGridWeek-view .fc-col-header-cell.fc-day-today .fc-col-header-cell-cushion {
            background-color: #feffd5 !important;
          }

          .fc-dayGridWeek-view .fc-col-header-cell-cushion {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            justify-content: flex-start !important;
            gap: 8px !important;
            padding: 10px 6px 0 !important;
            min-height: 110px !important;
            width: 100% !important;
            text-decoration: none !important;
          }

          .fc-dayGridDay-view .fc-col-header-cell-cushion {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            justify-content: flex-start !important;
            gap: 10px !important;
            padding: 12px 8px 0 !important;
            min-height: 120px !important;
            width: 100% !important;
            text-decoration: none !important;
          }

          .fc-os-header {
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
          }

          .fc-os-header--day {
            gap: 6px;
          }

          .fc-os-week-header__day {
            text-align: center;
            font-weight: 900;
            text-transform: capitalize;
            color: #0f172a;
            line-height: 1.1;
          }

          /* Texto do dia em branco quando coluna está hovered (fundo escuro) */
          .fc-dayGridWeek-view
            .fc-col-header-cell.fc-week-col-hovered:not(.fc-day-today)
            .fc-os-week-header__day {
            color: #ffffff !important;
          }

          .fc-os-header--day .fc-os-week-header__day {
            font-size: 16px;
          }

          .fc-os-week-header__status-row {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px;
            width: 100%;
          }

          .fc-os-header--day .fc-os-week-header__status-row {
            gap: 4px;
          }

          .fc-os-week-header__status-chip {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            min-width: 0;
            padding: 4px 6px;
            border-radius: 999px;
            border: 1px solid transparent;
            font-size: 10px;
            font-weight: 900;
            line-height: 1;
            letter-spacing: 0.02em;
          }

          .fc-os-header--month .fc-os-week-header__status-chip {
            padding: 3px 5px;
            font-size: 9px;
            gap: 3px;
          }

          .fc-os-header--week .fc-os-week-header__status-chip {
            padding: 5px 8px;
            font-size: 12px;
            gap: 5px;
          }

          .fc-os-header--week .fc-os-week-header__status-row {
            gap: 7px;
          }

          .fc-os-header--day .fc-os-week-header__status-chip {
            padding: 6px 10px;
            font-size: 13px;
            gap: 6px;
          }

          .fc-dayGridMonth-view .fc-daygrid-day-top {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0 !important;
            padding: 0 !important;
          }

          .fc-dayGridMonth-view .fc-daygrid-day-number {
            margin: 0 !important;
            font-size: 14px !important;
            line-height: 1 !important;
            width: 100% !important;
            padding: 10px !important;
            display: block !important;
            text-align: left !important;
            float: none !important;
            text-decoration: none !important;
          }

          .fc-os-month-cell {
            display: none;
          }

          .fc-dayGridMonth-view .fc-os-month-cell {
            display: flex;
            flex-direction: column;
            gap: 10px;
            width: 100%;
          }

          .fc-os-month-cell__day-number {
            display: inline-flex;
            align-items: center;
            justify-content: flex-start;
            font-weight: 900;
            color: #0f172a;
            font-size: 16px;
            line-height: 1;
          }

          .fc-os-month-cell__status-row {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            width: 100%;
          }

          .fc-os-month-cell__status-chip {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 999px;
            border: 1px solid transparent;
            font-size: 13px;
            font-weight: 900;
            line-height: 1;
            letter-spacing: 0.02em;
            min-width: 0;
          }

          /* Capitalizar primeira letra do título do mês */
          .fc-toolbar-title {
            text-transform: capitalize !important;
          }

          /* Estilizar números dos dias */
          .fc-daygrid-day-number {
            font-weight: 800 !important;
            color: #000000 !important;
          }

          /* Estilizar dias de outros meses */
          .fc-day-other-month {
            background-color: #f1f5f9 !important;
            color: #94a3b8 !important;
            pointer-events: none !important;
          }

          .fc-day-other-month:hover {
            background-color: #f1f5f9 !important;
          }

          /* Dia com tudo OK — todas as OS finalizados, sem alertas */
          .fc-day-all-done {
            background-color: #ecfdf5 !important;
          }
          .fc-day-all-done:hover {
            background-color: #d1fae5 !important;
          }
          /* Header da semana com tudo OK — borda inferior verde */
          .fc-col-header-cell.fc-day-all-done {
            background-color: #ecfdf5 !important;
            border-bottom: 3px solid #10b981 !important;
          }
          /* Não sobrescreve o dia atual (amarelo) */
          .fc-daygrid-day.fc-day-today.fc-day-all-done {
            background-color: #feffd5 !important;
          }
          .fc-daygrid-day.fc-day-today.fc-day-all-done:hover {
            background-color: #feffd5 !important;
          }

          /* Dia com alertas — pendências (valores ou atraso) */
          .fc-day-has-alert {
            background-color: #fef2f2 !important;
          }
          .fc-day-has-alert:hover {
            background-color: #fee2e2 !important;
          }
          /* Header da semana com alertas — borda inferior vermelha */
          .fc-col-header-cell.fc-day-has-alert {
            background-color: #fef2f2 !important;
            border-bottom: 3px solid #ef4444 !important;
          }
          /* Não sobrescreve o dia atual (amarelo) */
          .fc-daygrid-day.fc-day-today.fc-day-has-alert {
            background-color: #feffd5 !important;
          }
          .fc-daygrid-day.fc-day-today.fc-day-has-alert:hover {
            background-color: #feffd5 !important;
          }

          .fc-dayGridMonth-view .fc-daygrid-event-harness-abs {
            display: block !important;
            visibility: visible !important;
            position: relative !important;
          }

          /* Cor de fundo do dia atual (exceto no modo Dia) */
          .fc-dayGridWeek-view .fc-daygrid-day.fc-day-today,
          .fc-dayGridMonth-view .fc-daygrid-day.fc-day-today {
            background-color: #feffd5 !important;
          }

          .fc-dayGridDay-view .fc-day-today,
          .fc-view-dayGridDay .fc-day-today,
          .fc-dayGridDay-view .fc-daygrid-day.fc-day-today {
            background-color: #ffffff !important;
          }

          /* Remover hover padrão nas células normais */
          .fc .fc-daygrid-day:hover {
            background-color: transparent !important;
          }

          /* Hover/focus do dia atual (exceto no modo Dia) */
          .fc-dayGridWeek-view .fc-daygrid-day.fc-day-today:hover,
          .fc-dayGridWeek-view .fc-daygrid-day.fc-day-today:focus,
          .fc-dayGridMonth-view .fc-daygrid-day.fc-day-today:hover,
          .fc-dayGridMonth-view .fc-daygrid-day.fc-day-today:focus {
            background-color: #feffd5 !important;
          }

          .fc-dayGridDay-view .fc-day-today:hover,
          .fc-view-dayGridDay .fc-day-today:hover,
          .fc-dayGridDay-view .fc-day-today:focus,
          .fc-view-dayGridDay .fc-day-today:focus {
            background-color: #ffffff !important;
          }

          /* Remover cor azul de seleção/clique */
          .fc .fc-highlight {
            background: transparent !important;
          }

          .fc .fc-daygrid-day.fc-day-selected {
            background-color: transparent !important;
          }

          .fc-dayGridWeek-view .fc-daygrid-day.fc-day-today.fc-day-selected,
          .fc-dayGridMonth-view .fc-daygrid-day.fc-day-today.fc-day-selected {
            background-color: #feffd5 !important;
          }

          .fc-dayGridDay-view .fc-day-today.fc-day-selected,
          .fc-view-dayGridDay .fc-day-today.fc-day-selected {
            background-color: #ffffff !important;
          }

          .fc-event-custom:hover {
            transform: scale(1.15);
            z-index: 100 !important;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
            overflow: visible !important;
          }

          /* Garantir que o harness não corte o zoom */
          .fc-daygrid-event-harness:hover {
            z-index: 100 !important;
          }

          /* Área de cards com altura máxima dinâmica e scroll interno */
          .fc .fc-daygrid-day-events {
            padding: 10px !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
            min-height: 0 !important;
            /* A altura máxima será 75% da altura da tela, mas encolhe se houver poucos cards */
            max-height: 75vh !important; 
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }
          
          /* Garante que o container de eventos não reserve espaço extra */
          .fc-daygrid-day-events:after,
          .fc-daygrid-day-events:before {
            display: none !important;
          }

          /* Estilo específico para visualização de Dia (fileira de cards) */
          .fc-dayGridDay-view .fc-daygrid-day-frame,
          .fc-view-dayGridDay .fc-daygrid-day-frame {
            min-height: 0 !important;
            max-height: 80vh !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
          }

          .fc-dayGridDay-view .fc-daygrid-day-events,
          .fc-view-dayGridDay .fc-daygrid-day-events {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            max-height: none !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            gap: 12px !important;
            align-content: flex-start !important;
            justify-content: flex-start !important;
            padding: 16px !important;
            padding-left: 16px !important;
            overflow-y: auto !important;
          }

          .fc-dayGridDay-view .fc-daygrid-event-harness,
          .fc-view-dayGridDay .fc-daygrid-event-harness {
            flex: 0 0 300px !important;
            width: 300px !important;
            max-width: 300px !important;
          }

          @media (max-width: 768px) {
            .fc-dayGridDay-view .fc-daygrid-event-harness,
            .fc-view-dayGridDay .fc-daygrid-event-harness {
              width: 100% !important;
              max-width: 100% !important;
              flex-basis: 100% !important;
            }
          }

          .fc-daygrid-event-harness {
            margin: 0 !important;
            padding: 0 !important;
            min-height: auto !important;
          }

          /* Garantir que o conteúdo do evento ocupe o espaço */
          .fc-event-custom {
            min-height: 100px !important;
          }

          /* Remover estilos de slots que não serão mais usados se estivermos em dayGrid */
          .fc .fc-timegrid-slot {
            height: 100px !important;
          }

          .fc-v-event {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
          }

          /* Remover shadow/outline ao clicar ou focar em evento */
          .fc-event,
          .fc-event:focus,
          .fc-event:active,
          .fc-event-selected {
            outline: none !important;
            box-shadow: none !important;
            -webkit-tap-highlight-color: transparent !important;
          }

          .fc-event-custom:focus,
          .fc-event-custom:active {
            outline: none !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
          }

          /* Divisores de período (Manhã/Tarde/Noite/Madrugada) */
          .fc-daygrid-event:has(.fc-divider-event) {
            pointer-events: none !important;
            cursor: default !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
          }
          .fc-daygrid-event:has(.fc-divider-event):hover {
            transform: none !important;
            box-shadow: none !important;
          }
          .fc-divider-event {
            pointer-events: none !important;
            cursor: default !important;
          }

          /* Divisores de período em coluna hovered (fundo escuro) */
          .fc-dayGridWeek-view
            .fc-daygrid-day.fc-week-col-hovered:not(.fc-day-today)
            .fc-divider-event
            span {
            background-color: rgba(255, 255, 255, 0.92) !important;
            border-color: rgba(255, 255, 255, 0.3) !important;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25) !important;
          }
          .fc-dayGridWeek-view
            .fc-daygrid-day.fc-week-col-hovered:not(.fc-day-today)
            .fc-divider-event
            > div {
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255, 255, 255, 0.25) 20%,
              rgba(255, 255, 255, 0.25) 80%,
              transparent
            ) !important;
          }
          /* Ícone Noite em fundo escuro: roxo mais claro puxado pro branco */
          .fc-dayGridWeek-view
            .fc-daygrid-day.fc-week-col-hovered:not(.fc-day-today)
            .fc-divider-event[data-period="Noite"]
            svg {
            color: #c4b5fd !important;
          }

          /* Remover fundo escuro sem border-radius do wrapper FullCalendar */
          .fc-h-event,
          .fc-h-event:focus,
          .fc-h-event:active,
          .fc-h-event.fc-event-selected,
          .fc-daygrid-event,
          .fc-daygrid-event:focus,
          .fc-daygrid-event:active,
          .fc-daygrid-event.fc-event-selected,
          .fc-daygrid-block-event,
          .fc-daygrid-block-event:focus,
          .fc-daygrid-block-event:active,
          .fc-daygrid-block-event.fc-event-selected {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            outline: none !important;
          }

          /* Remover overlay escuro do pseudo-elemento ::after do FullCalendar */
          .fc-event::after,
          .fc-event::before,
          .fc-event-selected::after,
          .fc-event-selected::before,
          .fc-h-event::after,
          .fc-h-event::before,
          .fc-daygrid-event::after,
          .fc-daygrid-event::before,
          .fc-daygrid-block-event::after,
          .fc-daygrid-block-event::before {
            display: none !important;
            background: transparent !important;
            content: none !important;
          }

          /* Melhorar visual do scroll */
          .fc-scroller {
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 transparent;
          }

          .fc-scroller::-webkit-scrollbar {
            width: 6px;
          }

          .fc-scroller::-webkit-scrollbar-track {
            background: transparent;
          }

          .fc-scroller::-webkit-scrollbar-thumb {
            background-color: #cbd5e1;
            border-radius: 20px;
          }

          /* Popover "+X mais" (Fix UI Bug) */
          .fc-more-popover {
            z-index: 9999 !important;
            background: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 24px !important;
            box-shadow:
              0 20px 25px -5px rgba(0, 0, 0, 0.1),
              0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
            overflow: hidden !important;
            width: 350px !important;
            animation: fcPopoverFadeIn 0.2s ease-out;
          }

          @keyframes fcPopoverFadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .fc-more-popover .fc-popover-header {
            background: #ffffff !important;
            padding: 16px 20px !important;
            border-bottom: 1px solid #f1f5f9 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
          }

          .fc-more-popover .fc-popover-title {
            font-size: 13px !important;
            font-weight: 900 !important;
            color: #1e293b !important;
            text-transform: uppercase !important;
            letter-spacing: 0.1em !important;
          }

          .fc-more-popover .fc-popover-close {
            background: #f1f5f9 !important;
            border-radius: 50% !important;
            width: 28px !important;
            height: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            color: #64748b !important;
            opacity: 1 !important;
            transition: all 0.2s !important;
            font-size: 14px !important;
            cursor: pointer !important;
          }

          .fc-more-popover .fc-popover-close:hover {
            background: #e2e8f0 !important;
            color: #0f172a !important;
          }

          .fc-more-popover .fc-popover-body {
            padding: 16px !important;
            max-height: 400px !important;
            overflow-y: auto !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
          }

          /* Scrollbar para o popover */
          .fc-more-popover .fc-popover-body::-webkit-scrollbar {
            width: 6px;
          }

          .fc-more-popover .fc-popover-body::-webkit-scrollbar-track {
            background: transparent;
          }

          .fc-more-popover .fc-popover-body::-webkit-scrollbar-thumb {
            background-color: #cbd5e1;
            border-radius: 20px;
          }

          .fc-more-popover .fc-popover-body .fc-daygrid-event-harness {
            min-height: auto !important;
            margin-bottom: 4px !important;
          }
        `}</style>

            {/* Overlay de carregamento durante navegação */}
            {showCalendarWithOverlay && (
              <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-20 rounded-b-[2rem]">
                <Loader2 size={48} className="text-blue-500 animate-spin" />
                <p className="font-bold text-lg text-slate-500 mt-4">
                  Carregando ordens de serviço...
                </p>
              </div>
            )}

            {/* Overlay de Vazio - só mostrar se não estiver carregando */}
            {isEmpty && (
              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center z-10 rounded-b-[2rem]">
                <CalendarDays size={64} className="text-slate-300 mb-4" />
                <p className="font-bold text-lg text-slate-400">
                  Nenhuma OS encontrada para exibir no calendário.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Legenda de Status */}
      {!hideStatusLegend && (
        <div className="px-4 md:px-6 py-4 border-t border-slate-200 bg-slate-50/30">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Status:
            </span>
            {Object.entries(statusColors)
              .filter(([status]) => status !== "Cancelado")
              .map(([status, colors]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colors.dot }}
                  />
                  <span className="text-xs font-semibold text-slate-600">
                    {status}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
