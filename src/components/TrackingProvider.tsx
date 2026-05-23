"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { logPageView } from "@/lib/frontend-logger";
import { useAuth } from "@/context/AuthContext";

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile } = useAuth();

  useEffect(() => {
    if (pathname && user) {
      logPageView(pathname, {
        userEmail: user.email,
        userNome: profile?.nome,
        userType: profile?.tipo_usuario,
        userCategory: profile?.categoria,
      });
    }
  }, [pathname, user, profile]);

  return <>{children}</>;
}
