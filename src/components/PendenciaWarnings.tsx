"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  X,
  Clock,
  DollarSign,
  FileText,
  Volume2,
  VolumeX,
  CalendarDays,
  CalendarRange,
  Inbox,
  Sparkles,
  Briefcase,
  UserCheck,
  FilePen,
  Package,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";

interface PendenciaItem {
  id: string;
  protocolo: string;
  os: string;
  clienteNome: string;
  data: string;
  motivo: "sem_valor" | "atrasada" | "rascunho" | "docagem";
  tipo?: "os" | "freelance" | "rascunho" | "docagem";
  ageDays?: number;
}

interface SystemPendenciaRow {
  id: string;
  source_type: "os" | "docagem";
  source_id: string;
  motivo: "sem_valor" | "atrasada" | "rascunho" | "docagem";
  protocolo: string;
  os_number: string;
  cliente_nome: string;
  data: string;
  user_id: string | null;
  age_days: number | null;
}

// Map de SystemPendenciaRow → PendenciaItem (formato esperado pelo dropdown)
function rowToItem(row: SystemPendenciaRow): PendenciaItem {
  return {
    id: row.source_id,
    protocolo: row.protocolo,
    os: row.os_number,
    clienteNome: row.cliente_nome,
    data: row.data,
    motivo: row.motivo,
    tipo: row.source_type === "docagem" ? "docagem" : "os",
    ageDays: row.age_days ?? undefined,
  };
}

// Busca todas as pendências da tabela system_pendencias via Supabase (RLS: read all).
// Filtra rascunhos pelo usuário logado; demais categorias são globais.
async function fetchSystemPendencias(userId?: string): Promise<PendenciaItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("system_pendencias")
    .select("id, source_type, source_id, motivo, protocolo, os_number, cliente_nome, data, user_id, age_days");
  if (error) throw error;
  const rows = (data || []) as unknown as SystemPendenciaRow[];
  // Rascunhos são pessoais: só mostra os do próprio usuário
  return rows
    .filter((r) => r.motivo !== "rascunho" || !r.user_id || r.user_id === userId)
    .map(rowToItem);
}

interface PendenciaWarningsProps {
  className?: string;
  /** Quando muda (incrementa), abre o dropdown externamente. */
  externalOpenSignal?: number;
}

type FiltroPeriodo = "hoje" | "semana" | "tudo";

const SOUND_ENABLED_KEY = "pendencia-sound-enabled";
const FILTRO_PERIODO_KEY = "pendencia-filtro-periodo";
const VISTOS_KEY = "pendencia-vistos";

type ItemKey = string;
type VistosSet = Set<ItemKey>;

function itemKey(item: PendenciaItem): ItemKey {
  return `${item.motivo}:${item.id}`;
}

function carregarVistos(): VistosSet {
  try {
    const stored = localStorage.getItem(VISTOS_KEY);
    if (!stored) return new Set();
    const arr = JSON.parse(stored) as unknown;
    if (Array.isArray(arr)) return new Set(arr.filter((v): v is string => typeof v === "string"));
    return new Set();
  } catch {
    return new Set();
  }
}

function salvarVistos(vistos: VistosSet): void {
  try {
    // Limita a 200 entradas para não crescer indefinidamente
    const arr = Array.from(vistos).slice(-200);
    localStorage.setItem(VISTOS_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

/**
 * Botão vermelho "Avisos de Pendências" da topbar.
 * Consolida 3 categorias mutuamente exclusivas:
 *  - sem_valor: OS finalizada sem valor bruto e/ou custo (global)
 *  - atrasada: OS atrasada ou não iniciada no dia (global, usa hora)
 *  - rascunho: rascunho antigo do usuário logado (pessoal, ageDays >= 1)
 *  - docagem: instância de docagem não finalizada com data no passado
 *
 * Invisível quando total === 0. Reage ao vivo via realtime do DataContext.
 * Otimizado: lê da tabela system_pendencias (atualizada por triggers + pg_cron).
 */
export default function PendenciaWarnings({
  className,
  externalOpenSignal,
}: PendenciaWarningsProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>(() => {
    try {
      const stored = localStorage.getItem(FILTRO_PERIODO_KEY);
      if (stored === "hoje" || stored === "semana" || stored === "tudo") {
        return stored;
      }
    } catch {
      // ignore
    }
    return "tudo";
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(SOUND_ENABLED_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SOUND_ENABLED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const changeFiltroPeriodo = useCallback((periodo: FiltroPeriodo) => {
    setFiltroPeriodo(periodo);
    try {
      localStorage.setItem(FILTRO_PERIODO_KEY, periodo);
    } catch {
      // ignore
    }
  }, []);

  // Toca um beep via Web Audio API. Tipo: "abrir" (confirmatório, 1 beep curto)
  // ou "alerta" (nova pendência, 2 bips ascendentes).
  const playBeep = useCallback(
    (tipo: "abrir" | "alerta") => {
      if (!soundEnabled) return;
      try {
        if (!audioCtxRef.current) {
          const Ctx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          if (!Ctx) return;
          audioCtxRef.current = new Ctx();
        }
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        if (ctx.state === "suspended") void ctx.resume();
        const now = ctx.currentTime;
        const config =
          tipo === "abrir"
            ? [{ freq: 660, t0: 0, dur: 0.12, gain: 0.1 }]
            : [
                { freq: 880, t0: 0, dur: 0.16, gain: 0.12 },
                { freq: 1175, t0: 0.18, dur: 0.16, gain: 0.12 },
              ];
        config.forEach(({ freq, t0, dur, gain: g }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, now + t0);
          gain.gain.linearRampToValueAtTime(g, now + t0 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + t0);
          osc.stop(now + t0 + dur);
        });
      } catch {
        // AudioContext indisponível — ignora silenciosamente
      }
    },
    [soundEnabled],
  );

  // Estado das pendências — lidas da tabela system_pendencias com Realtime.
  // Triggers em ordens_servico/docagem_instancias atualizam a tabela
  // automaticamente; pg_cron reconcilia a cada 15 min; Realtime empurra para cá.
  const [items, setItems] = useState<PendenciaItem[]>([]);
  const [counts, setCounts] = useState({
    semValor: 0,
    atrasadas: 0,
    rascunhos: 0,
    docagens: 0,
  });
  const [loaded, setLoaded] = useState(false);

  // Função para recalcular items e counts a partir de fetchSystemPendencias
  const refreshPendencias = useCallback(
    async (userId?: string) => {
      try {
        const rows = await fetchSystemPendencias(userId);
        setItems(rows);
        setCounts({
          semValor: rows.filter((r) => r.motivo === "sem_valor").length,
          atrasadas: rows.filter((r) => r.motivo === "atrasada").length,
          rascunhos: rows.filter((r) => r.motivo === "rascunho").length,
          docagens: rows.filter((r) => r.motivo === "docagem").length,
        });
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    },
    [],
  );

  useEffect(() => {
    void refreshPendencias(user?.id);

    // Realtime: escuta mudanças em system_pendencias e refaz o fetch.
    // Como a tabela é pequena (~200 linhas), um refetch simples é mais
    // simples e robusto que tracking individual de INSERT/DELETE.
    const supabase = createClient();
    const channel = supabase
      .channel("system-pendencias-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_pendencias" },
        () => {
          void refreshPendencias(user?.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshPendencias]);

  const total = items.length;
  const countSemValor = counts.semValor;
  const countAtrasadas = counts.atrasadas;
  const countRascunhos = counts.rascunhos;
  const countDocagens = counts.docagens;

  // Pulse no badge quando o total sobe (nova pendência apareceu).
  // Padrão React: ajustar state durante render quando valor muda,
  // e usar effect apenas para agendar o reset via timeout assíncrono.
  const [pulse, setPulse] = useState(false);
  const [prevTotal, setPrevTotal] = useState(total);
  if (total > prevTotal) {
    setPrevTotal(total);
    setPulse(true);
  }

  useEffect(() => {
    if (!pulse) return;
    const t = setTimeout(() => setPulse(false), 1500);
    return () => clearTimeout(t);
  }, [pulse]);

  // Som de alerta quando nova pendência aparece (Web Audio API).
  // Requer interação prévia do usuário (política autoplay dos navegadores).
  useEffect(() => {
    if (!pulse) return;
    playBeep("alerta");
  }, [pulse, playBeep]);

  // Abre o dropdown quando sinalizado externamente (ex: modal de alerta).
  useEffect(() => {
    if (externalOpenSignal && externalOpenSignal > 0) {
      setOpen(true);
      playBeep("abrir");
    }
  }, [externalOpenSignal, playBeep]);

  // Tracking de itens "vistos" para marcar "novo" na próxima sessão.
  // Vistos são persistidos em localStorage; ao abrir o dropdown, os itens
  // atuais passam a ser "vistos". Itens não vistos mostram badge "novo".
  const [vistos, setVistos] = useState<VistosSet>(() => carregarVistos());

  // Marca como vistos quando o dropdown é aberto (após render com itens).
  useEffect(() => {
    if (!open) return;
    const novosVistos = new Set(vistos);
    for (const item of items) {
      novosVistos.add(itemKey(item));
    }
    salvarVistos(novosVistos);
    setVistos(novosVistos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const ehNovo = useCallback(
    (item: PendenciaItem): boolean => !vistos.has(itemKey(item)),
    [vistos],
  );

  // Filtro por período — função pura extraída para preservar memoização
  // Pré-computa timestamps de referência uma vez por render
  const periodRefs = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayMs = now.getTime();
    const weekStartMs = todayMs - 6 * 24 * 60 * 60 * 1000;
    return { todayMs, weekStartMs };
  }, []);

  const matchPeriodo = useCallback(
    (item: PendenciaItem, periodo: FiltroPeriodo): boolean => {
      if (periodo === "tudo") return true;
      // Rascunhos e docagens: filtrar por ageDays (há quanto tempo está pendente)
      if (item.motivo === "rascunho" || item.motivo === "docagem") {
        const age = item.ageDays ?? 0;
        if (periodo === "hoje") return age <= 0;
        if (periodo === "semana") return age <= 7;
        return true;
      }
      const refStr = item.data;
      if (!refStr) return true;
      // Parse "YYYY-MM-DD" sem criar Date object
      const y = parseInt(refStr.slice(0, 4), 10);
      const m = parseInt(refStr.slice(5, 7), 10);
      const d = parseInt(refStr.slice(8, 10), 10);
      if (isNaN(y) || isNaN(m) || isNaN(d)) return true;
      const itemMs = new Date(y, m - 1, d).getTime();
      if (periodo === "hoje") return itemMs === periodRefs.todayMs;
      if (periodo === "semana") {
        return itemMs >= periodRefs.weekStartMs && itemMs <= periodRefs.todayMs;
      }
      return true;
    },
    [periodRefs],
  );

  const itemsFiltrados = useMemo(
    () => items.filter((item) => matchPeriodo(item, filtroPeriodo)),
    [items, filtroPeriodo, matchPeriodo],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleItemClick = (item: PendenciaItem) => {
    setOpen(false);
    if (item.motivo === "docagem") {
      router.push(`/portal/os?filter=pendencias&editDocagemId=${item.id}`);
      return;
    }
    const param = item.motivo === "rascunho" ? "editDraftId" : "editOSId";
    router.push(`/portal/os?${param}=${item.id}`);
  };

  const motivoConfig = {
    sem_valor: {
      label: "Faltando valores",
      icon: DollarSign,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
    },
    atrasada: {
      label: "Atrasada / Não iniciada",
      icon: Clock,
      iconColor: "text-red-500",
      iconBg: "bg-red-50",
    },
    rascunho: {
      label: "Rascunho antigo",
      icon: FileText,
      iconColor: "text-amber-500",
      iconBg: "bg-amber-50",
    },
    docagem: {
      label: "Docagem não finalizada",
      icon: Package,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
    },
  } as const;

  const tipoConfig = {
    os: {
      label: "OS",
      icon: Briefcase,
      color: "text-slate-600",
      bg: "bg-slate-100",
    },
    freelance: {
      label: "Freelance",
      icon: UserCheck,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    rascunho: {
      label: "Rascunho",
      icon: FilePen,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    docagem: {
      label: "Docagem",
      icon: Package,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
  } as const;

  const hasPendencias = total > 0;

  // Só some quando já carregou E não há pendências
  if (loaded && !hasPendencias) return null;

  return (
    <div className={`relative ${className || ""}`}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) playBeep("abrir");
        }}
        className="p-3 rounded-xl relative transition-all border cursor-pointer text-white border-red-400/80 bg-gradient-to-b from-red-400 via-red-600 to-rose-800 animate-pendencia-pulse shadow-lg shadow-red-600/40 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_-2px_4px_rgba(0,0,0,0.2),0_4px_12px_rgba(239,68,68,0.35)] hover:from-red-500 hover:via-red-700 hover:to-rose-900"
        title={`Pendências: ${total} (${countSemValor} sem valor, ${countAtrasadas} atrasadas, ${countRascunhos} rascunhos, ${countDocagens} docagens)`}
      >
        <AlertTriangle size={20} className="text-white" />
        <span
          className={`absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-b from-red-300 to-red-600 text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm shadow-red-900/30 ${
            pulse ? "animate-pulse" : ""
          }`}
        >
          {total > 9 ? "9+" : total}
        </span>
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-[420px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9999] overflow-hidden"
        >
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" />
                Avisos de Pendências
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleSound}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  title={
                    soundEnabled
                      ? "Som ativado (clique para silenciar)"
                      : "Som desativado (clique para ativar)"
                  }
                >
                  {soundEnabled ? (
                    <Volume2 size={16} />
                  ) : (
                    <VolumeX size={16} />
                  )}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-1">
              {hasPendencias ? (
                <>
                  <span className="text-red-600">{total}</span>
                  {` pendência${total > 1 ? "s" : ""} no total`}
                </>
              ) : (
                "Tudo em dia — nenhuma pendência"
              )}
            </p>
          </div>

          {/* Filtro por período */}
          {hasPendencias && (
            <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center gap-1.5">
              {(
                [
                  { key: "hoje", label: "Hoje", icon: CalendarDays },
                  { key: "semana", label: "7 dias", icon: CalendarRange },
                  { key: "tudo", label: "Tudo", icon: Inbox },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => changeFiltroPeriodo(key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-bold text-[11px] uppercase tracking-wide transition-all cursor-pointer ${
                    filtroPeriodo === key
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
              <span className="ml-auto text-[11px] font-bold text-slate-400">
                {itemsFiltrados.length} exibid
                {itemsFiltrados.length === 1 ? "a" : "as"}
              </span>
            </div>
          )}

          <div className="max-h-[400px] overflow-y-auto">
            {!hasPendencias ? (
              <div className="p-8 text-center text-slate-400">
                <AlertTriangle
                  size={32}
                  className="mx-auto mb-2 opacity-40"
                />
                <p className="text-sm font-bold">
                  Nenhuma pendência encontrada. Ótimo!
                </p>
              </div>
            ) : itemsFiltrados.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CalendarDays size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm font-bold">
                  Nenhuma pendência neste período.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {itemsFiltrados.map((item) => {
                  const cfg = motivoConfig[item.motivo];
                  const MotivoIcon = cfg.icon;
                  const novo = ehNovo(item);
                  const protocolo = item.protocolo || item.os || item.id.slice(0, 8);
                  const infoTempo =
                    item.ageDays != null && item.ageDays >= 1
                      ? item.ageDays === 1
                        ? "Há 1 dia"
                        : `Há ${item.ageDays} dias`
                      : item.data
                        ? formatarData(item.data)
                        : null;
                  const tipoCfg = tipoConfig[item.tipo ?? "os"];
                  return (
                    <button
                      key={`${item.motivo}-${item.id}`}
                      onClick={() => handleItemClick(item)}
                      className={`w-full p-3.5 hover:bg-slate-50 transition-colors text-left cursor-pointer flex items-center gap-3 ${
                        novo ? "bg-slate-50/60" : ""
                      }`}
                    >
                      {/* Ícone de categoria à esquerda */}
                      <div className={`shrink-0 w-9 h-9 rounded-xl ${cfg.iconBg} flex items-center justify-center`}>
                        <MotivoIcon size={18} className={cfg.iconColor} />
                      </div>

                      {/* Conteúdo principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-black text-slate-800 truncate">
                            #{protocolo}
                          </p>
                          {novo && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide bg-blue-100 text-blue-700 animate-pulse shrink-0">
                              <Sparkles size={9} />
                              Novo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 font-bold truncate">
                          {item.clienteNome}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide ${cfg.iconBg} ${cfg.iconColor}`}>
                            <MotivoIcon size={10} />
                            {cfg.label}
                          </span>
                          {infoTempo && (
                            <span className="text-[10px] font-bold text-slate-400">
                              {infoTempo}
                            </span>
                          )}
                          {/* Badge de tipo na mesma linha do motivo */}
                          <span className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide ${tipoCfg.bg} ${tipoCfg.color}`}>
                            <tipoCfg.icon size={9} />
                            {tipoCfg.label}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatarData(dataISO: string): string {
  if (!dataISO) return "—";
  const parts = dataISO.split("-");
  if (parts.length < 3) return dataISO;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}
