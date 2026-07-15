"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { MapPin } from "lucide-react";
import { getMapboxTileUrl, getMapAttribution } from "@/lib/mapbox-tiles";

interface ItineraryMapWaypoint {
  label: string;
  lat: number | null;
  lng: number | null;
}

interface ItineraryMapProps {
  waypoints: ItineraryMapWaypoint[];
}

// Icones definidos fora do componente para evitar recriar a cada render.
const originIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3082/3082383.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const destIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const stopIcon = L.divIcon({
  className: "",
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#64748b;border:3px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [points, map]);
  return null;
}

export default function ItineraryMap({ waypoints }: ItineraryMapProps) {
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

  const points: [number, number][] = useMemo(
    () => pointsWithCoords.map((wp) => [wp.lat as number, wp.lng as number]),
    [pointsWithCoords],
  );

  // Centro padrão: Rio de Janeiro (caso nao haja coords)
  const center: [number, number] = points[0] ?? [-22.9068, -43.1729];

  if (pointsWithCoords.length === 0) {
    return (
      <div className="w-full h-48 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center gap-2 text-slate-400">
        <MapPin size={28} className="text-slate-300" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
          Preencha os endereços para visualizar o mapa
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-64 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={getMapboxTileUrl()} attribution={getMapAttribution()} />

        {pointsWithCoords.map((wp, idx) => {
          const isOrigin = idx === 0;
          const isDestination = idx === pointsWithCoords.length - 1;
          const icon = isOrigin ? originIcon : isDestination ? destIcon : stopIcon;
          const roleLabel = isOrigin
            ? "Origem"
            : isDestination
              ? "Destino"
              : `${idx}ª Parada`;

          return (
            <Marker
              key={`${wp.lat}-${wp.lng}-${idx}`}
              position={[wp.lat as number, wp.lng as number]}
              icon={icon}
            >
              <Popup>
                <div className="text-xs font-bold">
                  <span className="text-slate-500">{roleLabel}: </span>
                  {wp.label}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {points.length >= 2 && (
          <Polyline
            positions={points}
            color="#3b82f6"
            weight={4}
            opacity={0.6}
            dashArray="10, 10"
          />
        )}

        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}
