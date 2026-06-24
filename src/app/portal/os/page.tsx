"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { replaceOperationalCyclesForOS } from "@/lib/operational-cycles-db";
import StandardModal from "@/components/StandardModal";
import { FormErrorMessage } from "@/components/ui/FormErrorMessage";
import { logInfo } from "@/lib/frontend-logger";
import { getThumbnailUrl } from "@/utils/avatar";
import {
  Plus,
  Minus,
  Truck,
  User,
  UserPlus,
  Calendar,
  X,
  PlusCircle,
  FileText,
  MapPin,
  Circle,
  Flag,
  Clock,
  CheckCircle2,
  Navigation,
  ArrowRight,
  ArrowLeft,
  Building,
  MoreVertical,
  Eye,
  Pencil,
  Edit2,
  RotateCcw,
  XOctagon,
  MessageCircle,
  MessageSquareMore,
  Users,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  IdCard,
  Building2,
  Handshake,
  Car,
  Loader2,
  LayoutGrid,
  CalendarDays,
  Trash2,
  Mail,
  Smartphone,
  Bell,
  Send,
  Filter,
  FilterX,
  Link,
  History,
  Archive,
  Save,
  RefreshCw,
  Route,
  Activity,
  Edit3,
  Gauge,
  Layers,
  Package,
  Briefcase,
  DollarSign,
} from "lucide-react";
import {
  useData,
  type OrderService,
  type Passageiro,
  type ParceiroServico,
} from "@/context/DataContext";
import {
  fetchOSById,
  fetchOSByProtocolo,
  fetchOSPage,
  fetchOSLogs,
  fetchOSCalendarRange,
  checkActiveOSForDriverVehicle,
  fetchPassageirosPage,
  fetchPassageirosByIds,
  type OSLog,
  type OSPageFilters,
} from "@/lib/supabase/queries";
import {
  createDocagem,
  fetchDocagemInstancesByRange,
  fetchDocagens,
  fetchDocagemById,
  finalizarDocagemDia,
  excluirDocagemDia,
  reativarDocagemDia,
  resetarDocagemDia,
  cancelarDocagem,
  updateDocagem,
  updateDocagemInstance,
  type DocagemInstance,
  type DocagemInput,
  type DocagemSummary,
} from "@/lib/supabase/docagem-queries";
import { useServerPaginatedTable } from "@/hooks/useServerPaginatedTable";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import GeologDateInput from "@/components/ui/GeologDateInput";
import { DataTable } from "@/components/ui/DataTable";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";
import RequiredAsterisk from "@/components/ui/RequiredAsterisk";
import OSCalendar from "@/components/OS/OSCalendar";
import { useConfirm } from "@/hooks/useConfirm";
import { BASE_URL } from "@/lib/constants";
import { logErrorEntry } from "@/lib/frontend-logger";
import {
  formatBrazilPhone,
  normalizeBrazilPhone,
  stripBrazilCountryCode,
} from "@/lib/phone";
import {
  buildOperationalCyclesFromWaypoints,
  getOperationalCycleBannerTitle,
  getCycleDisplayStatus,
  deriveCyclesOperationalStatus,
  getOperationalCycleTitle,
  type CycleOperationalStatus,
  type OperationalCycleState,
} from "@/lib/os-messages";
import {
  getOSLogHighlightTags,
  getOSLogTone,
  getOSLogActorKind,
  getOSLogActorPhrase,
  TAG_CATEGORY_STYLES,
  type OSLogHighlightTag,
  type OSLogType,
} from "@/lib/os-activity";
import {
  parseHoraExtraMinutes,
  calcBilledMinutes,
  calcHoraExtraCliente,
  calcHoraExtraMotorista,
  formatBilledHours,
} from "@/lib/financeiro";

type FormPassenger = { id: string; solicitanteId: string; nome: string };
type FormWaypoint = {
  label: string;
  lat: number | null;
  lng: number | null;
  comment: string;
  passengers: FormPassenger[];
  itineraryIndex?: number;
  hora?: string;
  data?: string;
};
type OSFormData = {
  data: string;
  hora: string;
  horaExtra: string;
  noShow: boolean;
  noShowPercentual: number | null;
  os: string;
  clienteId: string;
  solicitante: string;
  solicitanteId: string;
  motorista: string;
  driverId: string;
  veiculoId: string;
  centroCusto: string;
  valorBruto: number | null;
  custo: number | null;
  obsFinanceiras: string;
  waypoints: FormWaypoint[];
};

type PendingOSData = Omit<OSFormData, "hora"> & {
  hora: string | null;
  rota: { waypoints: FormWaypoint[] };
};

// Helper: group waypoints into itineraries
type LocalItineraryGroup = {
  index: number;
  waypoints: FormWaypoint[];
  waypointIndices: number[];
};
const getItineraries = (waypoints: FormWaypoint[]): LocalItineraryGroup[] => {
  const groups: Record<number, LocalItineraryGroup> = {};
  waypoints.forEach((wp, idx) => {
    const it = wp.itineraryIndex ?? 0;
    if (!groups[it])
      groups[it] = { index: it, waypoints: [], waypointIndices: [] };
    groups[it].waypoints.push(wp);
    groups[it].waypointIndices.push(idx);
  });
  return Object.values(groups).sort(
    (a, b) => a.waypointIndices[0] - b.waypointIndices[0],
  );
};

const getItinerarySectionTitle = (): string => "Rotas e Destinos";

const normalizeHoraExtraForInput = (value?: string | null): string => {
  if (!value) return "";

  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.includes(":")) {
    const [hours = "", minutes = ""] = trimmed.split(":");
    if (!hours) return "";
    return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 1) return `0${digits}:00`;
  if (digits.length === 2) return `${digits}:00`;
  if (digits.length === 3) {
    return `0${digits.slice(0, 1)}:${digits.slice(1, 3)}`;
  }
  if (digits.length >= 4) {
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  }

  return trimmed;
};

const getItineraryTitle = (itineraryIndex: number): string => {
  if (itineraryIndex < 0) {
    return "Retorno";
  }
  return "Itinerário";
};

function numeroParaOrdinal(n: number): string {
  const unidades = [
    "",
    "Primeiro",
    "Segundo",
    "Terceiro",
    "Quarto",
    "Quinto",
    "Sexto",
    "Sétimo",
    "Oitavo",
    "Nono",
  ];
  const especiais: Record<number, string> = {
    10: "Décimo",
    11: "Décimo Primeiro",
    12: "Décimo Segundo",
    13: "Décimo Terceiro",
    14: "Décimo Quarto",
    15: "Décimo Quinto",
    16: "Décimo Sexto",
    17: "Décimo Sétimo",
    18: "Décimo Oitavo",
    19: "Décimo Nono",
  };
  const dezenas: Record<number, string> = {
    2: "Vigésimo",
    3: "Trigésimo",
    4: "Quadragésimo",
    5: "Quinquagésimo",
    6: "Sexagésimo",
    7: "Septuagésimo",
    8: "Octogésimo",
    9: "Nonagésimo",
  };
  if (n >= 1 && n <= 9) return unidades[n];
  if (n >= 10 && n <= 19) return especiais[n] || "";
  if (n >= 20 && n <= 99) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    const dezenaText = dezenas[d] || "";
    const unidadeText = u > 0 ? unidades[u] : "";
    if (dezenaText && unidadeText) return `${dezenaText} ${unidadeText}`;
    return dezenaText || unidadeText || String(n);
  }
  if (n === 100) return "Centésimo";
  return String(n);
}

type QuickAddDriverForm = {
  name: string;
  cpf: string;
  celular: string;
  vehicle_ids: string[];
  vinculo_tipo: "interno" | "parceiro" | "autonomo";
  parceiro_id: string;
  tipo_documento: "cpf" | "passaporte";
};

type VehicleOption = {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  tipo?: "carro" | "van" | "onibus" | "moto" | "caminhao" | "outro";
};

const initialQuickAddDriverForm: QuickAddDriverForm = {
  name: "",
  cpf: "",
  celular: "",
  vehicle_ids: [],
  vinculo_tipo: "parceiro",
  parceiro_id: "",
  tipo_documento: "cpf",
};

const formatDriverDocument = (
  value: string,
  tipo: "cpf" | "passaporte",
): string => {
  if (tipo === "cpf") {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  return value
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 9);
};

const formatDriverCelular = (value: string): string => {
  return formatBrazilPhone(value);
};

const validateDriverCPF = (value: string): boolean => {
  const cpfClean = value.replace(/\D/g, "");
  if (cpfClean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpfClean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpfClean.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpfClean.charAt(9))) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpfClean.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpfClean.charAt(10))) return false;
  return true;
};

const validateDriverCelular = (value: string): boolean => {
  const digits = stripBrazilCountryCode(value);
  if (digits.length !== 11) return false;
  if (digits[2] !== "9") return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const ddd = digits.slice(0, 2);
  const validDDDs = [
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "21",
    "22",
    "24",
    "27",
    "28",
    "31",
    "32",
    "33",
    "34",
    "35",
    "37",
    "38",
    "41",
    "42",
    "43",
    "44",
    "45",
    "46",
    "47",
    "48",
    "49",
    "51",
    "53",
    "54",
    "55",
    "61",
    "62",
    "63",
    "64",
    "65",
    "66",
    "67",
    "68",
    "69",
    "71",
    "73",
    "74",
    "75",
    "77",
    "79",
    "81",
    "82",
    "83",
    "84",
    "85",
    "86",
    "87",
    "88",
    "89",
    "91",
    "92",
    "93",
    "94",
    "95",
    "96",
    "97",
    "98",
    "99",
  ];
  if (!validDDDs.includes(ddd)) return false;
  const prefix = digits.slice(3, 7);
  if (prefix === "0000") return false;
  return true;
};

const getDriverDocumentLabel = (tipo: "cpf" | "passaporte"): string => {
  return tipo === "cpf" ? "CPF" : "Passaporte";
};

const getDriverDocumentPlaceholder = (tipo: "cpf" | "passaporte"): string => {
  return tipo === "cpf" ? "000.000.000-00" : "AA1234567";
};

const tipoDocumentoOptions = [
  { id: "cpf", nome: "CPF" },
  { id: "passaporte", nome: "Passaporte" },
];

const normalizeTextValue = (value: string): string =>
  value.trim().toLowerCase();
const normalizeDigitsValue = (value: string): string =>
  value.replace(/\D/g, "");
const forceUpperText = (value: string): string => value.toUpperCase();

const MARCAS_VEICULOS = [
  { id: "Acura", nome: "Acura" },
  { id: "Agrale", nome: "Agrale" },
  { id: "Alfa Romeo", nome: "Alfa Romeo" },
  { id: "Aston Martin", nome: "Aston Martin" },
  { id: "Audi", nome: "Audi" },
  { id: "Bentley", nome: "Bentley" },
  { id: "BMW", nome: "BMW" },
  { id: "BYD", nome: "BYD" },
  { id: "Caoa Chery", nome: "Caoa Chery" },
  { id: "Chevrolet", nome: "Chevrolet" },
  { id: "Chrysler", nome: "Chrysler" },
  { id: "Citroën", nome: "Citroën" },
  { id: "Dodge", nome: "Dodge" },
  { id: "Ferrari", nome: "Ferrari" },
  { id: "Fiat", nome: "Fiat" },
  { id: "Ford", nome: "Ford" },
  { id: "GWM", nome: "GWM" },
  { id: "Honda", nome: "Honda" },
  { id: "Hyundai", nome: "Hyundai" },
  { id: "Jac", nome: "Jac" },
  { id: "Jaguar", nome: "Jaguar" },
  { id: "Jeep", nome: "Jeep" },
  { id: "Kia", nome: "Kia" },
  { id: "Lamborghini", nome: "Lamborghini" },
  { id: "Land Rover", nome: "Land Rover" },
  { id: "Lexus", nome: "Lexus" },
  { id: "Lifan", nome: "Lifan" },
  { id: "Maserati", nome: "Maserati" },
  { id: "McLaren", nome: "McLaren" },
  { id: "Mercedes-Benz", nome: "Mercedes-Benz" },
  { id: "Mini", nome: "Mini" },
  { id: "Mitsubishi", nome: "Mitsubishi" },
  { id: "Nissan", nome: "Nissan" },
  { id: "Peugeot", nome: "Peugeot" },
  { id: "Porsche", nome: "Porsche" },
  { id: "Ram", nome: "Ram" },
  { id: "Renault", nome: "Renault" },
  { id: "Rolls-Royce", nome: "Rolls-Royce" },
  { id: "Seat", nome: "Seat" },
  { id: "Smart", nome: "Smart" },
  { id: "Subaru", nome: "Subaru" },
  { id: "Suzuki", nome: "Suzuki" },
  { id: "Tesla", nome: "Tesla" },
  { id: "Toyota", nome: "Toyota" },
  { id: "Troller", nome: "Troller" },
  { id: "Volkswagen", nome: "Volkswagen" },
  { id: "Volvo", nome: "Volvo" },
  { id: "Outra", nome: "Outra" },
];

const TIPOS_VEICULO_OS = [
  { id: "carro", nome: "Carro" },
  { id: "van", nome: "Van" },
  { id: "onibus", nome: "Ônibus" },
  { id: "moto", nome: "Moto" },
  { id: "caminhao", nome: "Caminhão" },
  { id: "outro", nome: "Outro" },
];

const formatarPlacaOS = (value: string): string => {
  const cleaned = value
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 7);
  if (cleaned.length >= 5 && /[A-Z]/.test(cleaned[4]))
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  if (cleaned.length >= 4) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return cleaned;
};

/** Tipo local para opções do combobox assíncrono de passageiros. */
type PassengerOption = {
  id: string;
  nome: string;
  sublabel?: string;
};

const validarPlacaOS = (placa: string): boolean => {
  const c = placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (
    /^[A-Z]{3}[0-9]{4}$/.test(c) ||
    /^[A-Z]{3}[0-9]{1}[A-Z]{1}[0-9]{2}$/.test(c) ||
    /^[A-Z]{3}[0-9]{2}[A-Z]{1}[0-9]{1}$/.test(c)
  );
};

export default function OSOperationalPage() {
  const {
    osList,
    osCounts,
    clientes,
    solicitantes,
    drivers,
    passageiros,
    parceiros,
    addOS,
    updateOS,
    updateOSStatus,
    deleteOS,
    unarchiveOS,
    addPassageiro,
    addDriver,
    getCentrosCustoByCliente,
    addCliente,
    addSolicitante,
    addCentroCusto,
    addParceiro,
    impostoPercentual,
    loading: dataLoading,
    heavyLoading,
  } = useData();
  const supabase = createClient();
  const { confirm, confirmState, closeConfirm, handleConfirm } = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showObsFinanceiras, setShowObsFinanceiras] = useState(false);
  const [isQuickPassengerModalOpen, setIsQuickPassengerModalOpen] =
    useState(false);
  const [quickPassengerTarget, setQuickPassengerTarget] = useState<{
    waypointIndex: number;
    passengerId: string;
  } | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [calendarMenuPosition, setCalendarMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [editingOSId, setEditingOSId] = useState<string | null>(null);
  const [viewingOSId, setViewingOSId] = useState<string | null>(null);
  const [viewingOSLoading, setViewingOSLoading] = useState(false);
  const [viewingOSLive, setViewingOSLive] = useState<OrderService | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("calendar");
  const [calendarOSList, setCalendarOSList] = useState<OrderService[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarHasLoaded, setCalendarHasLoaded] = useState(false);
  const [docagemInstances, setDocagemInstances] = useState<DocagemInstance[]>(
    [],
  );
  const [docagemList, setDocagemList] = useState<DocagemSummary[]>([]);
  const [docagemListLoading, setDocagemListLoading] = useState(false);
  const [docagemListFilter, setDocagemListFilter] = useState<
    "all" | "os" | "docagem" | "rascunho"
  >("all");
  const [isDocagemModalOpen, setIsDocagemModalOpen] = useState(false);
  const [isAttendanceChoiceModalOpen, setIsAttendanceChoiceModalOpen] =
    useState(false);
  const [docagemFormData, setDocagemFormData] = useState<DocagemInput>({
    clienteId: "",
    centroCustoId: null,
    solicitanteId: null,
    motoristaId: null,
    veiculoId: null,
    endereco: "",
    dataInicio: "",
    dataFim: "",
    horarioInicio: "",
    horarioFim: "",
    diasSemana: [1, 2, 3, 4, 5],
    valorDiario: 0,
    custoDiario: null,
    observacao: null,
    observacaoFinanceira: null,
  });
  const [docagemMenuTarget, setDocagemMenuTarget] = useState<{
    id: string;
    position: { x: number; y: number };
  } | null>(null);
  const [viewingDocagemInstance, setViewingDocagemInstance] =
    useState<DocagemInstance | null>(null);
  const [editingDocagemInstance, setEditingDocagemInstance] =
    useState<DocagemInstance | null>(null);
  const [editingDocagemId, setEditingDocagemId] = useState<string | null>(null);
  const [editingDocagemData, setEditingDocagemData] =
    useState<DocagemInput | null>(null);
  const [docagemInstanceEditForm, setDocagemInstanceEditForm] = useState<{
    endereco: string;
    motoristaId: string | null;
    veiculoId: string | null;
    valor: number;
    custo: number | null;
    horarioInicio: string;
    horarioFim: string;
    observacaoFinanceira: string | null;
  } | null>(null);
  const [copiedProtocol, setCopiedProtocol] = useState<string | null>(null);
  const [isSubmittingDocagem, setIsSubmittingDocagem] = useState(false);
  const [users, setUsers] = useState<{ id: string; nome: string }[]>([]);

  const [driverNotificationSentByOS, setDriverNotificationSentByOS] = useState<
    Record<string, boolean>
  >({});
  const [osLogs, setOsLogs] = useState<OSLog[]>([]);
  const actionMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const calendarMenuRef = useRef<HTMLDivElement | null>(null);
  const docagemMenuRef = useRef<HTMLDivElement | null>(null);
  const passengerDraftIdRef = useRef(0);
  const viewingOSPollRef = useRef<NodeJS.Timeout | null>(null);

  type AdvancedFilters = {
    osNumber: string;
    clienteId: string;
    centroCustoId: string;
    solicitante: string;
    driverId: string;
    veiculoId: string;
    passageiro: string;
    dataInicio: string;
    dataFim: string;
    statusOperacional:
      | ""
      | "Pendente"
      | "Aguardando"
      | "Em Rota"
      | "Finalizado"
      | "Cancelado";
    createdBy: string;
  };

  const defaultAdvancedFilters: AdvancedFilters = {
    osNumber: "",
    clienteId: "",
    centroCustoId: "",
    solicitante: "",
    driverId: "",
    veiculoId: "",
    passageiro: "",
    dataInicio: "",
    dataFim: "",
    statusOperacional: "",
    createdBy: "",
  };

  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(
    defaultAdvancedFilters,
  );
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [isArchivedFilterLoading, setIsArchivedFilterLoading] = useState(false);
  const [tableFilters, setTableFilters] = useState<OSPageFilters>({});

  const fetchOSPageWithFilters = useCallback(
    async (params: { page: number; pageSize: number; searchTerm: string }) => {
      const filters = {
        ...tableFilters,
        arquivado: showArchivedOnly ? true : undefined,
      };
      const result = await fetchOSPage({
        ...params,
        filters,
      });

      const filterDescription = Object.entries(filters)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");

      logInfo(
        "OS/Tabela",
        `Tabela carregada: página ${params.page}, ${result.totalCount} OS totais${filterDescription ? ` (filtros: ${filterDescription})` : ""}`,
        {
          page: params.page,
          pageSize: params.pageSize,
          searchTerm: params.searchTerm,
          filters,
          totalItems: result.totalCount,
          itemsLoaded: result.items.length,
        },
      );

      return result;
    },
    [tableFilters, showArchivedOnly],
  );

  const osTable = useServerPaginatedTable(
    fetchOSPageWithFilters,
    10,
    true,
    "OS/Tabela",
  );

  useEffect(() => {
    const handleSearchProtocol = (event: Event) => {
      const customEvent = event as CustomEvent<{ protocolo?: string }>;
      const protocolo = customEvent.detail?.protocolo?.trim();
      if (!protocolo) return;

      if (protocolo !== osTable.searchTerm) {
        osTable.setSearchTerm(protocolo);
      }
    };

    window.addEventListener("os-search-protocolo", handleSearchProtocol);
    return () => {
      window.removeEventListener("os-search-protocolo", handleSearchProtocol);
    };
  }, [osTable]);

  // Aplicar filtro de protocolo via URL imediatamente na montagem
  const initialSearchSetRef = useRef(false);
  useEffect(() => {
    if (initialSearchSetRef.current) return;
    const urlParams = new URLSearchParams(window.location.search);
    const searchProtocoloParam = urlParams.get("search_protocolo");
    if (searchProtocoloParam) {
      osTable.setSearchTerm(searchProtocoloParam);
      window.history.replaceState({}, "", "/portal/os");
      initialSearchSetRef.current = true;
    }
  }, [osTable]);

  const getOperationalStatusForOS = useCallback(
    (os?: OrderService | null): CycleOperationalStatus => {
      if (!os) return "Pendente";
      if (os.operationalCycles && os.operationalCycles.length > 0) {
        return deriveCyclesOperationalStatus(os.operationalCycles);
      }
      return os.status.operacional;
    },
    [],
  );

  // ── Cache de passageiros (dois níveis) ──────────────────────────────────
  // Declarado aqui (antes dos useMemos que dependem dele) para evitar TDZ.
  // A hidratação (useEffect) fica abaixo, após formData e viewingOS estarem
  // disponíveis.
  //
  // fullPassengersRef  → registros completos (com enderecos), via fetchPassageirosByIds.
  //   Alimenta getPassengerRecord: detail panel, filtro, resumo, notificações.
  //
  // lightPassengersRef → registros leves (sem enderecos), via fetchPassageirosPage.
  //   Alimenta somente o dropdown (getPassengerOption) para exibir o nome no trigger.
  //   Não interfere na decisão de hidratação do fullPassengersRef.
  const fullPassengersRef = useRef<Record<string, Passageiro>>({});
  const lightPassengersRef = useRef<Record<string, PassengerOption>>({});
  const [passengerOptionsVer, setPassengerOptionsVer] = useState(0);

  const getPassengerRecord = useCallback(
    (id: string): Passageiro | null => {
      if (!id) return null;
      const fromCtx = passageiros.find((p) => p.id === id);
      if (fromCtx) return fromCtx;
      return fullPassengersRef.current[id] || null;
    },
    [passageiros],
  );

  const getPassengerOption = useCallback(
    (id: string): PassengerOption | null => {
      if (!id) return null;
      const full = getPassengerRecord(id);
      if (full) {
        return {
          id: full.id,
          nome: full.nomeCompleto,
          sublabel: full.celular || undefined,
        };
      }
      return lightPassengersRef.current[id] || null;
    },
    [getPassengerRecord],
  );

  const filteredCalendarOSList = useMemo(() => {
    if (docagemListFilter === "docagem" || docagemListFilter === "rascunho")
      return [];
    return calendarOSList.filter((item) => {
      const clienteNome =
        clientes.find((c) => c.id === item.clienteId)?.nome || "";
      const motoristaNomeAtual = item.driverId
        ? drivers.find((d) => d.id === item.driverId)?.name || item.motorista
        : item.motorista;
      const solicitanteNomeAtual = item.solicitanteId
        ? solicitantes.find((s) => s.id === item.solicitanteId)?.nome ||
          item.solicitante
        : item.solicitante;

      const searchValue = osTable.searchTerm.toLowerCase().trim();
      const matchSearch =
        searchValue === "" ||
        item.os.toLowerCase().includes(searchValue) ||
        item.protocolo.toLowerCase().includes(searchValue) ||
        clienteNome.toLowerCase().includes(searchValue) ||
        motoristaNomeAtual.toLowerCase().includes(searchValue) ||
        solicitanteNomeAtual.toLowerCase().includes(searchValue);
      if (!matchSearch) return false;

      if (showArchivedOnly && !item.arquivado) return false;
      if (!showArchivedOnly && item.arquivado) return false;

      if (
        advancedFilters.osNumber &&
        !item.os.toLowerCase().includes(advancedFilters.osNumber.toLowerCase())
      )
        return false;
      if (
        advancedFilters.clienteId &&
        item.clienteId !== advancedFilters.clienteId
      )
        return false;
      if (
        advancedFilters.centroCustoId &&
        item.centroCustoId !== advancedFilters.centroCustoId
      )
        return false;
      if (
        advancedFilters.solicitante &&
        !solicitanteNomeAtual
          .toLowerCase()
          .includes(advancedFilters.solicitante.toLowerCase())
      )
        return false;
      if (
        advancedFilters.driverId &&
        item.driverId !== advancedFilters.driverId
      )
        return false;
      if (
        advancedFilters.veiculoId &&
        item.veiculoId !== advancedFilters.veiculoId
      )
        return false;
      if (advancedFilters.passageiro) {
        const passageirosOS =
          item.rota?.waypoints?.flatMap((w) =>
            w.passengers.map((p) => {
              const rec = getPassengerRecord(p.solicitanteId || "");
              return (rec?.nomeCompleto || "").toLowerCase();
            }),
          ) || [];
        if (
          !passageirosOS.some((p) =>
            p.includes(advancedFilters.passageiro.toLowerCase()),
          )
        )
          return false;
      }
      if (advancedFilters.dataInicio && item.data < advancedFilters.dataInicio)
        return false;
      if (advancedFilters.dataFim && item.data > advancedFilters.dataFim)
        return false;
      if (
        advancedFilters.statusOperacional &&
        getOperationalStatusForOS(item) !== advancedFilters.statusOperacional
      )
        return false;
      if (
        advancedFilters.createdBy &&
        item.createdBy !== advancedFilters.createdBy
      )
        return false;

      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    calendarOSList,
    clientes,
    drivers,
    solicitantes,
    getPassengerRecord,
    // passengerOptionsVer sinaliza atualizações do cache assíncrono (ref mutável).
    passengerOptionsVer,
    osTable.searchTerm,
    advancedFilters,
    getOperationalStatusForOS,
    showArchivedOnly,
    docagemListFilter,
  ]);

  const filteredCalendarDocagemInstances = useMemo(() => {
    if (docagemListFilter === "os" || docagemListFilter === "rascunho")
      return [];
    const searchValue = osTable.searchTerm.toLowerCase().trim();
    return docagemInstances.filter((item) => {
      const clienteNome =
        clientes.find((c) => c.id === item.clienteId)?.nome || "";
      return (
        searchValue === "" ||
        clienteNome.toLowerCase().includes(searchValue) ||
        item.endereco.toLowerCase().includes(searchValue)
      );
    });
  }, [docagemInstances, clientes, osTable.searchTerm, docagemListFilter]);

  const syncViewingOS = useCallback(async () => {
    if (!viewingOSId) return;
    try {
      const latest = await fetchOSById(viewingOSId);
      setViewingOSLive(latest);
    } catch (error) {
      console.error("Erro ao sincronizar OS aberta:", error);
    }
  }, [viewingOSId]);

  const updateOSItems = osTable.updateItems;

  const syncOSSnapshot = useCallback(
    async (osId: string) => {
      const startedAt = performance.now();
      try {
        const latest = await fetchOSById(osId);
        if (!latest) return;

        updateOSItems((prev) =>
          prev.map((item) => (item.id === osId ? latest : item)),
        );
        setCalendarOSList((prev) =>
          prev.map((item) => (item.id === osId ? latest : item)),
        );

        if (viewingOSId === osId) {
          setViewingOSLive(latest);
        }

        console.log(
          `[Perf][OS] syncOSSnapshot(${osId}) ${(performance.now() - startedAt).toFixed(0)}ms`,
        );
      } catch (error) {
        console.error("Erro ao sincronizar snapshot da OS:", error);
      }
    },
    [updateOSItems, viewingOSId],
  );

  const syncOSLogs = useCallback(async () => {
    if (!viewingOSId) return;
    try {
      const logs = await fetchOSLogs(viewingOSId);
      setOsLogs(logs);
    } catch (error) {
      console.error("Erro ao buscar logs da OS:", error);
    }
  }, [viewingOSId]);

  useEffect(() => {
    if (!viewingOSId) {
      setViewingOSLive(null);
      setOsLogs([]);
      if (viewingOSPollRef.current) {
        clearInterval(viewingOSPollRef.current);
        viewingOSPollRef.current = null;
      }
      return;
    }

    void syncViewingOS();
    void syncOSLogs();

    if (viewingOSPollRef.current) {
      clearInterval(viewingOSPollRef.current);
    }

    viewingOSPollRef.current = setInterval(() => {
      void syncViewingOS();
    }, 30000);

    const channel = supabase
      .channel(`os-live-${viewingOSId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ordens_servico",
          filter: `id=eq.${viewingOSId}`,
        },
        () => {
          void syncViewingOS();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "os_waypoints",
          filter: `ordem_servico_id=eq.${viewingOSId}`,
        },
        () => {
          void syncViewingOS();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "os_waypoint_passengers" },
        () => {
          void syncViewingOS();
        },
      )
      .subscribe();

    const logsChannel = supabase
      .channel(`os-logs-${viewingOSId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "os_logs",
          filter: `os_id=eq.${viewingOSId}`,
        },
        () => {
          void syncOSLogs();
        },
      )
      .subscribe();

    return () => {
      if (viewingOSPollRef.current) {
        clearInterval(viewingOSPollRef.current);
        viewingOSPollRef.current = null;
      }
      void supabase.removeChannel(channel);
      void supabase.removeChannel(logsChannel);
    };
  }, [supabase, viewingOSId, syncViewingOS, syncOSLogs]);

  useEffect(() => {
    if (!viewingOSId) return;
    if (viewingOSLive) return;

    const latestFromList = osList.find((os) => os.id === viewingOSId);
    if (latestFromList) {
      setViewingOSLive(latestFromList);
    } else {
      // Se não encontrou na lista, buscar do banco
      setViewingOSLoading(true);
      fetchOSById(viewingOSId)
        .then((os) => {
          if (os) {
            setViewingOSLive(os);
          }
        })
        .catch((err) => {
          console.error("Erro ao buscar OS por ID:", err);
        })
        .finally(() => {
          setViewingOSLoading(false);
        });
    }
  }, [osList, viewingOSId, viewingOSLive]);

  // Sincronizar filtros avançados com tabela server-side
  useEffect(() => {
    const nextFilters: OSPageFilters = {};
    if (advancedFilters.osNumber)
      nextFilters.osNumber = advancedFilters.osNumber;
    if (advancedFilters.clienteId)
      nextFilters.clienteId = advancedFilters.clienteId;
    if (advancedFilters.centroCustoId)
      nextFilters.centroCustoId = advancedFilters.centroCustoId;
    if (advancedFilters.solicitante)
      nextFilters.solicitante = advancedFilters.solicitante;
    if (advancedFilters.driverId)
      nextFilters.driverId = advancedFilters.driverId;
    if (advancedFilters.veiculoId)
      nextFilters.veiculoId = advancedFilters.veiculoId;
    if (advancedFilters.dataInicio)
      nextFilters.dataInicio = advancedFilters.dataInicio;
    if (advancedFilters.dataFim) nextFilters.dataFim = advancedFilters.dataFim;
    if (advancedFilters.statusOperacional)
      nextFilters.statusOperacional = advancedFilters.statusOperacional;
    if (advancedFilters.createdBy)
      nextFilters.createdBy = advancedFilters.createdBy;

    setTableFilters(nextFilters);
    osTable.setPage(1);
    void osTable.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancedFilters]);

  useEffect(() => {
    logInfo("OSPage", "Página de Ordens de Serviço carregada", {
      viewMode,
      showArchivedOnly,
    });
  }, [viewMode, showArchivedOnly]);

  // Listener para abrir OS via notificações
  useEffect(() => {
    const handleOpenOSModal = async (event: Event) => {
      const customEvent = event as CustomEvent<{
        osId?: string;
        osProtocolo?: string;
      }>;
      if (customEvent.detail?.osId) {
        const found = osList.find((os) => os.id === customEvent.detail.osId);
        if (found) {
          logInfo(
            "OS/View",
            `Abriu visualização via notificação: protocolo ${found.protocolo}`,
            {
              protocolo: found.protocolo,
              osId: found.id,
              source: "notification",
            },
          );
          setViewingOSId(customEvent.detail.osId);
        } else {
          try {
            const os = await fetchOSById(customEvent.detail.osId);
            if (os) {
              logInfo(
                "OS/View",
                `Abriu visualização via notificação (fetch): protocolo ${os.protocolo}`,
                {
                  protocolo: os.protocolo,
                  osId: os.id,
                  source: "notification_fetch",
                },
              );
              setViewingOSId(os.id);
            }
          } catch (err) {
            console.error("Erro ao buscar OS por ID:", err);
          }
        }
      } else if (customEvent.detail?.osProtocolo) {
        const found = osList.find(
          (os) => os.protocolo === customEvent.detail.osProtocolo,
        );
        if (found) {
          logInfo(
            "OS/View",
            `Abriu visualização via notificação (protocolo): ${customEvent.detail.osProtocolo}`,
            {
              protocolo: found.protocolo,
              osId: found.id,
              source: "notification_protocolo",
            },
          );
          setViewingOSId(found.id);
        } else {
          try {
            const os = await fetchOSByProtocolo(customEvent.detail.osProtocolo);
            if (os) {
              logInfo(
                "OS/View",
                `Abriu visualização via notificação (fetch protocolo): ${os.protocolo}`,
                {
                  protocolo: os.protocolo,
                  osId: os.id,
                  source: "notification_fetch_protocolo",
                },
              );
              setViewingOSId(os.id);
            }
          } catch (err) {
            console.error("Erro ao buscar OS por protocolo:", err);
          }
        }
      }
    };

    window.addEventListener("open-os-modal", handleOpenOSModal);

    // Verificar parâmetros URL para abrir OS
    const urlParams = new URLSearchParams(window.location.search);
    const openOsParam = urlParams.get("open_os");
    const openOsProtocoloParam = urlParams.get("open_os_protocolo");
    if (openOsParam) {
      const found = osList.find((os) => os.id === openOsParam);
      if (found) {
        logInfo(
          "OS/View",
          `Abriu visualização via URL: protocolo ${found.protocolo}`,
          {
            protocolo: found.protocolo,
            osId: found.id,
            source: "url_param",
          },
        );
        setViewingOSId(openOsParam);
        window.history.replaceState({}, "", "/portal/os");
      } else {
        (async () => {
          try {
            const os = await fetchOSById(openOsParam);
            if (os) {
              logInfo(
                "OS/View",
                `Abriu visualização via URL (fetch): protocolo ${os.protocolo}`,
                {
                  protocolo: os.protocolo,
                  osId: os.id,
                  source: "url_param_fetch",
                },
              );
              setViewingOSId(os.id);
              window.history.replaceState({}, "", "/portal/os");
            }
          } catch (err) {
            console.error("Erro ao buscar OS por ID via URL:", err);
          }
        })();
      }
    } else if (openOsProtocoloParam) {
      const found = osList.find((os) => os.protocolo === openOsProtocoloParam);
      if (found) {
        logInfo(
          "OS/View",
          `Abriu visualização via URL (protocolo): ${openOsProtocoloParam}`,
          {
            protocolo: found.protocolo,
            osId: found.id,
            source: "url_param_protocolo",
          },
        );
        setViewingOSId(found.id);
        window.history.replaceState({}, "", "/portal/os");
      } else {
        (async () => {
          try {
            const os = await fetchOSByProtocolo(openOsProtocoloParam);
            if (os) {
              logInfo(
                "OS/View",
                `Abriu visualização via URL (fetch protocolo): ${os.protocolo}`,
                {
                  protocolo: os.protocolo,
                  osId: os.id,
                  source: "url_param_fetch_protocolo",
                },
              );
              setViewingOSId(os.id);
              window.history.replaceState({}, "", "/portal/os");
            }
          } catch (err) {
            console.error("Erro ao buscar OS por protocolo via URL:", err);
          }
        })();
      }
    }

    return () => {
      window.removeEventListener("open-os-modal", handleOpenOSModal);
    };
  }, [osList, osTable]);

  // Carregar calendário dinamicamente conforme range visível
  const calendarRangeRef = useRef<{ from: string; to: string } | null>(null);

  const handleCalendarRangeChange = useCallback(
    async (from: string, to: string, force = false) => {
      // Verificar se o range realmente mudou antes de recarregar (salvo se force=true)
      if (
        !force &&
        calendarRangeRef.current &&
        calendarRangeRef.current.from === from &&
        calendarRangeRef.current.to === to
      ) {
        return; // Range não mudou, não recarregar
      }

      calendarRangeRef.current = { from, to };
      setCalendarLoading(true);
      const loadingTimeout = setTimeout(() => {
        setCalendarLoading(false);
      }, 30000);

      try {
        const [osData, docagemData] = await Promise.all([
          fetchOSCalendarRange({
            from,
            to,
            arquivado: showArchivedOnly ? true : undefined,
          }),
          fetchDocagemInstancesByRange({ from, to }),
        ]);
        setCalendarOSList(osData);
        setDocagemInstances(docagemData);
        setCalendarHasLoaded(true);
        logInfo(
          "OS/Calendar",
          `Calendário carregado: ${osData.length} OS e ${docagemData.length} docagens no período ${from} a ${to}${showArchivedOnly ? " (arquivadas)" : ""}`,
          {
            from,
            to,
            arquivado: showArchivedOnly,
            totalOS: osData.length,
            totalDocagem: docagemData.length,
          },
        );
      } catch (err) {
        logErrorEntry(
          "OS/Calendar",
          "Erro ao carregar calendário",
          err as Error,
          {
            showArchivedOnly,
          },
        );
      } finally {
        clearTimeout(loadingTimeout);
        setCalendarLoading(false);
      }
    },
    [showArchivedOnly],
  );

  // Carregar range inicial quando mudar para modo calendário (apenas se não tiver range carregado)
  useEffect(() => {
    if (viewMode !== "calendar") return;
    if (calendarRangeRef.current) return; // Já tem range carregado, não sobrescrever
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];
    // NÃO setar calendarRangeRef aqui - deixar handleCalendarRangeChange fazer isso
    // para que a verificação de cache funcione corretamente
    void handleCalendarRangeChange(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const loadDocagemList = useCallback(async () => {
    setDocagemListLoading(true);
    try {
      const data = await fetchDocagens();
      setDocagemList(data);
    } catch (err) {
      console.error("Erro ao carregar docagens:", err);
      toast.error("Erro ao carregar docagens.");
    } finally {
      setDocagemListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocagemList();
  }, [loadDocagemList]);

  // Sincronizar calendarOSList com mudanças do osList via Realtime
  useEffect(() => {
    setCalendarOSList((prev) =>
      prev.map((item) => {
        const updated = osList.find((os) => os.id === item.id);
        return updated ? { ...item, ...updated } : item;
      }),
    );
  }, [osList]);

  // Listener Realtime global para refletir mudanças de status na tabela e
  // calendário sem precisar recarregar a página. Escuta mudanças em
  // ordens_servico (status_operacional) e os_operational_cycles (estados dos
  // ciclos) e atualiza os itens visíveis na tabela paginada e no calendário.
  useEffect(() => {
    const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const debouncedRefreshOS = (osId: string) => {
      const existing = debounceTimers.get(osId);
      if (existing) clearTimeout(existing);
      debounceTimers.set(
        osId,
        setTimeout(() => {
          debounceTimers.delete(osId);
          void fetchOSById(osId).then((latest) => {
            if (!latest) return;
            osTable.updateItems((prev) =>
              prev.map((item) => (item.id === osId ? latest : item)),
            );
            setCalendarOSList((prev) =>
              prev.map((item) => (item.id === osId ? latest : item)),
            );
          });
        }, 300),
      );
    };

    const channel = supabase
      .channel("os-global-status-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ordens_servico" },
        (payload) => {
          const change = payload as {
            eventType: string;
            new?: Record<string, unknown> | null;
            old?: Record<string, unknown> | null;
          };
          const osId = (change.new?.id as string) || (change.old?.id as string);
          if (!osId) return;
          debouncedRefreshOS(osId);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "os_operational_cycles" },
        (payload) => {
          const change = payload as {
            eventType: string;
            new?: Record<string, unknown> | null;
            old?: Record<string, unknown> | null;
          };
          const osId = change.new?.ordem_servico_id as string;
          if (!osId) return;
          debouncedRefreshOS(osId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      debounceTimers.forEach((timer) => clearTimeout(timer));
      debounceTimers.clear();
    };
  }, [supabase, osTable]);

  // Realtime: docagem_instancias e docagens
  // Quando outro usuário finalizar/resetar/excluir/criar uma docagem,
  // este canal recebe o evento via WebSocket e recarrega o range atual.
  useEffect(() => {
    if (viewMode !== "calendar") return;

    let docagemDebounce: ReturnType<typeof setTimeout> | null = null;

    const debouncedReloadDocagem = () => {
      if (docagemDebounce) clearTimeout(docagemDebounce);
      docagemDebounce = setTimeout(() => {
        const range = calendarRangeRef.current;
        if (!range) return;
        void handleCalendarRangeChange(range.from, range.to, true);
      }, 500);
    };

    const docagemChannel = supabase
      .channel("docagem-realtime-calendar")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "docagem_instancias" },
        () => {
          debouncedReloadDocagem();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "docagens" },
        () => {
          debouncedReloadDocagem();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(docagemChannel);
      if (docagemDebounce) clearTimeout(docagemDebounce);
    };
  }, [supabase, viewMode, handleCalendarRangeChange]);

  // Recarregar calendário quando filtro de arquivados mudar
  useEffect(() => {
    if (viewMode !== "calendar" || !calendarRangeRef.current) return;
    void handleCalendarRangeChange(
      calendarRangeRef.current.from,
      calendarRangeRef.current.to,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchivedOnly]);

  // Monitorar loading do filtro de arquivados
  useEffect(() => {
    if (!isArchivedFilterLoading) return;

    const tableLoading = dataLoading || heavyLoading;
    const calendarIsLoading = calendarLoading;

    if (!tableLoading && !calendarIsLoading) {
      const timer = setTimeout(() => {
        setIsArchivedFilterLoading(false);
      }, 3000);

      return () => clearTimeout(timer);
    }

    const safetyTimeout = setTimeout(() => {
      setIsArchivedFilterLoading(false);
    }, 15000);

    return () => clearTimeout(safetyTimeout);
  }, [dataLoading, heavyLoading, calendarLoading, isArchivedFilterLoading]);

  // Buscar lista de usuários para filtro "Cadastro feito por"
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch("/api/users");
        if (!res.ok) return;
        const data = await res.json();
        const mapped = (data || []).map((u: { id: string; nome?: string }) => ({
          id: u.id,
          nome: u.nome || "Desconhecido",
        }));
        setUsers(mapped);
      } catch {
        // silencioso
      }
    };
    void loadUsers();
  }, []);

  // Estados para cadastros rápidos
  const [quickAddModal, setQuickAddModal] = useState<
    "cliente" | "motorista" | "solicitante" | "centroCusto" | null
  >(null);
  const [quickAddForm, setQuickAddForm] = useState({ nome: "" });
  const [quickAddDriverForm, setQuickAddDriverForm] =
    useState<QuickAddDriverForm>(initialQuickAddDriverForm);

  // Estados para cadastro rápido de parceiro dentro do modal de motorista
  type QuickParceiroContato = {
    setor: string;
    celular: string;
    email: string;
    responsavel: string;
  };
  type QuickParceiroForm = {
    pessoaTipo: "fisica" | "juridica";
    documento: string;
    razaoSocialOuNomeCompleto: string;
    contatos: QuickParceiroContato[];
  };
  const [isQuickParceiroModalOpen, setIsQuickParceiroModalOpen] =
    useState(false);
  const [quickParceiroForm, setQuickParceiroForm] = useState<QuickParceiroForm>(
    {
      pessoaTipo: "juridica",
      documento: "",
      razaoSocialOuNomeCompleto: "",
      contatos: [{ setor: "", celular: "", email: "", responsavel: "" }],
    },
  );

  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [, setVehiclesUnavailable] = useState(false);
  const [quickAddedDriverOptions, setQuickAddedDriverOptions] = useState<
    { id: string; nome: string }[]
  >([]);
  const [driverVehiclesAssoc, setDriverVehiclesAssoc] = useState<
    { driver_id: string; vehicle_id: string }[]
  >([]);
  const [isOsVehicleQuickModalOpen, setIsOsVehicleQuickModalOpen] =
    useState(false);
  const [isSubmittingOsVehicle, setIsSubmittingOsVehicle] = useState(false);
  const [osVehicleManageIds, setOsVehicleManageIds] = useState<string[]>([]);

  // Modo Freelance: quando true o modal de criação usa tema verde e salva is_freelance=true
  const [isFreelanceMode, setIsFreelanceMode] = useState(false);

  // Novos estados para o modal de confirmação de notificações
  const [showNotificationConfirm, setShowNotificationConfirm] = useState(false);
  const [showCompletionConfirm, setShowCompletionConfirm] = useState(false);
  const [pendingOSData, setPendingOSData] = useState<PendingOSData | null>(
    null,
  );
  const [originalFormSnapshot, setOriginalFormSnapshot] =
    useState<PendingOSData | null>(null);
  const [notificationConfig, setNotificationConfig] = useState({
    auto: true,
    motorista: true,
    passageiros: false,
    solicitante: false,
  });
  const [isSubmittingOS, setIsSubmittingOS] = useState(false);
  const [osSubmissionMode, setOsSubmissionMode] = useState<
    "create" | "update" | null
  >(null);
  const [isOpeningEditModal, setIsOpeningEditModal] = useState(false);
  const [awaitingStatusOSId, setAwaitingStatusOSId] = useState<string | null>(
    null,
  );

  // Monitorar quando o status da OS em conclusão foi refletido na UI
  useEffect(() => {
    if (!awaitingStatusOSId) return;

    const isReflectedInTable = osTable.items.some(
      (item) =>
        item.id === awaitingStatusOSId &&
        item.status.operacional === "Finalizado",
    );
    const isReflectedInCalendar = calendarOSList.some(
      (item) =>
        item.id === awaitingStatusOSId &&
        item.status.operacional === "Finalizado",
    );

    if (isReflectedInTable || isReflectedInCalendar) {
      setAwaitingStatusOSId(null);
    }
  }, [osTable.items, calendarOSList, awaitingStatusOSId]);

  // Estados para modal de veículo dentro do cadastro rápido de motorista
  type QuickVehicleMode =
    | { mode: "create"; rowIndex: number }
    | { mode: "edit"; rowIndex: number; vehicleId: string };
  const [quickVehicleModal, setQuickVehicleModal] =
    useState<QuickVehicleMode | null>(null);
  const [isSubmittingQuickVehicle, setIsSubmittingQuickVehicle] =
    useState(false);
  const [vehicleQuickForm, setVehicleQuickForm] = useState({
    placa: "",
    modelo: "",
    marca: "",
    tipo: "carro" as "carro" | "van" | "onibus" | "moto" | "caminhao" | "outro",
  });

  const hasDuplicatePlateQuick = (
    placa: string,
    excludeId?: string,
  ): boolean => {
    const n = placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return vehicles.some(
      (v) =>
        v.id !== excludeId &&
        v.placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase() === n,
    );
  };

  const [quickAddedSolicitantes, setQuickAddedSolicitantes] = useState<
    Array<{ id: string; nome: string; clienteId: string }>
  >([]);
  const [quickAddedCentrosCusto, setQuickAddedCentrosCusto] = useState<
    Array<{ id: string; nome: string; clienteId: string }>
  >([]);

  // A API da Meta não requer polling de status - é stateless

  const parceiroOptions = useMemo(
    () =>
      parceiros.map((parceiro: ParceiroServico) => ({
        id: parceiro.id,
        nome: parceiro.razaoSocialOuNomeCompleto,
      })),
    [parceiros],
  );

  const formatParceiroDocument = (
    value: string,
    pessoaTipo: "fisica" | "juridica",
  ): string => {
    const digits = value
      .replace(/\D/g, "")
      .slice(0, pessoaTipo === "juridica" ? 14 : 11);
    if (pessoaTipo === "juridica") {
      return digits
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const formatParceiroPhone = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 10)
      return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
    return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
  };

  const validateParceiroCPF = (cpf: string): boolean => {
    const cpfClean = cpf.replace(/\D/g, "");
    if (cpfClean.length !== 11) return false;
    if (/(\d)\1{10}/.test(cpfClean)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpfClean.charAt(i)) * (10 - i);
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpfClean.charAt(9))) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpfClean.charAt(i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    return remainder === parseInt(cpfClean.charAt(10));
  };

  const validateParceiroCNPJ = (cnpj: string): boolean => {
    const cnpjClean = cnpj.replace(/\D/g, "");
    if (cnpjClean.length !== 14) return false;
    if (/(\d)\1{13}/.test(cnpjClean)) return false;
    const weightsFirst = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weightsSecond = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 12; i++)
      sum += parseInt(cnpjClean.charAt(i)) * weightsFirst[i];
    let remainder = sum % 11;
    const firstDigit = remainder < 2 ? 0 : 11 - remainder;
    if (firstDigit !== parseInt(cnpjClean.charAt(12))) return false;
    sum = 0;
    for (let i = 0; i < 13; i++)
      sum += parseInt(cnpjClean.charAt(i)) * weightsSecond[i];
    remainder = sum % 11;
    const secondDigit = remainder < 2 ? 0 : 11 - remainder;
    return secondDigit === parseInt(cnpjClean.charAt(13));
  };

  const validateParceiroCelular = (celular: string): boolean => {
    const celularClean = stripBrazilCountryCode(celular);
    if (celularClean.length !== 11) return false;
    if (/(\d)\1{10}/.test(celularClean)) return false;
    const ddd = celularClean.substring(0, 2);
    if (ddd < "11" || ddd > "99") return false;
    return true;
  };

  const validateQuickParceiro = (): string | null => {
    if (!quickParceiroForm.razaoSocialOuNomeCompleto.trim())
      return "Razão Social/Nome completo é obrigatório";
    if (!quickParceiroForm.documento.trim()) return "CNPJ/CPF é obrigatório";
    const documentoLimpo = normalizeDigitsValue(quickParceiroForm.documento);
    if (quickParceiroForm.pessoaTipo === "juridica") {
      if (documentoLimpo.length !== 14)
        return "CNPJ deve ter 14 dígitos completos";
      if (!validateParceiroCNPJ(quickParceiroForm.documento))
        return "CNPJ inválido";
    } else {
      if (documentoLimpo.length !== 11)
        return "CPF deve ter 11 dígitos completos";
      if (!validateParceiroCPF(quickParceiroForm.documento))
        return "CPF inválido";
    }
    const existingDoc = parceiros.find(
      (p) => normalizeDigitsValue(p.documento) === documentoLimpo,
    );
    if (existingDoc)
      return `CNPJ/CPF já está sendo usado pelo parceiro "${existingDoc.razaoSocialOuNomeCompleto}".`;

    const primeiroContato = quickParceiroForm.contatos[0];
    if (!primeiroContato.setor.trim())
      return "Setor do primeiro contato é obrigatório";
    if (!primeiroContato.celular.trim())
      return "Celular do primeiro contato é obrigatório";
    if (!primeiroContato.responsavel.trim())
      return "Responsável do primeiro contato é obrigatório";
    const celularLimpo = stripBrazilCountryCode(primeiroContato.celular);
    if (celularLimpo.length !== 11)
      return "Celular deve ter 11 dígitos completos: (00) 00000-0000";
    if (!validateParceiroCelular(primeiroContato.celular))
      return "Celular inválido";
    if (primeiroContato.email && primeiroContato.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(primeiroContato.email.trim()))
        return "E-mail inválido";
    }

    const formCelulares = new Map<string, number>();
    const formEmails = new Map<string, number>();
    for (let i = 0; i < quickParceiroForm.contatos.length; i++) {
      const c = quickParceiroForm.contatos[i];
      const cell = normalizeBrazilPhone(c.celular);
      if (cell && formCelulares.has(cell))
        return `Celular ${c.celular} está duplicado entre os contatos deste parceiro.`;
      formCelulares.set(cell, i);
      const email = normalizeTextValue(c.email || "");
      if (email && formEmails.has(email))
        return `E-mail ${c.email} está duplicado entre os contatos deste parceiro.`;
      formEmails.set(email, i);
    }

    for (const contato of quickParceiroForm.contatos) {
      const cell = normalizeBrazilPhone(contato.celular);
      if (cell) {
        for (const parceiro of parceiros) {
          const found = parceiro.contatos.find(
            (c) => normalizeBrazilPhone(c.celular) === cell,
          );
          if (found)
            return `Celular ${contato.celular} já está sendo usado no contato "${found.setor}" do parceiro "${parceiro.razaoSocialOuNomeCompleto}".`;
        }
      }
      const email = normalizeTextValue(contato.email || "");
      if (email) {
        for (const parceiro of parceiros) {
          const found = parceiro.contatos.find(
            (c) => normalizeTextValue(c.email || "") === email,
          );
          if (found)
            return `E-mail ${contato.email} já está sendo usado no contato "${found.setor}" do parceiro "${parceiro.razaoSocialOuNomeCompleto}".`;
        }
      }
    }

    return null;
  };

  const handleQuickParceiroSubmit = async () => {
    const validationError = validateQuickParceiro();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const cleanForm = {
      pessoaTipo: quickParceiroForm.pessoaTipo,
      documento: quickParceiroForm.documento.trim(),
      razaoSocialOuNomeCompleto:
        quickParceiroForm.razaoSocialOuNomeCompleto.trim(),
      contatos: quickParceiroForm.contatos.map((contato) => ({
        setor: contato.setor.trim(),
        celular: normalizeBrazilPhone(contato.celular),
        email: contato.email?.trim() || "",
        responsavel: contato.responsavel.trim(),
      })),
      filiais: [],
    };

    try {
      const newParceiro = await addParceiro(cleanForm);
      toast.success("Parceiro cadastrado com sucesso!");
      setQuickAddDriverForm((prev) => ({
        ...prev,
        parceiro_id: newParceiro.id,
      }));
      setQuickParceiroForm({
        pessoaTipo: "juridica",
        documento: "",
        razaoSocialOuNomeCompleto: "",
        contatos: [{ setor: "", celular: "", email: "", responsavel: "" }],
      });
      setIsQuickParceiroModalOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o parceiro.",
      );
    }
  };

  const isAnyModalOpen =
    isModalOpen ||
    isQuickPassengerModalOpen ||
    Boolean(viewingOSId) ||
    Boolean(cancelTargetId) ||
    Boolean(quickAddModal) ||
    isOsVehicleQuickModalOpen ||
    Boolean(quickVehicleModal) ||
    isQuickParceiroModalOpen;

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isAnyModalOpen]);

  useEffect(() => {
    const fetchVehicles = async () => {
      const { data, error } = await supabase
        .from("veiculos")
        .select("id, placa, modelo, marca, tipo")
        .eq("status", "ativo")
        .order("marca", { ascending: true })
        .order("modelo", { ascending: true });

      if (error) {
        const isMissingTable =
          error.code === "42P01" ||
          error.message?.toLowerCase().includes("veiculos") ||
          error.message?.toLowerCase().includes("does not exist");

        if (isMissingTable) {
          setVehiclesUnavailable(true);
          setVehicles([]);
          return;
        }

        console.error("Erro ao buscar veículos:", error);
        toast.error("Erro ao buscar veículos.");
        return;
      }

      setVehiclesUnavailable(false);
      setVehicles((data || []) as VehicleOption[]);
    };

    const fetchDriverVehicles = async () => {
      const { data } = await supabase
        .from("driver_vehicles")
        .select("driver_id, vehicle_id");
      if (data)
        setDriverVehiclesAssoc(
          data as { driver_id: string; vehicle_id: string }[],
        );
    };

    fetchVehicles();
    fetchDriverVehicles();

    const vehiclesChannel = supabase
      .channel("os-quick-add-vehicles-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "veiculos" },
        () => {
          fetchVehicles();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_vehicles" },
        () => {
          fetchDriverVehicles();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(vehiclesChannel);
    };
  }, [supabase]);

  // Form State
  const initialForm: OSFormData = {
    data: new Date().toISOString().split("T")[0],
    hora: "",
    horaExtra: "",
    noShow: false,
    noShowPercentual: null,
    os: "",
    clienteId: "",
    solicitante: "",
    solicitanteId: "",
    motorista: "",
    driverId: "",
    veiculoId: "",
    centroCusto: "",
    valorBruto: null,
    custo: null,
    obsFinanceiras: "",
    waypoints: [
      {
        label: "",
        lat: null,
        lng: null,
        comment: "",
        passengers: [],
        itineraryIndex: 0,
      },
      {
        label: "",
        lat: null,
        lng: null,
        comment: "",
        passengers: [],
        itineraryIndex: 0,
      },
    ],
  };

  const resetMainModalState = () => {
    setIsModalOpen(false);
    setEditingOSId(null);
    setFormData(initialForm);
    setOpenWaypointComments({});
    setOriginalFormSnapshot(null);
    setIsFreelanceMode(false);
  };

  const handleOpenCreateOSModal = () => {
    logInfo("OS/Create", "Abriu modal para criar nova OS");
    setEditingOSId(null);
    setFormData(initialForm);
    setOpenWaypointComments({});
    setIsModalOpen(true);
  };

  const hydrateFormFromOS = (osItem: OrderService) => {
    const hydratedWaypoints = osItem.rota?.waypoints?.length
      ? osItem.rota.waypoints.map((waypoint, index) => ({
          label: waypoint.label,
          lat: waypoint.lat ?? null,
          lng: waypoint.lng ?? null,
          comment: waypoint.comment || "",
          itineraryIndex: waypoint.itineraryIndex ?? 0,
          hora: waypoint.hora || "",
          data: waypoint.data || "",
          passengers: (waypoint.passengers || []).map(
            (passenger, passengerIndex) => {
              const opt = getPassengerOption(passenger.solicitanteId || "");
              return {
                id: passenger.id || `${osItem.id}-${index}-${passengerIndex}`,
                solicitanteId: passenger.solicitanteId || "",
                nome: opt?.nome || passenger.nome || "",
              };
            },
          ),
        }))
      : initialForm.waypoints;

    const nextFormData: OSFormData = {
      data: osItem.data,
      hora: osItem.hora || "",
      horaExtra: normalizeHoraExtraForInput(osItem.horaExtra),
      noShow: Boolean(osItem.noShow),
      noShowPercentual: osItem.noShow ? (osItem.noShowPercentual ?? 100) : null,
      os: osItem.os,
      clienteId: osItem.clienteId,
      solicitante: osItem.solicitante,
      solicitanteId: osItem.solicitanteId || "",
      motorista: osItem.motorista,
      driverId: osItem.driverId || "",
      veiculoId: osItem.veiculoId || "",
      centroCusto: osItem.centroCustoId || "",
      valorBruto: osItem.valorBruto,
      custo: osItem.custo,
      obsFinanceiras: osItem.obsFinanceiras || "",
      waypoints: hydratedWaypoints,
    };

    setFormData(nextFormData);

    // Snapshot dos dados originais para detectar mudancas reais no submit
    const snapshot: PendingOSData = {
      ...nextFormData,
      hora: null,
      rota: { waypoints: hydratedWaypoints },
    };
    setOriginalFormSnapshot(snapshot);

    setOpenWaypointComments(
      hydratedWaypoints.reduce<Record<number, boolean>>(
        (acc, waypoint, index) => {
          acc[index] = Boolean(waypoint.comment.trim());
          return acc;
        },
        {},
      ),
    );
  };

  const handleViewOS = (osId: string) => {
    const os = osList.find((o) => o.id === osId);
    if (os) {
      logInfo("OS/View", `Abriu visualização da OS protocolo ${os.protocolo}`, {
        protocolo: os.protocolo,
        osId: os.id,
      });
    }
    setViewingOSId(osId);
    setOpenActionMenuId(null);
  };

  const handleEditOS = async (osId: string) => {
    setIsOpeningEditModal(true);
    try {
      const targetOS = await fetchOSById(osId);
      if (!targetOS) {
        toast.error("OS não encontrada.");
        setIsOpeningEditModal(false);
        return;
      }

      logInfo("OS/Edit", `Abriu edição da OS protocolo ${targetOS.protocolo}`, {
        protocolo: targetOS.protocolo,
        osId: targetOS.id,
      });

      hydrateFormFromOS(targetOS);
      setOpenWaypointComments({});
      setEditingOSId(osId);
      setIsModalOpen(true);
      setOpenActionMenuId(null);
      requestAnimationFrame(() => setIsOpeningEditModal(false));
    } catch {
      toast.error("Não foi possível carregar a OS para edição.");
      setIsOpeningEditModal(false);
    }
  };

  const handleReopenOS = async (osId: string) => {
    let targetOS: OrderService | null = null;
    try {
      targetOS = await fetchOSById(osId);
    } catch {
      targetOS = osList.find((os) => os.id === osId) || null;
    }
    if (!targetOS) {
      toast.error("OS não encontrada.");
      setOpenActionMenuId(null);
      return;
    }

    const confirmed = await confirm({
      title: "Reabrir OS",
      message: `Tem certeza que deseja reabrir a OS "${targetOS.protocolo || targetOS.os || "sem protocolo"}"?`,
      confirmText: "Sim, reabrir",
      cancelText: "Cancelar",
      type: "success",
    });

    if (!confirmed) {
      setOpenActionMenuId(null);
      return;
    }

    try {
      logInfo(
        "OS/Unarchive",
        `Desarquivou OS protocolo ${targetOS.protocolo || targetOS.os}`,
        {
          protocolo: targetOS.protocolo,
          osId: targetOS.id,
        },
      );
      await unarchiveOS(osId);
      await osTable.refresh();
      toast.success("OS reaberta com sucesso!");
    } catch (error) {
      console.error("Error reopening OS:", error);
      toast.error("Não foi possível reabrir a OS.");
    }
    setOpenActionMenuId(null);
  };

  const handleDeleteOS = async (osId: string) => {
    let targetOS: OrderService | null = null;
    try {
      targetOS = await fetchOSById(osId);
    } catch {
      /* fallback: tentar encontrar em osList */
      targetOS = osList.find((os) => os.id === osId) || null;
    }
    if (!targetOS) {
      toast.error("OS não encontrada.");
      return;
    }

    const confirmed = await confirm({
      title: "Arquivar OS",
      message: `Tem certeza que deseja arquivar a OS "${targetOS.protocolo || targetOS.os || "sem protocolo"}"? Ela não aparecerá mais na lista, mas poderá ser recuperada posteriormente.`,
      confirmText: "Sim, arquivar",
      cancelText: "Cancelar",
      type: "danger",
    });

    if (!confirmed) return;

    try {
      logInfo(
        "OS/Archive",
        `Arquivou OS protocolo ${targetOS.protocolo || targetOS.os}`,
        {
          protocolo: targetOS.protocolo,
          osId: targetOS.id,
        },
      );
      await deleteOS(osId);
      await osTable.refresh();
      setOpenActionMenuId(null);
      toast.success("OS arquivada com sucesso!");
    } catch (error) {
      console.error("Erro ao arquivar OS:", error);
      toast.error("Erro ao arquivar OS.");
    }
  };

  const handleFinishOS = async (osId: string) => {
    const confirmed = await confirm({
      title: "Finalizar Atendimento",
      message:
        "Tem certeza que deseja finalizar este atendimento? Todos os ciclos serão concluídos e a OS será marcada como finalizada.",
      confirmText: "Sim, finalizar",
      cancelText: "Cancelar",
      type: "success",
    });
    if (!confirmed) return;

    const startedAt = performance.now();
    setAwaitingStatusOSId(osId);
    try {
      const response = await fetch("/api/os-manual-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          os_id: osId,
          action: "finish_all",
        }),
      });
      console.log(
        `[Perf][OS] handleFinishOS request ${(performance.now() - startedAt).toFixed(0)}ms`,
      );
      const result = await response.json();
      if (!result.success) {
        toast.error(result.error || "Erro ao concluir todos os ciclos.");
        setAwaitingStatusOSId(null);
        return;
      }
      toast.success("Atendimento concluído com sucesso!");

      await syncOSSnapshot(osId);
      setAwaitingStatusOSId(null);
      setOpenActionMenuId(null);
      setCalendarMenuPosition(null);
      console.log(
        `[Perf][OS] handleFinishOS total ${(performance.now() - startedAt).toFixed(0)}ms`,
      );
    } catch (error) {
      console.error("Erro ao finalizar atendimento:", error);
      toast.error("Erro ao concluir o atendimento. Tente novamente.");
      setAwaitingStatusOSId(null);
      console.log(
        `[Perf][OS] handleFinishOS failed ${(performance.now() - startedAt).toFixed(0)}ms`,
      );
    }
  };

  const confirmCancelOS = async () => {
    if (!cancelTargetId) return;
    try {
      await updateOSStatus(cancelTargetId, { operacional: "Cancelado" });
      await osTable.refresh();
    } catch (error) {
      console.error("Error canceling OS:", error);
      toast.error("Não foi possível cancelar a OS.");
    }
    setCancelTargetId(null);
  };

  // Função auxiliar para notificar passageiro sem depender de viewingOS (usada em notificações automáticas)
  const handleNotifyPassengerDirect = async (
    osData: OrderService,
    passenger: {
      nome: string;
      email: string;
      celular: string;
      hasEmail: boolean;
      hasPhone: boolean;
      solicitanteId: string;
    },
    type: "email" | "whatsapp" | "both",
  ) => {
    try {
      const acceptUrl = `${BASE_URL}/a/p`;
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error("[handleNotifyPassengerDirect] Sessão expirada");
        return;
      }

      console.log("[handleNotifyPassengerDirect] sending", {
        type,
        osId: osData.id,
        passageiroId: passenger.solicitanteId,
        hasPhone: passenger.hasPhone,
        celular: passenger.celular,
      });
      const res = await fetch("/api/notify-passenger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          passengerEmail: passenger.hasEmail ? passenger.email : undefined,
          passengerPhone: passenger.hasPhone ? passenger.celular : undefined,
          passengerName: passenger.nome,
          osProtocol: osData.protocolo,
          osId: osData.id,
          passageiroId: passenger.solicitanteId || undefined,
          acceptUrl,
        }),
      });
      const data = await res.json();
      console.log("[handleNotifyPassengerDirect] response", data);
      if (data.success) {
        console.log(
          `[handleNotifyPassengerDirect] Notificação enviada com sucesso para ${passenger.nome}`,
        );
      } else {
        console.error(
          `[handleNotifyPassengerDirect] Erro ao enviar: ${data.error || res.status}`,
        );
      }
    } catch (err) {
      console.error("[handleNotifyPassengerDirect] catch error:", err);
    }
  };

  const handleNotifyPassenger = async (
    passengerKey: string,
    type: "email" | "whatsapp" | "both",
    passenger: {
      nome: string;
      email: string;
      celular: string;
      hasEmail: boolean;
      hasPhone: boolean;
      solicitanteId: string;
      waypointIndex: number;
    },
  ) => {
    if (!viewingOS) return;
    setNotifyLoadingKey(passengerKey);
    try {
      const acceptUrl = `${BASE_URL}/a/p`;
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.error("Sessão expirada. Por favor, faça login novamente.");
        return;
      }

      console.log("[handleNotifyPassenger] sending", {
        type,
        osId: viewingOS.id,
        passageiroId: passenger.solicitanteId,
        hasPhone: passenger.hasPhone,
        celular: passenger.celular,
      });
      const res = await fetch("/api/notify-passenger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          passengerEmail: passenger.hasEmail ? passenger.email : undefined,
          passengerPhone: passenger.hasPhone ? passenger.celular : undefined,
          passengerName: passenger.nome,
          osProtocol: viewingOS.protocolo,
          osId: viewingOS.id,
          passageiroId: passenger.solicitanteId || undefined,
          acceptUrl,
        }),
      });
      const data = await res.json();
      console.log("[handleNotifyPassenger] response", data);
      if (data.success) {
        toast.success("Notificação enviada com sucesso!");
      } else {
        toast.error(
          data.error || `Erro ao enviar notificação. Status: ${res.status}`,
        );
      }
    } catch (err) {
      console.error("[handleNotifyPassenger] catch error:", err);
      toast.error("Erro ao enviar notificação. Verifique o console.");
    } finally {
      setNotifyLoadingKey(null);
      setOpenNotifyMenuKey(null);
    }
  };

  const sendWhatsAppNotification = async (
    osData: OrderService,
    itineraryIndex: number,
  ) => {
    const startedAt = performance.now();

    // Validar estado do ciclo antes de enviar mensagem inicial
    const cycles = osData.operationalCycles || [];
    const targetCycle = cycles.find((c) => c.itineraryIndex === itineraryIndex);
    if (
      targetCycle &&
      (targetCycle.state === "awaiting_finish" ||
        targetCycle.state === "completed" ||
        targetCycle.startedAt)
    ) {
      toast.info(
        "Este ciclo já está em andamento ou finalizado. Mensagem inicial não pode ser enviada.",
      );
      return;
    }

    if (!osData.motorista) {
      toast.error("Motorista não atribuído a esta OS.");
      return;
    }

    const driverObj = osData.driverId
      ? drivers.find((d) => d.id === osData.driverId)
      : drivers.find(
          (d) =>
            d.name.trim().toLowerCase() ===
            osData.motorista.trim().toLowerCase(),
        );

    let phone = driverObj?.phone || "5522997259180";

    if (!driverObj?.phone) {
      console.warn(
        `[WhatsApp] Motorista "${osData.motorista}" não encontrado ou sem telefone. Usando fallback.`,
      );
    }

    phone = normalizeBrazilPhone(phone);

    if (phone.length < 10) {
      toast.error("Telefone do motorista é inválido ou não cadastrado.");
      return;
    }

    setNotifyLoadingKey("driver-whatsapp");
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error("Sessão expirada. Por favor, faça login novamente.");
        return;
      }

      console.log(
        `[WhatsApp] Enviando notificação para ${osData.motorista} (${phone}) - Ciclo ${itineraryIndex}`,
      );
      console.log(
        `[Perf][WhatsApp] start os=${osData.id} itinerary=${itineraryIndex}`,
      );

      let msgResponse: Response;
      let msgData: { success?: boolean; error?: string; messageId?: string };

      // Primeiro ciclo (itineraryIndex: 0) usa template obrigatório
      if (itineraryIndex === 0) {
        msgResponse = await fetch("/api/whatsapp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone,
            useTemplate: true,
            templateName: "appointment_scheduling",
            templateVariables: [osData.motorista],
            language: "pt_BR",
            os_id: osData.id,
            cycle_index: itineraryIndex,
          }),
        });
        msgData = await msgResponse.json();
      } else {
        // Demais ciclos usam template flow "inicio_viagem_motorista"
        const cycles = osData.operationalCycles || [];
        const targetCycle = cycles.find(
          (c) => c.itineraryIndex === itineraryIndex,
        );

        if (targetCycle) {
          const cycleTitle = getOperationalCycleTitle(targetCycle);
          const motoristaName = osData.motorista || "Motorista";

          // Construir componentes do template flow
          const templateComponents = [
            {
              type: "header",
              parameters: [
                {
                  type: "text",
                  text: cycleTitle,
                },
              ],
            },
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: motoristaName,
                },
              ],
            },
            {
              type: "button",
              sub_type: "flow",
              index: 0,
              parameters: [],
            },
          ];

          // Enviar template flow via API route
          msgResponse = await fetch("/api/whatsapp", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              phone,
              useTemplate: true,
              templateName: "inicio_viagem_motorista",
              templateVariables: [], // Flow não usa variáveis no body
              language: "pt_BR",
              components: templateComponents,
              os_id: osData.id,
              cycle_index: itineraryIndex,
            }),
          });
          msgData = await msgResponse.json();
        } else {
          // Fallback se não encontrar o ciclo
          msgData = {
            success: false,
            error: "Ciclo não encontrado",
          };
          msgResponse = new Response(JSON.stringify(msgData), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      if (!msgResponse.ok || !msgData.success) {
        console.error("[WhatsApp] Erro na API de mensagem:", msgData);
        toast.error(
          `Falha ao enviar mensagem: ${msgData.error || "Erro na API"}`,
        );
        console.log(
          `[Perf][WhatsApp] failed os=${osData.id} ${(performance.now() - startedAt).toFixed(0)}ms`,
        );
        setNotifyLoadingKey(null);
        return;
      }

      setDriverNotificationSentByOS((prev) => ({
        ...prev,
        [osData.id]: true,
      }));

      // Buscar nome do operador para notificação
      let operatorName = user.email?.split("@")[0] || "Operador";
      try {
        const { data: profile } = await supabase
          .from("user_roles")
          .select("nome")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.nome) operatorName = profile.nome;
      } catch {
        // fallback já definido
      }

      const motoristaParts = (osData.motorista || "Motorista")
        .split(" ")
        .filter(Boolean);
      const motoristaShort =
        motoristaParts.length <= 2
          ? osData.motorista || "Motorista"
          : `${motoristaParts[0]} ${motoristaParts[motoristaParts.length - 1]}`;

      // 1. Rastrear message_id para correlação com status updates da Meta
      if (msgData.messageId) {
        try {
          await supabase.from("whatsapp_message_tracking").insert({
            os_id: osData.id,
            message_id: msgData.messageId,
            phone: phone,
            motorista: osData.motorista || "Motorista",
            cycle_index: itineraryIndex,
            status: "sent",
          });
        } catch (trackErr) {
          console.error("[WhatsApp] Erro ao rastrear message_id:", trackErr);
        }
      }

      // 2. Registrar log driver_notify → gera notificação no sino:
      //    "{Operador} enviou uma mensagem de serviço para o motorista {Motorista}."
      try {
        await supabase.from("os_logs").insert({
          os_id: osData.id,
          type: "driver_notify",
          actor_name: operatorName,
          actor_id: user.id,
          description: `Mensagem WhatsApp enviada ao motorista ${motoristaShort}${itineraryIndex > 0 ? ` — Ciclo ${itineraryIndex + 1}` : ""}`,
          metadata: {
            cycle_index: itineraryIndex,
            message_id: msgData.messageId ?? null,
            motorista: osData.motorista || "Motorista",
          },
        });
      } catch (logErr) {
        console.error(
          "[WhatsApp] Erro ao registrar log driver_notify:",
          logErr,
        );
      }

      // Atualizar apenas o ciclo específico na tabela de ciclos operacionais
      try {
        const currentCycles = osData.operationalCycles || [];
        const updatedCycles = currentCycles.map((cycle) => {
          if (cycle.itineraryIndex === itineraryIndex) {
            const shouldAdvanceToAwaitingAccept =
              cycle.state === "pending" || cycle.state === "awaiting_accept";

            return {
              ...cycle,
              messageSentAt: new Date().toISOString(),
              messageSentById: user.id,
              ...(shouldAdvanceToAwaitingAccept
                ? { state: "awaiting_accept" as const }
                : {}),
            };
          }
          return cycle;
        });

        // Para o primeiro ciclo, também atualiza driver_template_message_id para compatibilidade com webhook
        const updateData: Record<string, unknown> = {};

        if (itineraryIndex === 0 && msgData.messageId) {
          updateData.driver_template_message_id = msgData.messageId;
        }

        await supabase
          .from("ordens_servico")
          .update(updateData)
          .eq("id", osData.id);

        await replaceOperationalCyclesForOS(supabase, osData.id, updatedCycles);
      } catch (dbErr) {
        console.error(
          "[WhatsApp] Erro ao registrar timestamp de envio no ciclo:",
          dbErr,
        );
      }
      void syncOSSnapshot(osData.id);
      console.log(
        `[Perf][WhatsApp] total os=${osData.id} itinerary=${itineraryIndex} ${(performance.now() - startedAt).toFixed(0)}ms`,
      );
    } catch (err) {
      console.error("[WhatsApp] Erro crítico:", err);
      toast.error("Erro ao conectar com a API de WhatsApp.");
      console.log(
        `[Perf][WhatsApp] error os=${osData.id} ${(performance.now() - startedAt).toFixed(0)}ms`,
      );
    } finally {
      setNotifyLoadingKey(null);
    }
  };

  const sendAdminGroupMessage = async (osData: OrderService) => {
    const clienteRecord = clientes.find((c) => c.id === osData.clienteId);
    const cliente = clienteRecord?.nome || "Empresa não informada";
    const centroCusto =
      clienteRecord?.centrosCusto?.find((cc) => cc.id === osData.centroCustoId)
        ?.nome || "Não informado";

    // Motorista e contato
    const driverObj = drivers.find(
      (d) =>
        d.name.trim().toLowerCase() === osData.motorista.trim().toLowerCase(),
    );
    const driverPhone = driverObj?.phone || "Não informado";

    // Veículo
    let vehicleInfo = { tipo: "", placa: "", marca: "", modelo: "" };
    if (osData.veiculoId) {
      const v = vehicles.find((v) => v.id === osData.veiculoId);
      if (v)
        vehicleInfo = {
          tipo: v.tipo || "",
          placa: v.placa || "",
          marca: v.marca || "",
          modelo: v.modelo || "",
        };
    } else if (driverObj?.id) {
      const assoc = driverVehiclesAssoc.find(
        (a) => a.driver_id === driverObj.id,
      );
      if (assoc) {
        const v = vehicles.find((v) => v.id === assoc.vehicle_id);
        if (v)
          vehicleInfo = {
            tipo: v.tipo || "",
            placa: v.placa || "",
            marca: v.marca || "",
            modelo: v.modelo || "",
          };
      }
    }
    const tipoCapitalizado = vehicleInfo.tipo
      ? vehicleInfo.tipo.charAt(0).toUpperCase() + vehicleInfo.tipo.slice(1)
      : "Não informado";

    // Passageiros (resolve via cache/banco, sem limite de 1000)
    const passengerRecords = await resolvePassengerRecordsForOS(osData);
    const allPassengers: { nome: string; celular: string }[] = [];
    const waypoints = osData.rota?.waypoints || [];
    waypoints.forEach((wp) => {
      (wp.passengers || []).forEach((p) => {
        const passRecord = passengerRecords.find(
          (x) => x.id === p.solicitanteId,
        );
        const cel = passRecord?.celular || "";
        const nomeAtual = passRecord?.nomeCompleto || "Não identificado";
        if (!allPassengers.some((x) => x.nome === nomeAtual)) {
          allPassengers.push({
            nome: nomeAtual,
            celular: cel
              ? cel.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
              : "Não informado",
          });
        }
      });
    });
    const paxText =
      allPassengers.length > 0
        ? allPassengers
            .map(
              (p) =>
                `• ${p.nome}${p.celular !== "Não informado" ? ` – ${p.celular}` : ""}`,
            )
            .join("\n")
        : "Não informado";

    // Itinerário com observações (separa ida/retorno)
    let itineraryText = "";
    const itineraries = getItineraries(waypoints as FormWaypoint[]);
    if (itineraries.length > 0) {
      itineraryText = itineraries
        .map((it) => {
          const firstWp = it.waypoints[0];
          const itData = firstWp?.data || osData.data;
          const itHora = firstWp?.hora || osData.hora;
          const dateTimeLine = itData
            ? ` — ${itData.split("-").reverse().join("/")}${itHora ? ` - ${itHora.slice(0, 5)}` : ""}`
            : itHora
              ? ` — ${itHora.slice(0, 5)}`
              : "";
          const itTitle =
            it.index < 0
              ? `${numeroParaOrdinal(Math.abs(it.index))} Retorno${dateTimeLine}`
              : `${numeroParaOrdinal(it.index + 1)} Itinerário${dateTimeLine}`;
          const stops = it.waypoints
            .map((w, relIdx) => {
              const label = w.label.trim();
              const comment = w.comment?.trim();
              let line = "";
              if (relIdx === 0) line = `❇️ *Origem:* ${label}`;
              else if (relIdx === it.waypoints.length - 1)
                line = `🛄*Destino:* ${label}`;
              else line = `▫️ *Parada ${relIdx}:* ${label}`;
              if (comment) line += `\n   _Obs: ${comment}_`;
              return line;
            })
            .join("\n\n");
          return `📍 *${itTitle}*\n\n${stops}`;
        })
        .join("\n\n");
    }

    const firstItWp = itineraries[0]?.waypoints[0];
    const firstItData = firstItWp?.data || osData.data;
    const firstItHora = firstItWp?.hora || osData.hora;
    const dataHoraHeaderParts: string[] = [];
    if (firstItData)
      dataHoraHeaderParts.push(
        `*Data: ${firstItData.split("-").reverse().join("/")}*`,
      );
    if (firstItHora)
      dataHoraHeaderParts.push(`*Horário: ${firstItHora.slice(0, 5)}*`);
    const dataHoraHeader =
      dataHoraHeaderParts.length > 0
        ? `\n${dataHoraHeaderParts.join("\n")}\n\n`
        : "";

    // Financeiro
    const formatCurrency = (value: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);

    const marcaModeloLine =
      vehicleInfo.marca || vehicleInfo.modelo
        ? `*Marca/Modelo:* ${[vehicleInfo.marca, vehicleInfo.modelo].filter(Boolean).join(" ")}\n`
        : "";

    const message =
      `📋 *NOVO ATENDIMENTO*\n` +
      `*Protocolo:* ${osData.protocolo ?? "N/A"}\n` +
      `${dataHoraHeader}` +
      `*Fornecedor:* Geolog Transporte Executivo\n` +
      `*Empresa:* ${cliente}\n` +
      `*Solicitante:* ${osData.solicitante || "Não informado"}\n` +
      `*C. Custo:* ${centroCusto}\n\n` +
      `────────────────\n` +
      `👨‍✈️ *Motorista:* ${osData.motorista}\n` +
      `*Contato:* ${driverPhone}\n` +
      `*Veículo:* ${tipoCapitalizado}\n` +
      `${marcaModeloLine}` +
      `*Placa:* ${vehicleInfo.placa || "Não informada"}\n\n` +
      `────────────────\n` +
      `👥 *Passageiro(s):*\n${paxText}\n\n` +
      `────────────────\n` +
      `${itineraryText ? `${itineraryText}\n\n` : "📍 *Itinerário:* Não informado\n\n"}` +
      `────────────────\n` +
      `💰 *Financeiro:*\n` +
      `• Valor Bruto: ${formatCurrency(osData.valorBruto ?? 0)}\n` +
      `• Custo Motorista: ${formatCurrency(osData.custo ?? 0)}\n` +
      `• Lucro Líquido: ${formatCurrency(osData.lucro ?? 0)}`;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) return;

      // Envia mensagem administrativa para contato fixo via API WhatsApp
      const response = await fetch("/api/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // Telefone fixo sem o símbolo + (Meta API espera apenas dígitos)
        body: JSON.stringify({ phone: "5522997599213", message }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        console.error(
          "[AdminGroup] Falha ao enviar relatório administrativo:",
          result,
        );
        toast.error(
          `Relatório administrativo não enviado: ${result.error || "Erro desconhecido"}`,
        );
      } else {
        toast.success("Relatório administrativo enviado ao grupo!");
      }
    } catch (err) {
      console.error("[AdminGroup] Erro crítico:", err);
      toast.error("Erro ao enviar relatório administrativo ao grupo.");
    }
  };

  useEffect(() => {
    if (!openActionMenuId) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Para modo tabela - verifica ref do botão MoreVertical
      const currentMenu = actionMenuRefs.current[openActionMenuId];
      // Para modo calendário - verifica ref do menu do calendário
      const calendarMenu = calendarMenuRef.current;

      const clickedOutsideTableMenu =
        currentMenu && !currentMenu.contains(event.target as Node);
      const clickedOutsideCalendarMenu =
        calendarMenu && !calendarMenu.contains(event.target as Node);

      if (clickedOutsideTableMenu || clickedOutsideCalendarMenu) {
        setOpenActionMenuId(null);
        setCalendarMenuPosition(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openActionMenuId]);

  // Fechar menu de docagem ao clicar fora
  useEffect(() => {
    if (!docagemMenuTarget) return;

    const handleClickOutside = (event: MouseEvent) => {
      const menu = docagemMenuRef.current;
      if (menu && !menu.contains(event.target as Node)) {
        setDocagemMenuTarget(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [docagemMenuTarget]);

  const handleCopyProtocol = async (protocol: string) => {
    try {
      await navigator.clipboard.writeText(protocol);
      setCopiedProtocol(protocol);
      setTimeout(
        () =>
          setCopiedProtocol((current) =>
            current === protocol ? null : current,
          ),
        2000,
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao copiar protocolo.");
    }
  };

  // Inicializar formulário de edição de instância de docagem
  useEffect(() => {
    if (!editingDocagemInstance) {
      setDocagemInstanceEditForm(null);
      return;
    }
    setDocagemInstanceEditForm({
      endereco: editingDocagemInstance.endereco,
      motoristaId: editingDocagemInstance.motoristaId,
      veiculoId: editingDocagemInstance.veiculoId,
      valor: editingDocagemInstance.valor,
      custo: editingDocagemInstance.custo,
      horarioInicio: editingDocagemInstance.horarioInicio,
      horarioFim: editingDocagemInstance.horarioFim,
      observacaoFinanceira: editingDocagemInstance.observacaoFinanceira,
    });
  }, [editingDocagemInstance]);

  const [openNotifyMenuKey, setOpenNotifyMenuKey] = useState<string | null>(
    null,
  );
  const [notifyLoadingKey, setNotifyLoadingKey] = useState<string | null>(null);

  // State variables for new modals
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showAcceptRevert, setShowAcceptRevert] = useState(false);
  const [resetReason, setResetReason] = useState<"rescheduling" | "other">(
    "rescheduling",
  );
  const [resetReasonOther, setResetReasonOther] = useState("");
  // KM edit modal state
  const [showKmEdit, setShowKmEdit] = useState(false);
  const [kmEditCycleIndex, setKmEditCycleIndex] = useState<number | null>(null);
  const [kmEditField, setKmEditField] = useState<"initial" | "final">(
    "initial",
  );
  const [kmEditCurrentValue, setKmEditCurrentValue] = useState<number | null>(
    null,
  );
  const [kmEditNewValue, setKmEditNewValue] = useState("");
  const [kmEditReason, setKmEditReason] = useState("");
  const [kmEditBypass, setKmEditBypass] = useState(false);
  const [kmEditOdometerWarning, setKmEditOdometerWarning] = useState<
    number | null
  >(null);
  const [isKmEditing, setIsKmEditing] = useState(false);
  const [selectedCycleIndex, setSelectedCycleIndex] = useState<number | null>(
    null,
  );
  const [notifyMenuPosition, setNotifyMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [passengerConfirmations, setPassengerConfirmations] = useState<
    Record<string, boolean>
  >({});
  const [openDriverNotifyMenu, setOpenDriverNotifyMenu] = useState(false);
  const [driverNotifyMenuPos, setDriverNotifyMenuPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [driverNotifyTargetCycleIndex, setDriverNotifyTargetCycleIndex] =
    useState<number | null>(null);

  // Modal de confirmação para reenvio de mensagem ao motorista
  const [showResendConfirm, setShowResendConfirm] = useState(false);
  const [resendConfirmCycleIndex, setResendConfirmCycleIndex] = useState<
    number | null
  >(null);
  const [resendConfirmInfo, setResendConfirmInfo] = useState<{
    date: string;
    userName: string;
  } | null>(null);

  useEffect(() => {
    if (!openNotifyMenuKey) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest("[data-notify-menu]") ||
        target.closest("[data-notify-button]")
      )
        return;
      setOpenNotifyMenuKey(null);
      setNotifyMenuPosition(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openNotifyMenuKey]);

  useEffect(() => {
    if (!openDriverNotifyMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest("[data-driver-notify-menu]") ||
        target.closest("[data-driver-notify-button]")
      )
        return;
      setOpenDriverNotifyMenu(false);
      setDriverNotifyMenuPos(null);
      setDriverNotifyTargetCycleIndex(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDriverNotifyMenu]);

  /**
   * Handler functions for manual cycle status updates
   */
  const handleManualFinishCycle = async (osId: string, cycleIndex: number) => {
    try {
      const response = await fetch("/api/os-manual-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          os_id: osId,
          cycle_index: cycleIndex,
          action: "finish_cycle",
        }),
      });

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error || "Erro ao finalizar etapa");
        return;
      }

      toast.success("Etapa finalizada com sucesso!");
      void syncOSSnapshot(osId);
    } catch (error) {
      console.error("Erro ao finalizar ciclo manualmente:", error);
      toast.error("Erro ao finalizar etapa. Tente novamente.");
    }
  };

  const handleManualRevertAccept = async (
    osId: string,
    cycleIndex: number,
    reason: "rescheduling" | "other" = "other",
    reasonText?: string,
  ) => {
    try {
      const response = await fetch("/api/os-manual-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          os_id: osId,
          cycle_index: cycleIndex,
          action: "revert_to_pending",
          reset_reason: reason,
          ...(reasonText ? { reset_reason_text: reasonText } : {}),
        }),
      });

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error || "Erro ao retornar para pendente");
        return;
      }

      void syncOSSnapshot(osId);
    } catch (error) {
      console.error("Erro ao reverter aceite:", error);
      toast.error("Erro ao retornar status. Tente novamente.");
    }
  };

  const handleKmEdit = async () => {
    if (!viewingOS || kmEditCycleIndex === null) return;
    const parsed = parseFloat(kmEditNewValue.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Valor de KM inválido.");
      return;
    }
    if (kmEditReason.trim().length < 3) {
      toast.error("Informe uma justificativa para a edição.");
      return;
    }
    setIsKmEditing(true);
    try {
      const response = await fetch("/api/os-manual-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          os_id: viewingOS.id,
          cycle_index: kmEditCycleIndex,
          action: "edit_km",
          km_field: kmEditField,
          km_new_value: parsed,
          km_reason: kmEditReason.trim(),
          km_bypass_odometer: kmEditBypass,
        }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        current_odometer?: number;
      };
      if (!result.success) {
        if (
          result.error === "KM_BELOW_ODOMETER" &&
          result.current_odometer !== undefined
        ) {
          setKmEditOdometerWarning(result.current_odometer);
        } else {
          toast.error(result.error || "Erro ao editar KM.");
        }
        return;
      }
      toast.success("KM atualizado com sucesso.");
      setShowKmEdit(false);
      setKmEditCycleIndex(null);
      setKmEditNewValue("");
      setKmEditReason("");
      setKmEditBypass(false);
      setKmEditOdometerWarning(null);
      void syncOSSnapshot(viewingOS.id);
    } catch (error) {
      console.error("Erro ao editar KM:", error);
      toast.error("Erro ao editar KM. Tente novamente.");
    } finally {
      setIsKmEditing(false);
    }
  };

  useEffect(() => {
    if (!viewingOSId) {
      setPassengerConfirmations({});
      return;
    }

    const fetchConfirmations = async () => {
      const { data } = await supabase
        .from("os_passenger_confirmations")
        .select("passageiro_id, aceito")
        .eq("os_id", viewingOSId);

      if (data) {
        const map: Record<string, boolean> = {};
        data.forEach(
          (row: { passageiro_id: string | null; aceito: boolean }) => {
            if (row.passageiro_id) map[row.passageiro_id] = row.aceito;
          },
        );
        setPassengerConfirmations(map);
      }
    };

    void fetchConfirmations();

    const channel = supabase
      .channel(`os-confirmations-${viewingOSId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "os_passenger_confirmations",
          filter: `os_id=eq.${viewingOSId}`,
        },
        () => {
          void fetchConfirmations();
        },
      )
      .subscribe();

    // Listen for OS status changes to keep UI updated when driver accepts/rejects
    const osStatusChannel = supabase
      .channel(`os-status-${viewingOSId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ordens_servico",
          filter: `id=eq.${viewingOSId}`,
        },
        async () => {
          const latest = await fetchOSById(viewingOSId);
          if (latest) {
            osTable.updateItems((prev) =>
              prev.map((item) => (item.id === viewingOSId ? latest : item)),
            );
            setCalendarOSList((prev) =>
              prev.map((item) => (item.id === viewingOSId ? latest : item)),
            );
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(osStatusChannel);
    };
  }, [viewingOSId, supabase, osTable]);

  const [formData, setFormData] = useState(initialForm);
  const [openWaypointComments, setOpenWaypointComments] = useState<
    Record<number, boolean>
  >({});
  const waypointTimelineRefs = useRef<Record<number, HTMLDivElement | null>>(
    {},
  );
  const [destinationPassengerLineEnds, setDestinationPassengerLineEnds] =
    useState<Record<number, number>>({});
  const initialQuickPassengerForm = {
    nomeCompleto: "",
    celular: "",
    rotulo: "RESIDENCIAL",
    referencia: "",
    enderecoCompleto: "",
    notificar: "Sim",
  };
  const [quickPassengerForm, setQuickPassengerForm] = useState(
    initialQuickPassengerForm,
  );
  const [quickPassengerErrors, setQuickPassengerErrors] = useState<{
    nomeCompleto?: string;
    celular?: string;
  }>({});
  const [isAddressExpanded, setIsAddressExpanded] = useState(false);
  const [isEstrangeiro, setIsEstrangeiro] = useState(false);
  const driverOptions = useMemo(() => {
    const baseOptions = drivers
      .filter((d) => d.status !== "inactive")
      .map((d) => ({
        id: d.id,
        nome: d.name,
        photoUrl: d.avatar_url,
      }));

    const mergedOptions = [...quickAddedDriverOptions, ...baseOptions];
    const seen = new Set<string>();

    return mergedOptions.filter((option) => {
      if (seen.has(option.id)) return false;
      seen.add(option.id);
      return true;
    });
  }, [drivers, quickAddedDriverOptions]);

  // Veículos vinculados a um motorista específico (para selects de docagem)
  const getVehiclesForDriver = useCallback(
    (driverId: string | null) => {
      if (!driverId) return [];
      const vehicleIds = new Set(
        driverVehiclesAssoc
          .filter((dv) => dv.driver_id === driverId)
          .map((dv) => dv.vehicle_id),
      );
      return vehicles
        .filter((v) => vehicleIds.has(v.id))
        .map((v) => ({
          id: v.id,
          nome: `${v.marca} ${v.modelo}`,
          plate: v.placa,
        }));
    },
    [driverVehiclesAssoc, vehicles],
  );

  // Veículos disponíveis para cada modal de docagem (filtrados pelo motorista)
  const docagemFormVehicleOptions = useMemo(
    () => getVehiclesForDriver(docagemFormData.motoristaId ?? null),
    [getVehiclesForDriver, docagemFormData.motoristaId],
  );
  const docagemInstanceEditVehicleOptions = useMemo(
    () => getVehiclesForDriver(docagemInstanceEditForm?.motoristaId ?? null),
    [getVehiclesForDriver, docagemInstanceEditForm?.motoristaId],
  );

  const formatPhone = (value: string) => {
    if (isEstrangeiro) {
      return value.replace(/\D/g, "").slice(0, 15);
    }
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
    }
    return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
  };

  const formItineraries = useMemo(
    () => getItineraries(formData.waypoints),
    [formData.waypoints],
  );

  useLayoutEffect(() => {
    const nextEnds: Record<number, number> = {};

    formItineraries.forEach((it) => {
      const destinationIndex =
        it.waypointIndices[it.waypointIndices.length - 1];
      const waypoint = formData.waypoints[destinationIndex];
      if (!waypoint || (waypoint.passengers?.length || 0) === 0) {
        return;
      }

      const waypointElement = waypointTimelineRefs.current[destinationIndex];
      if (!waypointElement) {
        return;
      }

      const passengerLineElements = waypointElement.querySelectorAll(
        "[data-passenger-line]",
      ) as NodeListOf<HTMLElement>;
      if (!passengerLineElements || passengerLineElements.length === 0) {
        return;
      }

      const lastPassengerLineElement =
        passengerLineElements[passengerLineElements.length - 1];
      const containerRect = waypointElement.getBoundingClientRect();
      const lineRect = lastPassengerLineElement.getBoundingClientRect();
      const measuredHeight = Math.max(
        0,
        Math.round(lineRect.top - containerRect.top - 29),
      );
      nextEnds[destinationIndex] = measuredHeight;
    });

    setDestinationPassengerLineEnds((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(nextEnds);
      if (
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => prev[Number(key)] === nextEnds[Number(key)])
      ) {
        return prev;
      }

      return nextEnds;
    });
  }, [formData.waypoints, formItineraries]);

  const viewingOS = useMemo(() => {
    if (!viewingOSId) return null;
    return viewingOSLive || osList.find((os) => os.id === viewingOSId) || null;
  }, [osList, viewingOSId, viewingOSLive]);
  const cancelTargetOS = useMemo(
    () => osList.find((os) => os.id === cancelTargetId) || null,
    [osList, cancelTargetId],
  );

  const operationalPassengerList = useMemo(() => {
    if (!viewingOS?.rota?.waypoints) return [];

    return viewingOS.rota.waypoints.flatMap((waypoint, waypointIndex) =>
      (waypoint.passengers || []).map((passenger, passengerIndex) => {
        const passengerRecord = getPassengerRecord(
          passenger.solicitanteId || "",
        );
        return {
          key: `${waypointIndex}-${passenger.id}-${passengerIndex}`,
          waypointLabel: waypoint.label,
          nome: passengerRecord?.nomeCompleto || "Passageiro não identificado",
          celular: passengerRecord?.celular || "Não informado",
          email: passengerRecord?.email || "Não informado",
          endereco:
            passengerRecord?.enderecos?.[0]?.enderecoCompleto ||
            "Não informado",
          hasEmail: Boolean(
            passengerRecord?.email && passengerRecord.email.trim() !== "",
          ),
          hasPhone: Boolean(
            passengerRecord?.celular &&
            passengerRecord.celular.replace(/\D/g, "").length > 0,
          ),
          solicitanteId: passenger.solicitanteId || "",
          waypointIndex,
        };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viewingOS,
    getPassengerRecord,
    // passengerOptionsVer sinaliza atualizações do cache assíncrono (ref mutável).
    passengerOptionsVer,
  ]);

  const driverFlow = useMemo(() => {
    const status =
      viewingOS?.operationalCycles && viewingOS.operationalCycles.length > 0
        ? deriveCyclesOperationalStatus(viewingOS.operationalCycles)
        : viewingOS?.status.operacional;
    return {
      received: Boolean(
        viewingOS &&
        (driverNotificationSentByOS[viewingOS.id] ||
          viewingOS.driverMessageSentAt ||
          status !== "Pendente"),
      ),
      accepted: Boolean(
        viewingOS?.driverAcceptedAt ||
        status === "Aguardando" ||
        status === "Em Rota" ||
        status === "Finalizado",
      ),
      started: Boolean(
        viewingOS?.routeStartedAt ||
        status === "Em Rota" ||
        status === "Finalizado",
      ),
      finished: Boolean(viewingOS?.routeFinishedAt || status === "Finalizado"),
    };
  }, [driverNotificationSentByOS, viewingOS]);

  const operationalCycleTimeline = useMemo(() => {
    if (!viewingOS) return [];

    if (viewingOS.operationalCycles && viewingOS.operationalCycles.length > 0) {
      return viewingOS.operationalCycles;
    }

    const fallbackWaypoints = (viewingOS.rota?.waypoints || []).map(
      (wp, position) => ({
        itineraryIndex: wp.itineraryIndex ?? null,
        position,
      }),
    );

    return buildOperationalCyclesFromWaypoints(fallbackWaypoints);
  }, [viewingOS]);

  const cyclesToRender = useMemo(() => {
    if (operationalCycleTimeline.length > 0) {
      return operationalCycleTimeline;
    }

    if (!viewingOS) {
      return [];
    }

    return [
      {
        itineraryIndex: 0,
        sequenceOrder: 0,
        kind: "itinerary" as const,
        ordinal: 1,
        title: "Primeiro Itinerário",
        state: driverFlow.finished
          ? "completed"
          : driverFlow.started
            ? "awaiting_finish"
            : driverFlow.accepted
              ? "awaiting_start"
              : driverFlow.received
                ? "awaiting_accept"
                : "pending",
        messageSentAt: viewingOS.driverMessageSentAt ?? null,
        acceptedAt: viewingOS.driverAcceptedAt ?? null,
        startedAt: viewingOS.routeStartedAt ?? null,
        finishedAt: viewingOS.routeFinishedAt ?? null,
        kmInitial: viewingOS.routeStartedKm ?? null,
        kmFinal: viewingOS.routeFinishedKm ?? null,
      },
    ];
  }, [
    driverFlow.accepted,
    driverFlow.finished,
    driverFlow.received,
    driverFlow.started,
    operationalCycleTimeline,
    viewingOS,
  ]);

  const effectiveOperationalStatus = useMemo((): CycleOperationalStatus => {
    if (cyclesToRender.length > 0) {
      const normalizedCycles = cyclesToRender.map((c) => ({
        ...c,
        state: (c.state as OperationalCycleState) || "pending",
      }));
      return deriveCyclesOperationalStatus(normalizedCycles);
    }
    return (viewingOS?.status.operacional ??
      "Pendente") as CycleOperationalStatus;
  }, [cyclesToRender, viewingOS?.status.operacional]);

  const handleAddWaypoint = (targetItineraryIndex: number) => {
    const itineraries = getItineraries(formData.waypoints);
    const targetIt = itineraries.find(
      (it) => it.index === targetItineraryIndex,
    );
    if (!targetIt) return;
    const insertIdx =
      targetIt.waypointIndices[targetIt.waypointIndices.length - 1]; // before destination
    const newWaypoint = {
      label: "",
      lat: null,
      lng: null,
      comment: "",
      passengers: [],
      itineraryIndex: targetIt.index,
    };
    const newWaypoints = [...formData.waypoints];
    newWaypoints.splice(insertIdx, 0, newWaypoint);
    setOpenWaypointComments((prev) => {
      const next: Record<number, boolean> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const k = Number(key);
        if (k < insertIdx) next[k] = value;
        if (k >= insertIdx) next[k + 1] = value;
      });
      next[insertIdx] = false;
      return next;
    });
    setFormData((prev) => ({ ...prev, waypoints: newWaypoints }));
  };

  const handleAddItinerary = () => {
    const itineraries = getItineraries(formData.waypoints);
    const maxItineraryIndex = itineraries
      .filter((it) => it.index >= 0)
      .reduce((max, it) => Math.max(max, it.index), -1);
    const newItIndex = maxItineraryIndex + 1;
    const newWaypoints = [...formData.waypoints];
    newWaypoints.push(
      {
        label: "",
        lat: null,
        lng: null,
        comment: "",
        passengers: [],
        itineraryIndex: newItIndex,
      },
      {
        label: "",
        lat: null,
        lng: null,
        comment: "",
        passengers: [],
        itineraryIndex: newItIndex,
      },
    );
    setFormData((prev) => ({ ...prev, waypoints: newWaypoints }));
  };

  const handleAddReturn = () => {
    const itineraries = getItineraries(formData.waypoints);
    const lastGroup = itineraries[itineraries.length - 1];

    if (!lastGroup || lastGroup.index < 0) {
      toast.error("Adicione um itinerário antes de adicionar um retorno.");
      return;
    }

    const returnIndex = -(lastGroup.index + 1);
    const newWaypoints = [...formData.waypoints];
    newWaypoints.push(
      {
        label: "",
        lat: null,
        lng: null,
        comment: "",
        passengers: [],
        itineraryIndex: returnIndex,
      },
      {
        label: "",
        lat: null,
        lng: null,
        comment: "",
        passengers: [],
        itineraryIndex: returnIndex,
      },
    );
    setFormData((prev) => ({ ...prev, waypoints: newWaypoints }));
  };

  const handleRemoveWaypoint = (index: number) => {
    const itineraries = getItineraries(formData.waypoints);
    const it = itineraries.find((g) => g.waypointIndices.includes(index));
    if (!it) return;
    // Don't allow removing origin or destination if it would leave < 2 waypoints in itinerary
    const isOrigin = it.waypointIndices[0] === index;
    const isDestination =
      it.waypointIndices[it.waypointIndices.length - 1] === index;
    if ((isOrigin || isDestination) && it.waypoints.length <= 2) return;
    // If removing origin or destination of an itinerary with > 2 waypoints, convert next/prev stop
    const newWaypoints = [...formData.waypoints];
    newWaypoints.splice(index, 1);
    setOpenWaypointComments((prev) => {
      const next: Record<number, boolean> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const k = Number(key);
        if (k < index) next[k] = value;
        if (k > index) next[k - 1] = value;
      });
      return next;
    });
    setFormData((prev) => ({ ...prev, waypoints: newWaypoints }));
  };

  const handleRemoveItinerary = async (itineraryIndex: number) => {
    const itineraries = getItineraries(formData.waypoints);
    if (itineraries.length <= 1) {
      toast.error("Pelo menos 1 itinerário é obrigatório.");
      return;
    }
    const targetIt = itineraries.find((it) => it.index === itineraryIndex);
    if (!targetIt) return;

    const confirmed = await confirm({
      title: "Remover itinerário",
      message: `Deseja realmente remover o ${itineraryIndex < 0 ? "retorno" : `itinerário ${itineraryIndex + 1}`}? Esta ação não pode ser desfeita.`,
      confirmText: "Remover",
      cancelText: "Cancelar",
      type: "danger",
    });
    if (!confirmed) return;

    const indicesToRemove = new Set(targetIt.waypointIndices);
    const reindexedWaypoints = formData.waypoints
      .filter((_, idx) => !indicesToRemove.has(idx))
      .map((wp) => {
        const itIdx = wp.itineraryIndex ?? 0;
        if (itineraryIndex >= 0 && itIdx > itineraryIndex) {
          return { ...wp, itineraryIndex: itIdx - 1 };
        }
        if (itineraryIndex < 0 && itIdx < itineraryIndex) {
          return { ...wp, itineraryIndex: itIdx + 1 };
        }
        return wp;
      });
    setOpenWaypointComments((prev) => {
      const next: Record<number, boolean> = {};
      let offset = 0;
      formData.waypoints.forEach((_, idx) => {
        if (indicesToRemove.has(idx)) {
          offset++;
        } else {
          next[idx - offset] = prev[idx];
        }
      });
      return next;
    });
    setFormData((prev) => ({ ...prev, waypoints: reindexedWaypoints }));
  };

  const handleWaypointChange = (index: number, value: string) => {
    const newWaypoints = [...formData.waypoints];
    newWaypoints[index] = { ...newWaypoints[index], label: value };
    setFormData((prev) => ({
      ...prev,
      waypoints: newWaypoints,
    }));
  };

  const handleWaypointCommentChange = (index: number, value: string) => {
    const newWaypoints = [...formData.waypoints];
    newWaypoints[index] = { ...newWaypoints[index], comment: value };
    setFormData((prev) => ({
      ...prev,
      waypoints: newWaypoints,
    }));
  };

  const handleWaypointHoraChange = (index: number, value: string) => {
    let cleanValue = value.replace(/\D/g, "");
    if (cleanValue.length > 4) cleanValue = cleanValue.slice(0, 4);

    let hours = cleanValue.slice(0, 2);
    let minutes = cleanValue.slice(2, 4);

    if (hours && parseInt(hours) > 23) hours = "23";
    if (minutes && parseInt(minutes) > 59) minutes = "59";

    let formatted = hours;
    if (minutes) {
      formatted = `${hours}:${minutes}`;
    } else if (hours.length === 2 && cleanValue.length > 2) {
      formatted = `${hours}:`;
    }

    const newWaypoints = [...formData.waypoints];
    newWaypoints[index] = { ...newWaypoints[index], hora: formatted };
    setFormData((prev) => ({
      ...prev,
      waypoints: newWaypoints,
    }));
  };

  const handleWaypointDataChange = (index: number, value: string) => {
    let cleanValue = value.replace(/\D/g, "");
    if (cleanValue.length > 8) cleanValue = cleanValue.slice(0, 8);

    if (cleanValue === "") {
      const newWaypoints = [...formData.waypoints];
      newWaypoints[index] = { ...newWaypoints[index], data: "" };
      setFormData((prev) => ({
        ...prev,
        waypoints: newWaypoints,
      }));
      return;
    }

    let day = cleanValue.slice(0, 2);
    let month = cleanValue.slice(2, 4);
    let year = cleanValue.slice(4, 8);

    if (day && parseInt(day) > 31) day = "31";
    if (month && parseInt(month) > 12) month = "12";
    if (year && parseInt(year) > 5000) year = "5000";

    const validatedClean = day + month + year;

    let formatted = validatedClean;
    if (month) formatted = `${day}/${month}`;
    if (year) formatted = `${day}/${month}/${year}`;

    const newWaypoints = [...formData.waypoints];
    newWaypoints[index] = { ...newWaypoints[index], data: formatted };
    setFormData((prev) => ({
      ...prev,
      waypoints: newWaypoints,
    }));
  };

  const handleWaypointDataBlur = (index: number) => {
    const waypoint = formData.waypoints[index];
    if (!waypoint || waypoint.data) return;

    const fallbackDate = formData.data
      ? formData.data.includes("-")
        ? formData.data.split("-").reverse().join("/")
        : formData.data
      : "";

    if (!fallbackDate) return;

    const newWaypoints = [...formData.waypoints];
    newWaypoints[index] = { ...newWaypoints[index], data: fallbackDate };
    setFormData((prev) => ({
      ...prev,
      waypoints: newWaypoints,
    }));
  };

  const toggleWaypointComment = (index: number) => {
    const isOpen = Boolean(openWaypointComments[index]);

    if (isOpen) {
      setOpenWaypointComments((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      return;
    }

    setOpenWaypointComments((prev) => ({
      ...prev,
      [index]: true,
    }));
  };

  const handleAddPassenger = (waypointIndex: number) => {
    const newWaypoints = [...formData.waypoints];
    const waypoint = { ...newWaypoints[waypointIndex] };
    passengerDraftIdRef.current += 1;
    waypoint.passengers = [
      ...(waypoint.passengers || []),
      {
        id: `draft-passenger-${passengerDraftIdRef.current}`,
        solicitanteId: "",
        nome: "",
      },
    ];
    newWaypoints[waypointIndex] = waypoint;
    setFormData((prev) => ({ ...prev, waypoints: newWaypoints }));
  };

  const handleRemovePassenger = (
    waypointIndex: number,
    passengerId: string,
  ) => {
    const newWaypoints = [...formData.waypoints];
    const waypoint = { ...newWaypoints[waypointIndex] };
    waypoint.passengers = (waypoint.passengers || []).filter(
      (p) => p.id !== passengerId,
    );
    newWaypoints[waypointIndex] = waypoint;
    setFormData((prev) => ({ ...prev, waypoints: newWaypoints }));
  };

  // ── Busca assíncrona de passageiros (server-side) ──────────────────────
  // Resolve o problema de bases grandes que excedem o limite padrão de
  // paginação do Supabase (~1000 linhas). O dropdown busca sob demanda no
  // banco em vez de filtrar a lista completa em memória.
  //
  // fullPassengersRef/lightPassengersRef e os callbacks getPassengerRecord/
  // getPassengerOption estão declarados antes de filteredCalendarOSList
  // (linha ~760) para evitar TDZ. Apenas o useEffect de hidratação (que
  // depende de formData e viewingOS) e resolvePassengerRecordsForOS ficam aqui.

  const searchPassageiros = useCallback(
    async (term: string): Promise<PassengerOption[]> => {
      try {
        const res = await fetchPassageirosPage({
          page: 1,
          pageSize: 20,
          searchTerm: term,
        });
        const opts = res.items.map((p) => ({
          id: p.id,
          nome: p.nomeCompleto,
          sublabel: p.celular || undefined,
        }));
        // Popula apenas o cache leve (sem enderecos). O fullPassengersRef
        // é preenchido exclusivamente pelo fetchPassageirosByIds.
        opts.forEach((o) => {
          lightPassengersRef.current[o.id] = o;
        });
        return opts;
      } catch {
        return [];
      }
    },
    [],
  );

  // Hidrata registros COMPLETOS (incluindo enderecos) para passageiros
  // referenciados pelo form, OS em visualização e listagem.
  // Só considera ausente se não estiver em passageiros (DataContext) nem em
  // fullPassengersRef — ignora lightPassengersRef propositalmente, para que
  // um registro parcial (do dropdown) não bloqueie a busca do completo.
  useEffect(() => {
    const ids = new Set<string>();
    formData.waypoints.forEach((w) =>
      (w.passengers || []).forEach((p) => {
        if (p.solicitanteId) ids.add(p.solicitanteId);
      }),
    );
    viewingOS?.rota?.waypoints?.forEach((w) =>
      (w.passengers || []).forEach((p) => {
        if (p.solicitanteId) ids.add(p.solicitanteId);
      }),
    );
    osList.forEach((os) =>
      os.rota?.waypoints?.forEach((w) =>
        (w.passengers || []).forEach((p) => {
          if (p.solicitanteId) ids.add(p.solicitanteId);
        }),
      ),
    );

    const missing = [...ids].filter(
      (id) =>
        !fullPassengersRef.current[id] && !passageiros.some((p) => p.id === id),
    );
    if (missing.length === 0) return;
    let cancelled = false;
    fetchPassageirosByIds(missing)
      .then((recs) => {
        if (cancelled) return;
        recs.forEach((r) => {
          fullPassengersRef.current[r.id] = r;
        });
        setPassengerOptionsVer((v) => v + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [formData.waypoints, viewingOS, osList, passageiros]);

  // Resolve passageiros completos de uma OS específica. Usado por funções
  // assíncronas (notificações, mensagem admin) que precisam de celular/email.
  const resolvePassengerRecordsForOS = useCallback(
    async (osData: OrderService): Promise<Passageiro[]> => {
      const ids = new Set<string>();
      osData.rota?.waypoints?.forEach((w) =>
        (w.passengers || []).forEach((p) => {
          if (p.solicitanteId) ids.add(p.solicitanteId);
        }),
      );
      const idsArray = [...ids];
      const missing = idsArray.filter(
        (id) =>
          !fullPassengersRef.current[id] &&
          !passageiros.some((p) => p.id === id),
      );
      if (missing.length > 0) {
        try {
          const recs = await fetchPassageirosByIds(missing);
          recs.forEach((r) => {
            fullPassengersRef.current[r.id] = r;
          });
          setPassengerOptionsVer((v) => v + 1);
        } catch {
          // continua com o cache disponível
        }
      }
      return idsArray
        .map((id) => getPassengerRecord(id))
        .filter((p): p is Passageiro => p !== null);
    },
    [getPassengerRecord, passageiros],
  );

  const handlePassengerChange = (
    waypointIndex: number,
    passengerId: string,
    novoPassageiroId: string,
  ) => {
    const newWaypoints = [...formData.waypoints];
    const waypoint = { ...newWaypoints[waypointIndex] };
    const opt = getPassengerOption(novoPassageiroId);
    waypoint.passengers = (waypoint.passengers || []).map((p) =>
      p.id === passengerId
        ? {
            ...p,
            solicitanteId: novoPassageiroId,
            nome: opt?.nome || "",
          }
        : p,
    );
    newWaypoints[waypointIndex] = waypoint;
    setFormData((prev) => ({ ...prev, waypoints: newWaypoints }));
  };

  const getWaypointInfo = (waypointIndex: number) => {
    const totalWaypoints = formData.waypoints.length;
    const isFirst = waypointIndex === 0;
    const isLast = waypointIndex === totalWaypoints - 1;

    if (isFirst) {
      return {
        type: "ORIGEM",
        color: "emerald",
        bgColor: "bg-emerald-50",
        textColor: "text-emerald-600",
        borderColor: "border-emerald-200",
        description: "Ponto de partida",
      };
    } else if (isLast) {
      return {
        type: "DESTINO FINAL",
        color: "blue",
        bgColor: "bg-blue-50",
        textColor: "text-blue-600",
        borderColor: "border-blue-200",
        description: "Ponto de chegada",
      };
    } else {
      return {
        type: "PARADA",
        color: "slate",
        bgColor: "bg-slate-50",
        textColor: "text-slate-600",
        borderColor: "border-slate-200",
        description: "Parada intermediária",
      };
    }
  };

  const openQuickPassengerModal = (
    waypointIndex: number,
    passengerId: string,
  ) => {
    setQuickPassengerTarget({ waypointIndex, passengerId });
    setQuickPassengerForm(initialQuickPassengerForm);
    setQuickPassengerErrors({});
    setIsAddressExpanded(false);
    setIsQuickPassengerModalOpen(true);
  };

  const handleQuickAddMotorista = () => {
    setQuickAddModal("motorista");
    setQuickAddForm({ nome: "" });
    setQuickAddDriverForm(initialQuickAddDriverForm);
  };

  const handleQuickAddSolicitante = () => {
    if (!formData.clienteId) {
      toast.error("Selecione primeiro uma empresa/cliente");
      return;
    }
    setQuickAddModal("solicitante");
    setQuickAddForm({ nome: "" });
  };

  const handleQuickAddCentroCusto = () => {
    if (!formData.clienteId) {
      toast.error("Selecione primeiro uma empresa/cliente");
      return;
    }
    setQuickAddModal("centroCusto");
    setQuickAddForm({ nome: "" });
  };

  const handleQuickAddVeiculo = () => {
    if (!formData.motorista) {
      toast.error("Selecione primeiro o motorista.");
      return;
    }
    const driver = drivers.find((d) => d.name === formData.motorista);
    const linked = driverVehiclesAssoc
      .filter((a) => a.driver_id === driver?.id)
      .map((a) => a.vehicle_id);
    setOsVehicleManageIds(linked);
    setIsOsVehicleQuickModalOpen(true);
  };

  const handleOsVehicleManageConfirm = async () => {
    const driver = drivers.find((d) => d.name === formData.motorista);
    if (!driver) {
      toast.error("Motorista não encontrado no sistema.");
      return;
    }
    const finalIds = osVehicleManageIds.filter(
      (id, idx, arr) => id && arr.indexOf(id) === idx,
    );
    setIsSubmittingOsVehicle(true);
    try {
      const currentAssoc = driverVehiclesAssoc.filter(
        (a) => a.driver_id === driver.id,
      );
      const currentIds = currentAssoc.map((a) => a.vehicle_id);
      const toAdd = finalIds.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !finalIds.includes(id));

      if (toRemove.length > 0) {
        const { error: delError } = await supabase
          .from("driver_vehicles")
          .delete()
          .eq("driver_id", driver.id)
          .in("vehicle_id", toRemove);
        if (delError) throw delError;
      }
      if (toAdd.length > 0) {
        const { error: insError } = await supabase
          .from("driver_vehicles")
          .insert(
            toAdd.map((vid) => ({ driver_id: driver.id, vehicle_id: vid })),
          );
        if (insError) throw insError;
      }

      setDriverVehiclesAssoc((prev) => [
        ...prev.filter((a) => a.driver_id !== driver.id),
        ...finalIds.map((vid) => ({ driver_id: driver.id, vehicle_id: vid })),
      ]);
      setFormData((prev) => ({ ...prev, veiculoId: finalIds[0] || "" }));
      toast.success("Veículos vinculados atualizados!");
      setIsOsVehicleQuickModalOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao atualizar vínculos.",
      );
    } finally {
      setIsSubmittingOsVehicle(false);
    }
  };

  const handleRemoveVehicleFromManage = async (
    vehicleId: string,
    index: number,
  ) => {
    if (!vehicleId) return;
    if (!formData.driverId) return;

    const hasActive = await checkActiveOSForDriverVehicle(
      formData.driverId,
      vehicleId,
      editingOSId,
    );

    if (hasActive) {
      toast.error(
        "Não é possível remover este veículo. Existe uma OS ativa vinculada a ele.",
      );
      return;
    }

    const confirmed = await confirm({
      title: "Remover veículo vinculado",
      message: "Tem certeza que deseja remover este veículo do motorista?",
      confirmText: "Remover",
      cancelText: "Cancelar",
      type: "danger",
    });

    if (confirmed) {
      setOsVehicleManageIds((prev) => prev.filter((_, idx) => idx !== index));
    }
  };

  const handleQuickVehicleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickVehicleModal) return;
    setIsSubmittingQuickVehicle(true);
    try {
      if (!validarPlacaOS(vehicleQuickForm.placa)) {
        throw new Error(
          "Formato de placa inválido. Use ABC-1234 ou Mercosul ABC-1D23.",
        );
      }
      if (quickVehicleModal.mode === "create") {
        if (hasDuplicatePlateQuick(vehicleQuickForm.placa))
          throw new Error("Já existe um veículo com esta placa.");
        const { data, error } = await supabase
          .from("veiculos")
          .insert([
            {
              placa: vehicleQuickForm.placa.trim().toUpperCase(),
              modelo: vehicleQuickForm.modelo.trim(),
              marca: vehicleQuickForm.marca.trim(),
              tipo: vehicleQuickForm.tipo,
              status: "ativo",
              ano: new Date().getFullYear(),
              renavam: "",
            },
          ])
          .select("id, placa, modelo, marca")
          .single();
        if (error) throw error;
        const newV = data as VehicleOption;
        setVehicles((prev) =>
          [...prev, newV].sort(
            (a, b) =>
              a.marca.localeCompare(b.marca, "pt-BR") ||
              a.modelo.localeCompare(b.modelo, "pt-BR"),
          ),
        );
        if (isOsVehicleQuickModalOpen) {
          setOsVehicleManageIds((prev) => [...prev, newV.id]);
        } else {
          setQuickAddDriverForm((prev) => ({
            ...prev,
            vehicle_ids: prev.vehicle_ids.map((id, idx) =>
              idx === quickVehicleModal.rowIndex ? newV.id : id,
            ),
          }));
        }
        toast.success("Veículo cadastrado e selecionado!");
      } else {
        const { vehicleId } = quickVehicleModal;
        if (hasDuplicatePlateQuick(vehicleQuickForm.placa, vehicleId))
          throw new Error("Já existe um veículo com esta placa.");
        const { data, error } = await supabase
          .from("veiculos")
          .update({
            placa: vehicleQuickForm.placa.trim().toUpperCase(),
            modelo: vehicleQuickForm.modelo.trim(),
            marca: vehicleQuickForm.marca.trim(),
            tipo: vehicleQuickForm.tipo,
          })
          .eq("id", vehicleId)
          .select("id, placa, modelo, marca")
          .single();
        if (error) throw error;
        setVehicles((prev) =>
          prev.map((v) => (v.id === vehicleId ? (data as VehicleOption) : v)),
        );
        toast.success("Veículo atualizado!");
      }
      setQuickVehicleModal(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar veículo.",
      );
    } finally {
      setIsSubmittingQuickVehicle(false);
    }
  };

  const closeQuickAddModal = () => {
    setQuickAddModal(null);
    setQuickAddForm({ nome: "" });
    setQuickAddDriverForm(initialQuickAddDriverForm);
  };

  const handleQuickAddSubmit = async () => {
    if (!quickAddModal) return;

    if (quickAddModal !== "motorista" && !quickAddForm.nome.trim()) return;

    try {
      switch (quickAddModal) {
        case "cliente": {
          const newCliente = await addCliente(quickAddForm.nome.trim());
          toast.success("Empresa cadastrada com sucesso!");
          // Selecionar automaticamente
          setFormData((prev) => ({
            ...prev,
            clienteId: newCliente.id,
            solicitante: "",
            solicitanteId: "",
            centroCusto: "",
          }));
          break;
        }
        case "motorista": {
          const name = forceUpperText(quickAddDriverForm.name.trim());
          const cpfDigits = quickAddDriverForm.cpf.replace(/\D/g, "");
          const celularDigits = normalizeBrazilPhone(
            quickAddDriverForm.celular,
          );

          if (!name) {
            toast.error("Nome completo é obrigatório.");
            return;
          }

          if (!/^\S+(?:\s+\S+)+$/.test(name.trim())) {
            toast.error(
              "Nome completo deve conter pelo menos nome e sobrenome.",
            );
            return;
          }

          if (!validateDriverCPF(quickAddDriverForm.cpf)) {
            toast.error("CPF inválido. Verifique os dígitos informados.");
            return;
          }

          if (!validateDriverCelular(quickAddDriverForm.celular)) {
            toast.error(
              "Celular inválido. Use um número real com DDD brasileiro. Ex: (11) 91234-5678",
            );
            return;
          }

          if (
            quickAddDriverForm.vinculo_tipo === "parceiro" &&
            !quickAddDriverForm.parceiro_id
          ) {
            toast.error("Selecione o parceiro de serviço primeiro.");
            return;
          }

          if (quickAddDriverForm.vehicle_ids.length === 0) {
            toast.error("Adicione pelo menos um veículo ao motorista.");
            return;
          }

          const duplicateName = drivers.some(
            (driver) =>
              normalizeTextValue(driver.name) === normalizeTextValue(name),
          );
          const duplicateCpf = drivers.some(
            (driver) => normalizeDigitsValue(driver.cpf || "") === cpfDigits,
          );
          const duplicatePhone = drivers.some(
            (driver) =>
              normalizeBrazilPhone(driver.phone || "") === celularDigits,
          );

          if (duplicateName) {
            toast.error("Já existe um motorista com este nome.");
            return;
          }

          if (duplicateCpf) {
            toast.error("Já existe um motorista com este CPF.");
            return;
          }

          if (duplicatePhone) {
            toast.error("Já existe um motorista com este celular.");
            return;
          }

          const insertData = {
            name,
            cpf: cpfDigits,
            phone: celularDigits,
            status: "active" as const,
            vinculo_tipo: quickAddDriverForm.vinculo_tipo,
            parceiro_id:
              quickAddDriverForm.vinculo_tipo === "parceiro"
                ? quickAddDriverForm.parceiro_id
                : undefined,
          };

          const newDriver = await addDriver(insertData);

          // Inserir veículos vinculados
          if (newDriver && quickAddDriverForm.vehicle_ids.length > 0) {
            const driverVehicles = quickAddDriverForm.vehicle_ids.map(
              (vehicleId) => ({
                driver_id: newDriver.id,
                vehicle_id: vehicleId,
              }),
            );

            const { error: vehiclesError } = await supabase
              .from("driver_vehicles")
              .insert(driverVehicles);

            if (vehiclesError) {
              console.error("Erro ao vincular veículos:", vehiclesError);
              toast.error(
                "Motorista criado, mas houve erro ao vincular veículos.",
              );
            } else {
              setDriverVehiclesAssoc((prev) => [
                ...prev,
                ...quickAddDriverForm.vehicle_ids.map((vehicleId) => ({
                  driver_id: newDriver.id,
                  vehicle_id: vehicleId,
                })),
              ]);
            }
          }

          toast.success("Motorista cadastrado com sucesso!");
          if (newDriver) {
            setQuickAddedDriverOptions((prev) => {
              if (prev.some((option) => option.id === newDriver.id))
                return prev;
              return [...prev, { id: newDriver.id, nome: newDriver.name }];
            });
            setFormData((prev) => ({
              ...prev,
              driverId: newDriver.id,
              motorista: newDriver.name,
              veiculoId: "",
            }));
          }
          break;
        }
        case "solicitante": {
          const cleanName = quickAddForm.nome.trim();
          const duplicateSolicitante = availableSolicitantes.some(
            (solicitante) =>
              normalizeTextValue(solicitante.nome) ===
              normalizeTextValue(cleanName),
          );

          if (duplicateSolicitante) {
            toast.error(
              "Já existe um solicitante com este nome para esta empresa.",
            );
            return;
          }

          const newSolicitante = await addSolicitante(
            cleanName,
            formData.clienteId,
          );
          toast.success("Solicitante cadastrado com sucesso!");
          setQuickAddedSolicitantes((prev) => {
            if (prev.some((item) => item.id === newSolicitante.id)) return prev;
            return [
              ...prev,
              {
                id: newSolicitante.id,
                nome: newSolicitante.nome,
                clienteId: newSolicitante.clienteId,
              },
            ];
          });
          // Selecionar automaticamente
          setFormData((prev) => ({
            ...prev,
            solicitanteId: newSolicitante.id,
            solicitante: newSolicitante.nome,
          }));
          break;
        }
        case "centroCusto": {
          const cleanName = quickAddForm.nome.trim();
          const duplicateCentroCusto = availableCentrosCusto.some(
            (centroCusto) =>
              normalizeTextValue(centroCusto.nome) ===
              normalizeTextValue(cleanName),
          );

          if (duplicateCentroCusto) {
            toast.error(
              "Já existe um centro de custo com este nome para esta empresa.",
            );
            return;
          }

          const newCentroCusto = await addCentroCusto(
            cleanName,
            formData.clienteId,
          );
          toast.success("Centro de custo cadastrado com sucesso!");
          setQuickAddedCentrosCusto((prev) => {
            if (prev.some((item) => item.id === newCentroCusto.id)) return prev;
            return [
              ...prev,
              {
                id: newCentroCusto.id,
                nome: newCentroCusto.nome,
                clienteId: newCentroCusto.clienteId,
              },
            ];
          });
          // Selecionar automaticamente
          setFormData((prev) => ({ ...prev, centroCusto: newCentroCusto.id }));
          break;
        }
      }
      closeQuickAddModal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao cadastrar");
    }
  };

  const filteredQuickAddVehicles = useMemo(() => {
    // Como não há coluna proprietario_tipo, mostrar todos os veículos ativos
    return vehicles;
  }, [vehicles]);

  const handleQuickPassengerSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quickPassengerTarget) return;

    const trimmedNome = quickPassengerForm.nomeCompleto.trim();
    const trimmedEndereco = quickPassengerForm.enderecoCompleto.trim();
    const phoneDigits = stripBrazilCountryCode(quickPassengerForm.celular);

    setQuickPassengerErrors({});

    const errors: { nomeCompleto?: string; celular?: string } = {};
    if (!trimmedNome) {
      errors.nomeCompleto = "Informe o nome completo do passageiro.";
    }

    if (!isEstrangeiro && phoneDigits.length !== 11) {
      errors.celular = "Celular brasileiro deve conter 11 dígitos.";
    }

    if (Object.keys(errors).length > 0) {
      setQuickPassengerErrors(errors);
      return;
    }

    if (isAddressExpanded && !trimmedEndereco) {
      toast.error(
        "Informe o endereço completo ou recolha a seção de endereço para salvar sem endereço.",
      );
      return;
    }

    const enderecos = trimmedEndereco
      ? [
          {
            rotulo: quickPassengerForm.rotulo.trim(),
            referencia: quickPassengerForm.referencia.trim(),
            enderecoCompleto: trimmedEndereco,
          },
        ]
      : [];

    try {
      const novoPassageiro = await addPassageiro({
        nomeCompleto: trimmedNome.toUpperCase(),
        celular: normalizeBrazilPhone(quickPassengerForm.celular),
        notificar: quickPassengerForm.notificar === "Sim",
        enderecos,
      });

      const newWaypoints = [...formData.waypoints];
      const waypoint = { ...newWaypoints[quickPassengerTarget.waypointIndex] };
      waypoint.passengers = (waypoint.passengers || []).map((p) =>
        p.id === quickPassengerTarget.passengerId
          ? {
              ...p,
              solicitanteId: novoPassageiro.id,
              nome: novoPassageiro.nomeCompleto,
            }
          : p,
      );
      newWaypoints[quickPassengerTarget.waypointIndex] = waypoint;
      setFormData((prev) => ({ ...prev, waypoints: newWaypoints }));

      setIsQuickPassengerModalOpen(false);
      setQuickPassengerTarget(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o passageiro.",
      );
    }
  };

  const processAutoNotifications = async (osIdParam: string) => {
    const osIdParamStr = String(osIdParam || "");
    const startedAt = performance.now();
    console.log("[Perf][AutoNotif] Starting with osIdParam:", osIdParamStr);
    if (!notificationConfig.motorista && !notificationConfig.passageiros) {
      console.log(
        `[Perf][AutoNotif] skipped in ${(performance.now() - startedAt).toFixed(0)}ms`,
      );
      return;
    }
    const latestOS = await fetchOSById(String(osIdParam));
    if (!latestOS) {
      console.log(
        `[Perf][AutoNotif] OS not found ${(performance.now() - startedAt).toFixed(0)}ms`,
      );
      return;
    }

    // 1. Notificar Motorista
    if (notificationConfig.motorista) {
      try {
        // Notificar o primeiro ciclo (itineraryIndex: 0)
        await sendWhatsAppNotification(latestOS, 0);
      } catch (err) {
        console.error("Erro ao notificar motorista automaticamente:", err);
      }
    }

    // 2. Notificar Passageiros
    if (notificationConfig.passageiros) {
      try {
        const passengerRecords = await resolvePassengerRecordsForOS(latestOS);
        const recordById = new Map(passengerRecords.map((r) => [r.id, r]));
        if (latestOS.rota?.waypoints) {
          for (const wp of latestOS.rota.waypoints) {
            for (const p of wp.passengers) {
              const passRecord = p.solicitanteId
                ? recordById.get(p.solicitanteId)
                : undefined;
              if (passRecord && passRecord.celular) {
                await handleNotifyPassengerDirect(
                  latestOS,
                  {
                    nome: passRecord.nomeCompleto,
                    email: passRecord.email || "",
                    celular: passRecord.celular,
                    hasEmail: !!passRecord.email,
                    hasPhone: true,
                    solicitanteId: p.solicitanteId,
                  },
                  "whatsapp",
                );
              }
            }
          }
        }
      } catch (err) {
        console.error("Erro ao notificar passageiros automaticamente:", err);
      }
    }

    console.log(
      `[Perf][AutoNotif] finished in ${(performance.now() - startedAt).toFixed(0)}ms`,
    );
  };

  const executeSaveOS = async (
    osData: PendingOSData,
    targetId?: string | null,
  ) => {
    setOsSubmissionMode(targetId ? "update" : "create");
    setIsSubmittingOS(true);
    try {
      if (targetId) {
        const t0 = performance.now();
        const result = await updateOS(targetId, osData);
        const t1 = performance.now();
        console.log(`[executeSaveOS] updateOS levou ${(t1 - t0).toFixed(0)}ms`);
        // Desliga o loader imediatamente; refresh continua em background
        setIsSubmittingOS(false);
        setOsSubmissionMode(null);
        const refreshStartedAt = performance.now();
        void osTable.refresh().finally(() => {
          console.log(
            `[Perf][OS] osTable.refresh(update) ${(performance.now() - refreshStartedAt).toFixed(0)}ms`,
          );
        });
        setShowNotificationConfirm(false);
        void resetMainModalState();

        if (result.changed) {
          toast.success("Atendimento atualizado com sucesso.");
        }
        // Se changed === false, o DataContext ja exibiu toast informativo
      } else {
        const t0 = performance.now();
        const newOSId = await addOS(osData);
        const t1 = performance.now();
        console.log(`[executeSaveOS] addOS levou ${(t1 - t0).toFixed(0)}ms`);
        // Desliga o loader imediatamente; refresh continua em background
        setIsSubmittingOS(false);
        setOsSubmissionMode(null);
        const refreshStartedAt = performance.now();
        void osTable.refresh().finally(() => {
          console.log(
            `[Perf][OS] osTable.refresh(create) ${(performance.now() - refreshStartedAt).toFixed(0)}ms`,
          );
        });
        setShowNotificationConfirm(false);
        void resetMainModalState();
        if (notificationConfig.auto) {
          void processAutoNotifications(newOSId.id);
        }
        // Enviar email administrativo obrigatoriamente (tanto manual quanto automático)
        void fetch("/api/admin-notify-os", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ osId: newOSId.id }),
        }).catch((err) =>
          console.error("Erro ao enviar email administrativo:", err),
        );
        // Enviar mensagem administrativa via WhatsApp para contato fixo
        void (async () => {
          try {
            const startedAt = performance.now();
            const latestOS = await fetchOSById(newOSId.id);
            if (latestOS) {
              await sendAdminGroupMessage(latestOS);
            }
            console.log(
              `[Perf][AdminGroup] ${newOSId.id} ${(performance.now() - startedAt).toFixed(0)}ms`,
            );
          } catch (err) {
            console.error("[AdminGroup] Erro ao buscar OS para envio:", err);
          }
        })();
      }
    } catch (error) {
      console.error("Error saving OS:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a ordem de serviço.",
      );
    } finally {
      setIsSubmittingOS(false);
      setOsSubmissionMode(null);
    }
  };

  const handleAddOS = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação dos campos obrigatórios
    if (
      !formData.data ||
      !formData.clienteId ||
      !formData.driverId ||
      !formData.veiculoId
    ) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    // Validação: origem do primeiro itinerário deve ter data e hora
    const itineraries = getItineraries(formData.waypoints);
    const firstItinerary = itineraries.find((it) => it.index === 0);
    const firstOriginIndex = firstItinerary?.waypointIndices[0];
    if (firstOriginIndex !== undefined) {
      const originData = formData.waypoints[firstOriginIndex]?.data;
      if (!originData || originData.trim().length < 10) {
        toast.error("Informe a data de início do Itinerário 1.");
        return;
      }
      const originHora = formData.waypoints[firstOriginIndex]?.hora;
      if (!originHora || originHora.trim().length < 4) {
        toast.error("Informe a hora de início do Itinerário 1.");
        return;
      }
    }

    // Sincroniza a data da OS com a data do primeiro waypoint (fonte de verdade)
    const firstWaypointData = firstItinerary?.waypoints[0]?.data;
    let syncedData = formData.data;

    if (firstWaypointData) {
      if (firstWaypointData.includes("-")) {
        syncedData = firstWaypointData;
      } else if (firstWaypointData.includes("/")) {
        const [d, m, y] = firstWaypointData.split("/");
        if (d && m && y) {
          syncedData = `${y}-${m}-${d}`;
        }
      } else if (firstWaypointData.length === 8) {
        const d = firstWaypointData.slice(0, 2);
        const m = firstWaypointData.slice(2, 4);
        const y = firstWaypointData.slice(4);
        syncedData = `${y}-${m}-${d}`;
      }
    }

    const finalData = {
      ...formData,
      data: syncedData,
      hora: null,
      rota: { waypoints: formData.waypoints },
      isFreelance: !editingOSId && isFreelanceMode,
    };

    // Se estiver editando e nao houver mudancas reais, apenas fecha o modal
    if (editingOSId && originalFormSnapshot) {
      const normalizeForCompare = (v: unknown): unknown => {
        if (Array.isArray(v)) return v.map(normalizeForCompare);
        if (v && typeof v === "object") {
          return Object.fromEntries(
            Object.entries(v as Record<string, unknown>)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, val]) => [k, normalizeForCompare(val)]),
          );
        }
        if (typeof v === "string") return v.trim();
        return v ?? null;
      };
      const isSame =
        JSON.stringify(normalizeForCompare(finalData)) ===
        JSON.stringify(normalizeForCompare(originalFormSnapshot));
      if (isSame) {
        toast.info("Nenhuma alteracao detectada.");
        setIsModalOpen(false);
        setEditingOSId(null);
        setOriginalFormSnapshot(null);
        return;
      }
    }

    setPendingOSData(finalData);

    if (editingOSId) {
      // Editar Atendimento: abre modal perguntando se deseja marcar como concluido
      setShowCompletionConfirm(true);
      return;
    }

    // Novo Atendimento: abre modal de notificação
    setShowNotificationConfirm(true);
  };

  const executeAddOS = async () => {
    if (!pendingOSData) return;
    await executeSaveOS(pendingOSData, editingOSId);
  };

  const executeEditOS = async (markAsCompleted: boolean) => {
    if (!pendingOSData || !editingOSId) return;
    const startedAt = performance.now();
    await executeSaveOS(pendingOSData, editingOSId);
    if (markAsCompleted) {
      setAwaitingStatusOSId(editingOSId);
      try {
        const response = await fetch("/api/os-manual-cycle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            os_id: editingOSId,
            action: "finish_all",
          }),
        });
        console.log(
          `[Perf][OS] executeEditOS finish_all request ${(performance.now() - startedAt).toFixed(0)}ms`,
        );
        const result = await response.json();
        if (!result.success) {
          toast.error(result.error || "Erro ao concluir todos os ciclos.");
          setAwaitingStatusOSId(null);
          return;
        }
        toast.success("Atendimento concluído com sucesso!");

        await syncOSSnapshot(editingOSId);
        setAwaitingStatusOSId(null);
        console.log(
          `[Perf][OS] executeEditOS total ${(performance.now() - startedAt).toFixed(0)}ms`,
        );
      } catch (error) {
        console.error("Erro ao finalizar todos os ciclos:", error);
        toast.error("Erro ao concluir o atendimento. Tente novamente.");
        setAwaitingStatusOSId(null);
        console.log(
          `[Perf][OS] executeEditOS failed ${(performance.now() - startedAt).toFixed(0)}ms`,
        );
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const vBruto = formData.valorBruto ?? 0;
  const vCusto = formData.custo ?? 0;
  const noShowFator = formData.noShow
    ? (formData.noShowPercentual ?? 100) / 100
    : 1;

  // Hora extra sempre conta no cálculo; no-show apenas reduz proporcionalmente o total
  const horaExtraMinutos = parseHoraExtraMinutes(formData.horaExtra);
  const horaExtraBilledMinutes = calcBilledMinutes(horaExtraMinutos);
  const horaExtraClienteValor = calcHoraExtraCliente(horaExtraMinutos);
  const horaExtraMotoristaValor = calcHoraExtraMotorista(horaExtraMinutos);
  const horaExtraBilledLabel = formatBilledHours(horaExtraBilledMinutes);

  const totalEfetivoCliente = vBruto + horaExtraClienteValor;
  const totalEfetivoMotorista = vCusto + horaExtraMotoristaValor;

  const currentBaseCobranca = formData.noShow
    ? totalEfetivoCliente * noShowFator
    : totalEfetivoCliente;
  const repasseEfetivo = formData.noShow
    ? totalEfetivoMotorista * noShowFator
    : totalEfetivoMotorista;
  const currentImposto = currentBaseCobranca * (impostoPercentual / 100);
  const currentLucro = currentBaseCobranca - currentImposto - repasseEfetivo;

  const availableSolicitantes = useMemo(() => {
    if (!formData.clienteId) return [];
    const mergedSolicitantes = [
      ...solicitantes.filter((s) => s.clienteId === formData.clienteId),
      ...quickAddedSolicitantes.filter(
        (s) => s.clienteId === formData.clienteId,
      ),
    ];
    const seenIds = new Set<string>();

    return mergedSolicitantes.filter((item) => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });
  }, [formData.clienteId, solicitantes, quickAddedSolicitantes]);

  const selectedDriverVehicleOptions = useMemo(() => {
    if (!formData.driverId) return [];
    const vehicleIds = new Set(
      driverVehiclesAssoc
        .filter((dv) => dv.driver_id === formData.driverId)
        .map((dv) => dv.vehicle_id),
    );
    return vehicles
      .filter((v) => vehicleIds.has(v.id))
      .map((v) => ({
        id: v.id,
        nome: `${v.marca} ${v.modelo}`,
        plate: v.placa,
      }));
  }, [formData.driverId, driverVehiclesAssoc, vehicles]);

  const availableCentrosCusto = useMemo(() => {
    if (!formData.clienteId) return [];
    const mergedCentrosCusto = [
      ...getCentrosCustoByCliente(formData.clienteId),
      ...quickAddedCentrosCusto.filter(
        (cc) => cc.clienteId === formData.clienteId,
      ),
    ];
    const seenIds = new Set<string>();

    return mergedCentrosCusto.filter((item) => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });
  }, [formData.clienteId, getCentrosCustoByCliente, quickAddedCentrosCusto]);

  const handleClienteChange = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      clienteId: id,
      solicitante: "",
      solicitanteId: "",
      centroCusto: "",
    }));
  };

  const hasActiveAdvancedFilters = useMemo(() => {
    return Object.values(advancedFilters).some((v) => v !== "");
  }, [advancedFilters]);

  const tableItems = osTable.items;
  const tableTotalCount = osTable.totalCount;

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;

    if (name === "horaExtra" || name === "hora") {
      let cleanValue = value.replace(/\D/g, "");
      if (cleanValue.length > 4) cleanValue = cleanValue.slice(0, 4);

      let hours = cleanValue.slice(0, 2);
      let minutes = cleanValue.slice(2, 4);

      if (hours && parseInt(hours) > 23) hours = "23";
      if (minutes && parseInt(minutes) > 59) minutes = "59";

      let formatted = hours;
      if (minutes) {
        formatted = `${hours}:${minutes}`;
      } else if (hours.length === 2 && cleanValue.length > 2) {
        formatted = `${hours}:`;
      }

      setFormData((prev) => ({ ...prev, [name]: formatted }));
      return;
    }

    if (name === "noShow") {
      setFormData((prev) => ({
        ...prev,
        noShow: value === "sim",
        noShowPercentual:
          value === "sim" ? (prev.noShowPercentual ?? 100) : null,
      }));
      return;
    }

    if (name === "noShowPercentual") {
      setFormData((prev) => ({
        ...prev,
        noShowPercentual: value === "" ? null : Number(value),
      }));
      return;
    }

    if (name === "data") {
      // Máscara DD/MM/AAAA
      let cleanValue = value.replace(/\D/g, "");
      if (cleanValue.length > 8) cleanValue = cleanValue.slice(0, 8);

      // Validações de valores
      let day = cleanValue.slice(0, 2);
      let month = cleanValue.slice(2, 4);
      let year = cleanValue.slice(4, 8);

      if (day && parseInt(day) > 31) day = "31";
      if (month && parseInt(month) > 12) month = "12";
      if (year && parseInt(year) > 5000) year = "5000";

      const validatedClean = day + month + year;

      let formatted = validatedClean;
      if (validatedClean.length > 2)
        formatted = `${validatedClean.slice(0, 2)}/${validatedClean.slice(2)}`;
      if (validatedClean.length > 4)
        formatted = `${validatedClean.slice(0, 2)}/${validatedClean.slice(2, 4)}/${validatedClean.slice(4)}`;

      if (validatedClean.length === 8) {
        const d = validatedClean.slice(0, 2);
        const m = validatedClean.slice(2, 4);
        const y = validatedClean.slice(4);
        setFormData((prev) => ({ ...prev, data: `${y}-${m}-${d}` }));
      } else {
        setFormData((prev) => ({ ...prev, data: formatted }));
      }
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "valorBruto" || name === "custo"
          ? value === ""
            ? null
            : parseFloat(value)
          : value,
    }));
  };

  const getStatusConfig = (status: string, arquivado?: boolean) => {
    if (arquivado) {
      return {
        icon: <Archive size={20} className="text-red-400" />,
        bg: "bg-red-50/50",
        border: "border-red-100",
        accent: "bg-red-400",
        shadow: "shadow-red-200",
        text: "text-red-400",
        label: "Arquivado",
      };
    }
    switch (status) {
      case "Pendente":
        return {
          icon: <Clock size={20} />,
          bg: "bg-slate-50/50",
          border: "border-slate-100",
          accent: "bg-slate-500",
          shadow: "shadow-slate-200",
          text: "text-slate-700",
          label: "Pendente",
        };
      case "Aguardando":
        return {
          icon: <Clock size={20} />,
          bg: "bg-indigo-50/50",
          border: "border-indigo-100",
          accent: "bg-indigo-500",
          shadow: "shadow-indigo-200",
          text: "text-indigo-700",
          label: "Aguardando",
        };
      case "Em Rota":
        return {
          icon: <Navigation size={20} />,
          bg: "bg-blue-50/50",
          border: "border-blue-100",
          accent: "bg-blue-500",
          shadow: "shadow-blue-200",
          text: "text-blue-700",
          label: "Em Rota",
        };
      case "Finalizado":
        return {
          icon: <CheckCircle2 size={20} />,
          bg: "bg-emerald-50/50",
          border: "border-emerald-100",
          accent: "bg-emerald-500",
          shadow: "shadow-emerald-200",
          text: "text-emerald-700",
          label: "Finalizado",
        };
      case "Cancelado":
        return {
          icon: <X size={20} />,
          bg: "bg-rose-50/50",
          border: "border-rose-100",
          accent: "bg-rose-500",
          shadow: "shadow-rose-200",
          text: "text-rose-700",
          label: "Cancelado",
        };
      default:
        return {
          icon: <FileText size={20} />,
          bg: "bg-slate-50/50",
          border: "border-slate-100",
          accent: "bg-slate-500",
          shadow: "shadow-slate-200",
          text: "text-slate-700",
          label: "N/A",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Operational Stats */}
      {!showArchivedOnly && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <OpStatCard
            label="Pendentes"
            value={osCounts["Pendente"]}
            icon={<Clock className="text-slate-500" size={20} />}
          />
          <OpStatCard
            label="Aguardando"
            value={osCounts["Aguardando"]}
            icon={<Clock className="text-indigo-500" size={20} />}
          />
          <OpStatCard
            label="Em Rota"
            value={osCounts["Em Rota"]}
            icon={<Navigation className="text-blue-500" size={20} />}
          />
          <OpStatCard
            label="Finalizados"
            value={osCounts["Finalizado"]}
            icon={<CheckCircle2 className="text-emerald-500" size={20} />}
          />
        </div>
      )}

      {/* Header com Toggle e Botão Nova OS */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Campo de busca (sempre visível) */}
          <div className="relative group flex-1">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
            <input
              type="text"
              placeholder="Pesquisar por Motorista ou OS..."
              className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 font-bold text-sm transition-all"
              value={osTable.searchTerm}
              onChange={(e) => osTable.setSearchTerm(e.target.value)}
            />
          </div>

          {/* Toggle Tabela/Calendário */}
          <div
            className={`flex items-center bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm shrink-0 ${viewMode === "calendar" ? "md:ml-0" : ""}`}
          >
            <button
              onClick={() => {
                logInfo("OS/ViewMode", "Mudou para visualização em tabela");
                setViewMode("table");
              }}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <LayoutGrid size={16} strokeWidth={2.5} />
              Tabela
            </button>
            <button
              onClick={() => {
                logInfo("OS/ViewMode", "Mudou para visualização em calendário");
                setViewMode("calendar");
              }}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all cursor-pointer ${
                viewMode === "calendar"
                  ? "bg-[var(--color-geolog-blue)] text-white shadow-md"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <CalendarDays size={16} strokeWidth={2.5} />
              Calendário
            </button>
          </div>

          {/* Filtro OS/Docagem/Todos */}
          <div className="group flex items-center bg-white border border-slate-200 rounded-2xl py-1.5 px-0 group-hover:pl-2.5 group-hover:pr-1.5 ml-0 group-hover:ml-4 shadow-sm shrink-0 overflow-hidden transition-all duration-300 ease-out">
            <ChevronRight
              className="text-slate-400 shrink-0 transition-all duration-300 ease-out group-hover:max-w-0 group-hover:opacity-0 group-hover:ml-0 group-hover:mr-0 group-hover:rotate-0 max-w-4 ml-2.5 mr-2.5 rotate-180 overflow-hidden"
              size={14}
              strokeWidth={2.5}
            />
            <button
              onClick={() => {
                setShowArchivedOnly(false);
                setDocagemListFilter("all");
              }}
              className={`flex items-center gap-2 rounded-xl font-bold text-xs uppercase tracking-widest cursor-pointer whitespace-nowrap overflow-hidden transition-all duration-300 ease-out group-hover:ml-[5px] ${
                docagemListFilter === "all" && !showArchivedOnly
                  ? "px-3.5 py-2.5 mr-1.5 max-w-[120px] opacity-100 bg-slate-800 text-white shadow-md"
                  : "max-w-0 opacity-0 px-0 py-0 pointer-events-none group-hover:px-3.5 group-hover:py-2.5 group-hover:mr-0 group-hover:max-w-[120px] group-hover:opacity-100 group-hover:pointer-events-auto text-slate-300 group-hover:text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Layers
                className={`${
                  docagemListFilter === "all" && !showArchivedOnly
                    ? "text-white"
                    : "text-slate-500"
                }`}
                size={16}
                strokeWidth={2.5}
              />
              Todos
            </button>
            <button
              onClick={() => {
                setShowArchivedOnly(false);
                setDocagemListFilter("os");
              }}
              className={`flex items-center gap-2 rounded-xl font-bold text-xs uppercase tracking-widest cursor-pointer whitespace-nowrap overflow-hidden transition-all duration-300 ease-out ${
                docagemListFilter === "os" && !showArchivedOnly
                  ? "px-3.5 py-2.5 mr-1.5 max-w-[120px] opacity-100 bg-blue-500 text-white shadow-md"
                  : "max-w-0 opacity-0 px-0 py-0 pointer-events-none group-hover:px-3.5 group-hover:py-2.5 group-hover:mr-0 group-hover:max-w-[120px] group-hover:opacity-100 group-hover:pointer-events-auto text-slate-300 group-hover:text-slate-500 hover:bg-blue-50"
              }`}
            >
              <Truck
                className={`${
                  docagemListFilter === "os" && !showArchivedOnly
                    ? "text-white"
                    : "text-blue-500"
                }`}
                size={16}
                strokeWidth={2.5}
              />
              OS
            </button>
            <button
              onClick={() => {
                setShowArchivedOnly(false);
                setDocagemListFilter("docagem");
              }}
              className={`flex items-center gap-2 rounded-xl font-bold text-xs uppercase tracking-widest cursor-pointer whitespace-nowrap overflow-hidden transition-all duration-300 ease-out ${
                docagemListFilter === "docagem" && !showArchivedOnly
                  ? "px-3.5 py-2.5 mr-1.5 max-w-[140px] opacity-100 bg-violet-600 text-white shadow-md"
                  : "max-w-0 opacity-0 px-0 py-0 pointer-events-none group-hover:px-3.5 group-hover:py-2.5 group-hover:mr-0 group-hover:max-w-[140px] group-hover:opacity-100 group-hover:pointer-events-auto text-slate-300 group-hover:text-slate-500 hover:bg-violet-50"
              }`}
            >
              <Package
                className={`${
                  docagemListFilter === "docagem" && !showArchivedOnly
                    ? "text-white"
                    : "text-violet-500"
                }`}
                size={16}
                strokeWidth={2.5}
              />
              Docagem
            </button>
            <button
              onClick={() => {
                setShowArchivedOnly(false);
                setDocagemListFilter("rascunho");
              }}
              className={`flex items-center gap-2 rounded-xl font-bold text-xs uppercase tracking-widest cursor-pointer whitespace-nowrap overflow-hidden transition-all duration-300 ease-out ${
                docagemListFilter === "rascunho" && !showArchivedOnly
                  ? "px-3.5 py-2.5 mr-1.5 max-w-[140px] opacity-100 bg-amber-500 text-white shadow-md"
                  : "max-w-0 opacity-0 px-0 py-0 pointer-events-none group-hover:px-3.5 group-hover:py-2.5 group-hover:mr-0 group-hover:max-w-[140px] group-hover:opacity-100 group-hover:pointer-events-auto text-slate-300 group-hover:text-slate-500 hover:bg-amber-50"
              }`}
            >
              <FileText
                className={`${
                  docagemListFilter === "rascunho" && !showArchivedOnly
                    ? "text-white"
                    : "text-amber-500"
                }`}
                size={16}
                strokeWidth={2.5}
              />
              Rascunho
            </button>
            <button
              onClick={() => {
                setIsArchivedFilterLoading(true);
                setShowArchivedOnly((prev) => !prev);
              }}
              className={`flex items-center gap-2 rounded-xl font-bold text-xs uppercase tracking-widest cursor-pointer whitespace-nowrap overflow-hidden transition-all duration-300 ease-out ${
                showArchivedOnly
                  ? "px-3.5 py-2.5 mr-1.5 max-w-[140px] opacity-100 text-white shadow-md"
                  : "max-w-0 opacity-0 px-0 py-0 pointer-events-none group-hover:px-3.5 group-hover:py-2.5 group-hover:mr-1.5 group-hover:max-w-[140px] group-hover:opacity-100 group-hover:pointer-events-auto text-slate-300 group-hover:text-slate-500 hover:bg-red-50"
              }`}
              style={
                showArchivedOnly
                  ? { backgroundColor: "rgba(255, 133, 139, 1)" }
                  : undefined
              }
            >
              <Archive
                className={showArchivedOnly ? "text-white" : "text-red-500"}
                size={16}
                strokeWidth={2.5}
              />
              Arquivados
            </button>
          </div>

          {/* Botão Filtros Avançados */}
          <button
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            aria-label="Filtros"
            title="Filtros"
            className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm border cursor-pointer shrink-0 ${
              hasActiveAdvancedFilters || showAdvancedFilters
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {hasActiveAdvancedFilters ? (
              <Filter size={16} />
            ) : (
              <FilterX size={16} />
            )}
            {hasActiveAdvancedFilters && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 bg-blue-600 text-white text-[10px] font-black rounded-full">
                {Object.values(advancedFilters).filter((v) => v !== "").length}
              </span>
            )}
          </button>

          {/* Botão Novo Atendimento */}
          <button
            onClick={() => setIsAttendanceChoiceModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-[var(--color-geolog-blue)] text-white px-7 py-3.5 rounded-2xl font-black shadow-lg shadow-blue-900/10 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-widest shrink-0 w-full md:w-auto cursor-pointer whitespace-nowrap"
          >
            <Plus size={18} strokeWidth={3} />
            Novo Atendimento
          </button>
        </div>
      </div>

      {/* Painel de Filtros Avançados */}
      {showAdvancedFilters && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-600">
              Filtros Avançados
            </h3>
            {hasActiveAdvancedFilters && (
              <button
                onClick={() => setAdvancedFilters(defaultAdvancedFilters)}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* OS */}
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                Número OS
              </label>
              <input
                type="text"
                value={advancedFilters.osNumber}
                onChange={(e) =>
                  setAdvancedFilters((prev) => ({
                    ...prev,
                    osNumber: e.target.value,
                  }))
                }
                placeholder="Ex: 00123"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
              />
            </div>
            {/* Empresa */}
            <GeologSearchableSelect
              label="Empresa"
              options={[
                { id: "", nome: "Todas" },
                ...clientes.map((c) => ({ id: c.id, nome: c.nome })),
              ]}
              value={advancedFilters.clienteId}
              onChange={(id) =>
                setAdvancedFilters((prev) => ({
                  ...prev,
                  clienteId: id,
                  centroCustoId: "",
                }))
              }
              triggerClassName="px-4 py-3 text-base"
              disableSearch={false}
            />
            {/* Centro de Custo */}
            <GeologSearchableSelect
              label="Centro de Custo"
              options={[
                { id: "", nome: "Todos" },
                ...(advancedFilters.clienteId
                  ? getCentrosCustoByCliente(advancedFilters.clienteId)
                  : []
                ).map((cc) => ({ id: cc.id, nome: cc.nome })),
              ]}
              value={advancedFilters.centroCustoId}
              onChange={(id) =>
                setAdvancedFilters((prev) => ({ ...prev, centroCustoId: id }))
              }
              disabled={!advancedFilters.clienteId}
              triggerClassName="px-4 py-3 text-base"
              disableSearch={false}
            />
            {/* Solicitante */}
            <GeologSearchableSelect
              label="Solicitante"
              options={[
                { id: "", nome: "Todos" },
                ...solicitantes
                  .filter(
                    (s) =>
                      !advancedFilters.clienteId ||
                      s.clienteId === advancedFilters.clienteId,
                  )
                  .map((s) => ({ id: s.nome, nome: s.nome })),
              ]}
              value={advancedFilters.solicitante}
              onChange={(id) =>
                setAdvancedFilters((prev) => ({ ...prev, solicitante: id }))
              }
              triggerClassName="px-4 py-3 text-base"
              disableSearch={false}
            />
            {/* Motorista */}
            <GeologSearchableSelect
              label="Motorista"
              options={[
                { id: "", nome: "Todos" },
                ...drivers.map((d) => ({ id: d.id, nome: d.name })),
              ]}
              value={advancedFilters.driverId}
              onChange={(id) =>
                setAdvancedFilters((prev) => ({ ...prev, driverId: id }))
              }
              triggerClassName="px-4 py-3 text-base"
              disableSearch={false}
            />
            {/* Veículo */}
            <GeologSearchableSelect
              label="Veículo"
              options={[
                { id: "", nome: "Todos" },
                ...vehicles.map((v) => ({
                  id: v.id,
                  nome: `${v.marca} ${v.modelo} — ${v.placa}`,
                })),
              ]}
              value={advancedFilters.veiculoId}
              onChange={(id) =>
                setAdvancedFilters((prev) => ({ ...prev, veiculoId: id }))
              }
              triggerClassName="px-4 py-3 text-base"
              disableSearch={false}
            />
            {/* Passageiro */}
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                Passageiro
              </label>
              <input
                type="text"
                value={advancedFilters.passageiro}
                onChange={(e) =>
                  setAdvancedFilters((prev) => ({
                    ...prev,
                    passageiro: e.target.value,
                  }))
                }
                placeholder="Nome do passageiro..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
              />
            </div>
            {/* Data Início */}
            <GeologDateInput
              label="Data Início"
              value={advancedFilters.dataInicio}
              onChange={(value) =>
                setAdvancedFilters((prev) => ({
                  ...prev,
                  dataInicio: value,
                }))
              }
            />
            {/* Data Fim */}
            <GeologDateInput
              label="Data Fim"
              value={advancedFilters.dataFim}
              onChange={(value) =>
                setAdvancedFilters((prev) => ({
                  ...prev,
                  dataFim: value,
                }))
              }
            />
            {/* Status Operacional */}
            <GeologSearchableSelect
              label="Status Operacional"
              options={[
                { id: "", nome: "Todos" },
                { id: "Pendente", nome: "Pendente" },
                { id: "Aguardando", nome: "Aguardando" },
                { id: "Em Rota", nome: "Em Rota" },
                { id: "Finalizado", nome: "Finalizado" },
                { id: "Cancelado", nome: "Cancelado" },
              ]}
              value={advancedFilters.statusOperacional}
              onChange={(id) =>
                setAdvancedFilters((prev) => ({
                  ...prev,
                  statusOperacional: id as AdvancedFilters["statusOperacional"],
                }))
              }
              triggerClassName="px-4 py-3 text-base"
              disableSearch={false}
            />
            {/* Cadastro feito por */}
            <GeologSearchableSelect
              label="Cadastro feito por"
              options={[
                { id: "", nome: "Todos" },
                ...users.map((u) => ({ id: u.id, nome: u.nome })),
              ]}
              value={advancedFilters.createdBy}
              onChange={(id) =>
                setAdvancedFilters((prev) => ({
                  ...prev,
                  createdBy: id,
                }))
              }
              triggerClassName="px-4 py-3 text-base"
              disableSearch={false}
            />
          </div>
        </div>
      )}

      {/* Loader do filtro de arquivados */}
      {isArchivedFilterLoading && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 p-16 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-slate-400">
            <Loader2 size={48} className="text-blue-500 animate-spin" />
            <p className="font-bold text-lg text-slate-500">
              Carregando ordens de serviço...
            </p>
          </div>
        </div>
      )}

      {/* Conteúdo: Tabela ou Calendário */}
      {!isArchivedFilterLoading && (
        <>
          {viewMode === "table" && docagemListFilter === "docagem" ? (
            <DataTable
              data={docagemList}
              loading={docagemListLoading}
              disableClientSearch
              columns={[
                {
                  key: "cliente",
                  title: "Cliente",
                  render: (_value: unknown, item: DocagemSummary) => {
                    const cliente = clientes.find(
                      (c) => c.id === item.clienteId,
                    );
                    return (
                      <div className="space-y-1">
                        <p className="font-black text-base text-slate-800 tracking-tight">
                          {cliente?.nome || "N/A"}
                        </p>
                        <p className="text-sm font-bold text-slate-500">
                          {item.endereco}
                        </p>
                      </div>
                    );
                  },
                },
                {
                  key: "periodo",
                  title: "Período",
                  align: "center",
                  render: (_value: unknown, item: DocagemSummary) => (
                    <div className="text-sm font-bold text-slate-700">
                      {item.dataInicio} até {item.dataFim}
                    </div>
                  ),
                },
                {
                  key: "horario",
                  title: "Horário",
                  align: "center",
                  render: (_value: unknown, item: DocagemSummary) => (
                    <div className="text-sm font-bold text-slate-700">
                      {item.horarioInicio} às {item.horarioFim}
                    </div>
                  ),
                },
                {
                  key: "dias",
                  title: "Dias",
                  align: "center",
                  render: (_value: unknown, item: DocagemSummary) => {
                    const labels = [
                      "Dom",
                      "Seg",
                      "Ter",
                      "Qua",
                      "Qui",
                      "Sex",
                      "Sáb",
                    ];
                    const dias = item.diasSemana
                      .map((d) => labels[d === 7 ? 0 : d])
                      .join(", ");
                    return (
                      <div className="text-sm font-bold text-slate-700">
                        {dias}
                      </div>
                    );
                  },
                },
                {
                  key: "valor",
                  title: "Valor Diário",
                  align: "right",
                  render: (_value: unknown, item: DocagemSummary) => (
                    <div className="text-sm font-black text-slate-800">
                      R$ {item.valorDiario.toFixed(2)}
                    </div>
                  ),
                },
                {
                  key: "acoes",
                  title: "Ações",
                  align: "center",
                  render: (_value: unknown, item: DocagemSummary) => (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => {
                          setDocagemList((prev) =>
                            prev.filter((d) => d.id !== item.id),
                          );
                          void cancelarDocagem(item.id).then(() => {
                            toast.success("Docagem cancelada.");
                            if (calendarRangeRef.current) {
                              void handleCalendarRangeChange(
                                calendarRangeRef.current.from,
                                calendarRangeRef.current.to,
                                true,
                              );
                            }
                          });
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Cancelar docagem"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ),
                },
              ]}
              searchPlaceholder=""
              emptyMessage="Nenhuma docagem encontrada."
              emptyIcon={<Package size={48} />}
              showHeader={false}
            />
          ) : viewMode === "table" && docagemListFilter === "rascunho" ? (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 p-16 flex flex-col items-center justify-center text-center">
              <FileText size={48} className="text-slate-300 mb-4" />
              <p className="text-base font-black text-slate-700">
                Filtro de rascunhos em desenvolvimento.
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-400">
                Em breve será possível visualizar e gerenciar os rascunhos de
                atendimento.
              </p>
            </div>
          ) : viewMode === "table" ? (
            <DataTable
              data={tableItems}
              loading={osTable.loading}
              disableClientSearch
              pagination={{
                page: osTable.page,
                pageSize: osTable.pageSize,
                totalItems: tableTotalCount,
                onPageChange: osTable.setPage,
              }}
              columns={[
                {
                  key: "protocolo",
                  title: "Protocolo",
                  render: (value: unknown, item: OrderService) => {
                    void value;

                    // Fonte de verdade: data/hora do primeiro waypoint; fallback para item.data/item.hora (legacy)
                    const waypoints = item.rota?.waypoints || [];
                    const firstWp = waypoints[0];
                    const displayDate = firstWp?.data || item.data;
                    const displayHora = firstWp?.hora || item.hora;

                    return (
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-black text-base text-slate-800 tracking-tight">
                            {item.protocolo}
                          </p>
                          {item.isFreelance && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                              Freelance
                            </span>
                          )}
                        </div>
                        <p
                          className="text-sm font-semibold"
                          style={{ color: "rgb(97, 130, 209)" }}
                        >
                          {displayDate.split("-").reverse().join("/")}
                          {displayHora && (
                            <span className="ml-1 text-slate-500">
                              · {displayHora.slice(0, 5)}
                            </span>
                          )}
                        </p>
                      </div>
                    );
                  },
                },
                {
                  key: "os",
                  title: "OS",
                  render: (value: unknown, item: OrderService) => {
                    void value;

                    return (
                      <p className="font-black text-base text-slate-700">
                        {item.os || "—"}
                      </p>
                    );
                  },
                },
                {
                  key: "cliente",
                  title: "Cliente",
                  width: "380px",
                  render: (value: unknown, item: OrderService) => {
                    void value;

                    const clienteNome =
                      clientes.find((c) => c.id === item.clienteId)?.nome ||
                      "N/A";
                    return (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                          <Building size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-700">
                            {clienteNome}
                          </p>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  key: "itinerario",
                  title: "Itinerário",
                  width: "200px",
                  render: (value: unknown, item: OrderService) => {
                    void value;
                    const waypointCount =
                      item.rota?.waypoints?.filter(
                        (waypoint) => waypoint.label.trim() !== "",
                      ).length ?? 0;
                    const stopCount = waypointCount > 1 ? waypointCount - 2 : 0;
                    const displayCount = waypointCount > 0 ? waypointCount : 1;

                    return (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-lg">
                          <Navigation size={13} className="text-blue-600" />
                          <span className="text-sm font-extrabold text-blue-700">
                            {displayCount}
                          </span>
                        </div>
                        <span className="text-base font-medium text-slate-500">
                          {waypointCount <= 1
                            ? "Direto"
                            : stopCount === 1
                              ? "1 parada"
                              : `${stopCount} paradas`}
                        </span>
                      </div>
                    );
                  },
                },
                {
                  key: "passageiros",
                  title: "Passageiros",
                  width: "120px",
                  align: "center",
                  render: (value: unknown, item: OrderService) => {
                    void value;
                    const passengerCount =
                      item.rota?.waypoints?.reduce((total, waypoint) => {
                        return total + (waypoint.passengers?.length ?? 0);
                      }, 0) ?? 0;

                    return (
                      <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100">
                        <Users size={14} className="text-emerald-600" />
                        <span className="text-sm font-bold text-emerald-700">
                          {passengerCount}
                        </span>
                      </div>
                    );
                  },
                },
                {
                  key: "motorista",
                  title: "Motorista",
                  width: "250px",
                  render: (value: unknown, item: OrderService) => {
                    void value;

                    const motoristaNomeAtual = item.driverId
                      ? drivers.find((d) => d.id === item.driverId)?.name ||
                        item.motorista
                      : item.motorista;
                    const motoristaParts = String(motoristaNomeAtual)
                      .trim()
                      .split(/\s+/)
                      .filter(Boolean);
                    const motoristaNomeCurto =
                      motoristaParts.length > 1
                        ? `${motoristaParts[0]} ${motoristaParts[1]}`
                        : motoristaParts[0] || "—";

                    return (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                          <Truck className="text-slate-400" size={16} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-base">
                            {motoristaNomeCurto}
                          </p>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  key: "status",
                  title: showArchivedOnly ? "" : "Status",
                  align: "center",
                  width: "140px",
                  render: (value: unknown, item: OrderService) => {
                    void value;

                    if (showArchivedOnly) {
                      return (
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs md:text-sm font-bold uppercase tracking-wide border bg-red-50/50 border-red-100 text-red-400">
                          <Archive size={20} className="text-red-400" />
                          Arquivado
                        </span>
                      );
                    }

                    const config = getStatusConfig(
                      getOperationalStatusForOS(item),
                      item.arquivado,
                    );
                    return (
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs md:text-sm font-bold uppercase tracking-wide border ${config.bg} ${config.border} ${config.text}`}
                      >
                        {config.icon}
                        {config.label}
                      </span>
                    );
                  },
                },
                {
                  key: "acoes",
                  title: "Ações",
                  align: "center",
                  render: (value: unknown, item: OrderService) => {
                    void value;

                    return (
                      <div
                        className="relative inline-block"
                        ref={(el) => {
                          if (el) {
                            actionMenuRefs.current[item.id] = el;
                          } else {
                            delete actionMenuRefs.current[item.id];
                          }
                        }}
                      >
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenActionMenuId((prev) =>
                              prev === item.id ? null : item.id,
                            );
                          }}
                          className="inline-flex items-center justify-center w-10 h-10 rounded-2xl border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm cursor-pointer"
                          aria-haspopup="true"
                          aria-expanded={openActionMenuId === item.id}
                        >
                          <MoreVertical size={18} />
                        </button>
                        {openActionMenuId === item.id &&
                          (() => {
                            const rect =
                              actionMenuRefs.current[
                                item.id
                              ]?.getBoundingClientRect();
                            if (!rect) return null;
                            const menuHeight = 240; // Altura aproximada do menu
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const shouldOpenUp = spaceBelow < menuHeight + 16;
                            return (
                              <div
                                className="fixed min-w-[200px] bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 space-y-1 z-[9999]"
                                style={{
                                  top: shouldOpenUp
                                    ? rect.top - menuHeight - 8
                                    : rect.bottom + 8,
                                  right: window.innerWidth - rect.right,
                                }}
                              >
                                <button
                                  onClick={() => handleViewOS(item.id)}
                                  className="group w-full px-4 py-2 text-left text-sm font-bold text-slate-700 rounded-xl hover:bg-cyan-50 hover:text-cyan-600 flex items-center gap-3 cursor-pointer"
                                >
                                  <Eye
                                    size={16}
                                    className="text-slate-400 group-hover:text-cyan-600"
                                  />
                                  Visualizar
                                </button>
                                {!item.arquivado && (
                                  <button
                                    onClick={() => handleEditOS(item.id)}
                                    className="group w-full px-4 py-2 text-left text-sm font-bold text-slate-700 rounded-xl hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 cursor-pointer"
                                  >
                                    <Pencil
                                      size={16}
                                      className="text-slate-400 group-hover:text-blue-600"
                                    />
                                    Editar
                                  </button>
                                )}
                                {item.arquivado && (
                                  <button
                                    onClick={() => handleReopenOS(item.id)}
                                    className="group w-full px-4 py-2 text-left text-sm font-bold text-slate-700 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-3 cursor-pointer"
                                  >
                                    <RotateCcw
                                      size={16}
                                      className="text-slate-400 group-hover:text-emerald-600"
                                    />
                                    Reabrir
                                  </button>
                                )}
                                {!item.arquivado &&
                                  item.status.operacional !== "Finalizado" && (
                                    <button
                                      onClick={() => handleFinishOS(item.id)}
                                      className="group w-full px-4 py-2 text-left text-sm font-bold text-emerald-600 hover:text-emerald-700 rounded-xl bg-emerald-50 hover:bg-emerald-100 flex items-center gap-3 cursor-pointer"
                                    >
                                      <CheckCircle2
                                        size={16}
                                        className="text-emerald-600 group-hover:text-emerald-700"
                                      />
                                      Finalizar
                                    </button>
                                  )}
                                {!item.arquivado && (
                                  <button
                                    onClick={() => handleDeleteOS(item.id)}
                                    className="group w-full px-4 py-2 text-left text-sm font-bold rounded-xl bg-rose-50 hover:bg-rose-100 flex items-center gap-3 cursor-pointer"
                                    style={{ color: "rgb(219, 132, 153)" }}
                                  >
                                    <XOctagon
                                      size={16}
                                      style={{ color: "rgb(219, 132, 153)" }}
                                    />
                                    Arquivar
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                      </div>
                    );
                  },
                },
              ]}
              searchPlaceholder=""
              emptyMessage="Nenhuma OS encontrada."
              emptyIcon={<Truck size={48} />}
              showHeader={false}
            />
          ) : (
            <>
              <OSCalendar
                osList={filteredCalendarOSList}
                docagemInstances={filteredCalendarDocagemInstances}
                clientes={clientes}
                drivers={drivers}
                loading={calendarLoading}
                hasLoaded={calendarHasLoaded}
                showArchivedOnly={showArchivedOnly}
                onRangeChange={handleCalendarRangeChange}
                onEventClick={(
                  osId: string,
                  position?: { x: number; y: number },
                ) => {
                  setOpenActionMenuId(osId);
                  setCalendarMenuPosition(position || null);
                }}
                onDocagemEventClick={(
                  instanceId: string,
                  position?: { x: number; y: number },
                ) => {
                  setDocagemMenuTarget({
                    id: instanceId,
                    position: position || { x: 0, y: 0 },
                  });
                }}
              />

              {/* Menu de Ações para o Calendário */}
              {viewMode === "calendar" &&
                openActionMenuId &&
                calendarMenuPosition &&
                (() => {
                  const osId = openActionMenuId;
                  const os = filteredCalendarOSList.find((o) => o.id === osId);
                  const isArchived = os?.arquivado ?? false;
                  const menuHeight = 240;
                  const spaceBelow =
                    window.innerHeight - calendarMenuPosition.y;
                  const shouldOpenUp = spaceBelow < menuHeight + 16;
                  return (
                    <div
                      ref={calendarMenuRef}
                      className="fixed min-w-[200px] bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 space-y-1 z-[9999]"
                      style={{
                        top: shouldOpenUp
                          ? calendarMenuPosition.y - menuHeight - 8
                          : calendarMenuPosition.y + 8,
                        left: calendarMenuPosition.x,
                      }}
                    >
                      <button
                        onClick={() => {
                          handleViewOS(osId);
                          setCalendarMenuPosition(null);
                        }}
                        className="group w-full px-4 py-2 text-left text-sm font-bold text-slate-700 rounded-xl hover:bg-cyan-50 hover:text-cyan-600 flex items-center gap-3 cursor-pointer"
                      >
                        <Eye
                          size={16}
                          className="text-slate-400 group-hover:text-cyan-600"
                        />
                        Visualizar
                      </button>
                      {!isArchived && (
                        <button
                          onClick={() => {
                            handleEditOS(osId);
                            setCalendarMenuPosition(null);
                          }}
                          className="group w-full px-4 py-2 text-left text-sm font-bold text-slate-700 rounded-xl hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 cursor-pointer"
                        >
                          <Pencil
                            size={16}
                            className="text-slate-400 group-hover:text-blue-600"
                          />
                          Editar
                        </button>
                      )}
                      {isArchived && (
                        <button
                          onClick={() => {
                            handleReopenOS(osId);
                            setCalendarMenuPosition(null);
                          }}
                          className="group w-full px-4 py-2 text-left text-sm font-bold text-slate-700 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-3 cursor-pointer"
                        >
                          <RotateCcw
                            size={16}
                            className="text-slate-400 group-hover:text-emerald-600"
                          />
                          Reabrir
                        </button>
                      )}
                      {!isArchived &&
                        os?.status.operacional !== "Finalizado" && (
                          <button
                            onClick={() => {
                              handleFinishOS(osId);
                              setCalendarMenuPosition(null);
                            }}
                            className="group w-full px-4 py-2 text-left text-sm font-bold text-emerald-600 hover:text-emerald-700 rounded-xl bg-emerald-50 hover:bg-emerald-100 flex items-center gap-3 cursor-pointer"
                          >
                            <CheckCircle2
                              size={16}
                              className="text-emerald-600 group-hover:text-emerald-700"
                            />
                            Finalizar
                          </button>
                        )}
                      {!isArchived && (
                        <button
                          onClick={() => {
                            handleDeleteOS(osId);
                            setCalendarMenuPosition(null);
                          }}
                          className="group w-full px-4 py-2 text-left text-sm font-bold rounded-xl bg-rose-50 hover:bg-rose-100 flex items-center gap-3 cursor-pointer"
                          style={{ color: "rgb(219, 132, 153)" }}
                        >
                          <XOctagon
                            size={16}
                            style={{ color: "rgb(219, 132, 153)" }}
                          />
                          Arquivar
                        </button>
                      )}
                    </div>
                  );
                })()}

              {/* Menu de Ações para Docagem */}
              {viewMode === "calendar" &&
                docagemMenuTarget &&
                (() => {
                  const instance = docagemInstances.find(
                    (d) => d.id === docagemMenuTarget.id,
                  );
                  if (!instance) return null;
                  const menuHeight = 360;
                  const spaceBelow =
                    window.innerHeight - docagemMenuTarget.position.y;
                  const shouldOpenUp = spaceBelow < menuHeight + 16;
                  return (
                    <div
                      ref={docagemMenuRef}
                      className="fixed min-w-[220px] bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 space-y-1 z-[9999]"
                      style={{
                        top: shouldOpenUp
                          ? docagemMenuTarget.position.y - menuHeight - 8
                          : docagemMenuTarget.position.y + 8,
                        left: docagemMenuTarget.position.x,
                      }}
                    >
                      <button
                        onClick={() => {
                          setViewingDocagemInstance(instance);
                          setDocagemMenuTarget(null);
                        }}
                        className="group w-full px-4 py-2 text-left text-sm font-bold text-slate-700 hover:text-blue-600 rounded-xl hover:bg-blue-50 flex items-center gap-3 cursor-pointer"
                      >
                        <Eye
                          size={16}
                          className="text-slate-400 group-hover:text-blue-600"
                        />
                        Visualizar
                      </button>
                      <button
                        onClick={() => {
                          setEditingDocagemInstance(instance);
                          setDocagemMenuTarget(null);
                        }}
                        className="group w-full px-4 py-2 text-left text-sm font-bold text-slate-700 hover:text-blue-600 rounded-xl hover:bg-blue-50 flex items-center gap-3 cursor-pointer"
                      >
                        <Pencil
                          size={16}
                          className="text-slate-400 group-hover:text-blue-600"
                        />
                        Editar dia
                      </button>
                      <button
                        onClick={async () => {
                          setDocagemMenuTarget(null);
                          try {
                            const docagem = await fetchDocagemById(
                              instance.docagemId,
                            );
                            if (!docagem) {
                              toast.error("Docagem não encontrada.");
                              return;
                            }
                            setEditingDocagemId(docagem.id);
                            setEditingDocagemData({
                              clienteId: docagem.clienteId,
                              centroCustoId: docagem.centroCustoId,
                              solicitanteId: docagem.solicitanteId,
                              motoristaId: docagem.motoristaId,
                              veiculoId: docagem.veiculoId,
                              endereco: docagem.endereco,
                              dataInicio: docagem.dataInicio,
                              dataFim: docagem.dataFim,
                              horarioInicio: docagem.horarioInicio,
                              horarioFim: docagem.horarioFim,
                              diasSemana: docagem.diasSemana,
                              valorDiario: docagem.valorDiario,
                              custoDiario: docagem.custoDiario,
                              observacao: docagem.observacao,
                            });
                          } catch (err) {
                            console.error(err);
                            toast.error(
                              err instanceof Error
                                ? err.message
                                : "Erro ao carregar docagem.",
                            );
                          }
                        }}
                        className="group w-full px-4 py-2 text-left text-sm font-bold text-slate-700 hover:text-violet-600 rounded-xl hover:bg-violet-50 flex items-center gap-3 cursor-pointer"
                      >
                        <Package
                          size={16}
                          className="text-slate-400 group-hover:text-violet-600"
                        />
                        Editar docagem
                      </button>
                      <div className="my-1 border-t border-slate-100" />
                      {instance.status === "pendente" && (
                        <button
                          onClick={async () => {
                            try {
                              await finalizarDocagemDia(instance.id);
                              toast.success("Dia de docagem finalizado.");
                              setDocagemMenuTarget(null);
                              // Recarregar calendário
                              if (calendarRangeRef.current) {
                                void handleCalendarRangeChange(
                                  calendarRangeRef.current.from,
                                  calendarRangeRef.current.to,
                                  true,
                                );
                              }
                            } catch (err) {
                              console.error(err);
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : "Erro ao finalizar dia de docagem.",
                              );
                            }
                          }}
                          className="group w-full px-4 py-2 text-left text-sm font-bold text-emerald-600 hover:text-emerald-700 rounded-xl bg-emerald-50 hover:bg-emerald-100 flex items-center gap-3 cursor-pointer"
                        >
                          <CheckCircle2
                            size={16}
                            className="text-emerald-600"
                          />
                          Finalizar dia
                        </button>
                      )}
                      {instance.status === "finalizada" && (
                        <>
                          <div className="px-4 py-2 text-sm font-bold text-slate-500 flex items-center gap-3">
                            <CheckCircle2
                              size={16}
                              className="text-emerald-600"
                            />
                            Finalizado
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                await resetarDocagemDia(instance.id);
                                toast.success(
                                  "Dia de docagem resetado para pendente.",
                                );
                                setDocagemMenuTarget(null);
                                if (calendarRangeRef.current) {
                                  void handleCalendarRangeChange(
                                    calendarRangeRef.current.from,
                                    calendarRangeRef.current.to,
                                    true,
                                  );
                                }
                              } catch (err) {
                                console.error(err);
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : "Erro ao resetar dia de docagem.",
                                );
                              }
                            }}
                            className="group w-full px-4 py-2 text-left text-sm font-bold text-amber-600 hover:text-amber-700 rounded-xl bg-amber-50 hover:bg-amber-100 flex items-center gap-3 cursor-pointer"
                          >
                            <RotateCcw size={16} className="text-amber-600" />
                            Resetar dia
                          </button>
                        </>
                      )}
                      {instance.status === "pendente" && (
                        <button
                          onClick={async () => {
                            try {
                              await excluirDocagemDia(instance.id);
                              toast.success("Dia de docagem excluído.");
                              setDocagemMenuTarget(null);
                              if (calendarRangeRef.current) {
                                void handleCalendarRangeChange(
                                  calendarRangeRef.current.from,
                                  calendarRangeRef.current.to,
                                  true,
                                );
                              }
                            } catch (err) {
                              console.error(err);
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : "Erro ao excluir dia de docagem.",
                              );
                            }
                          }}
                          className="group w-full px-4 py-2 text-left text-sm font-bold rounded-xl bg-rose-50 hover:bg-rose-100 flex items-center gap-3 cursor-pointer"
                          style={{ color: "rgb(219, 132, 153)" }}
                        >
                          <Trash2
                            size={16}
                            style={{ color: "rgb(219, 132, 153)" }}
                          />
                          Excluir dia
                        </button>
                      )}
                      {instance.status === "excluida" && (
                        <button
                          onClick={async () => {
                            try {
                              await reativarDocagemDia(instance.id);
                              toast.success("Dia de docagem reativado.");
                              setDocagemMenuTarget(null);
                              if (calendarRangeRef.current) {
                                void handleCalendarRangeChange(
                                  calendarRangeRef.current.from,
                                  calendarRangeRef.current.to,
                                  true,
                                );
                              }
                            } catch (err) {
                              console.error(err);
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : "Erro ao reativar dia de docagem.",
                              );
                            }
                          }}
                          className="group w-full px-4 py-2 text-left text-sm font-bold text-slate-700 rounded-xl hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 cursor-pointer"
                        >
                          <RotateCcw
                            size={16}
                            className="text-slate-400 group-hover:text-blue-600"
                          />
                          Reativar dia
                        </button>
                      )}
                    </div>
                  );
                })()}
            </>
          )}
        </>
      )}

      {/* Modal Nova OS */}
      {isModalOpen && (
        <StandardModal
          onClose={resetMainModalState}
          disableBackdropClose
          title={
            editingOSId
              ? "Editar Atendimento"
              : isFreelanceMode
                ? "Freelance"
                : "Novo Atendimento"
          }
          subtitle={
            editingOSId
              ? "Atualização operacional Geolog"
              : "Fluxo Operacional Geolog"
          }
          icon={
            editingOSId ? (
              <Pencil className="w-6 h-6 md:w-7 md:h-7" />
            ) : (
              <PlusCircle className="w-6 h-6 md:w-7 md:h-7" />
            )
          }
          maxWidthClassName="max-w-7xl"
          bodyClassName="p-6 md:p-10 pb-80 space-y-12"
          headerClassName={
            isFreelanceMode && !editingOSId
              ? "bg-emerald-600"
              : "bg-[rgb(42,82,144)]"
          }
          headerGlowClassName={
            isFreelanceMode && !editingOSId
              ? "bg-emerald-600/10"
              : "bg-[rgb(42,82,144)]/10"
          }
          subtitleClassName="text-white/70"
          footer={
            <div className="p-8 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-5 shrink-0">
              <button
                type="button"
                onClick={resetMainModalState}
                className="px-6 py-4 text-slate-600 font-bold hover:text-slate-900 transition-colors text-sm uppercase tracking-widest cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="nova-os-form"
                className={
                  isFreelanceMode && !editingOSId
                    ? "px-12 py-4 bg-emerald-600 text-white font-black rounded-xl shadow-xl shadow-emerald-900/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer"
                    : "px-12 py-4 bg-[rgb(42,82,144)] text-white font-black rounded-xl shadow-xl shadow-[rgb(42,82,144)]/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer"
                }
              >
                {editingOSId
                  ? "Salvar e Continuar"
                  : isFreelanceMode
                    ? "Confirmar Freelance"
                    : "Confirmar OS"}
              </button>
            </div>
          }
        >
          <form
            id="nova-os-form"
            onSubmit={handleAddOS}
            className="min-h-0 relative"
          >
            <div
              className="space-y-12"
              style={{ paddingTop: "0.5rem", paddingBottom: "2rem" }}
            >
              {/* 1. DETALHES DA EXECUÇÃO */}
              <div className="space-y-8">
                <div
                  className="flex items-center border-b-2 border-slate-100 pb-4"
                  style={{ paddingBottom: "1.25rem" }}
                >
                  <h3
                    className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                    style={{ lineHeight: "1.3" }}
                  >
                    <Clock size={20} className="text-slate-500" /> Detalhes da
                    Execução
                  </h3>
                </div>

                <div className="flex flex-col md:flex-row gap-8">
                  <div className="space-y-2.5 w-full md:w-[80%]">
                    <GeologSearchableSelect
                      label="Empresa / Cliente Final"
                      options={clientes}
                      value={formData.clienteId}
                      onChange={handleClienteChange}
                      required
                    />
                  </div>
                  <div className="space-y-2.5 w-full md:w-[20%]">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                      OS{" "}
                      <span className="text-slate-400 text-xs font-normal normal-case tracking-normal">
                        Opcional
                      </span>
                    </label>
                    <input
                      type="text"
                      name="os"
                      value={formData.os}
                      onChange={handleInputChange}
                      placeholder="Ex: 9988"
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-lg text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all uppercase placeholder:text-slate-300 shadow-sm -mt-[6px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <GeologSearchableSelect
                    label="Solicitante Responsável"
                    options={availableSolicitantes.map((s) => ({
                      id: s.id,
                      nome: s.nome,
                    }))}
                    value={
                      formData.solicitanteId ||
                      availableSolicitantes.find(
                        (s) => s.nome === formData.solicitante,
                      )?.id ||
                      ""
                    }
                    onChange={(id) => {
                      const opt = availableSolicitantes.find(
                        (s) => s.id === id,
                      );
                      setFormData((prev) => ({
                        ...prev,
                        solicitanteId: id,
                        solicitante: opt?.nome || "",
                      }));
                    }}
                    disabled={!formData.clienteId}
                    required
                    onQuickAdd={handleQuickAddSolicitante}
                  />
                  <GeologSearchableSelect
                    label="Centro de Custo"
                    options={availableCentrosCusto.map((c) => ({
                      id: c.id,
                      nome: c.nome,
                    }))}
                    value={
                      availableCentrosCusto.find(
                        (c) => c.id === formData.centroCusto,
                      )?.id || ""
                    }
                    onChange={(id) => {
                      setFormData((prev) => ({ ...prev, centroCusto: id }));
                    }}
                    disabled={!formData.clienteId}
                    onQuickAdd={handleQuickAddCentroCusto}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <GeologSearchableSelect
                    label="Motorista Alocado"
                    options={driverOptions}
                    value={formData.driverId || ""}
                    onChange={(id) => {
                      const opt = driverOptions.find((m) => m.id === id);
                      setFormData((prev) => ({
                        ...prev,
                        driverId: id,
                        motorista: opt?.nome || "",
                        veiculoId: "",
                      }));
                    }}
                    required
                    onQuickAdd={handleQuickAddMotorista}
                  />
                  <GeologSearchableSelect
                    label="Veículo de Uso"
                    options={selectedDriverVehicleOptions}
                    value={formData.veiculoId}
                    onChange={(id) =>
                      setFormData((prev) => ({ ...prev, veiculoId: id }))
                    }
                    required
                    disabled={!formData.motorista}
                    onQuickAdd={handleQuickAddVeiculo}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8"></div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 border-t-2 border-dashed border-slate-300" />
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                <div className="flex-1 border-t-2 border-dashed border-slate-300" />
              </div>

              {/* 2. ITINERÁRIO */}
              {/* 2. ITINERÁRIO DINÂMICO */}
              <div className="space-y-8">
                <div
                  className="flex items-center justify-between border-b-2 border-slate-100 pb-4"
                  style={{ paddingBottom: "1.25rem" }}
                >
                  <h3
                    className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-2"
                    style={{ lineHeight: "1.3" }}
                  >
                    <MapPin size={20} className="text-blue-600" />
                    {getItinerarySectionTitle()}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddItinerary}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-200 transition-all shadow-sm cursor-pointer"
                    >
                      <Plus size={16} /> ITINERÁRIO
                    </button>
                    <button
                      type="button"
                      onClick={handleAddReturn}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-purple-200 transition-all shadow-sm cursor-pointer"
                    >
                      <Plus size={16} /> RETORNO
                    </button>
                  </div>
                </div>

                <div className="relative pl-8 space-y-6">
                  {formItineraries.map((it) => (
                    <div key={it.index} className="space-y-6">
                      {formItineraries.length > 1 && (
                        <h4
                          className={`flex items-center gap-2 mb-6 ${it.index === 0 ? "mt-6" : "mt-20"}`}
                        >
                          {it.index < 0 ? (
                            <ArrowLeft size={18} className="text-purple-500" />
                          ) : (
                            <ArrowRight size={18} className="text-amber-500" />
                          )}
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-xl text-sm font-black shadow-sm ${it.index < 0 ? "bg-purple-100 text-purple-700 ring-2 ring-purple-200" : "bg-amber-100 text-amber-700 ring-2 ring-amber-200"}`}
                          >
                            {it.index < 0 ? Math.abs(it.index) : it.index + 1}
                          </span>
                          <span
                            className={`text-[13px] font-black uppercase tracking-[0.15em] ${it.index < 0 ? "text-purple-700" : "text-amber-700"}`}
                          >
                            {getItineraryTitle(it.index)}
                          </span>
                        </h4>
                      )}
                      {it.waypointIndices.map((index, relIdx) => {
                        const waypoint = formData.waypoints[index];
                        const isOrigin = relIdx === 0;
                        const isDestination =
                          relIdx === it.waypointIndices.length - 1;
                        const hasPassengers =
                          (waypoint.passengers?.length || 0) > 0;
                        const destinationPassengerLineEnd =
                          destinationPassengerLineEnds[index];
                        const stopLabel = isOrigin
                          ? "ORIGEM"
                          : isDestination
                            ? "DESTINO FINAL"
                            : `${relIdx}ª PARADA`;

                        return (
                          <div
                            key={index}
                            ref={(el) => {
                              waypointTimelineRefs.current[index] = el;
                            }}
                            className="relative group"
                          >
                            {!isDestination &&
                              index < formData.waypoints.length - 1 && (
                                <div className="absolute -left-[1.125rem] top-8 -bottom-6 w-0.5 bg-slate-300" />
                              )}
                            {isDestination && hasPassengers && (
                              <div
                                className="absolute -left-[1.125rem] top-8 w-0.5 bg-slate-300"
                                style={{
                                  height:
                                    destinationPassengerLineEnd !== undefined
                                      ? `${destinationPassengerLineEnd}px`
                                      : `calc(100% - ${waypoint.passengers.length === 1 ? "94px" : waypoint.passengers.length === 2 ? "70px" : waypoint.passengers.length === 3 ? "82px" : "94px"})`,
                                }}
                              />
                            )}
                            {/* Timeline Dot (Círculo) */}
                            <div
                              className={`absolute -left-[1.625rem] top-2 w-4 h-4 rounded-full border-4 border-white shadow-sm ring-2 z-10 ${isOrigin ? "bg-emerald-500 ring-emerald-100" : isDestination ? "bg-blue-600 ring-blue-100" : "bg-slate-400 ring-slate-100"}`}
                            />

                            <div className="flex items-start gap-4">
                              <div className="flex-1 space-y-4">
                                <div className="space-y-4">
                                  <div className="flex-1 space-y-3">
                                    <div className="flex items-center justify-between ml-1 mb-2">
                                      <label className="text-[10px] font-black uppercase tracking-[0.25em]">
                                        <div
                                          className={`inline-flex items-stretch rounded-xl overflow-hidden shadow-sm border text-[10px] md:text-[11px] ${isOrigin ? "bg-emerald-500 border-emerald-400 text-white" : isDestination ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-100 border-slate-200 text-slate-600"}`}
                                        >
                                          <span
                                            className={`px-3 py-1.5 flex items-center justify-center ${isOrigin ? "bg-emerald-600" : isDestination ? "bg-blue-700" : "bg-slate-200 text-slate-700"}`}
                                          >
                                            {isOrigin ? (
                                              <MapPin size={14} />
                                            ) : isDestination ? (
                                              <Flag size={14} />
                                            ) : (
                                              <Circle size={14} />
                                            )}
                                          </span>
                                          <span className="px-4 py-1.5 font-black tracking-wide text-[11px]">
                                            {stopLabel}
                                          </span>
                                        </div>
                                      </label>
                                      {isOrigin && (
                                        <div className="flex items-center gap-3">
                                          <div className="flex items-center gap-1.5">
                                            <Calendar
                                              size={14}
                                              className="text-slate-400"
                                            />
                                            <input
                                              type="text"
                                              value={waypoint.data ?? ""}
                                              onChange={(e) =>
                                                handleWaypointDataChange(
                                                  index,
                                                  e.target.value,
                                                )
                                              }
                                              onBlur={() =>
                                                handleWaypointDataBlur(index)
                                              }
                                              placeholder="DD/MM/AAAA"
                                              maxLength={10}
                                              className="w-[9rem] px-2 py-[5px] bg-white border border-slate-200 rounded-lg text-base font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all tracking-wider font-mono"
                                            />
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <Clock
                                              size={16}
                                              className="text-slate-400"
                                            />
                                            <input
                                              type="text"
                                              value={
                                                waypoint.hora
                                                  ? waypoint.hora.slice(0, 5)
                                                  : ""
                                              }
                                              onChange={(e) =>
                                                handleWaypointHoraChange(
                                                  index,
                                                  e.target.value,
                                                )
                                              }
                                              placeholder="HH:MM"
                                              maxLength={5}
                                              className="w-[6rem] px-2 py-[5px] bg-white border border-slate-200 rounded-lg text-base font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all tracking-wider font-mono"
                                            />
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleAddWaypoint(it.index)
                                            }
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-blue-200 transition-all shadow-sm cursor-pointer"
                                          >
                                            <Plus size={16} /> Parada
                                          </button>
                                          {it.index !== 0 && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleRemoveItinerary(it.index)
                                              }
                                              className="flex items-center justify-center px-2 py-1.5 bg-red-100 text-red-500 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-red-200 transition-all shadow-sm cursor-pointer"
                                              title="Remover itinerário/retorno"
                                            >
                                              <Minus size={16} />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="relative">
                                      <input
                                        type="text"
                                        required
                                        value={waypoint.label}
                                        onChange={(e) =>
                                          handleWaypointChange(
                                            index,
                                            e.target.value,
                                          )
                                        }
                                        placeholder={
                                          isOrigin
                                            ? "Ex: Hotel H/Niterói"
                                            : "Próximo destino..."
                                        }
                                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm pr-36"
                                      />
                                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleWaypointComment(index)
                                          }
                                          className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-all cursor-pointer ${openWaypointComments[index] || waypoint.comment.trim() ? "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:scale-110 active:scale-95" : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"}`}
                                          title="Adicionar observação"
                                        >
                                          <MessageSquareMore size={16} />
                                          {waypoint.comment.trim() && (
                                            <>
                                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-ping"></span>
                                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></span>
                                            </>
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleAddPassenger(index)
                                          }
                                          className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all flex items-center justify-center shadow-sm border border-blue-100 cursor-pointer"
                                          title="Adicionar Passageiro"
                                        >
                                          <Plus size={18} />
                                        </button>
                                        {formData.waypoints.length > 2 &&
                                          !isOrigin &&
                                          !isDestination && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleRemoveWaypoint(index)
                                              }
                                              className="p-2 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 transition-all flex items-center justify-center shadow-sm border border-red-100 cursor-pointer"
                                              title="Remover Parada"
                                            >
                                              <X size={18} />
                                            </button>
                                          )}
                                      </div>
                                    </div>
                                    {openWaypointComments[index] && (
                                      <div className="mt-3 ml-12">
                                        <textarea
                                          value={waypoint.comment}
                                          onChange={(e) =>
                                            handleWaypointCommentChange(
                                              index,
                                              e.target.value,
                                            )
                                          }
                                          rows={2}
                                          placeholder="Ex: aguardar na portaria, desembarque pela lateral..."
                                          className="waypoint-observation w-full resize-none rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 outline-none transition-all shadow-sm"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Linhas de Passageiros */}
                                {waypoint.passengers &&
                                  waypoint.passengers.length > 0 && (
                                    <div className="mt-4 border-t border-dashed border-slate-200">
                                      {waypoint.passengers.map(
                                        (passenger, passengerIndex) => (
                                          <div
                                            key={passenger.id}
                                            className={`relative flex items-center gap-4 group/pass ${passengerIndex === 0 ? "mt-6" : "mt-5"} ${passengerIndex === waypoint.passengers.length - 1 ? "mb-10" : "mb-5"}`}
                                          >
                                            {/* Linha horizontal da trilha - começa na linha vertical */}
                                            <div
                                              data-passenger-line
                                              className="absolute -left-[1.125rem] top-1/2 -translate-y-1/2 w-12 h-0.5 bg-slate-300 z-10"
                                            />

                                            {/* Trilhas de passageiro (quadrado) - no final da linha */}
                                            <div
                                              className={`absolute left-[1.375rem] top-1/2 -translate-y-1/2 w-4 h-4 rounded-sm border-4 border-white shadow-sm ring-2 z-20 ${isOrigin ? "bg-emerald-500 ring-emerald-100" : isDestination ? "bg-blue-600 ring-blue-100" : "bg-slate-400 ring-slate-100"}`}
                                            />

                                            <div className="flex-1 flex items-center gap-3 ml-8">
                                              <div className="w-3/5 ml-6">
                                                <div className="flex items-center gap-3">
                                                  <div className="flex-1">
                                                    <GeologSearchableSelect
                                                      label=""
                                                      placeholder="Selecione o passageiro..."
                                                      onSearch={
                                                        searchPassageiros
                                                      }
                                                      selectedOption={getPassengerOption(
                                                        passenger.solicitanteId ||
                                                          "",
                                                      )}
                                                      value={
                                                        passenger.solicitanteId ||
                                                        ""
                                                      }
                                                      onChange={(val) =>
                                                        handlePassengerChange(
                                                          index,
                                                          passenger.id,
                                                          val,
                                                        )
                                                      }
                                                    />
                                                  </div>
                                                  <div className="flex items-center justify-center h-[56px]">
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        openQuickPassengerModal(
                                                          index,
                                                          passenger.id,
                                                        )
                                                      }
                                                      className="p-3 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-all opacity-0 group-hover/pass:opacity-100 flex items-center justify-center shadow-sm border border-blue-200 cursor-pointer"
                                                      style={{
                                                        marginBottom: "-5px",
                                                      }}
                                                      title="Cadastrar passageiro"
                                                    >
                                                      <PlusCircle size={18} />
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="flex items-center justify-center h-[56px]">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleRemovePassenger(
                                                      index,
                                                      passenger.id,
                                                    )
                                                  }
                                                  className="p-3 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover/pass:opacity-100 cursor-pointer"
                                                  style={{
                                                    marginBottom: "-5px",
                                                  }}
                                                  title="Remover Passageiro"
                                                >
                                                  <X size={18} />
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4 mt-12">
                  <div className="flex-1 border-t-2 border-dashed border-slate-300" />
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                  <div className="flex-1 border-t-2 border-dashed border-slate-300" />
                </div>

                {/* 3. RESUMO FINANCEIRO */}
                <div className="space-y-8 mt-8">
                  <div className="flex items-center border-b-2 border-slate-100 pb-4">
                    <h3 className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3">
                      <FileText size={20} className="text-emerald-600" /> Resumo
                      Financeiro
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-end gap-10">
                    <div className="flex flex-col gap-2 w-full sm:w-[220px]">
                      <label className="text-sm font-bold text-slate-800 uppercase tracking-tight ml-1">
                        Valor Bruto
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          name="valorBruto"
                          step="0.01"
                          value={formData.valorBruto ?? ""}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 border-2 border-slate-200 px-4 h-[58px] rounded-xl font-bold text-lg text-blue-700 outline-none tabular-nums focus:bg-white focus:border-blue-600 transition-all shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full sm:w-[220px]">
                      <label className="text-sm font-bold text-slate-800 uppercase tracking-tight ml-1">
                        Repasse ao Motorista
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          name="custo"
                          step="0.01"
                          value={formData.custo ?? ""}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 border-2 border-slate-200 px-4 h-[58px] rounded-xl font-bold text-lg text-red-500 outline-none tabular-nums focus:bg-white focus:border-red-300 transition-all shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full sm:w-[120px]">
                      <label className="text-sm font-bold text-slate-800 uppercase tracking-tight ml-1">
                        Hora Extra
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          name="horaExtra"
                          placeholder="00:00"
                          value={formData.horaExtra}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 border-2 border-slate-200 px-4 h-[58px] rounded-xl font-bold text-base text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition-all shadow-sm"
                        />
                      </div>
                    </div>

                    <div
                      className={`flex items-end gap-6 pt-4 px-6 pb-8 rounded-[1.5rem] border transition-all duration-300 mb-[-2rem] ${formData.noShow ? "bg-red-50 border-red-200 shadow-sm" : "border-transparent"}`}
                    >
                      <div className="flex flex-col gap-2 w-full sm:w-[120px]">
                        <label className="text-sm font-bold text-slate-800 uppercase tracking-tight ml-1">
                          NO-SHOW
                        </label>
                        <div className="relative">
                          <select
                            name="noShow"
                            value={formData.noShow ? "sim" : "nao"}
                            onChange={handleInputChange}
                            className="w-full bg-slate-50 border-2 border-slate-200 px-4 h-[58px] rounded-xl font-bold text-base text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition-all shadow-sm cursor-pointer appearance-none pr-10"
                          >
                            <option value="nao">Não</option>
                            <option value="sim">Sim</option>
                          </select>
                          <ChevronDown
                            size={18}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                          />
                        </div>
                      </div>

                      {formData.noShow && (
                        <div className="flex flex-col gap-2 w-full sm:w-[130px] animate-in fade-in slide-in-from-left-2 duration-500">
                          <label className="text-sm font-bold text-slate-800 uppercase tracking-tight ml-1">
                            Cobrança de
                          </label>
                          <div className="relative">
                            <select
                              name="noShowPercentual"
                              value={
                                formData.noShowPercentual !== null
                                  ? String(formData.noShowPercentual)
                                  : ""
                              }
                              onChange={handleInputChange}
                              className="w-full bg-slate-50 border-2 border-slate-200 px-4 h-[58px] rounded-xl font-bold text-base text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition-all shadow-sm cursor-pointer appearance-none pr-10"
                            >
                              <option value="" disabled>
                                Selecione
                              </option>
                              <option value="50">50%</option>
                              <option value="100">100%</option>
                            </select>
                            <ChevronDown
                              size={18}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className={`flex flex-col gap-2 transition-all duration-300 ${formData.noShow ? "mt-14" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => setShowObsFinanceiras((prev) => !prev)}
                      className="flex items-center justify-between w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl hover:bg-slate-100 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <MessageSquareMore
                          size={18}
                          className="text-slate-400 group-hover:text-blue-500 transition-colors"
                        />
                        <span className="text-sm font-bold text-slate-800 uppercase tracking-tight">
                          Observações Financeiras
                        </span>
                        {formData.obsFinanceiras && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                            Preenchido
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        size={20}
                        className={`text-slate-400 transition-transform duration-300 ${showObsFinanceiras ? "rotate-180" : ""}`}
                      />
                    </button>

                    {showObsFinanceiras && (
                      <div className="animate-in slide-in-from-top-2 duration-300">
                        <textarea
                          name="obsFinanceiras"
                          value={formData.obsFinanceiras ?? ""}
                          onChange={handleInputChange}
                          rows={3}
                          placeholder="Adicione observações de cunho financeiro..."
                          className="w-full bg-slate-50 border-2 border-slate-200 px-6 py-4 rounded-xl font-medium text-base text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition-all shadow-sm resize-none"
                        />
                      </div>
                    )}
                  </div>

                  <div
                    className={`p-8 md:p-10 rounded-[2.5rem] ${currentLucro >= 0 ? "bg-emerald-600 shadow-emerald-900/10" : "bg-red-600 shadow-red-900/10"} text-white shadow-2xl transition-all duration-500`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black uppercase tracking-[0.2em]">
                            Valor Total a Cobrar
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-5xl font-black tracking-tighter tabular-nums leading-none">
                            {formData.noShow
                              ? formatCurrency(currentBaseCobranca)
                              : formatCurrency(totalEfetivoCliente)}
                          </p>
                          <div className="flex items-start gap-3 -mt-2">
                            <div className="animate-pulse mt-5">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width={32}
                                height={32}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="lucide lucide-arrow-right opacity-80"
                              >
                                <path d="M5 12h14" />
                                <path d="m12 5 7 7-7 7" />
                              </svg>
                            </div>
                            <div className="text-right space-y-2 -mt-1">
                              <span className="text-xs font-black uppercase block tracking-widest opacity-80">
                                Valor Líquido Estimado
                              </span>
                              <div className="px-5 py-2 bg-white/20 rounded-xl text-2xl font-black tabular-nums backdrop-blur-md leading-none">
                                {formatCurrency(currentLucro)}
                              </div>
                              <div className="text-xs font-black uppercase tracking-widest opacity-100">
                                {currentBaseCobranca > 0
                                  ? (
                                      (currentLucro / currentBaseCobranca) *
                                      100
                                    ).toFixed(1)
                                  : 0}
                                %{" "}
                                <span className="text-[10px] font-medium opacity-70">
                                  de lucro
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Detalhe: Valores */}
                        <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-3">
                          <div className="grid grid-cols-2 gap-5">
                            <div className="bg-white/10 rounded-xl px-4 py-4 space-y-3">
                              <p className="text-sm font-black uppercase tracking-widest opacity-100 mb-3 flex items-center gap-2">
                                <User size={16} />
                                Fatura do Cliente
                              </p>

                              {/* Base */}
                              <div className="flex justify-between items-center text-sm">
                                <span className="font-medium opacity-90">
                                  Valor base do serviço
                                </span>
                                <span className="font-black tabular-nums">
                                  {formData.noShow
                                    ? formatCurrency(totalEfetivoCliente)
                                    : formatCurrency(formData.valorBruto ?? 0)}
                                </span>
                              </div>

                              {/* No-show desconto */}
                              {formData.noShow && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="font-medium opacity-80">
                                    Desconto NO-SHOW (
                                    {formData.noShowPercentual ?? 0}%)
                                  </span>
                                  <span className="font-black tabular-nums text-red-200">
                                    -
                                    {formatCurrency(
                                      (formData.noShow
                                        ? totalEfetivoCliente
                                        : (formData.valorBruto ?? 0)) *
                                        ((formData.noShowPercentual ?? 0) /
                                          100),
                                    )}
                                  </span>
                                </div>
                              )}

                              {/* Hora extra */}
                              {horaExtraBilledMinutes > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="flex items-center gap-1.5 font-medium opacity-90">
                                    <Clock
                                      size={14}
                                      className="text-yellow-200"
                                    />
                                    Acréscimo hora extra ({horaExtraBilledLabel}
                                    )
                                  </span>
                                  <span className="font-black tabular-nums text-yellow-200">
                                    +{formatCurrency(horaExtraClienteValor)}
                                  </span>
                                </div>
                              )}

                              {/* Taxa */}
                              <div className="flex justify-between items-center text-sm">
                                <span className="font-medium opacity-80">
                                  Taxa administrativa ({impostoPercentual}%)
                                </span>
                                <span className="font-black tabular-nums text-red-200">
                                  -
                                  {formatCurrency(
                                    (formData.noShow
                                      ? currentBaseCobranca
                                      : totalEfetivoCliente) *
                                      (impostoPercentual / 100),
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className="bg-white/10 rounded-xl px-4 py-4 space-y-3">
                              <p className="text-sm font-black uppercase tracking-widest opacity-100 mb-3 flex items-center gap-2">
                                <Truck size={16} />
                                Repasse ao Motorista
                              </p>

                              {/* Base */}
                              <div className="flex justify-between items-center text-sm">
                                <span className="font-medium opacity-90">
                                  Valor base do repasse
                                </span>
                                <span className="font-black tabular-nums">
                                  {formData.noShow
                                    ? formatCurrency(totalEfetivoMotorista)
                                    : formatCurrency(formData.custo ?? 0)}
                                </span>
                              </div>

                              {/* No-show desconto */}
                              {formData.noShow && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="font-medium opacity-80">
                                    Desconto NO-SHOW (
                                    {formData.noShowPercentual ?? 0}%)
                                  </span>
                                  <span className="font-black tabular-nums text-red-200">
                                    -
                                    {formatCurrency(
                                      (formData.noShow
                                        ? totalEfetivoMotorista
                                        : (formData.custo ?? 0)) *
                                        ((formData.noShowPercentual ?? 0) /
                                          100),
                                    )}
                                  </span>
                                </div>
                              )}

                              {/* Hora extra */}
                              {horaExtraBilledMinutes > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="flex items-center gap-1.5 font-medium opacity-90">
                                    <Clock
                                      size={14}
                                      className="text-yellow-200"
                                    />
                                    Acréscimo hora extra ({horaExtraBilledLabel}
                                    )
                                  </span>
                                  <span className="font-black tabular-nums text-yellow-200">
                                    +{formatCurrency(horaExtraMotoristaValor)}
                                  </span>
                                </div>
                              )}

                              <div className="h-px bg-white/30 my-1" />

                              {/* Total */}
                              <div className="flex justify-between items-baseline">
                                <span className="text-xs font-black uppercase tracking-[0.2em] opacity-80">
                                  Total a repassar
                                </span>
                                <span className="text-2xl font-black tabular-nums">
                                  {formData.noShow
                                    ? formatCurrency(repasseEfetivo)
                                    : formatCurrency(totalEfetivoMotorista)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </StandardModal>
      )}

      {isQuickPassengerModalOpen && (
        <StandardModal
          onClose={() => setIsQuickPassengerModalOpen(false)}
          title="Novo Passageiro Rápido"
          subtitle="Cadastro sintetizado direto no atendimento"
          icon={<User size={24} />}
          maxWidthClassName="max-w-6xl"
        >
          <form onSubmit={handleQuickPassengerSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-25 gap-6">
              <div className="space-y-2 md:col-span-12">
                <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                  Nome completo{" "}
                  <span className="text-rose-300 text-base">*</span>
                </label>
                <input
                  required
                  value={quickPassengerForm.nomeCompleto}
                  onChange={(e) =>
                    setQuickPassengerForm((prev) => ({
                      ...prev,
                      nomeCompleto: forceUpperText(e.target.value),
                    }))
                  }
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm uppercase"
                  placeholder="Ex: Lucas Vieira"
                />
                <FormErrorMessage message={quickPassengerErrors.nomeCompleto} />
              </div>
              <div className="space-y-2 md:col-span-6">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                    Celular <RequiredAsterisk />
                  </label>
                  <div
                    className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1"
                    style={{ marginTop: "-7px" }}
                  >
                    <input
                      type="checkbox"
                      id="isEstrangeiroQuick"
                      checked={isEstrangeiro}
                      onChange={(e) => {
                        setIsEstrangeiro(e.target.checked);
                        setQuickPassengerForm((prev) => ({
                          ...prev,
                          celular: "",
                        }));
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label
                      htmlFor="isEstrangeiroQuick"
                      className="text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      Estrangeiro
                    </label>
                  </div>
                </div>
                <input
                  required={!isEstrangeiro}
                  value={quickPassengerForm.celular}
                  onChange={(e) => {
                    const formatted = formatPhone(e.target.value);
                    setQuickPassengerForm((prev) => ({
                      ...prev,
                      celular: formatted,
                    }));
                  }}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                  placeholder={
                    isEstrangeiro ? "+00 123456789" : "(00) 00000-0000"
                  }
                />
                <FormErrorMessage message={quickPassengerErrors.celular} />
              </div>
              <div className="space-y-2 md:col-span-5">
                <GeologSearchableSelect
                  label="Notificar"
                  options={[
                    { id: "Sim", nome: "Sim" },
                    { id: "Não", nome: "Não" },
                  ]}
                  value={quickPassengerForm.notificar}
                  onChange={(value) =>
                    setQuickPassengerForm((prev) => ({
                      ...prev,
                      notificar: value,
                    }))
                  }
                  required
                  disableSearch
                />
              </div>
            </div>

            <div className="relative rounded-[2rem] border-2 border-slate-200 bg-white p-6 shadow-sm">
              <button
                type="button"
                onClick={() => setIsAddressExpanded(!isAddressExpanded)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                title={
                  isAddressExpanded ? "Recolher endereço" : "Expandir endereço"
                }
              >
                <ChevronDown
                  size={20}
                  className={`transition-transform duration-200 ${isAddressExpanded ? "rotate-180" : ""}`}
                />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div
                  className={`w-10 h-10 rounded-xl ${quickPassengerTarget ? getWaypointInfo(quickPassengerTarget.waypointIndex).bgColor : "bg-blue-50"} ${quickPassengerTarget ? getWaypointInfo(quickPassengerTarget.waypointIndex).textColor : "text-blue-600"} flex items-center justify-center`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-map-pin"
                    aria-hidden="true"
                  >
                    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    {isAddressExpanded
                      ? quickPassengerTarget
                        ? `${getWaypointInfo(quickPassengerTarget.waypointIndex).type} - Endereço`
                        : "Endereço 1"
                      : quickPassengerForm.enderecoCompleto ||
                        (quickPassengerTarget
                          ? `Endereço vinculado à ${getWaypointInfo(quickPassengerTarget.waypointIndex).type}`
                          : "Endereço vinculado ao roteiro")}
                  </p>
                  <p
                    className={`text-base font-black ${quickPassengerTarget ? getWaypointInfo(quickPassengerTarget.waypointIndex).textColor : "text-slate-800"}`}
                  >
                    {isAddressExpanded
                      ? quickPassengerTarget
                        ? getWaypointInfo(quickPassengerTarget.waypointIndex)
                            .description
                        : "Ponto de apoio / destino recorrente"
                      : quickPassengerForm.enderecoCompleto ||
                        (quickPassengerTarget
                          ? getWaypointInfo(quickPassengerTarget.waypointIndex)
                              .type
                          : "Origem, Parada ou Destino Final")}
                  </p>
                </div>
              </div>

              {isAddressExpanded && (
                <div className="space-y-6 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                        Rótulo{" "}
                        <span className="text-rose-300 text-base">*</span>
                      </label>
                      <input
                        value={quickPassengerForm.rotulo}
                        onChange={(e) =>
                          setQuickPassengerForm((prev) => ({
                            ...prev,
                            rotulo: e.target.value,
                          }))
                        }
                        placeholder="RESIDENCIAL, BASE, HOTEL..."
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                        Referência
                      </label>
                      <input
                        value={quickPassengerForm.referencia}
                        onChange={(e) =>
                          setQuickPassengerForm((prev) => ({
                            ...prev,
                            referencia: e.target.value,
                          }))
                        }
                        placeholder="Portaria azul, torre B, etc"
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 mt-6">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                      Endereço completo{" "}
                      <span className="text-rose-300 text-base">*</span>
                    </label>
                    <input
                      required
                      value={quickPassengerForm.enderecoCompleto}
                      onChange={(e) =>
                        setQuickPassengerForm((prev) => ({
                          ...prev,
                          enderecoCompleto: e.target.value,
                        }))
                      }
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                      placeholder="Rua, número, bairro, cidade - UF"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setIsQuickPassengerModalOpen(false)}
                className="cursor-pointer px-6 py-3 text-slate-500 font-black rounded-xl border border-slate-200 hover:bg-slate-50 transition-all uppercase tracking-widest text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="cursor-pointer px-8 py-3 bg-emerald-600 text-white font-black rounded-xl shadow-lg shadow-emerald-900/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest text-xs"
              >
                Salvar Passageiro
              </button>
            </div>
          </form>
        </StandardModal>
      )}

      {viewingOSId && !viewingOSLive && viewingOSLoading && (
        <div className="fixed inset-0 bg-blue-950/90 backdrop-blur-sm flex items-center justify-center z-50">
          <Loader2 size={48} className="animate-spin text-white" />
        </div>
      )}

      {viewingOS && (
        <StandardModal
          onClose={() => {
            setViewingOSId(null);
            setViewingOSLoading(false);
          }}
          title={`Visão Operacional ${viewingOS.os || "Sem OS"}`}
          subtitle={`Protocolo ${viewingOS.protocolo}`}
          icon={<Eye size={24} />}
          maxWidthClassName="max-w-6xl min-[1360px]:max-w-[88vw]"
          bodyClassName="p-6 md:p-10 space-y-8"
        >
          <div className="space-y-8">
            {/* Barra de Resumo: Dados + Status/Horário separados */}
            <div className="flex flex-col md:flex-row gap-3">
              {/* Coluna principal — dados da OS */}
              <div className="flex-1 flex flex-wrap items-center gap-y-3 gap-x-1 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3">
                <div className="flex items-center gap-2 px-3">
                  <Building2 size={14} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Cliente
                    </p>
                    <p className="text-base font-bold text-slate-800 line-clamp-1">
                      {clientes.find((c) => c.id === viewingOS.clienteId)
                        ?.nome || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-200 mx-1 hidden lg:block" />

                <div className="flex items-center gap-2 px-3">
                  <User size={14} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Solicitante
                    </p>
                    <p className="text-base font-bold text-slate-800 line-clamp-1">
                      {viewingOS.solicitante || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-200 mx-1 hidden lg:block" />

                <div className="flex items-center gap-2 px-3">
                  <Car size={14} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Motorista
                    </p>
                    <p className="text-base font-bold text-slate-800 line-clamp-1">
                      {viewingOS.motorista || "Não definido"}
                    </p>
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-200 mx-1 hidden lg:block" />

                <div className="flex items-center gap-2 px-3">
                  <Building size={14} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                      C. Custo
                    </p>
                    <p className="text-base font-bold text-slate-800 line-clamp-1">
                      {clientes
                        .find((c) => c.id === viewingOS.clienteId)
                        ?.centrosCusto.find(
                          (cc) => cc.id === viewingOS.centroCustoId,
                        )?.nome || "Padrão"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Coluna lateral — Status + Horário em cards */}
              <div className="flex items-stretch gap-3">
                {/* Card de Status */}
                <div
                  className={`flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-sm ${
                    viewingOS?.arquivado
                      ? "bg-rose-50 border-rose-200"
                      : effectiveOperationalStatus === "Pendente"
                        ? "bg-yellow-50 border-yellow-200"
                        : effectiveOperationalStatus === "Aguardando"
                          ? "bg-indigo-50 border-indigo-200"
                          : effectiveOperationalStatus === "Em Rota"
                            ? "bg-sky-50 border-sky-200"
                            : effectiveOperationalStatus === "Finalizado"
                              ? "bg-emerald-50 border-emerald-200"
                              : effectiveOperationalStatus === "Cancelado"
                                ? "bg-rose-50 border-rose-200"
                                : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      viewingOS?.arquivado
                        ? "bg-rose-100"
                        : effectiveOperationalStatus === "Pendente"
                          ? "bg-yellow-100"
                          : effectiveOperationalStatus === "Aguardando"
                            ? "bg-indigo-100"
                            : effectiveOperationalStatus === "Em Rota"
                              ? "bg-sky-100"
                              : effectiveOperationalStatus === "Finalizado"
                                ? "bg-emerald-100"
                                : effectiveOperationalStatus === "Cancelado"
                                  ? "bg-rose-100"
                                  : "bg-slate-100"
                    }`}
                  >
                    <CheckCircle2
                      size={18}
                      className={
                        viewingOS?.arquivado
                          ? "text-rose-600"
                          : effectiveOperationalStatus === "Pendente"
                            ? "text-yellow-600"
                            : effectiveOperationalStatus === "Aguardando"
                              ? "text-indigo-600"
                              : effectiveOperationalStatus === "Em Rota"
                                ? "text-sky-600"
                                : effectiveOperationalStatus === "Finalizado"
                                  ? "text-emerald-600"
                                  : effectiveOperationalStatus === "Cancelado"
                                    ? "text-rose-600"
                                    : "text-slate-600"
                      }
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Status
                    </p>
                    <p
                      className={`text-base font-black ${
                        viewingOS?.arquivado
                          ? "text-rose-700"
                          : effectiveOperationalStatus === "Pendente"
                            ? "text-yellow-700"
                            : effectiveOperationalStatus === "Aguardando"
                              ? "text-indigo-700"
                              : effectiveOperationalStatus === "Em Rota"
                                ? "text-sky-700"
                                : effectiveOperationalStatus === "Finalizado"
                                  ? "text-emerald-700"
                                  : effectiveOperationalStatus === "Cancelado"
                                    ? "text-rose-700"
                                    : "text-slate-700"
                      }`}
                    >
                      {
                        getStatusConfig(
                          effectiveOperationalStatus,
                          viewingOS?.arquivado,
                        ).label
                      }
                    </p>
                  </div>
                </div>

                {/* Card de Horário */}
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Clock size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Horário
                    </p>
                    <p className="text-base font-black text-slate-800">
                      {(() => {
                        const itineraries = getItineraries(
                          (viewingOS.rota?.waypoints || []) as FormWaypoint[],
                        );
                        const firstItinerary = itineraries.find(
                          (it) => it.index === 0,
                        );
                        const firstWaypoint = firstItinerary?.waypoints[0];
                        const data = firstWaypoint?.data;
                        const hora = firstWaypoint?.hora;
                        if (data && hora) {
                          return `${data.split("-").reverse().join("/")} - ${hora.slice(0, 5)}`;
                        }
                        if (hora) {
                          return hora.slice(0, 5);
                        }
                        return "--:--";
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
              {/* Status da Operação - 100% Width */}
              <div className="rounded-[2rem] border border-slate-200 bg-white p-8 space-y-8 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-[0.1em]">
                      Status da Operação
                    </h3>
                    <p className="text-sm font-semibold text-slate-400 mt-1">
                      Acompanhamento em tempo real da jornada do motorista.
                    </p>
                  </div>
                  {viewingOS?.arquivado ? (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-[0.2em]">
                      <Archive size={14} className="text-red-500" />
                      Arquivado
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                      Em execução
                    </div>
                  )}
                </div>

                {viewingOS?.arquivado && (
                  <div className="flex items-center gap-3 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-rose-600">
                    <Archive size={20} className="text-rose-500 shrink-0" />
                    <p className="text-sm font-bold">
                      Esta ordem de serviço está arquivada. As ações dos ciclos
                      operacionais estão bloqueadas.
                    </p>
                  </div>
                )}

                <div className="space-y-6">
                  {cyclesToRender.map((cycle) => {
                    const isArchived = Boolean(viewingOS?.arquivado);
                    const displayedCycleState: OperationalCycleState = (() => {
                      if (cycle.state === "completed" || cycle.finishedAt)
                        return "completed";
                      if (
                        cycle.state === "awaiting_finish" ||
                        cycle.state === "awaiting_km_finish" ||
                        cycle.startedAt
                      )
                        return "awaiting_finish";
                      if (
                        cycle.state === "awaiting_start" ||
                        cycle.state === "awaiting_km_start" ||
                        cycle.acceptedAt
                      )
                        return "awaiting_start";
                      if (
                        cycle.state === "awaiting_accept" ||
                        cycle.messageSentAt
                      )
                        return "awaiting_accept";
                      return "pending";
                    })();

                    const progressWidth = (() => {
                      switch (displayedCycleState) {
                        case "completed":
                          return "100%";
                        case "awaiting_finish":
                          return "66.66%";
                        case "awaiting_start":
                          return "33.33%";
                        case "awaiting_accept":
                          return "0%";
                        default:
                          return "0%";
                      }
                    })();

                    const cycleSteps = [
                      {
                        id: "received",
                        icon: <MessageCircle size={20} />,
                        label: "Mensagem",
                        sublabel: cycle.messageSentAt
                          ? "Enviada"
                          : "Aguardando",
                        active: Boolean(
                          cycle.messageSentAt ||
                          cycle.acceptedAt ||
                          cycle.startedAt ||
                          cycle.finishedAt ||
                          cycle.state !== "pending",
                        ),
                        timestamp: cycle.messageSentAt,
                        km: undefined as number | undefined,
                      },
                      {
                        id: "accepted",
                        icon: <Eye size={20} />,
                        label: "Visualizado",
                        sublabel: cycle.acceptedAt
                          ? "Confirmado"
                          : "Aguardando",
                        active: Boolean(
                          cycle.acceptedAt ||
                          cycle.startedAt ||
                          cycle.finishedAt ||
                          cycle.state === "awaiting_start" ||
                          cycle.state === "awaiting_finish" ||
                          cycle.state === "awaiting_km_finish" ||
                          cycle.state === "completed",
                        ),
                        timestamp: cycle.acceptedAt,
                        km: undefined as number | undefined,
                      },
                      {
                        id: "started",
                        icon: <Navigation size={20} />,
                        label: "Em Rota",
                        sublabel: cycle.startedAt ? "Iniciado" : "Pendente",
                        active: Boolean(
                          cycle.startedAt ||
                          cycle.finishedAt ||
                          cycle.state === "awaiting_finish" ||
                          cycle.state === "awaiting_km_finish" ||
                          cycle.state === "completed",
                        ),
                        timestamp: cycle.startedAt,
                        km: cycle.kmInitial,
                      },
                      {
                        id: "finished",
                        icon: <FileText size={20} />,
                        label: "Concluído",
                        sublabel: cycle.finishedAt ? "Finalizado" : "Em aberto",
                        active: Boolean(
                          cycle.finishedAt || cycle.state === "completed",
                        ),
                        timestamp: cycle.finishedAt,
                        km: cycle.kmFinal,
                      },
                    ];

                    const cycleStatus =
                      getCycleDisplayStatus(displayedCycleState);

                    return (
                      <div
                        key={`${cycle.sequenceOrder}-${cycle.itineraryIndex}`}
                        className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-6 space-y-6 shadow-sm relative overflow-hidden"
                      >
                        {isArchived && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="absolute w-[200%] h-12 bg-rose-500/10 -rotate-45 flex items-center justify-center">
                              <span className="text-rose-600 text-sm font-black uppercase tracking-[0.2em]">
                                BLOQUEADO
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                              Ciclo Operacional {cycle.sequenceOrder + 1}
                            </p>
                            <h4 className="text-lg font-black text-slate-900 uppercase tracking-[0.1em]">
                              {getOperationalCycleBannerTitle(cycle)}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {!isArchived &&
                              displayedCycleState !== "pending" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCycleIndex(cycle.itineraryIndex);
                                    setShowAcceptRevert(true);
                                  }}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                                >
                                  <RotateCcw size={12} />
                                  Resetar
                                </button>
                              )}
                            <div
                              className={`px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border ${cycle.kind === "return" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}
                            >
                              {cycle.kind === "return"
                                ? "Retorno"
                                : "Itinerário"}
                            </div>
                            <div
                              className={`px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border ${
                                cycleStatus === "Pendente"
                                  ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                  : cycleStatus === "Aguardando"
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                    : cycleStatus === "Em Rota"
                                      ? "bg-sky-50 text-sky-700 border-sky-200"
                                      : cycleStatus === "Finalizado"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}
                            >
                              {cycleStatus}
                            </div>
                          </div>
                        </div>

                        <div className="relative flex justify-between items-start px-4">
                          <div className="absolute top-[28px] left-[44px] right-[44px] h-[5px] bg-slate-200/50 rounded-full z-0">
                            <div
                              className="h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(81,222,255,0.4)] animate-gradient bg-[length:200%_100%]"
                              style={{
                                width: progressWidth,
                                background:
                                  "linear-gradient(to right, rgb(81, 222, 255), rgb(26, 238, 172), #2563eb, #10b981)",
                              }}
                            ></div>
                          </div>

                          {cycleSteps.map((step) => (
                            <div
                              key={step.id}
                              className="relative z-10 flex flex-col items-center"
                            >
                              {step.id === "received" ? (
                                <div className="relative">
                                  <button
                                    type="button"
                                    data-driver-notify-button
                                    className={`flex flex-col items-center group ${isArchived ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                                    onClick={(e) => {
                                      if (isArchived) return;
                                      // Ciclo já em rota ou finalizado: mensagem
                                      // inicial não deve ser reenviada
                                      if (
                                        displayedCycleState ===
                                          "awaiting_finish" ||
                                        displayedCycleState === "completed"
                                      )
                                        return;
                                      const rect = (
                                        e.currentTarget as HTMLElement
                                      ).getBoundingClientRect();
                                      setDriverNotifyMenuPos({
                                        x: rect.right,
                                        y: rect.top,
                                      });
                                      setDriverNotifyTargetCycleIndex(
                                        cycle.itineraryIndex,
                                      );
                                      setOpenDriverNotifyMenu(true);
                                    }}
                                    disabled={
                                      isArchived ||
                                      notifyLoadingKey === "driver-whatsapp"
                                    }
                                  >
                                    <div
                                      className={`
                                w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg
                                ${!step.active ? "bg-white border-2 border-slate-200 text-slate-400" : "text-white"}
                                ${!isArchived && !step.active ? "group-hover:border-slate-300" : ""}
                                ${!isArchived ? "group-hover:scale-110 group-active:scale-95" : ""}
                                ${notifyLoadingKey === "driver-whatsapp" && step.id === "received" && driverNotifyTargetCycleIndex === cycle.itineraryIndex ? "animate-pulse" : ""}
                              `}
                                      style={
                                        step.active
                                          ? {
                                              backgroundColor:
                                                "rgb(81, 222, 255)",
                                              boxShadow:
                                                "0 10px 15px -3px rgba(81, 222, 255, 0.4)",
                                            }
                                          : {}
                                      }
                                    >
                                      {notifyLoadingKey === "driver-whatsapp" &&
                                      step.id === "received" &&
                                      driverNotifyTargetCycleIndex ===
                                        cycle.itineraryIndex ? (
                                        <Loader2
                                          size={24}
                                          className="animate-spin"
                                        />
                                      ) : (
                                        step.icon
                                      )}
                                    </div>
                                    <div className="mt-4 text-center space-y-1">
                                      <p
                                        className={`text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${step.active ? "text-slate-900" : "text-slate-400"}`}
                                      >
                                        {step.label}
                                      </p>
                                      <p
                                        className={`text-[10px] font-bold transition-colors ${step.active ? "text-slate-500" : "text-slate-300"}`}
                                      >
                                        {step.sublabel}
                                      </p>
                                      {step.timestamp && (
                                        <p className="text-[13px] font-medium text-slate-400">
                                          {new Date(
                                            step.timestamp,
                                          ).toLocaleString("pt-BR", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </p>
                                      )}
                                    </div>
                                    {step.active && (
                                      <div
                                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center"
                                        style={{
                                          backgroundColor: "rgb(81, 222, 255)",
                                        }}
                                      >
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
                                      </div>
                                    )}
                                  </button>
                                  {openDriverNotifyMenu &&
                                    driverNotifyMenuPos &&
                                    driverNotifyTargetCycleIndex ===
                                      cycle.itineraryIndex &&
                                    createPortal(
                                      <div
                                        data-driver-notify-menu
                                        style={{
                                          position: "fixed",
                                          left: driverNotifyMenuPos.x + 8,
                                          top: driverNotifyMenuPos.y,
                                        }}
                                        className="z-[9999] min-w-[240px] bg-white rounded-2xl border border-slate-200 shadow-xl p-2 space-y-1"
                                      >
                                        <p className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                          <MessageCircle size={12} />
                                          Enviar WhatsApp
                                        </p>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            const cycles =
                                              viewingOS?.operationalCycles ??
                                              [];
                                            const targetCycle = cycles.find(
                                              (c) =>
                                                c.itineraryIndex ===
                                                cycle.itineraryIndex,
                                            );

                                            if (targetCycle?.messageSentAt) {
                                              let senderName = "usuário";
                                              if (targetCycle.messageSentById) {
                                                const {
                                                  data: senderData,
                                                  error: senderError,
                                                } = await supabase
                                                  .from("user_roles")
                                                  .select("nome")
                                                  .eq(
                                                    "id",
                                                    targetCycle.messageSentById,
                                                  )
                                                  .maybeSingle();
                                                if (senderError) {
                                                  console.error(
                                                    "[Resend] Erro ao buscar nome do remetente:",
                                                    senderError,
                                                  );
                                                }
                                                if (senderData?.nome) {
                                                  senderName = senderData.nome;
                                                } else {
                                                  console.warn(
                                                    "[Resend] Nome não encontrado para senderId:",
                                                    targetCycle.messageSentById,
                                                    "senderData:",
                                                    senderData,
                                                  );
                                                }
                                              } else {
                                                console.warn(
                                                  "[Resend] messageSentById está vazio para o ciclo",
                                                  cycle.itineraryIndex,
                                                );
                                              }

                                              setResendConfirmInfo({
                                                date: targetCycle.messageSentAt,
                                                userName: senderName,
                                              });
                                            } else {
                                              setResendConfirmInfo(null);
                                            }

                                            setResendConfirmCycleIndex(
                                              cycle.itineraryIndex,
                                            );
                                            setShowResendConfirm(true);
                                            setOpenDriverNotifyMenu(false);
                                            setDriverNotifyMenuPos(null);
                                            setDriverNotifyTargetCycleIndex(
                                              null,
                                            );
                                          }}
                                          disabled={!!notifyLoadingKey}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                                        >
                                          <Link size={14} />
                                          {notifyLoadingKey ===
                                          "driver-whatsapp"
                                            ? "Enviando..."
                                            : "Enviar link de aceite"}
                                        </button>
                                      </div>,
                                      document.body,
                                    )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  // isCycleFinished é derivado do cycle.state vindo do banco (via syncOSSnapshot).
                                  // O atributo disabled nativo do HTML impede qualquer clique sem depender de JS do cliente.
                                  // O backend também rejeita (409) se o estado for completed/cancelled — dupla proteção.
                                  disabled={
                                    isArchived ||
                                    (step.id === "finished" &&
                                      (cycle.state === "completed" ||
                                        cycle.state === "cancelled" ||
                                        !!cycle.finishedAt))
                                  }
                                  className="flex flex-col items-center group cursor-pointer"
                                  onClick={() => {
                                    if (step.id === "finished") {
                                      setSelectedCycleIndex(
                                        cycle.itineraryIndex,
                                      );
                                      setShowFinishConfirm(true);
                                    }
                                    // accepted e started: sem ação (Resetar cobre esses casos)
                                  }}
                                >
                                  <div
                                    className={`
                              w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg
                              ${!step.active ? "bg-white border-2 border-slate-200 text-slate-400" : "text-white"}
                              ${!isArchived && !step.active && !(step.id === "finished" && (cycle.state === "completed" || cycle.state === "cancelled" || !!cycle.finishedAt)) ? "group-hover:border-slate-300" : ""}
                              ${!isArchived && !(step.id === "finished" && (cycle.state === "completed" || cycle.state === "cancelled" || !!cycle.finishedAt)) ? "group-hover:scale-110 group-active:scale-95" : ""}
                            `}
                                    style={
                                      step.active
                                        ? {
                                            backgroundColor:
                                              step.id === "accepted"
                                                ? "rgb(26, 238, 172)"
                                                : step.id === "started"
                                                  ? "#2563eb"
                                                  : "#10b981",
                                            boxShadow: `0 10px 15px -3px ${step.id === "accepted" ? "rgba(26, 238, 172, 0.4)" : step.id === "started" ? "rgba(37, 99, 235, 0.4)" : "rgba(16, 185, 129, 0.4)"}`,
                                          }
                                        : {}
                                    }
                                  >
                                    {step.icon}
                                  </div>
                                  <div className="mt-4 text-center space-y-1">
                                    <p
                                      className={`text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${step.active ? "text-slate-900" : "text-slate-400"}`}
                                    >
                                      {step.label}
                                    </p>
                                    <p
                                      className={`text-[10px] font-bold transition-colors ${step.active ? "text-slate-500" : "text-slate-300"}`}
                                    >
                                      {step.sublabel}
                                    </p>
                                    {step.timestamp && (
                                      <p className="text-[13px] font-medium text-slate-400">
                                        {new Date(
                                          step.timestamp,
                                        ).toLocaleString("pt-BR", {
                                          day: "2-digit",
                                          month: "2-digit",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </p>
                                    )}
                                    {typeof step.km === "number" && (
                                      <div className="flex items-center gap-1">
                                        <p className="text-[13px] font-black text-slate-600">
                                          KM: {step.km.toLocaleString("pt-BR")}
                                        </p>
                                        {!isArchived && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setKmEditCycleIndex(
                                                cycle.itineraryIndex,
                                              );
                                              setKmEditField(
                                                step.id === "started"
                                                  ? "initial"
                                                  : "final",
                                              );
                                              setKmEditCurrentValue(
                                                step.km ?? null,
                                              );
                                              setKmEditNewValue(
                                                String(step.km),
                                              );
                                              setKmEditReason("");
                                              setKmEditBypass(false);
                                              setKmEditOdometerWarning(null);
                                              setShowKmEdit(true);
                                            }}
                                            className="p-0.5 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                                            title="Editar KM"
                                          >
                                            <Pencil size={12} />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {step.active && (
                                    <div
                                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center"
                                      style={{
                                        backgroundColor:
                                          step.id === "accepted"
                                            ? "rgb(26, 238, 172)"
                                            : step.id === "started"
                                              ? "#2563eb"
                                              : "#10b981",
                                      }}
                                    >
                                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
                                    </div>
                                  )}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* ── Logs do Ciclo (colapsável) ── */}
                        {(() => {
                          const cycleLogs = osLogs.filter((log) => {
                            if (log.os_id !== viewingOS?.id) return false;
                            const meta = log.metadata as Record<
                              string,
                              unknown
                            > | null;
                            const logCycleIndex =
                              typeof meta?.cycle_index === "number"
                                ? meta.cycle_index
                                : null;
                            return logCycleIndex === cycle.itineraryIndex;
                          });
                          if (cycleLogs.length === 0) return null;
                          return (
                            <div className="mt-4 border-t border-slate-200 pt-4">
                              <details className="group">
                                <summary className="flex items-center gap-2 cursor-pointer list-none">
                                  <History
                                    size={14}
                                    className="text-slate-400 group-open:text-blue-500 transition-colors"
                                  />
                                  <span className="text-xs font-bold text-slate-500 group-open:text-slate-800 transition-colors">
                                    Histórico do ciclo ({cycleLogs.length})
                                  </span>
                                  <ChevronDown
                                    size={14}
                                    className="text-slate-400 ml-auto transition-transform group-open:rotate-180"
                                  />
                                </summary>
                                <div className="mt-3 space-y-2 pl-5 border-l-2 border-slate-100 max-h-48 overflow-y-auto pr-2">
                                  {cycleLogs.map((log) => {
                                    const logTone = getOSLogTone(
                                      log.type as OSLogType,
                                    );
                                    const logDate = new Date(log.created_at);
                                    const logTime = logDate.toLocaleString(
                                      "pt-BR",
                                      {
                                        day: "2-digit",
                                        month: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    );
                                    return (
                                      <div
                                        key={log.id}
                                        className="flex items-start gap-2 text-sm py-1.5 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors px-1.5 -mx-1.5"
                                      >
                                        <span
                                          className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${logTone.dotClass}`}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-baseline justify-between gap-2">
                                            <p className="font-bold text-slate-700 leading-snug text-sm">
                                              {log.description}
                                            </p>
                                            <span className="text-sm text-slate-400 flex-shrink-0 mr-3">
                                              {logTime}
                                            </span>
                                          </div>
                                          {log.actor_name && (
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                              {log.actor_avatar_url ? (
                                                <img
                                                  src={
                                                    getThumbnailUrl(
                                                      log.actor_avatar_url,
                                                      40,
                                                    ) || ""
                                                  }
                                                  alt={log.actor_name}
                                                  className="w-5 h-5 rounded-full object-cover border border-slate-200"
                                                />
                                              ) : (
                                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 text-white text-[10px] font-black flex items-center justify-center">
                                                  {log.actor_name
                                                    .charAt(0)
                                                    .toUpperCase()}
                                                </div>
                                              )}
                                              <p className="text-sm text-slate-500">
                                                {log.actor_name}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </details>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grid para Trajeto e Resumo - Agora lado a lado */}
              <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-8 items-stretch">
                {/* Trajeto do Atendimento */}
                <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <MapPin className="text-blue-600" size={22} />
                      <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-[0.08em]">
                          Trajeto do Atendimento
                        </h3>
                        <p className="text-sm font-semibold text-slate-400 mt-1">
                          Pontos de parada e rota definida para esta OS.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="relative pl-8 space-y-8">
                    {(() => {
                      const viewingItineraries = getItineraries(
                        (viewingOS.rota?.waypoints || []) as FormWaypoint[],
                      );
                      return viewingItineraries.map((it) => (
                        <div key={it.index} className="space-y-6">
                          {viewingItineraries.length > 1 && (
                            <h4 className="flex items-center gap-2 mb-6">
                              {it.index < 0 ? (
                                <ArrowLeft
                                  size={18}
                                  className="text-purple-500"
                                />
                              ) : (
                                <ArrowRight
                                  size={18}
                                  className="text-amber-500"
                                />
                              )}
                              <span
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-xl text-sm font-black shadow-sm ${it.index < 0 ? "bg-purple-100 text-purple-700 ring-2 ring-purple-200" : "bg-amber-100 text-amber-700 ring-2 ring-amber-200"}`}
                              >
                                {it.index < 0
                                  ? Math.abs(it.index)
                                  : it.index + 1}
                              </span>
                              <span
                                className={`text-[13px] font-black uppercase tracking-[0.15em] ${it.index < 0 ? "text-purple-700" : "text-amber-700"}`}
                              >
                                {getItineraryTitle(it.index)}
                              </span>
                            </h4>
                          )}
                          <div className="relative flex flex-col gap-8">
                            {/* Linha vertical conectando os pontos do itinerário */}
                            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 border-l-2 border-dashed border-slate-200"></div>

                            {it.waypoints.map((waypoint, relIdx) => {
                              const isOrigin = relIdx === 0;
                              const isDestination =
                                relIdx === it.waypoints.length - 1;
                              const globalIdx = it.waypointIndices[relIdx];

                              return (
                                <div
                                  key={globalIdx}
                                  className="relative flex items-center gap-6 group"
                                >
                                  <div
                                    className={`
                                    relative z-10 w-6 h-6 rounded-full border-4 border-white shadow-md transition-all duration-300
                                    ${isOrigin ? "bg-emerald-500 scale-125" : isDestination ? "bg-blue-600 scale-125" : "bg-slate-300"}
                                    group-hover:scale-150
                                  `}
                                  ></div>
                                  <div
                                    className={`
                                    flex-1 p-4 rounded-2xl border transition-all duration-300
                                    ${isOrigin ? "bg-emerald-50 border-emerald-100" : isDestination ? "bg-blue-50 border-blue-100" : "bg-slate-50 border-slate-100"}
                                    group-hover:shadow-md group-hover:bg-white
                                  `}
                                  >
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                      {isOrigin
                                        ? "Origem"
                                        : isDestination
                                          ? "Destino Final"
                                          : `${relIdx}ª Parada`}
                                    </p>
                                    <p className="text-base font-black text-slate-800 uppercase tracking-tight">
                                      {waypoint.label}
                                    </p>
                                    {waypoint.comment && (
                                      <p className="mt-2 text-sm font-semibold text-slate-500 bg-white/50 p-2 rounded-lg border border-slate-100 italic">
                                        &quot;{waypoint.comment}&quot;
                                      </p>
                                    )}
                                    {(waypoint.passengers || []).length > 0 && (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {(waypoint.passengers || []).map(
                                          (p, pi) => {
                                            const pRec = getPassengerRecord(
                                              p.solicitanteId || "",
                                            );
                                            return (
                                              <span
                                                key={pi}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100 text-sm font-bold text-blue-700"
                                              >
                                                <User size={12} />
                                                {pRec?.nomeCompleto ||
                                                  "Passageiro"}
                                              </span>
                                            );
                                          },
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Logs de Atendimento */}
                <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm space-y-6 flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <History className="text-blue-600" size={22} />
                      <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-[0.08em]">
                          Logs de Atendimento
                        </h3>
                        <p className="text-sm font-semibold text-slate-400 mt-1">
                          Histórico completo de ações e mudanças nesta OS.
                        </p>
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-black uppercase tracking-[0.18em] text-slate-600">
                      {osLogs.length > 0 ? osLogs.length : viewingOS ? 1 : 0}{" "}
                      registro(s)
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[500px] pr-2 relative">
                    {/* Linha da Timeline */}
                    <div className="absolute left-[27px] top-4 bottom-4 w-px bg-slate-100" />

                    <div className="space-y-6 relative">
                      {osLogs.length === 0 && viewingOS && (
                        <div className="flex items-start gap-4 group">
                          <div className="relative z-10 flex items-center justify-center w-6 h-6 mt-1 ml-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm" />
                          <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm group-hover:shadow-md transition-all">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                                Criação
                              </span>
                              <span className="text-[11px] font-bold text-slate-400">
                                {viewingOS.createdAt
                                  ? new Date(
                                      viewingOS.createdAt,
                                    ).toLocaleString("pt-BR", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : viewingOS.data}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-slate-700">
                              <span>
                                <span className="text-slate-400 mr-1">
                                  Autor:
                                </span>
                                {users.find((u) => u.id === viewingOS.createdBy)
                                  ?.nome || "Sistema"}
                              </span>
                              <span>
                                <span className="text-slate-400 mr-1">
                                  Protocolo:
                                </span>
                                {viewingOS.protocolo || "Não informado"}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {osLogs.map((log) => {
                        const date = new Date(log.created_at);
                        const timeStr = date.toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        const tone = getOSLogTone(log.type);
                        const highlightTags = getOSLogHighlightTags(
                          log.type,
                          log.metadata,
                        );
                        const fullActorName = log.actor_name || "Sistema";
                        const actorKind = getOSLogActorKind(
                          log.type as never,
                          log.actor_id,
                        );
                        const actorPhrase = getOSLogActorPhrase(
                          log.type as never,
                          log.actor_name || "",
                          log.actor_id,
                        );
                        const actorParts =
                          fullActorName.split(" ").filter(Boolean) || [];
                        const actorLabel =
                          actorParts.length <= 2
                            ? fullActorName
                            : `${actorParts[0]} ${actorParts[actorParts.length - 1]}`;
                        const actorInitials = fullActorName
                          .split(" ")
                          .filter(Boolean)
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase();

                        return (
                          <div
                            key={log.id}
                            className="flex items-start gap-4 group"
                          >
                            {/* Dot na Timeline */}
                            <div
                              className={`relative z-10 flex items-center justify-center w-6 h-6 mt-1 ml-4 rounded-full border-4 border-white shadow-sm ${tone.dotClass}`}
                            />

                            {/* Card de Conteúdo */}
                            <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm group-hover:shadow-md group-hover:border-slate-300 transition-all duration-200">
                              {/* Header do Card */}
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${tone.badgeClass}`}
                                >
                                  {tone.label}
                                </span>
                                <div className="text-right">
                                  <span className="block text-[11px] font-bold text-slate-500 leading-none mb-1">
                                    {timeStr}
                                  </span>
                                  <span className="block text-[10px] font-medium text-slate-400">
                                    por{" "}
                                    <span className="font-bold text-slate-500">
                                      {actorKind === "driver"
                                        ? `Motorista ${actorLabel}`
                                        : actorLabel}
                                    </span>
                                  </span>
                                </div>
                              </div>

                              {/* Conteúdo Principal */}
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0">
                                  {log.actor_avatar_url ? (
                                    <img
                                      src={
                                        getThumbnailUrl(
                                          log.actor_avatar_url,
                                          80,
                                        ) || ""
                                      }
                                      alt={fullActorName}
                                      className="w-10 h-10 rounded-full object-cover border-2 border-slate-50 shadow-sm"
                                    />
                                  ) : actorKind === "driver" ? (
                                    <span
                                      className={`w-10 h-10 rounded-full bg-gradient-to-br ${tone.avatarClass} text-white flex items-center justify-center border-2 border-slate-50 shadow-sm`}
                                    >
                                      <Truck size={18} />
                                    </span>
                                  ) : (
                                    <span
                                      className={`w-10 h-10 rounded-full bg-gradient-to-br ${tone.avatarClass} text-white text-[10px] font-black flex items-center justify-center border-2 border-slate-50 shadow-sm`}
                                    >
                                      {actorInitials || "S"}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-slate-800 leading-tight mb-1">
                                    {actorPhrase}
                                  </p>
                                  <p className="text-sm font-medium text-slate-500 leading-snug mb-3">
                                    {log.description}
                                  </p>

                                  {highlightTags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {highlightTags.map((tag) => {
                                        const style =
                                          TAG_CATEGORY_STYLES[tag.category];
                                        const iconMap: Record<
                                          OSLogHighlightTag["category"],
                                          React.ReactNode
                                        > = {
                                          action: <RefreshCw size={10} />,
                                          cycle: <Route size={10} />,
                                          state: <Activity size={10} />,
                                          field: <Edit3 size={10} />,
                                          km: <Gauge size={10} />,
                                          section: <Layers size={10} />,
                                        };

                                        const arrowIdx =
                                          tag.label.indexOf(" → ");
                                        const colonIdx =
                                          tag.label.indexOf(": ");
                                        const hasChange =
                                          tag.category === "field" &&
                                          arrowIdx > 0 &&
                                          colonIdx > 0;

                                        if (hasChange) {
                                          const field = tag.label.slice(
                                            0,
                                            colonIdx,
                                          );
                                          const before = tag.label.slice(
                                            colonIdx + 2,
                                            arrowIdx,
                                          );
                                          const after = tag.label.slice(
                                            arrowIdx + 3,
                                          );
                                          return (
                                            <div
                                              key={`${log.id}-${tag.label}`}
                                              className="flex flex-col gap-1"
                                            >
                                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                                                {iconMap.field}
                                                {field}
                                              </span>
                                              <div className="flex items-center gap-1.5">
                                                <span className="inline-flex items-center rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-100 line-through opacity-80">
                                                  {before}
                                                </span>
                                                <ArrowRight
                                                  size={10}
                                                  className="text-slate-300"
                                                />
                                                <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100 shadow-sm">
                                                  {after}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        }

                                        return (
                                          <span
                                            key={`${log.id}-${tag.label}`}
                                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-tight transition-colors ${style.badge}`}
                                          >
                                            {iconMap[tag.category]}
                                            {tag.label}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-[0.08em]">
                    Passageiros monitorados
                  </h3>
                  <p className="text-sm font-semibold text-slate-400">
                    Sempre que houver passageiro vinculado na rota, ele aparece
                    aqui com visão de contato e engajamento do fluxo.
                  </p>
                </div>
                <div className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-black uppercase tracking-[0.18em] text-slate-600">
                  {operationalPassengerList.length} passageiro(s)
                </div>
              </div>

              {operationalPassengerList.length > 0 ? (
                <div className="overflow-hidden rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200">
                          <th className="px-6 py-4 text-left text-[12px] font-black uppercase tracking-widest text-slate-600 w-[25%]">
                            Passageiro
                          </th>
                          <th className="px-6 py-4 text-left text-[12px] font-black uppercase tracking-widest text-slate-600 w-[20%]">
                            Contato
                          </th>
                          <th className="px-6 py-4 text-left text-[12px] font-black uppercase tracking-widest text-slate-600 w-[40%]">
                            Endereço
                          </th>
                          <th className="px-6 py-4 text-left text-[12px] font-black uppercase tracking-widest text-slate-600 w-[15%]">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {operationalPassengerList.map((passenger) => (
                          <tr
                            key={passenger.key}
                            className="hover:bg-slate-50/50 transition-colors cursor-default group"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                  <User size={18} className="text-blue-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-800">
                                    {passenger.nome}
                                  </p>
                                  <p className="text-xs font-semibold text-slate-400 mt-0.5">
                                    {passenger.email}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <MessageCircle
                                  size={14}
                                  className="text-slate-400 shrink-0"
                                />
                                <p className="text-sm font-semibold text-slate-600">
                                  {passenger.celular}
                                </p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-start gap-2 max-w-[280px]">
                                <MapPin
                                  size={14}
                                  className="text-slate-400 shrink-0 mt-0.5"
                                />
                                <p className="text-sm font-medium text-slate-600 line-clamp-2">
                                  {passenger.endereco}
                                </p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {passengerConfirmations[
                                passenger.solicitanteId
                              ] ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] bg-green-50 border-green-200 text-green-700">
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                  Confirmado
                                </span>
                              ) : effectiveOperationalStatus === "Pendente" ? (
                                <div className="relative inline-block">
                                  <button
                                    type="button"
                                    data-notify-button
                                    onClick={(e) => {
                                      const rect = (
                                        e.currentTarget as HTMLElement
                                      ).getBoundingClientRect();
                                      setNotifyMenuPosition({
                                        x: rect.left,
                                        y: rect.top,
                                      });
                                      setOpenNotifyMenuKey(
                                        openNotifyMenuKey === passenger.key
                                          ? null
                                          : passenger.key,
                                      );
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                                    title="Abrir opções de notificação"
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                    Aguardando
                                    <ChevronDown size={12} />
                                  </button>
                                  {openNotifyMenuKey === passenger.key &&
                                    notifyMenuPosition && (
                                      <div
                                        data-notify-menu
                                        style={{
                                          position: "fixed",
                                          left: notifyMenuPosition.x,
                                          bottom:
                                            typeof window !== "undefined"
                                              ? window.innerHeight -
                                                notifyMenuPosition.y +
                                                8
                                              : 0,
                                          transform: "translateX(-25%)",
                                        }}
                                        className="z-[9999] min-w-[220px] bg-white rounded-2xl border border-slate-200 shadow-xl p-2 space-y-1"
                                      >
                                        <p className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                          <Bell size={12} />
                                          Notificar passageiro
                                        </p>
                                        {passenger.hasEmail && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleNotifyPassenger(
                                                passenger.key,
                                                "email",
                                                passenger,
                                              )
                                            }
                                            disabled={!!notifyLoadingKey}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                                          >
                                            <Mail size={14} />
                                            {notifyLoadingKey === passenger.key
                                              ? "Enviando..."
                                              : "Por e-mail"}
                                          </button>
                                        )}
                                        {passenger.hasPhone && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleNotifyPassenger(
                                                passenger.key,
                                                "whatsapp",
                                                passenger,
                                              )
                                            }
                                            disabled={!!notifyLoadingKey}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-green-50 hover:text-green-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                                          >
                                            <Smartphone size={14} />
                                            {notifyLoadingKey === passenger.key
                                              ? "Enviando..."
                                              : "Por celular"}
                                          </button>
                                        )}
                                        {passenger.hasEmail &&
                                          passenger.hasPhone && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleNotifyPassenger(
                                                  passenger.key,
                                                  "both",
                                                  passenger,
                                                )
                                              }
                                              disabled={!!notifyLoadingKey}
                                              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                                            >
                                              <Send size={14} />
                                              {notifyLoadingKey ===
                                              passenger.key
                                                ? "Enviando..."
                                                : "Ambos"}
                                            </button>
                                          )}
                                      </div>
                                    )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] bg-emerald-50 border-emerald-200 text-emerald-700">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Ativo
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="text-base font-black text-slate-700">
                    Nenhum passageiro vinculado visualmente à rota desta OS.
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-400">
                    Assim que houver passageiros adicionados nos waypoints, o
                    painel mostrará contatos e situação do fluxo.
                  </p>
                </div>
              )}
            </div>
          </div>
        </StandardModal>
      )}

      {cancelTargetOS && (
        <StandardModal
          onClose={() => setCancelTargetId(null)}
          title="Confirmar cancelamento"
          subtitle={`OS ${cancelTargetOS.os || cancelTargetOS.protocolo}`}
          icon={<AlertTriangle size={24} />}
          maxWidthClassName="max-w-2xl"
          bodyClassName="p-6 md:p-10 space-y-8"
          footer={
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => setCancelTargetId(null)}
                className="px-6 py-3 text-slate-500 font-black rounded-xl border border-slate-200 hover:bg-white transition-all uppercase tracking-widest text-xs"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmCancelOS}
                className="px-8 py-3 bg-rose-600 text-white font-black rounded-xl shadow-lg shadow-rose-900/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest text-xs"
              >
                Confirmar cancelamento
              </button>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="rounded-3xl border border-rose-100 bg-rose-50 p-6">
              <p className="text-base font-black text-rose-700">
                Tem certeza que deseja cancelar esta Ordem de Serviço?
              </p>
              <p className="mt-2 text-sm font-semibold text-rose-600/80">
                Essa ação altera o status operacional para cancelado e sinaliza
                visualmente para toda a operação.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Protocolo
                </p>
                <p className="mt-2 text-base font-black text-slate-900">
                  {cancelTargetOS.protocolo}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Motorista
                </p>
                <p className="mt-2 text-base font-black text-slate-900">
                  {cancelTargetOS.motorista || "Não definido"}
                </p>
              </div>
            </div>
          </div>
        </StandardModal>
      )}

      {/* Modal Cadastro Rápido */}
      {quickAddModal && (
        <StandardModal
          onClose={closeQuickAddModal}
          title={`Novo ${quickAddModal === "cliente" ? "Empresa" : quickAddModal === "motorista" ? "Motorista" : quickAddModal === "solicitante" ? "Solicitante" : "Centro de Custo"}`}
          subtitle="Cadastro rápido direto no atendimento"
          icon={
            quickAddModal === "motorista" ? (
              <UserPlus size={24} />
            ) : (
              <Plus size={24} />
            )
          }
          maxWidthClassName={
            quickAddModal === "motorista" ? "max-w-7xl" : "max-w-2xl"
          }
          bodyClassName={
            quickAddModal === "motorista"
              ? "p-6 md:p-10 pb-16 space-y-12"
              : undefined
          }
        >
          {quickAddModal === "motorista" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleQuickAddSubmit();
              }}
              className="space-y-12"
            >
              <section className="space-y-6">
                <div
                  className="flex items-center border-b-2 border-slate-100 pb-4"
                  style={{ paddingBottom: "1.25rem" }}
                >
                  <h3
                    className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                    style={{ lineHeight: "1.3" }}
                  >
                    <IdCard size={20} className="text-slate-500" /> Informações
                    do Motorista
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="space-y-2 w-full md:w-[45%]">
                      <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                        Nome completo{" "}
                        <span className="text-rose-300 text-base">*</span>
                      </label>
                      <input
                        required
                        pattern=".*\s+\S.*"
                        title="Nome completo deve conter pelo menos nome e sobrenome."
                        placeholder="Ex: João Silva da Rocha"
                        value={quickAddDriverForm.name}
                        onChange={(e) =>
                          setQuickAddDriverForm((prev) => ({
                            ...prev,
                            name: forceUpperText(e.target.value),
                          }))
                        }
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm uppercase"
                      />
                    </div>
                    <div className="space-y-2 w-full md:w-48">
                      <GeologSearchableSelect
                        label="Tipo"
                        options={tipoDocumentoOptions}
                        value={quickAddDriverForm.tipo_documento}
                        onChange={(value) =>
                          setQuickAddDriverForm((prev) => ({
                            ...prev,
                            tipo_documento: value as "cpf" | "passaporte",
                            cpf: formatDriverDocument(
                              prev.cpf,
                              value as "cpf" | "passaporte",
                            ),
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2 w-full md:w-48">
                      <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                        {getDriverDocumentLabel(
                          quickAddDriverForm.tipo_documento,
                        )}{" "}
                        <span className="text-rose-300 text-base">*</span>
                      </label>
                      <input
                        required
                        pattern={
                          quickAddDriverForm.tipo_documento === "cpf"
                            ? "\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}"
                            : undefined
                        }
                        title={
                          quickAddDriverForm.tipo_documento === "cpf"
                            ? "CPF incompleto. Use o formato 000.000.000-00"
                            : undefined
                        }
                        placeholder={getDriverDocumentPlaceholder(
                          quickAddDriverForm.tipo_documento,
                        )}
                        value={quickAddDriverForm.cpf}
                        onChange={(e) =>
                          setQuickAddDriverForm((prev) => ({
                            ...prev,
                            cpf: formatDriverDocument(
                              e.target.value,
                              prev.tipo_documento,
                            ),
                          }))
                        }
                        className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-2 w-full md:w-52">
                      <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                        Celular{" "}
                        <span className="text-rose-300 text-base">*</span>
                      </label>
                      <input
                        required
                        title="Celular incompleto. Use o formato (00) 00000-0000"
                        placeholder="(00) 9XXXX-XXXX"
                        value={formatDriverCelular(quickAddDriverForm.celular)}
                        onChange={(e) => {
                          const digitsOnly = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 11);
                          setQuickAddDriverForm((prev) => ({
                            ...prev,
                            celular: digitsOnly,
                          }));
                        }}
                        className={`w-full px-4 py-4 bg-slate-50 border-2 rounded-xl font-bold text-base text-slate-900 outline-none focus:bg-white transition-all shadow-sm ${
                          quickAddDriverForm.celular &&
                          !validateDriverCelular(quickAddDriverForm.celular)
                            ? "border-red-500 focus:border-red-500"
                            : "border-slate-200 focus:border-blue-600"
                        }`}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row gap-6 items-start w-full">
                    <div className="flex flex-wrap gap-3 w-full md:w-[45%]">
                      <button
                        type="button"
                        onClick={() =>
                          setQuickAddDriverForm((prev) => ({
                            ...prev,
                            vinculo_tipo: "interno",
                            parceiro_id: "",
                            vehicle_ids: [],
                            tipo_documento: "cpf",
                          }))
                        }
                        className={`cursor-pointer flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 font-black text-sm uppercase tracking-widest transition-all whitespace-nowrap ${
                          quickAddDriverForm.vinculo_tipo === "interno"
                            ? "bg-blue-600 border-blue-600 text-white shadow-md"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600"
                        }`}
                      >
                        <Building2 size={16} /> Interno
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQuickAddDriverForm((prev) => ({
                            ...prev,
                            vinculo_tipo: "autonomo",
                            parceiro_id: "",
                            vehicle_ids: [],
                            tipo_documento: "cpf",
                          }))
                        }
                        className={`cursor-pointer flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 font-black text-sm uppercase tracking-widest transition-all whitespace-nowrap ${
                          quickAddDriverForm.vinculo_tipo === "autonomo"
                            ? "bg-amber-500 border-amber-500 text-white shadow-md"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600"
                        }`}
                      >
                        <User size={16} /> Autônomo
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQuickAddDriverForm((prev) => ({
                            ...prev,
                            vinculo_tipo: "parceiro",
                            parceiro_id: "",
                            vehicle_ids: [],
                            tipo_documento: "cpf",
                          }))
                        }
                        className={`cursor-pointer flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 font-black text-sm uppercase tracking-widest transition-all whitespace-nowrap ${
                          quickAddDriverForm.vinculo_tipo === "parceiro"
                            ? "bg-teal-500 border-teal-500 text-white shadow-md"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:border-teal-300 hover:text-teal-600"
                        }`}
                      >
                        <Handshake size={16} /> Parceiro
                      </button>
                    </div>

                    <div className="flex-[1.5] w-full min-h-[84px]">
                      {quickAddDriverForm.vinculo_tipo === "parceiro" && (
                        <div className="w-full animate-in fade-in slide-in-from-left-2 duration-300">
                          <GeologSearchableSelect
                            label=""
                            options={parceiroOptions}
                            value={quickAddDriverForm.parceiro_id}
                            onChange={(value) =>
                              setQuickAddDriverForm((prev) => ({
                                ...prev,
                                parceiro_id: value,
                                vehicle_ids: [],
                              }))
                            }
                            placeholder="Selecione o parceiro de serviço..."
                            onQuickAdd={() => {
                              setQuickParceiroForm({
                                pessoaTipo: "juridica",
                                documento: "",
                                razaoSocialOuNomeCompleto: "",
                                contatos: [
                                  {
                                    setor: "",
                                    celular: "",
                                    email: "",
                                    responsavel: "",
                                  },
                                ],
                              });
                              setIsQuickParceiroModalOpen(true);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Seção de Veículos Vinculados */}
              <section className="space-y-6">
                <div
                  className="flex items-center justify-between border-b-2 border-slate-100 pb-4"
                  style={{ paddingBottom: "1.25rem" }}
                >
                  <h3
                    className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                    style={{ lineHeight: "1.3" }}
                  >
                    <Truck size={20} className="text-slate-500" /> Veículos
                    Vinculados
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setQuickAddDriverForm((prev) => ({
                        ...prev,
                        vehicle_ids: [
                          ...prev.vehicle_ids,
                          filteredQuickAddVehicles.find(
                            (v) => !prev.vehicle_ids.includes(v.id),
                          )?.id || "",
                        ],
                      }))
                    }
                    disabled={
                      filteredQuickAddVehicles.filter(
                        (v) => !quickAddDriverForm.vehicle_ids.includes(v.id),
                      ).length === 0
                    }
                    className="flex items-center gap-3 px-4 py-3 bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-200 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlusCircle size={14} /> Adicionar veículo
                  </button>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="hidden md:grid grid-cols-[2fr_2fr_auto] gap-4 bg-slate-50/80 border-b border-slate-200 px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-600">
                    <span>Veículo</span>
                    <span className="ml-8">Placa</span>
                    <span className="text-right">Ações</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[30vh] overflow-y-auto custom-scrollbar">
                    {quickAddDriverForm.vehicle_ids.length === 0 && (
                      <div className="px-6 py-8 text-center text-slate-400 text-sm">
                        Nenhum veículo vinculado. Clique em &quot;Adicionar
                        veículo&quot; acima.
                      </div>
                    )}
                    {quickAddDriverForm.vehicle_ids.map((vehicleId, index) => {
                      const vehicle = vehicles.find((v) => v.id === vehicleId);
                      const availableVehiclesForThisRow =
                        filteredQuickAddVehicles.filter(
                          (v) =>
                            v.id === vehicleId ||
                            !quickAddDriverForm.vehicle_ids.includes(v.id),
                        );
                      return (
                        <div
                          key={index}
                          className="grid grid-cols-1 md:grid-cols-[2fr_2fr_auto] gap-4 items-center px-6 py-4"
                        >
                          <div className="space-y-2">
                            <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              Veículo
                            </label>
                            <GeologSearchableSelect
                              label=""
                              options={availableVehiclesForThisRow.map((v) => ({
                                id: v.id,
                                nome: `${v.marca} ${v.modelo}`,
                                sublabel: v.placa,
                              }))}
                              value={vehicleId}
                              onChange={(value) =>
                                setQuickAddDriverForm((prev) => ({
                                  ...prev,
                                  vehicle_ids: prev.vehicle_ids.map(
                                    (id, idx) => (idx === index ? value : id),
                                  ),
                                }))
                              }
                              placeholder="Selecione o veículo..."
                            />
                          </div>
                          <div className="space-y-1 ml-5">
                            <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              Placa
                            </label>
                            <div className="w-[120px] bg-white border-2 border-slate-400 rounded-md overflow-hidden shadow-sm flex flex-col items-center">
                              <div className="w-full bg-blue-600 h-1" />
                              <div className="py-3 px-4 flex items-center justify-center">
                                <span className="text-[15px] font-black text-slate-900 uppercase tracking-widest leading-none">
                                  {vehicle?.placa || "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (!vehicleId) return;
                                const v = vehicles.find(
                                  (veh) => veh.id === vehicleId,
                                );
                                if (!v) return;
                                setVehicleQuickForm({
                                  placa: v.placa,
                                  modelo: v.modelo,
                                  marca: v.marca,
                                  tipo: "carro",
                                });
                                setQuickVehicleModal({
                                  mode: "edit",
                                  rowIndex: index,
                                  vehicleId: v.id,
                                });
                              }}
                              disabled={!vehicleId}
                              className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label="Editar veículo"
                              title="Editar veículo"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setVehicleQuickForm({
                                  placa: "",
                                  modelo: "",
                                  marca: "",
                                  tipo: "carro",
                                });
                                setQuickVehicleModal({
                                  mode: "create",
                                  rowIndex: index,
                                });
                              }}
                              className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all cursor-pointer"
                              aria-label="Cadastrar novo veículo"
                              title="Cadastrar novo veículo"
                            >
                              <Car size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setQuickAddDriverForm((prev) => ({
                                  ...prev,
                                  vehicle_ids: prev.vehicle_ids.filter(
                                    (_, idx) => idx !== index,
                                  ),
                                }))
                              }
                              className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                              aria-label="Remover veículo"
                              title="Remover veículo"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={closeQuickAddModal}
                  className="px-6 py-3 text-slate-500 font-black rounded-xl border border-slate-200 hover:bg-white transition-all uppercase tracking-widest text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-green-600 text-white font-black rounded-xl shadow-lg shadow-green-900/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest text-xs cursor-pointer"
                >
                  Salvar motorista
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleQuickAddSubmit();
              }}
              noValidate
              className="space-y-6"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Nome <span className="text-rose-300 text-base">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={
                      quickAddModal === "cliente"
                        ? quickAddForm.nome
                        : forceUpperText(quickAddForm.nome)
                    }
                    onChange={(e) =>
                      setQuickAddForm((prev) => ({
                        ...prev,
                        nome:
                          quickAddModal === "cliente"
                            ? e.target.value
                            : forceUpperText(e.target.value),
                      }))
                    }
                    className={`w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm ${quickAddModal === "cliente" ? "" : "uppercase"}`}
                    placeholder={
                      quickAddModal === "cliente"
                        ? "Ex: Empresa ABC Ltda"
                        : quickAddModal === "solicitante"
                          ? "Ex: Maria Santos"
                          : "Ex: Departamento Comercial"
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeQuickAddModal}
                  className="px-6 py-3 text-slate-500 font-black rounded-xl border border-slate-200 hover:bg-white transition-all uppercase tracking-widest text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-[var(--color-geolog-blue)] text-white font-black rounded-xl shadow-lg shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest text-xs cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          )}
        </StandardModal>
      )}

      {/* Modal Gerenciar Veículos Vinculados */}
      {isOsVehicleQuickModalOpen && (
        <StandardModal
          onClose={() => setIsOsVehicleQuickModalOpen(false)}
          title="Gerenciar Veículos Vinculados"
          subtitle="Vincule veículos existentes ou cadastre novos para o motorista"
          icon={<Truck size={24} />}
          maxWidthClassName="max-w-5xl"
        >
          <div className="space-y-6">
            <section className="space-y-6">
              <div
                className="flex items-center justify-between border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <Truck size={20} className="text-slate-500" /> Veículos
                  Vinculados
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setOsVehicleManageIds((prev) => [
                      ...prev,
                      filteredQuickAddVehicles.find((v) => !prev.includes(v.id))
                        ?.id || "",
                    ])
                  }
                  disabled={
                    filteredQuickAddVehicles.filter(
                      (v) => !osVehicleManageIds.includes(v.id),
                    ).length === 0
                  }
                  className="flex items-center gap-3 px-4 py-3 bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-200 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlusCircle size={14} /> Adicionar veículo
                </button>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="hidden md:grid grid-cols-[2fr_2fr_auto] gap-4 bg-slate-50/80 border-b border-slate-200 px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-600">
                  <span>Veículo</span>
                  <span className="ml-8">Placa</span>
                  <span className="text-right">Ações</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[30vh] overflow-y-auto custom-scrollbar">
                  {osVehicleManageIds.length === 0 && (
                    <div className="px-6 py-8 text-center text-slate-400 text-sm">
                      Nenhum veículo vinculado. Clique em &quot;Adicionar
                      veículo&quot; acima.
                    </div>
                  )}
                  {osVehicleManageIds.map((vehicleId, index) => {
                    const vehicle = vehicles.find((v) => v.id === vehicleId);
                    const availableVehiclesForThisRow =
                      filteredQuickAddVehicles.filter(
                        (v) =>
                          v.id === vehicleId ||
                          !osVehicleManageIds.includes(v.id),
                      );
                    return (
                      <div
                        key={index}
                        className="grid grid-cols-1 md:grid-cols-[2fr_2fr_auto] gap-4 items-center px-6 py-4"
                      >
                        <div className="space-y-2">
                          <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            Veículo
                          </label>
                          <GeologSearchableSelect
                            label=""
                            options={availableVehiclesForThisRow.map((v) => ({
                              id: v.id,
                              nome: `${v.marca} ${v.modelo}`,
                              sublabel: v.placa,
                            }))}
                            value={vehicleId}
                            onChange={(value) =>
                              setOsVehicleManageIds((prev) => {
                                const next = [...prev];
                                next[index] = value;
                                return next;
                              })
                            }
                            placeholder="Selecione o veículo..."
                          />
                        </div>
                        <div className="space-y-1 ml-5">
                          <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            Placa
                          </label>
                          <div className="w-[120px] bg-white border-2 border-slate-400 rounded-md overflow-hidden shadow-sm flex flex-col items-center">
                            <div className="w-full bg-blue-600 h-1" />
                            <div className="py-3 px-4 flex items-center justify-center">
                              <span className="text-[15px] font-black text-slate-900 uppercase tracking-widest leading-none">
                                {vehicle?.placa || "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (!vehicleId) return;
                              const v = vehicles.find(
                                (veh) => veh.id === vehicleId,
                              );
                              if (!v) return;
                              setVehicleQuickForm({
                                placa: v.placa,
                                modelo: v.modelo,
                                marca: v.marca,
                                tipo: v.tipo || "carro",
                              });
                              setQuickVehicleModal({
                                mode: "edit",
                                rowIndex: index,
                                vehicleId: v.id,
                              });
                            }}
                            disabled={!vehicleId}
                            className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Editar veículo"
                            title="Editar veículo"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVehicleQuickForm({
                                placa: "",
                                modelo: "",
                                marca: "",
                                tipo: "carro",
                              });
                              setQuickVehicleModal({
                                mode: "create",
                                rowIndex: index,
                              });
                            }}
                            className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all cursor-pointer"
                            aria-label="Cadastrar novo veículo"
                            title="Cadastrar novo veículo"
                          >
                            <Car size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveVehicleFromManage(vehicleId, index)
                            }
                            className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            aria-label="Remover veículo"
                            title="Remover veículo"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setIsOsVehicleQuickModalOpen(false)}
                className="flex-1 py-4 border-2 border-slate-200 text-slate-500 font-black rounded-2xl hover:bg-slate-50 transition-all uppercase tracking-widest text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleOsVehicleManageConfirm}
                disabled={isSubmittingOsVehicle}
                className="flex-1 py-4 bg-green-600 text-white font-black rounded-2xl hover:bg-green-500 shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 uppercase tracking-widest text-xs cursor-pointer"
              >
                {isSubmittingOsVehicle ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  "Concluído"
                )}
              </button>
            </div>
          </div>
        </StandardModal>
      )}

      {/* Modal Cadastrar/Editar Veículo (dentro do cadastro rápido de motorista) */}
      {quickVehicleModal && (
        <StandardModal
          onClose={() => setQuickVehicleModal(null)}
          title={
            quickVehicleModal.mode === "create"
              ? "Cadastrar Veículo"
              : "Editar Veículo"
          }
          subtitle={
            quickVehicleModal.mode === "create"
              ? "Cadastro rápido de novo veículo"
              : "Editar informações do veículo"
          }
          icon={<Car size={24} />}
          maxWidthClassName="max-w-6xl"
        >
          <form onSubmit={handleQuickVehicleSave} className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <div className="w-[140px] space-y-2 flex-shrink-0">
                <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                  Placa <RequiredAsterisk />
                </label>
                <input
                  required
                  value={vehicleQuickForm.placa}
                  onChange={(e) =>
                    setVehicleQuickForm({
                      ...vehicleQuickForm,
                      placa: formatarPlacaOS(e.target.value),
                    })
                  }
                  className="max-w-[140px] px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[4px] h-[60px]"
                  placeholder="ABC-1234"
                  maxLength={8}
                />
              </div>
              <div className="w-[220px] space-y-2 flex-shrink-0">
                <GeologSearchableSelect
                  label="Marca"
                  options={MARCAS_VEICULOS}
                  value={vehicleQuickForm.marca}
                  onChange={(value) =>
                    setVehicleQuickForm({ ...vehicleQuickForm, marca: value })
                  }
                  required
                  triggerClassName="mt-[9px] h-[60px]"
                />
              </div>
              <div className="flex-1 space-y-2 min-w-[150px]">
                <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                  Modelo <RequiredAsterisk />
                </label>
                <input
                  required
                  value={vehicleQuickForm.modelo}
                  onChange={(e) =>
                    setVehicleQuickForm({
                      ...vehicleQuickForm,
                      modelo: e.target.value,
                    })
                  }
                  className="w-full px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[4px] h-[60px]"
                  placeholder="Ex: Corolla"
                />
              </div>
              <div className="w-[180px] space-y-2 flex-shrink-0">
                <GeologSearchableSelect
                  label="Tipo"
                  options={TIPOS_VEICULO_OS}
                  value={vehicleQuickForm.tipo}
                  onChange={(value) =>
                    setVehicleQuickForm({
                      ...vehicleQuickForm,
                      tipo: value as typeof vehicleQuickForm.tipo,
                    })
                  }
                  required
                  disableSearch
                  triggerClassName="mt-[9px] h-[60px]"
                />
              </div>
            </div>
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setQuickVehicleModal(null)}
                className="flex-1 py-4 border-2 border-slate-200 text-slate-500 font-black rounded-2xl hover:bg-slate-50 transition-all uppercase tracking-widest text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingQuickVehicle}
                className="flex-1 py-4 bg-green-600 text-white font-black rounded-2xl hover:bg-green-500 shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 uppercase tracking-widest text-xs cursor-pointer"
              >
                {isSubmittingQuickVehicle ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : quickVehicleModal.mode === "create" ? (
                  "Cadastrar"
                ) : (
                  "Salvar"
                )}
              </button>
            </div>
          </form>
        </StandardModal>
      )}

      {/* Modal Cadastro Rápido de Parceiro */}
      {isQuickParceiroModalOpen && (
        <StandardModal
          onClose={() => setIsQuickParceiroModalOpen(false)}
          title="Novo Parceiro"
          subtitle="Cadastro rápido de parceiro de serviço"
          icon={<Handshake size={24} />}
          maxWidthClassName="max-w-6xl"
          bodyClassName="p-6 md:p-10 pb-16 space-y-8"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleQuickParceiroSubmit();
            }}
            className="space-y-8"
          >
            <section className="space-y-6">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <Building2 size={20} className="text-slate-500" /> Dados
                  principais
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[0.7fr_1.6fr_0.6fr] gap-6">
                <div className="space-y-2">
                  <GeologSearchableSelect
                    label="Tipo de pessoa"
                    options={[
                      { id: "juridica", nome: "Pessoa jurídica" },
                      { id: "fisica", nome: "Pessoa física" },
                    ]}
                    value={quickParceiroForm.pessoaTipo}
                    onChange={(value) =>
                      setQuickParceiroForm((prev) => ({
                        ...prev,
                        pessoaTipo: value as "fisica" | "juridica",
                        documento: formatParceiroDocument(
                          prev.documento,
                          value as "fisica" | "juridica",
                        ),
                        razaoSocialOuNomeCompleto: "",
                      }))
                    }
                    triggerClassName="px-5 py-3.5 !bg-slate-50 border-2 !border-slate-200 mt-[5px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    {quickParceiroForm.pessoaTipo === "juridica"
                      ? "Razão social"
                      : "Nome completo"}
                  </label>
                  <input
                    required
                    value={quickParceiroForm.razaoSocialOuNomeCompleto}
                    onChange={(e) =>
                      setQuickParceiroForm((prev) => ({
                        ...prev,
                        razaoSocialOuNomeCompleto: e.target.value,
                      }))
                    }
                    placeholder={
                      quickParceiroForm.pessoaTipo === "juridica"
                        ? "Ex: Silva Logística LTDA"
                        : "Ex: João da Silva"
                    }
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[2px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    {quickParceiroForm.pessoaTipo === "juridica"
                      ? "CNPJ"
                      : "CPF"}
                  </label>
                  <input
                    required
                    value={quickParceiroForm.documento}
                    onChange={(e) =>
                      setQuickParceiroForm((prev) => ({
                        ...prev,
                        documento: formatParceiroDocument(
                          e.target.value,
                          prev.pessoaTipo,
                        ),
                      }))
                    }
                    placeholder={
                      quickParceiroForm.pessoaTipo === "juridica"
                        ? "00.000.000/0001-00"
                        : "000.000.000-00"
                    }
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                  />
                </div>
              </div>
            </section>

            <div className="border-b-2 border-slate-100 my-10"></div>

            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3
                    className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                    style={{ lineHeight: "1.3" }}
                  >
                    <Users size={20} className="text-blue-600" /> Contatos por
                    unidade
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setQuickParceiroForm((prev) => ({
                      ...prev,
                      contatos: [
                        ...prev.contatos,
                        { setor: "", celular: "", email: "", responsavel: "" },
                      ],
                    }))
                  }
                  className="flex items-center gap-3 px-4 py-3 bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-200 transition-all shadow-sm cursor-pointer"
                >
                  <PlusCircle size={14} /> Novo cadastro
                </button>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="hidden md:grid grid-cols-[1.2fr_0.8fr_1.2fr_1.1fr_auto] gap-4 bg-slate-50/80 border-b border-slate-200 px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-600">
                  <span>Setor</span>
                  <span>Celular</span>
                  <span>E-mail</span>
                  <span>Responsável</span>
                  <span className="text-right">Ações</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto custom-scrollbar">
                  {quickParceiroForm.contatos.map((contato, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_1.2fr_1.1fr_auto] gap-4 items-start px-6 py-5"
                    >
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Setor
                        </label>
                        <input
                          required
                          placeholder="Financeiro, Operação, Compras..."
                          value={contato.setor}
                          onChange={(e) =>
                            setQuickParceiroForm((prev) => ({
                              ...prev,
                              contatos: prev.contatos.map((c, idx) =>
                                idx === index
                                  ? {
                                      ...c,
                                      setor: e.target.value.toUpperCase(),
                                    }
                                  : c,
                              ),
                            }))
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Celular
                        </label>
                        <input
                          required
                          placeholder="(00) 00000-0000"
                          value={contato.celular}
                          onChange={(e) =>
                            setQuickParceiroForm((prev) => ({
                              ...prev,
                              contatos: prev.contatos.map((c, idx) =>
                                idx === index
                                  ? {
                                      ...c,
                                      celular: formatParceiroPhone(
                                        e.target.value,
                                      ),
                                    }
                                  : c,
                              ),
                            }))
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          E-mail
                        </label>
                        <input
                          type="email"
                          placeholder="contato@empresa.com"
                          value={contato.email || ""}
                          onChange={(e) =>
                            setQuickParceiroForm((prev) => ({
                              ...prev,
                              contatos: prev.contatos.map((c, idx) =>
                                idx === index
                                  ? {
                                      ...c,
                                      email: e.target.value.toLowerCase(),
                                    }
                                  : c,
                              ),
                            }))
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Responsável
                        </label>
                        <input
                          required
                          placeholder="Nome do responsável"
                          value={contato.responsavel}
                          onChange={(e) =>
                            setQuickParceiroForm((prev) => ({
                              ...prev,
                              contatos: prev.contatos.map((c, idx) =>
                                idx === index
                                  ? {
                                      ...c,
                                      responsavel: e.target.value.toUpperCase(),
                                    }
                                  : c,
                              ),
                            }))
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="flex md:pt-1 justify-end">
                        {quickParceiroForm.contatos.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setQuickParceiroForm((prev) => ({
                                ...prev,
                                contatos: prev.contatos.filter(
                                  (_, idx) => idx !== index,
                                ),
                              }))
                            }
                            className="inline-flex items-center justify-center p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            aria-label="Remover contato"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 pt-3">
                            Principal
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsQuickParceiroModalOpen(false)}
                className="px-8 py-4 bg-slate-100 text-slate-700 font-black rounded-xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-12 py-4 bg-[var(--color-geolog-blue)] text-white font-black rounded-xl shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer"
              >
                Salvar parceiro
              </button>
            </div>
          </form>
        </StandardModal>
      )}

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
      />

      {/* Modal de Confirmação de Notificação */}
      {showNotificationConfirm && (
        <StandardModal
          onClose={() => setShowNotificationConfirm(false)}
          title="Notificações da OS"
          subtitle="Escolha como deseja notificar os envolvidos"
          icon={<Bell className="w-6 h-6 md:w-7 md:h-7" />}
          maxWidthClassName="max-w-xl"
        >
          <div className="space-y-8">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="font-black text-slate-800 uppercase tracking-widest text-sm">
                    Modo de Envio
                  </h4>
                  <p className="text-xs text-slate-500 font-bold mt-1">
                    Como as notificações serão processadas?
                  </p>
                </div>
                <div className="flex bg-white p-1.5 rounded-xl border border-slate-200">
                  <button
                    onClick={() =>
                      setNotificationConfig((prev) => ({ ...prev, auto: true }))
                    }
                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${notificationConfig.auto ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    AUTOMÁTICO
                  </button>
                  <button
                    onClick={() =>
                      setNotificationConfig((prev) => ({
                        ...prev,
                        auto: false,
                      }))
                    }
                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${!notificationConfig.auto ? "bg-slate-600 text-white shadow-md" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    MANUAL
                  </button>
                </div>
              </div>

              {notificationConfig.auto && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                    Destinatários automáticos
                  </p>

                  <button
                    onClick={() =>
                      setNotificationConfig((prev) => ({
                        ...prev,
                        motorista: !prev.motorista,
                      }))
                    }
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${notificationConfig.motorista ? "bg-blue-50/50 border-blue-200 text-blue-900" : "bg-white border-slate-100 text-slate-400"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${notificationConfig.motorista ? "bg-blue-100 text-blue-600" : "bg-slate-50 text-slate-300"}`}
                      >
                        <Truck size={18} />
                      </div>
                      <span className="font-bold text-sm">
                        Motorista Alocado
                      </span>
                    </div>
                    <div
                      className={`w-10 h-6 rounded-full relative transition-all ${notificationConfig.motorista ? "bg-blue-600" : "bg-slate-200"}`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notificationConfig.motorista ? "left-5" : "left-1"}`}
                      />
                    </div>
                  </button>

                  <button
                    disabled
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-not-allowed opacity-60 ${notificationConfig.passageiros ? "bg-blue-50/50 border-blue-200 text-blue-900" : "bg-white border-slate-100 text-slate-400"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${notificationConfig.passageiros ? "bg-blue-100 text-blue-600" : "bg-slate-50 text-slate-300"}`}
                      >
                        <Users size={18} />
                      </div>
                      <span className="font-bold text-sm">
                        Passageiros da Rota
                      </span>
                    </div>
                    <div
                      className={`w-10 h-6 rounded-full relative transition-all ${notificationConfig.passageiros ? "bg-blue-600" : "bg-slate-200"}`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notificationConfig.passageiros ? "left-5" : "left-1"}`}
                      />
                    </div>
                  </button>

                  <button
                    disabled
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-not-allowed opacity-60 ${notificationConfig.solicitante ? "bg-blue-50/50 border-blue-200 text-blue-900" : "bg-white border-slate-100 text-slate-400"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${notificationConfig.solicitante ? "bg-blue-100 text-blue-600" : "bg-slate-50 text-slate-300"}`}
                      >
                        <User size={18} />
                      </div>
                      <span className="font-bold text-sm">
                        Solicitante da Empresa
                      </span>
                    </div>
                    <div
                      className={`w-10 h-6 rounded-full relative transition-all ${notificationConfig.solicitante ? "bg-blue-600" : "bg-slate-200"}`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notificationConfig.solicitante ? "left-5" : "left-1"}`}
                      />
                    </div>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 pt-4">
              <button
                type="button"
                onClick={() => setShowNotificationConfirm(false)}
                className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 font-black rounded-xl hover:bg-slate-200 transition-all text-xs uppercase tracking-widest"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={executeAddOS}
                className="flex-[2] px-6 py-4 bg-emerald-600 text-white font-black rounded-xl shadow-xl shadow-emerald-900/20 hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-3"
              >
                <CheckCircle2 size={18} />
                Confirmar e {editingOSId ? "Salvar" : "Criar OS"}
              </button>
            </div>
          </div>
        </StandardModal>
      )}

      {/* Modal de Confirmação de Conclusão (Edição) */}
      {showCompletionConfirm && (
        <StandardModal
          onClose={() => setShowCompletionConfirm(false)}
          title="Concluir Atendimento"
          subtitle="Deseja marcar este atendimento como concluído?"
          icon={<CheckCircle2 className="w-6 h-6 md:w-7 md:h-7" />}
          maxWidthClassName="max-w-2xl"
        >
          <div className="space-y-8">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                Você pode marcar o atendimento como{" "}
                <span className="font-black text-slate-800">concluído</span>{" "}
                agora ou mantê-lo com o status atual.
              </p>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <button
                type="button"
                onClick={async () => {
                  setShowCompletionConfirm(false);
                  await executeEditOS(true);
                }}
                className="flex-[2] px-6 py-4 bg-emerald-600 text-white font-black rounded-xl shadow-xl shadow-emerald-900/20 hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-3 cursor-pointer"
              >
                <CheckCircle2 size={18} />
                Salvar e Concluir
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowCompletionConfirm(false);
                  await executeEditOS(false);
                }}
                className="flex-1 px-6 py-4 bg-white border-2 border-slate-200 text-slate-700 font-black rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all text-xs uppercase tracking-widest cursor-pointer flex items-center justify-center gap-3"
              >
                <Save size={18} />
                Somente Salvar
              </button>
            </div>
          </div>
        </StandardModal>
      )}

      {/* Finish Confirmation Modal */}
      {showFinishConfirm && viewingOS && selectedCycleIndex !== null && (
        <StandardModal
          onClose={() => {
            setShowFinishConfirm(false);
            setSelectedCycleIndex(null);
          }}
          title="Finalizar Etapa"
          subtitle="Confirme a finalização do ciclo"
          icon={<FileText size={24} />}
          maxWidthClassName="max-w-xl"
        >
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="text-amber-600 shrink-0" size={24} />
                <div>
                  <h4 className="font-bold text-amber-900 mb-2">Atenção!</h4>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    Você está prestes a finalizar esta etapa do ciclo
                    operacional. Esta ação não pode ser desfeita facilmente. Tem
                    certeza que deseja prosseguir?
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowFinishConfirm(false);
                  setSelectedCycleIndex(null);
                }}
                className="flex-1 px-6 py-4 bg-slate-100 text-slate-700 font-black rounded-xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!viewingOS || selectedCycleIndex === null) return;
                  await handleManualFinishCycle(
                    viewingOS.id,
                    selectedCycleIndex,
                  );
                  setShowFinishConfirm(false);
                  setSelectedCycleIndex(null);
                }}
                className="flex-1 px-6 py-4 bg-emerald-600 text-white font-black rounded-xl shadow-lg hover:bg-emerald-700 transition-all text-sm uppercase tracking-widest cursor-pointer"
              >
                Confirmar Finalização
              </button>
            </div>
          </div>
        </StandardModal>
      )}

      {/* Accept Revert Modal */}
      {showAcceptRevert && viewingOS && selectedCycleIndex !== null && (
        <StandardModal
          onClose={() => {
            setShowAcceptRevert(false);
            setSelectedCycleIndex(null);
            setResetReason("rescheduling");
            setResetReasonOther("");
          }}
          title="Resetar Ciclo"
          subtitle="Retornar o ciclo para pendente"
          icon={<RotateCcw size={24} />}
          maxWidthClassName="max-w-xl"
          disableBackdropClose
        >
          <div className="space-y-5">
            <p className="text-sm text-slate-600 font-medium">
              Por que você está resetando?
            </p>

            {/* Option: Remarcação / Atraso */}
            <button
              type="button"
              onClick={() => setResetReason("rescheduling")}
              className={`w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                resetReason === "rescheduling"
                  ? "border-amber-500 bg-amber-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  resetReason === "rescheduling"
                    ? "border-amber-500"
                    : "border-slate-300"
                }`}
              >
                {resetReason === "rescheduling" && (
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                )}
              </div>
              <div>
                <p className="font-black text-sm text-slate-800">
                  Remarcação / Atraso
                </p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Motorista deve aguardar nova instrução do operador
                </p>
              </div>
            </button>

            {/* Option: Outro motivo */}
            <button
              type="button"
              onClick={() => setResetReason("other")}
              className={`w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                resetReason === "other"
                  ? "border-slate-500 bg-slate-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  resetReason === "other"
                    ? "border-slate-500"
                    : "border-slate-300"
                }`}
              >
                {resetReason === "other" && (
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-black text-sm text-slate-800">
                  Outro motivo
                </p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Apenas reseta. Operador notifica manualmente se necessário
                </p>
              </div>
            </button>

            {/* Input de motivo livre */}
            {resetReason === "other" && (
              <div className="px-1">
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  Descreva o motivo
                </label>
                <textarea
                  value={resetReasonOther}
                  onChange={(e) => setResetReasonOther(e.target.value)}
                  placeholder="Ex: cliente cancelou, veículo substituído..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white resize-none transition-all"
                />
              </div>
            )}

            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={() => {
                  setShowAcceptRevert(false);
                  setSelectedCycleIndex(null);
                  setResetReason("rescheduling");
                  setResetReasonOther("");
                }}
                className="flex-1 px-6 py-4 bg-slate-100 text-slate-700 font-black rounded-xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!viewingOS || selectedCycleIndex === null) return;
                  await handleManualRevertAccept(
                    viewingOS.id,
                    selectedCycleIndex,
                    resetReason,
                    resetReason === "other"
                      ? resetReasonOther.trim()
                      : undefined,
                  );
                  setShowAcceptRevert(false);
                  setSelectedCycleIndex(null);
                  setResetReason("rescheduling");
                  setResetReasonOther("");
                }}
                className="flex-1 px-6 py-4 bg-rose-600 text-white font-black rounded-xl shadow-lg hover:bg-rose-700 transition-all text-sm uppercase tracking-widest cursor-pointer"
              >
                Confirmar Reset
              </button>
            </div>
          </div>
        </StandardModal>
      )}

      {/* KM Edit Modal */}
      {showKmEdit && viewingOS && kmEditCycleIndex !== null && (
        <StandardModal
          onClose={() => {
            if (isKmEditing) return;
            setShowKmEdit(false);
            setKmEditCycleIndex(null);
            setKmEditNewValue("");
            setKmEditReason("");
            setKmEditBypass(false);
            setKmEditOdometerWarning(null);
          }}
          title={`Editar ${kmEditField === "initial" ? "KM Inicial" : "KM Final"}`}
          subtitle="Correção manual pelo operador"
          icon={<Pencil size={24} />}
          maxWidthClassName="max-w-md"
          disableBackdropClose
        >
          <div className="space-y-5">
            {/* Valor atual */}
            {kmEditCurrentValue !== null && (
              <div className="bg-slate-50 rounded-2xl px-5 py-4 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Valor atual
                </span>
                <span className="text-base font-black text-slate-700">
                  {kmEditCurrentValue.toLocaleString("pt-BR")} km
                </span>
              </div>
            )}

            {/* Aviso de odômetro */}
            {kmEditOdometerWarning !== null && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className="text-amber-600 shrink-0 mt-0.5"
                    size={18}
                  />
                  <div>
                    <p className="text-sm font-black text-amber-900">
                      KM abaixo do odômetro do veículo
                    </p>
                    <p className="text-sm text-amber-700 mt-0.5">
                      Último KM registrado:{" "}
                      <span className="font-black">
                        {kmEditOdometerWarning.toLocaleString("pt-BR")} km
                      </span>
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={kmEditBypass}
                    onChange={(e) => setKmEditBypass(e.target.checked)}
                    className="w-4 h-4 rounded border-amber-400 accent-amber-500 cursor-pointer"
                  />
                  <span className="text-sm font-bold text-amber-800">
                    Confirmo que o valor está correto e desejo ignorar a
                    validação
                  </span>
                </label>
              </div>
            )}

            {/* Novo valor */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                Novo valor (km)
              </label>
              <input
                type="number"
                min={0}
                value={kmEditNewValue}
                onChange={(e) => {
                  setKmEditNewValue(e.target.value);
                  setKmEditOdometerWarning(null);
                  setKmEditBypass(false);
                }}
                placeholder="Ex: 12800"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
              />
            </div>

            {/* Justificativa */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                Justificativa <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={kmEditReason}
                onChange={(e) => setKmEditReason(e.target.value)}
                placeholder="Ex: motorista digitou o KM errado, corrigido via telefone"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white resize-none transition-all"
              />
            </div>

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                disabled={isKmEditing}
                onClick={() => {
                  setShowKmEdit(false);
                  setKmEditCycleIndex(null);
                  setKmEditNewValue("");
                  setKmEditReason("");
                  setKmEditBypass(false);
                  setKmEditOdometerWarning(null);
                }}
                className="flex-1 px-6 py-4 bg-slate-100 text-slate-700 font-black rounded-xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  isKmEditing ||
                  !kmEditNewValue.trim() ||
                  kmEditReason.trim().length < 3 ||
                  (kmEditOdometerWarning !== null && !kmEditBypass)
                }
                onClick={() => void handleKmEdit()}
                className="flex-1 px-6 py-4 bg-blue-600 text-white font-black rounded-xl shadow-lg hover:bg-blue-700 transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
              >
                {isKmEditing ? "Salvando..." : "Salvar KM"}
              </button>
            </div>
          </div>
        </StandardModal>
      )}

      {/* Resend Confirm Modal */}
      {showResendConfirm && viewingOS && (
        <StandardModal
          onClose={() => {
            setShowResendConfirm(false);
            setResendConfirmCycleIndex(null);
            setResendConfirmInfo(null);
          }}
          title={resendConfirmInfo ? "Reenviar mensagem?" : "Enviar mensagem?"}
          subtitle={
            resendConfirmInfo
              ? "Esta mensagem já foi enviada anteriormente"
              : "Confirme o envio da notificação ao motorista"
          }
          icon={<MessageCircle size={24} />}
          maxWidthClassName="max-w-xl"
        >
          <div className="space-y-5">
            {resendConfirmInfo && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2">
                <p className="text-sm text-amber-800 font-bold">
                  Último envio registrado:
                </p>
                <p className="text-sm text-amber-700">
                  <span className="font-black">
                    {new Date(resendConfirmInfo.date).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-amber-600"> — </span>
                  por{" "}
                  <span className="font-black">
                    {resendConfirmInfo.userName}
                  </span>
                </p>
              </div>
            )}
            <p className="text-base text-slate-600">
              {resendConfirmInfo
                ? "Deseja enviar uma nova mensagem ao motorista mesmo assim?"
                : "Deseja enviar a mensagem de aceite ao motorista agora?"}
            </p>
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowResendConfirm(false);
                  setResendConfirmCycleIndex(null);
                  setResendConfirmInfo(null);
                }}
                className="flex-1 px-6 py-4 bg-slate-100 text-slate-700 font-black rounded-xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (resendConfirmCycleIndex !== null) {
                    sendWhatsAppNotification(
                      viewingOS,
                      resendConfirmCycleIndex,
                    );
                  }
                  setShowResendConfirm(false);
                  setResendConfirmCycleIndex(null);
                  setResendConfirmInfo(null);
                }}
                disabled={!!notifyLoadingKey}
                className="flex-1 px-6 py-4 bg-blue-600 text-white font-black rounded-xl shadow-lg hover:bg-blue-700 transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-50"
              >
                {notifyLoadingKey === "driver-whatsapp"
                  ? "Enviando..."
                  : resendConfirmInfo
                    ? "Reenviar"
                    : "Enviar"}
              </button>
            </div>
          </div>
        </StandardModal>
      )}

      {/* Loader overlay unificado: abertura, salvamento ou aguardando status */}
      {(isOpeningEditModal || isSubmittingOS || awaitingStatusOSId) && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#001C3A]/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] p-10 flex flex-col items-center gap-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-300">
            <Loader2
              className="animate-spin text-[var(--color-geolog-blue)]"
              size={48}
            />
            <p className="text-sm font-black uppercase tracking-widest text-slate-600">
              {awaitingStatusOSId
                ? "Atualizando status..."
                : isOpeningEditModal
                  ? "Carregando atendimento..."
                  : osSubmissionMode === "update"
                    ? "Salvando alterações..."
                    : "Criando atendimento..."}
            </p>
          </div>
        </div>
      )}

      {/* Modal de escolha: Novo Atendimento */}
      {isAttendanceChoiceModalOpen && (
        <StandardModal
          onClose={() => setIsAttendanceChoiceModalOpen(false)}
          title="Novo Atendimento"
          subtitle="Escolha o tipo de atendimento para criar"
          icon={<Plus className="w-6 h-6 md:w-7 md:h-7" />}
          maxWidthClassName="max-w-4xl"
          bodyClassName="p-8 md:p-12"
          footer={null}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <button
              type="button"
              onClick={() => {
                setIsAttendanceChoiceModalOpen(false);
                handleOpenCreateOSModal();
              }}
              className="group flex flex-col items-center gap-6 p-8 md:p-10 rounded-[2rem] border border-slate-200 bg-white cursor-pointer hover:border-blue-400 hover:bg-blue-50 hover:shadow-xl hover:shadow-blue-900/5 transition-all active:scale-[0.98]"
            >
              <div className="w-24 h-24 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Truck size={48} strokeWidth={2} />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">
                  OS
                </h3>
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  Ordem de Serviço única com motorista, rota e passageiros
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsAttendanceChoiceModalOpen(false);
                setIsDocagemModalOpen(true);
              }}
              className="group flex flex-col items-center gap-6 p-8 md:p-10 rounded-[2rem] border border-slate-200 bg-white cursor-pointer hover:border-violet-400 hover:bg-violet-50 hover:shadow-xl hover:shadow-violet-900/5 transition-all active:scale-[0.98]"
            >
              <div className="w-24 h-24 rounded-3xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <Package size={48} strokeWidth={2} />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">
                  Docagem
                </h3>
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  OS recorrente fixa em doca com dias da semana e valor diário
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsAttendanceChoiceModalOpen(false);
                setIsFreelanceMode(true);
                handleOpenCreateOSModal();
              }}
              className="group flex flex-col items-center gap-6 p-8 md:p-10 rounded-[2rem] border border-slate-200 bg-white cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-xl hover:shadow-emerald-900/5 transition-all active:scale-[0.98]"
            >
              <div className="w-24 h-24 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Briefcase size={48} strokeWidth={2} />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">
                  Freelance
                </h3>
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  Atendimento avulso por profissional autônomo com valor
                  combinado
                </p>
              </div>
            </button>
          </div>
        </StandardModal>
      )}

      {/* Modal Nova Docagem */}
      {isDocagemModalOpen && (
        <StandardModal
          onClose={() => {
            setIsDocagemModalOpen(false);
            setDocagemFormData({
              clienteId: "",
              centroCustoId: null,
              solicitanteId: null,
              motoristaId: null,
              veiculoId: null,
              endereco: "",
              dataInicio: "",
              dataFim: "",
              horarioInicio: "",
              horarioFim: "",
              diasSemana: [1, 2, 3, 4, 5],
              valorDiario: 0,
              custoDiario: null,
              observacao: null,
              observacaoFinanceira: null,
            });
          }}
          title="Nova Docagem"
          subtitle="Agendamento Recorrente Geolog"
          icon={<Package className="w-6 h-6 md:w-7 md:h-7" />}
          maxWidthClassName="max-w-7xl"
          bodyClassName="p-6 md:p-10 space-y-12"
          headerClassName="bg-[rgb(89,47,147)]"
          headerGlowClassName="bg-[rgb(89,47,147)]/10"
          subtitleClassName="text-white/70"
          footer={
            <div className="p-8 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsDocagemModalOpen(false);
                  setDocagemFormData({
                    clienteId: "",
                    centroCustoId: null,
                    solicitanteId: null,
                    motoristaId: null,
                    veiculoId: null,
                    endereco: "",
                    dataInicio: "",
                    dataFim: "",
                    horarioInicio: "",
                    horarioFim: "",
                    diasSemana: [1, 2, 3, 4, 5],
                    valorDiario: 0,
                    custoDiario: null,
                    observacao: null,
                    observacaoFinanceira: null,
                  });
                }}
                className="px-6 py-4 text-slate-600 font-bold hover:text-slate-900 transition-colors text-sm uppercase tracking-widest cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (isSubmittingDocagem) return;
                  if (!docagemFormData.clienteId) {
                    toast.error("Selecione o cliente.");
                    return;
                  }
                  if (!docagemFormData.endereco.trim()) {
                    toast.error("Informe o endereço / doca.");
                    return;
                  }
                  if (!docagemFormData.dataInicio || !docagemFormData.dataFim) {
                    toast.error("Informe a data de início e fim.");
                    return;
                  }
                  if (
                    !docagemFormData.horarioInicio ||
                    !docagemFormData.horarioFim
                  ) {
                    toast.error("Informe o horário de início e fim.");
                    return;
                  }
                  if (docagemFormData.diasSemana.length === 0) {
                    toast.error("Selecione pelo menos um dia da semana.");
                    return;
                  }
                  if (docagemFormData.valorDiario <= 0) {
                    toast.error("Informe o valor diário.");
                    return;
                  }
                  setIsSubmittingDocagem(true);
                  try {
                    const id = await createDocagem(docagemFormData);
                    toast.success("Docagem criada com sucesso.");
                    setIsDocagemModalOpen(false);
                    setDocagemFormData({
                      clienteId: "",
                      centroCustoId: null,
                      solicitanteId: null,
                      motoristaId: null,
                      veiculoId: null,
                      endereco: "",
                      dataInicio: "",
                      dataFim: "",
                      horarioInicio: "",
                      horarioFim: "",
                      diasSemana: [1, 2, 3, 4, 5],
                      valorDiario: 0,
                      custoDiario: null,
                      observacao: null,
                      observacaoFinanceira: null,
                    });
                    if (calendarRangeRef.current) {
                      void handleCalendarRangeChange(
                        calendarRangeRef.current.from,
                        calendarRangeRef.current.to,
                        true,
                      );
                    }
                    void fetchDocagens().then(setDocagemList);
                    logInfo("Docagem/Create", `Docagem criada: ${id}`);
                  } catch (err) {
                    console.error(err);
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Erro ao criar docagem.",
                    );
                  } finally {
                    setIsSubmittingDocagem(false);
                  }
                }}
                disabled={isSubmittingDocagem}
                className="px-12 py-4 bg-[rgb(89,47,147)] text-white font-black rounded-xl shadow-xl shadow-[rgb(89,47,147)]/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-50"
              >
                {isSubmittingDocagem ? "Criando..." : "Confirmar Docagem"}
              </button>
            </div>
          }
        >
          <div className="space-y-12" style={{ paddingTop: "0.5rem" }}>
            {/* 1. DETALHES DA EXECUÇÃO */}
            <div className="space-y-8">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <Users size={20} className="text-slate-500" /> Detalhes da
                  Execução
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                <GeologSearchableSelect
                  label="Cliente"
                  options={[
                    { id: "", nome: "Selecione..." },
                    ...clientes.map((c) => ({ id: c.id, nome: c.nome })),
                  ]}
                  value={docagemFormData.clienteId}
                  onChange={(id) =>
                    setDocagemFormData((prev) => ({
                      ...prev,
                      clienteId: id,
                      centroCustoId: null,
                      solicitanteId: null,
                    }))
                  }
                  disableSearch={false}
                />
                <GeologSearchableSelect
                  label="Centro de Custo"
                  options={[
                    { id: "", nome: "Todos" },
                    ...(docagemFormData.clienteId
                      ? getCentrosCustoByCliente(docagemFormData.clienteId).map(
                          (cc) => ({ id: cc.id, nome: cc.nome }),
                        )
                      : []),
                  ]}
                  value={docagemFormData.centroCustoId ?? ""}
                  onChange={(id) =>
                    setDocagemFormData((prev) => ({
                      ...prev,
                      centroCustoId: id || null,
                    }))
                  }
                  disabled={!docagemFormData.clienteId}
                  disableSearch={false}
                />
                <GeologSearchableSelect
                  label="Solicitante"
                  options={[
                    { id: "", nome: "Todos" },
                    ...solicitantes
                      .filter(
                        (s) =>
                          !docagemFormData.clienteId ||
                          s.clienteId === docagemFormData.clienteId,
                      )
                      .map((s) => ({ id: s.id, nome: s.nome })),
                  ]}
                  value={docagemFormData.solicitanteId ?? ""}
                  onChange={(id) =>
                    setDocagemFormData((prev) => ({
                      ...prev,
                      solicitanteId: id || null,
                    }))
                  }
                  disabled={!docagemFormData.clienteId}
                  disableSearch={false}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GeologSearchableSelect
                  label="Motorista"
                  options={driverOptions}
                  value={docagemFormData.motoristaId ?? ""}
                  onChange={(id) =>
                    setDocagemFormData((prev) => ({
                      ...prev,
                      motoristaId: id || null,
                      veiculoId: null,
                    }))
                  }
                  disableSearch={false}
                />
                <GeologSearchableSelect
                  label="Veículo"
                  options={docagemFormVehicleOptions}
                  value={docagemFormData.veiculoId ?? ""}
                  onChange={(id) =>
                    setDocagemFormData((prev) => ({
                      ...prev,
                      veiculoId: id || null,
                    }))
                  }
                  disabled={!docagemFormData.motoristaId}
                  disableSearch={false}
                />
              </div>
            </div>

            {/* 2. LOCAL E PERÍODO */}
            <div className="space-y-8">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <MapPin size={20} className="text-slate-500" /> Local e
                  Período
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2.5 md:col-span-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Endereço / Doca
                  </label>
                  <input
                    type="text"
                    value={docagemFormData.endereco}
                    onChange={(e) =>
                      setDocagemFormData((prev) => ({
                        ...prev,
                        endereco: e.target.value,
                      }))
                    }
                    placeholder="Ex: Doca 12 - CD Cajamar"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-lg text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all uppercase placeholder:text-slate-300 shadow-sm"
                  />
                </div>
                <div className="space-y-2.5">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Data Início
                  </label>
                  <input
                    type="date"
                    value={docagemFormData.dataInicio}
                    onChange={(e) =>
                      setDocagemFormData((prev) => ({
                        ...prev,
                        dataInicio: e.target.value,
                      }))
                    }
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-lg text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all uppercase shadow-sm"
                  />
                </div>
                <div className="space-y-2.5">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Data Fim
                  </label>
                  <input
                    type="date"
                    value={docagemFormData.dataFim}
                    onChange={(e) =>
                      setDocagemFormData((prev) => ({
                        ...prev,
                        dataFim: e.target.value,
                      }))
                    }
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-lg text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all uppercase shadow-sm"
                  />
                </div>
                <div className="space-y-2.5">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Horário Início
                  </label>
                  <input
                    type="time"
                    value={docagemFormData.horarioInicio}
                    onChange={(e) =>
                      setDocagemFormData((prev) => ({
                        ...prev,
                        horarioInicio: e.target.value,
                      }))
                    }
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-lg text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all uppercase shadow-sm"
                  />
                </div>
                <div className="space-y-2.5">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Horário Fim
                  </label>
                  <input
                    type="time"
                    value={docagemFormData.horarioFim}
                    onChange={(e) =>
                      setDocagemFormData((prev) => ({
                        ...prev,
                        horarioFim: e.target.value,
                      }))
                    }
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-lg text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all uppercase shadow-sm"
                  />
                </div>
                <div className="space-y-2.5 md:col-span-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Dias da Semana
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { label: "Dom", value: 7 },
                      { label: "Seg", value: 1 },
                      { label: "Ter", value: 2 },
                      { label: "Qua", value: 3 },
                      { label: "Qui", value: 4 },
                      { label: "Sex", value: 5 },
                      { label: "Sáb", value: 6 },
                    ].map((dia) => {
                      const active = docagemFormData.diasSemana.includes(
                        dia.value,
                      );
                      return (
                        <button
                          key={dia.value}
                          type="button"
                          onClick={() =>
                            setDocagemFormData((prev) => {
                              const has = prev.diasSemana.includes(dia.value);
                              const next = has
                                ? prev.diasSemana.filter((v) => v !== dia.value)
                                : [...prev.diasSemana, dia.value];
                              return { ...prev, diasSemana: next.sort() };
                            })
                          }
                          className={`px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${
                            active
                              ? "bg-violet-600 text-white shadow-lg shadow-violet-900/20 scale-[1.05]"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {dia.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. FINANCEIRO */}
            <DocagemFinanceiroSection
              valor={docagemFormData.valorDiario}
              custo={docagemFormData.custoDiario ?? null}
              observacaoFinanceira={
                docagemFormData.observacaoFinanceira ?? null
              }
              onValorChange={(value) =>
                setDocagemFormData((prev) => ({ ...prev, valorDiario: value }))
              }
              onCustoChange={(value) =>
                setDocagemFormData((prev) => ({ ...prev, custoDiario: value }))
              }
              onObservacaoFinanceiraChange={(value) =>
                setDocagemFormData((prev) => ({
                  ...prev,
                  observacaoFinanceira: value,
                }))
              }
              impostoPercentual={impostoPercentual}
              formatCurrency={formatCurrency}
            />

            {/* 4. OBSERVAÇÕES GERAIS */}
            <div className="space-y-8">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <MessageSquareMore size={20} className="text-slate-500" />{" "}
                  Observações Gerais
                </h3>
              </div>
              <div className="space-y-2.5">
                <textarea
                  value={docagemFormData.observacao ?? ""}
                  onChange={(e) =>
                    setDocagemFormData((prev) => ({
                      ...prev,
                      observacao: e.target.value || null,
                    }))
                  }
                  rows={4}
                  placeholder="Observações internas sobre a docagem..."
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-medium text-lg text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm resize-none"
                />
              </div>
            </div>
          </div>
        </StandardModal>
      )}

      {/* Modal Visualizar Docagem */}
      {viewingDocagemInstance && (
        <StandardModal
          onClose={() => setViewingDocagemInstance(null)}
          title={
            <button
              type="button"
              onClick={() =>
                viewingDocagemInstance.protocolo &&
                void handleCopyProtocol(viewingDocagemInstance.protocolo)
              }
              className={`text-left cursor-pointer font-black tracking-normal normal-case text-white ${
                viewingDocagemInstance.protocolo
                  ? "hover:underline"
                  : "cursor-default"
              }`}
            >
              {viewingDocagemInstance.protocolo || "Sem protocolo"}
            </button>
          }
          subtitle={
            <div className="flex items-center gap-2 text-sm">
              <span>
                {viewingDocagemInstance.data.split("-").reverse().join("/")}
              </span>
              {copiedProtocol === viewingDocagemInstance.protocolo &&
                viewingDocagemInstance.protocolo && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    Copiado
                  </span>
                )}
            </div>
          }
          icon={<Eye size={24} />}
          maxWidthClassName="max-w-7xl"
          bodyClassName="p-6 md:p-10 space-y-12"
          headerClassName="bg-[rgb(89,47,147)]"
          headerGlowClassName="bg-[rgb(89,47,147)]/10"
          subtitleClassName="text-white/70"
          footer={
            <div className="p-8 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setViewingDocagemInstance(null)}
                className="px-6 py-4 text-slate-600 font-bold hover:text-slate-900 transition-colors text-sm uppercase tracking-widest cursor-pointer"
              >
                Fechar
              </button>
            </div>
          }
        >
          <div className="space-y-12" style={{ paddingTop: "0.5rem" }}>
            {/* 1. DETALHES DA EXECUÇÃO */}
            <div className="space-y-8">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <Users size={20} className="text-slate-500" /> Detalhes da
                  Execução
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                <div className="space-y-2.5">
                  <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Cliente
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {clientes.find(
                      (c) => c.id === viewingDocagemInstance.clienteId,
                    )?.nome || "N/A"}
                  </p>
                </div>
                <div className="space-y-2.5">
                  <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Centro de Custo
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {clientes
                      .find((c) => c.id === viewingDocagemInstance.clienteId)
                      ?.centrosCusto.find(
                        (cc) => cc.id === viewingDocagemInstance.centroCustoId,
                      )?.nome || "Padrão"}
                  </p>
                </div>
                <div className="space-y-2.5">
                  <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Solicitante
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {solicitantes.find(
                      (s) => s.id === viewingDocagemInstance.solicitanteId,
                    )?.nome || "N/A"}
                  </p>
                </div>
                <div className="space-y-2.5">
                  <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Motorista
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {drivers.find(
                      (d) => d.id === viewingDocagemInstance.motoristaId,
                    )?.name || "Não definido"}
                  </p>
                </div>
                <div className="space-y-2.5">
                  <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Veículo
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {vehicles.find(
                      (v) => v.id === viewingDocagemInstance.veiculoId,
                    )
                      ? `${vehicles.find((v) => v.id === viewingDocagemInstance.veiculoId)?.placa} - ${vehicles.find((v) => v.id === viewingDocagemInstance.veiculoId)?.modelo}`
                      : "Não definido"}
                  </p>
                </div>
                <div className="space-y-2.5">
                  <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Status
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {viewingDocagemInstance.status === "pendente" && "Pendente"}
                    {viewingDocagemInstance.status === "andamento" &&
                      "Andamento"}
                    {viewingDocagemInstance.status === "finalizada" &&
                      "Finalizada"}
                    {viewingDocagemInstance.status === "excluida" && "Excluída"}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. LOCAL E HORÁRIO */}
            <div className="space-y-8">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <MapPin size={20} className="text-slate-500" /> Local e
                  Horário
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2.5 md:col-span-2">
                  <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Endereço / Doca
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {viewingDocagemInstance.endereco || "N/A"}
                  </p>
                </div>
                <div className="space-y-2.5">
                  <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Horário Início
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {viewingDocagemInstance.horarioInicio}
                  </p>
                </div>
                <div className="space-y-2.5">
                  <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Horário Fim
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {viewingDocagemInstance.horarioFim}
                  </p>
                </div>
              </div>
            </div>

            {/* 3. FINANCEIRO */}
            <div className="space-y-8">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <DollarSign size={20} className="text-slate-500" /> Financeiro
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2.5">
                  <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Valor (R$)
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {formatCurrency(viewingDocagemInstance.valor)}
                  </p>
                </div>
                <div className="space-y-2.5">
                  <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Custo (R$)
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {formatCurrency(viewingDocagemInstance.custo ?? 0)}
                  </p>
                </div>
                {viewingDocagemInstance.observacaoFinanceira && (
                  <div className="space-y-2.5 md:col-span-2">
                    <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      Observação Financeira
                    </p>
                    <p className="text-base font-medium text-slate-700">
                      {viewingDocagemInstance.observacaoFinanceira}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 4. OBSERVAÇÕES GERAIS */}
            <div className="space-y-8">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <MessageSquareMore size={20} className="text-slate-500" />{" "}
                  Observações Gerais
                </h3>
              </div>
              <div className="space-y-2.5">
                <p className="text-base font-medium text-slate-700">
                  {viewingDocagemInstance.observacao || "-"}
                </p>
              </div>
            </div>
          </div>
        </StandardModal>
      )}

      {/* Modal Editar Dia de Docagem */}
      {editingDocagemInstance && (
        <StandardModal
          onClose={() => {
            setEditingDocagemInstance(null);
            setDocagemInstanceEditForm(null);
          }}
          title="Editar Dia de Docagem"
          subtitle={
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() =>
                  editingDocagemInstance.protocolo &&
                  void handleCopyProtocol(editingDocagemInstance.protocolo)
                }
                className={`font-black tracking-normal normal-case text-white ${
                  editingDocagemInstance.protocolo
                    ? "hover:underline cursor-pointer"
                    : "cursor-default"
                }`}
              >
                {editingDocagemInstance.protocolo || "Sem protocolo"}
              </button>
              <span>·</span>
              <span>
                {editingDocagemInstance.data.split("-").reverse().join("/")}
              </span>
              {copiedProtocol === editingDocagemInstance.protocolo &&
                editingDocagemInstance.protocolo && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    Copiado
                  </span>
                )}
            </div>
          }
          icon={<Pencil size={24} />}
          maxWidthClassName="max-w-7xl"
          bodyClassName="p-6 md:p-10 space-y-12"
          headerClassName="bg-[rgb(89,47,147)]"
          headerGlowClassName="bg-[rgb(89,47,147)]/10"
          subtitleClassName="text-white/70"
          footer={
            <div className="p-8 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditingDocagemInstance(null);
                  setDocagemInstanceEditForm(null);
                }}
                className="px-6 py-4 text-slate-600 font-bold hover:text-slate-900 transition-colors text-sm uppercase tracking-widest cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!docagemInstanceEditForm) return;
                  if (docagemInstanceEditForm.valor <= 0) {
                    toast.error("Informe o valor do dia.");
                    return;
                  }
                  setIsSubmittingDocagem(true);
                  try {
                    await updateDocagemInstance(
                      editingDocagemInstance.id,
                      docagemInstanceEditForm,
                    );
                    toast.success("Dia de docagem atualizado.");
                    setEditingDocagemInstance(null);
                    setDocagemInstanceEditForm(null);
                    if (calendarRangeRef.current) {
                      void handleCalendarRangeChange(
                        calendarRangeRef.current.from,
                        calendarRangeRef.current.to,
                        true,
                      );
                    }
                    void fetchDocagens().then(setDocagemList);
                  } catch (err) {
                    console.error(err);
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Erro ao atualizar dia de docagem.",
                    );
                  } finally {
                    setIsSubmittingDocagem(false);
                  }
                }}
                disabled={isSubmittingDocagem}
                className="px-12 py-4 bg-[rgb(89,47,147)] text-white font-black rounded-xl shadow-xl shadow-[rgb(89,47,147)]/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-50"
              >
                {isSubmittingDocagem ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          }
        >
          <div className="space-y-12" style={{ paddingTop: "0.5rem" }}>
            {/* 1. DETALHES DA EXECUÇÃO */}
            <div className="space-y-8">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <Users size={20} className="text-slate-500" /> Detalhes da
                  Execução
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GeologSearchableSelect
                  label="Motorista"
                  options={driverOptions}
                  value={docagemInstanceEditForm?.motoristaId ?? ""}
                  onChange={(id) =>
                    setDocagemInstanceEditForm((prev) =>
                      prev
                        ? { ...prev, motoristaId: id || null, veiculoId: null }
                        : null,
                    )
                  }
                  disableSearch={false}
                />
                <GeologSearchableSelect
                  label="Veículo"
                  options={docagemInstanceEditVehicleOptions}
                  value={docagemInstanceEditForm?.veiculoId ?? ""}
                  onChange={(id) =>
                    setDocagemInstanceEditForm((prev) =>
                      prev ? { ...prev, veiculoId: id || null } : null,
                    )
                  }
                  disabled={!docagemInstanceEditForm?.motoristaId}
                  disableSearch={false}
                />
              </div>
            </div>

            {/* 2. LOCAL E HORÁRIO */}
            <div className="space-y-8">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <MapPin size={20} className="text-slate-500" /> Local e
                  Horário
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2.5 md:col-span-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Endereço / Doca
                  </label>
                  <input
                    type="text"
                    value={docagemInstanceEditForm?.endereco ?? ""}
                    onChange={(e) =>
                      setDocagemInstanceEditForm((prev) =>
                        prev ? { ...prev, endereco: e.target.value } : null,
                      )
                    }
                    placeholder="Ex: Doca 12 - CD Cajamar"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-lg text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all uppercase placeholder:text-slate-300 shadow-sm"
                  />
                </div>
                <div className="space-y-2.5">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Horário Início
                  </label>
                  <input
                    type="time"
                    value={docagemInstanceEditForm?.horarioInicio ?? ""}
                    onChange={(e) =>
                      setDocagemInstanceEditForm((prev) =>
                        prev
                          ? { ...prev, horarioInicio: e.target.value }
                          : null,
                      )
                    }
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-lg text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all uppercase shadow-sm"
                  />
                </div>
                <div className="space-y-2.5">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Horário Fim
                  </label>
                  <input
                    type="time"
                    value={docagemInstanceEditForm?.horarioFim ?? ""}
                    onChange={(e) =>
                      setDocagemInstanceEditForm((prev) =>
                        prev ? { ...prev, horarioFim: e.target.value } : null,
                      )
                    }
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-lg text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all uppercase shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* 3. FINANCEIRO */}
            <DocagemFinanceiroSection
              valor={docagemInstanceEditForm?.valor ?? 0}
              custo={docagemInstanceEditForm?.custo ?? null}
              observacaoFinanceira={
                docagemInstanceEditForm?.observacaoFinanceira ?? null
              }
              onValorChange={(value) =>
                setDocagemInstanceEditForm((prev) =>
                  prev ? { ...prev, valor: value } : null,
                )
              }
              onCustoChange={(value) =>
                setDocagemInstanceEditForm((prev) =>
                  prev ? { ...prev, custo: value } : null,
                )
              }
              onObservacaoFinanceiraChange={(value) =>
                setDocagemInstanceEditForm((prev) =>
                  prev ? { ...prev, observacaoFinanceira: value } : null,
                )
              }
              impostoPercentual={impostoPercentual}
              formatCurrency={formatCurrency}
            />
          </div>
        </StandardModal>
      )}

      {/* Modal Editar Docagem Mãe */}
      {editingDocagemData && editingDocagemId && (
        <StandardModal
          onClose={() => {
            setEditingDocagemId(null);
            setEditingDocagemData(null);
          }}
          title="Editar Docagem"
          subtitle={editingDocagemData.endereco}
          icon={<Package size={24} />}
          maxWidthClassName="max-w-7xl"
          bodyClassName="p-6 md:p-10 space-y-12"
          headerClassName="bg-[rgb(89,47,147)]"
          headerGlowClassName="bg-[rgb(89,47,147)]/10"
          subtitleClassName="text-white/70"
          footer={
            <div className="p-8 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-5 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  if (!editingDocagemId) return;
                  const confirmed = await confirm({
                    title: "Cancelar Docagem",
                    message:
                      "Deseja cancelar esta docagem? As instâncias futuras não serão mais geradas.",
                    type: "danger",
                  });
                  if (!confirmed) return;
                  setIsSubmittingDocagem(true);
                  try {
                    await cancelarDocagem(editingDocagemId);
                    toast.success("Docagem cancelada.");
                    setEditingDocagemId(null);
                    setEditingDocagemData(null);
                    if (calendarRangeRef.current) {
                      void handleCalendarRangeChange(
                        calendarRangeRef.current.from,
                        calendarRangeRef.current.to,
                        true,
                      );
                    }
                    void fetchDocagens().then(setDocagemList);
                  } catch (err) {
                    console.error(err);
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Erro ao cancelar docagem.",
                    );
                  } finally {
                    setIsSubmittingDocagem(false);
                  }
                }}
                disabled={isSubmittingDocagem}
                className="px-6 py-4 text-rose-600 font-bold hover:text-rose-700 transition-colors text-sm uppercase tracking-widest cursor-pointer disabled:opacity-50"
              >
                Cancelar Docagem
              </button>
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingDocagemId(null);
                    setEditingDocagemData(null);
                  }}
                  className="px-6 py-4 text-slate-600 font-bold hover:text-slate-900 transition-colors text-sm uppercase tracking-widest cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!editingDocagemData || !editingDocagemId) return;
                    if (!editingDocagemData.clienteId) {
                      toast.error("Selecione o cliente.");
                      return;
                    }
                    if (!editingDocagemData.endereco.trim()) {
                      toast.error("Informe o endereço / doca.");
                      return;
                    }
                    if (
                      !editingDocagemData.horarioInicio ||
                      !editingDocagemData.horarioFim
                    ) {
                      toast.error("Informe o horário de início e fim.");
                      return;
                    }
                    setIsSubmittingDocagem(true);
                    try {
                      await updateDocagem(editingDocagemId, editingDocagemData);
                      toast.success("Docagem atualizada.");
                      setEditingDocagemId(null);
                      setEditingDocagemData(null);
                      if (calendarRangeRef.current) {
                        void handleCalendarRangeChange(
                          calendarRangeRef.current.from,
                          calendarRangeRef.current.to,
                          true,
                        );
                      }
                      void fetchDocagens().then(setDocagemList);
                    } catch (err) {
                      console.error(err);
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Erro ao atualizar docagem.",
                      );
                    } finally {
                      setIsSubmittingDocagem(false);
                    }
                  }}
                  disabled={isSubmittingDocagem}
                  className="px-12 py-4 bg-[rgb(89,47,147)] text-white font-black rounded-xl shadow-xl shadow-[rgb(89,47,147)]/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingDocagem ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-12" style={{ paddingTop: "0.5rem" }}>
            {/* 1. DETALHES DA EXECUÇÃO */}
            <div className="space-y-8">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <Users size={20} className="text-slate-500" /> Detalhes da
                  Execução
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                <GeologSearchableSelect
                  label="Cliente"
                  options={[
                    { id: "", nome: "Selecione..." },
                    ...clientes.map((c) => ({ id: c.id, nome: c.nome })),
                  ]}
                  value={editingDocagemData.clienteId}
                  onChange={(id) =>
                    setEditingDocagemData((prev) =>
                      prev
                        ? {
                            ...prev,
                            clienteId: id,
                            centroCustoId: null,
                            solicitanteId: null,
                          }
                        : null,
                    )
                  }
                  disableSearch={false}
                />
                <GeologSearchableSelect
                  label="Centro de Custo"
                  options={[
                    { id: "", nome: "Todos" },
                    ...(editingDocagemData.clienteId
                      ? getCentrosCustoByCliente(
                          editingDocagemData.clienteId,
                        ).map((cc) => ({ id: cc.id, nome: cc.nome }))
                      : []),
                  ]}
                  value={editingDocagemData.centroCustoId ?? ""}
                  onChange={(id) =>
                    setEditingDocagemData((prev) =>
                      prev ? { ...prev, centroCustoId: id || null } : null,
                    )
                  }
                  disabled={!editingDocagemData.clienteId}
                  disableSearch={false}
                />
                <GeologSearchableSelect
                  label="Solicitante"
                  options={[
                    { id: "", nome: "Todos" },
                    ...solicitantes
                      .filter(
                        (s) =>
                          !editingDocagemData.clienteId ||
                          s.clienteId === editingDocagemData.clienteId,
                      )
                      .map((s) => ({ id: s.id, nome: s.nome })),
                  ]}
                  value={editingDocagemData.solicitanteId ?? ""}
                  onChange={(id) =>
                    setEditingDocagemData((prev) =>
                      prev ? { ...prev, solicitanteId: id || null } : null,
                    )
                  }
                  disabled={!editingDocagemData.clienteId}
                  disableSearch={false}
                />
              </div>
            </div>

            {/* 2. LOCAL E PERÍODO */}
            <div className="space-y-8">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <MapPin size={20} className="text-slate-500" /> Local e
                  Período
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2.5 md:col-span-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Endereço / Doca
                  </label>
                  <input
                    type="text"
                    value={editingDocagemData.endereco}
                    onChange={(e) =>
                      setEditingDocagemData((prev) =>
                        prev ? { ...prev, endereco: e.target.value } : null,
                      )
                    }
                    placeholder="Ex: Doca 12 - CD Cajamar"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-lg text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all uppercase placeholder:text-slate-300 shadow-sm"
                  />
                </div>
                <div className="space-y-2.5">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Data Início
                  </label>
                  <input
                    type="date"
                    value={editingDocagemData.dataInicio}
                    disabled
                    className="w-full px-5 py-4 bg-slate-100 border-2 border-slate-200 rounded-xl font-bold text-lg text-slate-500 outline-none cursor-not-allowed"
                  />
                  <p className="text-xs font-bold text-slate-400">
                    Não é possível alterar a data de início.
                  </p>
                </div>
                <div className="space-y-2.5">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Data Fim
                  </label>
                  <input
                    type="date"
                    value={editingDocagemData.dataFim}
                    disabled
                    className="w-full px-5 py-4 bg-slate-100 border-2 border-slate-200 rounded-xl font-bold text-lg text-slate-500 outline-none cursor-not-allowed"
                  />
                  <p className="text-xs font-bold text-slate-400">
                    Não é possível alterar a data de fim.
                  </p>
                </div>
                <div className="space-y-2.5">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Horário Início
                  </label>
                  <input
                    type="time"
                    value={editingDocagemData.horarioInicio}
                    onChange={(e) =>
                      setEditingDocagemData((prev) =>
                        prev
                          ? { ...prev, horarioInicio: e.target.value }
                          : null,
                      )
                    }
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-lg text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all uppercase shadow-sm"
                  />
                </div>
                <div className="space-y-2.5">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Horário Fim
                  </label>
                  <input
                    type="time"
                    value={editingDocagemData.horarioFim}
                    onChange={(e) =>
                      setEditingDocagemData((prev) =>
                        prev ? { ...prev, horarioFim: e.target.value } : null,
                      )
                    }
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-lg text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all uppercase shadow-sm"
                  />
                </div>
                <div className="space-y-2.5 md:col-span-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Dias da Semana
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { label: "Dom", value: 7 },
                      { label: "Seg", value: 1 },
                      { label: "Ter", value: 2 },
                      { label: "Qua", value: 3 },
                      { label: "Qui", value: 4 },
                      { label: "Sex", value: 5 },
                      { label: "Sáb", value: 6 },
                    ].map((dia) => {
                      const active = editingDocagemData.diasSemana.includes(
                        dia.value,
                      );
                      return (
                        <button
                          key={dia.value}
                          type="button"
                          disabled
                          className={`px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${
                            active
                              ? "bg-violet-600 text-white opacity-70"
                              : "bg-slate-100 text-slate-500 opacity-60"
                          } cursor-not-allowed`}
                        >
                          {dia.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs font-bold text-slate-400">
                    Não é possível alterar os dias da semana.
                  </p>
                </div>
              </div>
            </div>

            {/* 3. OBSERVAÇÕES GERAIS */}
            <div className="space-y-8">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <MessageSquareMore size={20} className="text-slate-500" />{" "}
                  Observações Gerais
                </h3>
              </div>
              <div className="space-y-2.5">
                <textarea
                  value={editingDocagemData.observacao ?? ""}
                  onChange={(e) =>
                    setEditingDocagemData((prev) =>
                      prev
                        ? { ...prev, observacao: e.target.value || null }
                        : null,
                    )
                  }
                  rows={4}
                  placeholder="Observações internas sobre a docagem..."
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-medium text-lg text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm resize-none"
                />
              </div>
            </div>
          </div>
        </StandardModal>
      )}
    </div>
  );
}

function DocagemFinanceiroSection({
  valor,
  custo,
  observacaoFinanceira,
  onValorChange,
  onCustoChange,
  onObservacaoFinanceiraChange,
  impostoPercentual,
  formatCurrency,
}: {
  valor: number;
  custo: number | null;
  observacaoFinanceira: string | null;
  onValorChange: (value: number) => void;
  onCustoChange: (value: number | null) => void;
  onObservacaoFinanceiraChange: (value: string | null) => void;
  impostoPercentual: number;
  formatCurrency: (value: number) => string;
}) {
  const [showObs, setShowObs] = useState(false);

  const valorNum = valor;
  const custoNum = custo ?? 0;
  const taxa = valorNum * (impostoPercentual / 100);
  const lucro = valorNum - taxa - custoNum;
  const isLucro = lucro >= 0;

  return (
    <div className="space-y-6 md:col-span-2">
      <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
          <DollarSign size={20} />
        </div>
        <h3 className="text-lg font-black text-slate-800 tracking-tight">
          Financeiro
        </h3>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <div className="flex flex-col gap-2 w-full sm:w-[220px]">
          <label className="text-sm font-bold text-slate-800 uppercase tracking-tight ml-1">
            Valor Bruto
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.01"
              value={valorNum || ""}
              onChange={(e) =>
                onValorChange(
                  e.target.value === "" ? 0 : parseFloat(e.target.value),
                )
              }
              className="w-full bg-slate-50 border-2 border-slate-200 px-4 h-[58px] rounded-xl font-bold text-lg text-blue-700 outline-none tabular-nums focus:bg-white focus:border-blue-600 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full sm:w-[220px]">
          <label className="text-sm font-bold text-slate-800 uppercase tracking-tight ml-1">
            Repasse ao Motorista
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.01"
              value={custoNum || ""}
              onChange={(e) =>
                onCustoChange(
                  e.target.value === "" ? null : parseFloat(e.target.value),
                )
              }
              className="w-full bg-slate-50 border-2 border-slate-200 px-4 h-[58px] rounded-xl font-bold text-lg text-red-500 outline-none tabular-nums focus:bg-white focus:border-red-300 transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowObs((prev) => !prev)}
          className="flex items-center justify-between w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl hover:bg-slate-100 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <MessageSquareMore
              size={18}
              className="text-slate-400 group-hover:text-blue-500 transition-colors"
            />
            <span className="text-sm font-bold text-slate-800 uppercase tracking-tight">
              Observações Financeiras
            </span>
            {observacaoFinanceira && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                Preenchido
              </span>
            )}
          </div>
          <ChevronDown
            size={20}
            className={`text-slate-400 transition-transform duration-300 ${showObs ? "rotate-180" : ""}`}
          />
        </button>

        {showObs && (
          <div className="animate-in slide-in-from-top-2 duration-300">
            <textarea
              value={observacaoFinanceira ?? ""}
              onChange={(e) =>
                onObservacaoFinanceiraChange(e.target.value || null)
              }
              rows={3}
              placeholder="Adicione observações de cunho financeiro..."
              className="w-full bg-slate-50 border-2 border-slate-200 px-6 py-4 rounded-xl font-medium text-base text-slate-900 outline-none focus:bg-white focus:border-blue-600 transition-all shadow-sm resize-none"
            />
          </div>
        )}
      </div>

      <div
        className={`p-8 md:p-10 rounded-[2.5rem] ${isLucro ? "bg-emerald-600 shadow-emerald-900/10" : "bg-red-600 shadow-red-900/10"} text-white shadow-2xl transition-all duration-500`}
      >
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-black uppercase tracking-[0.2em]">
                Valor Total a Cobrar
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-5xl font-black tracking-tighter tabular-nums leading-none">
                {formatCurrency(valorNum)}
              </p>
              <div className="flex items-start gap-3 -mt-2">
                <div className="animate-pulse mt-5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={32}
                    height={32}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-arrow-right opacity-80"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </div>
                <div className="text-right space-y-2 -mt-1">
                  <span className="text-xs font-black uppercase block tracking-widest opacity-80">
                    Valor Líquido Estimado
                  </span>
                  <div className="px-5 py-2 bg-white/20 rounded-xl text-2xl font-black tabular-nums backdrop-blur-md leading-none">
                    {formatCurrency(lucro)}
                  </div>
                  <div className="text-xs font-black uppercase tracking-widest opacity-100">
                    {valorNum > 0 ? ((lucro / valorNum) * 100).toFixed(1) : 0}%{" "}
                    <span className="text-[10px] font-medium opacity-70">
                      de lucro
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-5">
                <div className="bg-white/10 rounded-xl px-4 py-4 space-y-3">
                  <p className="text-sm font-black uppercase tracking-widest opacity-100 mb-3 flex items-center gap-2">
                    <User size={16} />
                    Fatura do Cliente
                  </p>

                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium opacity-90">
                      Valor base do serviço
                    </span>
                    <span className="font-black tabular-nums">
                      {formatCurrency(valorNum)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium opacity-80">
                      Taxa administrativa ({impostoPercentual}%)
                    </span>
                    <span className="font-black tabular-nums text-red-200">
                      -{formatCurrency(taxa)}
                    </span>
                  </div>
                </div>
                <div className="bg-white/10 rounded-xl px-4 py-4 space-y-3">
                  <p className="text-sm font-black uppercase tracking-widest opacity-100 mb-3 flex items-center gap-2">
                    <Truck size={16} />
                    Repasse ao Motorista
                  </p>

                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium opacity-90">
                      Valor base do repasse
                    </span>
                    <span className="font-black tabular-nums">
                      {formatCurrency(custoNum)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OpStatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
      <div className="p-3 bg-slate-50 rounded-xl">{icon}</div>
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
          {label}
        </p>
        <h3 className="text-2xl font-black text-slate-800 tabular-nums">
          {value}
        </h3>
      </div>
    </div>
  );
}
