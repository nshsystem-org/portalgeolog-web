"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { User, Session } from "@supabase/supabase-js";

import { toast } from "sonner";

export interface UserProfile {
  id: string;
  nome: string;
  tipo_usuario: "interno" | "gestor";
  categoria:
    | "administrador"
    | "gestor"
    | "financeiro"
    | "operador"
    | "jovem aprendiz";
  empresa_id?: string;
  avatar_url?: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  login: async () => false,
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Buscar perfil inicial
  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        // Usar a rota de API ou garantir que a tabela existe via check silencioso
        const { data, error } = await supabase
          .from("user_roles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          if (
            error.code === "PGRST204" ||
            error.message.includes("not found")
          ) {
            console.warn("user_roles table not found or user has no role yet.");
            setLoading(false);
            return;
          }
          throw error;
        }

        if (data) setProfile(data as UserProfile);
      } catch (err) {
        console.error(
          "Erro ao buscar perfil:",
          err instanceof Error ? err.message : JSON.stringify(err),
        );
      } finally {
        setLoading(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    const initializeAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUser(user);
        await fetchProfile(user.id);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      if (!session) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      void (async () => {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setUser(user);
        await fetchProfile(user.id);
      })();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  // Listener Realtime para remoções ou rebaixamentos de cargo "ao vivo"
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile_changes_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_roles",
          filter: `id=eq.${user.id}`,
        },
        (payload: unknown) => {
          const newProfile = (payload as { new: UserProfile }).new;

          if (profile && profile.categoria !== newProfile.categoria) {
            toast.warning(
              `Seu nível de acesso foi alterado pelo administrador para: ${newProfile.categoria.toUpperCase()}`,
            );
          }

          setProfile(newProfile);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "user_roles",
          filter: `id=eq.${user.id}`,
        },
        () => {
          toast.error("O seu acesso corporativo foi revogado. Saindo...");
          logout();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, supabase]);

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error:", error.message);
        return false;
      }

      return !!data.user;
    } catch (err) {
      console.error("Login unexpected error:", err);
      return false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
