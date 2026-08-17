"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useData, type Cliente, type Driver } from "@/context/DataContext";
import { useParceiros } from "@/hooks/useParceiros";
import { useFornecedores } from "@/hooks/useFornecedores";
import {
  useServerPaginatedTable,
  type UseServerPaginatedTableResult,
} from "@/hooks/useServerPaginatedTable";
import type { ParceiroServico, Fornecedor } from "@/lib/supabase/queries";
import {
  createCaixaFilters,
  createCaixaLookupMaps,
  EMPTY_CAIXA_OVERVIEW,
  endOfMonth,
  endOfWeek,
  getBrazilDate,
  normalizeToInputDate,
  startOfMonth,
  startOfWeek,
  type CaixaConta,
  type CaixaLancamento,
  type CaixaLookupMaps,
  type CaixaOverview,
} from "../_lib/caixa-page";
import {
  createConta,
  createLancamento,
  archiveLancamento,
  getCaixaStats,
  getComprovanteUrl,
  isLancamentoEditavel,
  listContas,
  listLancamentos,
  updateConta,
  updateLancamento,
  type CaixaContaPayload,
  type CaixaLancamentoPayload,
} from "../_services/caixa.service";

type QuickRangeMode = "today" | "week" | "month";
type ActiveQuickRange = QuickRangeMode | "custom" | null;

export type CaixaPageState = {
  // Access
  hasCaixaAccess: boolean;

  // Filters
  dataInicio: string;
  dataFim: string;
  contaId: string;
  tipo: string;
  categoria: string;
  formaPagamento: string;
  clienteId: string;
  parceiroId: string;
  driverId: string;
  origem: string;
  activeQuickRange: ActiveQuickRange;

  // UI visibility
  showFilters: boolean;

  // Stats
  stats: CaixaOverview;
  overviewLoading: boolean;

  // Table
  lancamentosTable: UseServerPaginatedTableResult<CaixaLancamento>;

  // Contas
  contas: CaixaConta[];
  contasLoading: boolean;

  // Lookup maps
  contaMap: Map<string, CaixaConta>;
  customerMap: Map<string, string>;
  driverMap: Map<string, string>;
  partnerMap: Map<string, string>;

  // Modals
  showLancamentoModal: boolean;
  lancamentoEmEdicao: CaixaLancamento | null;
  showContasModal: boolean;
  savingLancamento: boolean;
  savingConta: boolean;
  openActionMenuId: string | null;
  actionMenuRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;

  // Setters / Actions
  setDataInicio: (value: string) => void;
  setDataFim: (value: string) => void;
  setContaId: (value: string) => void;
  setTipo: (value: string) => void;
  setCategoria: (value: string) => void;
  setFormaPagamento: (value: string) => void;
  setClienteId: (value: string) => void;
  setParceiroId: (value: string) => void;
  setDriverId: (value: string) => void;
  setOrigem: (value: string) => void;
  setActiveQuickRange: (value: ActiveQuickRange) => void;
  setShowFilters: (value: boolean | ((prev: boolean) => boolean)) => void;
  setOpenActionMenuId: (
    value: string | null | ((prev: string | null) => string | null),
  ) => void;

  resetFilters: () => void;
  setQuickRange: (mode: QuickRangeMode) => void;
  handleOpenNovoLancamento: () => void;
  handleEditarLancamento: (lancamento: CaixaLancamento) => void;
  closeLancamentoModal: () => void;
  handleOpenContasModal: () => void;
  closeContasModal: () => void;
  handleSalvarLancamento: (
    payload: Omit<CaixaLancamentoPayload, "contaId" | "tipo"> & {
      contaId: string;
      tipo: "entrada" | "saida";
    },
  ) => Promise<void>;
  handleSalvarConta: (payload: CaixaContaPayload) => Promise<void>;
  handleToggleContaAtiva: (conta: CaixaConta) => Promise<void>;
  handleSetContaDefault: (conta: CaixaConta) => Promise<void>;
  handleExcluirLancamento: (lancamento: CaixaLancamento) => Promise<void>;
  handleOpenComprovante: (lancamento: CaixaLancamento) => Promise<void>;
  isLancamentoEditavel: (origem: string | null | undefined) => boolean;

  // External data
  clientes: Cliente[];
  drivers: Driver[];
  parceiros: ParceiroServico[];
  fornecedores: Fornecedor[];
  dataLoading: boolean;
};

const DEFAULT_PAGE_SIZE = 20;

export function useCaixaPage(): CaixaPageState {
  const { profile } = useAuth();
  const { parceiros } = useParceiros();
  const { fornecedores } = useFornecedores();
  const { clientes, drivers, loading: dataLoading } = useData();
  const now = getBrazilDate();

  // Filter states
  const [dataInicio, setDataInicio] = useState(
    normalizeToInputDate(startOfWeek(now)),
  );
  const [dataFim, setDataFim] = useState(normalizeToInputDate(endOfWeek(now)));
  const [contaId, setContaId] = useState("");
  const [tipo, setTipo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [parceiroId, setParceiroId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [origem, setOrigem] = useState("");

  // Stats
  const [stats, setStats] = useState<CaixaOverview>(EMPTY_CAIXA_OVERVIEW);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Contas
  const [contas, setContas] = useState<CaixaConta[]>([]);
  const [contasLoading, setContasLoading] = useState(false);

  // Modals
  const [showLancamentoModal, setShowLancamentoModal] = useState(false);
  const [lancamentoEmEdicao, setLancamentoEmEdicao] =
    useState<CaixaLancamento | null>(null);
  const [showContasModal, setShowContasModal] = useState(false);
  const [savingLancamento, setSavingLancamento] = useState(false);
  const [savingConta, setSavingConta] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // UI visibility
  const [showFilters, setShowFilters] = useState(false);
  const [activeQuickRange, setActiveQuickRange] =
    useState<ActiveQuickRange>("week");

  const actionMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Permission
  const hasCaixaAccess = useMemo((): boolean => {
    if (!profile) return false;
    if (profile.categoria === "administrador") return true;
    const specificPermissions =
      (profile.specific_permissions as Record<string, unknown>) || {};
    const financeiroPerms =
      (specificPermissions.financeiro as Record<string, unknown>) || {};
    if (Object.keys(financeiroPerms).length > 0) {
      return financeiroPerms.page_access === true;
    }
    return profile.categoria === "financeiro";
  }, [profile]);

  // Filtros consolidados (estável por referência)
  const filters = useMemo(
    () =>
      createCaixaFilters({
        dataInicio,
        dataFim,
        contaId,
        tipo,
        categoria,
        formaPagamento,
        clienteId,
        parceiroId,
        driverId,
        origem,
      }),
    [
      dataInicio,
      dataFim,
      contaId,
      tipo,
      categoria,
      formaPagamento,
      clienteId,
      parceiroId,
      driverId,
      origem,
    ],
  );

  // Table
  const lancamentosTable = useServerPaginatedTable(
    useCallback(
      async (params) =>
        listLancamentos({
          ...filters,
          page: params.page,
          pageSize: params.pageSize,
          searchTerm: params.searchTerm,
        }),
      [filters],
    ),
    DEFAULT_PAGE_SIZE,
    hasCaixaAccess,
    "Caixa",
  );

  // Lookup maps
  const { contaMap, customerMap, driverMap, partnerMap }: CaixaLookupMaps =
    useMemo(
      () => createCaixaLookupMaps(contas, clientes, drivers, parceiros),
      [contas, clientes, drivers, parceiros],
    );

  // Carregar contas
  const loadContas = useCallback(async (): Promise<void> => {
    setContasLoading(true);
    try {
      const data = await listContas();
      setContas(data);
    } catch (error) {
      console.error("Erro ao carregar contas:", error);
      setContas([]);
    } finally {
      setContasLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasCaixaAccess) return;
    void loadContas();
  }, [hasCaixaAccess, loadContas]);

  // Load stats
  useEffect(() => {
    if (!hasCaixaAccess) return;
    let cancelled = false;

    const run = async (): Promise<void> => {
      setOverviewLoading(true);
      try {
        const statsData = await getCaixaStats(filters);
        if (!cancelled) setStats(statsData);
      } catch (error) {
        console.error("Erro ao carregar totais do caixa:", error);
        if (!cancelled) setStats(EMPTY_CAIXA_OVERVIEW);
      } finally {
        if (!cancelled) setOverviewLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [filters, hasCaixaAccess]);

  // Close action menu on outside click
  useEffect(() => {
    if (!openActionMenuId) return;
    const handleOutsideClick = (event: MouseEvent): void => {
      const currentMenu = actionMenuRefs.current[openActionMenuId];
      const portalEl = (event.target as HTMLElement).closest?.(
        ".geolog-action-menu-portal",
      );
      if (
        currentMenu &&
        !currentMenu.contains(event.target as Node) &&
        !portalEl
      ) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openActionMenuId]);

  // Reset filters
  const resetFilters = useCallback((): void => {
    const nowDate = getBrazilDate();
    setDataInicio(normalizeToInputDate(startOfWeek(nowDate)));
    setDataFim(normalizeToInputDate(endOfWeek(nowDate)));
    setContaId("");
    setTipo("");
    setCategoria("");
    setFormaPagamento("");
    setClienteId("");
    setParceiroId("");
    setDriverId("");
    setOrigem("");
    setActiveQuickRange("week");
  }, []);

  // Quick range
  const setQuickRange = useCallback((mode: QuickRangeMode): void => {
    const nowDate = getBrazilDate();
    if (mode === "today") {
      const iso = normalizeToInputDate(nowDate);
      setDataInicio(iso);
      setDataFim(iso);
    } else if (mode === "week") {
      setDataInicio(normalizeToInputDate(startOfWeek(nowDate)));
      setDataFim(normalizeToInputDate(endOfWeek(nowDate)));
    } else if (mode === "month") {
      setDataInicio(normalizeToInputDate(startOfMonth(nowDate)));
      setDataFim(normalizeToInputDate(endOfMonth(nowDate)));
    }
    setActiveQuickRange(mode);
  }, []);

  // Modais: lançamento
  const handleOpenNovoLancamento = useCallback((): void => {
    setLancamentoEmEdicao(null);
    setShowLancamentoModal(true);
  }, []);

  const handleEditarLancamento = useCallback(
    (lancamento: CaixaLancamento): void => {
      setLancamentoEmEdicao(lancamento);
      setShowLancamentoModal(true);
      setOpenActionMenuId(null);
    },
    [],
  );

  const closeLancamentoModal = useCallback((): void => {
    setShowLancamentoModal(false);
    setLancamentoEmEdicao(null);
  }, []);

  const handleSalvarLancamento = useCallback(
    async (
      payload: Omit<CaixaLancamentoPayload, "contaId" | "tipo"> & {
        contaId: string;
        tipo: "entrada" | "saida";
      },
    ): Promise<void> => {
      setSavingLancamento(true);
      try {
        if (lancamentoEmEdicao) {
          await updateLancamento(lancamentoEmEdicao.id, {
            contaId: payload.contaId,
            tipo: payload.tipo,
            valor: payload.valor,
            data: payload.data,
            descricao: payload.descricao,
            categoria: payload.categoria,
            formaPagamento: payload.formaPagamento,
            clienteId: payload.clienteId || null,
            parceiroId: payload.parceiroId || null,
            driverId: payload.driverId || null,
            fornecedorId: payload.fornecedorId || null,
            file: payload.file ?? null,
          });
          toast.success("Lançamento atualizado com sucesso.");
        } else {
          await createLancamento(payload);
          toast.success("Lançamento registrado com sucesso.");
        }
        setShowLancamentoModal(false);
        setLancamentoEmEdicao(null);
        await Promise.all([lancamentosTable.refresh(), loadContas()]);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao salvar lançamento.";
        toast.error(message);
      } finally {
        setSavingLancamento(false);
      }
    },
    [lancamentoEmEdicao, lancamentosTable, loadContas],
  );

  // Modais: contas
  const handleOpenContasModal = useCallback((): void => {
    setShowContasModal(true);
  }, []);

  const closeContasModal = useCallback((): void => {
    setShowContasModal(false);
  }, []);

  const handleSalvarConta = useCallback(
    async (payload: CaixaContaPayload): Promise<void> => {
      setSavingConta(true);
      try {
        const contaExistente = contas.find((c) => c.nome === payload.nome);
        if (contaExistente) {
          await updateConta(contaExistente.id, payload);
          toast.success("Conta atualizada com sucesso.");
        } else {
          await createConta(payload);
          toast.success("Conta criada com sucesso.");
        }
        await loadContas();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao salvar conta.";
        toast.error(message);
      } finally {
        setSavingConta(false);
      }
    },
    [contas, loadContas],
  );

  const handleToggleContaAtiva = useCallback(
    async (conta: CaixaConta): Promise<void> => {
      try {
        await updateConta(conta.id, { ativa: !conta.ativa });
        toast.success(conta.ativa ? "Conta desativada." : "Conta ativada.");
        await loadContas();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao atualizar conta.";
        toast.error(message);
      }
    },
    [loadContas],
  );

  const handleSetContaDefault = useCallback(
    async (conta: CaixaConta): Promise<void> => {
      try {
        await updateConta(conta.id, { isDefault: true });
        toast.success(`Conta "${conta.nome}" definida como padrão.`);
        await loadContas();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao definir conta padrão.";
        toast.error(message);
      }
    },
    [loadContas],
  );

  // Excluir lançamento
  const handleExcluirLancamento = useCallback(
    async (lancamento: CaixaLancamento): Promise<void> => {
      if (!isLancamentoEditavel(lancamento.origem)) {
        toast.error("Lançamentos automáticos não podem ser excluídos.");
        return;
      }
      const ok = window.confirm(
        `Excluir o lançamento "${lancamento.descricao || lancamento.categoria}"?`,
      );
      if (!ok) return;
      try {
        await archiveLancamento(lancamento.id);
        toast.success("Lançamento arquivado.");
        setOpenActionMenuId(null);
        await Promise.all([lancamentosTable.refresh(), loadContas()]);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao excluir lançamento.";
        toast.error(message);
      }
    },
    [lancamentosTable, loadContas],
  );

  // Comprovante
  const handleOpenComprovante = useCallback(
    async (lancamento: CaixaLancamento): Promise<void> => {
      setOpenActionMenuId(null);
      if (!lancamento.anexoPath) {
        toast.error("Lançamento não possui comprovante.");
        return;
      }
      try {
        const url = await getComprovanteUrl(lancamento.id);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao abrir comprovante.";
        toast.error(message);
      }
    },
    [],
  );

  return {
    hasCaixaAccess,
    dataInicio,
    dataFim,
    contaId,
    tipo,
    categoria,
    formaPagamento,
    clienteId,
    parceiroId,
    driverId,
    origem,
    activeQuickRange,
    showFilters,
    stats,
    overviewLoading,
    lancamentosTable,
    contas,
    contasLoading,
    contaMap,
    customerMap,
    driverMap,
    partnerMap,
    showLancamentoModal,
    lancamentoEmEdicao,
    showContasModal,
    savingLancamento,
    savingConta,
    openActionMenuId,
    actionMenuRefs,
    setDataInicio: (value) => {
      setDataInicio(value);
      setActiveQuickRange("custom");
    },
    setDataFim: (value) => {
      setDataFim(value);
      setActiveQuickRange("custom");
    },
    setContaId,
    setTipo,
    setCategoria,
    setFormaPagamento,
    setClienteId,
    setParceiroId,
    setDriverId,
    setOrigem,
    setActiveQuickRange,
    setShowFilters,
    setOpenActionMenuId,
    resetFilters,
    setQuickRange,
    handleOpenNovoLancamento,
    handleEditarLancamento,
    closeLancamentoModal,
    handleOpenContasModal,
    closeContasModal,
    handleSalvarLancamento,
    handleSalvarConta,
    handleToggleContaAtiva,
    handleSetContaDefault,
    handleExcluirLancamento,
    handleOpenComprovante,
    isLancamentoEditavel,
    clientes,
    drivers,
    parceiros,
    fornecedores,
    dataLoading,
  };
}
