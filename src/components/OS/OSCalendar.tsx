"use client";

import React, { useMemo, useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import type { OrderService } from "@/context/DataContext";
import type { DocagemInstance } from "@/lib/supabase/docagem-queries";
import {
  deriveCyclesOperationalStatus,
  getCycleDisplayStatus,
  type CycleOperationalStatus,
} from "@/lib/os-messages";
import {
  Clock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Route,
  User,
  MapPin,
} from "lucide-react";
import { logInfo } from "@/lib/frontend-logger";

interface Cliente {
  id: string;
  nome: string;
}

type CalendarEventKind = "os" | "docagem";

interface EventContentProps {
  os?: OrderService;
  docagem?: DocagemInstance;
  clientes: Cliente[];
  status: CycleOperationalStatus | "Docagem";
  timeText?: string;
  eventStartStr?: string;
  displayDateTime?: string;
  startTime?: string;
  showArchivedOnly?: boolean;
  isMonthView?: boolean;
  isDayView?: boolean;
}

interface OSCalendarProps {
  osList: OrderService[];
  docagemInstances?: DocagemInstance[];
  clientes: Cliente[];
  onEventClick: (osId: string, position?: { x: number; y: number }) => void;
  onDocagemEventClick?: (
    instanceId: string,
    position?: { x: number; y: number },
  ) => void;
  loading?: boolean;
  hasLoaded?: boolean;
  showArchivedOnly?: boolean;
  onRangeChange?: (from: string, to: string) => void;
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

type WeekStatusCounts = Record<WeekStatus, number>;

const emptyWeekStatusCounts = (): WeekStatusCounts => ({
  Pendente: 0,
  Aguardando: 0,
  "Em Rota": 0,
  Finalizado: 0,
});

// Cores por status — backgrounds mais saturados para legibilidade no calendário
const statusColors: Record<
  string,
  { bg: string; border: string; text: string; dot: string; clockColor?: string }
> = {
  Pendente: {
    bg: "#f1f5f9",
    border: "#64748b",
    text: "#1e293b",
    dot: "#cbd5e1",
    clockColor: "#64748b",
  },
  Aguardando: {
    bg: "#e0e7ff",
    border: "#4f46e5",
    text: "#312e81",
    dot: "#4338ca",
  },
  "Em Rota": {
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
    status: CycleOperationalStatus | "Docagem";
    itineraryLabel?: string;
    itineraryIndex?: number;
    displayDateTime?: string;
    startTime?: string;
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
  status,
  timeText,
  eventStartStr,
  displayDateTime,
  startTime: propStartTime,
  showArchivedOnly,
  isMonthView,
  isDayView,
}: EventContentProps) => {
  const isDocagem = status === "Docagem";
  const colors = showArchivedOnly
    ? statusColors["Arquivado"]
    : statusColors[status] || statusColors["Pendente"];

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

  return (
    <div
      className="fc-event-custom group transition-all duration-200 hover:shadow-md"
      style={{
        backgroundColor: colors.bg,
        borderLeft: `4px solid ${colors.dot}`,
        padding: isDayView ? "32px 12px 12px 12px" : "28px 6px 5px 6px",
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
      {/* Status no canto superior direito */}
      {statusColors[status] && (
        <span
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            backgroundColor: colors.dot,
            color: "#ffffff",
            padding: "3px 8px",
            borderRadius: "6px",
            fontSize: isDayView ? "9px" : "7px",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            zIndex: 1,
          }}
        >
          {isDocagem ? "Docagem" : status}
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
      ) : (
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
      )}

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
          {docagem?.motoristaId ? "Motorista alocado" : "Sem motorista"}
        </div>
      ) : (
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
      )}

      {/* Linha 4: Horário */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: isDayView ? "8px" : "2px",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            backgroundColor: colors.clockColor || colors.dot,
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
      </div>
    </div>
  );
};

export default function OSCalendar({
  osList,
  docagemInstances = [],
  clientes,
  onEventClick,
  onDocagemEventClick,
  loading,
  hasLoaded,
  showArchivedOnly,
  onRangeChange,
}: OSCalendarProps) {
  const [currentView, setCurrentView] = useState<
    "dayGridMonth" | "dayGridWeek" | "dayGridDay"
  >("dayGridWeek");
  const calendarRef = React.useRef<FullCalendar>(null);
  const lastRangeRef = React.useRef<{ from: string; to: string } | null>(null);

  // Converter OS para eventos do FullCalendar
  const events = useMemo(() => {
    const derivedEvents: CalendarEvent[] = [];

    osList.forEach((os) => {
      const clienteNome =
        clientes.find((c) => c.id === os.clienteId)?.nome || "N/A";
      const effectiveStatus =
        os.operationalCycles && os.operationalCycles.length > 0
          ? deriveCyclesOperationalStatus(os.operationalCycles)
          : os.status.operacional;
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
            kind: "os",
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
          const eventStatus = cycle
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
              kind: "os",
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
      const colors = statusColors["Docagem"];

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
          status: "Docagem",
          displayDateTime: startDateTime,
          startTime: instance.horarioInicio,
        },
      });
    });

    return derivedEvents;
  }, [osList, docagemInstances, clientes]);

  const weekStatusCountsByDate = useMemo(() => {
    const countsByDate: Record<string, WeekStatusCounts> = {};

    events.forEach((event) => {
      const status = event.extendedProps.status;
      if (!weekStatusOrder.includes(status as WeekStatus)) {
        return;
      }

      const dateKey = event.start.split("T")[0];
      if (!countsByDate[dateKey]) {
        countsByDate[dateKey] = emptyWeekStatusCounts();
      }

      countsByDate[dateKey][status as WeekStatus] += 1;
    });

    return countsByDate;
  }, [events]);

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
          status: CycleOperationalStatus | "Docagem";
          itineraryLabel?: string;
          displayDateTime?: string;
          startTime?: string;
        };
      };
    }) => {
      const isDocagem = eventInfo.event.extendedProps.kind === "docagem";
      return (
        <EventContent
          os={isDocagem ? undefined : eventInfo.event.extendedProps.os}
          docagem={eventInfo.event.extendedProps.docagem}
          clientes={clientes}
          status={eventInfo.event.extendedProps.status}
          timeText={eventInfo.timeText}
          eventStartStr={eventInfo.event.startStr}
          displayDateTime={eventInfo.event.extendedProps.displayDateTime}
          startTime={eventInfo.event.extendedProps.startTime}
          showArchivedOnly={showArchivedOnly}
          isMonthView={currentView === "dayGridMonth"}
          isDayView={currentView === "dayGridDay"}
        />
      );
    },
    [clientes, showArchivedOnly, currentView],
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
                      ? `${meta.color}66`
                      : `${meta.color}33`,
                    backgroundColor: isToday
                      ? `${meta.color}26`
                      : `${meta.color}12`,
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

      return (
        <div
          className={`fc-os-header fc-os-header--${headerVariant}`}
          key={`header-${dateKey}-${headerVariant}`}
        >
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
                    borderColor: isToday
                      ? `${meta.color}66`
                      : `${meta.color}33`,
                    backgroundColor: isToday
                      ? `${meta.color}26`
                      : `${meta.color}12`,
                    opacity: isToday ? 1 : count === 0 ? 0.55 : 1,
                  }}
                >
                  <Icon size={iconSize} strokeWidth={iconStrokeWidth} />
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

  // Lógica de exibição baseada em hasLoaded
  const isInitialLoading = !hasLoaded && loading;
  // Mostrar overlay de loading sempre que estiver carregando, independente de ter dados anteriores
  const showCalendarWithOverlay = loading;
  const isEmpty =
    !loading && hasLoaded && osList.length === 0 && docagemInstances.length === 0;

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden relative">
      {/* Header do Calendário Customizado */}
      <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-200 bg-slate-50/50">
        {/* Navegação - Canto Esquerdo */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <ChevronLeft size={20} className="text-slate-600" />
          </button>
        </div>

        {/* Seletor de Visualização - Centralizado */}
        <div className="flex-1 flex items-center justify-center">
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
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all ${
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
        </div>

        {/* Navegação - Canto Direito */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToNext}
            className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
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
              select={handleDateSelect}
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
              dayCellContent={renderMonthDayCellContent}
              dayCellClassNames={(dateInfo) => {
                if (dateInfo.isOtherMonth) {
                  return "fc-day-other-month";
                }
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
    </div>
  );
}
