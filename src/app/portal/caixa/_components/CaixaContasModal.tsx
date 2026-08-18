"use client";

import {
  CheckCircle2,
  CircleSlash,
  Plus,
  RotateCcw,
  Star,
  Wallet,
} from "lucide-react";
import { useState, type ReactElement } from "react";
import { BankLogo } from "@/components/ui/BankLogo";
import StandardModal from "@/components/StandardModal";
import {
  TIPOS_CONTA,
  formatCurrency,
  type CaixaConta,
} from "../_lib/caixa-page";
import type { CaixaContaPayload } from "../_services/caixa.service";

type CaixaContasModalProps = {
  isOpen: boolean;
  contas: CaixaConta[];
  saving: boolean;
  onClose: () => void;
  onSalvar: (payload: CaixaContaPayload) => Promise<void>;
  onToggleAtiva: (conta: CaixaConta) => Promise<void>;
  onSetDefault: (conta: CaixaConta) => Promise<void>;
};

export function CaixaContasModal({
  isOpen,
  contas,
  saving,
  onClose,
  onSalvar,
  onToggleAtiva,
  onSetDefault,
}: CaixaContasModalProps): ReactElement | null {
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<CaixaConta["tipo"]>("caixa");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  if (!isOpen) return null;

  const resetForm = (): void => {
    setNome("");
    setTipo("caixa");
    setSaldoInicial("");
    setIsDefault(false);
  };

  const handleSalvar = async (): Promise<void> => {
    if (!nome.trim()) return;
    await onSalvar({
      nome: nome.trim(),
      tipo,
      saldoInicial: Number(saldoInicial.replace(",", ".") || 0),
      ativa: true,
      isDefault,
    });
    resetForm();
    setShowForm(false);
  };

  return (
    <StandardModal
      title="Gerenciar Contas"
      subtitle="Caixas, bancos e carteiras do sistema"
      icon={<Wallet size={22} />}
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      bodyClassName="space-y-6 p-6 md:p-8"
      headerClassName="bg-gradient-to-r from-blue-100 via-blue-200 to-indigo-200"
      headerGlowClassName="bg-blue-400/30"
      titleClassName="text-blue-900"
      subtitleClassName="text-blue-700"
      iconContainerClassName="border border-blue-300 bg-white/50"
      iconClassName="text-blue-700"
      closeButtonClassName="text-blue-700/60 hover:bg-white/50"
      footer={
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 md:px-8">
          <button
            type="button"
            onClick={() => {
              setShowForm((prev) => !prev);
              if (showForm) resetForm();
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-black text-blue-700 transition-all hover:bg-blue-100 active:scale-95 cursor-pointer"
          >
            {showForm ? (
              <>
                <CircleSlash size={16} />
                Cancelar
              </>
            ) : (
              <>
                <Plus size={16} />
                Nova Conta
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition-all hover:bg-slate-50 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      }
    >
      {/* Lista de contas */}
      <div className="space-y-3">
        {contas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-10 text-center">
            <Wallet size={32} className="mx-auto text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-500">
              Nenhuma conta cadastrada.
            </p>
            <p className="text-xs text-slate-400">
              Clique em &ldquo;Nova Conta&rdquo; para criar a primeira.
            </p>
          </div>
        ) : (
          contas.map((conta) => (
            <div
              key={conta.id}
              className={`flex items-center justify-between gap-3 rounded-2xl border px-5 py-4 transition-all ${
                conta.ativa
                  ? "border-slate-200 bg-white"
                  : "border-slate-200 bg-slate-50/40 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <BankLogo name={conta.nome} type={conta.tipo} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-black text-slate-800">
                      {conta.nome}
                    </p>
                    {conta.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-blue-700">
                        <Star size={10} /> Padrão
                      </span>
                    ) : null}
                    {!conta.ativa ? (
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Inativa
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                    {TIPOS_CONTA.find((t) => t.value === conta.tipo)?.label ??
                      conta.tipo}
                    {" · Saldo inicial "}
                    {formatCurrency(conta.saldoInicial)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!conta.isDefault && conta.ativa ? (
                  <button
                    type="button"
                    onClick={() => onSetDefault(conta)}
                    title="Definir como padrão"
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                  >
                    <Star size={16} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onToggleAtiva(conta)}
                  title={conta.ativa ? "Desativar" : "Ativar"}
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  {conta.ativa ? (
                    <CircleSlash size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Formulário nova conta */}
      {showForm ? (
        <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
          <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">
            Nova Conta
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-slate-500">
                Nome
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Caixa Geral, Banco Itaú, etc"
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-900 shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-slate-500">
                Tipo
              </label>
              <div className="flex flex-wrap gap-2">
                {TIPOS_CONTA.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTipo(t.value)}
                    className={`rounded-2xl border px-4 py-2.5 text-sm font-black transition-all cursor-pointer ${
                      tipo === t.value
                        ? "border-blue-400 bg-blue-100 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-slate-500">
                Saldo Inicial
              </label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-400">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={saldoInicial}
                  onChange={(e) => setSaldoInicial(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-5 font-black tabular-nums text-slate-900 shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-3 self-end rounded-2xl border border-slate-200 bg-white px-5 py-3">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-5 w-5 cursor-pointer rounded border-slate-300 text-blue-600"
              />
              <span className="text-sm font-bold text-slate-700">
                Definir como conta padrão
              </span>
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSalvar}
              disabled={!nome.trim() || saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-300/40 transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <RotateCcw size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              Criar Conta
            </button>
          </div>
        </div>
      ) : null}
    </StandardModal>
  );
}
