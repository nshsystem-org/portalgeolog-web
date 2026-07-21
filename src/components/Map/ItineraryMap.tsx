"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { hasGoogleMapsKey } from "@/lib/google-maps-loader";

interface ItineraryMapWaypoint {
  label: string;
  lat: number | null;
  lng: number | null;
  useMap?: boolean;
}

interface ItineraryMapProps {
  waypoints: ItineraryMapWaypoint[];
  // Indices reais dos waypoints no array do formulario (opcional).
  // Quando fornecido, onWaypointDrag e chamado com o indice real.
  waypointIndices?: number[];
  // Callback quando o usuario arrasta um marcador para ajustar a posicao.
  onWaypointDrag?: (
    waypointIndex: number,
    coords: { lat: number; lng: number },
  ) => void;
}

// Map ID estatico: necessario para AdvancedMarkerElement (Maps JS API v3.50+).
// Pode ser qualquer string; nao precisa estar registrado no console.
const MAP_ID = "itinerary-map-v1";

export default function ItineraryMap({
  waypoints,
  waypointIndices,
  onWaypointDrag,
}: ItineraryMapProps) {
  const { google, isLoaded, error } = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const polylineCasingRef = useRef<google.maps.Polyline | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [zoom, setZoom] = useState<number>(12);

  // Filtra apenas waypoints com coords validas E com useMap ativado
  const pointsWithCoords = useMemo(
    () =>
      waypoints
        .map((waypoint, waypointIndex) => ({ waypoint, waypointIndex }))
        .filter(
          ({ waypoint }) =>
            waypoint.useMap !== false &&
            waypoint.lat !== null &&
            waypoint.lng !== null &&
            !Number.isNaN(waypoint.lat) &&
            !Number.isNaN(waypoint.lng),
        )
        .map(({ waypoint, waypointIndex }) => ({
          ...waypoint,
          waypointIndex,
        })),
    [waypoints],
  );

  // Centro inicial: primeiro waypoint ou Rio de Janeiro
  const initialCenter = useMemo(() => {
    if (pointsWithCoords.length === 0) {
      return { lat: -22.9068, lng: -43.1729, zoom: 11 };
    }
    if (pointsWithCoords.length === 1) {
      return {
        lat: pointsWithCoords[0].lat as number,
        lng: pointsWithCoords[0].lng as number,
        zoom: 15,
      };
    }
    const lons = pointsWithCoords.map((wp) => wp.lng as number);
    const lats = pointsWithCoords.map((wp) => wp.lat as number);
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lons) + Math.max(...lons)) / 2,
      zoom: 12,
    };
  }, [pointsWithCoords]);

  // Inicializa o mapa uma unica vez quando a API carrega
  useEffect(() => {
    if (!google || !containerRef.current || mapRef.current) return;

    mapRef.current = new google.maps.Map(containerRef.current, {
      center: { lat: initialCenter.lat, lng: initialCenter.lng },
      zoom: initialCenter.zoom,
      mapId: MAP_ID,
      fullscreenControl: true,
      scaleControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      clickableIcons: false,
      // Visual mais proximo do Google Maps consumer
      // (ruas nomeadas, POIs coloridos, predios 3D sutis).
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "on" }],
        },
      ],
    });

    infoWindowRef.current = new google.maps.InfoWindow();

    const map = mapRef.current;
    map.addListener("zoom_changed", () => {
      setZoom(map.getZoom() ?? 12);
    });
  }, [google, initialCenter.lat, initialCenter.lng, initialCenter.zoom]);

  // Escala dos marcadores conforme o zoom: 1.0 no zoom >= 16 (nivel rua),
  // encolhendo gradualmente ate 0.35 no zoom <= 9 (cidade vista de cima).
  const markerScale = useMemo(() => {
    const minZoom = 9;
    const maxZoom = 16;
    const minScale = 0.35;
    const t = Math.min(1, Math.max(0, (zoom - minZoom) / (maxZoom - minZoom)));
    return minScale + t * (1 - minScale);
  }, [zoom]);

  // Cria/atualiza marcadores quando os waypoints mudam
  useEffect(() => {
    if (!google || !mapRef.current) return;

    const map = mapRef.current;
    const { AdvancedMarkerElement } = google.maps.marker;

    // Limpa marcadores anteriores
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];

    pointsWithCoords.forEach((wp) => {
      const isOrigin = wp.waypointIndex === 0;
      const isDestination = wp.waypointIndex === waypoints.length - 1;
      const isStop = !isOrigin && !isDestination;

      let bgColor = "bg-emerald-500";
      let borderColor = "border-emerald-400";
      let iconBg = "bg-emerald-600";
      let label = "ORIGEM";

      if (isDestination) {
        bgColor = "bg-blue-600";
        borderColor = "border-blue-500";
        iconBg = "bg-blue-700";
        label = "DESTINO";
      } else if (isStop) {
        bgColor = "bg-amber-500";
        borderColor = "border-amber-400";
        iconBg = "bg-amber-600";
        label = `PARADA ${wp.waypointIndex}`;
      }

      // AdvancedMarkerElement exige um Node como content.
      // Usamos um div estilizado igual ao antigo Marker do mapbox.
      const markerEl = document.createElement("div");
      markerEl.className = "itinerary-marker";
      markerEl.innerHTML = `
        <div class="inline-flex items-stretch rounded-lg overflow-hidden shadow-md border text-[9px] ${bgColor} ${borderColor} text-white ${
          onWaypointDrag ? "cursor-grab active:cursor-grabbing" : ""
        }" style="transform: scale(${markerScale}); transform-origin: bottom center;">
          <span class="px-1.5 py-1 flex items-center justify-center ${iconBg}">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </span>
          <span class="px-2 py-1 font-black tracking-wide text-[9px]">${label}</span>
        </div>
      `;

      const marker = new AdvancedMarkerElement({
        map,
        position: { lat: wp.lat as number, lng: wp.lng as number },
        content: markerEl,
        // anchor "bottom": pino apoiado no ponto. AdvancedMarker usa
        // gmpDraggable + default anchor (centro). Para simular anchor bottom,
        // compensamos o content com translate Y negativo via CSS inline.
        gmpDraggable: !!onWaypointDrag,
      });

      // Click -> InfoWindow
      marker.addListener("click", (e: google.maps.MapMouseEvent) => {
        e.stop();
        if (!infoWindowRef.current) return;
        const idxLabel =
          wp.waypointIndex === 0
            ? "Origem"
            : wp.waypointIndex === waypoints.length - 1
              ? "Destino"
              : `${wp.waypointIndex}ª Parada`;
        infoWindowRef.current.setContent(
          `<div class="text-xs font-bold p-1">
            <span class="text-slate-500">${idxLabel}: </span>
            ${waypoints[wp.waypointIndex]?.label ?? ""}
          </div>`,
        );
        infoWindowRef.current.setPosition({
          lat: wp.lat as number,
          lng: wp.lng as number,
        });
        infoWindowRef.current.open(map);
      });

      // Drag end -> callback para o parent atualizar coords
      if (onWaypointDrag) {
        marker.addListener("dragend", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const realIndex =
            waypointIndices?.[wp.waypointIndex] ?? wp.waypointIndex;
          onWaypointDrag(realIndex, {
            lat: e.latLng.lat(),
            lng: e.latLng.lng(),
          });
        });
      }

      markersRef.current.push(marker);
    });
  }, [
    google,
    pointsWithCoords,
    waypoints,
    markerScale,
    onWaypointDrag,
    waypointIndices,
  ]);

  // Busca a rota real pelas ruas usando Google Directions API
  useEffect(() => {
    if (!google || !mapRef.current || pointsWithCoords.length < 2) {
      polylineRef.current?.setMap(null);
      polylineCasingRef.current?.setMap(null);
      polylineRef.current = null;
      polylineCasingRef.current = null;
      return;
    }

    const map = mapRef.current;
    const directionsService = new google.maps.DirectionsService();

    // Directions API aceita no max 25 waypoints (origem + destino + 23 paradas).
    // Para OS com mais paradas, usamos os primeiros 23 intermediarios.
    const origin = pointsWithCoords[0];
    const destination = pointsWithCoords[pointsWithCoords.length - 1];
    const intermediates = pointsWithCoords
      .slice(1, -1)
      .slice(0, 23)
      .map((wp) => ({
        location: { lat: wp.lat as number, lng: wp.lng as number },
        stopover: true,
      }));

    directionsService
      .route({
        origin: { lat: origin.lat as number, lng: origin.lng as number },
        destination: {
          lat: destination.lat as number,
          lng: destination.lng as number,
        },
        waypoints: intermediates,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      })
      .then((result) => {
        // Constroi uma unica Polyline com o overview_path do resultado.
        const path = result.routes[0].overview_path;

        // Casing (contorno azul-escuro) por baixo da linha principal,
        // igual ao estilo Google Maps.
        polylineCasingRef.current?.setMap(null);
        polylineCasingRef.current = new google.maps.Polyline({
          map,
          path,
          strokeColor: "#1a5fc8",
          strokeWeight: 8,
          strokeOpacity: 0.9,
          geodesic: true,
        });

        polylineRef.current?.setMap(null);
        polylineRef.current = new google.maps.Polyline({
          map,
          path,
          strokeColor: "#4285F4",
          strokeWeight: 5,
          strokeOpacity: 1,
          geodesic: true,
        });
      })
      .catch(() => {
        // Fallback: linha reta conectando os waypoints
        const straightPath = pointsWithCoords.map((wp) => ({
          lat: wp.lat as number,
          lng: wp.lng as number,
        }));
        polylineCasingRef.current?.setMap(null);
        polylineCasingRef.current = new google.maps.Polyline({
          map,
          path: straightPath,
          strokeColor: "#1a5fc8",
          strokeWeight: 8,
          strokeOpacity: 0.9,
          geodesic: true,
        });
        polylineRef.current?.setMap(null);
        polylineRef.current = new google.maps.Polyline({
          map,
          path: straightPath,
          strokeColor: "#4285F4",
          strokeWeight: 5,
          strokeOpacity: 1,
          geodesic: true,
        });
      });
  }, [google, pointsWithCoords]);

  // FitBounds quando o mapa carrega ou os pontos mudam
  useEffect(() => {
    if (!google || !mapRef.current || pointsWithCoords.length === 0) return;

    const map = mapRef.current;

    if (pointsWithCoords.length === 1) {
      map.panTo({
        lat: pointsWithCoords[0].lat as number,
        lng: pointsWithCoords[0].lng as number,
      });
      map.setZoom(15);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    pointsWithCoords.forEach((wp) => {
      bounds.extend({
        lat: wp.lat as number,
        lng: wp.lng as number,
      });
    });
    map.fitBounds(bounds, 40);
  }, [google, pointsWithCoords]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => (m.map = null));
      polylineRef.current?.setMap(null);
      polylineCasingRef.current?.setMap(null);
      infoWindowRef.current?.close();
    };
  }, []);

  // Sem API key configurada
  if (!hasGoogleMapsKey()) {
    return (
      <div className="w-full h-48 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 flex flex-col items-center justify-center gap-2 text-amber-700">
        <MapPin size={28} className="text-amber-400" />
        <p className="text-xs font-black uppercase tracking-widest text-amber-600">
          Token Google Maps nao configurado
        </p>
        <p className="text-[10px] font-medium text-amber-500/70">
          Adicione NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no .env.local
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-48 rounded-2xl border-2 border-dashed border-red-200 bg-red-50/50 flex flex-col items-center justify-center gap-2 text-red-700">
        <MapPin size={28} className="text-red-400" />
        <p className="text-xs font-black uppercase tracking-widest text-red-600">
          Erro ao carregar Google Maps
        </p>
        <p className="text-[10px] font-medium text-red-500/70">
          {error.message}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-80 rounded-2xl overflow-hidden border border-slate-200 shadow-sm"
    >
      {!isLoaded && (
        <div className="w-full h-full bg-slate-100 animate-pulse flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Carregando mapa...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
