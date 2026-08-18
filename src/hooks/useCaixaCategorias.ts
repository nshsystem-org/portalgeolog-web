import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchCaixaCategorias,
  fetchCaixaFormasPagamento,
} from "@/lib/supabase/queries";
import type { CaixaCategoria, CaixaFormaPagamento } from "@/lib/supabase/queries";

export function useCaixaCategorias() {
  const [categorias, setCategorias] = useState<CaixaCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const supabase = useRef(createClient()).current;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchCaixaCategorias();
      setCategorias(data);
      hasLoadedRef.current = true;
    } catch (err) {
      console.error("Erro ao carregar categorias do caixa:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("caixa-categorias-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "caixa_categorias" },
        () => void load(),
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load, supabase]);

  return { categorias, loading, refresh: load };
}

export function useCaixaFormasPagamento() {
  const [formas, setFormas] = useState<CaixaFormaPagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const supabase = useRef(createClient()).current;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchCaixaFormasPagamento();
      setFormas(data);
      hasLoadedRef.current = true;
    } catch (err) {
      console.error("Erro ao carregar formas de pagamento do caixa:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("caixa-formas-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "caixa_formas_pagamento" },
        () => void load(),
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load, supabase]);

  return { formas, loading, refresh: load };
}
