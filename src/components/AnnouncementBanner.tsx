"use client";

import React from "react";
import { useAnnouncements, Announcement } from "@/hooks/useAnnouncements";
import { Info, AlertTriangle, XCircle, CheckCircle, Megaphone } from "lucide-react";

const ICONS = {
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  success: CheckCircle,
};

const STYLES = {
  info: {
    bg: "bg-gradient-to-r from-blue-50 to-blue-100/50",
    border: "border-l-4 border-blue-500",
    text: "text-blue-900",
    icon: "text-blue-600",
    iconBg: "bg-blue-100",
    dropdown: "bg-blue-50 border-blue-200",
  },
  warning: {
    bg: "bg-gradient-to-r from-amber-50 to-amber-100/50",
    border: "border-l-4 border-amber-500",
    text: "text-amber-900",
    icon: "text-amber-600",
    iconBg: "bg-amber-100",
    dropdown: "bg-amber-50 border-amber-200",
  },
  error: {
    bg: "bg-gradient-to-r from-red-50 to-red-100/50",
    border: "border-l-4 border-red-500",
    text: "text-red-900",
    icon: "text-red-600",
    iconBg: "bg-red-100",
    dropdown: "bg-red-50 border-red-200",
  },
  success: {
    bg: "bg-gradient-to-r from-green-50 to-green-100/50",
    border: "border-l-4 border-green-500",
    text: "text-green-900",
    icon: "text-green-600",
    iconBg: "bg-green-100",
    dropdown: "bg-green-50 border-green-200",
  },
};

export default function AnnouncementBanner() {
  const { announcements, loading } = useAnnouncements();

  if (loading || announcements.length === 0) {
    return null;
  }

  // Mostrar apenas o aviso de maior prioridade
  const topAnnouncement = announcements[0];
  const Icon = ICONS[topAnnouncement.type];
  const style = STYLES[topAnnouncement.type];

  return (
    <div className="relative max-w-2xl mx-auto group">
      <div
        className={`${style.bg} ${style.border} ${style.text} px-6 py-4 flex items-center gap-4 shadow-sm cursor-pointer transition-all hover:shadow-md`}
      >
        <div className={`p-2.5 rounded-xl ${style.iconBg} flex-shrink-0`}>
          <Megaphone size={20} className={style.icon} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base mb-1">{topAnnouncement.title}</p>
          {topAnnouncement.subtitle && (
            <p className="text-sm opacity-90 leading-relaxed">{topAnnouncement.subtitle}</p>
          )}
        </div>
      </div>

      {/* Dropdown suave com mensagem completa */}
      <div
        className={`absolute left-0 right-0 mt-2 rounded-2xl border-2 shadow-xl overflow-hidden transition-all duration-300 ease-in-out ${
          "opacity-0 -translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto"
        } ${style.dropdown}`}
      >
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className={`p-2 rounded-lg ${style.iconBg} flex-shrink-0`}>
              <Icon size={16} className={style.icon} />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-lg mb-1">{topAnnouncement.title}</h4>
              {topAnnouncement.subtitle && (
                <p className="text-sm font-medium opacity-80 mb-2">{topAnnouncement.subtitle}</p>
              )}
              <p className="text-sm opacity-90 leading-relaxed">{topAnnouncement.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs opacity-70 pt-4 border-t border-black/10">
            <span>
              Criado em {new Date(topAnnouncement.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
            {topAnnouncement.expires_at && (
              <span>
                • Expira em{" "}
                {new Date(topAnnouncement.expires_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
