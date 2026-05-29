import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchPassageiros } from "@/lib/supabase/queries";
import type { Passageiro } from "@/context/DataContext";

/**
 * Hook para carregamento lazy de passageiros com cache local e realtime.
 * Use este hook apenas nos componentes que realmente precisam da lista completa.
 * Para paginação, use fetchPassageirosPage diretamente.
 */
export function usePassageiros() {
  const [passageiros, setPassageiros] = useState<Passageiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasLoadedRef = useRef(false);
  const supabase = useRef(createClient()).current;

  const loadPassageiros = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPassageiros();
      setPassageiros(data);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err as Error);
      console.error("Erro ao carregar passageiros:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregamento inicial
  useEffect(() => {
    if (!hasLoadedRef.current) {
      void loadPassageiros();
    }
  }, [loadPassageiros]);

  // Realtime updates
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    const channel = supabase
      .channel("passageiros-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "passageiros" },
        () => {
          void loadPassageiros();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "passageiro_enderecos" },
        () => {
          void loadPassageiros();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPassageiros, supabase]);

  return {
    passageiros,
    loading,
    error,
    refresh: loadPassageiros,
  };
}
