import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchFornecedores } from "@/lib/supabase/queries";
import type { Fornecedor } from "@/lib/supabase/queries";

/**
 * Hook para carregamento lazy de fornecedores com cache local e realtime.
 * Use este hook apenas nos componentes que precisam da lista completa.
 * Para paginação, use fetchFornecedoresPage diretamente.
 */
export function useFornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasLoadedRef = useRef(false);
  const supabase = useRef(createClient()).current;

  const loadFornecedores = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchFornecedores();
      setFornecedores(data);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err as Error);
      console.error("Erro ao carregar fornecedores:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      void loadFornecedores();
    }
  }, [loadFornecedores]);

  useEffect(() => {
    const channel = supabase
      .channel("fornecedores-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fornecedores" },
        () => {
          void loadFornecedores();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadFornecedores, supabase]);

  return {
    fornecedores,
    loading,
    error,
    refresh: loadFornecedores,
  };
}
