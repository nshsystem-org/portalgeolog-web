"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { logPageView } from "@/lib/frontend-logger";
import { useAuth } from "@/context/AuthContext";

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const lastLoggedPathname = useRef<string | null>(null);

  useEffect(() => {
    if (pathname && user && pathname !== lastLoggedPathname.current) {
      logPageView(pathname, {
        userEmail: user.email,
        userNome: profile?.nome,
        userType: profile?.tipo_usuario,
        userCategory: profile?.categoria,
      });
      lastLoggedPathname.current = pathname;
    }
  }, [pathname, user, profile]);

  return <>{children}</>;
}
