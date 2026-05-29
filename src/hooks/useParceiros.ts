import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchParceiros } from "@/lib/supabase/queries";
import type { ParceiroServico } from "@/context/DataContext";

/**
 * Hook para carregamento lazy de parceiros com cache local e realtime.
 * Use este hook apenas nos componentes que realmente precisam da lista completa.
 * Para paginação, use fetchParceirosPage diretamente.
 */
export function useParceiros() {
  const [parceiros, setParceiros] = useState<ParceiroServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasLoadedRef = useRef(false);
  const supabase = useRef(createClient()).current;

  const loadParceiros = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchParceiros();
      setParceiros(data);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err as Error);
      console.error("Erro ao carregar parceiros:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregamento inicial
  useEffect(() => {
    if (!hasLoadedRef.current) {
      void loadParceiros();
    }
  }, [loadParceiros]);

  // Realtime updates
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    const channel = supabase
      .channel("parceiros-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parceiros_servico" },
        () => {
          void loadParceiros();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parceiros_contatos" },
        () => {
          void loadParceiros();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parceiros_filiais" },
        () => {
          void loadParceiros();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadParceiros, supabase]);

  return {
    parceiros,
    loading,
    error,
    refresh: loadParceiros,
  };
}
