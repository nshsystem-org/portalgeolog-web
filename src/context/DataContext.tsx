"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeBrazilPhone } from "@/lib/phone";
import type { OperationalCycle } from "@/lib/os-messages";
import { logErrorEntry, logCritical, logInfo } from "@/lib/frontend-logger";
import {
  fetchClientes,
  fetchSolicitantes,
  fetchPassageiros,
  fetchOSById,
  fetchOSList,
  fetchDrivers,
  insertCliente,
  updateClienteInDB,
  deleteClienteFromDB,
  updatePassageiroInDB,
  archivePassageiroInDB,
  updateVeiculoInDB,
  deleteVeiculoFromDB,
  updateDriverInDB,
  deleteDriverFromDB,
  insertSolicitante,
  updateSolicitanteInDB,
  deleteSolicitanteFromDB,
  insertCentroCusto,
  updateCentroCustoInDB,
  deleteCentroCustoFromDB,
  insertPassageiro,
  insertDriver,
  insertOS,
  updateOSInDB,
  updateOSStatusInDB,
  archiveOSFromDB,
  unarchiveOSFromDB,
  fetchParceiros,
  fetchParceiroById,
  insertParceiro,
  updateParceiroInDB,
  toggleParceiroStatus,
  deleteParceiroFromDB,
  unarchiveParceiroFromDB,
  getImpostoPercentual,
  setFinancialConfig,
  fetchOSStatusCounts,
  type OSStatusCounts,
  type ParceiroServico,
  type NovoParceiroInput,
} from "@/lib/supabase/queries";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";

// ── Interfaces ──────────────────────────────────────────

export interface Cliente {
  id: string;
  nome: string;
  contato?: string;
  centrosCusto: CentroCusto[];
}

export interface CentroCusto {
  id: string;
  nome: string;
  clienteId: string;
}

export interface Solicitante {
  id: string;
  nome: string;
  clienteId: string;
  centroCustoId?: string;
}

export interface Waypoint {
  label: string;
  lat: number | null;
  lng: number | null;
  comment?: string;
  itineraryIndex?: number;
  hora?: string;
  data?: string;
  passengers: {
    id: string;
    solicitanteId: string;
    nome: string;
  }[];
}

export interface OrderService {
  id: string;
  protocolo: string;
  os: string;
  data: string;
  hora: string | null;
  horaExtra?: string;
  clienteId: string;
  solicitante: string;
  solicitanteId?: string;
  centroCustoId?: string;
  motorista: string;
  driverId?: string;
  veiculoId?: string;
  valorBruto: number | null;
  custo: number | null;
  imposto: number | null;
  lucro: number | null;
  obsFinanceiras: string;
  status: OSStatus;
  distancia?: number;
  financeiroFaturadoEm?: string;
  financeiroRecebidoEm?: string;
  financeiroAnexos?: Array<{
    id: string;
    ordemServicoId: string;
    storagePath: string;
    nomeArquivo: string;
    mimeType: string;
    tamanhoBytes: number;
    tipoDocumento: string;
    observacao?: string;
    createdBy?: string;
    createdAt: string;
  }>;
  rota?: {
    waypoints: Waypoint[];
  };
  driverMessageSentAt?: string;
  driverAcceptedAt?: string;
  driverKmInitial?: number;
  routeStartedAt?: string;
  routeStartedKm?: number;
  routeFinishedAt?: string;
  routeFinishedKm?: number;
  operationalCycles?: OperationalCycle[];
  currentDriverCycleIndex?: number;
  createdAt?: string;
  createdBy?: string;
  createdByName?: string;
  arquivado?: boolean;
}

export interface OSStatus {
  operacional:
    | "Pendente"
    | "Aguardando"
    | "Em Rota"
    | "Finalizado"
    | "Cancelado";
  financeiro: "Pendente" | "Faturado" | "Recebido" | "Pago";
}

export interface Passageiro {
  id: string;
  nomeCompleto: string;
  email?: string;
  celular: string;
  cpf?: string;
  notificar?: boolean;
  genero?: string;
  enderecos: PassageiroEndereco[];
}

export interface Vehicle {
  id: string;
  placa: string;
  renavam: string;
  modelo: string;
  marca: string;
  ano: number;
  cor?: string;
  tipo: "carro" | "van" | "onibus" | "moto" | "caminhao" | "outro";
  status: "ativo" | "inativo" | "manutencao";
  created_at: string;
}

export interface PassageiroEndereco {
  id: string;
  rotulo: string;
  enderecoCompleto: string;
  referencia?: string;
}

export interface NovoPassageiroInput {
  nomeCompleto: string;
  email?: string;
  celular: string;
  cpf?: string;
  notificar?: boolean;
  genero?: string;
  enderecos: {
    rotulo?: string;
    enderecoCompleto: string;
    referencia?: string;
  }[];
}

export interface Driver {
  id: string;
  name: string;
  status: "active" | "inactive";
  cpf?: string;
  cnh?: string;
  phone?: string;
  email?: string;
  created_at?: string;
  docs?: DriverDoc[];
  docsCount?: number;
  vinculo_tipo?: "interno" | "parceiro" | "autonomo";
  parceiro_id?: string;
  driver_vehicles?: Array<{
    id: string;
    driver_id: string;
    vehicle_id: string;
    vehicle?: {
      id: string;
      placa: string;
      modelo: string;
      marca: string;
      tipo?: string;
    };
  }>;
}

export interface DriverDoc {
  id: string;
  type: string;
  status: "valid" | "expired" | "pending";
  expiryDate?: string;
}

export interface ChatConversation {
  id: string;
  type: "direct" | "group";
  title?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  participants?: ChatParticipant[];
  lastMessage?: ChatMessage;
  unreadCount?: number;
}

export interface ChatParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  joined_at: string;
  last_read_at?: string;
  is_admin: boolean;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name?: string | null;
  sender_avatar?: string | null;
  content: string;
  message_type: "text" | "image" | "file" | "system";
  created_at: string;
  updated_at: string;
  is_edited: boolean;
  reply_to_id?: string | null;
  reply_to?: ChatMessage;
}

const normalizeTextValue = (value: string): string =>
  value.trim().toLowerCase();

const normalizeDigitsValue = (value: string): string =>
  value.replace(/\D/g, "");

const normalizePhoneValue = (value: string): string =>
  normalizeBrazilPhone(value);

const isUniqueConstraintError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === "23505" ||
    Boolean(
      maybeError.message
        ?.toLowerCase()
        .includes("duplicate key value violates unique constraint"),
    )
  );
};

const getPassageiroDuplicateMessage = (error: unknown): string | null => {
  if (!isUniqueConstraintError(error)) return null;
  const msg = (error as { message?: string }).message || "";
  const lower = msg.toLowerCase();
  if (lower.includes("passageiros_celular_unique_normalized")) {
    return "Já existe um passageiro com este celular.";
  }
  if (lower.includes("passageiros_email_unique_normalized")) {
    return "Já existe um passageiro com este e-mail.";
  }
  if (lower.includes("passageiros_cpf_unique_normalized")) {
    return "Já existe um passageiro com este CPF.";
  }
  return "Já existe um passageiro com estes dados.";
};

const hasDuplicateRecord = <T extends { id: string }>(
  records: T[],
  candidateValue: string,
  getValue: (record: T) => string,
  normalize: (value: string) => string,
  excludeId?: string,
): boolean => {
  const normalizedCandidate = normalize(candidateValue);

  if (!normalizedCandidate) {
    return false;
  }

  return records.some(
    (record) =>
      record.id !== excludeId &&
      normalize(getValue(record)) === normalizedCandidate,
  );
};

// ── Contexto ─────────────────────────────────────────────

interface DataContextType {
  clientes: Cliente[];
  solicitantes: Solicitante[];
  osList: OrderService[];
  osCounts: OSStatusCounts;
  drivers: Driver[];
  passageiros: Passageiro[];
  parceiros: ParceiroServico[];
  loading: boolean;
  heavyLoading: boolean;
  impostoPercentual: number;
  setImpostoPercentual: (
    value: number,
    effectiveFrom?: string,
  ) => Promise<void>;

  lastOSUpdate: number;
  addCliente: (nome: string, contato?: string) => Promise<Cliente>;
  updateCliente: (id: string, updates: Partial<Cliente>) => Promise<void>;
  deleteCliente: (id: string) => void;

  addSolicitante: (
    nome: string,
    clienteId: string,
    centroCustoId?: string,
  ) => Promise<Solicitante>;
  updateSolicitante: (id: string, updates: Partial<Solicitante>) => void;
  deleteSolicitante: (id: string) => void;

  addPassageiro: (passageiro: NovoPassageiroInput) => Promise<Passageiro>;
  updatePassageiro: (
    id: string,
    passageiro: NovoPassageiroInput,
  ) => Promise<Passageiro>;
  archivePassageiro: (id: string) => Promise<void>;

  addDriver: (driver: Omit<Driver, "id" | "created_at">) => Promise<Driver>;
  updateDriver: (id: string, updates: Partial<Driver>) => Promise<void>;
  deleteDriver: (id: string) => Promise<void>;
  updateVeiculo: (id: string, input: Partial<Vehicle>) => Promise<Vehicle>;
  deleteVeiculo: (id: string) => Promise<void>;

  // Parceiros
  addParceiro: (parceiro: NovoParceiroInput) => Promise<ParceiroServico>;
  updateParceiro: (id: string, parceiro: NovoParceiroInput) => Promise<void>;
  toggleParceiro: (id: string) => Promise<void>;
  deleteParceiro: (id: string) => void;
  unarchiveParceiro: (id: string) => Promise<void>;

  // Centros de Custo
  addCentroCusto: (nome: string, clienteId: string) => Promise<CentroCusto>;
  updateCentroCusto: (id: string, updates: Partial<CentroCusto>) => void;
  deleteCentroCusto: (id: string) => void;

  addOS: (
    osData: Omit<
      OrderService,
      "id" | "lucro" | "imposto" | "status" | "protocolo"
    >,
  ) => Promise<OrderService>;
  updateOS: (
    id: string,
    osData: Omit<
      OrderService,
      "id" | "lucro" | "imposto" | "status" | "protocolo"
    >,
  ) => Promise<{ changed: boolean }>;
  updateOSStatus: (id: string, updates: Partial<OSStatus>) => Promise<void>;
  deleteOS: (id: string) => Promise<void>;
  unarchiveOS: (id: string) => Promise<void>;

  refreshData: () => Promise<void>;
  getSolicitantesByCliente: (clienteId: string) => Solicitante[];
  getCentrosCustoByCliente: (clienteId: string) => CentroCusto[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Função auxiliar para obter o nome da página a partir do pathname
function getPageName(pathname: string | null): string {
  if (!pathname) return "Desconhecida";

  const pageMap: Record<string, string> = {
    "/portal/os": "Ordem de Serviço",
    "/portal/financeiro": "Medição Financeira",
    "/portal/motoristas": "Motoristas",
    "/portal/veiculos": "Veículos",
    "/portal/passageiros": "Passageiros",
    "/portal/clientes": "Clientes",
    "/portal/parcerias": "Parceiros de Serviço",
    "/portal/config": "Configurações",
    "/portal/dashboard": "Dashboard",
    "/admin": "Administrador",
  };

  return pageMap[pathname] || pathname;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasLoadedData = useRef(false);
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [solicitantes, setSolicitantes] = useState<Solicitante[]>([]);
  const [osList, setOsList] = useState<OrderService[]>([]);
  const [osCounts, setOsCounts] = useState<OSStatusCounts>({
    Pendente: 0,
    Aguardando: 0,
    "Em Rota": 0,
    Finalizado: 0,
    Cancelado: 0,
  });
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [passageiros, setPassageiros] = useState<Passageiro[]>([]);
  const [parceiros, setParceiros] = useState<ParceiroServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [heavyLoading, setHeavyLoading] = useState(false);
  const [impostoPercentual, setImpostoPercentualState] = useState<number>(12);
  const [lastOSUpdate, setLastOSUpdate] = useState(0);
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  // Fetch functions wrapped for stability
  const dbFetchClientes = useCallback(async () => fetchClientes(), []);
  const dbFetchSolicitantes = useCallback(async () => fetchSolicitantes(), []);
  const dbFetchDrivers = useCallback(async () => fetchDrivers(), []);
  const dbFetchPassageiros = useCallback(async () => fetchPassageiros(), []);
  const dbFetchParceiros = useCallback(async () => fetchParceiros(), []);

  const upsertOSInState = useCallback((nextOS: OrderService) => {
    setOsList((prev) => {
      const index = prev.findIndex((os) => os.id === nextOS.id);
      if (index === -1) {
        return [nextOS, ...prev];
      }

      const copy = [...prev];
      copy[index] = nextOS;
      return copy;
    });
    setLastOSUpdate(Date.now());
  }, []);

  const removeOSFromState = useCallback((osId: string) => {
    setOsList((prev) => prev.filter((os) => os.id !== osId));
    setLastOSUpdate(Date.now());
  }, []);

  const refreshOSById = useCallback(
    async (osId: string) => {
      try {
        const latest = await fetchOSById(osId);
        if (latest) {
          upsertOSInState(latest);
        } else {
          removeOSFromState(osId);
        }
      } catch (error) {
        console.error("Erro ao sincronizar OS pontual:", error);
      }
    },
    [removeOSFromState, upsertOSInState],
  );

  const refreshData = useCallback(async () => {
    try {
      // Fase 1: Dados leves — liberam a UI rapidamente
      // Usamos Promise.all mas com catches individuais para não quebrar todo o fluxo se um falhar
      const results1 = await Promise.allSettled([
        dbFetchClientes(),
        dbFetchSolicitantes(),
        dbFetchDrivers(),
        dbFetchPassageiros(),
        dbFetchParceiros(),
        getImpostoPercentual(),
      ]);

      const [
        clientesRes,
        solicitantesRes,
        driversRes,
        passageirosRes,
        parceirosRes,
        impostoRes,
      ] = results1;

      if (clientesRes.status === "fulfilled") setClientes(clientesRes.value);
      else
        logErrorEntry(
          "DataContext",
          "dbFetchClientes falhou",
          clientesRes.reason as Error,
        );

      if (solicitantesRes.status === "fulfilled")
        setSolicitantes(solicitantesRes.value);
      else
        logErrorEntry(
          "DataContext",
          "dbFetchSolicitantes falhou",
          solicitantesRes.reason as Error,
        );

      if (driversRes.status === "fulfilled") setDrivers(driversRes.value);
      else
        logErrorEntry(
          "DataContext",
          "dbFetchDrivers falhou",
          driversRes.reason as Error,
        );

      if (passageirosRes.status === "fulfilled")
        setPassageiros(passageirosRes.value);
      else
        logErrorEntry(
          "DataContext",
          "dbFetchPassageiros falhou",
          passageirosRes.reason as Error,
        );

      if (parceirosRes.status === "fulfilled") setParceiros(parceirosRes.value);
      else
        logErrorEntry(
          "DataContext",
          "dbFetchParceiros falhou",
          parceirosRes.reason as Error,
        );

      if (impostoRes.status === "fulfilled")
        setImpostoPercentualState(impostoRes.value);
      else
        logErrorEntry(
          "DataContext",
          "getImpostoPercentual falhou",
          impostoRes.reason as Error,
        );

      // Se todos os principais falharem, aí sim consideramos crítico
      if (results1.every((r) => r.status === "rejected")) {
        throw new Error("Todas as buscas da Fase 1 falharam.");
      }

      // Fase 2: Dados pesados — carregam em background sem bloquear a UI
      setHeavyLoading(true);
      try {
        const results2 = await Promise.allSettled([
          fetchOSList(),
          fetchOSStatusCounts(),
        ]);

        const [osListRes, osCountsRes] = results2;

        if (osListRes.status === "fulfilled") setOsList(osListRes.value);
        else
          logErrorEntry(
            "DataContext",
            "fetchOSList falhou",
            osListRes.reason as Error,
          );

        if (osCountsRes.status === "fulfilled") setOsCounts(osCountsRes.value);
        else
          logErrorEntry(
            "DataContext",
            "fetchOSStatusCounts falhou",
            osCountsRes.reason as Error,
          );

        // Não registramos logs de sucesso do carregamento global para evitar spam.
        // Mantemos apenas logs de erro/falha de carregamento.
      } catch (heavyErr) {
        logErrorEntry(
          "DataContext",
          "Erro inesperado ao processar dados pesados",
          heavyErr as Error,
        );
      } finally {
        setHeavyLoading(false);
      }
    } catch (err) {
      logCritical(
        "DataContext",
        "CRITICAL: Error refreshing global data",
        err as Error,
        {
          phase: err instanceof Error ? err.message : String(err),
        },
      );
      toast.error("Erro ao sincronizar dados. Tente atualizar a página.");
    }
  }, [dbFetchClientes, dbFetchSolicitantes, dbFetchDrivers]);

  useEffect(() => {
    if (authLoading || !user || hasLoadedData.current) {
      return;
    }

    hasLoadedData.current = true;

    queueMicrotask(() => {
      void refreshData().finally(() => {
        setLoading(false);
      });
    });
  }, [refreshData, user, authLoading]);

  // Sincroniza dados quando a aba volta ao foco (cobre falhas de realtime cross-tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshData();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refreshData]);

  // Real-time Subscriptions with Silenced Fallback
  useEffect(() => {
    if (authLoading || !user) return;

    console.log("🔌 Supabase Real-time: Conectando canal central...");

    type RealtimeChangePayload = {
      eventType: "INSERT" | "UPDATE" | "DELETE" | string;
      new: Record<string, unknown> | null;
      old: Record<string, unknown> | null;
    };

    const getRecordId = (
      record: Record<string, unknown> | null,
    ): string | null => {
      if (!record) return null;
      const value = record.id;
      return typeof value === "string" ? value : null;
    };

    const getWaypointOsId = async (
      record: Record<string, unknown> | null,
    ): Promise<string | null> => {
      if (!record) return null;

      const waypointId =
        typeof record.waypoint_id === "string" ? record.waypoint_id : null;
      const directOsId =
        typeof record.ordem_servico_id === "string"
          ? record.ordem_servico_id
          : null;

      if (directOsId) return directOsId;
      if (!waypointId) return null;

      const { data } = await supabase
        .from("os_waypoints")
        .select("ordem_servico_id")
        .eq("id", waypointId)
        .maybeSingle();

      return data?.ordem_servico_id ?? null;
    };

    const debouncedFetch = (key: string, fetchFn: () => Promise<void>) => {
      const existing = debounceTimers.current.get(key);
      if (existing) clearTimeout(existing);
      debounceTimers.current.set(
        key,
        setTimeout(() => {
          debounceTimers.current.delete(key);
          void fetchFn();
        }, 300),
      );
    };

    const channel = supabase
      .channel("geolog-realtime-global")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ordens_servico" },
        (payload) => {
          const change = payload as RealtimeChangePayload;
          const osId = getRecordId(change.new) || getRecordId(change.old);
          if (!osId) return;

          const newRecord = change.new as Record<string, unknown> | null;
          console.log("[DataContext] 🔄 Evento Realtime ordens_servico:", {
            eventType: change.eventType,
            osId,
            status_operacional: newRecord?.status_operacional,
          });

          if (change.eventType === "DELETE") {
            removeOSFromState(osId);
            setLastOSUpdate(Date.now());
            debouncedFetch("os-counts", async () => {
              const counts = await fetchOSStatusCounts();
              setOsCounts(counts);
            });
            return;
          }

          setLastOSUpdate(Date.now());

          // Se mudou para Finalizado, atualizar imediatamente sem debounce
          const statusOperacional = newRecord?.status_operacional;
          if (statusOperacional === "Finalizado") {
            console.log(
              "[DataContext] ⚡ Status mudou para Finalizado - refresh imediato",
            );
            void refreshOSById(osId);
            void (async () => {
              const counts = await fetchOSStatusCounts();
              setOsCounts(counts);
            })();
          } else {
            debouncedFetch(`os-${osId}`, async () => {
              await refreshOSById(osId);
            });
            debouncedFetch("os-counts", async () => {
              const counts = await fetchOSStatusCounts();
              setOsCounts(counts);
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "os_waypoints" },
        (payload) => {
          const change = payload as RealtimeChangePayload;
          const record = change.new || change.old;
          const osId =
            typeof record?.ordem_servico_id === "string"
              ? record.ordem_servico_id
              : null;

          if (!osId) return;

          debouncedFetch(`os-${osId}`, async () => {
            await refreshOSById(osId);
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "os_waypoint_passengers" },
        (payload) => {
          const change = payload as RealtimeChangePayload;
          const record = change.new || change.old;

          void getWaypointOsId(record).then((osId) => {
            if (!osId) return;

            debouncedFetch(`os-${osId}`, async () => {
              await refreshOSById(osId);
            });
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "os_operational_cycles" },
        (payload) => {
          const change = payload as RealtimeChangePayload;
          const record = change.new || change.old;
          const osId =
            typeof record?.ordem_servico_id === "string"
              ? record.ordem_servico_id
              : null;

          console.log("[DataContext] os_operational_cycles mudou:", {
            eventType: change.eventType,
            osId,
            record,
          });

          if (!osId) return;

          debouncedFetch(`os-${osId}`, async () => {
            console.log(
              "[DataContext] Atualizando OS após mudança em ciclos:",
              osId,
            );
            await refreshOSById(osId);
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clientes" },
        () => {
          debouncedFetch("clientes", async () => {
            const data = await dbFetchClientes();
            setClientes(data);
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solicitantes" },
        () => {
          debouncedFetch("solicitantes", async () => {
            const data = await dbFetchSolicitantes();
            setSolicitantes(data);
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        () => {
          debouncedFetch("drivers", async () => {
            const data = await dbFetchDrivers();
            setDrivers(data);
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "passageiros" },
        () => {
          debouncedFetch("passageiros", async () => {
            const data = await dbFetchPassageiros();
            setPassageiros(data);
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parceiros_servico" },
        () => {
          debouncedFetch("parceiros", async () => {
            const data = await dbFetchParceiros();
            setParceiros(data);
          });
        },
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Real-time ativado.");
        }
        // Ignoramos erros ruidosos de canal, o Supabase gerencia reconexão internamente
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    authLoading,
    dbFetchClientes,
    dbFetchDrivers,
    dbFetchSolicitantes,
    refreshOSById,
    removeOSFromState,
    supabase,
    user,
  ]);

  // Actions
  const addCliente = async (
    nome: string,
    contato?: string,
  ): Promise<Cliente> => {
    const cleanNome = nome.trim();

    if (!cleanNome) {
      throw new Error("Informe o nome da empresa.");
    }

    if (
      hasDuplicateRecord(
        clientes,
        cleanNome,
        (cliente) => cliente.nome,
        normalizeTextValue,
      )
    ) {
      throw new Error("Já existe uma empresa com este nome.");
    }

    try {
      const result = await insertCliente(cleanNome, contato);
      logInfo("DataContext", "Empresa adicionada com sucesso", {
        clienteId: result.id,
        nome: cleanNome,
      });
      setClientes((prev) =>
        [...prev, result].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      );
      return result;
    } catch (error) {
      logErrorEntry(
        "DataContext",
        "Falha ao adicionar empresa",
        error as Error,
        {
          nome: cleanNome,
        },
      );
      if (isUniqueConstraintError(error)) {
        throw new Error("Já existe uma empresa com este nome.");
      }

      throw error instanceof Error
        ? error
        : new Error("Não foi possível salvar a empresa.");
    }
  };

  const updateCliente = async (
    id: string,
    updates: Partial<Cliente>,
  ): Promise<void> => {
    if (updates.nome !== undefined) {
      const cleanNome = updates.nome.trim();

      if (!cleanNome) {
        throw new Error("Informe o nome da empresa.");
      }

      if (
        hasDuplicateRecord(
          clientes,
          cleanNome,
          (cliente) => cliente.nome,
          normalizeTextValue,
          id,
        )
      ) {
        throw new Error("Já existe uma empresa com este nome.");
      }
    }

    try {
      await updateClienteInDB(id, updates);
      logInfo("DataContext", "Empresa atualizada com sucesso", {
        clienteId: id,
        updates,
      });
      setClientes((prev) =>
        prev.map((cliente) => {
          if (cliente.id !== id) return cliente;

          const nextNome =
            updates.nome !== undefined ? updates.nome.trim() : cliente.nome;
          const nextContato =
            updates.contato !== undefined
              ? updates.contato.trim() || undefined
              : cliente.contato;

          return {
            ...cliente,
            nome: nextNome,
            contato: nextContato,
          };
        }),
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error("Já existe uma empresa com este nome.");
      }

      throw error instanceof Error
        ? error
        : new Error("Não foi possível atualizar a empresa.");
    }
  };

  const deleteCliente = (id: string) => {
    deleteClienteFromDB(id)
      .then(() => {
        logInfo("DataContext", "Empresa excluída com sucesso", {
          clienteId: id,
        });
        setClientes((prev) => prev.filter((cliente) => cliente.id !== id));
        setSolicitantes((prev) =>
          prev.filter((solicitante) => solicitante.clienteId !== id),
        );
        void refreshData();
      })
      .catch((err) => {
        logErrorEntry("DataContext", "Falha ao excluir empresa", err as Error, {
          clienteId: id,
        });
        console.error("Error deleteClienteFromDB:", err);
      });
  };

  const addSolicitante = async (
    nome: string,
    clienteId: string,
    centroCustoId?: string,
  ): Promise<Solicitante> => {
    const cleanNome = nome.trim();

    if (!cleanNome) {
      throw new Error("Informe o nome do solicitante.");
    }

    const solicitantesDoCliente = solicitantes.filter(
      (solicitante) => solicitante.clienteId === clienteId,
    );

    if (
      hasDuplicateRecord(
        solicitantesDoCliente,
        cleanNome,
        (solicitante) => solicitante.nome,
        normalizeTextValue,
      )
    ) {
      throw new Error(
        "Já existe um solicitante com este nome para esta empresa.",
      );
    }

    const result = await insertSolicitante(cleanNome, clienteId, centroCustoId);
    logInfo("DataContext", "Solicitante adicionado com sucesso", {
      solicitanteId: result.id,
      nome: cleanNome,
      clienteId,
    });
    setSolicitantes((prev) =>
      [...prev, result].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    );
    return result;
  };

  const updateSolicitante = (id: string, updates: Partial<Solicitante>) => {
    updateSolicitanteInDB(id, updates)
      .then(() => {
        logInfo("DataContext", "Solicitante atualizado com sucesso", {
          solicitanteId: id,
          updates,
        });
        setSolicitantes((prev) =>
          prev.map((solicitante) => {
            if (solicitante.id !== id) return solicitante;

            return {
              ...solicitante,
              nome:
                updates.nome !== undefined
                  ? updates.nome.trim()
                  : solicitante.nome,
              clienteId: updates.clienteId ?? solicitante.clienteId,
              centroCustoId: updates.centroCustoId ?? solicitante.centroCustoId,
            };
          }),
        );
      })
      .catch((err) => console.error("Error updateSolicitanteInDB:", err));
  };

  const deleteSolicitante = (id: string) => {
    deleteSolicitanteFromDB(id)
      .then(() => {
        setSolicitantes((prev) =>
          prev.filter((solicitante) => solicitante.id !== id),
        );
        void refreshData();
      })
      .catch((err) => console.error("Error deleteSolicitanteFromDB:", err));
  };

  const addPassageiro = async (
    passageiro: NovoPassageiroInput,
  ): Promise<Passageiro> => {
    try {
      const real = await insertPassageiro(passageiro);
      setPassageiros((prev) =>
        [...prev, real].sort((a, b) =>
          a.nomeCompleto.localeCompare(b.nomeCompleto, "pt-BR"),
        ),
      );
      logInfo("DataContext", "Passageiro adicionado com sucesso", {
        passageiroId: real.id,
        nome: passageiro.nomeCompleto,
      });
      return real;
    } catch (error) {
      logErrorEntry(
        "DataContext",
        "Falha ao adicionar passageiro",
        error as Error,
        {
          nome: passageiro.nomeCompleto,
        },
      );
      const duplicateMessage = getPassageiroDuplicateMessage(error);
      throw new Error(
        duplicateMessage ||
          (error instanceof Error
            ? error.message
            : "Não foi possível salvar o passageiro."),
      );
    }
  };

  const updatePassageiro = async (
    id: string,
    passageiro: NovoPassageiroInput,
  ): Promise<Passageiro> => {
    try {
      const real = await updatePassageiroInDB(id, passageiro);
      logInfo("DataContext", "Passageiro atualizado com sucesso", {
        passageiroId: id,
        nome: passageiro.nomeCompleto,
      });
      return real;
    } catch (error) {
      logErrorEntry(
        "DataContext",
        "Falha ao atualizar passageiro",
        error as Error,
        {
          passageiroId: id,
          nome: passageiro.nomeCompleto,
        },
      );
      const duplicateMessage = getPassageiroDuplicateMessage(error);
      throw new Error(
        duplicateMessage ||
          (error instanceof Error
            ? error.message
            : "Não foi possível atualizar o passageiro."),
      );
    }
  };

  const archivePassageiro = async (id: string): Promise<void> => {
    try {
      await archivePassageiroInDB(id);
      logInfo("DataContext", "Passageiro arquivado com sucesso", {
        passageiroId: id,
      });
    } catch (error) {
      logErrorEntry(
        "DataContext",
        "Falha ao arquivar passageiro",
        error as Error,
        { passageiroId: id },
      );
      console.error("Error archivePassageiroInDB:", error);
      throw error;
    }
  };

  const addDriver = async (
    driver: Omit<Driver, "id" | "created_at">,
  ): Promise<Driver> => {
    const cleanName = driver.name.trim();

    if (!cleanName) {
      throw new Error("Informe o nome do motorista.");
    }

    if (
      hasDuplicateRecord(drivers, cleanName, (d) => d.name, normalizeTextValue)
    ) {
      throw new Error("Já existe um motorista com este nome.");
    }

    try {
      const result = await insertDriver(driver);
      setDrivers((prev) =>
        [...prev, result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
      return result;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error("Já existe um motorista com este nome.");
      }

      throw error instanceof Error
        ? error
        : new Error("Não foi possível salvar o motorista.");
    }
  };

  const updateDriver = async (
    id: string,
    updates: Partial<Driver>,
  ): Promise<void> => {
    try {
      await updateDriverInDB(id, updates);
      setDrivers((prev) =>
        prev.map((driver) =>
          driver.id === id ? { ...driver, ...updates } : driver,
        ),
      );
      logInfo("DataContext", "Motorista atualizado com sucesso", {
        driverId: id,
        updates,
      });
    } catch (error) {
      logErrorEntry(
        "DataContext",
        "Falha ao atualizar motorista",
        error as Error,
        {
          driverId: id,
        },
      );
      throw error instanceof Error
        ? error
        : new Error("Não foi possível atualizar o motorista.");
    }
  };

  const deleteDriver = async (id: string): Promise<void> => {
    try {
      await deleteDriverFromDB(id);
      setDrivers((prev) => prev.filter((driver) => driver.id !== id));
      logInfo("DataContext", "Motorista arquivado com sucesso", {
        driverId: id,
      });
    } catch (error) {
      logErrorEntry(
        "DataContext",
        "Falha ao arquivar motorista",
        error as Error,
        {
          driverId: id,
        },
      );
      throw error instanceof Error
        ? error
        : new Error("Não foi possível arquivar o motorista.");
    }
  };

  const updateVeiculo = async (
    id: string,
    input: Partial<Vehicle>,
  ): Promise<Vehicle> => {
    const currentVehicle = await updateVeiculoInDB(id, input);
    void refreshData();
    return currentVehicle;
  };

  const deleteVeiculo = async (id: string): Promise<void> => {
    await deleteVeiculoFromDB(id);
    void refreshData();
  };

  const addOS = async (
    osData: Omit<
      OrderService,
      "id" | "lucro" | "imposto" | "status" | "protocolo"
    >,
  ): Promise<OrderService> => {
    const taxa = impostoPercentual / 100;
    const vBruto = osData.valorBruto ?? 0;
    const vCusto = osData.custo ?? 0;
    const imposto = vBruto * taxa;
    const lucro = vBruto - imposto - vCusto;
    const tempId = `temp-${Date.now()}`;

    const optimistic: OrderService = {
      id: tempId,
      protocolo: "...",
      ...osData,
      imposto,
      lucro,
      status: { operacional: "Pendente", financeiro: "Pendente" },
    };
    // Atualizar osData com valores numéricos para o backend
    const osDataWithNumbers = { ...osData, valorBruto: vBruto, custo: vCusto };

    setOsList((prev) => [optimistic, ...prev]);

    const actorName = profile?.nome || user?.email || "Sistema";
    const actorId = user?.id || null;
    try {
      const real = await insertOS(osDataWithNumbers, actorName, actorId);
      logInfo("DataContext", "Ordem de Serviço adicionada com sucesso", {
        osId: real.id,
        protocolo: real.protocolo,
        actorName,
      });
      setOsList((prev) => prev.map((o) => (o.id === tempId ? real : o)));
      return real;
    } catch (err) {
      logErrorEntry(
        "DataContext",
        "Falha ao adicionar Ordem de Serviço",
        err as Error,
        {
          actorName,
          osData: osDataWithNumbers,
        },
      );
      console.error("Error adding OS:", err);
      console.error("OS Data that failed:", osData);
      setOsList((prev) => prev.filter((o) => o.id !== tempId));
      throw err;
    }
  };

  const updateOS = async (
    id: string,
    osData: Omit<
      OrderService,
      "id" | "lucro" | "imposto" | "status" | "protocolo"
    >,
  ): Promise<{ changed: boolean }> => {
    let currentOS = osList.find((os) => os.id === id);

    // Fallback: se a OS não estiver no estado local (ex: filtro, paginação),
    // buscar do banco para garantir que o diff de mudanças seja calculado
    if (!currentOS) {
      try {
        currentOS = await fetchOSById(id);
      } catch {
        // Falha silenciosa — updateOSInDB vai lidar sem previousOS
      }
    }

    const taxa = impostoPercentual / 100;
    const vBruto = osData.valorBruto ?? 0;
    const vCusto = osData.custo ?? 0;
    const imposto = vBruto * taxa;
    const lucro = vBruto - imposto - vCusto;

    if (currentOS) {
      setOsList((prev) =>
        prev.map((os) =>
          os.id === id
            ? {
                ...currentOS,
                ...osData,
                valorBruto: vBruto,
                custo: vCusto,
                imposto,
                lucro,
                status: currentOS.status,
                protocolo: currentOS.protocolo,
              }
            : os,
        ),
      );
    }

    const actorName = profile?.nome || user?.email || "Sistema";
    const actorId = user?.id || null;
    try {
      const result = await updateOSInDB(id, osData, actorName, actorId, currentOS);

      if (!result.changed) {
        logInfo("DataContext", "Nenhuma alteração real detectada na OS", {
          osId: id,
          actorName,
        });
        toast.info("Nenhuma alteração detectada.");
        return { changed: false };
      }

      logInfo("DataContext", "Ordem de Serviço atualizada com sucesso", {
        osId: id,
        actorName,
        updates: osData,
      });
      return { changed: true };
    } catch (err) {
      logErrorEntry(
        "DataContext",
        "Falha ao atualizar Ordem de Serviço",
        err as Error,
        {
          osId: id,
          actorName,
        },
      );
      console.error("Error updateOSInDB:", err);
      throw err;
    }
  };

  const updateOSStatus = async (
    id: string,
    updates: Partial<OSStatus>,
  ): Promise<void> => {
    setOsList((prev) =>
      prev.map((os) =>
        os.id === id
          ? {
              ...os,
              status: {
                operacional: updates.operacional ?? os.status.operacional,
                financeiro: updates.financeiro ?? os.status.financeiro,
              },
            }
          : os,
      ),
    );

    const actorName = profile?.nome || user?.email || "Sistema";
    const actorId = user?.id || null;
    try {
      await updateOSStatusInDB(id, updates, actorName, actorId);
      logInfo("DataContext", "Status da Ordem de Serviço atualizado", {
        osId: id,
        updates,
        actorName,
      });
    } catch (err) {
      logErrorEntry(
        "DataContext",
        "Falha ao atualizar status da Ordem de Serviço",
        err as Error,
        {
          osId: id,
          updates,
          actorName,
        },
      );
      console.error("Error updateOSStatusInDB:", err);
      throw err;
    }
  };

  const deleteOS = async (id: string): Promise<void> => {
    const currentOS = osList.find((os) => os.id === id) || null;
    setOsList((prev) => prev.filter((os) => os.id !== id));

    const actorName = profile?.nome || user?.email || "Sistema";
    const actorId = user?.id || null;
    try {
      await archiveOSFromDB(
        id,
        actorName,
        actorId,
        currentOS?.protocolo || currentOS?.os || null,
      );
      logInfo("DataContext", "Ordem de Serviço excluída/arquivada", {
        osId: id,
        actorName,
      });
    } catch (err) {
      logErrorEntry(
        "DataContext",
        "Falha ao excluir/arquivar Ordem de Serviço",
        err as Error,
        {
          osId: id,
          actorName,
        },
      );
      console.error("Error archiveOSFromDB:", err);
      throw err;
    }
  };

  const unarchiveOS = async (id: string): Promise<void> => {
    const currentOS = osList.find((os) => os.id === id) || null;
    setOsList((prev) =>
      prev.map((os) =>
        os.id === id
          ? {
              ...os,
              status: { ...os.status, operacional: "Pendente" },
              arquivado: false,
            }
          : os,
      ),
    );

    const actorName = profile?.nome || user?.email || "Sistema";
    const actorId = user?.id || null;
    try {
      await unarchiveOSFromDB(
        id,
        actorName,
        actorId,
        currentOS?.protocolo || currentOS?.os || null,
      );
      logInfo("DataContext", "Ordem de Serviço desarquivada", {
        osId: id,
        actorName,
      });
    } catch (err) {
      logErrorEntry(
        "DataContext",
        "Falha ao desarquivar Ordem de Serviço",
        err as Error,
        {
          osId: id,
          actorName,
        },
      );
      console.error("Error unarchiveOSFromDB:", err);
      throw err;
    }
  };

  const getSolicitantesByCliente = useCallback(
    (clienteId: string) => {
      return solicitantes.filter((s) => s.clienteId === clienteId);
    },
    [solicitantes],
  );

  const getCentrosCustoByCliente = useCallback(
    (clienteId: string) => {
      const cliente = clientes.find((c) => c.id === clienteId);
      return cliente?.centrosCusto || [];
    },
    [clientes],
  );

  // Funções de Parceiros
  const addParceiro = async (
    parceiro: NovoParceiroInput,
  ): Promise<ParceiroServico> => {
    try {
      const result = await insertParceiro(parceiro);
      setParceiros((prev) =>
        [...prev, result].sort((a, b) =>
          a.razaoSocialOuNomeCompleto.localeCompare(
            b.razaoSocialOuNomeCompleto,
            "pt-BR",
          ),
        ),
      );
      logInfo("DataContext", "Parceiro adicionado com sucesso", {
        parceiroId: result.id,
        nome: parceiro.razaoSocialOuNomeCompleto,
      });
      return result;
    } catch (error) {
      logErrorEntry(
        "DataContext",
        "Falha ao adicionar parceiro",
        error as Error,
        {
          nome: parceiro.razaoSocialOuNomeCompleto,
        },
      );
      throw error instanceof Error
        ? error
        : new Error("Não foi possível salvar o parceiro.");
    }
  };

  const updateParceiro = async (
    id: string,
    parceiro: NovoParceiroInput,
  ): Promise<void> => {
    try {
      await updateParceiroInDB(id, parceiro);
      logInfo("DataContext", "Parceiro atualizado com sucesso", {
        parceiroId: id,
        nome: parceiro.razaoSocialOuNomeCompleto,
      });
    } catch (error) {
      logErrorEntry(
        "DataContext",
        "Falha ao atualizar parceiro",
        error as Error,
        {
          parceiroId: id,
          nome: parceiro.razaoSocialOuNomeCompleto,
        },
      );
      throw error instanceof Error
        ? error
        : new Error("Não foi possível atualizar o parceiro.");
    }
  };

  const toggleParceiro = async (id: string): Promise<void> => {
    try {
      const parceiro = await fetchParceiroById(id);
      await toggleParceiroStatus(id, parceiro.status);
      logInfo("DataContext", "Status do parceiro alterado", { parceiroId: id });
    } catch (error) {
      logErrorEntry(
        "DataContext",
        "Falha ao alterar status do parceiro",
        error as Error,
        { parceiroId: id },
      );
      throw error;
    }
  };

  const deleteParceiro = (id: string) => {
    deleteParceiroFromDB(id)
      .then(() => {
        logInfo("DataContext", "Parceiro excluído com sucesso", {
          parceiroId: id,
        });
      })
      .catch((err) => {
        logErrorEntry(
          "DataContext",
          "Falha ao excluir parceiro",
          err as Error,
          { parceiroId: id },
        );
        console.error("Error deleteParceiroFromDB:", err);
      });
  };

  const unarchiveParceiro = async (id: string): Promise<void> => {
    try {
      await unarchiveParceiroFromDB(id);
      logInfo("DataContext", "Parceiro desarquivado com sucesso", {
        parceiroId: id,
      });
    } catch (error) {
      logErrorEntry(
        "DataContext",
        "Falha ao desarquivar parceiro",
        error as Error,
        { parceiroId: id },
      );
      throw error;
    }
  };

  // Funções de Centros de Custo
  const addCentroCusto = async (
    nome: string,
    clienteId: string,
  ): Promise<CentroCusto> => {
    const result = await insertCentroCusto(nome, clienteId);
    setClientes((prev) =>
      prev.map((c) =>
        c.id === clienteId
          ? {
              ...c,
              centrosCusto: [...c.centrosCusto, result].sort((a, b) =>
                a.nome.localeCompare(b.nome, "pt-BR"),
              ),
            }
          : c,
      ),
    );
    return result;
  };

  const updateCentroCusto = (id: string, updates: Partial<CentroCusto>) => {
    updateCentroCustoInDB(id, updates)
      .then(() => {
        setClientes((prev) =>
          prev.map((c) => ({
            ...c,
            centrosCusto: c.centrosCusto.map((cc) =>
              cc.id === id ? { ...cc, ...updates } : cc,
            ),
          })),
        );
      })
      .catch((err) => console.error("Error updateCentroCustoInDB:", err));
  };

  const deleteCentroCusto = (id: string) => {
    deleteCentroCustoFromDB(id)
      .then(() => {
        setClientes((prev) =>
          prev.map((c) => ({
            ...c,
            centrosCusto: c.centrosCusto.filter((cc) => cc.id !== id),
          })),
        );
        void refreshData();
      })
      .catch((err) => console.error("Error deleteCentroCustoFromDB:", err));
  };

  const setImpostoPercentual = async (
    value: number,
    effectiveFrom?: string,
  ): Promise<void> => {
    const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
    const effectiveDate =
      effectiveFrom || new Date().toISOString().split("T")[0];
    await setFinancialConfig(
      "imposto_percentual",
      String(safeValue),
      effectiveDate,
    );
    setImpostoPercentualState(safeValue);
  };

  return (
    <DataContext.Provider
      value={{
        clientes,
        solicitantes,
        osList,
        osCounts,
        drivers,
        passageiros,
        parceiros,
        loading,
        heavyLoading,
        impostoPercentual,
        setImpostoPercentual,
        lastOSUpdate,
        addCliente,
        updateCliente,
        deleteCliente,
        addSolicitante,
        updateSolicitante,
        deleteSolicitante,
        addPassageiro,
        updatePassageiro,
        archivePassageiro,
        addDriver,
        updateDriver,
        deleteDriver,
        updateVeiculo,
        deleteVeiculo,
        addParceiro,
        updateParceiro,
        toggleParceiro,
        deleteParceiro,
        unarchiveParceiro,
        addCentroCusto,
        updateCentroCusto,
        deleteCentroCusto,
        addOS,
        updateOS,
        updateOSStatus,
        deleteOS,
        unarchiveOS,
        refreshData,
        getSolicitantesByCliente,
        getCentrosCustoByCliente,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within a DataProvider");
  return context;
};

// Re-exportar tipos para uso externo
export type {
  ParceiroServico,
  ParceiroContato,
  ParceiroFilial,
  NovoParceiroInput,
} from "@/lib/supabase/queries";
