import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  useData,
  type Cliente,
  type Driver,
  type OrderService,
} from "@/context/DataContext";
import { useParceiros } from "@/hooks/useParceiros";
import {
  useServerPaginatedTable,
  type UseServerPaginatedTableResult,
} from "@/hooks/useServerPaginatedTable";
import { fetchOSFinancePage } from "@/lib/supabase/queries";
import type { ReportPayload } from "@/components/financeiro/RelatorioModal";
import {
  confirmarRecebimento,
  faturarOS,
  getComprovanteUrl,
  getFinanceStats,
  getOSById,
  gerarRelatorio,
  registrarRepasse,
  registrarRepasseLote,
  type ConfirmarRecebimentoPayload,
  type FaturarPayload,
} from "../_services/financeiro.service";
import type { RepasseLoteTarget } from "../_components/FinanceiroModals";
import {
  createFinanceFilters,
  createFinanceLookupMaps,
  EMPTY_FINANCE_OVERVIEW,
  endOfWeek,
  formatCurrency,
  getBrazilDate,
  normalizeToInputDate,
  startOfWeek,
  type FinanceActionTarget,
  type FinanceOverview,
} from "../_lib/financeiro-page";

type QuickRangeMode = "today" | "week" | "month";
type ActiveQuickRange = QuickRangeMode | "custom" | null;

export type FinanceiroPageState = {
  // Access
  hasFinanceiroAccess: boolean;

  // Filters
  dataInicio: string;
  dataFim: string;
  clienteId: string;
  centroCustoId: string;
  parceiroId: string;
  driverId: string;
  driverTipoFilter: string;
  statusOperacional: string;
  statusFinanceiro: string;
  noShowFilter: string;
  horaExtraFilter: string;
  activeQuickRange: ActiveQuickRange;

  // UI visibility
  showFilters: boolean;

  // Stats
  stats: FinanceOverview;
  overviewLoading: boolean;

  // Table
  financeTable: UseServerPaginatedTableResult<OrderService>;

  // Lookup maps
  customerMap: Map<string, string>;
  centerMap: Map<string, string>;
  driverMap: Map<string, string>;
  driverPartnerMap: Map<string, string>;
  driverVinculoMap: Map<string, string>;
  partnerMap: Map<string, string>;

  // Actions / Modals
  actionTarget: FinanceActionTarget | null;
  repasseTarget: OrderService | null;
  repasseLoading: boolean;
  repasseLoteTarget: RepasseLoteTarget | null;
  repasseLoteLoading: boolean;
  viewingOS: OrderService | null;
  viewingOSLoading: boolean;
  openActionMenuId: string | null;
  uploading: boolean;
  faturarFile: File | null;
  faturarTipoDocumento: string;
  faturarObservacao: string;
  recebimentoObservacao: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  actionMenuRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;

  // Report
  reportLoading: boolean;
  showReportModal: boolean;

  // Setters / Actions
  setDataInicio: (value: string) => void;
  setDataFim: (value: string) => void;
  setClienteId: (value: string) => void;
  setCentroCustoId: (value: string) => void;
  setParceiroId: (value: string) => void;
  setDriverId: (value: string) => void;
  setDriverTipoFilter: (value: string) => void;
  setStatusOperacional: (value: string) => void;
  setStatusFinanceiro: (value: string) => void;
  setNoShowFilter: (value: string) => void;
  setHoraExtraFilter: (value: string) => void;
  setActiveQuickRange: (value: ActiveQuickRange) => void;
  setShowFilters: (value: boolean | ((prev: boolean) => boolean)) => void;
  setShowReportModal: (value: boolean | ((prev: boolean) => boolean)) => void;
  handleOpenReportModal: () => void;
  setOpenActionMenuId: (
    value: string | null | ((prev: string | null) => string | null),
  ) => void;
  setFaturarFile: (value: File | null) => void;
  setFaturarTipoDocumento: (value: string) => void;
  setFaturarObservacao: (value: string) => void;
  setRecebimentoObservacao: (value: string) => void;

  // Callbacks
  resetFilters: () => void;
  setQuickRange: (mode: QuickRangeMode) => void;
  handleViewOS: (os: OrderService) => Promise<void>;
  handleOpenFaturar: (os: OrderService) => void;
  handleOpenRecebimento: (os: OrderService) => void;
  handleOpenRepasse: (os: OrderService) => void;
  handleOpenRepasseLote: () => void;
  closeActionModal: () => void;
  closeRepasseModal: () => void;
  closeRepasseLoteModal: () => void;
  closeViewingOS: () => void;
  uploadFaturamento: () => Promise<void>;
  confirmRecebimento: () => Promise<void>;
  confirmRepasse: () => Promise<void>;
  confirmRepasseLote: () => Promise<void>;
  handleGenerateReport: (payload: ReportPayload) => Promise<void>;
  handleOpenAttachment: (target: FinanceActionTarget) => Promise<void>;

  // External data
  clientes: Cliente[];
  drivers: Driver[];
  parceiros: ReturnType<typeof useParceiros>["parceiros"];
  dataLoading: boolean;
};

export function useFinanceiroPage(): FinanceiroPageState {
  const { profile } = useAuth();
  const { parceiros } = useParceiros();
  const { clientes, drivers, loading: dataLoading, lastOSUpdate } = useData();
  const now = getBrazilDate();

  // Filter states
  const [dataInicio, setDataInicio] = useState(
    normalizeToInputDate(startOfWeek(now)),
  );
  const [dataFim, setDataFim] = useState(normalizeToInputDate(endOfWeek(now)));
  const [clienteId, setClienteId] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [parceiroId, setParceiroId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [driverTipoFilter, setDriverTipoFilter] = useState("");
  const [statusOperacional, setStatusOperacional] = useState("");
  const [statusFinanceiro, setStatusFinanceiro] = useState("");
  const [noShowFilter, setNoShowFilter] = useState("");
  const [horaExtraFilter, setHoraExtraFilter] = useState("");

  // Stats
  const [stats, setStats] = useState<FinanceOverview>(EMPTY_FINANCE_OVERVIEW);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Report
  const [reportLoading, setReportLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const isReportModalEnabled = true;

  // Modals / Actions
  const [actionTarget, setActionTarget] = useState<FinanceActionTarget | null>(
    null,
  );
  const [repasseTarget, setRepasseTarget] = useState<OrderService | null>(null);
  const [repasseLoading, setRepasseLoading] = useState(false);
  const [repasseLoteTarget, setRepasseLoteTarget] =
    useState<RepasseLoteTarget | null>(null);
  const [repasseLoteLoading, setRepasseLoteLoading] = useState(false);
  const [viewingOS, setViewingOS] = useState<OrderService | null>(null);
  const [viewingOSLoading, setViewingOSLoading] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [faturarFile, setFaturarFile] = useState<File | null>(null);
  const [faturarTipoDocumento, setFaturarTipoDocumento] =
    useState("nota_fiscal");
  const [faturarObservacao, setFaturarObservacao] = useState("");
  const [recebimentoObservacao, setRecebimentoObservacao] = useState("");
  const [uploading, setUploading] = useState(false);

  // UI visibility
  const [showFilters, setShowFilters] = useState(false);
  const [activeQuickRange, setActiveQuickRange] =
    useState<ActiveQuickRange>("week");

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Derived filters
  const filters = useMemo(
    () =>
      createFinanceFilters({
        dataInicio,
        dataFim,
        clienteId,
        centroCustoId,
        driverId,
        parceiroId,
        statusOperacional,
        statusFinanceiro,
        noShowFilter,
        horaExtraFilter,
      }),
    [
      dataInicio,
      dataFim,
      clienteId,
      centroCustoId,
      driverId,
      parceiroId,
      statusOperacional,
      statusFinanceiro,
      noShowFilter,
      horaExtraFilter,
    ],
  );

  // Table
  const financeTable = useServerPaginatedTable(
    useCallback(
      async (params) => fetchOSFinancePage({ ...params, ...filters }),
      [filters],
    ),
    10,
    true,
    "Financeiro",
  );

  // Lookup maps
  const {
    customerMap,
    centerMap,
    driverMap,
    driverPartnerMap,
    driverVinculoMap,
    partnerMap,
  } = useMemo(
    () => createFinanceLookupMaps(clientes, drivers, parceiros),
    [clientes, drivers, parceiros],
  );

  // Permission
  const hasFinanceiroAccess = useMemo((): boolean => {
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

  // Load stats
  const loadStats = useCallback(async (): Promise<void> => {
    setOverviewLoading(true);
    try {
      const statsData = await getFinanceStats(filters);
      setStats(statsData);
    } catch (error) {
      console.error("Erro ao carregar dashboard financeiro:", error);
      setStats(EMPTY_FINANCE_OVERVIEW);
    } finally {
      setOverviewLoading(false);
    }
  }, [filters]);

  // Load stats effect
  useEffect(() => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      setOverviewLoading(true);
      try {
        const statsData = await getFinanceStats(filters);
        if (!cancelled) {
          setStats(statsData);
        }
      } catch (error) {
        console.error("Erro ao carregar dashboard financeiro:", error);
        if (!cancelled) {
          setStats(EMPTY_FINANCE_OVERVIEW);
        }
      } finally {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [filters, lastOSUpdate]);

  // Close action menu on outside click
  useEffect(() => {
    if (!openActionMenuId) return;

    const handleOutsideClick = (event: MouseEvent): void => {
      const currentMenu = actionMenuRefs.current[openActionMenuId];
      if (currentMenu && !currentMenu.contains(event.target as Node)) {
        setOpenActionMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [openActionMenuId]);

  // Reset filters
  const resetFilters = useCallback((): void => {
    const currentDate = getBrazilDate();
    setDataInicio(normalizeToInputDate(startOfWeek(currentDate)));
    setDataFim(normalizeToInputDate(endOfWeek(currentDate)));
    setClienteId("");
    setCentroCustoId("");
    setParceiroId("");
    setDriverId("");
    setDriverTipoFilter("");
    setStatusOperacional("");
    setStatusFinanceiro("");
    setNoShowFilter("");
    setHoraExtraFilter("");
    setActiveQuickRange("week");
  }, []);

  // Quick range setter
  const setQuickRange = useCallback((mode: QuickRangeMode): void => {
    const currentDate = getBrazilDate();

    if (mode === "today") {
      const today = normalizeToInputDate(currentDate);
      setDataInicio(today);
      setDataFim(today);
      setActiveQuickRange("today");
      return;
    }

    if (mode === "week") {
      setDataInicio(normalizeToInputDate(startOfWeek(currentDate)));
      setDataFim(normalizeToInputDate(endOfWeek(currentDate)));
      setActiveQuickRange("week");
      return;
    }

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    firstDay.setHours(0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0);
    lastDay.setHours(23, 59, 59, 999);

    setDataInicio(normalizeToInputDate(firstDay));
    setDataFim(normalizeToInputDate(lastDay));
    setActiveQuickRange("month");
  }, []);

  // View OS details
  const handleViewOS = useCallback(async (os: OrderService): Promise<void> => {
    setOpenActionMenuId(null);
    setViewingOS(os);
    setViewingOSLoading(true);

    try {
      const latest = await getOSById(os.id);
      if (latest) {
        setViewingOS(latest);
      }
    } catch (error) {
      console.error("Erro ao carregar detalhes da OS:", error);
      toast.error("Não foi possível carregar os detalhes da OS.");
    } finally {
      setViewingOSLoading(false);
    }
  }, []);

  // Open faturar modal
  const handleOpenFaturar = useCallback((os: OrderService): void => {
    setOpenActionMenuId(null);
    setActionTarget({ os });
    setFaturarFile(null);
    setFaturarTipoDocumento("nota_fiscal");
    setFaturarObservacao("");
    setRecebimentoObservacao("");
  }, []);

  // Open recebimento modal
  const handleOpenRecebimento = useCallback((os: OrderService): void => {
    setOpenActionMenuId(null);
    setActionTarget({ os });
    setRecebimentoObservacao("");
    setFaturarFile(null);
  }, []);

  // Open repasse modal
  const handleOpenRepasse = useCallback((os: OrderService): void => {
    setOpenActionMenuId(null);
    setRepasseTarget(os);
  }, []);

  // Close repasse modal
  const closeRepasseModal = useCallback((): void => {
    setRepasseTarget(null);
    setRepasseLoading(false);
  }, []);

  // Open repasse lote modal
  const handleOpenRepasseLote = useCallback((): void => {
    if (!driverId) return;
    const driverName = driverMap.get(driverId) ?? "Motorista";
    const pendingValue =
      stats.totalCustoAutonomos - stats.totalPagoAutonomos;
    setRepasseLoteTarget({
      driverId,
      driverName,
      dataInicio,
      dataFim,
      pendingValue,
    });
  }, [driverId, driverMap, stats, dataInicio, dataFim]);

  // Close repasse lote modal
  const closeRepasseLoteModal = useCallback((): void => {
    setRepasseLoteTarget(null);
    setRepasseLoteLoading(false);
  }, []);

  // Confirm repasse lote
  const confirmRepasseLote = useCallback(async (): Promise<void> => {
    if (!repasseLoteTarget) return;

    setRepasseLoteLoading(true);
    try {
      const result = await registrarRepasseLote(
        repasseLoteTarget.driverId,
        repasseLoteTarget.dataInicio,
        repasseLoteTarget.dataFim,
      );
      await financeTable.refresh();
      await loadStats();
      toast.success(
        `Repasse em lote registrado: ${result.count} OS (${formatCurrency(result.totalValue)})`,
      );
      setRepasseLoteTarget(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao registrar repasse em lote.",
      );
    } finally {
      setRepasseLoteLoading(false);
    }
  }, [repasseLoteTarget, financeTable, loadStats]);

  // Confirm repasse
  const confirmRepasse = useCallback(async (): Promise<void> => {
    if (!repasseTarget) return;

    setRepasseLoading(true);
    try {
      await registrarRepasse(repasseTarget.id);
      await financeTable.refresh();
      await loadStats();
      toast.success("Repasse registrado com sucesso.");
      setRepasseTarget(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao registrar repasse.",
      );
    } finally {
      setRepasseLoading(false);
    }
  }, [repasseTarget, financeTable, loadStats]);

  // Open report modal
  const handleOpenReportModal = useCallback((): void => {
    if (!isReportModalEnabled) {
      return;
    }

    setShowReportModal(true);
  }, [isReportModalEnabled]);

  // Close action modal
  const closeActionModal = useCallback((): void => {
    setActionTarget(null);
    setFaturarFile(null);
    setRecebimentoObservacao("");
    setFaturarObservacao("");
  }, []);

  // Close viewing OS
  const closeViewingOS = useCallback((): void => {
    setViewingOS(null);
    setViewingOSLoading(false);
  }, []);

  // Upload faturamento
  const uploadFaturamento = useCallback(async (): Promise<void> => {
    if (!actionTarget) return;
    if (!faturarFile) {
      toast.error("Selecione um arquivo PDF ou imagem.");
      return;
    }

    setUploading(true);
    try {
      await faturarOS({
        osId: actionTarget.os.id,
        file: faturarFile,
        tipoDocumento: faturarTipoDocumento,
        observacao: faturarObservacao,
      } as FaturarPayload);

      toast.success("OS faturada com comprovante anexado.");
      closeActionModal();
      await financeTable.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao faturar.");
    } finally {
      setUploading(false);
    }
  }, [
    actionTarget,
    closeActionModal,
    faturarFile,
    faturarObservacao,
    faturarTipoDocumento,
    financeTable,
  ]);

  // Confirm recebimento
  const confirmRecebimento = useCallback(async (): Promise<void> => {
    if (!actionTarget) return;

    setUploading(true);
    try {
      await confirmarRecebimento({
        osId: actionTarget.os.id,
        observacao: recebimentoObservacao,
      } as ConfirmarRecebimentoPayload);

      toast.success("Valor marcado como recebido.");
      closeActionModal();
      await financeTable.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao dar baixa.",
      );
    } finally {
      setUploading(false);
    }
  }, [actionTarget, closeActionModal, financeTable, recebimentoObservacao]);

  // Generate report
  const handleGenerateReport = useCallback(
    async (payload: ReportPayload): Promise<void> => {
      setReportLoading(true);
      try {
        const blob = await gerarRelatorio(payload);
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        const ext = payload.format === "csv" ? "csv" : "pdf";
        const fileName = `relatorio-${payload.template}-${payload.dataInicio}-ate-${payload.dataFim}.${ext}`;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
        toast.success("Relatório gerado com sucesso!");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Erro ao gerar relatório.",
        );
      } finally {
        setReportLoading(false);
      }
    },
    [],
  );

  // Open attachment
  const handleOpenAttachment = useCallback(
    async (target: FinanceActionTarget): Promise<void> => {
      const attachmentId = target.os.financeiroAnexos?.[0]?.id;
      if (!attachmentId) {
        toast.error("Nenhum comprovante disponível.");
        return;
      }

      try {
        const signedUrl = await getComprovanteUrl(attachmentId);
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Erro ao abrir comprovante.",
        );
      }
    },
    [],
  );

  return {
    hasFinanceiroAccess,

    dataInicio,
    dataFim,
    clienteId,
    centroCustoId,
    parceiroId,
    driverId,
    driverTipoFilter,
    statusOperacional,
    statusFinanceiro,
    noShowFilter,
    horaExtraFilter,
    activeQuickRange,

    showFilters,

    stats,
    overviewLoading,

    financeTable,

    customerMap,
    centerMap,
    driverMap,
    driverPartnerMap,
    driverVinculoMap,
    partnerMap,

    actionTarget,
    repasseTarget,
    repasseLoading,
    repasseLoteTarget,
    repasseLoteLoading,
    viewingOS,
    viewingOSLoading,
    openActionMenuId,
    uploading,
    faturarFile,
    faturarTipoDocumento,
    faturarObservacao,
    recebimentoObservacao,
    fileInputRef,
    actionMenuRefs,

    reportLoading,
    showReportModal,

    setDataInicio,
    setDataFim,
    setClienteId,
    setCentroCustoId,
    setParceiroId,
    setDriverId,
    setDriverTipoFilter,
    setStatusOperacional,
    setStatusFinanceiro,
    setNoShowFilter,
    setHoraExtraFilter,
    setActiveQuickRange,
    setShowFilters,
    setShowReportModal,
    handleOpenReportModal,
    setOpenActionMenuId,
    setFaturarFile,
    setFaturarTipoDocumento,
    setFaturarObservacao,
    setRecebimentoObservacao,

    resetFilters,
    setQuickRange,
    handleViewOS,
    handleOpenFaturar,
    handleOpenRecebimento,
    handleOpenRepasse,
    handleOpenRepasseLote,
    closeActionModal,
    closeRepasseModal,
    closeRepasseLoteModal,
    closeViewingOS,
    uploadFaturamento,
    confirmRecebimento,
    confirmRepasse,
    confirmRepasseLote,
    handleGenerateReport,
    handleOpenAttachment,

    clientes,
    drivers,
    parceiros,
    dataLoading,
  };
}
