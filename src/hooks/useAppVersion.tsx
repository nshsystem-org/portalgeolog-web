"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logInfo } from "@/lib/frontend-logger";

type AppVersionRow = {
  version: string;
  build_hash: string;
  deployed_at: string;
  deployed_by: string;
  notes: string | null;
};

type PendingReloadInfo = {
  fromVersion: string | null;
  toVersion: string;
  detectedAt: string;
};

const VERSION_CHECK_INTERVAL = 300_000; // 5 minutos (300 segundos) - polling como fallback para Realtime
const AUTO_RELOAD_DELAY = 60_000;
const PENDING_RELOAD_KEY = "geolog-app-version-pending-reload";

export function useAppVersion() {
  const supabase = useMemo(() => createClient(), []);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateCountdown, setUpdateCountdown] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>("");
  const currentVersionRef = useRef<string | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const toastShownRef = useRef(false);
  const reloadLoggedRef = useRef(false);

  // Busca o nome do usuário logado para personalizar o toast
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const name =
        (data.user?.user_metadata?.full_name as string | undefined) ||
        (data.user?.user_metadata?.name as string | undefined) ||
        (data.user?.email?.split("@")[0] as string | undefined) ||
        "";
      setUserName(name);
    });
  }, [supabase]);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setUpdateCountdown(null);
  }, []);

  const logSuccessfulReload = useCallback(async (version: string) => {
    if (reloadLoggedRef.current) return;

    const pendingRaw = window.sessionStorage.getItem(PENDING_RELOAD_KEY);
    if (!pendingRaw) return;

    const navigationEntry = window.performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    const isReloadNavigation = navigationEntry?.type === "reload";

    if (!isReloadNavigation) return;

    try {
      const pending = JSON.parse(pendingRaw) as PendingReloadInfo;
      if (pending.toVersion !== version) return;

      reloadLoggedRef.current = true;
      window.sessionStorage.removeItem(PENDING_RELOAD_KEY);

      logInfo("AppVersion", "Usuário recarregou e entrou na nova versão", {
        fromVersion: pending.fromVersion,
        toVersion: pending.toVersion,
        detectedAt: pending.detectedAt,
        loadedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Falha ao registrar recarga da nova versão:", error);
    }
  }, []);

  const scheduleReload = useCallback(
    (nextVersion: string) => {
      const pendingReload: PendingReloadInfo = {
        fromVersion: currentVersionRef.current,
        toVersion: nextVersion,
        detectedAt: new Date().toISOString(),
      };

      window.sessionStorage.setItem(
        PENDING_RELOAD_KEY,
        JSON.stringify(pendingReload),
      );

      if (toastShownRef.current) return;
      toastShownRef.current = true;

      let secondsLeft = AUTO_RELOAD_DELAY / 1000;
      setUpdateCountdown(secondsLeft);

      const toastId = "app-version-update";

      const renderToast = (secs: number) => {
        const progress = ((AUTO_RELOAD_DELAY / 1000 - secs) / (AUTO_RELOAD_DELAY / 1000)) * 100;

        toast.custom(
          () => (
            <div className="w-full max-w-md pointer-events-auto">
              <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/20 border border-slate-200">
                {/* Barra de progresso no topo */}
                <div
                  className="absolute top-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />

                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Ícone com halo animado */}
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-2xl bg-blue-100 animate-ping opacity-60" />
                      <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <RefreshCw className="w-6 h-6 text-white animate-spin" style={{ animationDuration: "2s" }} />
                      </div>
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                          Nova versão disponível
                        </h3>
                      </div>
                      <p className="text-sm text-slate-600 font-medium leading-snug">
                        {userName
                          ? `Uma nova versão está disponível para você, ${userName}!`
                          : "Uma nova versão está disponível para você!"}
                      </p>
                      <p className="mt-2 text-xs text-slate-400 font-bold">
                        Recarregando automaticamente em{" "}
                        <span className="text-blue-600 font-black tabular-nums">{secs}s</span>
                      </p>

                      {/* Botões */}
                      <div className="mt-4 flex items-center gap-2">
                        <button
                          onClick={() => {
                            clearCountdown();
                            window.location.reload();
                          }}
                          className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-black uppercase tracking-wide hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                        >
                          Recarregar agora
                        </button>
                        <button
                          onClick={() => {
                            toast.dismiss(toastId);
                            clearCountdown();
                            toastShownRef.current = false;
                          }}
                          className="px-3 py-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-all cursor-pointer"
                          title="Dispensar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ),
          { id: toastId, duration: Infinity },
        );
      };

      renderToast(secondsLeft);

      countdownRef.current = setInterval(() => {
        secondsLeft -= 1;
        setUpdateCountdown(secondsLeft);
        renderToast(secondsLeft);

        if (secondsLeft <= 0) {
          clearCountdown();
          window.location.reload();
        }
      }, 1000) as unknown as NodeJS.Timeout;
    },
    [clearCountdown, userName],
  );

  const handleVersionChange = useCallback(
    (nextVersion: string) => {
      if (!nextVersion) return;

      const previousVersion = currentVersionRef.current;
      setCurrentVersion(nextVersion);
      currentVersionRef.current = nextVersion;

      if (!previousVersion) return;
      if (previousVersion === nextVersion) return;

      setUpdateAvailable(true);
      scheduleReload(nextVersion);
    },
    [scheduleReload],
  );

  const fetchLatestVersion = useCallback(async () => {
    const { data, error } = await supabase
      .from("app_versions")
      .select("version, build_hash, deployed_at, deployed_by, notes")
      .order("deployed_at", { ascending: false })
      .limit(1)
      .maybeSingle<AppVersionRow>();

    if (error) {
      console.error("Erro ao buscar versão do aplicativo:", error);
      return;
    }

    if (!data?.version) return;

    handleVersionChange(data.version);
  }, [handleVersionChange, supabase]);

  useEffect(() => {
    const initialFetchTimer = setTimeout(() => {
      void fetchLatestVersion();
    }, 0);

    pollRef.current = setInterval(() => {
      void fetchLatestVersion();
    }, VERSION_CHECK_INTERVAL) as unknown as NodeJS.Timeout;

    const channel = supabase
      .channel("app-version-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "app_versions",
        },
        (payload) => {
          const nextRow = payload.new as AppVersionRow;
          if (nextRow?.version) {
            handleVersionChange(nextRow.version);
          }
        },
      )
      .subscribe();

    return () => {
      clearTimeout(initialFetchTimer);
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
      clearCountdown();
      void supabase.removeChannel(channel);
    };
  }, [clearCountdown, fetchLatestVersion, handleVersionChange, supabase]);

  useEffect(() => {
    if (!currentVersion) return;
    void logSuccessfulReload(currentVersion);
  }, [currentVersion, logSuccessfulReload]);

  return {
    currentVersion,
    updateAvailable,
    updateCountdown,
  };
}
