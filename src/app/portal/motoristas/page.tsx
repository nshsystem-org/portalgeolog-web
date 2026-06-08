"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import StandardModal from "@/components/StandardModal";
import {
  UserPlus,
  Phone,
  IdCard,
  Loader2,
  Truck,
  FileText,
  Building2,
  Handshake,
  Eye,
  Edit2,
  Trash2,
  User,
  PlusCircle,
  Car,
  Users,
  MapPin,
  Filter,
  FilterX,
} from "lucide-react";
import DriverDocsModal from "@/components/DriverDocsModal";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import GeologSearchableSelect from "@/components/ui/GeologSearchableSelect";
import RequiredAsterisk from "@/components/ui/RequiredAsterisk";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useConfirm } from "@/hooks/useConfirm";
import { toast } from "sonner";
import {
  useData,
  type ParceiroServico,
  type NovoParceiroInput,
} from "@/context/DataContext";
import { useParceiros } from "@/hooks/useParceiros";
import {
  formatBrazilPhone,
  normalizeBrazilPhone,
  stripBrazilCountryCode,
} from "@/lib/phone";
import { fetchDriversPage } from "@/lib/supabase/queries";
import { useServerPaginatedTable } from "@/hooks/useServerPaginatedTable";

interface DriverVehicle {
  id: string;
  driver_id: string;
  vehicle_id: string;
  created_at?: string;
  vehicle?: VehicleOption;
}

interface Driver {
  id: string;
  name: string;
  cpf?: string;
  cnh?: string;
  phone?: string;
  email?: string;
  vehicle_id?: string; // Mantido para compatibilidade
  status: "active" | "inactive";
  vinculo_tipo?: "interno" | "parceiro" | "autonomo";
  parceiro_id?: string;
  created_at?: string;
  driver_vehicles?: DriverVehicle[];
  docsCount?: number;
}

interface VehicleOption {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  tipo?: string;
}

const MARCAS_VEICULOS = [
  { id: "Acura", nome: "Acura" },
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
];

const TIPOS_VEICULO = [
  { id: "carro", nome: "Carro" },
  { id: "van", nome: "Van" },
  { id: "onibus", nome: "Ônibus" },
  { id: "moto", nome: "Moto" },
  { id: "caminhao", nome: "Caminhão" },
  { id: "outro", nome: "Outro" },
];

const formatarPlacaQuick = (value: string): string => {
  const cleaned = value
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 7);
  if (cleaned.length >= 5 && /[A-Z]/.test(cleaned[4]))
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  if (cleaned.length >= 4) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return cleaned;
};

const validarPlacaQuick = (placa: string): boolean => {
  const c = placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (
    /^[A-Z]{3}[0-9]{4}$/.test(c) ||
    /^[A-Z]{3}[0-9]{1}[A-Z]{1}[0-9]{2}$/.test(c) ||
    /^[A-Z]{3}[0-9]{2}[A-Z]{1}[0-9]{1}$/.test(c)
  );
};

// Funções de validação de parceiro
const PESSOA_TIPO_OPTIONS = [
  { id: "juridica", nome: "Pessoa jurídica" },
  { id: "fisica", nome: "Pessoa física" },
];

const formatDocumentParceiro = (
  value: string,
  pessoaTipo: "fisica" | "juridica",
): string => {
  const digits = value
    .replace(/\D/g, "")
    .slice(0, pessoaTipo === "juridica" ? 14 : 11);
  if (pessoaTipo === "juridica") {
    return digits
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const formatPhoneParceiro = (value: string): string => formatBrazilPhone(value);

const validateCPF = (cpf: string): boolean => {
  const cpfClean = cpf.replace(/\D/g, "");
  if (cpfClean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpfClean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpfClean.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpfClean.charAt(9))) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpfClean.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpfClean.charAt(10))) return false;
  return true;
};

const validateCNPJ = (cnpj: string): boolean => {
  const cnpjClean = cnpj.replace(/\D/g, "");
  if (cnpjClean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpjClean)) return false;
  const weightsFirst = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weightsSecond = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpjClean.charAt(i)) * weightsFirst[i];
  }
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (firstDigit !== parseInt(cnpjClean.charAt(12))) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpjClean.charAt(i)) * weightsSecond[i];
  }
  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;
  if (secondDigit !== parseInt(cnpjClean.charAt(13))) return false;
  return true;
};

export default function MotoristasPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriverForDocs, setSelectedDriverForDocs] =
    useState<Driver | null>(null);
  const [viewingDriver, setViewingDriver] = useState<Driver | null>(null);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const { confirm, confirmState, closeConfirm, handleConfirm } = useConfirm();
  const supabase = createClient();
  const { parceiros } = useParceiros();
  const {
    drivers: allDrivers,
    refreshData,
    addParceiro,
    deleteDriver,
  } = useData();
  const driversTable = useServerPaginatedTable(fetchDriversPage, 10);

  type AdvancedFilters = {
    tipoVeiculo: string;
    veiculoId: string;
    vinculoTipo: "" | "interno" | "parceiro" | "autonomo";
    status: "" | "active" | "inactive";
  };
  const defaultAdvancedFilters: AdvancedFilters = {
    tipoVeiculo: "",
    veiculoId: "",
    vinculoTipo: "",
    status: "",
  };
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(
    defaultAdvancedFilters,
  );
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [clientPage, setClientPage] = useState(1);
  const clientPageSize = 10;

  const hasActiveAdvancedFilters = useMemo(() => {
    return (
      advancedFilters.tipoVeiculo !== "" ||
      advancedFilters.veiculoId !== "" ||
      advancedFilters.vinculoTipo !== "" ||
      advancedFilters.status !== ""
    );
  }, [advancedFilters]);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    cpf: "",
    celular: "",
    vinculo_tipo: "parceiro" as "interno" | "parceiro" | "autonomo",
    parceiro_id: "",
    tipo_documento: "cpf" as "cpf" | "passaporte",
    vehicle_ids: [] as string[], // Múltiplos veículos
  });

  const parceiroOptions = parceiros.map((p: ParceiroServico) => ({
    id: p.id,
    nome: p.razaoSocialOuNomeCompleto,
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [vehiclesUnavailable, setVehiclesUnavailable] = useState(false);

  // Modal rápido de veículo
  type QuickVehicleMode =
    | { mode: "create"; rowIndex: number }
    | { mode: "edit"; rowIndex: number; vehicleId: string };
  const [quickVehicleModal, setQuickVehicleModal] =
    useState<QuickVehicleMode | null>(null);
  const [isSubmittingVehicle, setIsSubmittingVehicle] = useState(false);
  const [vehicleQuickForm, setVehicleQuickForm] = useState({
    placa: "",
    modelo: "",
    marca: "",
    tipo: "carro" as "carro" | "van" | "onibus" | "moto" | "caminhao" | "outro",
  });

  // Modal rápido de parceiro
  type ParceiroFormContato = {
    setor: string;
    celular: string;
    email?: string;
    responsavel: string;
  };
  type ParceiroFormFilial = {
    rotulo: string;
    enderecoCompleto: string;
    referencia?: string;
  };
  type ParceiroFormData = {
    pessoaTipo: "fisica" | "juridica";
    documento: string;
    razaoSocialOuNomeCompleto: string;
    contatos: ParceiroFormContato[];
    filiais: ParceiroFormFilial[];
  };
  const [isQuickParceiroModalOpen, setIsQuickParceiroModalOpen] =
    useState(false);
  const [isSubmittingParceiro, setIsSubmittingParceiro] = useState(false);
  const [parceiroQuickForm, setParceiroQuickForm] = useState<ParceiroFormData>({
    pessoaTipo: "juridica",
    documento: "",
    razaoSocialOuNomeCompleto: "",
    contatos: [{ setor: "", celular: "", email: "", responsavel: "" }],
    filiais: [{ rotulo: "", enderecoCompleto: "", referencia: "" }],
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setFormData({
        name: "",
        cpf: "",
        celular: "",
        vinculo_tipo: "parceiro",
        parceiro_id: "",
        tipo_documento: "cpf",
        vehicle_ids: [],
      });
    }
  }, [isModalOpen]);

  const filteredVehicles = useMemo(() => {
    return vehicles;
  }, [vehicles]);

  const filteredDrivers = useMemo(() => {
    let base = hasActiveAdvancedFilters ? allDrivers : driversTable.items;

    if (advancedFilters.tipoVeiculo) {
      base = base.filter((driver) =>
        driver.driver_vehicles?.some(
          (dv) => dv.vehicle?.tipo === advancedFilters.tipoVeiculo,
        ),
      );
    }
    if (advancedFilters.veiculoId) {
      base = base.filter((driver) =>
        driver.driver_vehicles?.some(
          (dv) => dv.vehicle_id === advancedFilters.veiculoId,
        ),
      );
    }
    if (advancedFilters.vinculoTipo) {
      base = base.filter(
        (driver) => driver.vinculo_tipo === advancedFilters.vinculoTipo,
      );
    }
    if (advancedFilters.status) {
      base = base.filter((driver) => driver.status === advancedFilters.status);
    }

    return base;
  }, [
    allDrivers,
    driversTable.items,
    hasActiveAdvancedFilters,
    advancedFilters,
  ]);

  const clientPaginatedItems = useMemo(() => {
    const start = (clientPage - 1) * clientPageSize;
    return filteredDrivers.slice(start, start + clientPageSize);
  }, [filteredDrivers, clientPage]);

  const tableItems = useMemo(() => {
    if (hasActiveAdvancedFilters) return clientPaginatedItems;
    return driversTable.items;
  }, [hasActiveAdvancedFilters, clientPaginatedItems, driversTable.items]);

  const tableTotalCount = useMemo(() => {
    if (hasActiveAdvancedFilters) return filteredDrivers.length;
    return driversTable.totalCount;
  }, [
    hasActiveAdvancedFilters,
    filteredDrivers.length,
    driversTable.totalCount,
  ]);

  // Filtrar veículos já selecionados para não aparecerem no select
  const availableVehicles = useMemo(() => {
    return filteredVehicles.filter((v) => !formData.vehicle_ids.includes(v.id));
  }, [filteredVehicles, formData.vehicle_ids]);

  // Handlers para múltiplos veículos
  const handleAddVehicle = () => {
    if (availableVehicles.length === 0) return;
    setFormData((prev) => ({
      ...prev,
      vehicle_ids: [...prev.vehicle_ids, availableVehicles[0].id],
    }));
  };

  const handleRemoveVehicle = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      vehicle_ids: prev.vehicle_ids.filter((_, idx) => idx !== index),
    }));
  };

  const handleVehicleChange = (index: number, vehicleId: string) => {
    setFormData((prev) => ({
      ...prev,
      vehicle_ids: prev.vehicle_ids.map((id, idx) =>
        idx === index ? vehicleId : id,
      ),
    }));
  };

  const hasDuplicatePlateQuick = (
    placa: string,
    excludeId?: string,
  ): boolean => {
    const n = placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return vehicles.some(
      (v) =>
        v.id !== excludeId &&
        v.placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase() === n,
    );
  };

  const handleQuickVehicleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickVehicleModal) return;
    setIsSubmittingVehicle(true);
    try {
      if (!validarPlacaQuick(vehicleQuickForm.placa)) {
        throw new Error(
          "Formato de placa inválido. Use ABC-1234 ou Mercosul ABC-1D23.",
        );
      }
      if (quickVehicleModal.mode === "create") {
        if (hasDuplicatePlateQuick(vehicleQuickForm.placa))
          throw new Error("Já existe um veículo com esta placa.");
        const { data, error } = await supabase
          .from("veiculos")
          .insert([
            {
              placa: vehicleQuickForm.placa.trim().toUpperCase(),
              modelo: vehicleQuickForm.modelo.trim(),
              marca: vehicleQuickForm.marca.trim(),
              tipo: vehicleQuickForm.tipo,
              status: "ativo",
              ano: new Date().getFullYear(),
              renavam: "",
            },
          ])
          .select("id, placa, modelo, marca")
          .single();
        if (error) throw error;
        const newV = data as VehicleOption;
        setVehicles((prev) =>
          [...prev, newV].sort(
            (a, b) =>
              a.marca.localeCompare(b.marca, "pt-BR") ||
              a.modelo.localeCompare(b.modelo, "pt-BR"),
          ),
        );
        setFormData((prev) => ({
          ...prev,
          vehicle_ids: prev.vehicle_ids.map((id, idx) =>
            idx === quickVehicleModal.rowIndex ? newV.id : id,
          ),
        }));
        toast.success("Veículo cadastrado e selecionado!");
      } else {
        const { vehicleId } = quickVehicleModal;
        if (hasDuplicatePlateQuick(vehicleQuickForm.placa, vehicleId))
          throw new Error("Já existe um veículo com esta placa.");
        const { data, error } = await supabase
          .from("veiculos")
          .update({
            placa: vehicleQuickForm.placa.trim().toUpperCase(),
            modelo: vehicleQuickForm.modelo.trim(),
            marca: vehicleQuickForm.marca.trim(),
            tipo: vehicleQuickForm.tipo,
          })
          .eq("id", vehicleId)
          .select("id, placa, modelo, marca")
          .single();
        if (error) throw error;
        setVehicles((prev) =>
          prev.map((v) => (v.id === vehicleId ? (data as VehicleOption) : v)),
        );
        toast.success("Veículo atualizado!");
      }
      setQuickVehicleModal(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar veículo.",
      );
    } finally {
      setIsSubmittingVehicle(false);
    }
  };

  // Handlers para modal rápido de parceiro
  const handleQuickParceiroOpen = () => {
    setParceiroQuickForm({
      pessoaTipo: "juridica",
      documento: "",
      razaoSocialOuNomeCompleto: "",
      contatos: [{ setor: "", celular: "", email: "", responsavel: "" }],
      filiais: [{ rotulo: "", enderecoCompleto: "", referencia: "" }],
    });
    setIsQuickParceiroModalOpen(true);
  };

  const handleParceiroInputChange = (
    field: keyof Omit<ParceiroFormData, "contatos" | "filiais">,
    value: string,
  ) => {
    if (field === "documento") {
      setParceiroQuickForm((prev) => ({
        ...prev,
        documento: formatDocumentParceiro(value, prev.pessoaTipo),
      }));
      return;
    }
    setParceiroQuickForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleParceiroPessoaTipoChange = (
    pessoaTipo: "fisica" | "juridica",
  ) => {
    setParceiroQuickForm((prev) => ({
      ...prev,
      pessoaTipo,
      documento: formatDocumentParceiro(prev.documento, pessoaTipo),
      razaoSocialOuNomeCompleto: "",
    }));
  };

  const handleParceiroContatoChange = (
    index: number,
    field: keyof ParceiroFormContato,
    value: string,
  ) => {
    const formattedValue =
      field === "celular" ? formatPhoneParceiro(value) : value;
    setParceiroQuickForm((prev) => ({
      ...prev,
      contatos: prev.contatos.map((c, idx) =>
        idx === index ? { ...c, [field]: formattedValue } : c,
      ),
    }));
  };

  const handleParceiroFilialChange = (
    index: number,
    field: keyof ParceiroFormFilial,
    value: string,
  ) => {
    setParceiroQuickForm((prev) => ({
      ...prev,
      filiais: prev.filiais.map((f, idx) =>
        idx === index ? { ...f, [field]: value } : f,
      ),
    }));
  };

  const handleParceiroAddContato = () => {
    setParceiroQuickForm((prev) => ({
      ...prev,
      contatos: [
        ...prev.contatos,
        { setor: "", celular: "", email: "", responsavel: "" },
      ],
    }));
  };

  const handleParceiroRemoveContato = (index: number) => {
    setParceiroQuickForm((prev) => ({
      ...prev,
      contatos:
        prev.contatos.length > 1
          ? prev.contatos.filter((_, idx) => idx !== index)
          : prev.contatos,
    }));
  };

  const handleParceiroAddFilial = () => {
    setParceiroQuickForm((prev) => ({
      ...prev,
      filiais: [
        ...prev.filiais,
        { rotulo: "", enderecoCompleto: "", referencia: "" },
      ],
    }));
  };

  const handleParceiroRemoveFilial = (index: number) => {
    setParceiroQuickForm((prev) => ({
      ...prev,
      filiais:
        prev.filiais.length > 1
          ? prev.filiais.filter((_, idx) => idx !== index)
          : prev.filiais,
    }));
  };

  const validateParceiroForm = (): string | null => {
    if (!parceiroQuickForm.razaoSocialOuNomeCompleto.trim()) {
      return "Razão Social/Nome completo é obrigatório";
    }
    if (!parceiroQuickForm.documento.trim()) {
      return "CNPJ/CPF é obrigatório";
    }
    const documentoLimpo = parceiroQuickForm.documento.replace(/\D/g, "");
    if (parceiroQuickForm.pessoaTipo === "juridica") {
      if (documentoLimpo.length !== 14) {
        return "CNPJ deve ter 14 dígitos completos";
      }
      if (!validateCNPJ(parceiroQuickForm.documento)) {
        return "CNPJ inválido";
      }
    } else {
      if (documentoLimpo.length !== 11) {
        return "CPF deve ter 11 dígitos completos";
      }
      if (!validateCPF(parceiroQuickForm.documento)) {
        return "CPF inválido";
      }
    }
    const primeiroContato = parceiroQuickForm.contatos[0];
    if (!primeiroContato.setor.trim()) {
      return "Setor do primeiro contato é obrigatório";
    }
    if (!primeiroContato.celular.trim()) {
      return "Celular do primeiro contato é obrigatório";
    }
    if (!primeiroContato.responsavel.trim()) {
      return "Responsável do primeiro contato é obrigatório";
    }
    const celularLimpo = stripBrazilCountryCode(primeiroContato.celular);
    if (celularLimpo.length !== 11) {
      return "Celular deve ter 11 dígitos completos: (00) 00000-0000";
    }
    if (!validateCelular(primeiroContato.celular)) {
      return "Celular inválido";
    }
    if (primeiroContato.email && primeiroContato.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(primeiroContato.email.trim())) {
        return "E-mail inválido";
      }
    }
    return null;
  };

  const handleQuickParceiroSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateParceiroForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setIsSubmittingParceiro(true);
    try {
      const cleanForm: NovoParceiroInput = {
        pessoaTipo: parceiroQuickForm.pessoaTipo,
        documento: parceiroQuickForm.documento.trim(),
        razaoSocialOuNomeCompleto:
          parceiroQuickForm.razaoSocialOuNomeCompleto.trim(),
        contatos: parceiroQuickForm.contatos.map((c) => ({
          setor: c.setor.trim(),
          celular: normalizeBrazilPhone(c.celular),
          email: c.email?.trim() || "",
          responsavel: c.responsavel.trim(),
        })),
        filiais: parceiroQuickForm.filiais.map((f) => ({
          rotulo: f.rotulo.trim(),
          enderecoCompleto: f.enderecoCompleto.trim(),
          referencia: f.referencia?.trim() || "",
        })),
      };
      await addParceiro(cleanForm);
      await refreshData();
      toast.success("Parceiro cadastrado com sucesso!");
      setIsQuickParceiroModalOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar parceiro.",
      );
    } finally {
      setIsSubmittingParceiro(false);
    }
  };

  const formatDocumento = (
    value: string,
    tipo: "cpf" | "passaporte",
  ): string => {
    if (tipo === "cpf") {
      const digits = value.replace(/\D/g, "").slice(0, 11);
      return digits
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    if (tipo === "passaporte") {
      return value
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 9);
    }
    return value;
  };

  const formatCelular = (value: string): string => {
    return formatBrazilPhone(value);
  };

  const validateCelular = (value: string): boolean => {
    const digits = stripBrazilCountryCode(value);
    if (digits.length !== 11) return false;
    if (digits[2] !== "9") return false;
    if (/^(\d)\1{10}$/.test(digits)) return false;
    const ddd = digits.slice(0, 2);
    const validDDDs = [
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19",
      "21",
      "22",
      "24",
      "27",
      "28",
      "31",
      "32",
      "33",
      "34",
      "35",
      "37",
      "38",
      "41",
      "42",
      "43",
      "44",
      "45",
      "46",
      "47",
      "48",
      "49",
      "51",
      "53",
      "54",
      "55",
      "61",
      "62",
      "63",
      "64",
      "65",
      "66",
      "67",
      "68",
      "69",
      "71",
      "73",
      "74",
      "75",
      "77",
      "79",
      "81",
      "82",
      "83",
      "84",
      "85",
      "86",
      "87",
      "88",
      "89",
      "91",
      "92",
      "93",
      "94",
      "95",
      "96",
      "97",
      "98",
      "99",
    ];
    if (!validDDDs.includes(ddd)) return false;
    const prefix = digits.slice(3, 7);
    if (prefix === "0000") return false;
    return true;
  };

  const getDocumentoLabel = (tipo: "cpf" | "passaporte"): string => {
    switch (tipo) {
      case "cpf":
        return "CPF";
      case "passaporte":
        return "Passaporte";
    }
  };

  const getDocumentoPlaceholder = (tipo: "cpf" | "passaporte"): string => {
    switch (tipo) {
      case "cpf":
        return "000.000.000-00";
      case "passaporte":
        return "AA1234567";
    }
  };

  const tipoDocumentoOptions = [
    { id: "cpf", nome: "CPF" },
    { id: "passaporte", nome: "Passaporte" },
  ];

  const normalizeTextValue = (value: string): string =>
    value.trim().toLowerCase();
  const normalizeDigitsValue = (value: string): string =>
    value.replace(/\D/g, "");
  const normalizePhoneDigitsValue = (value: string): string =>
    normalizeBrazilPhone(value);

  const hasDuplicateDriver = (
    field: "name" | "cpf" | "phone",
    value: string,
    excludeId?: string,
  ): boolean => {
    const normalizedValue =
      field === "name"
        ? normalizeTextValue(value)
        : field === "phone"
          ? normalizePhoneDigitsValue(value)
          : normalizeDigitsValue(value);

    if (!normalizedValue) {
      return false;
    }

    return allDrivers.some((driver) => {
      if (excludeId && driver.id === excludeId) return false;
      const driverValue = driver[field] ?? "";
      const normalizedDriverValue =
        field === "name"
          ? normalizeTextValue(driverValue)
          : field === "phone"
            ? normalizePhoneDigitsValue(driverValue)
            : normalizeDigitsValue(driverValue);
      return normalizedDriverValue === normalizedValue;
    });
  };

  const getDuplicateDriverMessage = (
    driverData: typeof formData,
    excludeId?: string,
  ): string | null => {
    if (hasDuplicateDriver("name", driverData.name, excludeId)) {
      return "Já existe um motorista com este nome.";
    }

    if (hasDuplicateDriver("cpf", driverData.cpf, excludeId)) {
      return "Já existe um motorista com este CPF.";
    }

    if (hasDuplicateDriver("phone", driverData.celular, excludeId)) {
      return "Já existe um motorista com este celular.";
    }

    return null;
  };

  useEffect(() => {
    const fetchVehicles = async () => {
      const { data, error } = await supabase
        .from("veiculos")
        .select("id, placa, modelo, marca")
        .eq("status", "ativo")
        .order("marca", { ascending: true })
        .order("modelo", { ascending: true });

      if (error) {
        const isMissingTable =
          error.code === "42P01" ||
          error.message?.toLowerCase().includes("veiculos") ||
          error.message?.toLowerCase().includes("does not exist");

        if (isMissingTable) {
          setVehiclesUnavailable(true);
          setVehicles([]);
          return;
        }

        console.error("Erro ao buscar veículos:", error);
        toast.error("Erro ao buscar veículos.");
      } else {
        setVehiclesUnavailable(false);
        setVehicles(data || []);
      }
    };

    fetchVehicles();

    const vehiclesChannel = supabase
      .channel("veiculos-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "veiculos" },
        () => {
          fetchVehicles();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(vehiclesChannel);
    };
  }, [supabase]);

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validações de campos obrigatórios
      if (!formData.name.trim()) {
        toast.error("Nome completo é obrigatório.");
        setIsSubmitting(false);
        return;
      }

      if (!/^\S+(?:\s+\S+)+$/.test(formData.name.trim())) {
        toast.error("Nome completo deve conter pelo menos nome e sobrenome.");
        setIsSubmitting(false);
        return;
      }

      if (!validateCPF(formData.cpf)) {
        toast.error("CPF inválido. Verifique os dígitos informados.");
        setIsSubmitting(false);
        return;
      }

      if (!validateCelular(formData.celular)) {
        toast.error(
          "Celular inválido. Use um número real com DDD brasileiro. Ex: (11) 91234-5678",
        );
        setIsSubmitting(false);
        return;
      }

      if (formData.vinculo_tipo === "parceiro" && !formData.parceiro_id) {
        toast.error("Selecione o parceiro de serviço primeiro.");
        setIsSubmitting(false);
        return;
      }

      if (formData.vehicle_ids.length === 0) {
        toast.error("Adicione pelo menos um veículo ao motorista.");
        setIsSubmitting(false);
        return;
      }

      const duplicateMessage = getDuplicateDriverMessage(formData);

      if (duplicateMessage) {
        toast.error(duplicateMessage);
        setIsSubmitting(false);
        return;
      }

      const insertData: Record<string, unknown> = {
        name: formData.name.trim(),
        cpf: formData.cpf.replace(/\D/g, "").trim(),
        phone: normalizeBrazilPhone(formData.celular),
        vehicle_id: formData.vehicle_ids[0],
        status: "active",
        vinculo_tipo: formData.vinculo_tipo,
      };

      // Só adiciona parceiro_id se for de parceiro
      if (formData.vinculo_tipo === "parceiro" && formData.parceiro_id) {
        insertData.parceiro_id = formData.parceiro_id;
      } else {
        insertData.parceiro_id = null;
      }

      const { data, error } = await supabase
        .from("drivers")
        .insert([insertData])
        .select("*")
        .single();

      if (error) throw error;

      // Inserir veículos vinculados
      if (data && formData.vehicle_ids.length > 0) {
        const driverVehicles = formData.vehicle_ids.map((vehicleId) => ({
          driver_id: data.id,
          vehicle_id: vehicleId,
        }));

        const { error: vehiclesError } = await supabase
          .from("driver_vehicles")
          .insert(driverVehicles);

        if (vehiclesError) {
          console.error("Erro ao vincular veículos:", vehiclesError);
          toast.error("Motorista criado, mas houve erro ao vincular veículos.");
        }

        await refreshData();
        void driversTable.refresh();
      } else if (data) {
        await refreshData();
        void driversTable.refresh();
      }

      setIsModalOpen(false);
      setFormData({
        name: "",
        cpf: "",
        celular: "",
        vinculo_tipo: "parceiro",
        parceiro_id: "",
        tipo_documento: "cpf",
        vehicle_ids: [],
      });
    } catch (error) {
      console.error("Erro ao salvar motorista:", error);

      if (error instanceof Error) {
        toast.error(error.message);
      } else if (error && typeof error === "object" && "message" in error) {
        toast.error(String(error.message));
      } else {
        toast.error("Erro ao salvar motorista.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = (driver: Driver) => {
    setEditingDriver(driver);
    // Extrair vehicle_ids do driver_vehicles (se existir) ou do vehicle_id legado
    const vehicleIds =
      driver.driver_vehicles?.map((dv) => dv.vehicle_id) ||
      (driver.vehicle_id ? [driver.vehicle_id] : []);

    setFormData({
      name: driver.name || "",
      cpf: formatDocumento(driver.cpf || "", "cpf"),
      celular: formatPhoneParceiro(driver.phone || ""),
      vinculo_tipo: driver.vinculo_tipo || "parceiro",
      parceiro_id: driver.parceiro_id || "",
      tipo_documento: "cpf",
      vehicle_ids: vehicleIds,
    });
  };

  const handleEditDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;
    setIsSubmitting(true);

    try {
      if (!formData.name.trim()) {
        toast.error("Nome completo é obrigatório.");
        setIsSubmitting(false);
        return;
      }

      if (!/^\S+(?:\s+\S+)+$/.test(formData.name.trim())) {
        toast.error("Nome completo deve conter pelo menos nome e sobrenome.");
        setIsSubmitting(false);
        return;
      }

      if (!validateCPF(formData.cpf)) {
        toast.error("CPF inválido. Verifique os dígitos informados.");
        setIsSubmitting(false);
        return;
      }

      if (!validateCelular(formData.celular)) {
        toast.error(
          "Celular inválido. Use um número real com DDD brasileiro. Ex: (11) 91234-5678",
        );
        setIsSubmitting(false);
        return;
      }

      if (formData.vinculo_tipo === "parceiro" && !formData.parceiro_id) {
        toast.error("Selecione o parceiro de serviço primeiro.");
        setIsSubmitting(false);
        return;
      }

      if (formData.vehicle_ids.length === 0) {
        toast.error("Adicione pelo menos um veículo ao motorista.");
        setIsSubmitting(false);
        return;
      }

      const duplicateMessage = getDuplicateDriverMessage(
        formData,
        editingDriver.id,
      );

      if (duplicateMessage) {
        toast.error(duplicateMessage);
        setIsSubmitting(false);
        return;
      }

      // Verificar se veículos removidos estão em uso em OS não concluídas
      const currentVehicleIds =
        editingDriver.driver_vehicles?.map((dv) => dv.vehicle_id) || [];
      const removedVehicleIds = currentVehicleIds.filter(
        (id) => !formData.vehicle_ids.includes(id),
      );

      if (removedVehicleIds.length > 0) {
        const { data: blockingOS } = await supabase
          .from("ordens_servico")
          .select("id, protocolo, status_operacional, veiculo_id")
          .eq("arquivado", false)
          .or(
            `driver_id.eq.${editingDriver.id},and(driver_id.is.null,motorista.eq.${editingDriver.name})`,
          )
          .in("veiculo_id", removedVehicleIds)
          .in("status_operacional", ["Pendente", "Aguardando", "Em Rota"])
          .limit(1);

        if (blockingOS && blockingOS.length > 0) {
          toast.error(
            `Não é possível desvincular veículo(s). Existe atendimento em aberto (OS ${blockingOS[0].protocolo || blockingOS[0].id}) vinculado a este motorista.`,
            { duration: 6000 },
          );
          setIsSubmitting(false);
          return;
        }
      }

      const updateData: Record<string, unknown> = {
        name: formData.name.trim(),
        cpf: formData.cpf.replace(/\D/g, "").trim(),
        phone: normalizeBrazilPhone(formData.celular),
        vehicle_id: formData.vehicle_ids[0],
        vinculo_tipo: formData.vinculo_tipo,
        parceiro_id:
          formData.vinculo_tipo === "parceiro" ? formData.parceiro_id : null,
      };

      const { data, error } = await supabase
        .from("drivers")
        .update(updateData)
        .select("*")
        .eq("id", editingDriver.id)
        .single();

      if (error) throw error;

      // Atualizar veículos vinculados via RPC atômica
      if (data) {
        const vehicleIds = formData.vehicle_ids.map((id: string) => id);
        const { error: vehiclesError } = await supabase.rpc(
          "update_driver_vehicles_atomic",
          {
            p_driver_id: editingDriver.id,
            p_vehicle_ids: vehicleIds.length > 0 ? vehicleIds : [],
          },
        );

        if (vehiclesError) {
          console.error("Erro ao vincular veículos:", vehiclesError);
          toast.error(
            "Motorista atualizado, mas houve erro ao vincular veículos.",
          );
        }

        await refreshData();
        void driversTable.refresh();
      }

      toast.success("Motorista atualizado com sucesso!");
      setEditingDriver(null);
      setFormData({
        name: "",
        cpf: "",
        celular: "",
        vinculo_tipo: "parceiro",
        parceiro_id: "",
        tipo_documento: "cpf",
        vehicle_ids: [],
      });
    } catch (error) {
      console.error("Erro ao atualizar motorista:", error);

      if (error instanceof Error) {
        toast.error(error.message);
      } else if (error && typeof error === "object" && "message" in error) {
        toast.error(String(error.message));
      } else {
        toast.error("Erro ao atualizar motorista.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDriver = async (id: string) => {
    const driver = driversTable.items.find((d) => d.id === id);
    if (!driver) return;

    // Verificar se o motorista tem OS não concluídas (por driver_id ou pelo nome legado)
    const { data: pendingOS } = await supabase
      .from("ordens_servico")
      .select("id, protocolo, status_operacional")
      .eq("arquivado", false)
      .or(
        `driver_id.eq.${driver.id},and(driver_id.is.null,motorista.eq.${driver.name})`,
      )
      .in("status_operacional", ["Pendente", "Aguardando", "Em Rota"])
      .limit(1);

    if (pendingOS && pendingOS.length > 0) {
      toast.error(
        `Não é possível arquivar. O motorista possui atendimentos em aberto (OS ${pendingOS[0].protocolo || pendingOS[0].id}).`,
        { duration: 5000 },
      );
      return;
    }

    const confirmed = await confirm({
      title: "Arquivar Motorista",
      message: `Tem certeza que deseja arquivar o motorista "${driver.name}"? Ele não aparecerá mais na lista, mas poderá ser recuperado posteriormente.`,
      confirmText: "Sim, arquivar",
      cancelText: "Cancelar",
      type: "danger",
    });

    if (!confirmed) return;

    try {
      await deleteDriver(id);
      void driversTable.refresh();
      toast.success("Motorista arquivado com sucesso!");
    } catch (error) {
      console.error("Erro ao arquivar motorista:", error);
      toast.error("Erro ao arquivar motorista.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerenciamento de Motoristas"
        icon={<IdCard size={20} />}
      />

      {/* Drivers List */}
      <DataTable
        data={tableItems}
        loading={driversTable.loading}
        searchTerm={driversTable.searchTerm}
        onSearchChange={(value) => {
          driversTable.setSearchTerm(value);
          setClientPage(1);
        }}
        disableClientSearch
        headerContent={
          showAdvancedFilters && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-600">
                  Filtros Avançados
                </h3>
                {hasActiveAdvancedFilters && (
                  <button
                    onClick={() => {
                      setAdvancedFilters(defaultAdvancedFilters);
                      setClientPage(1);
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <GeologSearchableSelect
                  label="Tipo de Veículo"
                  options={[{ id: "", nome: "Todos" }, ...TIPOS_VEICULO]}
                  value={advancedFilters.tipoVeiculo}
                  onChange={(id) => {
                    setAdvancedFilters((prev) => ({
                      ...prev,
                      tipoVeiculo: id,
                      veiculoId: "",
                    }));
                    setClientPage(1);
                  }}
                  compact
                  disableSearch={false}
                />
                <GeologSearchableSelect
                  label="Veículo"
                  options={[
                    { id: "", nome: "Todos" },
                    ...vehicles.map((v) => ({
                      id: v.id,
                      nome: `${v.marca} ${v.modelo} — ${v.placa}`,
                    })),
                  ]}
                  value={advancedFilters.veiculoId}
                  onChange={(id) => {
                    setAdvancedFilters((prev) => ({ ...prev, veiculoId: id }));
                    setClientPage(1);
                  }}
                  compact
                  disableSearch={false}
                />
                <GeologSearchableSelect
                  label="Vínculo"
                  options={[
                    { id: "", nome: "Todos" },
                    { id: "interno", nome: "Interno" },
                    { id: "autonomo", nome: "Autônomo" },
                    { id: "parceiro", nome: "Parceiro" },
                  ]}
                  value={advancedFilters.vinculoTipo}
                  onChange={(id) => {
                    setAdvancedFilters((prev) => ({
                      ...prev,
                      vinculoTipo: id as AdvancedFilters["vinculoTipo"],
                    }));
                    setClientPage(1);
                  }}
                  compact
                  disableSearch={false}
                />
                <GeologSearchableSelect
                  label="Status"
                  options={[
                    { id: "", nome: "Todos" },
                    { id: "active", nome: "Ativo" },
                    { id: "inactive", nome: "Arquivado" },
                  ]}
                  value={advancedFilters.status}
                  onChange={(id) => {
                    setAdvancedFilters((prev) => ({
                      ...prev,
                      status: id as AdvancedFilters["status"],
                    }));
                    setClientPage(1);
                  }}
                  compact
                  disableSearch={false}
                />
              </div>
            </div>
          )
        }
        pagination={
          hasActiveAdvancedFilters
            ? {
                page: clientPage,
                pageSize: clientPageSize,
                totalItems: tableTotalCount,
                onPageChange: setClientPage,
              }
            : {
                page: driversTable.page,
                pageSize: driversTable.pageSize,
                totalItems: driversTable.totalCount,
                onPageChange: driversTable.setPage,
              }
        }
        actionButton={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              className={`flex items-center gap-2 px-4 py-3.5 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all shadow-sm border cursor-pointer shrink-0 ${
                hasActiveAdvancedFilters || showAdvancedFilters
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {hasActiveAdvancedFilters ? (
                <Filter size={16} />
              ) : (
                <FilterX size={16} />
              )}
              Filtros
              {hasActiveAdvancedFilters && (
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 bg-blue-600 text-white text-[10px] font-black rounded-full">
                  {
                    [
                      advancedFilters.tipoVeiculo,
                      advancedFilters.veiculoId,
                      advancedFilters.vinculoTipo,
                      advancedFilters.status,
                    ].filter(Boolean).length
                  }
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setFormData({
                  name: "",
                  cpf: "",
                  celular: "",
                  vinculo_tipo: "parceiro",
                  parceiro_id: "",
                  tipo_documento: "cpf",
                  vehicle_ids: [],
                });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-[var(--color-geolog-blue)] text-white px-5 py-3.5 rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer shadow-lg shadow-blue-900/20 whitespace-nowrap"
            >
              <UserPlus size={18} />
              Novo Motorista
            </button>
          </div>
        }
        columns={[
          {
            key: "name",
            title: "Motorista",
            render: (value: unknown, item: Driver) => (
              <div className="space-y-1">
                <p className="font-black text-base text-slate-800 tracking-tight uppercase">
                  {String(value)}
                </p>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide border ${
                    item.vinculo_tipo === "interno"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : item.vinculo_tipo === "autonomo"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-teal-50 text-teal-700 border-teal-200"
                  }`}
                >
                  {item.vinculo_tipo === "interno"
                    ? "Interno"
                    : item.vinculo_tipo === "autonomo"
                      ? "Autônomo"
                      : "Parceiro"}
                </span>
              </div>
            ),
          },
          {
            key: "veiculo",
            title: "Veículos",
            render: (value: unknown, item: Driver) => {
              void value;
              const vehicleCount = item.driver_vehicles?.length || 0;
              const firstVehicle =
                item.driver_vehicles?.[0]?.vehicle ||
                vehicles.find((v) => v.id === item.vehicle_id);

              if (vehicleCount === 0) {
                return (
                  <span className="inline-flex items-center px-3 py-1 rounded-lg bg-red-100 text-red-700 font-black text-sm border border-red-200">
                    Sem Veículo
                  </span>
                );
              }

              return (
                <div className="space-y-1">
                  <p className="font-black text-base text-slate-800 tracking-tight">
                    {firstVehicle?.modelo || "Veículo"}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-400">
                      {firstVehicle?.placa || "—"} •{" "}
                      {firstVehicle?.marca || "—"}
                    </p>
                    {vehicleCount > 1 && (
                      <span
                        onClick={() => setViewingDriver(item)}
                        className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs font-black border border-blue-200 cursor-pointer hover:bg-blue-200 hover:text-blue-800 transition-colors"
                      >
                        +{vehicleCount - 1}
                      </span>
                    )}
                  </div>
                </div>
              );
            },
          },
          {
            key: "documentos",
            title: "Documentos",
            render: (value: unknown, item: Driver) => {
              void value;

              return (
                <div className="space-y-1">
                  <p className="text-base font-medium text-slate-500">
                    <span className="font-semibold">CPF:</span>{" "}
                    <span className="text-slate-600 font-normal">
                      {formatDocumento(item.cpf || "", "cpf")}
                    </span>
                  </p>
                </div>
              );
            },
          },
          {
            key: "phone",
            title: "Contato",
            render: (value: unknown) => (
              <div className="flex items-center gap-2 text-slate-700">
                <Phone size={14} className="text-cyan-500" />
                <span className="text-base font-bold">
                  {formatCelular(String(value))}
                </span>
              </div>
            ),
          },
          {
            key: "status",
            title: "Status",
            align: "center",
            render: () => (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs md:text-sm font-bold uppercase tracking-wide border bg-green-100 text-green-700 border-green-200">
                ATIVO
              </span>
            ),
          },
          {
            key: "acoes",
            title: "Ações",
            align: "center",
            render: (value: unknown, item: Driver) => {
              void value;

              return (
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => setViewingDriver(item)}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                    title="Visualizar Motorista"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(item)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                    title="Editar Motorista"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => setSelectedDriverForDocs(item)}
                    className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-all cursor-pointer relative"
                    title="Documentações"
                  >
                    <FileText size={18} />
                    {typeof item.docsCount === "number" &&
                      item.docsCount > 0 && (
                        <span className="absolute top-0 right-0 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-900 px-1 text-[10px] font-bold text-white">
                          {item.docsCount}
                        </span>
                      )}
                  </button>
                  <button
                    onClick={() => handleDeleteDriver(item.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                    title="Excluir Motorista"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            },
          },
        ]}
        searchPlaceholder="Buscar por nome ou CPF..."
        emptyMessage="Nenhum motorista encontrado."
        emptyIcon={<Truck size={48} />}
      />

      {/* Modal de Cadastro */}
      {isModalOpen && (
        <StandardModal
          onClose={() => {
            setIsModalOpen(false);
            setFormData({
              name: "",
              cpf: "",
              celular: "",
              vinculo_tipo: "parceiro",
              parceiro_id: "",
              tipo_documento: "cpf",
              vehicle_ids: [],
            });
          }}
          title="Novo Motorista"
          subtitle="Cadastro de condutor para a frota Geolog"
          icon={<UserPlus size={24} />}
          maxWidthClassName="max-w-6xl"
          bodyClassName="p-6 md:p-10 pb-16 space-y-12"
        >
          <form onSubmit={handleAddDriver} noValidate className="space-y-12">
            <section className="space-y-6">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <IdCard size={20} className="text-slate-500" /> Informações do
                  Motorista
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="space-y-2 w-full md:w-[45%]">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      Nome completo{" "}
                      <span className="text-rose-300 text-base">*</span>
                    </label>
                    <input
                      required
                      pattern=".*\s+\S.*"
                      title="Nome completo deve conter pelo menos nome e sobrenome."
                      placeholder="Ex: João Silva da Rocha"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          name: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 w-full md:w-48">
                    <GeologSearchableSelect
                      label="Tipo"
                      options={tipoDocumentoOptions}
                      value={formData.tipo_documento}
                      onChange={(value) =>
                        setFormData({
                          ...formData,
                          tipo_documento: value as "cpf" | "passaporte",
                          cpf: formatDocumento(
                            formData.cpf,
                            value as "cpf" | "passaporte",
                          ),
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2 w-full md:w-40">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      {getDocumentoLabel(formData.tipo_documento)}{" "}
                      <span className="text-rose-300 text-base">*</span>
                    </label>
                    <input
                      required
                      pattern={
                        formData.tipo_documento === "cpf"
                          ? "\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}"
                          : undefined
                      }
                      title={
                        formData.tipo_documento === "cpf"
                          ? "CPF incompleto. Use o formato 000.000.000-00"
                          : undefined
                      }
                      placeholder={getDocumentoPlaceholder(
                        formData.tipo_documento,
                      )}
                      value={formData.cpf}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cpf: formatDocumento(
                            e.target.value,
                            formData.tipo_documento,
                          ),
                        })
                      }
                      className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 w-full md:w-44">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      Celular <span className="text-rose-300 text-base">*</span>
                    </label>
                    <input
                      required
                      title="Celular incompleto. Use o formato (00) 00000-0000"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(00) 9XXXX-XXXX"
                      value={formatCelular(formData.celular)}
                      onChange={(e) => {
                        const digitsOnly = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 11);
                        setFormData({ ...formData, celular: digitsOnly });
                      }}
                      className={`w-full px-4 py-4 bg-slate-50 border-2 rounded-xl font-bold text-base text-slate-900 outline-none focus:bg-white transition-all shadow-sm ${
                        formData.celular && !validateCelular(formData.celular)
                          ? "border-red-500 focus:border-red-500"
                          : "border-slate-200 focus:border-blue-600"
                      }`}
                    />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-6 items-start w-full">
                  <div className="flex flex-wrap gap-3 w-full md:w-[45%]">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          vinculo_tipo: "interno",
                          parceiro_id: "",
                          tipo_documento: "cpf",
                        })
                      }
                      className={`cursor-pointer flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 font-black text-sm uppercase tracking-widest transition-all whitespace-nowrap ${
                        formData.vinculo_tipo === "interno"
                          ? "bg-blue-600 border-blue-600 text-white shadow-md"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600"
                      }`}
                    >
                      <Building2 size={16} /> Interno
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          vinculo_tipo: "autonomo",
                          parceiro_id: "",
                          tipo_documento: "cpf",
                        })
                      }
                      className={`cursor-pointer flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 font-black text-sm uppercase tracking-widest transition-all whitespace-nowrap ${
                        formData.vinculo_tipo === "autonomo"
                          ? "bg-amber-500 border-amber-500 text-white shadow-md"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600"
                      }`}
                    >
                      <User size={16} /> Autônomo
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          vinculo_tipo: "parceiro",
                          parceiro_id: "",
                          tipo_documento: "cpf",
                        })
                      }
                      className={`cursor-pointer flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 font-black text-sm uppercase tracking-widest transition-all whitespace-nowrap ${
                        formData.vinculo_tipo === "parceiro"
                          ? "bg-teal-500 border-teal-500 text-white shadow-md"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:border-teal-300 hover:text-teal-600"
                      }`}
                    >
                      <Handshake size={16} /> Parceiro
                    </button>
                  </div>

                  <div className="flex-[1.5] w-full min-h-[84px]">
                    {formData.vinculo_tipo === "parceiro" && (
                      <div className="w-full animate-in fade-in slide-in-from-left-2 duration-300">
                        <GeologSearchableSelect
                          label=""
                          options={parceiroOptions}
                          value={formData.parceiro_id}
                          onChange={(value) =>
                            setFormData({
                              ...formData,
                              parceiro_id: value,
                              vehicle_ids: [],
                            })
                          }
                          placeholder="Selecione o parceiro de serviço..."
                          onQuickAdd={handleQuickParceiroOpen}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Seção de Veículos Vinculados */}
            <section className="space-y-6">
              <div
                className="flex items-center justify-between border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <Truck size={20} className="text-slate-500" /> Veículos
                  Vinculados
                </h3>
                <button
                  type="button"
                  onClick={handleAddVehicle}
                  disabled={availableVehicles.length === 0}
                  className="flex items-center gap-3 px-4 py-3 bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-200 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlusCircle size={14} /> Adicionar veículo
                </button>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="hidden md:grid grid-cols-[2fr_2fr_auto] gap-4 bg-slate-50/80 border-b border-slate-200 px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-600">
                  <span>Veículo</span>
                  <span className="ml-8">Placa</span>
                  <span className="text-right">Ações</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[30vh] overflow-y-auto custom-scrollbar">
                  {formData.vehicle_ids.length === 0 && (
                    <div className="px-6 py-8 text-center text-slate-400 text-sm">
                      Nenhum veículo vinculado. Clique em &quot;Adicionar
                      veículo&quot; acima.
                    </div>
                  )}
                  {formData.vehicle_ids.map((vehicleId, index) => {
                    const vehicle = vehicles.find((v) => v.id === vehicleId);
                    const availableVehiclesForThisRow = filteredVehicles.filter(
                      (v) =>
                        v.id === vehicleId ||
                        !formData.vehicle_ids.includes(v.id),
                    );
                    return (
                      <div
                        key={index}
                        className="grid grid-cols-1 md:grid-cols-[2fr_2fr_auto] gap-4 items-center px-6 py-4"
                      >
                        <div className="space-y-2">
                          <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            Veículo
                          </label>
                          <GeologSearchableSelect
                            label=""
                            options={availableVehiclesForThisRow.map((v) => ({
                              id: v.id,
                              nome: `${v.marca} ${v.modelo}`,
                              sublabel: v.placa,
                            }))}
                            value={vehicleId}
                            onChange={(value) =>
                              handleVehicleChange(index, value)
                            }
                            placeholder="Selecione o veículo..."
                          />
                        </div>
                        <div className="space-y-1 ml-5">
                          <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            Placa
                          </label>
                          <div className="w-[120px] bg-white border-2 border-slate-400 rounded-md overflow-hidden shadow-sm flex flex-col items-center">
                            <div className="w-full bg-blue-600 h-1" />
                            <div className="py-3 px-4 flex items-center justify-center">
                              <span className="text-[15px] font-black text-slate-900 uppercase tracking-widest leading-none">
                                {vehicle?.placa || "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (!vehicleId) return;
                              const v = vehicles.find(
                                (veh) => veh.id === vehicleId,
                              );
                              if (!v) return;
                              setVehicleQuickForm({
                                placa: v.placa,
                                modelo: v.modelo,
                                marca: v.marca,
                                tipo: "carro",
                              });
                              setQuickVehicleModal({
                                mode: "edit",
                                rowIndex: index,
                                vehicleId: v.id,
                              });
                            }}
                            disabled={!vehicleId}
                            className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Editar veículo"
                            title="Editar veículo"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVehicleQuickForm({
                                placa: "",
                                modelo: "",
                                marca: "",
                                tipo: "carro",
                              });
                              setQuickVehicleModal({
                                mode: "create",
                                rowIndex: index,
                              });
                            }}
                            className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all cursor-pointer"
                            aria-label="Cadastrar novo veículo"
                            title="Cadastrar novo veículo"
                          >
                            <Car size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveVehicle(index)}
                            className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            aria-label="Remover veículo"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-12 py-4 bg-green-600 text-white font-black rounded-xl shadow-xl shadow-green-900/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  "Salvar motorista"
                )}
              </button>
            </div>
          </form>
        </StandardModal>
      )}

      {/* Modal de Visualização */}
      {viewingDriver && (
        <StandardModal
          onClose={() => setViewingDriver(null)}
          title={viewingDriver.name}
          subtitle={`${viewingDriver.vinculo_tipo === "interno" ? "Motorista Interno" : viewingDriver.vinculo_tipo === "autonomo" ? "Motorista Autônomo" : "Motorista de Parceiro"} · ${viewingDriver.status === "active" ? "Ativo" : "Inativo"}`}
          icon={<User size={24} />}
          maxWidthClassName="max-w-3xl"
          bodyClassName="p-6 md:p-10 pb-10 space-y-8"
        >
          <div className="space-y-6">
            <h3 className="text-[13px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <IdCard size={14} className="text-blue-500" /> Dados Pessoais
            </h3>
            <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 py-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                      CPF
                    </p>
                    <p className="text-base font-bold text-slate-800">
                      {formatDocumento(viewingDriver.cpf || "", "cpf") || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                      Celular
                    </p>
                    <p className="text-base font-bold text-slate-800">
                      {viewingDriver.phone
                        ? formatCelular(viewingDriver.phone)
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-[13px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Truck size={14} className="text-blue-500" /> Veículos Vinculados
            </h3>
            <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {(() => {
                  const driverVehicles = viewingDriver.driver_vehicles || [];
                  const legacyVehicleId = viewingDriver.vehicle_id;
                  const allVehicles =
                    driverVehicles.length > 0
                      ? driverVehicles
                          .map(
                            (dv) =>
                              dv.vehicle ||
                              vehicles.find((v) => v.id === dv.vehicle_id),
                          )
                          .filter(Boolean)
                      : legacyVehicleId
                        ? [vehicles.find((v) => v.id === legacyVehicleId)]
                        : [];

                  if (allVehicles.length === 0) {
                    return (
                      <div className="px-6 py-4">
                        <p className="text-base font-bold text-slate-400">
                          Sem veículos vinculados
                        </p>
                      </div>
                    );
                  }

                  return allVehicles.map((vehicle, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 py-4"
                    >
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                          Veículo {index + 1}
                        </p>
                        <p className="text-base font-bold text-slate-800">
                          {vehicle?.marca} {vehicle?.modelo}
                        </p>
                      </div>
                      <div className="ml-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                          Placa
                        </p>
                        <div className="w-[120px] bg-white border-2 border-slate-400 rounded-md overflow-hidden shadow-sm flex flex-col items-center">
                          <div className="w-full bg-blue-600 h-1" />
                          <div className="py-3 px-4 flex items-center justify-center">
                            <span className="text-[15px] font-black text-slate-900 uppercase tracking-widest leading-none">
                              {vehicle?.placa || "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-[13px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Handshake size={14} className="text-blue-500" /> Vínculo
            </h3>
            <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 py-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                      Tipo de Vínculo
                    </p>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${
                        viewingDriver.vinculo_tipo === "interno"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : viewingDriver.vinculo_tipo === "autonomo"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-teal-50 text-teal-700 border-teal-200"
                      }`}
                    >
                      {viewingDriver.vinculo_tipo === "interno" ? (
                        <Building2 size={12} />
                      ) : viewingDriver.vinculo_tipo === "autonomo" ? (
                        <User size={12} />
                      ) : (
                        <Handshake size={12} />
                      )}
                      {viewingDriver.vinculo_tipo === "interno"
                        ? "Interno"
                        : viewingDriver.vinculo_tipo === "autonomo"
                          ? "Autônomo"
                          : "Parceiro"}
                    </span>
                  </div>
                  {(viewingDriver.vinculo_tipo === "parceiro" ||
                    viewingDriver.vinculo_tipo === "autonomo") &&
                    viewingDriver.parceiro_id && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                          Parceiro
                        </p>
                        <p className="text-base font-bold text-slate-800">
                          {parceiros.find(
                            (p: ParceiroServico) =>
                              p.id === viewingDriver.parceiro_id,
                          )?.razaoSocialOuNomeCompleto || "—"}
                        </p>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                const d = viewingDriver;
                setViewingDriver(null);
                handleOpenEditModal(d);
              }}
              className="px-6 py-3 bg-blue-50 text-blue-700 font-black rounded-xl hover:bg-blue-100 transition-all text-sm uppercase tracking-widest cursor-pointer flex items-center gap-2"
            >
              <Edit2 size={14} /> Editar
            </button>
            <button
              type="button"
              onClick={() => setViewingDriver(null)}
              className="px-8 py-3 bg-slate-100 text-slate-700 font-black rounded-xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </StandardModal>
      )}

      {/* Modal de Edição */}
      {editingDriver && (
        <StandardModal
          onClose={() => {
            setEditingDriver(null);
            setFormData({
              name: "",
              cpf: "",
              celular: "",
              vinculo_tipo: "parceiro",
              parceiro_id: "",
              tipo_documento: "cpf",
              vehicle_ids: [],
            });
          }}
          title="Editar Motorista"
          subtitle={`Editando: ${editingDriver.name}`}
          icon={<Edit2 size={24} />}
          maxWidthClassName="max-w-6xl"
          bodyClassName="p-6 md:p-10 pb-16 space-y-12"
        >
          <form onSubmit={handleEditDriver} noValidate className="space-y-12">
            <section className="space-y-6">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <IdCard size={20} className="text-slate-500" /> Informações do
                  Motorista
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="space-y-2 w-full md:w-[45%]">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      Nome completo{" "}
                      <span className="text-rose-300 text-base">*</span>
                    </label>
                    <input
                      required
                      pattern=".*\s+\S.*"
                      title="Nome completo deve conter pelo menos nome e sobrenome."
                      placeholder="Ex: João Silva da Rocha"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          name: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 w-full md:w-48">
                    <GeologSearchableSelect
                      label="Tipo"
                      options={tipoDocumentoOptions}
                      value={formData.tipo_documento}
                      onChange={(value) =>
                        setFormData({
                          ...formData,
                          tipo_documento: value as "cpf" | "passaporte",
                          cpf: formatDocumento(
                            formData.cpf,
                            value as "cpf" | "passaporte",
                          ),
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2 w-full md:w-40">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      {getDocumentoLabel(formData.tipo_documento)}{" "}
                      <span className="text-rose-300 text-base">*</span>
                    </label>
                    <input
                      required
                      pattern={
                        formData.tipo_documento === "cpf"
                          ? "\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}"
                          : undefined
                      }
                      title={
                        formData.tipo_documento === "cpf"
                          ? "CPF incompleto. Use o formato 000.000.000-00"
                          : undefined
                      }
                      placeholder={getDocumentoPlaceholder(
                        formData.tipo_documento,
                      )}
                      value={formData.cpf}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cpf: formatDocumento(
                            e.target.value,
                            formData.tipo_documento,
                          ),
                        })
                      }
                      className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 w-full md:w-44">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                      Celular <span className="text-rose-300 text-base">*</span>
                    </label>
                    <input
                      required
                      title="Celular incompleto. Use o formato (00) 00000-0000"
                      placeholder="(00) 9XXXX-XXXX"
                      value={formatCelular(formData.celular)}
                      onChange={(e) => {
                        const digitsOnly = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 11);
                        setFormData({ ...formData, celular: digitsOnly });
                      }}
                      className={`w-full px-4 py-4 bg-slate-50 border-2 rounded-xl font-bold text-base text-slate-900 outline-none focus:bg-white transition-all shadow-sm ${
                        formData.celular && !validateCelular(formData.celular)
                          ? "border-red-500 focus:border-red-500"
                          : "border-slate-200 focus:border-blue-600"
                      }`}
                    />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-6 items-start w-full">
                  <div className="flex flex-wrap gap-3 w-full md:w-[45%]">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          vinculo_tipo: "interno",
                          parceiro_id: "",
                          tipo_documento: "cpf",
                        })
                      }
                      className={`cursor-pointer flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 font-black text-sm uppercase tracking-widest transition-all whitespace-nowrap ${
                        formData.vinculo_tipo === "interno"
                          ? "bg-blue-600 border-blue-600 text-white shadow-md"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600"
                      }`}
                    >
                      <Building2 size={16} /> Interno
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          vinculo_tipo: "autonomo",
                          parceiro_id: "",
                          tipo_documento: "cpf",
                        })
                      }
                      className={`cursor-pointer flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 font-black text-sm uppercase tracking-widest transition-all whitespace-nowrap ${
                        formData.vinculo_tipo === "autonomo"
                          ? "bg-amber-500 border-amber-500 text-white shadow-md"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600"
                      }`}
                    >
                      <User size={16} /> Autônomo
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          vinculo_tipo: "parceiro",
                          parceiro_id: "",
                          tipo_documento: "cpf",
                        })
                      }
                      className={`cursor-pointer flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 font-black text-sm uppercase tracking-widest transition-all whitespace-nowrap ${
                        formData.vinculo_tipo === "parceiro"
                          ? "bg-teal-500 border-teal-500 text-white shadow-md"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:border-teal-300 hover:text-teal-600"
                      }`}
                    >
                      <Handshake size={16} /> Parceiro
                    </button>
                  </div>

                  <div className="flex-[1.5] w-full min-h-[84px]">
                    {formData.vinculo_tipo === "parceiro" && (
                      <div className="w-full animate-in fade-in slide-in-from-left-2 duration-300">
                        <GeologSearchableSelect
                          label=""
                          options={parceiroOptions}
                          value={formData.parceiro_id}
                          onChange={(value) =>
                            setFormData({
                              ...formData,
                              parceiro_id: value,
                              vehicle_ids: [],
                            })
                          }
                          placeholder="Selecione o parceiro de serviço..."
                          onQuickAdd={handleQuickParceiroOpen}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Seção de Veículos Vinculados */}
            <section className="space-y-6">
              <div
                className="flex items-center justify-between border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <Truck size={20} className="text-slate-500" /> Veículos
                  Vinculados
                </h3>
                <button
                  type="button"
                  onClick={handleAddVehicle}
                  disabled={availableVehicles.length === 0}
                  className="flex items-center gap-3 px-4 py-3 bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-200 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlusCircle size={14} /> Adicionar veículo
                </button>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="hidden md:grid grid-cols-[2fr_2fr_auto] gap-4 bg-slate-50/80 border-b border-slate-200 px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-600">
                  <span>Veículo</span>
                  <span className="ml-8">Placa</span>
                  <span className="text-right">Ações</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[30vh] overflow-y-auto custom-scrollbar">
                  {formData.vehicle_ids.length === 0 && (
                    <div className="px-6 py-8 text-center text-slate-400 text-sm">
                      Nenhum veículo vinculado. Clique em &quot;Adicionar
                      veículo&quot; acima.
                    </div>
                  )}
                  {formData.vehicle_ids.map((vehicleId, index) => {
                    const vehicle = vehicles.find((v) => v.id === vehicleId);
                    const availableVehiclesForThisRow = filteredVehicles.filter(
                      (v) =>
                        v.id === vehicleId ||
                        !formData.vehicle_ids.includes(v.id),
                    );
                    return (
                      <div
                        key={index}
                        className="grid grid-cols-1 md:grid-cols-[2fr_2fr_auto] gap-4 items-center px-6 py-4"
                      >
                        <div className="space-y-2">
                          <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            Veículo
                          </label>
                          <GeologSearchableSelect
                            label=""
                            options={availableVehiclesForThisRow.map((v) => ({
                              id: v.id,
                              nome: `${v.marca} ${v.modelo}`,
                              sublabel: v.placa,
                            }))}
                            value={vehicleId}
                            onChange={(value) =>
                              handleVehicleChange(index, value)
                            }
                            placeholder="Selecione o veículo..."
                          />
                        </div>
                        <div className="space-y-1 ml-5">
                          <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            Placa
                          </label>
                          <div className="w-[120px] bg-white border-2 border-slate-400 rounded-md overflow-hidden shadow-sm flex flex-col items-center">
                            <div className="w-full bg-blue-600 h-1" />
                            <div className="py-3 px-4 flex items-center justify-center">
                              <span className="text-[15px] font-black text-slate-900 uppercase tracking-widest leading-none">
                                {vehicle?.placa || "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (!vehicleId) return;
                              const v = vehicles.find(
                                (veh) => veh.id === vehicleId,
                              );
                              if (!v) return;
                              setVehicleQuickForm({
                                placa: v.placa,
                                modelo: v.modelo,
                                marca: v.marca,
                                tipo: "carro",
                              });
                              setQuickVehicleModal({
                                mode: "edit",
                                rowIndex: index,
                                vehicleId: v.id,
                              });
                            }}
                            disabled={!vehicleId}
                            className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Editar veículo"
                            title="Editar veículo"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVehicleQuickForm({
                                placa: "",
                                modelo: "",
                                marca: "",
                                tipo: "carro",
                              });
                              setQuickVehicleModal({
                                mode: "create",
                                rowIndex: index,
                              });
                            }}
                            className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all cursor-pointer"
                            aria-label="Cadastrar novo veículo"
                            title="Cadastrar novo veículo"
                          >
                            <Car size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveVehicle(index)}
                            className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            aria-label="Remover veículo"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-12 py-4 bg-blue-600 text-white font-black rounded-xl shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  "Atualizar motorista"
                )}
              </button>
            </div>
          </form>
        </StandardModal>
      )}

      {quickVehicleModal && (
        <StandardModal
          onClose={() => setQuickVehicleModal(null)}
          title={
            quickVehicleModal.mode === "create"
              ? "Cadastrar Veículo"
              : "Editar Veículo"
          }
          subtitle={
            quickVehicleModal.mode === "create"
              ? "Cadastro rápido de novo veículo"
              : "Editar informações do veículo"
          }
          icon={<Car size={24} />}
          maxWidthClassName="max-w-6xl"
        >
          <form onSubmit={handleQuickVehicleSave} className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <div className="w-[140px] space-y-2 flex-shrink-0">
                <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                  Placa <RequiredAsterisk />
                </label>
                <input
                  required
                  value={vehicleQuickForm.placa}
                  onChange={(e) =>
                    setVehicleQuickForm({
                      ...vehicleQuickForm,
                      placa: formatarPlacaQuick(e.target.value),
                    })
                  }
                  className="max-w-[140px] px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[4px] h-[60px]"
                  placeholder="ABC-1234"
                  maxLength={8}
                />
              </div>
              <div className="w-[220px] space-y-2 flex-shrink-0">
                <GeologSearchableSelect
                  label="Marca"
                  options={MARCAS_VEICULOS}
                  value={vehicleQuickForm.marca}
                  onChange={(value) =>
                    setVehicleQuickForm({ ...vehicleQuickForm, marca: value })
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
                  value={vehicleQuickForm.modelo}
                  onChange={(e) =>
                    setVehicleQuickForm({
                      ...vehicleQuickForm,
                      modelo: e.target.value,
                    })
                  }
                  className="w-full px-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[4px] h-[60px]"
                  placeholder="Ex: Corolla"
                />
              </div>
              <div className="w-[180px] space-y-2 flex-shrink-0">
                <GeologSearchableSelect
                  label="Tipo"
                  options={TIPOS_VEICULO}
                  value={vehicleQuickForm.tipo}
                  onChange={(value) =>
                    setVehicleQuickForm({
                      ...vehicleQuickForm,
                      tipo: value as typeof vehicleQuickForm.tipo,
                    })
                  }
                  required
                  disableSearch
                  triggerClassName="mt-[9px] h-[60px]"
                />
              </div>
            </div>
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setQuickVehicleModal(null)}
                className="flex-1 py-4 border-2 border-slate-200 text-slate-500 font-black rounded-2xl hover:bg-slate-50 transition-all uppercase tracking-widest text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingVehicle}
                className="flex-1 py-4 bg-green-600 text-white font-black rounded-2xl hover:bg-green-500 shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 uppercase tracking-widest text-xs cursor-pointer"
              >
                {isSubmittingVehicle ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : quickVehicleModal.mode === "create" ? (
                  "Cadastrar"
                ) : (
                  "Salvar"
                )}
              </button>
            </div>
          </form>
        </StandardModal>
      )}

      {isQuickParceiroModalOpen && (
        <StandardModal
          onClose={() => setIsQuickParceiroModalOpen(false)}
          title="Novo Parceiro"
          subtitle="Cadastro rápido de parceiro de serviço"
          icon={<Handshake size={24} />}
          maxWidthClassName="max-w-6xl"
          bodyClassName="p-6 md:p-10 pb-16 space-y-8"
        >
          <form onSubmit={handleQuickParceiroSave} className="space-y-8">
            <section className="space-y-6">
              <div
                className="flex items-center border-b-2 border-slate-100 pb-4"
                style={{ paddingBottom: "1.25rem" }}
              >
                <h3
                  className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                  style={{ lineHeight: "1.3" }}
                >
                  <Building2 size={20} className="text-slate-500" /> Dados
                  principais
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[0.7fr_1.6fr_0.6fr] gap-6">
                <div className="space-y-2">
                  <GeologSearchableSelect
                    label="Tipo de pessoa"
                    options={PESSOA_TIPO_OPTIONS}
                    value={parceiroQuickForm.pessoaTipo}
                    onChange={(value) =>
                      handleParceiroPessoaTipoChange(
                        value as "fisica" | "juridica",
                      )
                    }
                    triggerClassName="px-5 py-3.5 !bg-slate-50 border-2 !border-slate-200 mt-[5px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                    {parceiroQuickForm.pessoaTipo === "juridica"
                      ? "Razão social"
                      : "Nome completo"}{" "}
                    <RequiredAsterisk />
                  </label>
                  <input
                    required
                    value={parceiroQuickForm.razaoSocialOuNomeCompleto}
                    onChange={(event) =>
                      handleParceiroInputChange(
                        "razaoSocialOuNomeCompleto",
                        event.target.value,
                      )
                    }
                    placeholder={
                      parceiroQuickForm.pessoaTipo === "juridica"
                        ? "Ex: Silva Logística LTDA"
                        : "Ex: João da Silva"
                    }
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm mt-[2px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                    {parceiroQuickForm.pessoaTipo === "juridica"
                      ? "CNPJ"
                      : "CPF"}{" "}
                    <RequiredAsterisk />
                  </label>
                  <input
                    required
                    value={parceiroQuickForm.documento}
                    onChange={(event) =>
                      handleParceiroInputChange("documento", event.target.value)
                    }
                    placeholder={
                      parceiroQuickForm.pessoaTipo === "juridica"
                        ? "00.000.000/0001-00"
                        : "000.000.000-00"
                    }
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                  />
                </div>
              </div>
            </section>

            <div className="border-b-2 border-slate-100 my-10"></div>

            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3
                    className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                    style={{ lineHeight: "1.3" }}
                  >
                    <Users size={20} className="text-blue-600" /> Contatos por
                    unidade
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleParceiroAddContato}
                  className="flex items-center gap-3 px-4 py-3 bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-200 transition-all shadow-sm cursor-pointer"
                >
                  <PlusCircle size={14} /> Novo cadastro
                </button>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="hidden md:grid grid-cols-[1.2fr_0.8fr_1.2fr_1.1fr_auto] gap-4 bg-slate-50/80 border-b border-slate-200 px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-600">
                  <span>Setor</span>
                  <span>Celular</span>
                  <span>E-mail</span>
                  <span>Responsável</span>
                  <span className="text-right">Ações</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto custom-scrollbar">
                  {parceiroQuickForm.contatos.map((contato, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_1.2fr_1.1fr_auto] gap-4 items-start px-6 py-5"
                    >
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Setor
                        </label>
                        <input
                          required
                          placeholder="Financeiro, Operação, Compras..."
                          value={contato.setor}
                          onChange={(event) =>
                            handleParceiroContatoChange(
                              index,
                              "setor",
                              event.target.value.toUpperCase(),
                            )
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Celular
                        </label>
                        <input
                          required
                          placeholder="(00) 00000-0000"
                          value={contato.celular}
                          onChange={(event) =>
                            handleParceiroContatoChange(
                              index,
                              "celular",
                              event.target.value,
                            )
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          E-mail
                        </label>
                        <input
                          type="email"
                          placeholder="contato@empresa.com"
                          value={contato.email || ""}
                          onChange={(event) =>
                            handleParceiroContatoChange(
                              index,
                              "email",
                              event.target.value.toLowerCase(),
                            )
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Responsável
                        </label>
                        <input
                          required
                          placeholder="Nome do responsável"
                          value={contato.responsavel}
                          onChange={(event) =>
                            handleParceiroContatoChange(
                              index,
                              "responsavel",
                              event.target.value.toUpperCase(),
                            )
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="flex md:pt-1 justify-end">
                        {parceiroQuickForm.contatos.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => handleParceiroRemoveContato(index)}
                            className="inline-flex items-center justify-center p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            aria-label="Remover contato"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 pt-3">
                            Principal
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="border-b-2 border-slate-100 my-10"></div>

            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3
                    className="text-[17px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-3"
                    style={{ lineHeight: "1.3" }}
                  >
                    <MapPin size={20} className="text-blue-600" /> Filiais /
                    endereços
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleParceiroAddFilial}
                  className="flex items-center gap-3 px-4 py-3 bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-200 transition-all shadow-sm cursor-pointer"
                >
                  <PlusCircle size={14} /> Nova filial
                </button>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="hidden md:grid grid-cols-[1.2fr_2fr_1fr_auto] gap-4 bg-slate-50/80 border-b border-slate-200 px-6 py-4 text-[12px] font-black uppercase tracking-widest text-slate-600">
                  <span>Rótulo</span>
                  <span>Endereço completo</span>
                  <span>Referência</span>
                  <span className="text-right">Ações</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto custom-scrollbar">
                  {parceiroQuickForm.filiais.map((filial, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-[1.2fr_2fr_1fr_auto] gap-4 items-start px-6 py-5"
                    >
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Rótulo
                        </label>
                        <input
                          placeholder="Matriz, Filial Centro, Depósito..."
                          value={filial.rotulo}
                          onChange={(event) =>
                            handleParceiroFilialChange(
                              index,
                              "rotulo",
                              event.target.value.toUpperCase(),
                            )
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Endereço completo
                        </label>
                        <input
                          placeholder="Rua, número, bairro, cidade - UF"
                          value={filial.enderecoCompleto}
                          onChange={(event) =>
                            handleParceiroFilialChange(
                              index,
                              "enderecoCompleto",
                              event.target.value,
                            )
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-2 md:space-y-1">
                        <label className="md:hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Referência
                        </label>
                        <input
                          placeholder="Portão azul, bloco B..."
                          value={filial.referencia || ""}
                          onChange={(event) =>
                            handleParceiroFilialChange(
                              index,
                              "referencia",
                              event.target.value,
                            )
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                      <div className="flex md:pt-1 justify-end">
                        {parceiroQuickForm.filiais.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => handleParceiroRemoveFilial(index)}
                            className="inline-flex items-center justify-center p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            aria-label="Remover filial"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 pt-3">
                            Principal
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsQuickParceiroModalOpen(false)}
                className="px-8 py-4 bg-slate-100 text-slate-700 font-black rounded-xl hover:bg-slate-200 transition-all text-sm uppercase tracking-widest cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingParceiro}
                className="px-12 py-4 bg-[var(--color-geolog-blue)] text-white font-black rounded-xl shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmittingParceiro ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  "Salvar parceiro"
                )}
              </button>
            </div>
          </form>
        </StandardModal>
      )}

      {selectedDriverForDocs && (
        <DriverDocsModal
          driver={selectedDriverForDocs}
          isOpen={true}
          onClose={() => setSelectedDriverForDocs(null)}
        />
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
