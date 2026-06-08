import { useState, useEffect } from "react";

// Tipo para as traduções de chat
export interface ChatTranslations {
  widget: {
    toggle_button: string;
    close_button: string;
    minimize_button: string;
    maximize_button: string;
    chat_title: string;
    conversations_title: string;
    conversation_title: string;
  };
  conversation_list: {
    no_conversations: string;
    unread_messages: string;
    unread_messages_plural: string;
  };
  message_list: {
    no_messages: string;
    today: string;
    edited: string;
    visualized: string;
  };
  chat_input: {
    placeholder: string;
    send_button: string;
  };
  errors: {
    load_conversations: string;
    load_messages: string;
    send_message: string;
    create_conversation: string;
  };
}

// Tipo para as traduções de parcerias
export interface ParceriasTranslations {
  titulo: string;
  descricao: string;
  pessoa_tipo: {
    label: string;
    juridica: string;
    fisica: string;
  };
  dados_principais: {
    razao_social: string;
    nome_completo: string;
    cnpj: string;
    cpf: string;
    placeholder_razao_social: string;
    placeholder_nome_completo: string;
    placeholder_cnpj: string;
    placeholder_cpf: string;
  };
  contatos: {
    titulo: string;
    setor: string;
    celular: string;
    email: string;
    responsavel: string;
    placeholder_setor: string;
    placeholder_celular: string;
    placeholder_email: string;
    placeholder_responsavel: string;
    adicionar: string;
    remover: string;
    principal: string;
    nenhum: string;
  };
  filiais: {
    titulo: string;
    rotulo: string;
    endereco_completo: string;
    referencia: string;
    placeholder_rotulo: string;
    placeholder_endereco: string;
    placeholder_referencia: string;
    adicionar: string;
    remover: string;
    principal: string;
    nenhuma: string;
  };
  tabela: {
    nome: string;
    tipo: string;
    juridica: string;
    fisica: string;
    contatos: string;
    filiais: string;
    status: string;
    ativo: string;
    inativo: string;
    arquivado: string;
    acoes: string;
    buscar_placeholder: string;
    vazio: string;
    filiais_contador: string;
    sem_filiais: string;
  };
  botoes: {
    novo: string;
    editar: string;
    visualizar: string;
    arquivar: string;
    salvar: string;
    salvar_alteracoes: string;
    cancelar: string;
    fechar: string;
    ocultar_arquivados: string;
    mostrar_arquivados: string;
    editar_modal: string;
  };
  validacao: {
    razao_social_obrigatoria: string;
    documento_obrigatorio: string;
    cnpj_14_digitos: string;
    cnpj_invalido: string;
    cpf_11_digitos: string;
    cpf_invalido: string;
    documento_duplicado: string;
    setor_obrigatorio: string;
    celular_obrigatorio: string;
    responsavel_obrigatorio: string;
    celular_11_digitos: string;
    celular_invalido: string;
    email_invalido: string;
    celular_duplicado_form: string;
    email_duplicado_form: string;
    celular_duplicado_outro: string;
    email_duplicado_outro: string;
  };
  sucesso: {
    criado: string;
    atualizado: string;
    arquivado: string;
  };
  erros: {
    salvar: string;
    verificar_vinculos: string;
    vinculos_encontrados: string;
  };
  confirmacao: {
    arquivar_titulo: string;
    arquivar_mensagem: string;
    arquivar_confirmar: string;
    arquivar_cancelar: string;
  };
  visualizacao: {
    pessoa_juridica: string;
    pessoa_fisica: string;
    sem_dados: string;
  };
  loading: {
    arquivados: string;
  };
}

const translations = {
  "pt-BR": {
    chat: () =>
      import("@/locales/pt-BR/chat.json").then(
        (m) => m.default as ChatTranslations,
      ),
    parcerias: () =>
      import("@/locales/pt-BR/parcerias.json").then(
        (m) => m.default as ParceriasTranslations,
      ),
  },
  en: {
    chat: () =>
      import("@/locales/en/chat.json").then(
        (m) => m.default as ChatTranslations,
      ),
    parcerias: () =>
      import("@/locales/en/parcerias.json").then(
        (m) => m.default as ParceriasTranslations,
      ),
  },
};

type Locale = keyof typeof translations;

export function useTranslation(locale: Locale = "pt-BR") {
  const t = {
    chat: async () => {
      const localeTranslations = await translations[locale].chat();
      return localeTranslations;
    },
    parcerias: async () => {
      const localeTranslations = await translations[locale].parcerias();
      return localeTranslations;
    },
  };

  return { t };
}

// Versão síncrona simplificada para componentes que carregam as traduções
export function useChatTranslation(
  locale: Locale = "pt-BR",
): ChatTranslations | null {
  const [localeTranslations, setLocaleTranslations] =
    useState<ChatTranslations | null>(null);

  useEffect(() => {
    translations[locale]
      .chat()
      .then((data: ChatTranslations) => setLocaleTranslations(data));
  }, [locale]);

  return localeTranslations;
}

// Versão síncrona simplificada para componentes que carregam as traduções
export function useParceriasTranslation(
  locale: Locale = "pt-BR",
): ParceriasTranslations | null {
  const [localeTranslations, setLocaleTranslations] =
    useState<ParceriasTranslations | null>(null);

  useEffect(() => {
    translations[locale]
      .parcerias()
      .then((data: ParceriasTranslations) => setLocaleTranslations(data));
  }, [locale]);

  return localeTranslations;
}
