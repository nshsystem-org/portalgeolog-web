"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  X,
} from "lucide-react";
import type { ReactElement } from "react";
import GeologDateInput from "@/components/ui/GeologDateInput";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import { CaixaReportLoadingOverlay } from "./CaixaReportLoadingOverlay";
import type {
  CaixaReportFormat,
  CaixaReportPayload,
} from "@/app/portal/caixa/_services/caixa.service";
import {
  CATEGORIAS_ENTRADA,
  CATEGORIAS_SAIDA,
} from "@/app/portal/caixa/_lib/caixa-page";
import type { CaixaConta } from "@/app/portal/caixa/_lib/caixa-page";
import type { Cliente, Driver } from "@/context/DataContext";
import type { Fornecedor, ParceiroServico } from "@/lib/supabase/queries";

type MovimentacaoTipo = "todas" | "entrada" | "saida";

interface CaixaRelatorioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (payload: CaixaReportPayload) => void;
  defaultDataInicio: string;
  defaultDataFim: string;
  loading?: boolean;
  contas: CaixaConta[];
  clientes: Cliente[];
  parceiros: ParceiroServico[];
  drivers: Driver[];
  fornecedores: Fornecedor[];
}

const placeholderOption = (label: string) => ({
  id: "",
  nome: label,
});

const selectOptions = (list: ReadonlyArray<{ value: string; label: string }>) =>
  list.map((item) => ({ id: item.value, nome: item.label }));

export function CaixaRelatorioModal({
  isOpen,
  onClose,
  onGenerate,
  defaultDataInicio,
  defaultDataFim,
  loading = false,
  contas,
  clientes,
  parceiros,
  drivers,
  fornecedores,
}: CaixaRelatorioModalProps): ReactElement | null {
  const [movimentacaoTipo, setMovimentacaoTipo] =
    useState<MovimentacaoTipo>("todas");
  const [format, setFormat] = useState<CaixaReportFormat>("pdf");
  const [dataInicio, setDataInicio] = useState(defaultDataInicio);
  const [dataFim, setDataFim] = useState(defaultDataFim);
  const [contaId, setContaId] = useState("");
  const [categoria, setCategoria] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [parceiroId, setParceiroId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [areFiltersExpanded, setAreFiltersExpanded] = useState(false);

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

  const dateRangeInvalid = Boolean(
    dataInicio && dataFim && dataInicio > dataFim,
  );

  const contaOptions = [
    placeholderOption("Todas as contas"),
    ...contas.map((c) => ({ id: c.id, nome: c.nome })),
  ];
  const categoriaOptions = [
    placeholderOption("Todas as categorias"),
    ...selectOptions(CATEGORIAS_ENTRADA),
    ...selectOptions(CATEGORIAS_SAIDA),
  ].filter(
    (opt, index, arr) =>
      index === 0 || arr.findIndex((o) => o.id === opt.id) === index,
  );
  const clienteOptions = [
    placeholderOption("Todos os clientes"),
    ...clientes.map((c) => ({ id: c.id, nome: c.nome })),
  ];
  const parceiroOptions = [
    placeholderOption("Todos os parceiros"),
    ...parceiros.map((p) => ({
      id: p.id,
      nome: p.razaoSocialOuNomeCompleto,
    })),
  ];
  const driverOptions = [
    placeholderOption("Todos os motoristas"),
    ...drivers.map((d) => ({ id: d.id, nome: d.name })),
  ];
  const fornecedorOptions = [
    placeholderOption("Todos os fornecedores"),
    ...fornecedores.map((f) => ({ id: f.id, nome: f.nome })),
  ];

  const canGenerate = Boolean(dataInicio && dataFim && !dateRangeInvalid);

  const handleClose = (): void => {
    onClose();
    setMovimentacaoTipo("todas");
    setFormat("pdf");
    setDataInicio(defaultDataInicio);
    setDataFim(defaultDataFim);
    setContaId("");
    setCategoria("");
    setClienteId("");
    setParceiroId("");
    setDriverId("");
    setFornecedorId("");
    setAreFiltersExpanded(false);
  };

  const handleGenerate = (): void => {
    if (!dataInicio || !dataFim || dateRangeInvalid) return;

    const payload: CaixaReportPayload = {
      template: "movimentacoes",
      format,
      dataInicio,
      dataFim,
    };

    if (movimentacaoTipo !== "todas") {
      payload.tipo = movimentacaoTipo;
    }

    if (contaId) payload.contaId = contaId;
    if (categoria) payload.categoria = categoria;
    if (clienteId) payload.clienteId = clienteId;
    if (parceiroId) payload.parceiroId = parceiroId;
    if (driverId) payload.driverId = driverId;
    if (fornecedorId) payload.fornecedorId = fornecedorId;

    onGenerate(payload);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-[#001C3A]/60 backdrop-blur-md"
        onClick={loading ? undefined : handleClose}
      />

      <div
        className={`relative w-full max-w-4xl max-h-[92vh] rounded-[2.5rem] bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col ${
          loading ? "pointer-events-none" : ""
        }`}
        style={{ textRendering: "geometricPrecision" }}
      >
        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-3 bg-blue-50/70 border-b border-blue-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm">
              <Download size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Exportar Relatório de Caixa
              </h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Escolha o template e os filtros abaixo
              </p>
            </div>
          </div>
          {!loading && (
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-8 pb-8 space-y-8">
          {/* Tipo de relatório */}
          {/* Tipo de movimentação + Período */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-8 animate-in fade-in slide-in-from-top-4 duration-500 items-end">
            <div className="flex items-end">
              <div className="flex items-center gap-1 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-sm w-fit">
                {(
                  [
                    {
                      id: "todas",
                      label: "Todas",
                      active: "bg-slate-800 text-white shadow-md",
                    },
                    {
                      id: "entrada",
                      label: "Entradas",
                      active: "bg-emerald-600 text-white shadow-md",
                    },
                    {
                      id: "saida",
                      label: "Saídas",
                      active: "bg-rose-600 text-white shadow-md",
                    },
                  ] as {
                    id: MovimentacaoTipo;
                    label: string;
                    active: string;
                  }[]
                ).map((opt) => {
                  const active = movimentacaoTipo === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMovimentacaoTipo(opt.id)}
                      aria-pressed={active}
                      className={`px-4 py-3 rounded-xl text-base font-black tracking-tight cursor-pointer transition-all ${
                        active
                          ? opt.active
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <GeologDateInput
                    label="De"
                    value={dataInicio}
                    onChange={setDataInicio}
                    labelClassName="text-emerald-600 font-bold"
                    inputClassName="!border-slate-300"
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
                    inputClassName="!border-slate-300"
                  />
                </div>
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

          {/* Filtros adicionais */}
          <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="p-5 rounded-3xl border bg-slate-50/50 border-slate-100 transition-colors hover:bg-blue-50/70 hover:border-blue-100">
              <button
                type="button"
                onClick={() => setAreFiltersExpanded((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 text-left group cursor-pointer"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 ml-1 transition-colors group-hover:text-slate-600">
                  Filtros adicionais (opcional)
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 transition-all cursor-pointer group-hover:border-blue-200 group-hover:bg-blue-100 group-hover:text-blue-500">
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-300 ${
                      areFiltersExpanded ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {areFiltersExpanded && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <GeologSearchableSelect
                    label="Conta"
                    options={contaOptions}
                    value={contaId}
                    onChange={setContaId}
                    placeholder="Todas as contas"
                    compact
                    triggerClassName="h-12"
                    dropdownPosition="up"
                    hideTriggerAvatar
                    disableSearch
                    disabled
                  />
                  <GeologSearchableSelect
                    label="Categoria"
                    options={categoriaOptions}
                    value={categoria}
                    onChange={setCategoria}
                    placeholder="Todas as categorias"
                    compact
                    triggerClassName="h-12"
                    dropdownPosition="up"
                    hideTriggerAvatar
                    disabled
                  />
                  <GeologSearchableSelect
                    label="Cliente"
                    options={clienteOptions}
                    value={clienteId}
                    onChange={setClienteId}
                    placeholder="Todos os clientes"
                    compact
                    triggerClassName="h-12"
                    dropdownPosition="up"
                    hideTriggerAvatar
                    disabled
                  />
                  <GeologSearchableSelect
                    label="Parceiro"
                    options={parceiroOptions}
                    value={parceiroId}
                    onChange={setParceiroId}
                    placeholder="Todos os parceiros"
                    compact
                    triggerClassName="h-12"
                    dropdownPosition="up"
                    hideTriggerAvatar
                    disabled
                  />
                  <GeologSearchableSelect
                    label="Motorista"
                    options={driverOptions}
                    value={driverId}
                    onChange={setDriverId}
                    placeholder="Todos os motoristas"
                    compact
                    triggerClassName="h-12"
                    dropdownPosition="up"
                    hideTriggerAvatar
                    disabled
                  />
                  <GeologSearchableSelect
                    label="Fornecedor"
                    options={fornecedorOptions}
                    value={fornecedorId}
                    onChange={setFornecedorId}
                    placeholder="Todos os fornecedores"
                    compact
                    triggerClassName="h-12"
                    dropdownPosition="up"
                    hideTriggerAvatar
                    disabled
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-blue-50/70 border-t border-blue-100 flex items-center justify-between gap-4 shrink-0">
          {/* Format toggles */}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setFormat("pdf")}
              aria-pressed={format === "pdf"}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-black transition-all cursor-pointer ${
                format === "pdf"
                  ? "border-blue-400 bg-blue-50 text-blue-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              <FileText size={16} />
              PDF
            </button>
            <button
              type="button"
              onClick={() => setFormat("xlsx")}
              aria-pressed={format === "xlsx"}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-black transition-all cursor-pointer ${
                format === "xlsx"
                  ? "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              <FileSpreadsheet size={16} />
              Excel
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="rounded-xl px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
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

        {/* Loading overlay (cidade/van) */}
        {loading && <CaixaReportLoadingOverlay />}
      </div>
    </div>
  );
}
