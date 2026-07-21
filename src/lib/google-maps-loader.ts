// Helper para carregar a Google Maps JavaScript API uma unica vez.
// Usa @googlemaps/js-api-loader (loader oficial do Google) com a nova
// API funcional (setOptions + importLibrary), garantindo que o script
// so seja injetado no DOM na primeira chamada.
//
// APIs habilitadas no console do Google Cloud:
//   - Maps JavaScript API (mapa base + AdvancedMarkerElement)
//   - Places API (AutocompleteService + PlacesService)
//   - Geocoding API (Geocoder)
//   - Directions API (DirectionsService)

import {
  setOptions,
  importLibrary,
  type LibraryMap,
} from "@googlemaps/js-api-loader";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Libraries necessarias para os componentes do app.
type LibraryName = keyof LibraryMap;
const REQUIRED_LIBRARIES: LibraryName[] = [
  "maps",
  "places",
  "geocoding",
  "routes",
  "geometry",
  "marker",
];

let optionsSet = false;
let loadPromise: Promise<typeof google> | null = null;

function ensureOptions(): void {
  if (optionsSet) return;
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error(
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY nao configurado. Adicione em .env.local.",
    );
  }
  setOptions({
    key: GOOGLE_MAPS_API_KEY,
    v: "weekly",
    libraries: REQUIRED_LIBRARIES as unknown as string[],
    language: "pt-BR",
    region: "BR",
  });
  optionsSet = true;
}

/**
 * Carrega a Google Maps JavaScript API (idempotente).
 * Retorna o namespace global `google` tipado.
 *
 * Internamente importa todas as libraries necessarias em paralelo; o
 * `google` global e populado pelo script da API e fica disponivel para
 * uso direto (google.maps.Map, google.maps.places.AutocompleteService, etc).
 */
export function loadGoogleMaps(): Promise<typeof google> {
  if (!loadPromise) {
    ensureOptions();
    loadPromise = Promise.all(
      REQUIRED_LIBRARIES.map((lib) => importLibrary(lib)),
    ).then(() => google);
  }
  return loadPromise;
}

/**
 * Verifica se a API key do Google Maps esta configurada.
 * Usado para decidir entre Google e fallback Nominatim.
 */
export function hasGoogleMapsKey(): boolean {
  return Boolean(GOOGLE_MAPS_API_KEY);
}
