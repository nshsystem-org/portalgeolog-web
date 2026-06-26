import { useCallback, useEffect, useMemo, useState } from "react";
import type { PaginatedResult } from "@/lib/supabase/queries";
import { logErrorEntry } from "@/lib/frontend-logger";

export type ServerPaginatedFetch<T> = (params: {
  page: number;
  pageSize: number;
  searchTerm: string;
}) => Promise<PaginatedResult<T>>;

export type UseServerPaginatedTableResult<T> = {
  items: T[];
  loading: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  setPage: (nextPage: number) => void;
  refresh: () => Promise<void>;
  updateItems: (mapper: (prev: T[]) => T[]) => void;
  error: string | null;
};

// Tempo de debounce para a busca server-side (ms).
// Evita disparar uma request ao Supabase a cada tecla digitada.
const SEARCH_DEBOUNCE_MS = 400;

export function useServerPaginatedTable<T>(
  fetchPage: ServerPaginatedFetch<T>,
  pageSize = 10,
  enabled = true,
  tableName = "Tabela",
): UseServerPaginatedTableResult<T> {
  const [page, setPage] = useState(1);
  // searchTerm: valor exibido no input (atualizado imediatamente)
  const [searchTerm, setSearchTerm] = useState("");
  // debouncedSearchTerm: valor que dispara a query (atualizado após debounce)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalCount / pageSize));
  }, [pageSize, totalCount]);

  // Debounce: copia searchTerm -> debouncedSearchTerm após parar de digitar
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadPage = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchPage({
        page,
        pageSize,
        searchTerm: debouncedSearchTerm,
      });
      setItems(result.items);
      setTotalCount(result.totalCount);
      setError(null);
    } catch (err) {
      console.error("Erro ao carregar tabela paginada:", err);
      setItems([]);
      setTotalCount(0);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os dados.",
      );
      logErrorEntry(tableName, "Erro ao carregar dados", err as Error, {
        page,
        pageSize,
        searchTerm: debouncedSearchTerm,
      });
    } finally {
      setLoading(false);
    }
  }, [fetchPage, page, pageSize, debouncedSearchTerm, enabled, tableName]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  // Quando o termo debounced muda, volta para página 1
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setPage(Math.max(1, Math.min(nextPage, totalPages)));
    },
    [totalPages],
  );

  const updateItems = useCallback((mapper: (prev: T[]) => T[]) => {
    setItems(mapper);
  }, []);

  const result = useMemo(
    () => ({
      items,
      loading,
      page,
      pageSize,
      totalCount,
      totalPages,
      searchTerm,
      setSearchTerm: handleSearchChange,
      setPage: handlePageChange,
      refresh: loadPage,
      updateItems,
      error,
    }),
    [
      items,
      loading,
      page,
      pageSize,
      totalCount,
      totalPages,
      searchTerm,
      handleSearchChange,
      handlePageChange,
      loadPage,
      updateItems,
      error,
    ],
  );

  return result;
}
