"use client";

import React, { useState, useRef } from "react";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { Megaphone, Check } from "lucide-react";

const STYLES = {
  info: {
    bg: "bg-gradient-to-r from-blue-50 to-blue-100/50",
    border: "border-l-4 border-blue-500",
    text: "text-blue-900",
    icon: "text-blue-600",
    iconBg: "bg-blue-100",
  },
  warning: {
    bg: "bg-gradient-to-r from-amber-50 to-amber-100/50",
    border: "border-l-4 border-amber-500",
    text: "text-amber-900",
    icon: "text-amber-600",
    iconBg: "bg-amber-100",
  },
  error: {
    bg: "bg-gradient-to-r from-red-50 to-red-100/50",
    border: "border-l-4 border-red-500",
    text: "text-red-900",
    icon: "text-red-600",
    iconBg: "bg-red-100",
  },
  success: {
    bg: "bg-gradient-to-r from-green-50 to-green-100/50",
    border: "border-l-4 border-green-500",
    text: "text-green-900",
    icon: "text-green-600",
    iconBg: "bg-green-100",
  },
};

export default function AnnouncementBanner() {
  const { announcements, loading, dismissAnnouncement } = useAnnouncements();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  if (loading || announcements.length === 0) {
    return null;
  }

  // Mostrar apenas o aviso de maior prioridade
  const topAnnouncement = announcements[0];
  const style = STYLES[topAnnouncement.type];
  const isDismissible = topAnnouncement.type === "success";

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismissAnnouncement(topAnnouncement.id);
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsDropdownOpen(false);
    }, 200);
  };

  return (
    <div
      className="relative max-w-2xl mx-auto"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
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
        className={`absolute left-0 right-0 mt-2 rounded-2xl border-2 border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden transition-all duration-300 ease-in-out bg-white ${
          isDropdownOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <div className="p-6 pb-8">
          <div
            className="text-sm text-slate-700 leading-relaxed mb-6 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: topAnnouncement.message }}
          />
          {isDismissible && (
            <button
              onClick={handleDismiss}
              className="w-full py-2.5 px-4 bg-slate-100 text-slate-700 font-semibold text-sm rounded-xl hover:bg-green-100 hover:text-green-700 hover:border-green-200 transition-colors flex items-center justify-center gap-2 mb-6 border border-slate-200 cursor-pointer"
            >
              <Check size={16} />
              Li e Entendi
            </button>
          )}
          <div className="flex items-center gap-4 text-xs opacity-70 pt-4 border-t border-slate-200">
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
