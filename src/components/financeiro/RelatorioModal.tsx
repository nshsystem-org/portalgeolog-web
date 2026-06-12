"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  Truck,
  Building2,
  TrendingUp,
  Clock,
  AlertCircle,
  HandCoins,
} from "lucide-react";
import GeologDateInput from "@/components/ui/GeologDateInput";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";

export type ReportTemplate =
  | "medicao_cliente"
  | "repasse_autonomos"
  | "repasse_parceiros"
  | "performance"
  | "liberadas_faturamento"
  | "pendentes_repasse";

export type ReportFormat = "pdf" | "csv";

type TemplateConfig = {
  id: ReportTemplate;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultGrouping?: string;
  extraFilters?: string[];
};

const TEMPLATES: TemplateConfig[] = [
  {
    id: "medicao_cliente",
    label: "Medição para Cliente",
    description:
      "Relatório completo para envio ao cliente com todas as OS do período",
    icon: <Building2 size={20} />,
    extraFilters: ["clienteId"],
  },
  {
    id: "repasse_autonomos",
    label: "Repasse a Autônomos",
    description:
      "OS executadas por motoristas autônomos com valores a repassar",
    icon: <Truck size={20} />,
    extraFilters: ["driverId"],
  },
  {
    id: "repasse_parceiros",
    label: "Repasse a Parceiros",
    description: "OS executadas por motoristas de parceiros estratégicos",
    icon: <HandCoins size={20} />,
  },
  {
    id: "performance",
    label: "Performance Financeira",
    description: "Análise completa de receita, custo, imposto e lucro por OS",
    icon: <TrendingUp size={20} />,
  },
  {
    id: "liberadas_faturamento",
    label: "Liberadas para Faturamento",
    description: "OS finalizadas que ainda não foram faturadas",
    icon: <FileText size={20} />,
  },
  {
    id: "pendentes_repasse",
    label: "Pendentes de Repasse",
    description: "OS com pagamento ao motorista/parceiro ainda pendente",
    icon: <Clock size={20} />,
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

  const autonomousDrivers = useMemo(
    () =>
      drivers.filter(
        (driver) => driver.vinculo_tipo === "autonomo" || !driver.vinculo_tipo,
      ),
    [drivers],
  );

  const partnerDrivers = useMemo(
    () =>
      drivers.filter(
        (driver) => driverPartnerMap.get(driver.id) === parceiroId,
      ),
    [drivers, driverPartnerMap, parceiroId],
  );

  useEffect(() => {
    if (selectedTemplate !== "repasse_parceiros") return;
    if (
      driverId &&
      parceiroId &&
      driverPartnerMap.get(driverId) !== parceiroId
    ) {
      setDriverId("");
    }
  }, [driverId, driverPartnerMap, parceiroId, selectedTemplate]);

  const isRepasseTemplate =
    selectedTemplate === "repasse_autonomos" ||
    selectedTemplate === "repasse_parceiros";

  const canGenerate =
    selectedTemplate &&
    dataInicio &&
    dataFim &&
    (selectedTemplate !== "medicao_cliente" || clienteId) &&
    (selectedTemplate !== "repasse_autonomos" || driverId) &&
    (selectedTemplate !== "repasse_parceiros" || parceiroId);

  const handleGenerate = () => {
    if (!selectedTemplate || !dataInicio || !dataFim) return;
    if (selectedTemplate === "medicao_cliente" && !clienteId) return;
    if (selectedTemplate === "repasse_autonomos" && !driverId) return;
    if (selectedTemplate === "repasse_parceiros" && !parceiroId) return;

    onGenerate({
      template: selectedTemplate,
      format,
      dataInicio,
      dataFim,
      clienteId: selectedTemplate === "medicao_cliente" ? clienteId : undefined,
      parceiroId:
        selectedTemplate === "repasse_parceiros" ? parceiroId : undefined,
      driverId:
        selectedTemplate === "repasse_autonomos" ||
        selectedTemplate === "repasse_parceiros"
          ? driverId
          : undefined,
      repasseStatusFilter: isRepasseTemplate ? repasseStatusFilter : undefined,
    });
  };

  const handleClose = () => {
    onClose();
    setSelectedTemplate("");
    setFormat("pdf");
    setDataInicio(defaultDataInicio);
    setDataFim(defaultDataFim);
    setClienteId("");
    setParceiroId("");
    setDriverId("");
    setRepasseStatusFilter("all");
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all ${isTallModal ? "p-1" : "p-4"}`}
    >
      <div
        className="absolute inset-0 bg-[#001C3A]/60 backdrop-blur-md"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative bg-white w-full max-w-3xl ${isTallModal ? "max-w-[720px] h-[90vh] rounded-[1.5rem]" : "max-h-[92vh] rounded-[2.5rem]"} shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 border border-slate-200`}
        style={{ textRendering: "geometricPrecision" }}
      >
        <div
          className={`flex items-center justify-between px-8 pt-6 pb-5 ${isTallModal ? "px-6 pt-4 pb-3" : ""} bg-blue-50/70 border-b border-blue-100`}
        >
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Exportar Relatório
            </h2>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Selecione o tipo de relatório e o período desejado.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X size={22} />
          </button>
        </div>

        <div
          className={`flex-1 overflow-y-auto custom-scrollbar px-8 pb-8 space-y-8 ${isTallModal ? "px-6 pb-6 space-y-5" : ""}`}
        >
          {/* Period */}
          <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500 mt-6">
            <label className="block text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 ml-1">
              Selecione o período
            </label>
            <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <GeologDateInput
                  label="Data Inicial"
                  value={dataInicio}
                  onChange={setDataInicio}
                  labelClassName="text-emerald-600 font-bold"
                />
                <GeologDateInput
                  label="Data Final"
                  value={dataFim}
                  onChange={setDataFim}
                  labelClassName="text-blue-600 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-3">
            <label className="block text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 ml-1">
              Tipo de Relatório
            </label>
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${isTallModal ? "gap-4" : ""}`}
            >
              {TEMPLATES.map((template) => {
                const isActive = selectedTemplate === template.id;
                return (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer ${isTallModal ? "p-5" : ""} ${
                      isActive
                        ? "border-emerald-400 bg-emerald-50/30 shadow-md shadow-emerald-100/50"
                        : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl shrink-0 ${
                        isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {React.cloneElement(
                        template.icon as React.ReactElement<{ size?: number }>,
                        {
                          size: 20,
                        },
                      )}
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p
                        className={`text-sm font-black tracking-tight ${
                          isActive ? "text-emerald-900" : "text-slate-800"
                        }`}
                      >
                        {template.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed font-medium">
                        {template.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cliente Selection (Only for Medição ao Cliente) */}
          {selectedTemplate === "medicao_cliente" && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                <GeologSearchableSelect
                  label="Cliente / Empresa Destino"
                  options={clientes}
                  value={clienteId}
                  onChange={setClienteId}
                  required
                  placeholder="Selecione um cliente..."
                  triggerClassName="px-4 py-3 text-base"
                  dropdownPosition="up"
                />
              </div>
            </div>
          )}

          {/* Driver Selection (Only for Repasse a Autônomos) */}
          {selectedTemplate === "repasse_autonomos" && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                <GeologSearchableSelect
                  label="Motorista Autônomo"
                  options={autonomousDrivers.map((driver) => ({
                    id: driver.id,
                    nome: driver.name,
                    sublabel: driver.phone || undefined,
                  }))}
                  value={driverId}
                  onChange={setDriverId}
                  required
                  placeholder="Selecione um motorista..."
                  triggerClassName="px-4 py-3 text-base"
                  dropdownPosition="up"
                />
              </div>
            </div>
          )}

          {/* Partner Selection (Only for Repasse a Parceiros) */}
          {selectedTemplate === "repasse_parceiros" && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-4">
              <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                <GeologSearchableSelect
                  label="Parceiro"
                  options={parceiros.map((partner) => ({
                    id: partner.id,
                    nome: partner.razaoSocialOuNomeCompleto,
                  }))}
                  value={parceiroId}
                  onChange={(value) => {
                    setParceiroId(value);
                    setDriverId("");
                  }}
                  required
                  placeholder="Selecione um parceiro..."
                  triggerClassName="px-4 py-3 text-base"
                  dropdownPosition="up"
                />
              </div>

              <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <GeologSearchableSelect
                      label="Motorista do parceiro"
                      options={partnerDrivers.map((driver) => ({
                        id: driver.id,
                        nome: driver.name,
                        sublabel: driver.phone || undefined,
                      }))}
                      value={driverId}
                      onChange={setDriverId}
                      disabled={!parceiroId}
                      placeholder={
                        parceiroId
                          ? "Opcional: selecione um motorista..."
                          : "Selecione um parceiro primeiro..."
                      }
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
                  Motoristas autônomos e parceiros que ainda não tiveram o
                  pagamento registrado.
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
        </div>

        <div
          className={`px-8 py-5 ${isTallModal ? "px-6 py-4" : ""} bg-blue-50/70 border-t border-blue-100 flex items-center justify-between gap-5`}
        >
          {/* Format toggles */}
          <div className="flex gap-3">
            <button
              onClick={() => setFormat("pdf")}
              className={`cursor-pointer flex items-center gap-2 ${isTallModal ? "px-5 py-3" : "px-4 py-2.5"} rounded-lg border-2 text-sm font-black transition-all ${
                format === "pdf"
                  ? "border-blue-400 bg-blue-50 text-blue-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              <FileText size={16} />
              PDF
            </button>
            <button
              onClick={() => setFormat("csv")}
              className={`cursor-pointer flex items-center gap-2 ${isTallModal ? "px-5 py-3" : "px-4 py-2.5"} rounded-lg border-2 text-sm font-black transition-all ${
                format === "csv"
                  ? "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              <FileSpreadsheet size={16} />
              Excel
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleClose}
              className={`cursor-pointer ${isTallModal ? "px-7 py-3.5" : "px-6 py-3"} text-sm font-black text-slate-500 hover:text-slate-700 transition-colors`}
            >
              Cancelar
            </button>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || loading}
              className={`flex items-center gap-2 ${isTallModal ? "px-10 py-3.5" : "px-8 py-3"} rounded-2xl text-base font-black transition-all shadow-lg shadow-slate-200/40 ${
                canGenerate && !loading
                  ? "cursor-pointer bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
              }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Download size={18} />
                  Gerar Relatório
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
