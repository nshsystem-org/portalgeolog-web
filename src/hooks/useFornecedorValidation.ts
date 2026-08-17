import { useMemo } from "react";
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
  const documentosIndex = useMemo(() => {
    const docs = new Map<string, string>();
    fornecedores.forEach((f) => {
      const doc = f.documento.replace(/\D/g, "");
      if (doc) docs.set(doc, f.nome);
    });
    return docs;
  }, [fornecedores]);

  const validateForm = (
    formData: FornecedorFormData,
    editingFornecedorId?: string,
  ): ValidationError | null => {
    if (!formData.nome.trim()) {
      return { field: "nome", message: "Nome/Razão social é obrigatório" };
    }

    // Documento é opcional, mas se preenchido deve ser válido
    if (formData.documento.trim()) {
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
      const existingNome = documentosIndex.get(documentoLimpo);
      const existingFornecedor = fornecedores.find(
        (f) =>
          f.id !== editingFornecedorId &&
          f.documento.replace(/\D/g, "") === documentoLimpo,
      );
      if (existingFornecedor && existingNome) {
        return {
          field: "documento",
          message: `Documento já está sendo usado pelo fornecedor "${existingFornecedor.nome}".`,
        };
      }
    }

    // Telefone opcional, mas se preenchido deve ser válido
    if (formData.telefone.trim()) {
      const celularLimpo = stripBrazilCountryCode(formData.telefone);
      if (celularLimpo.length !== 11) {
        return {
          field: "telefone",
          message: "Telefone deve ter 11 dígitos: (00) 00000-0000",
        };
      }
      if (!validateCelular(formData.telefone)) {
        return { field: "telefone", message: "Telefone inválido" };
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
