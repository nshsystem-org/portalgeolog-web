"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Megaphone, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { useAnnouncements, type Announcement } from "@/hooks/useAnnouncements";
import { logInfo } from "@/lib/frontend-logger";

const STORAGE_PREFIX = "announcement-banner-seen-v2";

const STYLES = {
  info: {
    bg: "bg-gradient-to-br from-sky-50 via-blue-50 to-white",
    border: "border-sky-200",
    text: "text-sky-900",
    icon: "text-sky-600",
    iconBg: "bg-sky-100",
  },
  warning: {
    bg: "bg-gradient-to-br from-amber-50 via-orange-50 to-white",
    border: "border-amber-200",
    text: "text-amber-900",
    icon: "text-amber-600",
    iconBg: "bg-amber-100",
  },
  error: {
    bg: "bg-gradient-to-br from-red-50 via-rose-50 to-white",
    border: "border-red-200",
    text: "text-red-900",
    icon: "text-red-600",
    iconBg: "bg-red-100",
  },
  success: {
    bg: "bg-gradient-to-br from-emerald-50 via-green-50 to-white",
    border: "border-emerald-200",
    text: "text-emerald-900",
    icon: "text-emerald-600",
    iconBg: "bg-emerald-100",
  },
} as const;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getStorageKey(announcement: Announcement): string {
  return `${STORAGE_PREFIX}:${announcement.id}:${announcement.updated_at}`;
}

export default function AnnouncementBanner() {
  const { announcements, loading } = useAnnouncements();
  const visibleAnnouncement = announcements[0] ?? null;

  if (loading || !visibleAnnouncement) {
    return null;
  }

  return (
    <AnnouncementBannerCard
      key={getStorageKey(visibleAnnouncement)}
      announcement={visibleAnnouncement}
    />
  );
}

function AnnouncementBannerCard({
  announcement,
}: {
  announcement: Announcement;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasClicked, setHasClicked] = useState(false);
  const style = STYLES[announcement.type];
  const storageKey = getStorageKey(announcement);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsExpanded(false);
      setHasClicked(localStorage.getItem(`${storageKey}-clicked`) === "1");
    });

    // Log de recebimento do aviso
    logInfo("AnnouncementBanner", `Aviso recebido: ${announcement.title}`, {
      announcementId: announcement.id,
      type: announcement.type,
      expiresAt: announcement.expires_at,
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [storageKey, announcement]);

  // Log de exibição do botão "clique aqui"
  useEffect(() => {
    if (!hasClicked) {
      logInfo("AnnouncementBanner", `Botão "Clique aqui" exibido: ${announcement.title}`, {
        announcementId: announcement.id,
        type: announcement.type,
      });
    }
  }, [hasClicked, announcement]);

  const handleOpen = (event: MouseEvent<HTMLDivElement>): void => {
    event.stopPropagation();

    localStorage.setItem(storageKey, "1");
    localStorage.setItem(`${storageKey}-clicked`, "1");
    setHasClicked(true);
    setIsExpanded((prev) => !prev);

    // Log de clique no botão/aviso
    logInfo("AnnouncementBanner", `Clique no aviso: ${announcement.title}`, {
      announcementId: announcement.id,
      type: announcement.type,
      action: isExpanded ? "fechar" : "abrir",
    });
  };

  return (
    <div className="relative w-[min(26rem,calc(100vw-2rem))] shrink-0 h-16">
      <div
        className={`relative h-full rounded-[1.5rem] border ${style.border} ${style.bg} shadow-lg shadow-slate-200/60 cursor-pointer transition-all hover:shadow-xl hover:scale-[1.02]`}
        onClick={handleOpen}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.8),transparent_48%)]" />
        <div className="relative h-full px-5 py-2.5 pr-10 flex items-center">
          <div className="flex items-center gap-3.5">
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${style.iconBg}`}>
              <Megaphone size={18} className={style.icon} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[9px] font-black uppercase tracking-[0.3em] ${style.text} leading-none mb-1`}>
                Aviso importante
              </p>
              <p className={`text-sm font-black leading-tight ${style.text} truncate`}>
                {announcement.title}
              </p>
            </div>
          </div>
        </div>

        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isExpanded ? (
            <ChevronUp size={18} className={style.text} />
          ) : (
            <ChevronDown size={18} className={style.text} />
          )}
        </div>
      </div>

      <AnimatePresence>
        {!hasClicked && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute -bottom-[58px] -right-12 z-50"
          >
            <div className="relative flex flex-col items-start">
              {/* Bolinha Pulsante (Alinhada com o canto direito da div) */}
              <div className="relative -mb-1">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping opacity-75" />
                <div className="absolute top-0 left-0 w-2.5 h-2.5 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.9)]" />
                
                {/* Linha Conectora Curva ou Diagonal */}
                <div className="absolute top-2 left-[5px] w-[20px] h-[30px] border-l-2 border-b-2 border-red-500/40 rounded-bl-2xl" />
              </div>

              {/* Botão/Span (Deslocado para a direita e para baixo) */}
              <div 
                className="group relative mt-6 ml-6 inline-flex items-center gap-2 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white px-5 py-2.5 rounded-full shadow-[0_10px_25px_-5px_rgba(220,38,38,0.5)] border border-white/20 whitespace-nowrap transition-all hover:scale-105 hover:shadow-[0_15px_35px_-5px_rgba(220,38,38,0.6)]"
              >
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                  Clique aqui
                </span>
                <ArrowRight size={14} className="animate-pulse" />
                
                {/* Efeito de brilho */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="absolute left-0 top-[calc(100%+0.75rem)] z-[9999] w-full overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl shadow-slate-300/40"
          >
            <div className="flex items-start gap-4 border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div className="flex-1">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">
                  Mensagem do aviso
                </p>
              </div>
            </div>

            <div className="px-6 py-5 bg-white">
              <div
                className="prose prose-sm max-w-none text-slate-700"
                dangerouslySetInnerHTML={{ __html: announcement.message }}
              />

              <div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500">
                <Check size={14} className="text-emerald-500" />
                <span>Criado em {formatDate(announcement.created_at)}</span>
                {announcement.expires_at && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span>Expira em {formatDate(announcement.expires_at)}</span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
