"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  Truck,
  TrendingUp,
  Clock,
  Users,
  Building2,
  Receipt,
  Wallet,
  CheckCircle2,
  CheckCircle,
  ListChecks,
  Calendar,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import GeologDateInput from "@/components/ui/GeologDateInput";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import OSPickerPanel from "@/components/financeiro/OSPickerPanel";

export type ReportTemplate =
  | "medicao_cliente"
  | "repasse_motorista"
  | "resumo_motoristas"
  | "performance"
  | "liberadas_faturamento"
  | "pendentes_repasse";

export type ReportFormat = "pdf" | "csv" | "xlsx";

type ReportCategory = "cliente" | "interno" | "motorista";

type TemplateConfig = {
  id: ReportTemplate;
  label: string;
  description: string;
  category: ReportCategory;
  defaultGrouping?: string;
  extraFilters?: string[];
};

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  cliente: "Cliente",
  interno: "Interno",
  motorista: "Motorista",
};

const CATEGORY_ICONS: Record<ReportCategory, React.ReactNode> = {
  cliente: <Users size={18} className="text-emerald-500" />,
  interno: <Building2 size={18} className="text-blue-500" />,
  motorista: <Truck size={18} className="text-orange-500" />,
};

// Prédios ao fundo (parallax lento) — silhuetas azul-escuro
const BUILDINGS_FAR: { w: number; h: number; gap: number; windows: number }[] = [
  { w: 70, h: 120, gap: 8, windows: 9 },
  { w: 56, h: 90, gap: 6, windows: 6 },
  { w: 80, h: 150, gap: 8, windows: 12 },
  { w: 48, h: 70, gap: 6, windows: 4 },
  { w: 64, h: 110, gap: 8, windows: 8 },
  { w: 72, h: 135, gap: 8, windows: 10 },
  { w: 52, h: 80, gap: 6, windows: 5 },
  { w: 88, h: 165, gap: 10, windows: 15 },
  { w: 60, h: 100, gap: 8, windows: 7 },
  { w: 50, h: 75, gap: 6, windows: 4 },
];

// Prédios próximos (parallax rápido) — azul mais saturado
const BUILDINGS_NEAR: { w: number; h: number; gap: number; windows: number }[] = [
  { w: 90, h: 130, gap: 10, windows: 12 },
  { w: 70, h: 95, gap: 8, windows: 8 },
  { w: 110, h: 170, gap: 12, windows: 20 },
  { w: 60, h: 80, gap: 8, windows: 5 },
  { w: 84, h: 120, gap: 10, windows: 12 },
  { w: 96, h: 150, gap: 10, windows: 16 },
  { w: 68, h: 90, gap: 8, windows: 6 },
  { w: 120, h: 185, gap: 12, windows: 24 },
];

// Nuvens drifting ao fundo
const CLOUDS: { top: number; left: number; w: number; h: number; dur: number; delay: number }[] = [
  { top: 8, left: -20, w: 180, h: 50, dur: 60, delay: 0 },
  { top: 18, left: -40, w: 240, h: 60, dur: 80, delay: -20 },
  { top: 5, left: -10, w: 140, h: 40, dur: 70, delay: -45 },
  { top: 22, left: -30, w: 200, h: 55, dur: 90, delay: -60 },
];

// Carros na contra-mão (vindo da direita para esquerda)
const ONCOMING_CARS: {
  type: "hatchback" | "sedan" | "compact" | "suv" | "coupe";
  color: string;
  border: string;
  dur: number;
  delay: number;
  scale: number;
}[] = [
  { type: "hatchback", color: "#dc2626", border: "#7f1d1d", dur: 7, delay: 0, scale: 1 },
  { type: "sedan", color: "#16a34a", border: "#14532d", dur: 9, delay: -3, scale: 0.85 },
  { type: "compact", color: "#eab308", border: "#713f12", dur: 8, delay: -5, scale: 0.9 },
  { type: "suv", color: "#0891b2", border: "#164e63", dur: 10, delay: -1.5, scale: 0.8 },
  { type: "coupe", color: "#c026d3", border: "#701a75", dur: 8.5, delay: -6.5, scale: 0.95 },
];

// Silhuetas SVG dos carros (96x42, frente à esquerda)
const CAR_SILHOUETTES: Record<
  string,
  { body: string; glass: string }
> = {
  // Hatchback (Fiesta) — teto curto, traseira vertical
  hatchback: {
    body: "M 2 36 L 2 28 L 8 26 L 14 22 L 22 16 L 34 13 L 54 13 L 66 17 L 76 24 L 86 30 L 92 33 L 92 36 L 82 36 A 11 11 0 0 0 60 36 L 36 36 A 11 11 0 0 0 14 36 L 2 36 Z",
    glass: "M 24 18 L 34 15 L 52 15 L 62 19 L 56 23 L 26 23 Z",
  },
  // Sedan (Corolla) — capô longo, três volumes, porta-malas elevado
  sedan: {
    body: "M 2 36 L 2 28 L 8 26 L 14 23 L 20 17 L 30 13 L 48 12 L 56 13 L 62 15 L 66 17 L 72 15 L 78 17 L 84 22 L 90 28 L 92 32 L 92 36 L 82 36 A 11 11 0 0 0 60 36 L 36 36 A 11 11 0 0 0 14 36 L 2 36 Z",
    glass: "M 22 18 L 30 14 L 54 14 L 60 17 L 54 20 L 24 20 Z",
  },
  // Compact (Mini/Smart) — cabine alta e curta, quase quadrado
  compact: {
    body: "M 2 36 L 2 26 L 6 22 L 10 14 L 16 11 L 62 11 L 70 14 L 80 20 L 88 26 L 92 30 L 92 36 L 82 36 A 11 11 0 0 0 60 36 L 36 36 A 11 11 0 0 0 14 36 L 2 36 Z",
    glass: "M 14 14 L 18 12 L 58 12 L 64 15 L 58 19 L 16 19 Z",
  },
  // SUV — alto, reto, teto plano, para-brisa vertical
  suv: {
    body: "M 2 36 L 2 24 L 6 20 L 10 12 L 16 10 L 66 10 L 74 13 L 82 18 L 88 24 L 92 28 L 92 36 L 82 36 A 11 11 0 0 0 60 36 L 36 36 A 11 11 0 0 0 14 36 L 2 36 Z",
    glass: "M 12 13 L 16 11 L 64 11 L 68 14 L 64 17 L 14 17 Z",
  },
  // Coupe/Fastback — teto longo inclinado, esportivo
  coupe: {
    body: "M 2 36 L 2 28 L 8 26 L 14 24 L 22 19 L 34 14 L 48 11 L 60 12 L 68 15 L 76 19 L 84 24 L 90 28 L 92 32 L 92 36 L 82 36 A 11 11 0 0 0 60 36 L 36 36 A 11 11 0 0 0 14 36 L 2 36 Z",
    glass: "M 24 20 L 34 15 L 56 12 L 64 14 L 60 19 L 26 23 Z",
  },
};

const CATEGORY_COLORS: Record<
  ReportCategory,
  { active: string; icon: string; hover: string }
> = {
  cliente: {
    active:
      "border-emerald-400 bg-emerald-50 text-emerald-800 shadow-md shadow-emerald-100/50",
    icon: "text-emerald-600",
    hover: "hover:border-emerald-200 hover:bg-emerald-50/50",
  },
  interno: {
    active:
      "border-blue-400 bg-blue-50 text-blue-700 shadow-md shadow-blue-100/50",
    icon: "text-blue-600",
    hover: "hover:border-blue-200 hover:bg-blue-50/50",
  },
  motorista: {
    active:
      "border-orange-400 bg-orange-50 text-orange-800 shadow-md shadow-orange-100/50",
    icon: "text-orange-600",
    hover: "hover:border-orange-200 hover:bg-orange-50/50",
  },
};

const TEMPLATE_ICONS: Record<ReportTemplate, React.ReactNode> = {
  medicao_cliente: <Receipt size={18} className="text-emerald-500" />,
  repasse_motorista: <Wallet size={18} className="text-amber-500" />,
  resumo_motoristas: <ClipboardList size={18} className="text-purple-500" />,
  performance: <TrendingUp size={18} className="text-emerald-500" />,
  liberadas_faturamento: <CheckCircle2 size={18} className="text-blue-500" />,
  pendentes_repasse: <Clock size={18} className="text-orange-500" />,
};

const TEMPLATES: TemplateConfig[] = [
  {
    id: "medicao_cliente",
    label: "Medição para Cliente",
    description:
      "Relatório completo para envio ao cliente com todas as OS do período",
    category: "cliente",
    extraFilters: ["clienteId"],
  },
  {
    id: "repasse_motorista",
    label: "Repasse a Motoristas",
    description:
      "OS executadas por motoristas autônomos, internos ou parceiros, com valores a repassar",
    category: "motorista",
    extraFilters: ["driverId", "parceiroId"],
  },
  {
    id: "resumo_motoristas",
    label: "Resumo Geral de Motoristas",
    description:
      "Consolidado por motorista/parceiro: serviços realizados, pagos, pendentes e valores totais",
    category: "motorista",
  },
  {
    id: "performance",
    label: "Performance Financeira",
    description: "Análise completa de receita, custo, imposto e lucro por OS",
    category: "interno",
  },
  {
    id: "liberadas_faturamento",
    label: "Liberadas para Faturamento",
    description: "OS finalizadas que ainda não foram faturadas",
    category: "interno",
  },
  {
    id: "pendentes_repasse",
    label: "Pendentes de Repasse",
    description: "OS com pagamento ao motorista/parceiro ainda pendente",
    category: "interno",
  },
];

export type ReportPayload = {
  template: ReportTemplate;
  format: ReportFormat;
  dataInicio: string;
  dataFim: string;
  clienteId?: string;
  parceiroId?: string;
  driverId?: string;
  repasseStatusFilter?: "all" | "pending" | "paid";
  /**
   * Modo Seleção: quando ativo, o relatório inclui apenas as OS cujos IDs
   * estão em `selectedOsIds`, ignorando o filtro automático de período.
   * Atualmente só é respeitado pelo template `medicao_cliente`, mas foi
   * modelado de forma genérica para ser expandido a outros templates.
   */
  selectionMode?: boolean;
  selectedOsIds?: string[];
};

interface RelatorioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (payload: ReportPayload) => void;
  defaultDataInicio: string;
  defaultDataFim: string;
  loading?: boolean;
  clientes?: Array<{ id: string; nome: string }>;
  parceiros?: Array<{ id: string; razaoSocialOuNomeCompleto: string }>;
  drivers?: Array<{
    id: string;
    name: string;
    phone?: string;
    vinculo_tipo?: string;
    avatar_url?: string;
  }>;
  driverPartnerMap?: Map<string, string>;
}

export default function RelatorioModal({
  isOpen,
  onClose,
  onGenerate,
  defaultDataInicio,
  defaultDataFim,
  loading = false,
  clientes = [],
  parceiros = [],
  drivers = [],
  driverPartnerMap = new Map(),
}: RelatorioModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | "">(
    "",
  );
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>("cliente");
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [dataInicio, setDataInicio] = useState(defaultDataInicio);
  const [dataFim, setDataFim] = useState(defaultDataFim);
  const [clienteId, setClienteId] = useState("");
  const [parceiroId, setParceiroId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [repasseStatusFilter, setRepasseStatusFilter] = useState<
    "all" | "pending" | "paid"
  >("all");
  const [isTallModal, setIsTallModal] = useState(false);

  // Estado para recolher o painel de configuração no modo seleção.
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);
  // Modo Seleção — por enquanto só exposto para "medicao_cliente".
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedOsIds, setSelectedOsIds] = useState<string[]>([]);
  // Soma dos valores das OS marcadas (alimentada pelo OSPickerPanel).
  const [, setSelectedOsTotal] = useState(0);
  // Mês exibido no calendário do painel de seleção (ex: "Junho 2026").
  const [pickerMonthLabel, setPickerMonthLabel] = useState("");

  const isMedicaoCliente = selectedTemplate === "medicao_cliente";
  const selectionEnabled = isMedicaoCliente && Boolean(clienteId);
  // Modo Seleção ativo = layout em duas colunas (config à esquerda, picker
  // à direita) e modal mais largo.
  const showSelectionLayout = selectionEnabled && selectionMode;

  const dateRangeInvalid = Boolean(
    dataInicio && dataFim && dataInicio > dataFim,
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsTallModal(w >= 1300 && h <= 950);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Motoristas "individuais" (autônomos e internos) — não vinculados a
  // nenhum parceiro. Selecionáveis diretamente no primeiro select do
  // Repasse a Motoristas, sem etapa adicional.
  const individualDrivers = useMemo(
    () => drivers.filter((driver) => driver.vinculo_tipo !== "parceiro"),
    [drivers],
  );

  // Sem parceiro selecionado ("Todos os parceiros"), o select de motorista
  // lista todos os drivers vinculados a qualquer parceiro.
  const partnerDrivers = useMemo(
    () =>
      drivers.filter((driver) =>
        parceiroId
          ? driverPartnerMap.get(driver.id) === parceiroId
          : Boolean(driverPartnerMap.get(driver.id)),
      ),
    [drivers, driverPartnerMap, parceiroId],
  );

  // Opções do select unificado "Motorista ou Parceiro": motoristas
  // individuais (id prefixado "driver:") + parceiros (id prefixado
  // "parceiro:"). Selecionar um parceiro revela um segundo select para
  // escolher (opcionalmente) um motorista específico dele.
  const motoristaParceiroOptions = useMemo(
    () => [
      ...individualDrivers.map((driver) => ({
        id: `driver:${driver.id}`,
        nome: driver.name,
        sublabel: driver.phone,
        typeLabel: driver.vinculo_tipo === "interno" ? "Interno" : "Autônomo",
        photoUrl: driver.avatar_url,
      })),
      ...parceiros.map((partner) => ({
        id: `parceiro:${partner.id}`,
        nome: partner.razaoSocialOuNomeCompleto,
        typeLabel: "Parceiro",
      })),
    ],
    [individualDrivers, parceiros],
  );

  // Quando um parceiro está selecionado, o primeiro select sempre mostra
  // o parceiro — mesmo se um motorista dele foi escolhido no segundo
  // select (cascata). O motorista aparece no segundo select.
  const motoristaParceiroValue = parceiroId
    ? `parceiro:${parceiroId}`
    : driverId
      ? `driver:${driverId}`
      : "";

  const handleMotoristaParceiroChange = (value: string) => {
    if (value.startsWith("driver:")) {
      setDriverId(value.slice("driver:".length));
      setParceiroId("");
    } else if (value.startsWith("parceiro:")) {
      setParceiroId(value.slice("parceiro:".length));
      setDriverId("");
    } else {
      setDriverId("");
      setParceiroId("");
    }
  };

  useEffect(() => {
    if (selectedTemplate !== "repasse_motorista") return;
    if (
      driverId &&
      parceiroId &&
      driverPartnerMap.get(driverId) !== parceiroId
    ) {
      setDriverId("");
    }
  }, [driverId, driverPartnerMap, parceiroId, selectedTemplate]);

  // Reset da seleção manual ao trocar de template (a seleção só faz sentido
  // para medicao_cliente; os IDs marcados pertencem àquele contexto).
  useEffect(() => {
    if (selectedTemplate !== "medicao_cliente") {
      setSelectionMode(false);
      setSelectedOsIds([]);
      setSelectedOsTotal(0);
    }
  }, [selectedTemplate]);

  const isRepasseTemplate = selectedTemplate === "repasse_motorista";

  // Wizard flow: o período só aparece após a etapa de seleção da entidade
  // estar completa. Apenas `medicao_cliente` exige entidade (cliente); nos
  // templates de repasse a seleção de motorista/parceiro é opcional
  // ("Todos"), então o período aparece logo após a escolha do template.
  const isSelectionStepComplete =
    !!selectedTemplate &&
    ((selectedTemplate === "medicao_cliente" && !!clienteId) ||
      selectedTemplate === "repasse_motorista" ||
      selectedTemplate === "resumo_motoristas" ||
      selectedTemplate === "performance" ||
      selectedTemplate === "liberadas_faturamento" ||
      selectedTemplate === "pendentes_repasse");

  const canGenerate =
    selectedTemplate &&
    dataInicio &&
    dataFim &&
    !dateRangeInvalid &&
    (selectedTemplate !== "medicao_cliente" || clienteId) &&
    // No Modo Seleção, é obrigatório marcar ao menos uma OS.
    (!selectionEnabled || !selectionMode || selectedOsIds.length > 0);

  const handleGenerate = () => {
    if (!selectedTemplate || !dataInicio || !dataFim || dateRangeInvalid)
      return;
    if (selectedTemplate === "medicao_cliente" && !clienteId) return;
    if (selectionEnabled && selectionMode && selectedOsIds.length === 0) return;

    onGenerate({
      template: selectedTemplate,
      format,
      dataInicio,
      dataFim,
      clienteId: selectedTemplate === "medicao_cliente" ? clienteId : undefined,
      parceiroId:
        selectedTemplate === "repasse_motorista" ? parceiroId : undefined,
      driverId:
        selectedTemplate === "repasse_motorista" ? driverId : undefined,
      repasseStatusFilter: isRepasseTemplate ? repasseStatusFilter : undefined,
      selectionMode: selectionEnabled && selectionMode,
      selectedOsIds:
        selectionEnabled && selectionMode ? selectedOsIds : undefined,
    });
  };

  const handleClienteChange = (value: string) => {
    setClienteId(value);
    // Trocou de cliente: descarta seleção anterior (pertencia a outro cliente).
    setSelectedOsIds([]);
    setSelectedOsTotal(0);
  };

  const handleClose = () => {
    onClose();
    setSelectedTemplate("");
    setSelectedCategory("cliente");
    setFormat("pdf");
    setDataInicio(defaultDataInicio);
    setDataFim(defaultDataFim);
    setClienteId("");
    setParceiroId("");
    setDriverId("");
    setRepasseStatusFilter("all");
    setSelectionMode(false);
    setSelectedOsIds([]);
    setSelectedOsTotal(0);
    setIsConfigCollapsed(false);
  };

  // Bloco de período reutilizável. Para relatórios de motorista (repasse),
  // é renderizado logo após a seleção do template; para medicao_cliente,
  // permanece na posição original (após a seleção da entidade).
  const periodSection = (
    <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className={`p-5 rounded-3xl border space-y-4 ${selectionMode ? "bg-white/70 border-blue-100/50" : "bg-slate-50/50 border-slate-100"}`}>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex items-end gap-2 max-w-[360px]">
          <div className="flex-1 min-w-0">
            <GeologDateInput
              label="De"
              value={dataInicio}
              onChange={setDataInicio}
              labelClassName="text-emerald-600 font-bold"
              inputClassName={
                selectionMode
                  ? "!bg-white/80 !border-slate-300"
                  : "!border-slate-300"
              }
            />
          </div>
          <div className="mb-3.5 flex items-center justify-center">
            <ArrowRight
              size={16}
              className="text-slate-400 animate-pulse"
            />
          </div>
          <div className="flex-1 min-w-0">
            <GeologDateInput
              label="Até"
              value={dataFim}
              onChange={setDataFim}
              labelClassName="text-blue-600 font-bold"
              inputClassName={
                selectionMode
                  ? "!bg-white/80 !border-slate-300"
                  : "!border-slate-300"
              }
            />
          </div>
        </div>

        {/* Toggle Fixo vs Seleção inline no canto direito.
            - medicao_cliente: interativo (alterna entre Fixo/Seleção).
            - repasse_*: visível travado em "Fixo" (Seleção desabilitado;
              modo seleção será implementado depois para motoristas). */}
        {(isMedicaoCliente || isRepasseTemplate) && !selectionMode && (
          <div className="ml-auto flex rounded-2xl border-2 border-slate-100 bg-white p-1">
            <button
              type="button"
              onClick={() => setSelectionMode(false)}
              aria-pressed={!selectionMode}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black tracking-tight transition-all cursor-pointer ${
                !selectionMode
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              <Calendar size={16} />
              Fixo
            </button>
            <button
              type="button"
              onClick={
                isRepasseTemplate
                  ? undefined
                  : () => {
                      setSelectionMode(true);
                      setIsConfigCollapsed(true);
                    }
              }
              disabled={isRepasseTemplate}
              aria-pressed={selectionMode}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black tracking-tight transition-all ${
                isRepasseTemplate
                  ? "cursor-not-allowed text-slate-300"
                  : selectionMode
                    ? "bg-blue-600 text-white shadow-sm cursor-pointer"
                    : "text-slate-400 hover:text-slate-700 cursor-pointer"
              }`}
            >
              <ListChecks size={16} />
              Seleção
            </button>
          </div>
        )}
      </div>

      {dateRangeInvalid && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          <AlertCircle size={16} className="shrink-0 text-red-500" />
          <p className="text-xs font-bold text-red-600">
            A data inicial não pode ser maior que a data final.
          </p>
        </div>
      )}
    </div>
    </div>
  );

  // Conteúdo de configuração do relatório, compartilhado entre os layouts.
  const reportConfig = (
    <>
      {/* Template Selection — chips de categoria + cards de relatório */}
      <div className="space-y-3 mt-3 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className={`p-5 rounded-3xl border space-y-4 ${selectionMode ? "bg-white/70 border-blue-100/50" : "bg-slate-50/50 border-slate-100"}`}>
          {/* Chips de categoria */}
          <div className="relative flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABELS) as ReportCategory[]).map((cat) => {
              const isActive = selectedCategory === cat;
              const colors = CATEGORY_COLORS[cat];
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSelectedTemplate("");
                  }}
                  aria-pressed={isActive}
                  className={`relative z-10 flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-black tracking-tight transition-all cursor-pointer ${
                    isActive
                      ? colors.active
                      : `border-slate-100 bg-white text-slate-600 ${colors.hover}`
                  }`}
                >
                  {CATEGORY_ICONS[cat]}
                  {CATEGORY_LABELS[cat]}
                </button>
              );
            })}
          </div>

          {/* Cards de relatório da categoria selecionada.
              Quando um template já foi selecionado, os cards recolhem ao
              sair do hover do grupo, exibindo um label compacto do template
              ativo. Ao passar o mouse novamente, os cards reaparecem
              (libera espaço na modal). */}
          <div
            className={`grid gap-3 ${
              showSelectionLayout ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
            } ${selectedTemplate ? "group/template-cards" : ""}`}
          >
            {selectedTemplate && (
              <div className="col-span-full flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 group-hover/template-cards:hidden">
                {TEMPLATE_ICONS[selectedTemplate as ReportTemplate]}
                <span className="text-sm font-black tracking-tight text-slate-700 whitespace-nowrap">
                  {TEMPLATES.find((t) => t.id === selectedTemplate)?.label}
                </span>
                <span className="ml-auto whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Passe o mouse para trocar
                </span>
              </div>
            )}
            <div
              className={`contents ${
                selectedTemplate
                  ? "hidden group-hover/template-cards:contents"
                  : "contents"
              }`}
            >
            {TEMPLATES.filter((t) => t.category === selectedCategory).map(
              (template) => {
                const isActive = selectedTemplate === template.id;
                const colors = CATEGORY_COLORS[selectedCategory];
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplate(template.id)}
                    aria-pressed={isActive}
                    className={`relative flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all cursor-pointer ${
                      isActive
                        ? colors.active
                        : `border-slate-100 bg-white ${colors.hover}`
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        isActive ? "bg-white shadow-sm" : "bg-slate-50"
                      }`}
                    >
                      {TEMPLATE_ICONS[template.id]}
                    </span>
                    <span className="min-w-0 flex-1 pr-5">
                      <span className={`block text-sm font-black leading-tight ${isActive ? colors.icon : "text-slate-800"}`}>
                        {template.label}
                      </span>
                    </span>
                    {isActive && (
                      <CheckCircle
                        size={18}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 ${colors.icon}`}
                      />
                    )}
                  </button>
                );
              },
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Period — para relatórios de motorista (repasse), aparece logo
          após a seleção do template, antes dos filtros de motorista/parceiro. */}
      {isRepasseTemplate && isSelectionStepComplete && periodSection}


      {/* Cliente Selection (Only for Medição ao Cliente) */}
      {selectedTemplate === "medicao_cliente" && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-4">
          <div className={`p-5 rounded-3xl border ${selectionMode ? "bg-white/70 border-blue-100/50" : "bg-slate-50/50 border-slate-100"}`}>
            <GeologSearchableSelect
              options={clientes}
              value={clienteId}
              onChange={handleClienteChange}
              placeholder="Selecione um cliente..."
              triggerClassName="px-4 py-3 text-base"
              dropdownPosition="up"
            />
          </div>
        </div>
      )}

      {/* Motorista/Parceiro Selection (Repasse a Motoristas) — select único
          com motoristas individuais (autônomos/internos) e parceiros. Ao
          escolher um parceiro, um segundo select aparece para restringir a
          um motorista específico dele (opcional). */}
      {selectedTemplate === "repasse_motorista" && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-4">
          <div className={`p-5 rounded-3xl border ${selectionMode ? "bg-white/70 border-blue-100/50" : "bg-slate-50/50 border-slate-100"}`}>
            <GeologSearchableSelect
              label="Motorista ou Parceiro"
              options={[
                {
                  id: "",
                  nome: "Todos os motoristas e parceiros",
                  nomeNode: (
                    <span className="text-slate-400">
                      Todos os motoristas e parceiros
                    </span>
                  ),
                },
                ...motoristaParceiroOptions,
              ]}
              value={motoristaParceiroValue}
              onChange={handleMotoristaParceiroChange}
              placeholder="Todos os motoristas e parceiros"
              triggerClassName="px-4 py-3 text-base"
              dropdownPosition="up"
            />
          </div>

          {parceiroId && (
            <div className={`p-5 rounded-3xl border ${selectionMode ? "bg-white/70 border-blue-100/50" : "bg-slate-50/50 border-slate-100"}`}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <GeologSearchableSelect
                    label="Motorista do parceiro"
                    options={[
                      { id: "", nome: "Todos os motoristas" },
                      ...partnerDrivers.map((driver) => ({
                        id: driver.id,
                        nome: driver.name,
                        sublabel: driver.phone || undefined,
                        typeLabel: "Motorista",
                        photoUrl: driver.avatar_url,
                      })),
                    ]}
                    value={driverId}
                    onChange={setDriverId}
                    placeholder="Todos os motoristas"
                    triggerClassName="px-4 py-3 text-base"
                    dropdownPosition="up"
                  />
                </div>
                {driverId && (
                  <button
                    onClick={() => setDriverId("")}
                    className="shrink-0 p-2 text-slate-400 hover:text-red-400 hover:bg-red-50 rounded-xl transition-all cursor-pointer mt-6"
                    title="Limpar seleção de motorista"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Repasse filter (if template supports it) */}
      {isRepasseTemplate && (
        <div className="animate-in fade-in duration-300">
          <div className="space-y-3">
            <label className="block text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 ml-1">
              Status do Repasse
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                {
                  value: "all" as const,
                  label: "Exportar tudo",
                  activeClass:
                    "border-blue-400 bg-blue-50 text-blue-700 shadow-md shadow-blue-100/50",
                },
                {
                  value: "pending" as const,
                  label: "Pendentes",
                  activeClass:
                    "border-amber-400 bg-amber-50 text-amber-900 shadow-md shadow-amber-100/50",
                },
                {
                  value: "paid" as const,
                  label: "Pagos",
                  activeClass:
                    "border-emerald-400 bg-emerald-50 text-emerald-900 shadow-md shadow-emerald-100/50",
                },
              ].map((option) => {
                const isActive = repasseStatusFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRepasseStatusFilter(option.value)}
                    aria-pressed={isActive}
                    className={`flex items-center justify-center gap-3 px-5 py-3 rounded-2xl border-2 cursor-pointer transition-all ${
                      isActive
                        ? option.activeClass
                        : "border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50/50"
                    }`}
                  >
                    <span className="text-sm font-black tracking-tight">
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Info Banners */}
      {selectedTemplate === "pendentes_repasse" && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50/60 border border-amber-200">
          <AlertCircle size={20} className="text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-black text-amber-800">
              Apenas ordens com repasse pendente
            </p>
            <p className="text-xs font-medium text-amber-600 mt-0.5">
              Motoristas autônomos e parceiros que ainda não tiveram o pagamento
              registrado.
            </p>
          </div>
        </div>
      )}

      {selectedTemplate === "liberadas_faturamento" && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50/60 border border-blue-200">
          <AlertCircle size={20} className="text-blue-600 shrink-0" />
          <div>
            <p className="text-sm font-black text-blue-800">
              Apenas ordens prontas para faturar
            </p>
            <p className="text-xs font-medium text-blue-600 mt-0.5">
              Status operacional: Finalizado | Status financeiro: Pendente.
            </p>
          </div>
        </div>
      )}

      {/* Period — para medicao_cliente e demais templates, aparece após
          a etapa de seleção da entidade. */}
      {!isRepasseTemplate && isSelectionStepComplete && periodSection}
    </>
  );

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all ${isTallModal ? "p-1" : "p-4"}`}
    >
      <div
        className="absolute inset-0 bg-[#001C3A]/60 backdrop-blur-md"
        onClick={loading ? undefined : handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative bg-white w-full ${
          showSelectionLayout
            ? "max-w-[96vw] w-full h-[98vh] rounded-[1.5rem]"
            : isTallModal
              ? "max-w-[720px] h-[90vh] rounded-[1.5rem]"
              : "max-w-3xl max-h-[92vh] rounded-[2.5rem]"
        } shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 border border-slate-200`}
        style={{ textRendering: "geometricPrecision" }}
      >
        <div
          className={`relative flex items-center justify-between px-6 py-3 bg-blue-50/70 border-b border-blue-100 shrink-0`}
        >
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Exportar Relatório
              </h2>
              {!showSelectionLayout && (
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  Selecione o tipo de relatório e o período desejado.
                </p>
              )}
            </div>

          </div>
          {showSelectionLayout && pickerMonthLabel && (() => {
            const [month, year] = pickerMonthLabel.split(' ');
            return (
              <p className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                <span className="text-base font-black uppercase tracking-widest text-slate-900">
                  {month}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black tracking-wider border border-emerald-200">
                  {year}
                </span>
              </p>
            );
          })()}
          <button
            onClick={loading ? undefined : handleClose}
            disabled={loading}
            className={`p-2 rounded-xl transition-all ${loading ? "text-slate-300 cursor-not-allowed" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"}`}
          >
            <X size={20} />
          </button>
        </div>

        {showSelectionLayout ? (
          /* Layout em duas colunas: configuração (esq) + picker OS (dir).
             O painel da esquerda pode ser recolhido para dar mais espaço. */
          <div className="flex flex-1 min-h-0 h-full overflow-hidden">
            {/* Painel de configuração recolhível */}
            <div
              className={`flex h-full shrink-0 flex-col overflow-hidden border-r transition-all duration-300 ease-in-out ${
                selectionMode
                  ? "border-blue-200 bg-blue-100/60"
                  : "border-slate-200 bg-slate-50/30"
              }`}
              style={{ width: isConfigCollapsed ? 56 : 500 }}
            >
              {/* Cabeçalho / gatilho de recolher/expandir */}
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 shrink-0">
                {!isConfigCollapsed && (
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                    Configuração
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsConfigCollapsed((prev) => !prev)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
                  title={
                    isConfigCollapsed
                      ? "Expandir configuração"
                      : "Recolher configuração"
                  }
                >
                  {isConfigCollapsed ? (
                    <ChevronRight size={18} />
                  ) : (
                    <ChevronLeft size={18} />
                  )}
                </button>
              </div>

              {/* Conteúdo do formulário com fade suave */}
              <div
                className={`flex-1 overflow-y-auto custom-scrollbar transition-all duration-300 ease-in-out ${
                  isConfigCollapsed
                    ? "opacity-0 w-0 px-0 pb-0"
                    : "opacity-100 px-6 pb-6 space-y-6"
                }`}
                style={{
                  visibility: isConfigCollapsed ? "hidden" : "visible",
                }}
              >
                {reportConfig}
              </div>

              {/* Barra lateral minimalista quando recolhida */}
              {isConfigCollapsed && (
                <div className="flex flex-1 flex-col items-center gap-4 py-4 opacity-100 transition-opacity duration-300 delay-150">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <ListChecks size={16} />
                  </div>
                  <span
                    className="text-[10px] font-black uppercase tracking-widest text-slate-400"
                    style={{
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                    }}
                  >
                    Config
                  </span>
                </div>
              )}
            </div>

            <div className="flex h-full flex-1 flex-col overflow-hidden p-3 transition-all duration-300">
              <OSPickerPanel
                clienteId={clienteId}
                defaultDataInicio={dataInicio}
                defaultDataFim={dataFim}
                defaultStatusFilter="liberado"
                selectedIds={selectedOsIds}
                onSelectionChange={setSelectedOsIds}
                onSelectedTotalChange={setSelectedOsTotal}
                onMonthLabelChange={setPickerMonthLabel}
              />
            </div>
          </div>
        ) : (
          /* Layout clássico de coluna única. */
          <div
            className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar px-8 pb-8 space-y-8 ${isTallModal ? "px-6 pb-6 space-y-5" : ""}`}
          >
            {reportConfig}
          </div>
        )}

        <div className="px-6 py-4 bg-blue-50/70 border-t border-blue-100 flex items-center justify-between gap-4 shrink-0">
          {/* Format toggles */}
          <div className="flex gap-2.5">
            <button
              onClick={() => setFormat("pdf")}
              className={`cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-black transition-all ${
                format === "pdf"
                  ? "border-blue-400 bg-blue-50 text-blue-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              <FileText size={16} />
              PDF
            </button>
            <button
              onClick={() => setFormat("xlsx")}
              className={`cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-black transition-all ${
                format === "xlsx"
                  ? "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              <FileSpreadsheet size={16} />
              Excel
            </button>

            {/* Toggle Fixo vs Seleção no rodapé — só no modo Seleção */}
            {isMedicaoCliente && isSelectionStepComplete && selectionMode && (
              <div className="flex rounded-2xl border-2 border-slate-100 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setSelectionMode(false)}
                  aria-pressed={!selectionMode}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black tracking-tight transition-all cursor-pointer ${
                    !selectionMode
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  <Calendar size={16} />
                  Fixo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectionMode(true);
                    setIsConfigCollapsed(true);
                  }}
                  aria-pressed={selectionMode}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black tracking-tight transition-all cursor-pointer ${
                    selectionMode
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  <ListChecks size={16} />
                  Seleção
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || loading}
              className={`flex items-center gap-2 px-7 py-2.5 rounded-xl text-sm font-black transition-all shadow-md ${
                canGenerate && !loading
                  ? "cursor-pointer bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Gerar Relatório
                </>
              )}
            </button>
          </div>
        </div>

        {/* Overlay de exportação — van em movimento na cidade, não fechável */}
        {loading && (
          <div className="absolute inset-0 z-[10000] overflow-hidden animate-in fade-in duration-200">
            {/* Céu — paleta azul do sistema */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, #0b1220 0%, #0f1f3d 45%, #142b54 75%, #1e3a8a 100%)",
              }}
            />

            {/* Lua */}
            <div
              className="absolute rounded-full bg-slate-100/90"
              style={{
                top: "12%",
                right: "14%",
                width: 56,
                height: 56,
                boxShadow:
                  "0 0 40px 8px rgba(226,232,240,0.35), inset -10px -8px 0 0 rgba(148,163,184,0.45)",
              }}
            />

            {/* Nuvens drifting lento */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {CLOUDS.map((c, i) => (
                <div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    top: `${c.top}%`,
                    left: `${c.left}%`,
                    width: c.w,
                    height: c.h,
                    background:
                      "radial-gradient(ellipse at center, rgba(226,232,240,0.18) 0%, rgba(226,232,240,0.06) 60%, transparent 75%)",
                    filter: "blur(6px)",
                    animation: `cloud-drift ${c.dur}s linear infinite`,
                    animationDelay: `${c.delay}s`,
                  }}
                />
              ))}
            </div>

            {/* Montanha com Cristo Redentor (silhueta estática ao fundo) */}
            <div
              className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
              style={{ bottom: "26%", width: 520, height: 220, opacity: 0.55 }}
            >
              <svg
                viewBox="0 0 520 220"
                width="520"
                height="220"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Montanha (Corcovado) — forma arredondada */}
                <path
                  d="M0 220 C 80 180, 150 150, 210 120 C 240 105, 270 95, 300 95 C 330 95, 360 105, 390 120 C 430 140, 480 175, 520 220 Z"
                  fill="#0a1428"
                />
                {/* Segunda camada de morro à direita */}
                <path
                  d="M300 220 C 340 190, 380 170, 420 165 C 460 160, 490 185, 520 220 Z"
                  fill="#0d1a33"
                  opacity="0.7"
                />
                {/* Cristo Redentor — silhueta no topo (~x=300, base y=95) */}
                <g fill="#0a1428">
                  {/* Pedestal */}
                  <rect x="291" y="88" width="18" height="10" rx="1" />
                  {/* Corpo */}
                  <rect x="295" y="70" width="10" height="20" rx="1" />
                  {/* Cabeça */}
                  <circle cx="300" cy="66" r="4" />
                  {/* Braços esticados */}
                  <rect x="272" y="72" width="56" height="4" rx="1" />
                  {/* Vãos dos braços (claro) para dar forma de manto */}
                  <rect x="284" y="76" width="32" height="6" fill="#0f1f3d" opacity="0.5" />
                </g>
              </svg>
            </div>

            {/* Camada de prédios ao fundo (parallax lento) */}
            <div
              className="absolute bottom-[28%] left-0 h-[42%] flex"
              style={{ animation: "city-pan-slow 18s linear infinite" }}
            >
              {[0, 1].map((dup) => (
                <div key={dup} className="flex items-end shrink-0" style={{ width: "max-content" }}>
                  {BUILDINGS_FAR.map((b, i) => (
                    <div
                      key={`${dup}-${i}`}
                      className="relative shrink-0"
                      style={{
                        width: b.w,
                        height: b.h,
                        marginRight: b.gap,
                        background:
                          "linear-gradient(180deg, #1e293b 0%, #0f1f3d 100%)",
                        borderRadius: 4,
                      }}
                    >
                      {b.windows &&
                        Array.from({ length: b.windows }).map((_, w) => (
                          <span
                            key={w}
                            className="absolute rounded-[2px]"
                            style={{
                              left: `${8 + (w % 3) * 28}px`,
                              top: `${10 + Math.floor(w / 3) * 16}px`,
                              width: 8,
                              height: 8,
                              background:
                                (w + i + dup) % 4 === 0
                                  ? "rgba(250, 204, 21, 0.85)"
                                  : "rgba(96, 165, 250, 0.35)",
                            }}
                          />
                        ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Camada de prédios próxima (parallax rápido) */}
            <div
              className="absolute bottom-[26%] left-0 h-[34%] flex"
              style={{ animation: "city-pan-fast 8s linear infinite" }}
            >
              {[0, 1].map((dup) => (
                <div key={dup} className="flex items-end shrink-0" style={{ width: "max-content" }}>
                  {BUILDINGS_NEAR.map((b, i) => (
                    <div
                      key={`${dup}-${i}`}
                      className="relative shrink-0"
                      style={{
                        width: b.w,
                        height: b.h,
                        marginRight: b.gap,
                        background:
                          "linear-gradient(180deg, #1e3a8a 0%, #0b1a3a 100%)",
                        borderRadius: 6,
                        boxShadow: "0 0 0 1px rgba(30,58,138,0.4) inset",
                      }}
                    >
                      {b.windows &&
                        Array.from({ length: b.windows }).map((_, w) => (
                          <span
                            key={w}
                            className="absolute rounded-[2px]"
                            style={{
                              left: `${10 + (w % 4) * 22}px`,
                              top: `${12 + Math.floor(w / 4) * 18}px`,
                              width: 10,
                              height: 10,
                              background:
                                (w + i + dup) % 3 === 0
                                  ? "rgba(250, 204, 21, 0.9)"
                                  : "rgba(147, 197, 253, 0.5)",
                            }}
                          />
                        ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Pista / asfalto */}
            <div
              className="absolute bottom-0 left-0 right-0"
              style={{
                height: "26%",
                background: "linear-gradient(180deg, #0b1220 0%, #05080f 100%)",
                borderTop: "2px solid rgba(59,130,246,0.25)",
              }}
            >
              {/* Faixa central tracejada em movimento */}
              <div
                className="absolute left-0 right-0"
                style={{
                  top: "45%",
                  height: 4,
                  backgroundImage:
                    "repeating-linear-gradient(90deg, #f8fafc 0 32px, transparent 32px 64px)",
                  animation: "road-dash 0.6s linear infinite",
                }}
              />
            </div>

            {/* Carros na contra-mão (faixa superior da pista, direita → esquerda) */}
            {ONCOMING_CARS.map((car, idx) => (
              <div
                key={idx}
                className="absolute"
                style={{
                  bottom: "23%",
                  left: 0,
                  animation: `car-oncoming ${car.dur}s linear infinite`,
                  animationDelay: `${car.delay}s`,
                }}
              >
                <div
                  className="relative"
                  style={{ width: 96, height: 42, transform: `scale(${car.scale})` }}
                >
                  {/* Sombra */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 rounded-full"
                    style={{
                      bottom: -6,
                      width: 84,
                      height: 8,
                      background:
                        "radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 70%)",
                    }}
                  />
                  {/* Silhueta SVG do carro (formato por tipo) */}
                  <svg
                    viewBox="0 0 96 42"
                    width="96"
                    height="42"
                    className="absolute inset-0"
                    style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.4))" }}
                  >
                    <defs>
                      <linearGradient id={`carBody-${idx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={car.color} />
                        <stop offset="100%" stopColor={car.border} />
                      </linearGradient>
                    </defs>
                    {/* Corpo — silhueta específica do modelo */}
                    <path
                      d={CAR_SILHOUETTES[car.type].body}
                      fill={`url(#carBody-${idx})`}
                      stroke={car.border}
                      strokeWidth="1.2"
                    />
                    {/* Vidros (para-brisa + lateral) */}
                    <path
                      d={CAR_SILHOUETTES[car.type].glass}
                      fill="#93c5fd"
                      opacity="0.75"
                    />
                    {/* Farol dianteiro (esquerda — amarelo, virado para a van) */}
                    <circle cx="6" cy="28" r="3" fill="#fef08a" opacity="0.9" />
                    {/* Lanterna traseira (direita — vermelha) */}
                    <circle cx="88" cy="28" r="2.5" fill="#ef4444" opacity="0.85" />
                  </svg>
                  {/* Roda dianteira (esquerda) */}
                  <div
                    className="absolute rounded-full overflow-hidden"
                    style={{
                      left: 14,
                      bottom: -10,
                      width: 22,
                      height: 22,
                      background: "#020617",
                      border: "2px solid #334155",
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-full overflow-hidden"
                      style={{ animation: "wheel-spin 0.4s linear infinite" }}
                    >
                      <div
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                        style={{ width: 2, height: 12, background: "#64748b" }}
                      />
                      <div
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                        style={{ width: 12, height: 2, background: "#64748b" }}
                      />
                    </div>
                  </div>
                  {/* Roda traseira (direita) */}
                  <div
                    className="absolute rounded-full overflow-hidden"
                    style={{
                      right: 14,
                      bottom: -10,
                      width: 22,
                      height: 22,
                      background: "#020617",
                      border: "2px solid #334155",
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-full overflow-hidden"
                      style={{ animation: "wheel-spin 0.4s linear infinite" }}
                    >
                      <div
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                        style={{ width: 2, height: 12, background: "#64748b" }}
                      />
                      <div
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                        style={{ width: 12, height: 2, background: "#64748b" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Van — corpo principal em azul escuro com logo branca na lateral */}
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{ bottom: "20%", animation: "van-bob 1.1s ease-in-out infinite" }}
            >
              <div className="relative" style={{ width: 220, height: 96 }}>
                {/* Sombra no chão */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 rounded-full"
                  style={{
                    bottom: -10,
                    width: 200,
                    height: 14,
                    background:
                      "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 70%)",
                  }}
                />

                {/* Corpo da van */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: "linear-gradient(180deg, #1e3a8a 0%, #0f1f3d 100%)",
                    borderRadius: "18px 26px 10px 10px",
                    border: "1.5px solid #2b4cba",
                    boxShadow:
                      "0 10px 24px rgba(0,0,0,0.45), inset 0 2px 0 rgba(147,197,253,0.25)",
                  }}
                />

                {/* Cabine / para-brisa */}
                <div
                  className="absolute"
                  style={{
                    right: 12,
                    top: 12,
                    width: 52,
                    height: 34,
                    background:
                      "linear-gradient(180deg, #93c5fd 0%, #3b82f6 100%)",
                    borderRadius: "10px 18px 4px 4px",
                    opacity: 0.85,
                  }}
                />

                {/* Faixa decorativa lateral */}
                <div
                  className="absolute"
                  style={{
                    left: 14,
                    right: 80,
                    top: 26,
                    height: 4,
                    background:
                      "linear-gradient(90deg, transparent, #60a5fa, transparent)",
                    opacity: 0.6,
                  }}
                />

                {/* Faróis */}
                <div
                  className="absolute rounded-full"
                  style={{
                    right: 4,
                    top: 18,
                    width: 8,
                    height: 8,
                    background: "#fde68a",
                    boxShadow: "0 0 12px 4px rgba(253,224,71,0.7)",
                  }}
                />

                {/* Logo + nome na lateral */}
                <div
                  className="absolute flex items-center gap-1.5"
                  style={{
                    left: 22,
                    top: 44,
                    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
                  }}
                >
                  <img
                    src="/logo.png"
                    alt="Geolog"
                    style={{ height: 26, width: "auto" }}
                  />
                  <div className="flex flex-col leading-none">
                    <span className="text-white font-black tracking-tight" style={{ fontSize: 15 }}>
                      Geolog
                    </span>
                    <span
                      className="text-blue-100/80 font-semibold tracking-wide uppercase"
                      style={{ fontSize: 7, letterSpacing: "0.08em", marginTop: 3 }}
                    >
                      Transportes Executivo
                    </span>
                  </div>
                </div>

                {/* Roda dianteira */}
                <div
                  className="absolute rounded-full overflow-hidden"
                  style={{
                    right: 28,
                    bottom: -14,
                    width: 34,
                    height: 34,
                    background: "#020617",
                    border: "3px solid #334155",
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-full overflow-hidden"
                    style={{ animation: "wheel-spin 0.5s linear infinite" }}
                  >
                    <div
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{
                        width: 2,
                        height: 18,
                        background: "#64748b",
                      }}
                    />
                    <div
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{
                        width: 18,
                        height: 2,
                        background: "#64748b",
                      }}
                    />
                  </div>
                </div>

                {/* Roda traseira */}
                <div
                  className="absolute rounded-full overflow-hidden"
                  style={{
                    left: 28,
                    bottom: -14,
                    width: 34,
                    height: 34,
                    background: "#020617",
                    border: "3px solid #334155",
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-full overflow-hidden"
                    style={{ animation: "wheel-spin 0.5s linear infinite" }}
                  >
                    <div
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{
                        width: 2,
                        height: 18,
                        background: "#64748b",
                      }}
                    />
                    <div
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{
                        width: 18,
                        height: 2,
                        background: "#64748b",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Texto + barra de progresso */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[14%] flex flex-col items-center">
              <p className="text-white text-xl font-black tracking-tight drop-shadow">
                Exportando relatório
              </p>
              <p className="text-blue-200/80 text-sm font-medium mt-1.5">
                Aguarde, estamos preparando seu documento...
              </p>
              <div className="mt-5 w-60 h-1.5 rounded-full bg-slate-700/80 overflow-hidden">
                <div
                  className="h-full w-1/3 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, #1e3a8a, #60a5fa, #1e3a8a)",
                    animation: "van-progress 1.2s ease-in-out infinite",
                  }}
                />
              </div>
            </div>

            <style>{`
              @keyframes city-pan-slow {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              @keyframes city-pan-fast {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              @keyframes cloud-drift {
                0% { transform: translateX(0); }
                100% { transform: translateX(120vw); }
              }
              @keyframes car-oncoming {
                0% { transform: translateX(110vw); }
                100% { transform: translateX(-120px); }
              }
              @keyframes road-dash {
                0% { background-position: 0 0; }
                100% { background-position: -64px 0; }
              }
              @keyframes van-bob {
                0%, 100% { transform: translateX(-50%) translateY(0); }
                50% { transform: translateX(-50%) translateY(-3px); }
              }
              @keyframes wheel-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              @keyframes van-progress {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(400%); }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
}
