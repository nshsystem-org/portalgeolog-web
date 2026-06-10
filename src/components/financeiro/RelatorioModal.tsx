"use client";

import React, { useState, useMemo } from "react";
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
  onlyPending?: boolean;
};

interface RelatorioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (payload: ReportPayload) => void;
  defaultDataInicio: string;
  defaultDataFim: string;
  loading?: boolean;
  clientes?: Array<{ id: string; nome: string }>;
}

export default function RelatorioModal({
  isOpen,
  onClose,
  onGenerate,
  defaultDataInicio,
  defaultDataFim,
  loading = false,
  clientes = [],
}: RelatorioModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | "">(
    "",
  );
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [dataInicio, setDataInicio] = useState(defaultDataInicio);
  const [dataFim, setDataFim] = useState(defaultDataFim);
  const [clienteId, setClienteId] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);

  const activeTemplate = useMemo(
    () => TEMPLATES.find((t) => t.id === selectedTemplate),
    [selectedTemplate],
  );

  const canGenerate =
    selectedTemplate &&
    dataInicio &&
    dataFim &&
    (selectedTemplate !== "medicao_cliente" || clienteId);

  const handleGenerate = () => {
    if (!selectedTemplate || !dataInicio || !dataFim) return;
    if (selectedTemplate === "medicao_cliente" && !clienteId) return;

    onGenerate({
      template: selectedTemplate,
      format,
      dataInicio,
      dataFim,
      clienteId: selectedTemplate === "medicao_cliente" ? clienteId : undefined,
      onlyPending:
        activeTemplate?.id === "pendentes_repasse" ? true : onlyPending,
    });
  };

  const handleClose = () => {
    onClose();
    setSelectedTemplate("");
    setFormat("pdf");
    setDataInicio(defaultDataInicio);
    setDataFim(defaultDataFim);
    setClienteId("");
    setOnlyPending(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#001C3A]/60 backdrop-blur-md"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white w-full max-w-4xl max-h-[92vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 border border-slate-200"
        style={{ textRendering: "geometricPrecision" }}
      >
        <div className="flex items-center justify-between px-10 pt-10 pb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Exportar Relatório
            </h2>
            <p className="text-base font-medium text-slate-500 mt-2">
              Selecione o tipo de relatório e o período desejado.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-10 pb-10 space-y-12">
          {/* Template Selection */}
          <div className="space-y-5">
            <label className="block text-[12px] font-black uppercase tracking-[0.3em] text-slate-400 ml-1">
              Tipo de Relatório
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {TEMPLATES.map((template) => {
                const isActive = selectedTemplate === template.id;
                return (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`flex items-start gap-4 p-5 rounded-[2rem] border-2 text-left transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "border-emerald-400 bg-emerald-50/30 shadow-lg shadow-emerald-100/50"
                        : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50"
                    }`}
                  >
                    <div
                      className={`p-3.5 rounded-2xl shrink-0 ${
                        isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {React.cloneElement(template.icon as React.ReactElement, {
                        size: 24,
                      })}
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p
                        className={`text-base font-black tracking-tight ${
                          isActive ? "text-emerald-900" : "text-slate-800"
                        }`}
                      >
                        {template.label}
                      </p>
                      <p className="text-sm text-slate-500 mt-1 leading-relaxed font-medium">
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
              <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100">
                <GeologSearchableSelect
                  label="Cliente / Empresa Destino"
                  options={clientes}
                  value={clienteId}
                  onChange={setClienteId}
                  required
                  placeholder="Selecione um cliente..."
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Period */}
            <div className="space-y-5">
              <label className="block text-[12px] font-black uppercase tracking-[0.3em] text-slate-400 ml-1">
                Período
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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

            {/* Format */}
            <div className="space-y-5">
              <label className="block text-[12px] font-black uppercase tracking-[0.3em] text-slate-400 ml-1">
                Formato de Saída
              </label>
              <div className="flex gap-5">
                <button
                  onClick={() => setFormat("pdf")}
                  className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border-2 text-base font-black transition-all ${
                    format === "pdf"
                      ? "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-md"
                      : "border-slate-100 bg-white text-slate-600 hover:border-slate-200"
                  }`}
                >
                  <FileText size={22} />
                  PDF
                </button>
                <button
                  onClick={() => setFormat("csv")}
                  className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border-2 text-base font-black transition-all ${
                    format === "csv"
                      ? "border-blue-400 bg-blue-50 text-blue-700 shadow-md"
                      : "border-slate-100 bg-white text-slate-600 hover:border-slate-200"
                  }`}
                >
                  <FileSpreadsheet size={22} />
                  CSV
                </button>
              </div>
            </div>
          </div>

          {/* Pending only toggle (if template supports it) */}
          {(selectedTemplate === "repasse_autonomos" ||
            selectedTemplate === "repasse_parceiros") && (
            <div className="animate-in fade-in duration-300">
              <button
                onClick={() => setOnlyPending(!onlyPending)}
                className={`flex items-center gap-5 px-8 py-5 rounded-[2rem] border-2 transition-all ${
                  onlyPending
                    ? "border-amber-400 bg-amber-50/50 text-amber-900 shadow-lg"
                    : "border-slate-100 bg-white text-slate-600 hover:border-slate-200"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all ${
                    onlyPending
                      ? "bg-amber-500 border-amber-500 text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {onlyPending && (
                    <div className="w-3 h-3 bg-white rounded-full" />
                  )}
                </div>
                <span className="text-lg font-black tracking-tight">
                  Exportar apenas repasses pendentes
                </span>
              </button>
            </div>
          )}

          {/* Info Banners */}
          {selectedTemplate === "pendentes_repasse" && (
            <div className="flex items-center gap-4 p-6 rounded-[2rem] bg-amber-50/60 border border-amber-200">
              <AlertCircle size={24} className="text-amber-600 shrink-0" />
              <div>
                <p className="text-base font-black text-amber-800">
                  Apenas ordens com repasse pendente
                </p>
                <p className="text-sm font-medium text-amber-600 mt-1">
                  Motoristas autônomos e parceiros que ainda não tiveram o
                  pagamento registrado.
                </p>
              </div>
            </div>
          )}

          {selectedTemplate === "liberadas_faturamento" && (
            <div className="flex items-center gap-4 p-6 rounded-[2rem] bg-blue-50/60 border border-blue-200">
              <AlertCircle size={24} className="text-blue-600 shrink-0" />
              <div>
                <p className="text-base font-black text-blue-800">
                  Apenas ordens prontas para faturar
                </p>
                <p className="text-sm font-medium text-blue-600 mt-1">
                  Status operacional: Finalizado | Status financeiro: Pendente.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-10 py-10 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-5">
          <button
            onClick={handleClose}
            className="px-10 py-5 text-base font-black text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || loading}
            className={`flex items-center gap-3 px-12 py-5 rounded-[2rem] text-lg font-black transition-all shadow-xl shadow-slate-200/50 ${
              canGenerate && !loading
                ? "bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-1 active:translate-y-0"
                : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
            }`}
          >
            {loading ? (
              <>
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download size={22} />
                Gerar Relatório
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
