"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  FileText,
  Paperclip,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactElement } from "react";
import StandardModal from "@/components/StandardModal";
import GeologDateInput from "@/components/ui/GeologDateInput";
import GeologMoneyInput from "@/components/ui/GeologMoneyInput";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import RequiredAsterisk from "@/components/ui/RequiredAsterisk";
import type { Cliente, Driver } from "@/context/DataContext";
import type { ParceiroServico } from "@/lib/supabase/queries";
import {
  CATEGORIAS_ENTRADA,
  CATEGORIAS_SAIDA,
  FORMAS_PAGAMENTO,
  formatCurrency,
  getBrazilDate,
  normalizeToInputDate,
  type CaixaConta,
  type CaixaFormaPagamento,
  type CaixaLancamento,
} from "../_lib/caixa-page";
import type { CaixaLancamentoPayload } from "../_services/caixa.service";

type CaixaLancamentoModalProps = {
  isOpen: boolean;
  lancamentoEmEdicao: CaixaLancamento | null;
  contas: CaixaConta[];
  clientes: Cliente[];
  parceiros: ParceiroServico[];
  drivers: Driver[];
  saving: boolean;
  onClose: () => void;
  onSalvar: (
    payload: Omit<CaixaLancamentoPayload, "contaId" | "tipo"> & {
      contaId: string;
      tipo: "entrada" | "saida";
    },
  ) => Promise<void>;
};

// Estado inicial derivado de lancamentoEmEdicao (lazy init via useState)
const buildInitialState = (
  lancamentoEmEdicao: CaixaLancamento | null,
  defaultContaId: string,
) => {
  if (lancamentoEmEdicao) {
    return {
      tipo: lancamentoEmEdicao.tipo as "entrada" | "saida",
      contaId: lancamentoEmEdicao.contaId,
      valor: lancamentoEmEdicao.valor,
      data: lancamentoEmEdicao.data,
      descricao: lancamentoEmEdicao.descricao,
      categoria: lancamentoEmEdicao.categoria,
      formaPagamento: lancamentoEmEdicao.formaPagamento,
      clienteId: lancamentoEmEdicao.clienteId || "",
      parceiroId: lancamentoEmEdicao.parceiroId || "",
      driverId: lancamentoEmEdicao.driverId || "",
    };
  }
  return {
    tipo: "entrada" as const,
    contaId: defaultContaId,
    valor: 0,
    data: normalizeToInputDate(getBrazilDate()),
    descricao: "",
    categoria: "recebimento_cliente",
    formaPagamento: "pix" as CaixaFormaPagamento,
    clienteId: "",
    parceiroId: "",
    driverId: "",
  };
};

// Componente interno do formulário — remonta quando o modal abre ou quando
// muda o lancamentoEmEdicao (via key), evitando setState-in-effect.
function CaixaLancamentoForm({
  lancamentoEmEdicao,
  contas,
  clientes,
  parceiros,
  drivers,
  saving,
  onClose,
  onSalvar,
}: Omit<CaixaLancamentoModalProps, "isOpen">): ReactElement {
  const contasAtivas = useMemo(() => contas.filter((c) => c.ativa), [contas]);
  const initial = useMemo(
    () => buildInitialState(lancamentoEmEdicao, contasAtivas[0]?.id ?? ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [tipo, setTipo] = useState<"entrada" | "saida">(initial.tipo);
  const [contaId, setContaId] = useState(initial.contaId);
  const [valor, setValor] = useState<number>(initial.valor);
  const [data, setData] = useState(initial.data);
  const [descricao, setDescricao] = useState(initial.descricao);
  const [categoria, setCategoria] = useState(initial.categoria);
  const [formaPagamento, setFormaPagamento] = useState<CaixaFormaPagamento>(
    initial.formaPagamento,
  );
  const [clienteId, setClienteId] = useState(initial.clienteId);
  const [parceiroId, setParceiroId] = useState(initial.parceiroId);
  const [driverId, setDriverId] = useState(initial.driverId);
  const [file, setFile] = useState<File | null>(null);

  const handleTipoChange = (next: "entrada" | "saida"): void => {
    setTipo(next);
    // Reseta categoria se a atual não pertence à lista do novo tipo
    const lista = next === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
    if (!lista.some((c) => c.value === categoria)) {
      setCategoria(next === "entrada" ? "recebimento_cliente" : "repasse_motorista");
    }
  };

  const contaOptions = contasAtivas.map((c) => ({ id: c.id, nome: c.nome }));
  const categoriaOptions =
    tipo === "entrada"
      ? CATEGORIAS_ENTRADA.map((c) => ({ id: c.value, nome: c.label }))
      : CATEGORIAS_SAIDA.map((c) => ({ id: c.value, nome: c.label }));
  const formaOptions = FORMAS_PAGAMENTO.map((f) => ({
    id: f.value,
    nome: f.label,
  }));
  const clienteOptions = clientes.map((c) => ({ id: c.id, nome: c.nome }));
  const parceiroOptions = parceiros.map((p) => ({
    id: p.id,
    nome: p.razaoSocialOuNomeCompleto,
  }));
  const driverOptions = drivers.map((d) => ({ id: d.id, nome: d.name }));

  const valorValido = valor > 0;
  const podeSalvar =
    contaId && valorValido && data && formaPagamento && !saving;

  const handleSubmit = async (): Promise<void> => {
    if (!podeSalvar) return;
    await onSalvar({
      contaId,
      tipo,
      valor,
      data,
      descricao: descricao.trim(),
      categoria,
      formaPagamento,
      clienteId: clienteId || undefined,
      parceiroId: parceiroId || undefined,
      driverId: driverId || undefined,
      file: file ?? null,
    });
  };

  const isEntrada = tipo === "entrada";
  const headerGradient = isEntrada
    ? "bg-gradient-to-r from-[#001C3A] via-[#002B49] to-emerald-950 border-b border-emerald-500/20"
    : "bg-gradient-to-r from-[#001C3A] via-[#002B49] to-rose-950 border-b border-rose-500/20";
  const headerGlow = isEntrada ? "bg-emerald-500/20" : "bg-rose-500/20";
  const subtitleColor = isEntrada ? "text-emerald-300/90" : "text-rose-300/90";
  const iconColor = isEntrada ? "text-emerald-300" : "text-rose-300";
  const iconBorder = isEntrada
    ? "bg-emerald-500/20 border-emerald-400/30"
    : "bg-rose-500/20 border-rose-400/30";

  return (
    <StandardModal
      title={lancamentoEmEdicao ? "Editar Lançamento" : "Novo Lançamento"}
      subtitle="Registre uma entrada ou saída no caixa"
      icon={isEntrada ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
      onClose={onClose}
      maxWidthClassName="max-w-4xl"
      bodyClassName="space-y-5 p-6 md:p-8"
      headerClassName={headerGradient}
      headerGlowClassName={headerGlow}
      titleClassName="text-white font-black"
      subtitleClassName={`${subtitleColor} font-bold tracking-widest`}
      iconContainerClassName={`${iconBorder} shadow-inner`}
      iconClassName={iconColor}
      closeButtonClassName="text-white/60 hover:text-white hover:bg-white/10"
      footer={
        <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-6 py-4 md:px-8 shrink-0">
          {/* Toggle Entrada / Saída (padrão página OS) */}
          <div className="flex items-center gap-1 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
            {(
              [
                { value: "entrada", label: "Entrada" },
                { value: "saida", label: "Saída" },
              ] as const
            ).map((opt) => {
              const active = tipo === opt.value;
              const activeClasses =
                opt.value === "entrada"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "bg-rose-600 text-white shadow-md";
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleTipoChange(opt.value)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer transition-all ${
                    active
                      ? activeClasses
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Ações */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-6 py-3.5 text-slate-600 font-bold hover:text-slate-900 transition-colors text-sm uppercase tracking-widest cursor-pointer disabled:opacity-70"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!podeSalvar}
              className={`inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-black text-white shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
                isEntrada
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20"
                  : "bg-rose-600 hover:bg-rose-700 shadow-rose-900/20"
              }`}
            >
              {saving ? (
                <RotateCcw size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              {lancamentoEmEdicao ? "Salvar" : "Registrar"}
            </button>
          </div>
        </div>
      }
    >
      {/* Card 1: Dados Financeiros Principais */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-700">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <DollarSign size={16} />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Valores e Identificação
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Valor */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1">Valor <RequiredAsterisk /></span>
              {valor > 0 && (
                <span className="text-xs font-bold text-emerald-600 normal-case tracking-normal">
                  {formatCurrency(valor)}
                </span>
              )}
            </label>
            <GeologMoneyInput
              value={valor}
              onChange={setValor}
              compact
              placeholder="0,00"
              inputClassName="h-12 !bg-white border-slate-200 font-black text-base rounded-2xl"
            />
          </div>

          {/* Data */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
              Data <RequiredAsterisk />
            </label>
            <GeologDateInput
              label="Data"
              value={data}
              onChange={setData}
              compact
              placeholder="DD/MM/AAAA"
              inputClassName="h-12 !bg-white border-slate-200 rounded-2xl"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Conta */}
          <GeologSearchableSelect
            label="Conta"
            required
            options={contaOptions}
            value={contaId}
            onChange={setContaId}
            placeholder="Selecione a conta"
            compact
            disableSearch
            hideTriggerAvatar
            triggerClassName="h-12 !bg-white border-slate-200 rounded-xl"
          />
          {/* Categoria */}
          <GeologSearchableSelect
            label="Categoria"
            required
            options={categoriaOptions}
            value={categoria}
            onChange={setCategoria}
            placeholder="Selecione a categoria"
            compact
            disableSearch
            hideTriggerAvatar
            triggerClassName="h-12 !bg-white border-slate-200 rounded-xl"
          />
          {/* Forma de Pagamento */}
          <GeologSearchableSelect
            label="Forma de Pagamento"
            required
            options={formaOptions}
            value={formaPagamento}
            onChange={(v) => setFormaPagamento(v as CaixaFormaPagamento)}
            placeholder="Selecione a forma"
            compact
            disableSearch
            hideTriggerAvatar
            triggerClassName="h-12 !bg-white border-slate-200 rounded-xl"
          />
        </div>
      </div>

      {/* Card 2: Detalhamento e Vínculos */}
      <div className="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 text-slate-700">
          <FileText size={16} className="text-slate-400" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Detalhamento e Vínculos
          </span>
        </div>

        {/* Descrição */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
            Descrição
          </label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição ou observações opcionais..."
            rows={2}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-xs outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
          />
        </div>

        {/* Vínculos */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 block">
            Vínculos com Entidades (opcional)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <GeologSearchableSelect
              label="Cliente"
              options={clienteOptions}
              value={clienteId}
              onChange={setClienteId}
              placeholder="Nenhum"
              compact
              triggerClassName="h-11 bg-white border-slate-200 rounded-xl"
            />
            <GeologSearchableSelect
              label="Parceiro"
              options={parceiroOptions}
              value={parceiroId}
              onChange={setParceiroId}
              placeholder="Nenhum"
              compact
              triggerClassName="h-11 bg-white border-slate-200 rounded-xl"
            />
            <GeologSearchableSelect
              label="Motorista"
              options={driverOptions}
              value={driverId}
              onChange={setDriverId}
              placeholder="Nenhum"
              compact
              triggerClassName="h-11 bg-white border-slate-200 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Card 3: Comprovante */}
      <div className="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 pb-1 text-slate-700">
          <Paperclip size={16} className="text-slate-400" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Comprovante / Anexo (opcional)
          </span>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-3 transition-all hover:border-blue-400 hover:bg-blue-50/20 group">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors flex-shrink-0">
              <Upload size={18} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors">
                {file ? file.name : "Clique para selecionar um comprovante"}
              </p>
              <p className="text-xs text-slate-400">
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB`
                  : "PDF, PNG, JPG ou WEBP (máx. 20MB)"}
              </p>
            </div>
          </div>
          {file ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setFile(null);
              }}
              className="flex-shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <X size={18} />
            </button>
          ) : null}
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              e.target.value = "";
            }}
          />
        </label>
        {lancamentoEmEdicao?.anexoPath && !file ? (
          <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5 pt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            Comprovante atual já anexado. Selecione um novo arquivo para substituir.
          </p>
        ) : null}
      </div>
    </StandardModal>
  );
}

export function CaixaLancamentoModal({
  isOpen,
  lancamentoEmEdicao,
  contas,
  clientes,
  parceiros,
  drivers,
  saving,
  onClose,
  onSalvar,
}: CaixaLancamentoModalProps): ReactElement | null {
  if (!isOpen) return null;
  // key muda quando o alvo muda (novo vs edição de diferentes lancamentos),
  // forçando o React a remontar o formulário com estado inicial fresco —
  // sem precisar de setState-in-effect.
  const formKey = lancamentoEmEdicao?.id ?? "novo";
  return (
    <CaixaLancamentoForm
      key={formKey}
      lancamentoEmEdicao={lancamentoEmEdicao}
      contas={contas}
      clientes={clientes}
      parceiros={parceiros}
      drivers={drivers}
      saving={saving}
      onClose={onClose}
      onSalvar={onSalvar}
    />
  );
}
