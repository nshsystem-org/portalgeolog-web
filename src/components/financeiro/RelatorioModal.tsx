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
  onlyPending?: boolean;
};

interface RelatorioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (payload: ReportPayload) => void;
  defaultDataInicio: string;
  defaultDataFim: string;
  loading?: boolean;
}

export default function RelatorioModal({
  isOpen,
  onClose,
  onGenerate,
  defaultDataInicio,
  defaultDataFim,
  loading = false,
}: RelatorioModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | "">(
    "",
  );
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [dataInicio, setDataInicio] = useState(defaultDataInicio);
  const [dataFim, setDataFim] = useState(defaultDataFim);
  const [onlyPending, setOnlyPending] = useState(false);

  const activeTemplate = useMemo(
    () => TEMPLATES.find((t) => t.id === selectedTemplate),
    [selectedTemplate],
  );

  const canGenerate = selectedTemplate && dataInicio && dataFim;

  const handleGenerate = () => {
    if (!selectedTemplate || !dataInicio || !dataFim) return;
    onGenerate({
      template: selectedTemplate,
      format,
      dataInicio,
      dataFim,
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
        className="relative bg-white w-full max-w-2xl max-h-[92vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 border border-slate-200"
        style={{ textRendering: "geometricPrecision" }}
      >
        <div className="flex items-center justify-between px-8 pt-8 pb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Exportar Relatório
            </h2>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Selecione o tipo de relatório e o período desejado.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-8 space-y-6">
          {/* Template Selection */}
          <div className="space-y-3">
            <label className="block text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
              Tipo de Relatório
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEMPLATES.map((template) => {
                const isActive = selectedTemplate === template.id;
                return (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "border-emerald-300 bg-emerald-50/50 shadow-md shadow-emerald-100/50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl shrink-0 ${
                        isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {template.icon}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-bold truncate ${
                          isActive ? "text-emerald-800" : "text-slate-800"
                        }`}
                      >
                        {template.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        {template.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Period */}
          <div className="space-y-3">
            <label className="block text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
              Período
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <GeologDateInput
                label="Inicial"
                value={dataInicio}
                onChange={setDataInicio}
                labelClassName="text-emerald-600"
              />
              <GeologDateInput
                label="Final"
                value={dataFim}
                onChange={setDataFim}
                labelClassName="text-blue-600"
              />
            </div>
          </div>

          {/* Format */}
          <div className="space-y-3">
            <label className="block text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
              Formato
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setFormat("pdf")}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl border text-sm font-bold transition-all ${
                  format === "pdf"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <FileText size={18} />
                PDF
              </button>
              <button
                onClick={() => setFormat("csv")}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl border text-sm font-bold transition-all ${
                  format === "csv"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <FileSpreadsheet size={18} />
                CSV
              </button>
            </div>
          </div>

          {/* Extra filters for certain templates */}
          {selectedTemplate === "pendentes_repasse" && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50/60 border border-amber-200">
              <AlertCircle size={20} className="text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-800">
                  Só OS com repasse pendente serão incluídas
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Motoristas autônomos e parceiros que ainda não receberam.
                </p>
              </div>
            </div>
          )}

          {selectedTemplate === "liberadas_faturamento" && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50/60 border border-blue-200">
              <AlertCircle size={20} className="text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-blue-800">
                  Só OS finalizadas e ainda não faturadas
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Status operacional = Finalizado e status financeiro =
                  Pendente.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-slate-100 shrink-0 bg-white">
          <button
            onClick={handleClose}
            className="px-5 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-95"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || loading}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-emerald-200 bg-emerald-50 text-sm font-bold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-emerald-300 border-t-emerald-700 rounded-full animate-spin" />
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
  );
}
