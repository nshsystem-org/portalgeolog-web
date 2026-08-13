"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { hasPageAccess } from "@/lib/permissions";

/**
 * /portal/config redireciona para a primeira sub-página acessível.
 * Ordem de prioridade: acessos > perfil > financeiro > notificacoes.
 */
export default function ConfigRedirectPage() {
  const router = useRouter();
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (loading || !profile) return;

    if (hasPageAccess(profile, "config-acessos")) {
      router.replace("/portal/config/acessos");
    } else if (hasPageAccess(profile, "config-perfil")) {
      router.replace("/portal/config/perfil");
    } else if (hasPageAccess(profile, "config-financeiro")) {
      router.replace("/portal/config/financeiro");
    } else if (hasPageAccess(profile, "config-notificacoes")) {
      router.replace("/portal/config/notificacoes");
    } else {
      // Sem acesso a nenhuma sub-página de config
      router.replace("/portal/dashboard");
    }
  }, [profile, loading, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}
