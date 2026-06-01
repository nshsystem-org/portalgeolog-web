import { useCallback, useEffect, useMemo, useState } from "react";
import type { PaginatedResult } from "@/lib/supabase/queries";
import { logInfo, logErrorEntry } from "@/lib/frontend-logger";

export type ServerPaginatedFetch<T> = (params: {
  page: number;
  pageSize: number;
  searchTerm: string;
}) => Promise<PaginatedResult<T>>;

export function useServerPaginatedTable<T>(
  fetchPage: ServerPaginatedFetch<T>,
  pageSize = 10,
  enabled = true,
  tableName = "Tabela",
) {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalCount / pageSize));
  }, [pageSize, totalCount]);

  const loadPage = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchPage({ page, pageSize, searchTerm });
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
        searchTerm,
      });
    } finally {
      setLoading(false);
    }
  }, [fetchPage, page, pageSize, searchTerm, enabled, tableName]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
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
