import type { Fornecedor } from "@/lib/supabase/queries";
import {
  validateCPF,
  validateCNPJ,
  validateCelular,
} from "@/lib/document-validator";
import { stripBrazilCountryCode } from "@/lib/phone";

interface FornecedorFormData {
  nome: string;
  pessoaTipo: "fisica" | "juridica";
  documento: string;
  telefone: string;
  telefoneFixo: string;
  email: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  observacoes: string;
}

interface ValidationError {
  field?: string;
  message: string;
}

export type { FornecedorFormData };

export function useFornecedorValidation(fornecedores: Fornecedor[]) {
  const validateForm = (
    formData: FornecedorFormData,
    editingFornecedorId?: string,
  ): ValidationError | null => {
    if (!formData.nome.trim()) {
      return {
        field: "nome",
        message:
          formData.pessoaTipo === "juridica"
            ? "Razão social é obrigatória"
            : "Nome completo é obrigatório",
      };
    }

    // Documento obrigatório
    if (!formData.documento.trim()) {
      return {
        field: "documento",
        message:
          formData.pessoaTipo === "juridica"
            ? "CNPJ é obrigatório"
            : "CPF é obrigatório",
      };
    }

    const documentoLimpo = formData.documento.replace(/\D/g, "");
    if (formData.pessoaTipo === "juridica") {
      if (documentoLimpo.length !== 14) {
        return { field: "documento", message: "CNPJ deve ter 14 dígitos" };
      }
      if (!validateCNPJ(formData.documento)) {
        return { field: "documento", message: "CNPJ inválido" };
      }
    } else {
      if (documentoLimpo.length !== 11) {
        return { field: "documento", message: "CPF deve ter 11 dígitos" };
      }
      if (!validateCPF(formData.documento)) {
        return { field: "documento", message: "CPF inválido" };
      }
    }

    // Verificar duplicidade de documento
    const existingFornecedor = fornecedores.find(
      (f) =>
        f.id !== editingFornecedorId &&
        f.documento.replace(/\D/g, "") === documentoLimpo,
    );
    if (existingFornecedor) {
      return {
        field: "documento",
        message: `Documento já está sendo usado pelo fornecedor "${existingFornecedor.nome}".`,
      };
    }

    // Celular (telefone) opcional, mas se preenchido deve ser válido
    if (formData.telefone.trim()) {
      const celularLimpo = stripBrazilCountryCode(formData.telefone);
      if (celularLimpo.length !== 11) {
        return {
          field: "telefone",
          message: "Celular deve ter 11 dígitos: (00) 00000-0000",
        };
      }
      if (!validateCelular(formData.telefone)) {
        return { field: "telefone", message: "Celular inválido" };
      }
    }

    // Telefone fixo opcional, mas se preenchido deve ter 10 dígitos
    if (formData.telefoneFixo.trim()) {
      const fixoLimpo = stripBrazilCountryCode(formData.telefoneFixo);
      if (fixoLimpo.length !== 10) {
        return {
          field: "telefoneFixo",
          message: "Telefone fixo deve ter 10 dígitos: (00) 0000-0000",
        };
      }
    }

    // E-mail opcional, mas se preenchido deve ser válido
    if (formData.email.trim()) {
      const emailRegex =
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!emailRegex.test(formData.email.trim())) {
        return { field: "email", message: "E-mail inválido" };
      }
    }

    // Estado: se preenchido, deve ter 2 caracteres
    if (formData.estado.trim() && formData.estado.trim().length !== 2) {
      return { field: "estado", message: "UF deve ter 2 letras" };
    }

    return null;
  };

  return { validateForm };
}
