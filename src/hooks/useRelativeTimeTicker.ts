"use client";

import { useEffect, useState } from "react";

const MINUTE_IN_MS = 60_000;

function getMsUntilNextMinute(now: number): number {
  const remainder = now % MINUTE_IN_MS;
  return remainder === 0 ? MINUTE_IN_MS : MINUTE_IN_MS - remainder;
}

export function useRelativeTimeTicker(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let timeoutId: number | null = null;

    const schedule = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      setNow(Date.now());
      timeoutId = window.setTimeout(schedule, getMsUntilNextMinute(Date.now()));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          timeoutId = null;
        }
        return;
      }

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      schedule();
    };

    schedule();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled]);

  return now;
}
