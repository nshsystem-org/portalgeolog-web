"use client";

import { useEffect, useState, useRef } from "react";
import { X, Users, Zap, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "announcement-presence-feature-v1";

interface AnnouncementModalProps {
  onOpenEmployeesDropdown?: () => void;
  employeesButtonRef?: React.MutableRefObject<HTMLButtonElement | null>;
  onStepChange?: (step: "intro" | "explanation" | "closed") => void;
}

export default function AnnouncementModal({ onOpenEmployeesDropdown, employeesButtonRef, onStepChange }: AnnouncementModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"intro" | "explanation">("intro");
  const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hasSeen = localStorage.getItem(STORAGE_KEY);
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      onStepChange?.("closed");
    } else {
      onStepChange?.(step);
    }
  }, [step, isOpen, onStepChange]);

  useEffect(() => {
    if (step === "explanation" && employeesButtonRef?.current) {
      const buttonRect = employeesButtonRef.current.getBoundingClientRect();
      const dropdownWidth = 380;
      const modalWidth = 320;
      const gap = 16;
      // Posicionar modal à esquerda do dropdown, mesma altura
      const dropdownLeft = buttonRect.right - dropdownWidth;
      const modalLeft = dropdownLeft - modalWidth - gap;
      setModalPosition({
        top: buttonRect.bottom + 10,
        left: Math.max(16, modalLeft),
      });
    }
  }, [step, employeesButtonRef]);

  const handleVisualize = () => {
    setStep("explanation");
    onOpenEmployeesDropdown?.();
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {step === "intro" ? (
            <>
              {/* Backdrop escuro - não fecha ao clicar */}
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]" />

              {/* Modal centralizado para intro */}
              <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl shadow-black/30 overflow-hidden"
                >
                  {/* Header com gradiente */}
                  <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-8 text-white">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                          <Zap size={24} className="text-yellow-300" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                          Novidade
                        </span>
                      </div>
                      <h2 className="text-2xl font-black tracking-tight leading-tight">
                        Controle de Acesso em Tempo Real
                      </h2>
                      <p className="text-white/80 text-sm mt-2 font-medium">
                        Saiba quem está online no portal agora mesmo
                      </p>
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="p-8">
                    <div className="space-y-4">
                      {/* Feature 1 */}
                      <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                        <div className="p-2 bg-blue-100 rounded-xl flex-shrink-0">
                          <Users size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 mb-1">
                            Funcionários Online
                          </h3>
                          <p className="text-sm text-slate-600">
                            Clique no ícone de pessoas no cabeçalho para ver quem está ativo no momento
                          </p>
                        </div>
                      </div>

                      {/* Feature 2 */}
                      <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100">
                        <div className="p-2 bg-green-100 rounded-xl flex-shrink-0">
                          <Clock size={20} className="text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 mb-1">
                            Última Atividade
                          </h3>
                          <p className="text-sm text-slate-600">
                            Veja a última vez que cada funcionário esteve no portal
                          </p>
                        </div>
                      </div>

                      {/* Feature 3 */}
                      <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-2xl border border-purple-100">
                        <div className="p-2 bg-purple-100 rounded-xl flex-shrink-0">
                          <CheckCircle2 size={20} className="text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 mb-1">
                            Notificações em Tempo Real
                          </h3>
                          <p className="text-sm text-slate-600">
                            Receba alertas quando alguém entra no portal
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Botão Visualizar */}
                    <button
                      onClick={handleVisualize}
                      className="w-full mt-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-sm uppercase tracking-wider rounded-2xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      Visualizar
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </motion.div>
              </div>
            </>
          ) : (
            <>
              {/* Spotlight: escurece tudo exceto o dropdown */}
              {employeesButtonRef?.current && (
                <div
                  className="fixed z-[9991] pointer-events-none"
                  style={{
                    top: modalPosition.top,
                    left: Math.max(0, employeesButtonRef.current.getBoundingClientRect().right - 380),
                    width: 380,
                    height: 480,
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.7)",
                    borderRadius: 16,
                  }}
                />
              )}

              {/* Modal explicação ao lado do dropdown */}
              <motion.div
                ref={modalRef}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="fixed z-[10002] w-80 bg-white rounded-2xl shadow-2xl shadow-black/30 overflow-hidden"
                style={{
                  top: modalPosition.top,
                  left: modalPosition.left,
                }}
              >
                {/* Header explicação */}
                <div className="relative bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-6 text-white">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                        <Users size={18} className="text-white" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                        Dropdown Aberto
                      </span>
                    </div>
                    <h3 className="text-lg font-black tracking-tight">
                      Veja o Dropdown
                    </h3>
                  </div>
                </div>

                {/* Conteúdo explicação */}
                <div className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                      <div className="p-1.5 bg-emerald-100 rounded-lg flex-shrink-0">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm mb-0.5">
                          Online em Primeiro
                        </h4>
                        <p className="text-xs text-slate-600">
                          Funcionários online aparecem no topo
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
                      <div className="p-1.5 bg-blue-100 rounded-lg flex-shrink-0">
                        <Clock size={16} className="text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm mb-0.5">
                          Status Detalhado
                        </h4>
                        <p className="text-xs text-slate-600">
                          Última atividade dos offline
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Botão Entendido */}
                  <button
                    onClick={handleDismiss}
                    className="w-full mt-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Entendido
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
