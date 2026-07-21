"use client";

import { useEffect, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

type GoogleNamespace = typeof google;

interface UseGoogleMapsResult {
  google: GoogleNamespace | null;
  isLoaded: boolean;
  error: Error | null;
}

interface GlobalCache {
  promise: Promise<GoogleNamespace> | null;
  resolved: GoogleNamespace | null;
  error: Error | null;
  // Assinantes notificados quando o cache muda (ex: segundo componente monta
  // enquanto o primeiro ainda esta carregando).
  subscribers: Set<() => void>;
}

// Cache global: compartilha o estado entre todos os componentes que usam o hook
// para evitar N chamadas de `loadGoogleMaps` (mesmo sendo idempotente, isso
// economiza re-renders).
const globalCache: GlobalCache = {
  promise: null,
  resolved: null,
  error: null,
  subscribers: new Set(),
};

function notifySubscribers(): void {
  globalCache.subscribers.forEach((fn) => fn());
}

function ensureLoading(): void {
  if (globalCache.promise || globalCache.resolved || globalCache.error) return;
  globalCache.promise = loadGoogleMaps();
  globalCache.promise
    .then((g) => {
      globalCache.resolved = g;
      notifySubscribers();
    })
    .catch((err: Error) => {
      globalCache.error = err;
      notifySubscribers();
    });
}

/**
 * Hook que carrega a Google Maps JavaScript API uma unica vez e expoe
 * o namespace `google` tipado para uso em componentes cliente.
 *
 * Uso:
 *   const { google, isLoaded, error } = useGoogleMaps();
 *   if (!isLoaded) return <Spinner />;
 *   if (error) return <ErrorMessage />;
 *   // usar google.maps.Map, google.maps.places.AutocompleteService, etc.
 */
export function useGoogleMaps(): UseGoogleMapsResult {
  // Estado inicial lido do cache global — sem setState sincrono no effect.
  const [state, setState] = useState<{
    resolved: GoogleNamespace | null;
    error: Error | null;
  }>(() => ({
    resolved: globalCache.resolved,
    error: globalCache.error,
  }));

  useEffect(() => {
    // Garante que o loading foi iniciado (idempotente).
    ensureLoading();

    // Se ja resolvido/erro, sincroniza caso o componente tenha montado antes
    // do cache estar populado (snapshot inicial pode estar defasado).
    if (
      state.resolved !== globalCache.resolved ||
      state.error !== globalCache.error
    ) {
      setState({
        resolved: globalCache.resolved,
        error: globalCache.error,
      });
    }

    // Assina atualizacoes futuras (resolve/catch do promise).
    const subscriber = () => {
      setState({
        resolved: globalCache.resolved,
        error: globalCache.error,
      });
    };
    globalCache.subscribers.add(subscriber);
    return () => {
      globalCache.subscribers.delete(subscriber);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    google: state.resolved,
    isLoaded: state.resolved !== null,
    error: state.error,
  };
}
