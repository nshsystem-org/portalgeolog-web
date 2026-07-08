"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Truck,
  Settings,
  Eye,
  Play,
  CheckCircle,
  Send,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { getThumbnailUrl } from "@/utils/avatar";
import {
  formatShortName,
  extractNotificationProtocolo,
  timeAgo,
} from "@/utils/notifications";
import { formatNotificationMessage } from "@/hooks/useNotifications";
import { useRelativeTimeTicker } from "@/hooks/useRelativeTimeTicker";
import { getOperationalCycleTitle } from "@/lib/os-messages";
import type { AppNotification } from "@/hooks/useNotifications";

interface MotoristaNotificationsProps {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  className?: string;
}

const driverTitles = {
  viewDetails: "Motorista visualizou os detalhes do atendimento",
  routeStart: "Rota iniciada",
  routeFinish: "Rota finalizada",
  messageSent: "Mensagem enviada ao motorista",
  messageDelivered: "Mensagem entregue ao motorista",
  delay: "Motorista em atraso",
} as const;

function isDriverTitle(
  title: string,
  value: (typeof driverTitles)[keyof typeof driverTitles],
): boolean {
  return value === "Mensagem enviada ao motorista"
    ? title.startsWith(value)
    : title === value;
}

function getDriverConfig(title: string) {
  if (isDriverTitle(title, driverTitles.viewDetails)) {
    return {
      icon: Eye,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
      label: "Visualizou detalhes",
    };
  }
  if (isDriverTitle(title, driverTitles.routeStart)) {
    return {
      icon: Play,
      color: "text-sky-600",
      bg: "bg-sky-50",
      border: "border-sky-200",
      label: "Rota iniciada",
    };
  }
  if (isDriverTitle(title, driverTitles.routeFinish)) {
    return {
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      label: "Rota finalizada",
    };
  }
  if (isDriverTitle(title, driverTitles.messageSent)) {
    return {
      icon: Send,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
      label: "Mensagem enviada",
    };
  }
  if (isDriverTitle(title, driverTitles.messageDelivered)) {
    return {
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
      label: "Mensagem entregue",
    };
  }
  if (isDriverTitle(title, driverTitles.delay)) {
    return {
      icon: AlertTriangle,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
      label: "Atraso",
    };
  }
  // Fallback para qualquer título de motorista não mapeado
  return {
    icon: Truck,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    label: "Motorista",
  };
}

function extractDriverNameFromTitle(title: string): string {
  const match = title.match(/^Mensagem enviada ao motorista\s+(.+)$/);
  return match?.[1]?.trim() ?? "";
}

export default function MotoristaNotifications({
  notifications,
  unreadCount,
  markAsRead,
  markAllAsRead,
  className,
}: MotoristaNotificationsProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const relativeTimeNow = useRelativeTimeTicker(open);

  const filtered = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.read);
    if (filter === "read") return notifications.filter((n) => n.read);
    return notifications;
  }, [notifications, filter]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleItemClick = (notification: AppNotification) => {
    markAsRead(notification.id);
    setOpen(false);

    const osIdMatch = notification.message.match(/\[OS_ID:([a-f0-9-]+)\]/);
    if (osIdMatch) {
      const osId = osIdMatch[1];
      if (pathname === "/portal/os") {
        window.dispatchEvent(
          new CustomEvent("open-os-modal", {
            bubbles: true,
            detail: { osId },
          }),
        );
      } else {
        router.push(`/portal/os?open_os=${osId}`);
      }
    }
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-3 rounded-xl relative transition-all cursor-pointer text-blue-900 bg-gradient-to-b from-sky-100 via-blue-100 to-blue-200 border border-blue-300/60 hover:from-sky-200 hover:via-blue-200 hover:to-blue-300 hover:border-blue-400/60 shadow-lg shadow-blue-300/40 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_12px_rgba(59,130,246,0.15)]"
        title={`Motoristas: ${unreadCount} não ${unreadCount === 1 ? "lida" : "lidas"}`}
      >
        <Truck size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-700 text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-[400px] bg-white rounded-2xl shadow-2xl z-[9999] overflow-hidden border border-slate-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="font-black text-lg text-slate-800">Motoristas</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                {(["all", "unread", "read"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setFilter(f);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      filter === f
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {f === "all"
                      ? "Todas"
                      : f === "unread"
                        ? "Não lidas"
                        : "Lidas"}
                  </button>
                ))}
              </div>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowSettings(!showSettings);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Opções"
                >
                  <Settings size={16} />
                </button>
                {showSettings && (
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-[10000]">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        markAllAsRead();
                        setShowSettings(false);
                      }}
                      disabled={unreadCount === 0}
                      className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Marcar todos como lidos
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-[520px] overflow-y-auto py-2 space-y-1">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <Truck size={28} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Nenhuma movimentação de motorista</p>
              </div>
            ) : (
              filtered.map((notification) => {
                const config = getDriverConfig(notification.title);
                const Icon = config.icon;
                const driverName = extractDriverNameFromTitle(
                  notification.title,
                );

                const { protocolo } = extractNotificationProtocolo(
                  notification.message,
                  notification.metadata,
                );

                const cycleKind = notification.metadata?.cycle_kind as
                  | string
                  | undefined;
                const cycleOrdinal = notification.metadata?.cycle_ordinal as
                  | number
                  | undefined;
                const cycleDesc = cycleKind
                  ? getOperationalCycleTitle({
                      kind: cycleKind as "itinerary" | "return",
                      ordinal: (cycleOrdinal ?? 1) as number,
                    }).replace(" - ", " ")
                  : null;
                const cycleIsReturn = cycleKind === "return";

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleItemClick(notification)}
                    className={`
                      relative flex items-start gap-3 p-3 mx-2 rounded-xl cursor-pointer transition-colors
                      ${
                        notification.read
                          ? "hover:bg-slate-50"
                          : "bg-gradient-to-r from-blue-100/50 to-white/50 hover:from-blue-100/70 hover:to-white/70"
                      }
                    `}
                  >
                    {/* Avatar / ícone */}
                    <div
                      className={`relative flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center ${config.bg} border ${config.border}`}
                    >
                      {notification.created_by_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            getThumbnailUrl(
                              notification.created_by_avatar_url,
                              100,
                            ) || notification.created_by_avatar_url
                          }
                          alt={notification.created_by_name || "Motorista"}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <Icon size={24} className={config.color} />
                      )}
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <p className="leading-snug">
                        <span
                          className={`text-sm font-bold ${!notification.read ? "text-slate-900" : "text-slate-400"}`}
                        >
                          {formatShortName(notification.created_by_name) ||
                            "Motorista"}
                        </span>{" "}
                        <span
                          className={`text-xs ${!notification.read ? "text-slate-700" : "text-slate-400"}`}
                        >
                          {formatNotificationMessage(
                            notification.message.replace(
                              /\s*\[OS_ID:[a-f0-9-]+\]/gi,
                              "",
                            ),
                          )}
                        </span>
                        {driverName && (
                          <span className="inline-flex items-center gap-1.5 ml-2">
                            <Truck
                              size={12}
                              className={`${!notification.read ? "text-blue-700" : "text-slate-400"}`}
                            />
                            <span
                              className={`text-xs font-bold ${!notification.read ? "text-blue-800" : "text-slate-400"}`}
                            >
                              {driverName}
                            </span>
                          </span>
                        )}
                      </p>

                      {cycleDesc && (
                        <div className="mt-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                              cycleIsReturn
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {cycleDesc}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span
                          className={`text-xs ${!notification.read ? "text-slate-600" : "text-slate-400"}`}
                        >
                          {timeAgo(notification.created_at, relativeTimeNow)}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span
                          className={`text-xs ${!notification.read ? "text-slate-600" : "text-slate-400"} capitalize`}
                        >
                          {config.label}
                        </span>
                        {protocolo && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span
                              className={`text-xs ${!notification.read ? "text-slate-600" : "text-slate-400"}`}
                            >
                              {protocolo}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {!notification.read && (
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
