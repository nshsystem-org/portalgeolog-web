"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  DollarSign,
  Clock,
  Package,
  ArrowRight,
} from "lucide-react";

/**
 * Modal bloqueante que aparece quando o cron de pendências dispara uma
 * notificação com metadata.kind === "pendencia_alert".
 *
 * - Backdrop escuro intransponível (não fecha ao clicar fora)
 * - Header gradiente vermelho (mesma identidade do botão PendenciaWarnings)
 * - Breakdown por categoria (sem valor, atrasadas, docagens)
 * - Botão "Revisar agora" → /portal/os?filter=pendencias
 * - Botão "Lembrar mais tarde" → fecha e grava timestamp em localStorage
 *
 * O cooldown de 2h é controlado pelo layout, não pelo modal.
 */

const COOLDOWN_KEY = "pendencia-alert-dismissed-at";
const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2h

export interface PendenciaAlertData {
  semValor: number;
  atrasadas: number;
  docagens: number;
  total: number;
}

interface PendenciaAlertModalProps {
  data: PendenciaAlertData | null;
  onClose: () => void;
  onReview?: () => void;
  userName?: string | null;
}

export function shouldShowPendenciaAlert(data: PendenciaAlertData | null): boolean {
  if (!data || data.total === 0) return false;
  try {
    const dismissedAt = localStorage.getItem(COOLDOWN_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < COOLDOWN_MS) return false;
    }
  } catch {
    // ignore
  }
  return true;
}

export function dismissPendenciaAlert(): void {
  try {
    localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
  } catch {
    // ignore
  }
}

export default function PendenciaAlertModal({
  data,
  onClose,
  onReview,
  userName,
}: PendenciaAlertModalProps) {
  // Primeiro nome do usuário (ex: "João Silva" → "João")
  const primeiroNome = userName?.split(" ")[0]?.trim() || null;

  const handleReview = () => {
    dismissPendenciaAlert();
    onClose();
    // Abre o dropdown de pendências no topbar (sinal externo)
    onReview?.();
  };

  if (!data || data.total === 0) return null;

  const categorias = [
    {
      key: "semValor",
      label: "Faltando valores",
      description: "OS finalizadas sem valor bruto e/ou custo",
      icon: DollarSign,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      border: "border-emerald-100",
      gradient: "from-emerald-50 to-emerald-50",
      count: data.semValor,
    },
    {
      key: "atrasadas",
      label: "Atrasadas / Não iniciadas",
      description: "Data passada ou horário já vencido",
      icon: Clock,
      iconColor: "text-red-500",
      iconBg: "bg-red-50",
      border: "border-red-100",
      gradient: "from-red-50 to-red-50",
      count: data.atrasadas,
    },
    {
      key: "docagens",
      label: "Docagens não finalizadas",
      description: "Instâncias com data no passado pendentes",
      icon: Package,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
      border: "border-violet-100",
      gradient: "from-violet-50 to-violet-50",
      count: data.docagens,
    },
  ].filter((c) => c.count > 0);

  return (
    <AnimatePresence>
      <>
        {/* Backdrop escuro intransponível */}
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000]" />

          {/* Modal centralizado — largura responsiva para telas pequenas */}
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative w-full max-w-[28rem] sm:max-w-md md:max-w-lg lg:max-w-xl bg-white rounded-3xl shadow-2xl shadow-black/40 overflow-hidden"
            >
              {/* Header com design refinado - Azul profundo com acento vermelho para urgência profissional */}
              <div className="relative bg-[#001c3a] p-8 text-white overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-red-500/20 rounded-xl backdrop-blur-md border border-red-500/30">
                        <AlertTriangle size={24} className="text-red-400" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10 text-blue-100">
                        Sistema de Alerta
                      </span>
                    </div>
                  </div>

                  <h2 className="text-3xl font-black tracking-tight leading-none mb-3 flex items-baseline gap-3 flex-wrap">
                    <span>Atenção</span>
                    <span className="text-red-500">Pendências</span>
                  </h2>
                  <p className="text-slate-300 text-sm font-bold uppercase tracking-wider">
                    {primeiroNome ? `${primeiroNome}, você precisa revisar` : "Você precisa revisar"}
                  </p>
                </div>
              </div>

              {/* Conteúdo — breakdown por categoria */}
              <div className="p-8 space-y-4 bg-white">
                <div className="space-y-3">
                  {categorias.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <div
                        key={cat.key}
                        className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors group"
                      >
                        <div className={`p-3 ${cat.iconBg} rounded-xl flex-shrink-0 group-hover:scale-110 transition-transform`}>
                          <Icon size={20} className={cat.iconColor} />
                        </div>
                        <div className="flex-1 min-w-0 pr-3">
                          <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">
                            {cat.label}
                          </h3>
                          <p className="text-[11px] text-slate-500 font-bold mt-1">
                            {cat.description}
                          </p>
                        </div>
                        <div className="flex flex-col items-end pl-4 border-l border-slate-200/60 ml-auto">
                          <div className={`text-3xl font-black ${cat.iconColor} tabular-nums leading-none`}>
                            {cat.count}
                          </div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mt-1.5">
                            {cat.count > 1 ? "itens" : "item"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Aviso sobre o próximo alerta */}
                <div className="flex items-start gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                  <Clock
                    size={16}
                    className="text-blue-500 mt-0.5 flex-shrink-0"
                  />
                  <p className="text-[11px] text-blue-900/70 font-bold leading-relaxed">
                    Este aviso é bloqueante para garantir a integridade dos dados. 
                    As pendências listadas acima precisam ser tratadas agora.
                  </p>
                </div>

                {/* Botão Único - Revisar Agora */}
                <div className="pt-2">
                  <button
                    onClick={handleReview}
                    className="w-full py-5 bg-[#001c3a] text-white font-black text-sm uppercase tracking-[0.2em] rounded-2xl hover:bg-[#002d5e] transition-all shadow-xl shadow-blue-900/20 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 group"
                  >
                    Revisar agora
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
      </>
    </AnimatePresence>
  );
}

export { COOLDOWN_KEY, COOLDOWN_MS };
