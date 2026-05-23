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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
