import { Filter } from "lucide-react";
import type { ReactElement } from "react";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import type { Cliente, Driver } from "@/context/DataContext";
import type { ParceiroServico } from "@/lib/supabase/queries";

type FinanceiroFiltersProps = {
  isVisible: boolean;
  clienteId: string;
  centroCustoId: string;
  parceiroId: string;
  driverId: string;
  statusOperacional: string;
  statusFinanceiro: string;
  noShowFilter: string;
  horaExtraFilter: string;
  clientes: Cliente[];
  parceiros: ParceiroServico[];
  drivers: Driver[];
  onClienteChange: (value: string) => void;
  onCentroCustoChange: (value: string) => void;
  onParceiroChange: (value: string) => void;
  onDriverChange: (value: string) => void;
  onStatusOperacionalChange: (value: string) => void;
  onStatusFinanceiroChange: (value: string) => void;
  onNoShowFilterChange: (value: string) => void;
  onHoraExtraFilterChange: (value: string) => void;
  onReset: () => void;
};

export function FinanceiroFilters({
  isVisible,
  clienteId,
  centroCustoId,
  parceiroId,
  driverId,
  statusOperacional,
  statusFinanceiro,
  noShowFilter,
  horaExtraFilter,
  clientes,
  parceiros,
  drivers,
  onClienteChange,
  onCentroCustoChange,
  onParceiroChange,
  onDriverChange,
  onStatusOperacionalChange,
  onStatusFinanceiroChange,
  onNoShowFilterChange,
  onHoraExtraFilterChange,
  onReset,
}: FinanceiroFiltersProps): ReactElement | null {
  if (!isVisible) return null;

  const centroCustoOptions = (
    clienteId
      ? clientes.find((cliente) => cliente.id === clienteId)?.centrosCusto || []
      : clientes.flatMap((cliente) => cliente.centrosCusto)
  ).map((centro) => ({ id: centro.id, nome: centro.nome }));

  return (
    <section className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">
            Filtros Avançados
          </h2>
          <p className="text-sm font-medium text-slate-500">
            Refine os dados por cliente, centro de custo, parceiro ou status.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-black text-slate-700 transition-all hover:bg-slate-100 active:scale-95 cursor-pointer"
        >
          <Filter size={16} />
          Limpar Filtros
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12">
        <GeologSearchableSelect
          label="Empresa / Cliente"
          options={[
            { id: "", nome: "Todos os Clientes" },
            ...clientes.map((cliente) => ({
              id: cliente.id,
              nome: cliente.nome,
            })),
          ]}
          value={clienteId}
          onChange={onClienteChange}
          disableSearch={false}
          compact
          triggerClassName="!px-4 !py-2 text-sm w-full !rounded-2xl !border"
          className="xl:col-span-4"
        />
        <GeologSearchableSelect
          label="Centro de Custo"
          options={[
            { id: "", nome: "Todos os Centros" },
            ...centroCustoOptions,
          ]}
          value={centroCustoId}
          onChange={onCentroCustoChange}
          disabled={!clienteId}
          disableSearch={false}
          compact
          triggerClassName="!px-4 !py-2 text-sm w-full !rounded-2xl !border"
          className="xl:col-span-4"
        />
        <GeologSearchableSelect
          label="Parceiro Estratégico"
          options={[
            { id: "", nome: "Todos os Parceiros" },
            ...parceiros.map((parceiro) => ({
              id: parceiro.id,
              nome: parceiro.razaoSocialOuNomeCompleto,
            })),
          ]}
          value={parceiroId}
          onChange={onParceiroChange}
          disableSearch={false}
          compact
          triggerClassName="!px-4 !py-2 text-sm w-full !rounded-2xl !border"
          className="xl:col-span-4"
        />
        <GeologSearchableSelect
          label="Motorista"
          options={[
            { id: "", nome: "Todos os Motoristas" },
            ...drivers.map((driver) => ({
              id: driver.id,
              nome: driver.name,
              photoUrl: driver.avatar_url,
              sublabel: driver.vinculo_tipo,
            })),
          ]}
          value={driverId}
          onChange={onDriverChange}
          onClear={() => onDriverChange("")}
          disableSearch={false}
          compact
          triggerClassName="!px-4 !py-2 text-sm w-full !rounded-2xl !border !min-w-[340px]"
          className="xl:col-span-9"
        />
        <GeologSearchableSelect
          label="Status Operacional"
          options={[
            { id: "", nome: "Todos os Estados" },
            { id: "Finalizado", nome: "Concluídas" },
            { id: "Pendente", nome: "Pendentes" },
            { id: "Em Rota", nome: "Em Rota" },
            { id: "Cancelado", nome: "Canceladas" },
          ]}
          value={statusOperacional}
          onChange={onStatusOperacionalChange}
          disableSearch={false}
          compact
          triggerClassName="!px-4 !py-2 text-sm w-full !rounded-2xl !border"
          className="xl:col-span-4"
        />
        <GeologSearchableSelect
          label="Situação Financeira"
          options={[
            { id: "", nome: "Todas as Situações" },
            { id: "Pendente", nome: "Liberado" },
            { id: "Faturado", nome: "Faturado (A Receber)" },
            { id: "Recebido", nome: "Recebido" },
            { id: "Pago", nome: "Pago (Legado)" },
          ]}
          value={statusFinanceiro}
          onChange={onStatusFinanceiroChange}
          disableSearch={false}
          compact
          triggerClassName="!px-4 !py-2 text-sm w-full !rounded-2xl !border"
          className="xl:col-span-4"
        />
        <GeologSearchableSelect
          label="No-Show"
          options={[
            { id: "", nome: "Todos" },
            { id: "yes", nome: "Apenas No-Show" },
            { id: "no", nome: "Sem No-Show" },
          ]}
          value={noShowFilter}
          onChange={onNoShowFilterChange}
          disableSearch={false}
          compact
          triggerClassName="!px-4 !py-2 text-sm w-full !rounded-2xl !border"
          className="xl:col-span-4"
        />
        <GeologSearchableSelect
          label="Hora Extra"
          options={[
            { id: "", nome: "Todos" },
            { id: "yes", nome: "Com Hora Extra" },
            { id: "no", nome: "Sem Hora Extra" },
          ]}
          value={horaExtraFilter}
          onChange={onHoraExtraFilterChange}
          disableSearch={false}
          compact
          triggerClassName="!px-4 !py-2 text-sm w-full !rounded-2xl !border"
          className="xl:col-span-6"
        />
      </div>
    </section>
  );
}
