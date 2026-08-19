"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import StandardModal from "@/components/StandardModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import RequiredAsterisk from "@/components/ui/RequiredAsterisk";
import { useConfirm } from "@/hooks/useConfirm";
import {
  Wrench,
  Plus,
  Loader2,
  Eye,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  Car,
} from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { hasPageAccess } from "@/lib/permissions";
import { AccessDenied } from "@/components/ui/AccessDenied";
import {
  fetchVehicleMaintenances,
  fetchVeiculosSimpleList,
  insertVehicleMaintenance,
  updateVehicleMaintenance,
  deleteVehicleMaintenance,
  type VehicleMaintenance,
  type VeiculoSimple,
  type MaintenanceTipo,
  type MaintenanceStatus,
  type NovaManutencaoInput,
} from "@/lib/supabase/queries";

const TIPO_LABELS: Record<MaintenanceTipo, string> = {
  preventiva: "Preventiva",
  corretiva: "Corretiva",
  revisao: "Revisão",
  troca_oleo: "Troca de Óleo",
  pneus: "Pneus",
  outro: "Outro",
};

const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  aberta: "Aberta",
  em_andamento: "Em Andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const getStatusColor = (status: MaintenanceStatus) => {
  switch (status) {
    case "aberta":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "em_andamento":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "concluida":
      return "bg-green-100 text-green-700 border-green-200";
    case "cancelada":
      return "bg-slate-100 text-slate-500 border-slate-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

const getStatusIcon = (status: MaintenanceStatus) => {
  switch (status) {
    case "aberta":
      return <AlertTriangle size={14} />;
    case "em_andamento":
      return <Clock size={14} />;
    case "concluida":
      return <CheckCircle2 size={14} />;
    case "cancelada":
      return <Ban size={14} />;
    default:
      return null;
  }
};

const emptyForm: NovaManutencaoInput = {
  veiculoId: "",
  tipo: "preventiva",
  descricao: "",
  status: "aberta",
  dataAbertura: new Date().toISOString().slice(0, 10),
  dataConclusao: null,
  kmRegistrado: null,
  custo: 0,
  oficina: "",
  responsavel: "",
  observacoes: "",
  proximaRevisaoKm: null,
  proximaRevisaoData: null,
};

export default function ManutencaoVeiculosPage() {
  const { profile } = useAuth();
  const [maintenances, setMaintenances] = useState<VehicleMaintenance[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoSimple[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | "todos">(
    "todos",
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selected, setSelected] = useState<VehicleMaintenance | null>(null);
  const [formData, setFormData] = useState<NovaManutencaoInput>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { confirm, confirmState, closeConfirm, handleConfirm } = useConfirm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [maintenancesData, veiculosData] = await Promise.all([
        fetchVehicleMaintenances(),
        fetchVeiculosSimpleList(),
      ]);
      setMaintenances(maintenancesData);
      setVeiculos(veiculosData);
    } catch (error) {
      console.error("Erro ao carregar manutenções:", error);
      toast.error("Erro ao carregar dados de manutenção.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredMaintenances = useMemo(() => {
    if (statusFilter === "todos") return maintenances;
    return maintenances.filter((m) => m.status === statusFilter);
  }, [maintenances, statusFilter]);

  if (!hasPageAccess(profile, "manutencao-veiculos")) {
    return <AccessDenied module="Operacional" />;
  }

  const resetForm = () => setFormData(emptyForm);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.veiculoId) {
      toast.error("Selecione um veículo.");
      return;
    }
    setIsSubmitting(true);
    try {
      await insertVehicleMaintenance(formData);
      setIsModalOpen(false);
      resetForm();
      await loadData();
      toast.success("Manutenção registrada com sucesso!");
    } catch (error) {
      console.error("Erro ao registrar manutenção:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao registrar manutenção.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setIsSubmitting(true);
    try {
      const payload: Partial<NovaManutencaoInput> = { ...formData };
      if (
        formData.status === "concluida" &&
        selected.status !== "concluida" &&
        !formData.dataConclusao
      ) {
        payload.dataConclusao = new Date().toISOString().slice(0, 10);
      }
      await updateVehicleMaintenance(selected.id, payload);
      setIsEditModalOpen(false);
      setSelected(null);
      resetForm();
      await loadData();
      toast.success("Manutenção atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar manutenção:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao atualizar manutenção.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (item: VehicleMaintenance) => {
    setSelected(item);
    setFormData({
      veiculoId: item.veiculoId,
      tipo: item.tipo,
      descricao: item.descricao || "",
      status: item.status,
      dataAbertura: item.dataAbertura,
      dataConclusao: item.dataConclusao,
      kmRegistrado: item.kmRegistrado,
      custo: item.custo,
      oficina: item.oficina || "",
      responsavel: item.responsavel || "",
      observacoes: item.observacoes || "",
      proximaRevisaoKm: item.proximaRevisaoKm,
      proximaRevisaoData: item.proximaRevisaoData,
    });
    setIsEditModalOpen(true);
  };

  const openView = (item: VehicleMaintenance) => {
    setSelected(item);
    setIsViewModalOpen(true);
  };

  const handleDelete = async (item: VehicleMaintenance) => {
    const confirmed = await confirm({
      title: "Excluir Manutenção",
      message: `Tem certeza que deseja excluir este registro de manutenção do veículo "${item.veiculo?.modelo ?? ""}" (${item.veiculo?.placa ?? ""})?`,
      confirmText: "Sim, excluir",
      cancelText: "Cancelar",
      type: "danger",
    });
    if (confirmed) {
      try {
        await deleteVehicleMaintenance(item.id);
        await loadData();
        toast.success("Manutenção excluída com sucesso.");
      } catch (error) {
        console.error("Erro ao excluir manutenção:", error);
        toast.error("Erro ao excluir manutenção.");
      }
    }
  };

  const veiculoOptions = veiculos.map((v) => ({
    id: v.id,
    nome: `${v.modelo} - ${v.marca}`,
    plate: v.placa,
  }));

  const statusFilterOptions: Array<{
    value: MaintenanceStatus | "todos";
    label: string;
  }> = [
    { value: "todos", label: "Todos" },
    { value: "aberta", label: "Abertas" },
    { value: "em_andamento", label: "Em Andamento" },
    { value: "concluida", label: "Concluídas" },
    { value: "cancelada", label: "Canceladas" },
  ];

  const renderFormFields = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <GeologSearchableSelect
            label="Veículo"
            required
            options={veiculoOptions}
            value={formData.veiculoId}
            onChange={(id) => setFormData({ ...formData, veiculoId: id })}
            placeholder="Selecione o veículo"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
            Tipo <RequiredAsterisk />
          </label>
          <select
            required
            value={formData.tipo}
            onChange={(e) =>
              setFormData({
                ...formData,
                tipo: e.target.value as MaintenanceTipo,
              })
            }
            className="w-full px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm h-[60px]"
          >
            {Object.entries(TIPO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
            Data de Abertura
          </label>
          <input
            type="date"
            value={formData.dataAbertura || ""}
            onChange={(e) =>
              setFormData({ ...formData, dataAbertura: e.target.value })
            }
            className="w-full px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm h-[60px]"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
            KM Registrado
          </label>
          <input
            type="number"
            min={0}
            value={formData.kmRegistrado ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                kmRegistrado: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="w-full px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm h-[60px]"
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
            Custo (R$)
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={formData.custo ?? 0}
            onChange={(e) =>
              setFormData({ ...formData, custo: Number(e.target.value) })
            }
            className="w-full px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm h-[60px]"
            placeholder="0,00"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
            Oficina
          </label>
          <input
            value={formData.oficina || ""}
            onChange={(e) =>
              setFormData({ ...formData, oficina: e.target.value })
            }
            className="w-full px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm h-[60px]"
            placeholder="Nome da oficina"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
            Responsável
          </label>
          <input
            value={formData.responsavel || ""}
            onChange={(e) =>
              setFormData({ ...formData, responsavel: e.target.value })
            }
            className="w-full px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm h-[60px]"
            placeholder="Nome do responsável"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
          Descrição
        </label>
        <textarea
          value={formData.descricao || ""}
          onChange={(e) =>
            setFormData({ ...formData, descricao: e.target.value })
          }
          rows={3}
          className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-semibold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
          placeholder="Descreva o serviço realizado ou a necessidade"
        />
      </div>

      <div
        className="flex items-center border-b-2 border-slate-100 pb-4"
        style={{ paddingBottom: "1.25rem" }}
      >
        <h3 className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3">
          <AlertTriangle size={20} className="text-slate-500" /> Alerta de
          Próxima Revisão
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
            Próxima Revisão (KM)
          </label>
          <input
            type="number"
            min={0}
            value={formData.proximaRevisaoKm ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                proximaRevisaoKm: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
            className="w-full px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm h-[60px]"
            placeholder="Ex: 50000"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
            Próxima Revisão (Data)
          </label>
          <input
            type="date"
            value={formData.proximaRevisaoData || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                proximaRevisaoData: e.target.value || null,
              })
            }
            className="w-full px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm h-[60px]"
          />
        </div>
      </div>

      {isEditModalOpen && (
        <div className="space-y-2">
          <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) =>
              setFormData({
                ...formData,
                status: e.target.value as MaintenanceStatus,
              })
            }
            className="w-full px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm h-[60px]"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Manutenção de Veículos" icon={<Wrench size={20} />} />

      <div className="flex flex-wrap gap-2">
        {statusFilterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
              statusFilter === opt.value
                ? "bg-[var(--color-geolog-blue)] text-white shadow-md"
                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <DataTable
        data={filteredMaintenances}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        actionButton={
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-[var(--color-geolog-blue)] text-white px-5 py-3.5 rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer shadow-lg shadow-blue-900/20 whitespace-nowrap"
          >
            <Plus size={18} />
            Nova Manutenção
          </button>
        }
        columns={[
          {
            key: "veiculo",
            title: "Veículo",
            render: (_value, item: VehicleMaintenance) => (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black">
                  <Car size={18} />
                </div>
                <div className="space-y-1">
                  <p className="font-black text-base text-slate-800 tracking-tight">
                    {item.veiculo?.modelo ?? "—"}
                  </p>
                  <p className="text-sm font-semibold text-slate-400">
                    {item.veiculo?.placa ?? "—"}
                  </p>
                </div>
              </div>
            ),
          },
          {
            key: "tipo",
            title: "Tipo",
            render: (_value, item: VehicleMaintenance) => (
              <span className="text-sm font-bold text-slate-700">
                {TIPO_LABELS[item.tipo]}
              </span>
            ),
          },
          {
            key: "data_abertura",
            title: "Abertura",
            render: (_value, item: VehicleMaintenance) => (
              <span className="text-sm font-semibold text-slate-600">
                {new Date(item.dataAbertura + "T00:00:00").toLocaleDateString(
                  "pt-BR",
                )}
              </span>
            ),
          },
          {
            key: "custo",
            title: "Custo",
            align: "center" as const,
            render: (_value, item: VehicleMaintenance) => (
              <span className="text-sm font-bold text-slate-700">
                {item.custo.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            ),
          },
          {
            key: "status",
            title: "Status",
            align: "center",
            render: (_value, item: VehicleMaintenance) => (
              <span
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs md:text-sm font-bold uppercase tracking-wide border ${getStatusColor(item.status)}`}
              >
                {getStatusIcon(item.status)}
                {STATUS_LABELS[item.status]}
              </span>
            ),
          },
          {
            key: "acoes",
            title: "Ações",
            align: "center" as const,
            render: (_value, item: VehicleMaintenance) => (
              <div className="flex items-center gap-2 justify-center">
                <button
                  onClick={() => openView(item)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="Visualizar"
                >
                  <Eye size={18} />
                </button>
                <button
                  onClick={() => openEdit(item)}
                  className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
                  title="Editar"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Excluir"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ),
          },
        ]}
        searchPlaceholder="Buscar por veículo, placa ou oficina..."
        emptyMessage="Nenhuma manutenção registrada."
        emptyIcon={<Wrench size={48} />}
      />

      {isModalOpen && (
        <StandardModal
          onClose={() => {
            setIsModalOpen(false);
            resetForm();
          }}
          title="Nova Manutenção"
          subtitle="Registro de manutenção da frota Geolog"
          icon={<Wrench size={24} />}
          maxWidthClassName="max-w-4xl"
          footer={
            <div className="p-8 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-5 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-4 text-slate-600 font-bold hover:text-slate-900 transition-colors text-sm uppercase tracking-widest cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="nova-manutencao-form"
                disabled={isSubmitting}
                className="px-12 py-4 bg-[rgb(42,82,144)] text-white font-black rounded-xl shadow-xl shadow-[rgb(42,82,144)]/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  "Registrar Manutenção"
                )}
              </button>
            </div>
          }
        >
          <form id="nova-manutencao-form" onSubmit={handleAdd}>
            {renderFormFields()}
          </form>
        </StandardModal>
      )}

      {isEditModalOpen && selected && (
        <StandardModal
          onClose={() => {
            setIsEditModalOpen(false);
            setSelected(null);
            resetForm();
          }}
          title="Editar Manutenção"
          subtitle={`${selected.veiculo?.modelo ?? ""} - ${selected.veiculo?.placa ?? ""}`}
          icon={<Edit size={24} />}
          maxWidthClassName="max-w-4xl"
          footer={
            <div className="p-8 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelected(null);
                }}
                className="px-6 py-4 text-slate-600 font-bold hover:text-slate-900 transition-colors text-sm uppercase tracking-widest cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="editar-manutencao-form"
                disabled={isSubmitting}
                className="px-12 py-4 bg-[rgb(42,82,144)] text-white font-black rounded-xl shadow-xl shadow-[rgb(42,82,144)]/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  "Salvar Alterações"
                )}
              </button>
            </div>
          }
        >
          <form id="editar-manutencao-form" onSubmit={handleEditSubmit}>
            {renderFormFields()}
          </form>
        </StandardModal>
      )}

      {isViewModalOpen && selected && (
        <StandardModal
          onClose={() => {
            setIsViewModalOpen(false);
            setSelected(null);
          }}
          title="Detalhes da Manutenção"
          subtitle={`${selected.veiculo?.modelo ?? ""} - ${selected.veiculo?.placa ?? ""}`}
          icon={<Eye size={24} />}
          maxWidthClassName="max-w-2xl"
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Tipo
                </p>
                <p className="font-bold text-slate-800">
                  {TIPO_LABELS[selected.tipo]}
                </p>
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Status
                </p>
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${getStatusColor(selected.status)}`}
                >
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Abertura
                </p>
                <p className="font-bold text-slate-800">
                  {new Date(
                    selected.dataAbertura + "T00:00:00",
                  ).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Conclusão
                </p>
                <p className="font-bold text-slate-800">
                  {selected.dataConclusao
                    ? new Date(
                        selected.dataConclusao + "T00:00:00",
                      ).toLocaleDateString("pt-BR")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  KM Registrado
                </p>
                <p className="font-bold text-slate-800">
                  {selected.kmRegistrado ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Custo
                </p>
                <p className="font-bold text-slate-800">
                  {selected.custo.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Oficina
                </p>
                <p className="font-bold text-slate-800">
                  {selected.oficina || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Responsável
                </p>
                <p className="font-bold text-slate-800">
                  {selected.responsavel || "—"}
                </p>
              </div>
            </div>
            {selected.descricao && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Descrição
                </p>
                <p className="font-semibold text-slate-700">
                  {selected.descricao}
                </p>
              </div>
            )}
            {(selected.proximaRevisaoKm || selected.proximaRevisaoData) && (
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                  Próxima Revisão
                </p>
                <div className="flex gap-4">
                  {selected.proximaRevisaoKm && (
                    <p className="font-bold text-slate-800">
                      {selected.proximaRevisaoKm} km
                    </p>
                  )}
                  {selected.proximaRevisaoData && (
                    <p className="font-bold text-slate-800">
                      {new Date(
                        selected.proximaRevisaoData + "T00:00:00",
                      ).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </StandardModal>
      )}

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
      />
    </div>
  );
}
