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
  Rocket,
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
                    <span className="flex items-center gap-2">
                      <span>Todos os motoristas e parceiros</span>
                      <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-800">Autônomo</span>
                      <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-900">Interno</span>
                      <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-cyan-100 text-cyan-800">Parceiro</span>
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

        {/* Overlay de exportação — foguete em movimento, não fechável */}
        {loading && (
          <div className="absolute inset-0 z-[10000] flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Estrelas de fundo */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: 24 }).map((_, i) => {
                const top = (i * 37) % 100;
                const left = (i * 53) % 100;
                const delay = (i % 6) * 0.3;
                const size = 1 + (i % 3);
                return (
                  <span
                    key={i}
                    className="absolute rounded-full bg-white/70 animate-pulse"
                    style={{
                      top: `${top}%`,
                      left: `${left}%`,
                      width: `${size}px`,
                      height: `${size}px`,
                      animationDelay: `${delay}s`,
                      animationDuration: `${1.5 + (i % 4) * 0.5}s`,
                    }}
                  />
                );
              })}
            </div>

            {/* Foguete + rastro */}
            <div className="relative flex flex-col items-center">
              <div className="relative animate-bounce" style={{ animationDuration: "1.4s" }}>
                {/* Rastro do foguete */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 w-1.5 h-16 rounded-full bg-gradient-to-b from-orange-400 via-orange-500 to-transparent animate-pulse"
                  style={{ animationDuration: "0.4s" }}
                />
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 w-3 h-10 rounded-full bg-gradient-to-b from-yellow-300/60 to-transparent blur-[2px] animate-pulse"
                  style={{ animationDuration: "0.3s", animationDelay: "0.1s" }}
                />
                {/* Ícone do foguete */}
                <Rocket
                  size={64}
                  className="text-white drop-shadow-[0_0_12px_rgba(255,200,100,0.6)] -rotate-45"
                  strokeWidth={1.5}
                />
              </div>

              {/* Texto */}
              <div className="mt-10 text-center">
                <p className="text-white text-xl font-black tracking-tight">
                  Exportando relatório
                </p>
                <p className="text-slate-400 text-sm font-medium mt-1.5">
                  Aguarde, estamos preparando seu documento...
                </p>
              </div>

              {/* Barra de progresso indeterminada */}
              <div className="mt-6 w-56 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full w-1/3 rounded-full bg-gradient-to-r from-orange-400 via-yellow-300 to-orange-400"
                  style={{
                    animation: "rocket-progress 1.2s ease-in-out infinite",
                  }}
                />
              </div>
            </div>

            <style>{`
              @keyframes rocket-progress {
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
