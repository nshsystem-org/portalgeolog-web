"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
const AUTO_RELOAD_DELAY = 10_000;
const PENDING_RELOAD_KEY = "geolog-app-version-pending-reload";

export function useAppVersion() {
  const supabase = useMemo(() => createClient(), []);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateCountdown, setUpdateCountdown] = useState<number | null>(null);
  const currentVersionRef = useRef<string | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const toastShownRef = useRef(false);
  const reloadLoggedRef = useRef(false);

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

    const navigationEntry =
      window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
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

      toast("Nova versão disponível", {
        description: `A versão ${nextVersion} já está no ar. Recarregando em ${secondsLeft} segundos.`,
        action: {
          label: "Recarregar agora",
          onClick: () => {
            clearCountdown();
            window.location.reload();
          },
        },
        duration: Infinity,
      });

      countdownRef.current = setInterval(() => {
        secondsLeft -= 1;
        setUpdateCountdown(secondsLeft);

        if (secondsLeft <= 0) {
          clearCountdown();
          window.location.reload();
        }
      }, 1000) as unknown as NodeJS.Timeout;
    },
    [clearCountdown],
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
