import { Filter, RotateCcw } from "lucide-react";
import type { ReactElement } from "react";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import type { Cliente, Driver } from "@/context/DataContext";
import type { ParceiroServico } from "@/lib/supabase/queries";
import {
  CATEGORIAS_ENTRADA,
  CATEGORIAS_SAIDA,
  FORMAS_PAGAMENTO,
  TIPOS_CONTA,
} from "../_lib/caixa-page";
import type { CaixaConta } from "../_lib/caixa-page";

type CaixaFiltersProps = {
  isVisible: boolean;
  contaId: string;
  tipo: string;
  categoria: string;
  formaPagamento: string;
  clienteId: string;
  parceiroId: string;
  driverId: string;
  origem: string;
  contas: CaixaConta[];
  clientes: Cliente[];
  parceiros: ParceiroServico[];
  drivers: Driver[];
  onContaChange: (value: string) => void;
  onTipoChange: (value: string) => void;
  onCategoriaChange: (value: string) => void;
  onFormaPagamentoChange: (value: string) => void;
  onClienteChange: (value: string) => void;
  onParceiroChange: (value: string) => void;
  onDriverChange: (value: string) => void;
  onOrigemChange: (value: string) => void;
  onReset: () => void;
};

const selectOptions = (list: ReadonlyArray<{ value: string; label: string }>) =>
  list.map((item) => ({ id: item.value, nome: item.label }));

const placeholderOption = (label: string) => ({
  id: "",
  nome: label,
});

export function CaixaFilters({
  isVisible,
  contaId,
  tipo,
  categoria,
  formaPagamento,
  clienteId,
  parceiroId,
  driverId,
  origem,
  contas,
  clientes,
  parceiros,
  drivers,
  onContaChange,
  onTipoChange,
  onCategoriaChange,
  onFormaPagamentoChange,
  onClienteChange,
  onParceiroChange,
  onDriverChange,
  onOrigemChange,
  onReset,
}: CaixaFiltersProps): ReactElement | null {
  if (!isVisible) return null;

  const contaOptions = [
    placeholderOption("Todas as contas"),
    ...contas.map((c) => ({
      id: c.id,
      nome: `${c.nome} (${TIPOS_CONTA.find((t) => t.value === c.tipo)?.label ?? c.tipo})`,
    })),
  ];

  const tipoOptions = [
    placeholderOption("Entradas e saídas"),
    { id: "entrada", nome: "Apenas entradas" },
    { id: "saida", nome: "Apenas saídas" },
  ];

  const categoriaOptions = [
    placeholderOption("Todas as categorias"),
    ...selectOptions(CATEGORIAS_ENTRADA),
    ...selectOptions(CATEGORIAS_SAIDA),
  ];

  const formaOptions = [
    placeholderOption("Todas as formas"),
    ...selectOptions(FORMAS_PAGAMENTO),
  ];

  const origemOptions = [
    placeholderOption("Todas as origens"),
    { id: "manual", nome: "Manual" },
    { id: "os_recebimento", nome: "Recebimento de OS" },
    { id: "os_repasse", nome: "Repasse de OS" },
  ];

  const clienteOptions = [
    placeholderOption("Todos os clientes"),
    ...clientes.map((c) => ({ id: c.id, nome: c.nome })),
  ];
  const parceiroOptions = [
    placeholderOption("Todos os parceiros"),
    ...parceiros.map((p) => ({ id: p.id, nome: p.razaoSocialOuNomeCompleto })),
  ];
  const driverOptions = [
    placeholderOption("Todos os motoristas"),
    ...drivers.map((d) => ({ id: d.id, nome: d.name })),
  ];

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-blue-600" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
            Filtros
          </h3>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 transition-all hover:bg-slate-50 active:scale-95 cursor-pointer"
        >
          <RotateCcw size={14} />
          Limpar
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GeologSearchableSelect
          label="Conta"
          options={contaOptions}
          value={contaId}
          onChange={onContaChange}
          placeholder="Todas as contas"
          compact
          disableSearch
        />
        <GeologSearchableSelect
          label="Tipo"
          options={tipoOptions}
          value={tipo}
          onChange={onTipoChange}
          placeholder="Entradas e saídas"
          compact
          disableSearch
        />
        <GeologSearchableSelect
          label="Categoria"
          options={categoriaOptions}
          value={categoria}
          onChange={onCategoriaChange}
          placeholder="Todas as categorias"
          compact
        />
        <GeologSearchableSelect
          label="Forma de Pagamento"
          options={formaOptions}
          value={formaPagamento}
          onChange={onFormaPagamentoChange}
          placeholder="Todas as formas"
          compact
          disableSearch
        />
        <GeologSearchableSelect
          label="Cliente"
          options={clienteOptions}
          value={clienteId}
          onChange={onClienteChange}
          placeholder="Todos os clientes"
          compact
        />
        <GeologSearchableSelect
          label="Parceiro"
          options={parceiroOptions}
          value={parceiroId}
          onChange={onParceiroChange}
          placeholder="Todos os parceiros"
          compact
        />
        <GeologSearchableSelect
          label="Motorista"
          options={driverOptions}
          value={driverId}
          onChange={onDriverChange}
          placeholder="Todos os motoristas"
          compact
        />
        <GeologSearchableSelect
          label="Origem"
          options={origemOptions}
          value={origem}
          onChange={onOrigemChange}
          placeholder="Todas as origens"
          compact
          disableSearch
        />
      </div>
    </section>
  );
}
