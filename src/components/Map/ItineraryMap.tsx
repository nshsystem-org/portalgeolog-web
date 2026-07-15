"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import Map, { Marker, Popup, Source, Layer, MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin } from "lucide-react";

interface ItineraryMapWaypoint {
  label: string;
  lat: number | null;
  lng: number | null;
}

interface ItineraryMapProps {
  waypoints: ItineraryMapWaypoint[];
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const MAPBOX_STYLE = "mapbox://styles/mapbox/streets-v12";

export default function ItineraryMap({ waypoints }: ItineraryMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [popupInfo, setPopupInfo] = useState<{
    idx: number;
    lng: number;
    lat: number;
  } | null>(null);

  // Filtra apenas waypoints com coords validas
  const pointsWithCoords = useMemo(
    () =>
      waypoints.filter(
        (wp) =>
          wp.lat !== null &&
          wp.lng !== null &&
          !Number.isNaN(wp.lat) &&
          !Number.isNaN(wp.lng),
      ),
    [waypoints],
  );

  // GeoJSON da rota (linha conectando os waypoints na ordem)
  const routeGeoJson = useMemo(() => {
    if (pointsWithCoords.length < 2) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: pointsWithCoords.map((wp) => [
          wp.lng as number,
          wp.lat as number,
        ]),
      },
    };
  }, [pointsWithCoords]);

  // Centro inicial: primeiro waypoint ou Rio de Janeiro
  const initialViewState = useMemo(() => {
    if (pointsWithCoords.length === 0) {
      return { longitude: -43.1729, latitude: -22.9068, zoom: 11 };
    }
    if (pointsWithCoords.length === 1) {
      return {
        longitude: pointsWithCoords[0].lng as number,
        latitude: pointsWithCoords[0].lat as number,
        zoom: 15,
      };
    }
    // Multiplos pontos: centro do bounding box
    const lons = pointsWithCoords.map((wp) => wp.lng as number);
    const lats = pointsWithCoords.map((wp) => wp.lat as number);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    return {
      longitude: (minLon + maxLon) / 2,
      latitude: (minLat + maxLat) / 2,
      zoom: 12,
    };
  }, [pointsWithCoords]);

  // FitBounds quando o mapa carrega ou os pontos mudam
  useEffect(() => {
    if (!mapRef.current || pointsWithCoords.length < 2) return;
    const lons = pointsWithCoords.map((wp) => wp.lng as number);
    const lats = pointsWithCoords.map((wp) => wp.lat as number);
    mapRef.current.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: 40 },
    );
  }, [pointsWithCoords]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="w-full h-48 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 flex flex-col items-center justify-center gap-2 text-amber-700">
        <MapPin size={28} className="text-amber-400" />
        <p className="text-xs font-black uppercase tracking-widest text-amber-600">
          Token Mapbox nao configurado
        </p>
        <p className="text-[10px] font-medium text-amber-500/70">
          Adicione NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN no .env.local
        </p>
      </div>
    );
  }

  if (pointsWithCoords.length === 0) {
    return (
      <div className="w-full h-48 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center gap-2 text-slate-400">
        <MapPin size={28} className="text-slate-300" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
          Preencha os enderecos para visualizar o mapa
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-64 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        mapStyle={MAPBOX_STYLE}
        scrollZoom={false}
        style={{ width: "100%", height: "100%" }}
        cooperativeGestures
      >
        {/* Linha da rota conectando os waypoints */}
        {routeGeoJson && (
          <Source id="route" type="geojson" data={routeGeoJson}>
            <Layer
              id="route-line"
              type="line"
              paint={{
                "line-color": "#3b82f6",
                "line-width": 4,
                "line-opacity": 0.6,
                "line-dasharray": [2, 1],
              }}
            />
          </Source>
        )}

        {/* Marcadores */}
        {pointsWithCoords.map((wp, idx) => {
          const isOrigin = idx === 0;
          const isDestination = idx === pointsWithCoords.length - 1;

          return (
            <Marker
              key={`${wp.lat}-${wp.lng}-${idx}`}
              longitude={wp.lng as number}
              latitude={wp.lat as number}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setPopupInfo({
                  idx,
                  lng: wp.lng as number,
                  lat: wp.lat as number,
                });
              }}
            >
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full border-2 border-white shadow-lg cursor-pointer transition-transform hover:scale-110 ${
                  isOrigin
                    ? "bg-emerald-500"
                    : isDestination
                      ? "bg-blue-600"
                      : "bg-slate-500"
                }`}
              >
                {isOrigin ? (
                  <span className="text-white text-xs font-black">A</span>
                ) : isDestination ? (
                  <span className="text-white text-xs font-black">B</span>
                ) : (
                  <span className="text-white text-xs font-black">
                    {idx}
                  </span>
                )}
              </div>
            </Marker>
          );
        })}

        {/* Popup do marcador selecionado */}
        {popupInfo && (
          <Popup
            longitude={popupInfo.lng}
            latitude={popupInfo.lat}
            anchor="top"
            onClose={() => setPopupInfo(null)}
            closeOnClick={false}
            closeButton={true}
          >
            <div className="text-xs font-bold p-1">
              <span className="text-slate-500">
                {popupInfo.idx === 0
                  ? "Origem"
                  : popupInfo.idx === pointsWithCoords.length - 1
                    ? "Destino"
                    : `${popupInfo.idx}ª Parada`}
                :{" "}
              </span>
              {pointsWithCoords[popupInfo.idx]?.label}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
