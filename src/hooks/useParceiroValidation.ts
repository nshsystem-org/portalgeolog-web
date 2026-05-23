import { useMemo } from "react";
import { ParceiroServico } from "@/lib/supabase/queries";
import {
  normalizeBrazilPhone,
  stripBrazilCountryCode,
} from "@/lib/phone";
import {
  validateCPF,
  validateCNPJ,
  validateCelular,
} from "@/lib/document-validator";

type ParceiroFormContato = {
  setor: string;
  celular: string;
  email?: string;
  responsavel: string;
};

type ParceiroFormFilial = {
  rotulo: string;
  enderecoCompleto: string;
};

interface ParceiroFormData {
  pessoaTipo: "fisica" | "juridica";
  documento: string;
  razaoSocialOuNomeCompleto: string;
  contatos: ParceiroFormContato[];
  filiais: ParceiroFormFilial[];
}

interface ValidationError {
  field?: string;
  message: string;
}

export function useParceiroValidation(parceiros: ParceiroServico[]) {
  // Otimização: Criar índices O(n) para verificação de duplicados
  const { documentosIndex, celularesIndex, emailsIndex } = useMemo(() => {
    const docs = new Map<string, string>();
    const cells = new Map<string, { parceiroId: string; setor: string }>();
    const emails = new Map<string, { parceiroId: string; setor: string }>();

    parceiros.forEach((parceiro) => {
      const doc = parceiro.documento.replace(/\D/g, "");
      docs.set(doc, parceiro.razaoSocialOuNomeCompleto);

      parceiro.contatos.forEach((contato) => {
        const cell = normalizeBrazilPhone(contato.celular);
        if (cell) {
          cells.set(cell, {
            parceiroId: parceiro.id,
            setor: contato.setor,
          });
        }

        const email = contato.email?.trim().toLowerCase();
        if (email) {
          emails.set(email, {
            parceiroId: parceiro.id,
            setor: contato.setor,
          });
        }
      });
    });

    return { documentosIndex: docs, celularesIndex: cells, emailsIndex: emails };
  }, [parceiros]);

  const validateForm = (
    formData: ParceiroFormData,
    editingParceiroId?: string
  ): ValidationError | null => {
    if (!formData.razaoSocialOuNomeCompleto.trim()) {
      return { message: "Razão Social/Nome completo é obrigatório" };
    }

    if (!formData.documento.trim()) {
      return { message: "CNPJ/CPF é obrigatório" };
    }

    const documentoLimpo = formData.documento.replace(/\D/g, "");
    if (formData.pessoaTipo === "juridica") {
      if (documentoLimpo.length !== 14) {
        return { message: "CNPJ deve ter 14 dígitos completos" };
      }
      if (!validateCNPJ(formData.documento)) {
        return { message: "CNPJ inválido" };
      }
    } else {
      if (documentoLimpo.length !== 11) {
        return { message: "CPF deve ter 11 dígitos completos" };
      }
      if (!validateCPF(formData.documento)) {
        return { message: "CPF inválido" };
      }
    }

    // Verificar documento duplicado - O(1) com Map
    const existingDoc = documentosIndex.get(documentoLimpo);
    if (existingDoc && existingDoc !== formData.razaoSocialOuNomeCompleto) {
      const existingParceiro = parceiros.find(
        (p) =>
          p.id !== editingParceiroId &&
          p.documento.replace(/\D/g, "") === documentoLimpo
      );
      if (existingParceiro) {
        return {
          message: `CNPJ/CPF já está sendo usado pelo parceiro "${existingParceiro.razaoSocialOuNomeCompleto}".`,
        };
      }
    }

    const primeiroContato = formData.contatos[0];
    if (!primeiroContato.setor.trim()) {
      return { field: "setor", message: "Setor do primeiro contato é obrigatório" };
    }
    if (!primeiroContato.celular.trim()) {
      return { field: "celular", message: "Celular do primeiro contato é obrigatório" };
    }
    if (!primeiroContato.responsavel.trim()) {
      return {
        field: "responsavel",
        message: "Responsável do primeiro contato é obrigatório",
      };
    }

    const celularLimpo = stripBrazilCountryCode(primeiroContato.celular);
    if (celularLimpo.length !== 11) {
      return {
        field: "celular",
        message: "Celular deve ter 11 dígitos completos: (00) 00000-0000",
      };
    }
    if (!validateCelular(primeiroContato.celular)) {
      return { field: "celular", message: "Celular inválido" };
    }

    if (primeiroContato.email && primeiroContato.email.trim()) {
      // Regex mais robusto para validação de email
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!emailRegex.test(primeiroContato.email.trim())) {
        return { field: "email", message: "E-mail inválido" };
      }
    }

    // Verificar duplicados entre os próprios contatos do formulário
    const formCelulares = new Map<string, number>();
    const formEmails = new Map<string, number>();
    for (let i = 0; i < formData.contatos.length; i++) {
      const c = formData.contatos[i];
      const cell = normalizeBrazilPhone(c.celular);
      if (cell && formCelulares.has(cell)) {
        return {
          field: "celular",
          message: `Celular ${c.celular} está duplicado entre os contatos deste parceiro.`,
        };
      }
      formCelulares.set(cell, i);

      const email = c.email?.trim().toLowerCase();
      if (email && formEmails.has(email)) {
        return {
          field: "email",
          message: `E-mail ${c.email} está duplicado entre os contatos deste parceiro.`,
        };
      }
      if (email) {
        formEmails.set(email, i);
      }
    }

    // Verificar celular/email duplicados em outros parceiros - O(1) com Map
    for (const contato of formData.contatos) {
      const cell = normalizeBrazilPhone(contato.celular);
      if (cell) {
        const existing = celularesIndex.get(cell);
        if (existing && existing.parceiroId !== editingParceiroId) {
          return {
            field: "celular",
            message: `Celular ${contato.celular} já está sendo usado no contato "${existing.setor}" de outro parceiro.`,
          };
        }
      }

      const email = contato.email?.trim().toLowerCase();
      if (email) {
        const existing = emailsIndex.get(email);
        if (existing && existing.parceiroId !== editingParceiroId) {
          return {
            field: "email",
            message: `E-mail ${contato.email} já está sendo usado no contato "${existing.setor}" de outro parceiro.`,
          };
        }
      }
    }

    return null;
  };

  return { validateForm };
}
