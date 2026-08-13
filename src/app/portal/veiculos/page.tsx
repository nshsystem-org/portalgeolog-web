"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import StandardModal from "@/components/StandardModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import RequiredAsterisk from "@/components/ui/RequiredAsterisk";
import { useConfirm } from "@/hooks/useConfirm";
import {
  Truck,
  Plus,
  Loader2,
  Car,
  Palette,
  Eye,
  Edit,
  Trash2,
  Bus,
} from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import { toast } from "sonner";
import { useData, type Vehicle } from "@/context/DataContext";
import { fetchVeiculosPage } from "@/lib/supabase/queries";
import { useServerPaginatedTable } from "@/hooks/useServerPaginatedTable";

type VehicleType = Vehicle["tipo"];

// Função para formatar Renavam
const formatarRenavam = (value: string): string => {
  // Remove caracteres não numéricos
  const cleaned = value.replace(/\D/g, "");

  // Limita a 11 dígitos
  const limited = cleaned.slice(0, 11);

  return limited;
};

// Função para formatar placa
const formatarPlaca = (value: string): string => {
  // Remove caracteres não alfanuméricos
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  // Limita a 7 caracteres
  const limited = cleaned.slice(0, 7);

  // Verifica se é formato Mercosul (ABC1D23) ou antigo (ABC1234)
  if (limited.length >= 5) {
    // Se o 5º caractere é letra, é formato Mercosul
    if (/[A-Z]/.test(limited[4])) {
      // Formato Mercosul: ABC1D23
      if (limited.length <= 4) return limited;
      if (limited.length === 5) return `${limited.slice(0, 4)}-${limited[4]}`;
      if (limited.length === 6)
        return `${limited.slice(0, 4)}-${limited.slice(4, 6)}`;
      return `${limited.slice(0, 4)}-${limited.slice(4)}`;
    } else {
      // Formato antigo: ABC1234
      if (limited.length <= 3) return limited;
      return `${limited.slice(0, 3)}-${limited.slice(3)}`;
    }
  }

  return limited;
};

// Função para validar placa
const validarPlaca = (placa: string): boolean => {
  const cleaned = placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  // Formato antigo: ABC1234
  const regexAntigo = /^[A-Z]{3}[0-9]{4}$/;

  // Formato Mercosul carro: ABC1D23
  const regexMercosulCarro = /^[A-Z]{3}[0-9]{1}[A-Z]{1}[0-9]{2}$/;

  // Formato Mercosul moto: ABC12D3
  const regexMercosulMoto = /^[A-Z]{3}[0-9]{2}[A-Z]{1}[0-9]{1}$/;

  return (
    regexAntigo.test(cleaned) ||
    regexMercosulCarro.test(cleaned) ||
    regexMercosulMoto.test(cleaned)
  );
};

// Função para obter ícone baseado no tipo de veículo
const getTipoIcon = (tipo: VehicleType) => {
  switch (tipo) {
    case "carro":
      return <Car size={18} />;
    case "moto":
      return <Car size={18} />;
    case "onibus":
      return <Bus size={18} />;
    case "caminhao":
      return <Truck size={18} />;
    case "van":
      return <Car size={18} />;
    default:
      return <Car size={18} />;
  }
};

export default function VeiculosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const { confirm, confirmState, closeConfirm, handleConfirm } = useConfirm();
  const { updateVeiculo, deleteVeiculo } = useData();
  const supabase = createClient();
  const vehicleTable = useServerPaginatedTable(fetchVeiculosPage, 10);

  // Form state
  const [formData, setFormData] = useState({
    placa: "",
    renavam: "",
    modelo: "",
    marca: "",
    ano: "",
    cor: "",
    tipo: "carro" as VehicleType,
    status: "ativo",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData({
      placa: "",
      renavam: "",
      modelo: "",
      marca: "",
      ano: "",
      cor: "",
      tipo: "carro",
      status: "ativo",
    });
  };

  const hasDuplicatePlate = async (
    plate: string,
    excludeId?: string,
  ): Promise<boolean> => {
    const formattedPlate = formatarPlaca(plate);
    if (!formattedPlate) return false;

    let query = supabase
      .from("veiculos")
      .select("id")
      .eq("placa", formattedPlate)
      .limit(1);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).length > 0;
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validar formato da placa
      if (!validarPlaca(formData.placa)) {
        throw new Error(
          "Formato de placa inválido. Use formato antigo (ABC-1234) ou Mercosul (ABC-1D23).",
        );
      }

      if (await hasDuplicatePlate(formData.placa)) {
        throw new Error("Já existe um veículo com esta placa.");
      }

      const insertData: Record<string, unknown> = {
        placa: formData.placa.trim().toUpperCase(),
        renavam: formData.renavam.trim(),
        modelo: formData.modelo.trim(),
        marca: formData.marca.trim(),
        ano: formData.ano ? parseInt(formData.ano) : 0,
        cor: formData.cor.trim(),
        tipo: formData.tipo,
        status: formData.status,
      };

      const { error } = await supabase
        .from("veiculos")
        .insert([insertData])
        .select("*")
        .single();

      if (error) throw error;

      setIsModalOpen(false);
      resetForm();
      await vehicleTable.refresh();
      toast.success("Veículo cadastrado com sucesso!");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message
          .toLowerCase()
          .includes("duplicate key value violates unique constraint")
      ) {
        toast.error("Já existe um veículo com esta placa.");
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        console.error("Erro ao salvar veículo:", error);
        toast.error(
          "Erro ao salvar no Supabase. Verifique as políticas de RLS.",
        );
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ativo":
        return "bg-green-100 text-green-700 border-green-200";
      case "inativo":
        return "bg-red-100 text-red-700 border-red-200";
      case "manutencao":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerenciamento de Veículos"
        icon={<Truck size={20} />}
      />

      {vehicleTable.error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-amber-900 shadow-sm">
          <p className="font-black uppercase tracking-widest text-xs">
            Tabela de veículos indisponível
          </p>
          <p className="mt-2 text-sm font-medium">
            A estrutura do banco ainda não foi aplicada. Depois de sincronizar
            as migrations, os veículos aparecerão aqui.
          </p>
        </div>
      )}

      {/* Vehicles List */}
      <DataTable
        data={vehicleTable.items}
        loading={vehicleTable.loading}
        searchTerm={vehicleTable.searchTerm}
        onSearchChange={vehicleTable.setSearchTerm}
        disableClientSearch
        pagination={{
          page: vehicleTable.page,
          pageSize: vehicleTable.pageSize,
          totalItems: vehicleTable.totalCount,
          onPageChange: vehicleTable.setPage,
        }}
        actionButton={
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[var(--color-geolog-blue)] text-white px-5 py-3.5 rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer shadow-lg shadow-blue-900/20 whitespace-nowrap"
          >
            <Plus size={18} />
            Novo Veículo
          </button>
        }
        columns={[
          {
            key: "veiculo",
            title: "Veículo",
            render: (value: unknown, item: Vehicle) => (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black">
                  {getTipoIcon(item.tipo)}
                </div>
                <div className="space-y-1">
                  <p className="font-black text-base text-slate-800 tracking-tight">
                    {item.modelo}
                  </p>
                  <p className="text-sm font-semibold text-slate-400">
                    {item.marca} • {item.ano}
                  </p>
                </div>
              </div>
            ),
          },
          {
            key: "placa",
            title: "Placa",
            render: (value: unknown) => (
              <span className="inline-flex items-center px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-black text-sm border border-slate-200">
                {String(value).toUpperCase()}
              </span>
            ),
          },
          {
            key: "detalhes",
            title: "Detalhes",
            render: (value: unknown, item: Vehicle) => {
              void value;
              return (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Palette size={14} className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">
                      {item.cor || "N/A"}
                    </span>
                  </div>
                </div>
              );
            },
          },
          {
            key: "status",
            title: "Status",
            align: "center",
            render: (value: unknown) => (
              <span
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs md:text-sm font-bold uppercase tracking-wide border ${getStatusColor(String(value))}`}
              >
                {String(value)}
              </span>
            ),
          },
          {
            key: "acoes",
            title: "Ações",
            align: "center" as const,
            render: (value: unknown, item: Vehicle) => {
              void value;

              const handleDelete = async () => {
                const confirmed = await confirm({
                  title: "Arquivar Veículo",
                  message: `Tem certeza que deseja arquivar o veículo "${item.modelo}" (${item.placa})? Ele não aparecerá mais na lista, mas poderá ser recuperado posteriormente.`,
                  confirmText: "Sim, arquivar",
                  cancelText: "Cancelar",
                  type: "danger",
                });

                if (confirmed) {
                  await deleteVeiculo(item.id);
                  await vehicleTable.refresh();
                  toast.success("Veículo arquivado com sucesso.");
                }
              };

              const handleEdit = () => {
                setSelectedVehicle(item);
                setFormData({
                  placa: item.placa,
                  renavam: item.renavam,
                  modelo: item.modelo,
                  marca: item.marca,
                  ano: item.ano?.toString() || "",
                  cor: item.cor || "",
                  tipo: item.tipo,
                  status: item.status,
                });
                setIsEditModalOpen(true);
              };

              const handleView = () => {
                setSelectedVehicle(item);
                setIsViewModalOpen(true);
              };

              return (
                <div className="flex items-center gap-2 justify-center">
                  <button
                    onClick={handleView}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    title="Visualizar"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    onClick={handleEdit}
                    className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
                    title="Editar"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Arquivar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            },
          },
        ]}
        searchPlaceholder="Buscar por placa, modelo ou marca..."
        emptyMessage="Nenhum veículo encontrado."
        emptyIcon={<Truck size={48} />}
      />

      {/* Modal de Cadastro */}
      {isModalOpen && (
        <StandardModal
          onClose={() => {
            setIsModalOpen(false);
            resetForm();
          }}
          title="Novo Veículo"
          subtitle="Cadastro de veículo para a frota Geolog"
          icon={<Truck size={24} />}
          maxWidthClassName="max-w-6xl"
          footer={
            <div className="p-8 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-5 shrink-0">
              <div className="flex items-center gap-1 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-sm" />
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-4 text-slate-600 font-bold hover:text-slate-900 transition-colors text-sm uppercase tracking-widest cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="novo-veiculo-form"
                  disabled={isSubmitting}
                  className="px-12 py-4 bg-[rgb(42,82,144)] text-white font-black rounded-xl shadow-xl shadow-[rgb(42,82,144)]/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    "Confirmar Veículo"
                  )}
                </button>
              </div>
            </div>
          }
        >
          <form
            id="novo-veiculo-form"
            onSubmit={handleAddVehicle}
            className="space-y-8"
          >
            <div className="space-y-6">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <Car size={20} className="text-slate-500" /> Informações do
                  Veículo
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="flex flex-wrap gap-3">
                  <div className="w-[140px] space-y-2 flex-shrink-0">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                      Placa <RequiredAsterisk />
                    </label>
                    <input
                      required
                      value={formData.placa}
                      onChange={(e) => {
                        const formatted = formatarPlaca(e.target.value);
                        setFormData({ ...formData, placa: formatted });
                      }}
                      className="max-w-[140px] px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[4px] h-[60px]"
                      placeholder="ABC-1234"
                      maxLength={8}
                    />
                  </div>
                  <div className="w-[220px] space-y-2 flex-shrink-0">
                    <GeologSearchableSelect
                      label="Marca"
                      options={[
                        { id: "Acura", nome: "Acura" },
                        { id: "Agrale", nome: "Agrale" },
                        { id: "Alfa Romeo", nome: "Alfa Romeo" },
                        { id: "Aston Martin", nome: "Aston Martin" },
                        { id: "Audi", nome: "Audi" },
                        { id: "Bentley", nome: "Bentley" },
                        { id: "BMW", nome: "BMW" },
                        { id: "BYD", nome: "BYD" },
                        { id: "Caoa Chery", nome: "Caoa Chery" },
                        { id: "Chevrolet", nome: "Chevrolet" },
                        { id: "Chrysler", nome: "Chrysler" },
                        { id: "Citroën", nome: "Citroën" },
                        { id: "Dodge", nome: "Dodge" },
                        { id: "Ferrari", nome: "Ferrari" },
                        { id: "Fiat", nome: "Fiat" },
                        { id: "Ford", nome: "Ford" },
                        { id: "GWM", nome: "GWM" },
                        { id: "Honda", nome: "Honda" },
                        { id: "Hyundai", nome: "Hyundai" },
                        { id: "Jac", nome: "Jac" },
                        { id: "Jaguar", nome: "Jaguar" },
                        { id: "Jeep", nome: "Jeep" },
                        { id: "Kia", nome: "Kia" },
                        { id: "Lamborghini", nome: "Lamborghini" },
                        { id: "Land Rover", nome: "Land Rover" },
                        { id: "Lexus", nome: "Lexus" },
                        { id: "Lifan", nome: "Lifan" },
                        { id: "Maserati", nome: "Maserati" },
                        { id: "McLaren", nome: "McLaren" },
                        { id: "Mercedes-Benz", nome: "Mercedes-Benz" },
                        { id: "Mini", nome: "Mini" },
                        { id: "Mitsubishi", nome: "Mitsubishi" },
                        { id: "Nissan", nome: "Nissan" },
                        { id: "Peugeot", nome: "Peugeot" },
                        { id: "Porsche", nome: "Porsche" },
                        { id: "Ram", nome: "Ram" },
                        { id: "Renault", nome: "Renault" },
                        { id: "Rolls-Royce", nome: "Rolls-Royce" },
                        { id: "Seat", nome: "Seat" },
                        { id: "Smart", nome: "Smart" },
                        { id: "Subaru", nome: "Subaru" },
                        { id: "Suzuki", nome: "Suzuki" },
                        { id: "Tesla", nome: "Tesla" },
                        { id: "Toyota", nome: "Toyota" },
                        { id: "Troller", nome: "Troller" },
                        { id: "Volkswagen", nome: "Volkswagen" },
                        { id: "Volvo", nome: "Volvo" },
                        { id: "Outra", nome: "Outra" },
                      ]}
                      value={formData.marca}
                      onChange={(value) =>
                        setFormData({ ...formData, marca: value })
                      }
                      required
                      triggerClassName="mt-[9px] h-[60px]"
                    />
                  </div>
                  <div className="flex-1 space-y-2 min-w-[150px]">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                      Modelo <RequiredAsterisk />
                    </label>
                    <input
                      required
                      value={formData.modelo}
                      onChange={(e) =>
                        setFormData({ ...formData, modelo: e.target.value })
                      }
                      className="w-full px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[4px] h-[60px]"
                      placeholder="Ex: Gol"
                    />
                  </div>
                  <div className="w-[180px] space-y-2 flex-shrink-0">
                    <GeologSearchableSelect
                      label="Tipo"
                      options={[
                        { id: "carro", nome: "Carro" },
                        { id: "van", nome: "Van" },
                        { id: "onibus", nome: "Ônibus" },
                        { id: "moto", nome: "Moto" },
                        { id: "caminhao", nome: "Caminhão" },
                        { id: "outro", nome: "Outro" },
                      ]}
                      value={formData.tipo}
                      onChange={(value) =>
                        setFormData({ ...formData, tipo: value as VehicleType })
                      }
                      required
                      disableSearch
                      triggerClassName="mt-[9px] h-[60px]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="w-[180px] space-y-2 flex-shrink-0">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      Renavam
                    </label>
                    <input
                      value={formData.renavam}
                      onChange={(e) => {
                        const formatted = formatarRenavam(e.target.value);
                        setFormData({ ...formData, renavam: formatted });
                      }}
                      className="w-[180px] px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[6px] h-[60px]"
                      placeholder="00000000000"
                      maxLength={11}
                    />
                  </div>
                  <div className="w-[130px] space-y-2 flex-shrink-0">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      Ano
                    </label>
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      value={formData.ano}
                      onChange={(e) =>
                        setFormData({ ...formData, ano: e.target.value })
                      }
                      className="w-[130px] px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[6px] h-[60px]"
                      placeholder="0000"
                    />
                  </div>
                  <div className="w-[250px] space-y-2 flex-shrink-0">
                    <GeologSearchableSelect
                      label="Cor"
                      options={[
                        { id: "branco", nome: "Branco" },
                        { id: "preto", nome: "Preto" },
                        { id: "prata", nome: "Prata" },
                        { id: "cinza", nome: "Cinza" },
                        { id: "vermelho", nome: "Vermelho" },
                        { id: "azul", nome: "Azul" },
                        { id: "verde", nome: "Verde" },
                        { id: "amarelo", nome: "Amarelo" },
                        { id: "marrom", nome: "Marrom" },
                        { id: "bege", nome: "Bege" },
                        { id: "dourado", nome: "Dourado" },
                        { id: "roxo", nome: "Roxo" },
                        { id: "laranja", nome: "Laranja" },
                        { id: "outro", nome: "Outro" },
                      ]}
                      value={formData.cor}
                      onChange={(value) =>
                        setFormData({ ...formData, cor: value })
                      }
                      triggerClassName="mt-[9px] h-[60px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </StandardModal>
      )}

      {isViewModalOpen && selectedVehicle && (
        <StandardModal
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedVehicle(null);
          }}
          title="Detalhes do Veículo"
          subtitle="Informações completas do veículo selecionado"
          icon={<Eye className="w-6 h-6 md:w-7 md:h-7" />}
          maxWidthClassName="max-w-6xl"
        >
          <div className="space-y-8 py-8">
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <Car size={28} className="text-blue-600" />
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-[0.1em]">
                  Informações do Veículo
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Placa
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-100 text-blue-700 font-black text-base border border-blue-200">
                      {selectedVehicle.placa}
                    </span>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Renavam
                  </label>
                  <p className="text-lg font-bold text-slate-800 mt-2">
                    {selectedVehicle.renavam}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Marca
                  </label>
                  <p className="text-lg font-bold text-slate-800 mt-2">
                    {selectedVehicle.marca}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Modelo
                  </label>
                  <p className="text-lg font-bold text-slate-800 mt-2">
                    {selectedVehicle.modelo}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Ano
                  </label>
                  <p className="text-lg font-bold text-slate-800 mt-2">
                    {selectedVehicle.ano}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Cor
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                    <Palette size={16} className="text-slate-400" />
                    <p className="text-lg font-bold text-slate-800">
                      {selectedVehicle.cor || "Não informado"}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Tipo
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                    {getTipoIcon(selectedVehicle.tipo)}
                    <p className="text-lg font-bold text-slate-800">
                      {selectedVehicle.tipo}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Status
                  </label>
                  <div className="mt-2">
                    <span
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wide border ${getStatusColor(selectedVehicle.status)}`}
                    >
                      {selectedVehicle.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </StandardModal>
      )}

      {isEditModalOpen && (
        <StandardModal
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedVehicle(null);
            resetForm();
          }}
          title="Editar Veículo"
          subtitle="Atualize as informações do veículo"
          icon={<Edit size={24} />}
          maxWidthClassName="max-w-6xl"
          footer={
            <div className="p-8 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-5 shrink-0">
              <div className="flex items-center gap-1 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-sm" />
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-6 py-4 text-slate-600 font-bold hover:text-slate-900 transition-colors text-sm uppercase tracking-widest cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="editar-veiculo-form"
                  disabled={isSubmitting}
                  className="px-12 py-4 bg-[rgb(42,82,144)] text-white font-black rounded-xl shadow-xl shadow-[rgb(42,82,144)]/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    "Atualizar Veículo"
                  )}
                </button>
              </div>
            </div>
          }
        >
          <form
            id="editar-veiculo-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              try {
                if (!validarPlaca(formData.placa)) {
                  throw new Error(
                    "Formato de placa inválido. Use formato antigo (ABC-1234) ou Mercosul (ABC-1D23).",
                  );
                }
                if (
                  await hasDuplicatePlate(formData.placa, selectedVehicle?.id)
                ) {
                  throw new Error("Já existe um veículo com esta placa.");
                }
                await updateVeiculo(selectedVehicle!.id, {
                  placa: formData.placa,
                  renavam: formData.renavam,
                  modelo: formData.modelo,
                  marca: formData.marca,
                  ano: formData.ano ? parseInt(formData.ano) : 0,
                  cor: formData.cor,
                  tipo: formData.tipo,
                  status: formData.status as Vehicle["status"],
                });
                await vehicleTable.refresh();
                setIsEditModalOpen(false);
                setSelectedVehicle(null);
                resetForm();
                toast.success("Veículo atualizado com sucesso!");
              } catch (error) {
                if (error instanceof Error) {
                  toast.error(error.message);
                } else {
                  toast.error("Erro ao atualizar veículo.");
                }
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="space-y-8"
          >
            <div className="space-y-6">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <Car size={20} className="text-slate-500" /> Informações do
                  Veículo
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <div className="flex flex-wrap gap-3">
                  <div className="w-[140px] space-y-2 flex-shrink-0">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                      Placa <RequiredAsterisk />
                    </label>
                    <input
                      required
                      value={formData.placa}
                      onChange={(e) => {
                        const formatted = formatarPlaca(e.target.value);
                        setFormData({ ...formData, placa: formatted });
                      }}
                      className="max-w-[140px] px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[4px] h-[60px]"
                      placeholder="ABC-1234"
                      maxLength={8}
                    />
                  </div>
                  <div className="w-[220px] space-y-2 flex-shrink-0">
                    <GeologSearchableSelect
                      label="Marca"
                      options={[
                        { id: "Acura", nome: "Acura" },
                        { id: "Agrale", nome: "Agrale" },
                        { id: "Alfa Romeo", nome: "Alfa Romeo" },
                        { id: "Aston Martin", nome: "Aston Martin" },
                        { id: "Audi", nome: "Audi" },
                        { id: "Bentley", nome: "Bentley" },
                        { id: "BMW", nome: "BMW" },
                        { id: "BYD", nome: "BYD" },
                        { id: "Caoa Chery", nome: "Caoa Chery" },
                        { id: "Chevrolet", nome: "Chevrolet" },
                        { id: "Chrysler", nome: "Chrysler" },
                        { id: "Citroën", nome: "Citroën" },
                        { id: "Dodge", nome: "Dodge" },
                        { id: "Ferrari", nome: "Ferrari" },
                        { id: "Fiat", nome: "Fiat" },
                        { id: "Ford", nome: "Ford" },
                        { id: "GWM", nome: "GWM" },
                        { id: "Honda", nome: "Honda" },
                        { id: "Hyundai", nome: "Hyundai" },
                        { id: "Jac", nome: "Jac" },
                        { id: "Jaguar", nome: "Jaguar" },
                        { id: "Jeep", nome: "Jeep" },
                        { id: "Kia", nome: "Kia" },
                        { id: "Lamborghini", nome: "Lamborghini" },
                        { id: "Land Rover", nome: "Land Rover" },
                        { id: "Lexus", nome: "Lexus" },
                        { id: "Lifan", nome: "Lifan" },
                        { id: "Maserati", nome: "Maserati" },
                        { id: "McLaren", nome: "McLaren" },
                        { id: "Mercedes-Benz", nome: "Mercedes-Benz" },
                        { id: "Mini", nome: "Mini" },
                        { id: "Mitsubishi", nome: "Mitsubishi" },
                        { id: "Nissan", nome: "Nissan" },
                        { id: "Peugeot", nome: "Peugeot" },
                        { id: "Porsche", nome: "Porsche" },
                        { id: "Ram", nome: "Ram" },
                        { id: "Renault", nome: "Renault" },
                        { id: "Rolls-Royce", nome: "Rolls-Royce" },
                        { id: "Seat", nome: "Seat" },
                        { id: "Smart", nome: "Smart" },
                        { id: "Subaru", nome: "Subaru" },
                        { id: "Suzuki", nome: "Suzuki" },
                        { id: "Tesla", nome: "Tesla" },
                        { id: "Toyota", nome: "Toyota" },
                        { id: "Troller", nome: "Troller" },
                        { id: "Volkswagen", nome: "Volkswagen" },
                        { id: "Volvo", nome: "Volvo" },
                        { id: "Outra", nome: "Outra" },
                      ]}
                      value={formData.marca}
                      onChange={(value) =>
                        setFormData({ ...formData, marca: value })
                      }
                      required
                      triggerClassName="mt-[9px] h-[60px]"
                    />
                  </div>
                  <div className="flex-1 space-y-2 min-w-[150px]">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                      Modelo <RequiredAsterisk />
                    </label>
                    <input
                      required
                      value={formData.modelo}
                      onChange={(e) =>
                        setFormData({ ...formData, modelo: e.target.value })
                      }
                      className="w-full px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[4px] h-[60px]"
                      placeholder="Ex: Gol"
                    />
                  </div>
                  <div className="w-[180px] space-y-2 flex-shrink-0">
                    <GeologSearchableSelect
                      label="Tipo"
                      options={[
                        { id: "carro", nome: "Carro" },
                        { id: "van", nome: "Van" },
                        { id: "onibus", nome: "Ônibus" },
                        { id: "moto", nome: "Moto" },
                        { id: "caminhao", nome: "Caminhão" },
                        { id: "outro", nome: "Outro" },
                      ]}
                      value={formData.tipo}
                      onChange={(value) =>
                        setFormData({ ...formData, tipo: value as VehicleType })
                      }
                      required
                      disableSearch
                      triggerClassName="mt-[9px] h-[60px]"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="w-[180px] space-y-2 flex-shrink-0">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      Renavam
                    </label>
                    <input
                      value={formData.renavam}
                      onChange={(e) => {
                        const formatted = formatarRenavam(e.target.value);
                        setFormData({ ...formData, renavam: formatted });
                      }}
                      className="w-[180px] px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[6px] h-[60px]"
                      placeholder="00000000000"
                      maxLength={11}
                    />
                  </div>
                  <div className="w-[130px] space-y-2 flex-shrink-0">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      Ano
                    </label>
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      value={formData.ano}
                      onChange={(e) =>
                        setFormData({ ...formData, ano: e.target.value })
                      }
                      className="w-[130px] px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[6px] h-[60px]"
                      placeholder="0000"
                    />
                  </div>
                  <div className="w-[250px] space-y-2 flex-shrink-0">
                    <GeologSearchableSelect
                      label="Cor"
                      options={[
                        { id: "branco", nome: "Branco" },
                        { id: "preto", nome: "Preto" },
                        { id: "prata", nome: "Prata" },
                        { id: "cinza", nome: "Cinza" },
                        { id: "vermelho", nome: "Vermelho" },
                        { id: "azul", nome: "Azul" },
                        { id: "verde", nome: "Verde" },
                        { id: "amarelo", nome: "Amarelo" },
                        { id: "marrom", nome: "Marrom" },
                        { id: "bege", nome: "Bege" },
                        { id: "dourado", nome: "Dourado" },
                        { id: "roxo", nome: "Roxo" },
                        { id: "laranja", nome: "Laranja" },
                        { id: "outro", nome: "Outro" },
                      ]}
                      value={formData.cor}
                      onChange={(value) =>
                        setFormData({ ...formData, cor: value })
                      }
                      triggerClassName="mt-[9px] h-[60px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>
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
