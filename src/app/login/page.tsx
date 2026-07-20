"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { FormErrorMessage } from "@/components/ui/FormErrorMessage";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const success = await login(email, password);
      if (success) {
        const redirect = new URLSearchParams(window.location.search).get(
          "redirect",
        );
        router.push(redirect ?? "/portal/dashboard");
      } else {
        setError("E-mail ou senha inválidos. Tente novamente.");
      }
    } catch (err: unknown) {
      console.error(err);
      setError("Ocorreu um erro ao tentar fazer login.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#001226] flex text-white font-sans">
      {/* Left side - Branded presentation */}
      <div className="hidden lg:flex flex-1 flex-col justify-between bg-[var(--color-geolog-blue)] p-16 text-white relative overflow-hidden text-left border-r border-white/5">
        <div className="z-10">
          <div className="flex items-center gap-4 mb-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Geolog Logo"
              className="h-14 w-auto brightness-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            />
            <span className="text-2xl font-black tracking-tighter text-white uppercase">
              Portal Geolog
            </span>
          </div>

          <h2 className="text-6xl font-black mb-8 leading-[1.1] tracking-tighter">
            O cérebro da sua <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              operação logística.
            </span>
          </h2>
          <p className="text-xl text-blue-200/70 max-w-md leading-relaxed font-medium">
            Acesse o painel para gerenciar Ordens de Serviço, rastrear a frota e
            acompanhar análises de custos em tempo real.
          </p>
        </div>

        <div className="z-10 flex items-center gap-6 text-sm font-bold text-blue-300/50 uppercase tracking-widest">
          <span>Segurança Criptografada</span>
          <span className="h-1 w-1 bg-blue-500 rounded-full"></span>
          <span>Cloud Sync</span>
        </div>

        {/* Abstract background shapes */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[30rem] h-[30rem] bg-blue-600/10 rounded-full blur-[120px]"></div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-12 bg-[#001226]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-lg space-y-12"
        >
          <div className="text-center lg:text-left flex flex-col items-center lg:items-start">
            <div className="lg:hidden flex items-center gap-4 mb-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Geolog Logo" className="h-12 w-auto" />
              <span className="text-2xl font-black tracking-tighter text-white uppercase">
                Portal Geolog
              </span>
            </div>
            <h3 className="text-5xl font-black text-white tracking-tight">
              Login corporativo
            </h3>
            <p className="text-lg text-blue-200/70 mt-4 font-medium">
              Faça o login com as suas credenciais para acessar o painel.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <FormErrorMessage message={error} variant="banner" />
              </motion.div>
            )}
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-black text-blue-200/40 uppercase tracking-widest mb-4 ml-1">
                  E-mail corporativo
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-blue-200/20 group-focus-within:text-cyan-400 transition-colors" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="block w-full pl-14 pr-4 py-5 border border-white/5 rounded-2xl bg-white/5 text-white placeholder:text-white/10 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none transition-all text-base font-bold"
                    placeholder="exemplo@geolog.com.br"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-black text-blue-200/40 uppercase tracking-widest mb-4 ml-1">
                  Senha de acesso
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-blue-200/20 group-focus-within:text-cyan-400 transition-colors" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="block w-full pl-14 pr-4 py-5 border border-white/5 rounded-2xl bg-white/5 text-white placeholder:text-white/10 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none transition-all text-base font-bold"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <a
                href="#"
                className="text-sm font-black text-cyan-400/60 hover:text-cyan-400 uppercase tracking-widest transition-colors"
              >
                Redefinir Senha
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-5 px-4 border border-transparent text-base font-black rounded-2xl text-white bg-blue-600 hover:bg-blue-500 focus:outline-none shadow-xl shadow-blue-900/40 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <span className="flex items-center gap-3 uppercase tracking-widest">
                  Entrar no Portal
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
