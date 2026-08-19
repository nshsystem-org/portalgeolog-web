"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  FileText,
  Paperclip,
  RotateCcw,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactElement } from "react";
import StandardModal from "@/components/StandardModal";
import GeologDateInput from "@/components/ui/GeologDateInput";
import GeologMoneyInput from "@/components/ui/GeologMoneyInput";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import RequiredAsterisk from "@/components/ui/RequiredAsterisk";
import type { Cliente, Driver } from "@/context/DataContext";
import type {
  ParceiroServico,
  Fornecedor,
  CaixaCategoria,
  CaixaFormaPagamento as CaixaFormaPagamentoDB,
} from "@/lib/supabase/queries";
import {
  insertCaixaCategoria,
  insertCaixaFormaPagamento,
} from "@/lib/supabase/queries";
import {
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
  fornecedores: Fornecedor[];
  categoriasDB: CaixaCategoria[];
  formasDB: CaixaFormaPagamentoDB[];
  saving: boolean;
  onClose: () => void;
  onSalvar: (
    payload: Omit<CaixaLancamentoPayload, "contaId" | "tipo"> & {
      contaId: string;
      tipo: "entrada" | "saida";
    },
  ) => Promise<void>;
  onRefreshCategorias: () => void;
  onRefreshFormas: () => void;
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
      fornecedorId: lancamentoEmEdicao.fornecedorId || "",
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
    fornecedorId: "",
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
  fornecedores,
  categoriasDB,
  formasDB,
  saving,
  onClose,
  onSalvar,
  onRefreshCategorias,
  onRefreshFormas,
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
  const [fornecedorId, setFornecedorId] = useState(initial.fornecedorId);
  const [file, setFile] = useState<File | null>(null);

  // Quick-add modal state
  const [quickAddOpen, setQuickAddOpen] = useState<
    "categoria" | "forma" | null
  >(null);
  const [quickAddNome, setQuickAddNome] = useState("");
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  const handleQuickAddCategoria = async () => {
    if (!quickAddNome.trim()) return;
    setQuickAddSaving(true);
    try {
      await insertCaixaCategoria(quickAddNome.trim(), tipo);
      onRefreshCategorias();
      setQuickAddOpen(null);
      setQuickAddNome("");
    } catch (err) {
      console.error("Erro ao criar categoria:", err);
    } finally {
      setQuickAddSaving(false);
    }
  };

  const handleQuickAddForma = async () => {
    if (!quickAddNome.trim()) return;
    setQuickAddSaving(true);
    try {
      await insertCaixaFormaPagamento(quickAddNome.trim());
      onRefreshFormas();
      setQuickAddOpen(null);
      setQuickAddNome("");
    } catch (err) {
      console.error("Erro ao criar forma de pagamento:", err);
    } finally {
      setQuickAddSaving(false);
    }
  };

  const handleTipoChange = (next: "entrada" | "saida"): void => {
    setTipo(next);
    // Reseta categoria se a atual não pertence à lista do novo tipo
    const lista = categoriasDB.filter(
      (c) => c.tipo === next || c.tipo === "ambos",
    );
    if (!lista.some((c) => c.slug === categoria)) {
      setCategoria(lista[0]?.slug ?? "");
    }
  };

  const categoriaOptions = categoriasDB
    .filter((c) => c.tipo === tipo || c.tipo === "ambos")
    .map((c) => ({ id: c.slug, nome: c.nome }));
  const formaOptions = formasDB.map((f) => ({
    id: f.slug,
    nome: f.nome,
  }));
  const clienteOptions = clientes.map((c) => ({ id: c.id, nome: c.nome }));
  const parceiroOptions = parceiros.map((p) => ({
    id: p.id,
    nome: p.razaoSocialOuNomeCompleto,
  }));
  // Motoristas vinculados ao parceiro selecionado. Se nenhum parceiro
  // estiver selecionado, exibe todos os motoristas.
  // Inclui avatar (photoUrl) e badge de vínculo (typeLabel) com as mesmas
  // cores usadas pelo GeologSearchableSelect (Autônomo=orange, Interno=blue,
  // Parceiro=cyan), igual ao padrão da página OS.
  // Nomes longos são truncados para manter o dropdown compacto.
  const truncateName = (name: string, max = 27): string =>
    name.length > max ? `${name.slice(0, max)}…` : name;
  const driverOptions = (
    parceiroId ? drivers.filter((d) => d.parceiro_id === parceiroId) : drivers
  ).map((d) => ({
    id: d.id,
    nome: truncateName(d.name),
    photoUrl: d.avatar_url,
    typeLabel:
      d.vinculo_tipo === "interno"
        ? "Interno"
        : d.vinculo_tipo === "parceiro"
          ? "Parceiro"
          : d.vinculo_tipo === "autonomo"
            ? "Autônomo"
            : undefined,
  }));
  const fornecedorOptions = fornecedores.map((f) => ({
    id: f.id,
    nome: f.nome,
  }));

  // Selecionar motorista: se ele estiver vinculado a um parceiro, preenche
  // o select de parceiro automaticamente.
  const handleDriverChange = (nextDriverId: string): void => {
    setDriverId(nextDriverId);
    const driver = drivers.find((d) => d.id === nextDriverId);
    if (driver?.parceiro_id) {
      setParceiroId(driver.parceiro_id);
    }
  };

  // Selecionar parceiro: limpa o motorista selecionado e restringe a lista
  // apenas aos motoristas vinculados ao parceiro.
  const handleParceiroChange = (nextParceiroId: string): void => {
    setParceiroId(nextParceiroId);
    setDriverId("");
  };

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
      fornecedorId: fornecedorId || undefined,
      file: file ?? null,
    });
  };

  const isEntrada = tipo === "entrada";
  // Header: gradiente pastel claro → escuro (sem azul), com escuro menos
  // intenso (700) para entrada e saída.
  const headerGradient = isEntrada
    ? "bg-gradient-to-r from-emerald-100 via-emerald-300 to-emerald-700 border-b border-emerald-300/50"
    : "bg-gradient-to-r from-rose-100 via-rose-300 to-rose-700 border-b border-rose-300/50";
  const headerGlow = isEntrada ? "bg-emerald-200/50" : "bg-rose-200/50";
  const titleColor = isEntrada ? "text-emerald-950" : "text-rose-950";
  const subtitleColor = isEntrada ? "text-emerald-800/80" : "text-rose-800/80";
  const iconColor = isEntrada ? "text-emerald-800" : "text-rose-800";
  const iconBorder = isEntrada
    ? "bg-white/40 border-emerald-400/40"
    : "bg-white/40 border-rose-400/40";
  const closeButton = isEntrada
    ? "text-emerald-800/70 hover:text-emerald-950 hover:bg-emerald-950/10"
    : "text-rose-800/70 hover:text-rose-950 hover:bg-rose-950/10";

  // Tokens de destaque (accent) reativos ao tipo — mantêm o corpo do modal
  // visualmente coerente com o header e o botão Salvar ao alternar.
  const accentText = isEntrada ? "text-emerald-600" : "text-rose-600";
  const accentIconWrap = isEntrada
    ? "bg-emerald-50 border-emerald-100 text-emerald-600"
    : "bg-rose-50 border-rose-100 text-rose-600";
  const accentFocus = isEntrada
    ? "focus:!border-emerald-500 hover:border-emerald-300 focus:ring-emerald-500/10"
    : "focus:!border-rose-500 hover:border-rose-300 focus:ring-rose-500/10";
  const card1Border = isEntrada
    ? "border-emerald-200/70"
    : "border-rose-200/70";
  const cardSoftBorder = isEntrada
    ? "border-emerald-200/50"
    : "border-rose-200/50";
  const cardSoftBg = isEntrada ? "bg-emerald-50/30" : "bg-rose-50/30";
  const footerBorder = isEntrada
    ? "border-emerald-200/70"
    : "border-rose-200/70";
  const footerBg = isEntrada ? "bg-emerald-50/40" : "bg-rose-50/40";

  return (
    <StandardModal
      title={lancamentoEmEdicao ? "Editar Lançamento" : "Novo Lançamento"}
      subtitle="Registre uma entrada ou saída no caixa"
      icon={
        isEntrada ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />
      }
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
      bodyClassName="space-y-5 p-6 md:p-8"
      headerClassName={headerGradient}
      headerGlowClassName={headerGlow}
      titleClassName={`${titleColor} font-black`}
      subtitleClassName={`${subtitleColor} font-bold tracking-widest`}
      iconContainerClassName={`${iconBorder} shadow-inner`}
      iconClassName={iconColor}
      closeButtonClassName={closeButton}
      footer={
        <div
          className={`flex items-center justify-between gap-4 border-t ${footerBorder} ${footerBg} px-6 py-4 md:px-8 shrink-0 transition-colors`}
        >
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
      <div
        className={`bg-white border ${card1Border} rounded-2xl p-6 space-y-5 shadow-sm transition-colors`}
      >
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-700">
          <div
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors ${accentIconWrap}`}
          >
            <DollarSign size={16} />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Valores e Identificação
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_0.9fr_1.5fr] gap-5">
          {/* Valor — mesmo estilo do campo Conta (OS) */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-800 uppercase tracking-tight ml-1 flex items-center gap-1">
              Valor <RequiredAsterisk />
            </label>
            <GeologMoneyInput
              value={valor}
              onChange={setValor}
              compact
              className="text-[18px]"
              placeholder="0,00"
              inputClassName={`h-[58px] w-full py-3 pl-12 pr-12 text-[18px] font-bold ${accentText} rounded-xl border-2 border-slate-200 hover:bg-white transition-colors ${accentFocus} focus:ring-4`}
              rightIcon={<DollarSign size={20} className={accentText} />}
            />
          </div>

          {/* Data — mesmo estilo do campo Conta (OS) */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-800 uppercase tracking-tight ml-1 flex items-center gap-1">
              Data <RequiredAsterisk />
            </label>
            <GeologDateInput
              label="Data"
              value={data}
              onChange={setData}
              compact
              placeholder="DD/MM/AAAA"
              inputClassName={`h-[58px] w-full px-5 py-3 pr-12 text-[18px] font-bold text-slate-900 rounded-xl border-2 border-slate-200 hover:bg-white transition-colors ${accentFocus} focus:ring-4`}
              className="w-full"
            />
          </div>

          {/* Conta — mesmo estilo do "Conta Recebimento" da página OS */}
          <GeologSearchableSelect
            label="Conta"
            required
            options={contasAtivas.map((c) => ({
              id: c.id,
              nome: c.nome,
              sublabel:
                c.banco?.nome ??
                (c.tipo === "caixa"
                  ? "Caixa"
                  : c.tipo === "banco"
                    ? "Banco"
                    : c.tipo === "pix"
                      ? "Pix"
                      : "Carteira"),
              isFavorite: c.isDefault,
              icon: c.banco ? (
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-black uppercase"
                  style={{ backgroundColor: c.banco.cor }}
                >
                  {c.banco.sigla}
                </span>
              ) : undefined,
            }))}
            value={contaId}
            onChange={setContaId}
            placeholder="Selecione a conta"
            disableSearch
            hideTriggerAvatar
            variant="form"
            triggerClassName="h-[58px] py-3 text-[18px]"
            className="w-full min-w-0"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Categoria */}
          <GeologSearchableSelect
            label="Categoria"
            required
            options={categoriaOptions}
            value={categoria}
            onChange={setCategoria}
            placeholder="Selecione a categoria"
            hideTriggerAvatar
            hideDropdownPhotos
            variant="form"
            triggerClassName="h-[58px] py-3 text-[18px]"
            onQuickAdd={() => {
              setQuickAddNome("");
              setQuickAddOpen("categoria");
            }}
          />
          {/* Forma de Pagamento */}
          <GeologSearchableSelect
            label="Forma de Pagamento"
            required
            options={formaOptions}
            value={formaPagamento}
            onChange={(v) => setFormaPagamento(v as CaixaFormaPagamento)}
            placeholder="Selecione a forma"
            disableSearch
            hideTriggerAvatar
            hideDropdownPhotos
            variant="form"
            triggerClassName="h-[58px] py-3 text-[18px]"
            onQuickAdd={() => {
              setQuickAddNome("");
              setQuickAddOpen("forma");
            }}
          />
        </div>
      </div>

      {/* Card 2: Detalhamento e Vínculos */}
      <div
        className={`${cardSoftBg} border ${cardSoftBorder} rounded-2xl p-5 shadow-sm transition-colors`}
      >
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 text-slate-700">
          <FileText size={16} className="text-slate-400" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Detalhamento e Vínculos
          </span>
        </div>

        {/* Descrição */}
        <div className="mt-4 space-y-1.5">
          <label className="text-sm font-bold text-slate-800 uppercase tracking-tight ml-1">
            Descrição
          </label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição ou observações opcionais..."
            rows={2}
            className={`w-full resize-none rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[18px] font-bold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-4 ${accentFocus}`}
          />
        </div>

        {/* Vínculos */}
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
            <Users size={16} className="text-slate-400" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Vínculos com Entidades (opcional)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GeologSearchableSelect
              label="Cliente"
              options={clienteOptions}
              value={clienteId}
              onChange={setClienteId}
              placeholder="Nenhum"
              variant="form"
              triggerClassName="h-[58px] py-3 text-[18px]"
            />
            <GeologSearchableSelect
              label="Fornecedor"
              options={fornecedorOptions}
              value={fornecedorId}
              onChange={setFornecedorId}
              placeholder="Nenhum"
              variant="form"
              hideTriggerAvatar
              hideDropdownPhotos
              triggerClassName="h-[58px] py-3 text-[18px]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GeologSearchableSelect
              label="Parceiro"
              options={parceiroOptions}
              value={parceiroId}
              onChange={handleParceiroChange}
              placeholder="Nenhum"
              variant="form"
              hideTriggerAvatar
              hideDropdownPhotos
              triggerClassName="h-[58px] py-3 text-[18px]"
            />
            <GeologSearchableSelect
              label="Motorista"
              options={driverOptions}
              value={driverId}
              onChange={handleDriverChange}
              placeholder={
                parceiroId && driverOptions.length === 0
                  ? "Sem motoristas vinculados"
                  : "Nenhum"
              }
              variant="form"
              triggerClassName="h-[58px] py-3 text-[16px]"
            />
          </div>
        </div>
      </div>

      {/* Card 3: Comprovante */}
      <div
        className={`${cardSoftBg} border ${cardSoftBorder} rounded-2xl p-5 space-y-3 shadow-sm transition-colors`}
      >
        <div className="flex items-center gap-2 pb-1 text-slate-700">
          <Paperclip size={16} className="text-slate-400" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Comprovante / Anexo (opcional)
          </span>
        </div>

        <label
          className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-3 transition-all group ${
            isEntrada
              ? "hover:border-emerald-400 hover:bg-emerald-50/20"
              : "hover:border-rose-400 hover:bg-rose-50/20"
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
                isEntrada
                  ? "bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600"
                  : "bg-slate-100 text-slate-500 group-hover:bg-rose-100 group-hover:text-rose-600"
              }`}
            >
              <Upload size={18} />
            </div>
            <div className="min-w-0">
              <p
                className={`truncate text-sm font-bold text-slate-700 transition-colors ${
                  isEntrada
                    ? "group-hover:text-emerald-700"
                    : "group-hover:text-rose-700"
                }`}
              >
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
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isEntrada ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            Comprovante atual já anexado. Selecione um novo arquivo para
            substituir.
          </p>
        ) : null}
      </div>

      {/* Quick-add modal */}
      {quickAddOpen && (
        <div
          className="fixed inset-0 z-[10001] bg-black/40 flex items-center justify-center p-4"
          onClick={() => !quickAddSaving && setQuickAddOpen(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">
                {quickAddOpen === "categoria"
                  ? "Nova Categoria"
                  : "Nova Forma de Pagamento"}
              </h3>
              <button
                type="button"
                onClick={() => !quickAddSaving && setQuickAddOpen(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-500">
              {quickAddOpen === "categoria"
                ? `Cadastre uma nova categoria de ${tipo === "entrada" ? "entrada" : "saída"}.`
                : "Cadastre uma nova forma de pagamento."}
            </p>
            <input
              autoFocus
              type="text"
              value={quickAddNome}
              onChange={(e) => setQuickAddNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !quickAddSaving) {
                  e.preventDefault();
                  if (quickAddOpen === "categoria") {
                    void handleQuickAddCategoria();
                  } else {
                    void handleQuickAddForma();
                  }
                }
              }}
              placeholder={
                quickAddOpen === "categoria"
                  ? "Ex: Marketing, Software..."
                  : "Ex: Depósito, Cheque..."
              }
              className="w-full h-14 px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => !quickAddSaving && setQuickAddOpen(null)}
                className="px-6 py-3 text-slate-600 font-bold hover:text-slate-900 transition-colors text-sm uppercase tracking-widest cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={quickAddSaving || !quickAddNome.trim()}
                onClick={() => {
                  if (quickAddOpen === "categoria") {
                    void handleQuickAddCategoria();
                  } else {
                    void handleQuickAddForma();
                  }
                }}
                className="px-6 py-3 bg-[rgb(42,82,144)] text-white font-black rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {quickAddSaving ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
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
  fornecedores,
  categoriasDB,
  formasDB,
  saving,
  onClose,
  onSalvar,
  onRefreshCategorias,
  onRefreshFormas,
}: CaixaLancamentoModalProps): ReactElement | null {
  if (!isOpen) return null;
  const formKey = lancamentoEmEdicao?.id ?? "novo";
  return (
    <CaixaLancamentoForm
      key={formKey}
      lancamentoEmEdicao={lancamentoEmEdicao}
      contas={contas}
      clientes={clientes}
      parceiros={parceiros}
      drivers={drivers}
      fornecedores={fornecedores}
      categoriasDB={categoriasDB}
      formasDB={formasDB}
      saving={saving}
      onClose={onClose}
      onSalvar={onSalvar}
      onRefreshCategorias={onRefreshCategorias}
      onRefreshFormas={onRefreshFormas}
    />
  );
}
