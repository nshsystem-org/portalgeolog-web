"use client";

import React, { useState, useEffect, useRef } from "react";
import { MapPin, Loader2, Search } from "lucide-react";
import { hasMapboxToken } from "@/lib/mapbox-tiles";

interface Suggestion {
  place_id: string;
  display_name: string;
  main_name: string;
  sub_name: string;
  // lat/lon podem ser null quando a sugestao vem da Search Box API
  // (as coordenadas so chegam no passo "retrieve", apos a selecao).
  lat: number | null;
  lon: number | null;
  mapbox_id?: string;
  // Numero digitado pelo usuario, injetado em sugestoes de rua
  // (usado para geocode estruturado no momento da selecao).
  house_number?: string;
  // Nome original da rua (sem numero), para o geocode estruturado.
  street_name?: string;
}

interface NominatimAddress {
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city_district?: string;
  city?: string;
  town?: string;
  municipality?: string;
  state?: string;
}

interface NominatimResult {
  place_id: string | number;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

// Mapbox Search Box API (suggest + retrieve).
// Entende consultas informais brasileiras (numero, quadra, lote, POIs)
// muito melhor que o Geocoding v6.
interface SearchBoxSuggestion {
  name: string;
  mapbox_id: string;
  feature_type?: string;
  full_address?: string;
  place_formatted?: string;
  address?: string;
}

interface SearchBoxSuggestResponse {
  suggestions: SearchBoxSuggestion[];
}

interface SearchBoxRetrieveResponse {
  features: Array<{
    geometry: { coordinates: [number, number] }; // [lng, lat]
    properties: {
      name?: string;
      full_address?: string;
      place_formatted?: string;
    };
  }>;
}

interface GeologAddressInputProps {
  label: string;
  value: string;
  onChange: (value: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
  required?: boolean;
  // Slot renderizado a direita do input (ex: botoes de observacao/passageiro).
  // Quando fornecido, o icone de busca padrao e ocultado e o padding direito
  // do input e aumentado para acomodar o slot.
  rightSlot?: React.ReactNode;
}

export default function GeologAddressInput({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  rightSlot,
}: GeologAddressInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  // Estado local do texto — evita re-render do parent a cada keystroke.
  // Sincroniza com a prop `value` quando ela muda externamente (ex: edit OS).
  const [localValue, setLocalValue] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  // Session token da Search Box API: agrupa suggest + retrieve para billing.
  // Renovado apos cada retrieve (fim da sessao de busca).
  const sessionTokenRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
  );

  const renewSessionToken = () => {
    sessionTokenRef.current =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
  };

  // Sincroniza localValue quando a prop value muda externamente
  // (ex: carregar OS para edicao, ou limpar o formulario).
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Extrai o numero da casa digitado na consulta (ex: "rua x 38 cidade" -> "38").
  // Ignora CEPs (5+3 digitos) e numeros com 6+ digitos.
  const extractHouseNumber = (query: string): string | null => {
    const withoutCep = query.replace(/\b\d{5}-?\d{3}\b/g, " ");
    const match = withoutCep.match(
      /(?:^|[\s,])(?:n[ºo°.]?\s*)?(\d{1,5})(?=[\s,]|$)/i,
    );
    return match ? match[1] : null;
  };

  const searchAddressMapbox = async (query: string): Promise<Suggestion[]> => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return [];

    const url =
      `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(query)}` +
      `&access_token=${token}&session_token=${sessionTokenRef.current}` +
      `&country=br&language=pt&limit=10` +
      `&types=address,street,neighborhood,place,locality,postcode,poi&proximity=ip`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Mapbox Search Box falhou: ${response.status}`);
    }
    const data: SearchBoxSuggestResponse = await response.json();
    const houseNumber = extractHouseNumber(query);

    return (data.suggestions || []).map((item) => {
      const rawName = item.name || item.address || "";
      const subName = item.place_formatted || "Brasil";

      // Se o usuario digitou um numero mas o Mapbox so achou a rua
      // (sem numeracao na base), injeta o numero na sugestao — igual ao
      // Google Maps. Na selecao, tentamos geocodificar o numero exato.
      const isStreetWithNumber =
        houseNumber !== null && item.feature_type === "street";
      const mainName = isStreetWithNumber
        ? `${rawName}, ${houseNumber}`
        : rawName;
      const displayName = isStreetWithNumber
        ? [mainName, item.place_formatted].filter(Boolean).join(", ")
        : item.full_address ||
          [mainName, item.place_formatted].filter(Boolean).join(", ");

      return {
        place_id: item.mapbox_id,
        display_name: displayName,
        main_name: mainName,
        sub_name: subName,
        lat: null,
        lon: null,
        mapbox_id: item.mapbox_id,
        ...(isStreetWithNumber
          ? { house_number: houseNumber, street_name: rawName }
          : {}),
      };
    });
  };

  // Passo "retrieve" da Search Box API: busca as coordenadas exatas
  // da sugestao selecionada.
  const retrieveMapboxCoords = async (
    mapboxId: string,
  ): Promise<{ lat: number; lng: number } | undefined> => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return undefined;

    const url =
      `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(mapboxId)}` +
      `?access_token=${token}&session_token=${sessionTokenRef.current}&language=pt`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Mapbox retrieve falhou: ${response.status}`);
    }
    const data: SearchBoxRetrieveResponse = await response.json();
    const coords = data.features?.[0]?.geometry?.coordinates;
    if (!coords) return undefined;
    return { lat: coords[1], lng: coords[0] };
  };

  // Tenta geocodificar o numero exato da casa via Geocoding v6 estruturado,
  // com proximity no ponto da rua. Retorna undefined se a base do Mapbox
  // nao tiver numeracao para a rua (nesse caso usamos o ponto da rua).
  const geocodeExactNumber = async (
    streetName: string,
    houseNumber: string,
    near: { lat: number; lng: number },
    city?: string,
  ): Promise<{ lat: number; lng: number } | undefined> => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return undefined;

    const url =
      `https://api.mapbox.com/search/geocode/v6/forward` +
      `?address_line1=${encodeURIComponent(`${streetName} ${houseNumber}`)}` +
      (city ? `&place=${encodeURIComponent(city)}` : "") +
      `&access_token=${token}&country=br&language=pt&limit=1` +
      `&types=address&proximity=${near.lng},${near.lat}`;

    const response = await fetch(url);
    if (!response.ok) return undefined;
    const data: {
      features?: Array<{ geometry: { coordinates: [number, number] } }>;
    } = await response.json();
    const coords = data.features?.[0]?.geometry?.coordinates;
    if (!coords) return undefined;

    // Sanity check: o resultado precisa estar perto da rua selecionada
    // (~3km). Evita pegar rua homonima em outra cidade.
    const dLat = Math.abs(coords[1] - near.lat);
    const dLng = Math.abs(coords[0] - near.lng);
    if (dLat > 0.03 || dLng > 0.03) return undefined;

    return { lat: coords[1], lng: coords[0] };
  };

  const searchAddressNominatim = async (
    query: string,
  ): Promise<Suggestion[]> => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1&countrycodes=br&accept-language=pt-BR`,
    );
    const data: NominatimResult[] = await response.json();

    return (data || []).map((item: NominatimResult) => {
      const addr = item.address || {};
      const mainName =
        addr.road ||
        addr.suburb ||
        addr.neighbourhood ||
        addr.city_district ||
        item.display_name.split(",")[0];
      const neighborhood =
        addr.suburb || addr.neighbourhood || addr.city_district || "";
      const city = addr.city || addr.town || addr.municipality || "";
      const state = addr.state || "";
      const subParts = [neighborhood, city, state].filter(
        (part) => part && part !== mainName,
      );
      return {
        place_id: item.place_id.toString() || Math.random().toString(),
        display_name: item.display_name,
        main_name: mainName,
        sub_name: subParts.join(" - ") || "Brasil",
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
      };
    });
  };

  const searchAddress = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      // Prioriza Mapbox Geocoding (mais preciso para BR). Fallback Nominatim.
      const results = hasMapboxToken()
        ? await searchAddressMapbox(query)
        : await searchAddressNominatim(query);
      setSuggestions(results);
      setIsOpen(true);
    } catch (error) {
      console.error("Erro na busca de endereco:", error);
      // Se Mapbox falhar, tenta Nominatim como fallback
      if (hasMapboxToken()) {
        try {
          const fallback = await searchAddressNominatim(query);
          setSuggestions(fallback);
          setIsOpen(true);
        } catch {
          /* silencioso */
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (suggestion: Suggestion) => {
    setLocalValue(suggestion.display_name);
    setIsOpen(false);
    setSuggestions([]);

    // Sugestao do Nominatim ja vem com coordenadas
    if (suggestion.lat !== null && suggestion.lon !== null) {
      onChange(suggestion.display_name, {
        lat: suggestion.lat,
        lng: suggestion.lon,
      });
      return;
    }

    // Sugestao da Search Box API: busca coordenadas via retrieve
    if (suggestion.mapbox_id) {
      try {
        let coords = await retrieveMapboxCoords(suggestion.mapbox_id);
        // Sugestao de rua com numero injetado: tenta refinar para o
        // ponto exato do numero (se a base tiver numeracao da rua).
        if (coords && suggestion.house_number && suggestion.street_name) {
          // Cidade: primeiro segmento do place_formatted
          // (ex: "Casimiro de Abreu - Rio de Janeiro, 28880, Brasil").
          const city = suggestion.sub_name.split(/\s*[-,]\s*/)[0]?.trim();
          const exact = await geocodeExactNumber(
            suggestion.street_name,
            suggestion.house_number,
            coords,
            city || undefined,
          );
          if (exact) coords = exact;
        }
        onChange(suggestion.display_name, coords);
      } catch (error) {
        console.error("Erro ao buscar coordenadas do endereco:", error);
        onChange(suggestion.display_name, undefined);
      } finally {
        renewSessionToken();
      }
      return;
    }

    onChange(suggestion.display_name, undefined);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // So atualiza estado local — NAO chama onChange do parent aqui
    // para evitar re-render do modal inteiro a cada keystroke.
    setLocalValue(val);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      searchAddress(val);
    }, 500); // 500ms delay to be gentle with the API
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Ao perder o foco, propaga o texto para o parent.
    // Se o usuario digitou sem selecionar sugestao, coords serao undefined
    // e o parent limpara lat/lng (texto livre sem pino no mapa).
    const val = e.target.value;
    if (val !== value) {
      onChange(val, undefined);
    }
  };

  return (
    <div className="space-y-2 group relative" ref={wrapperRef}>
      <label className="text-[13px] font-bold text-slate-800 uppercase tracking-tight ml-1 group-focus-within:text-blue-600 transition-colors">
        {label}
      </label>

      <div className="relative">
        <input
          type="text"
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={() =>
            (suggestions.length > 0 || localValue.length >= 3) &&
            setIsOpen(true)
          }
          placeholder={placeholder}
          required={required}
          className={`w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-base text-slate-900 outline-none focus:border-blue-600 focus:bg-white focus:ring-8 focus:ring-blue-500/5 transition-all shadow-sm placeholder:text-slate-300 ${rightSlot ? "pr-36" : "pr-12"}`}
        />
        {rightSlot ? (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
            {rightSlot}
          </div>
        ) : (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
            {loading ? (
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
            )}
          </div>
        )}
      </div>

      {isOpen && localValue.length >= 3 && (
        <div className="absolute z-[99999] top-full left-0 w-full mt-2 bg-white border-2 border-slate-100 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="max-h-72 overflow-y-auto custom-scrollbar">
            {!loading && suggestions.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400">
                <p className="font-bold text-sm">Endereço não localizado</p>
                <p className="text-[10px] font-black text-blue-600/50 uppercase tracking-widest mt-1">
                  Dica: Digite o nome do bairro e a cidade
                </p>
              </div>
            ) : (
              suggestions.map((item) => (
                <div
                  key={item.place_id}
                  onClick={() => handleSelect(item)}
                  className="px-6 py-4 hover:bg-blue-50 cursor-pointer flex items-start gap-4 transition-colors border-b border-slate-50 last:border-none group/item"
                >
                  <div className="mt-1 p-1.5 bg-slate-100 rounded-lg group-hover/item:bg-blue-100 transition-colors">
                    <MapPin
                      size={16}
                      className="text-slate-400 group-hover/item:text-blue-600"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-bold text-slate-800 text-[14px] leading-tight truncate">
                      {item.main_name}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate">
                      {item.sub_name}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
