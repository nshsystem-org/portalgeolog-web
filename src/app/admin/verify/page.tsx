"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck, ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { FormErrorMessage } from "@/components/ui/FormErrorMessage";

export default function AdminVerifyPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  // Se não houver sessão, redireciona para login.
  if (!loading && !user) {
    router.replace("/login?redirect=/admin/verify");
    return null;
  }

  // Se o perfil carregou e não é administrador, bloqueia.
  if (!loading && profile && profile.categoria !== "administrador") {
    router.replace("/portal/dashboard");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = (await res.json()) as { error?: string; ok?: boolean };

      if (!res.ok) {
        setError(data.error ?? "Falha na verificação.");
        setIsLoading(false);
        return;
      }

      // Token emitido — middleware liberará /admin.
      router.replace("/admin");
    } catch {
      setError("Erro de rede. Tente novamente.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#001226] flex items-center justify-center p-6 text-white">
      <div className="w-full max-w-md">
        <button
          onClick={() => router.push("/portal/dashboard")}
          className="mb-6 flex items-center gap-2 text-sm font-bold text-blue-300/70 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          Voltar ao Portal
        </button>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-2xl shadow-black/40 p-8">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-400/30 mb-4">
              <ShieldCheck className="text-blue-300" size={32} />
            </div>
            <h1 className="text-2xl font-black tracking-tight">
              Verificação de Administrador
            </h1>
            <p className="mt-2 text-sm text-blue-200/60 font-medium leading-relaxed">
              Esta é uma área protegida. Confirme sua senha para continuar.
              A sessão expira em 15 minutos por segurança.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-black uppercase tracking-widest text-blue-200/70 mb-2"
              >
                Senha
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300/50"
                  size={18}
                />
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  autoComplete="current-password"
                  required
                  className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-blue-200/30 focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-300/50 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && <FormErrorMessage message={error} />}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black text-white shadow-lg shadow-blue-500/30 transition-all"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <ShieldCheck size={18} />
              )}
              {isLoading ? "Verificando..." : "Verificar e Continuar"}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-blue-200/40 font-medium uppercase tracking-widest">
            Token JWT HMAC-SHA256 · 15 min
          </p>
        </div>
      </div>
    </div>
  );
}
