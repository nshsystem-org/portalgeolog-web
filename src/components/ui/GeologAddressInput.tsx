"use client";

import React, { useState, useEffect, useRef } from "react";
import { MapPin, Loader2, Search } from "lucide-react";
import { hasMapboxToken } from "@/lib/mapbox-tiles";

interface Suggestion {
  place_id: string;
  display_name: string;
  main_name: string;
  sub_name: string;
  lat: number;
  lon: number;
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

// Mapbox Geocoding v6 retorna GeoJSON FeatureCollection
interface MapboxContextEntry {
  name: string;
  mapbox_id?: string;
  kind?: string;
}
interface MapboxFeature {
  id: string;
  geometry: { coordinates: [number, number] }; // [lng, lat]
  properties: {
    name?: string;
    full_address?: string;
    place_name?: string;
    feature_type?: string;
    // context é um objeto cujas chaves variam (street, neighborhood,
    // place, region, country, postcode...). Cada valor tem { name, ... }.
    context?: Record<string, MapboxContextEntry>;
  };
}

interface MapboxResponse {
  type: "FeatureCollection";
  features: MapboxFeature[];
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

  const searchAddressMapbox = async (query: string): Promise<Suggestion[]> => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return [];

    const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(
      query,
    )}&access_token=${token}&country=br&language=pt&limit=10&autocomplete=true`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Mapbox geocoding falhou: ${response.status}`);
    }
    const data: MapboxResponse = await response.json();

    return (data.features || []).map((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      const props = feature.properties;
      const mainName = props.name || props.full_address?.split(",")[0] || "";
      const displayName = props.full_address || props.place_name || mainName;

      // Constroi sub_label a partir do context (regiao, cidade, etc.)
      // context no Mapbox v6 é um objeto: { street: {name}, neighborhood: {name}, place: {name}, ... }
      const ctx = props.context || {};
      const ctxParts = Object.values(ctx)
        .map((c) => c.name)
        .filter((n) => n && n !== mainName);
      const subName = ctxParts.join(" - ") || "Brasil";

      return {
        place_id: feature.id,
        display_name: displayName,
        main_name: mainName,
        sub_name: subName,
        lat,
        lon: lng,
      };
    });
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

  const handleSelect = (suggestion: Suggestion) => {
    setLocalValue(suggestion.display_name);
    onChange(suggestion.display_name, {
      lat: suggestion.lat,
      lng: suggestion.lon,
    });
    setIsOpen(false);
    setSuggestions([]);
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
                  key={item.place_id + item.lat}
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
