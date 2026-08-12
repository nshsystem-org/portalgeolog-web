import {
  ArrowDownCircle,
  ArrowUpCircle,
  Eye,
  FileText,
  MoreVertical,
  Pencil,
  Paperclip,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import type { MutableRefObject, ReactElement } from "react";
import { ActionMenuPortal } from "@/components/ui/ActionMenuPortal";
import { DataTable, type Column } from "@/components/ui/DataTable";
import type { CaixaLancamento } from "../_lib/caixa-page";
import {
  formatCurrency,
  formatDate,
  labelCategoria,
  labelFormaPagamento,
  labelOrigem,
  labelTipoConta,
  type CaixaConta,
} from "../_lib/caixa-page";

type CaixaTablePagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

type CaixaTableProps = {
  items: CaixaLancamento[];
  loading: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  pagination: CaixaTablePagination;
  contaMap: Map<string, CaixaConta>;
  customerMap: Map<string, string>;
  driverMap: Map<string, string>;
  partnerMap: Map<string, string>;
  openActionMenuId: string | null;
  actionMenuRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  onToggleActionMenu: (id: string) => void;
  onEditar: (lancamento: CaixaLancamento) => void;
  onExcluir: (lancamento: CaixaLancamento) => void;
  onOpenComprovante: (lancamento: CaixaLancamento) => void;
  isLancamentoEditavel: (origem: string | null | undefined) => boolean;
};

export function CaixaTable({
  items,
  loading,
  searchTerm,
  onSearchChange,
  pagination,
  contaMap,
  customerMap,
  driverMap,
  partnerMap,
  openActionMenuId,
  actionMenuRefs,
  onToggleActionMenu,
  onEditar,
  onExcluir,
  onOpenComprovante,
  isLancamentoEditavel,
}: CaixaTableProps): ReactElement {
  const columns: Column<CaixaLancamento>[] = [
    {
      key: "data",
      title: "Data",
      render: (_value, item) => (
        <span className="font-bold text-slate-700 tabular-nums">
          {formatDate(item.data)}
        </span>
      ),
    },
    {
      key: "descricao",
      title: "Descrição / Categoria",
      render: (_value, item) => {
        const entidadeNome =
          (item.clienteId && customerMap.get(item.clienteId)) ||
          (item.parceiroId && partnerMap.get(item.parceiroId)) ||
          (item.driverId && driverMap.get(item.driverId)) ||
          null;
        return (
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-800 text-base">
              {item.descricao || labelCategoria(item.categoria)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                {labelCategoria(item.categoria)}
              </span>
              {entidadeNome ? (
                <span className="inline-flex items-center gap-1 truncate">
                  <User size={12} className="text-slate-400" />
                  {entidadeNome}
                </span>
              ) : null}
              {item.osProtocolo ? (
                <Link
                  href={`/portal/os?open_os_protocolo=${item.osProtocolo}`}
                  className="inline-flex items-center gap-1 truncate text-blue-600 transition-colors hover:text-blue-800 hover:underline"
                  title={`Abrir OS ${item.osProtocolo}`}
                >
                  <FileText size={12} />
                  {item.osProtocolo}
                </Link>
              ) : null}
              {item.origem !== "manual" ? (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-bold text-blue-700">
                  {labelOrigem(item.origem)}
                </span>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      key: "conta_id",
      title: "Conta",
      render: (_value, item) => {
        const conta = contaMap.get(item.contaId);
        return (
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-slate-400" />
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-700">
                {conta?.nome ?? item.contaNome ?? "-"}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {labelTipoConta(item.contaTipo ?? conta?.tipo)}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "forma_pagamento",
      title: "Forma",
      render: (_value, item) => (
        <span className="text-sm font-bold text-slate-600">
          {labelFormaPagamento(item.formaPagamento)}
        </span>
      ),
    },
    {
      key: "valor",
      title: "Valor",
      align: "right",
      render: (_value, item) => {
        const isEntrada = item.tipo === "entrada";
        const Icon = isEntrada ? ArrowUpCircle : ArrowDownCircle;
        const colorClass = isEntrada
          ? "text-teal-700"
          : "text-rose-600";
        const sign = isEntrada ? "+" : "-";
        return (
          <div
            className={`flex items-center justify-end gap-1.5 font-black tabular-nums ${colorClass}`}
          >
            <Icon size={16} />
            {sign}
            {formatCurrency(item.valor)}
          </div>
        );
      },
    },
    {
      key: "anexo",
      title: "Anexo",
      align: "center",
      render: (_value, item) =>
        item.anexoPath ? (
          <button
            type="button"
            onClick={() => onOpenComprovante(item)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-blue-500 transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
            title="Ver comprovante"
          >
            <Paperclip size={16} />
          </button>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
    {
      key: "acoes",
      title: "",
      align: "right",
      render: (_value, item) => {
        const editavel = isLancamentoEditavel(item.origem);
        const isOpen = openActionMenuId === item.id;
        return (
          <div
            ref={(el) => {
              actionMenuRefs.current[item.id] = el;
            }}
            className="relative inline-block"
          >
            <button
              type="button"
              onClick={() => onToggleActionMenu(item.id)}
              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              title="Ações"
            >
              {isOpen ? <X size={16} /> : <MoreVertical size={16} />}
            </button>
            {isOpen ? (
              <ActionMenuPortal
                isOpen={isOpen}
                getTriggerEl={() => actionMenuRefs.current[item.id] ?? null}
                align="right"
                width={176}
                panelClassName="overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-2xl"
              >
                <button
                  type="button"
                  onClick={() => onOpenComprovante(item)}
                  disabled={!item.anexoPath}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Eye size={15} /> Ver comprovante
                </button>
                <button
                  type="button"
                  onClick={() => onEditar(item)}
                  disabled={!editavel}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Pencil size={15} /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => onExcluir(item)}
                  disabled={!editavel}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 size={15} /> Excluir
                </button>
              </ActionMenuPortal>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/40">
      <DataTable<CaixaLancamento>
        data={items}
        columns={columns}
        loading={loading}
        disableClientSearch
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        searchPlaceholder="Buscar por descrição ou categoria..."
        pagination={pagination}
        emptyMessage="Nenhum lançamento encontrado para o período selecionado."
        emptyIcon={<Wallet size={48} className="text-slate-200" />}
      />
    </div>
  );
}
