export type AppDatabase = {
  public: {
    Tables: {
      user_roles: {
        Row: {
          id: string;
          nome: string | null;
          tipo_usuario: "interno" | "gestor" | null;
          categoria: string | null;
          avatar_url: string | null;
          specific_permissions: Record<string, unknown> | null;
        };
        Insert: {
          id?: string;
          nome?: string | null;
          tipo_usuario?: "interno" | "gestor" | null;
          categoria?: string | null;
          avatar_url?: string | null;
          specific_permissions?: Record<string, unknown> | null;
        };
        Update: {
          id?: string;
          nome?: string | null;
          tipo_usuario?: "interno" | "gestor" | null;
          categoria?: string | null;
          avatar_url?: string | null;
          specific_permissions?: Record<string, unknown> | null;
        };
        Relationships: [];
      };
      app_notifications: {
        Row: {
          id: string;
          type: "success" | "info" | "warning" | "error";
          title: string;
          message: string;
          target_audience: "interno" | "gestor" | "all";
          target_user_id: string | null;
          empresa_id: string | null;
          created_by: string | null;
          created_by_name: string | null;
          created_by_avatar_url: string | null;
          created_at: string;
          metadata: Record<string, unknown> | null;
          category: "sistema" | "motorista";
        };
        Insert: {
          id?: string;
          type: "success" | "info" | "warning" | "error";
          title: string;
          message: string;
          target_audience?: "interno" | "gestor" | "all";
          target_user_id?: string | null;
          empresa_id?: string | null;
          created_by?: string | null;
          created_by_name?: string | null;
          created_by_avatar_url?: string | null;
          created_at?: string;
          metadata?: Record<string, unknown> | null;
          category?: "sistema" | "motorista";
        };
        Update: {
          id?: string;
          type?: "success" | "info" | "warning" | "error";
          title?: string;
          message?: string;
          target_audience?: "interno" | "gestor" | "all";
          target_user_id?: string | null;
          empresa_id?: string | null;
          created_by?: string | null;
          created_by_name?: string | null;
          created_by_avatar_url?: string | null;
          created_at?: string;
          metadata?: Record<string, unknown> | null;
          category?: "sistema" | "motorista";
        };
        Relationships: [];
      };
      webhook_logs: {
        Row: {
          id: string;
          source: string;
          event_type: string | null;
          payload: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source: string;
          event_type?: string | null;
          payload?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          source?: string;
          event_type?: string | null;
          payload?: Record<string, unknown> | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_presence: {
        Row: {
          user_id: string;
          status: "online" | "offline";
          last_seen_at: string;
          last_activity_at: string;
        };
        Insert: {
          user_id: string;
          status?: "online" | "offline";
          last_seen_at?: string;
          last_activity_at?: string;
        };
        Update: {
          user_id?: string;
          status?: "online" | "offline";
          last_seen_at?: string;
          last_activity_at?: string;
        };
        Relationships: [];
      };
      app_notification_reads: {
        Row: {
          notification_id: string;
          user_id: string;
          read_at: string;
        };
        Insert: {
          notification_id: string;
          user_id: string;
          read_at?: string;
        };
        Update: {
          notification_id?: string;
          user_id?: string;
          read_at?: string;
        };
        Relationships: [];
      };
      docagens: {
        Row: {
          id: string;
          cliente_id: string;
          centro_custo_id: string | null;
          solicitante_id: string | null;
          motorista_id: string | null;
          veiculo_id: string | null;
          endereco: string;
          data_inicio: string;
          data_fim: string;
          horario_inicio: string;
          horario_fim: string;
          dias_semana: number[];
          valor_diario: number;
          custo_diario: number | null;
          observacao: string | null;
          status: "ativa" | "cancelada" | "finalizada";
          created_at: string;
          created_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cliente_id: string;
          centro_custo_id?: string | null;
          solicitante_id?: string | null;
          motorista_id?: string | null;
          veiculo_id?: string | null;
          endereco?: string;
          data_inicio?: string;
          data_fim?: string;
          horario_inicio?: string;
          horario_fim?: string;
          dias_semana?: number[];
          valor_diario?: number;
          custo_diario?: number | null;
          observacao?: string | null;
          status?: "ativa" | "cancelada" | "finalizada";
          created_by?: string | null;
        };
        Update: {
          id?: string;
          cliente_id?: string;
          centro_custo_id?: string | null;
          solicitante_id?: string | null;
          motorista_id?: string | null;
          veiculo_id?: string | null;
          endereco?: string;
          data_inicio?: string;
          data_fim?: string;
          horario_inicio?: string;
          horario_fim?: string;
          dias_semana?: number[];
          valor_diario?: number;
          custo_diario?: number | null;
          observacao?: string | null;
          status?: "ativa" | "cancelada" | "finalizada";
          created_by?: string | null;
        };
        Relationships: [];
      };
      docagem_instancias: {
        Row: {
          id: string;
          docagem_id: string;
          data: string;
          horario_inicio: string;
          horario_fim: string;
          endereco: string;
          motorista_id: string | null;
          veiculo_id: string | null;
          valor: number;
          custo: number | null;
          status: "pendente" | "finalizada" | "excluida";
          finalizada_em: string | null;
          finalizada_por: string | null;
        };
        Insert: {
          id?: string;
          docagem_id?: string;
          data?: string;
          horario_inicio?: string;
          horario_fim?: string;
          endereco?: string;
          motorista_id?: string | null;
          veiculo_id?: string | null;
          valor?: number;
          custo?: number | null;
          status?: "pendente" | "finalizada" | "excluida";
        };
        Update: {
          id?: string;
          docagem_id?: string;
          data?: string;
          horario_inicio?: string;
          horario_fim?: string;
          endereco?: string;
          motorista_id?: string | null;
          veiculo_id?: string | null;
          valor?: number;
          custo?: number | null;
          status?: "pendente" | "finalizada" | "excluida";
        };
        Relationships: [];
      };
      docagem_lancamentos: {
        Row: {
          id: string;
          docagem_instancia_id: string;
          data: string;
          cliente_id: string | null;
          centro_custo_id: string | null;
          motorista_id: string | null;
          valor: number;
          custo: number | null;
          status: "previsto" | "realizado";
          created_at: string;
        };
        Insert: {
          id?: string;
          docagem_instancia_id?: string;
          data?: string;
          cliente_id?: string | null;
          centro_custo_id?: string | null;
          motorista_id?: string | null;
          valor?: number;
          custo?: number | null;
          status?: "previsto" | "realizado";
        };
        Update: {
          id?: string;
          docagem_instancia_id?: string;
          data?: string;
          cliente_id?: string | null;
          centro_custo_id?: string | null;
          motorista_id?: string | null;
          valor?: number;
          custo?: number | null;
          status?: "previsto" | "realizado";
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      criar_docagem: {
        Args: {
          p_cliente_id: string;
          p_centro_custo_id: string | null;
          p_solicitante_id: string | null;
          p_motorista_id: string | null;
          p_veiculo_id: string | null;
          p_endereco: string;
          p_data_inicio: string;
          p_data_fim: string;
          p_horario_inicio: string;
          p_horario_fim: string;
          p_dias_semana: number[];
          p_valor_diario: number;
          p_custo_diario: number | null;
          p_observacao: string | null;
          p_observacao_financeira: string | null;
        };
        Returns: string;
      };
      finalizar_docagem_dia: {
        Args: { p_instancia_id: string };
        Returns: string;
      };
      alterar_status_docagem_instancia: {
        Args: { p_instancia_id: string; p_status: string };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
