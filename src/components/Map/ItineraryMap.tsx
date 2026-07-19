"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import Map, {
  Marker,
  Popup,
  Source,
  Layer,
  MapRef,
  NavigationControl,
  FullscreenControl,
  ScaleControl,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin } from "lucide-react";
import type { Feature, LineString } from "geojson";

interface ItineraryMapWaypoint {
  label: string;
  lat: number | null;
  lng: number | null;
  useMapbox?: boolean;
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

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
// Mapbox Standard: style mais moderno (v3), com visual bem proximo ao Google Maps
// (POIs com icones coloridos, predios 3D sutis, cores claras).
const MAPBOX_STYLE = "mapbox://styles/mapbox/standard";

export default function ItineraryMap({
  waypoints,
  waypointIndices,
  onWaypointDrag,
}: ItineraryMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [popupInfo, setPopupInfo] = useState<{
    idx: number;
    lng: number;
    lat: number;
  } | null>(null);
  const [routeGeoJson, setRouteGeoJson] = useState<Feature<LineString> | null>(
    null,
  );
  const [zoom, setZoom] = useState<number>(12);

  // Escala dos marcadores conforme o zoom: 1.0 no zoom >= 16 (nivel rua),
  // encolhendo gradualmente ate 0.35 no zoom <= 9 (cidade vista de cima).
  const markerScale = useMemo(() => {
    const minZoom = 9;
    const maxZoom = 16;
    const minScale = 0.35;
    const t = Math.min(1, Math.max(0, (zoom - minZoom) / (maxZoom - minZoom)));
    return minScale + t * (1 - minScale);
  }, [zoom]);

  // Filtra apenas waypoints com coords validas E com useMapbox ativado
  const pointsWithCoords = useMemo(
    () =>
      waypoints
        .map((waypoint, waypointIndex) => ({ waypoint, waypointIndex }))
        .filter(
          ({ waypoint }) =>
            waypoint.useMapbox !== false &&
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

  // Fallback: linha reta (usada quando a API falha ou nao ha pontos suficientes)
  const straightLineGeoJson = useMemo<Feature<LineString> | null>(() => {
    if (pointsWithCoords.length < 2) return null;
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: pointsWithCoords.map((wp) => [
          wp.lng as number,
          wp.lat as number,
        ]),
      },
    };
  }, [pointsWithCoords]);

  // Busca a rota real pelas ruas usando Mapbox Directions API
  useEffect(() => {
    if (!MAPBOX_TOKEN || pointsWithCoords.length < 2) {
      return;
    }

    const coordinates = pointsWithCoords
      .map((wp) => `${wp.lng},${wp.lat}`)
      .join(";");

    // overview=full: geometria em resolucao maxima (o padrao "simplified"
    // devolve poucos pontos e a linha sai das ruas nas curvas).
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&steps=false&access_token=${MAPBOX_TOKEN}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.routes && data.routes.length > 0) {
          setRouteGeoJson({
            type: "Feature",
            properties: {},
            geometry: data.routes[0].geometry,
          });
        } else {
          setRouteGeoJson(straightLineGeoJson);
        }
      })
      .catch(() => {
        setRouteGeoJson(straightLineGeoJson);
      });
  }, [pointsWithCoords, straightLineGeoJson]);

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
    if (!mapRef.current || pointsWithCoords.length === 0) return;

    // Se so tem 1 ponto, centraliza nele com zoom 15
    if (pointsWithCoords.length === 1) {
      mapRef.current.flyTo({
        center: [
          pointsWithCoords[0].lng as number,
          pointsWithCoords[0].lat as number,
        ],
        zoom: 15,
        duration: 1000,
      });
      return;
    }

    // Se tem 2+ pontos, fitBounds para mostrar todos
    const lons = pointsWithCoords.map((wp) => wp.lng as number);
    const lats = pointsWithCoords.map((wp) => wp.lat as number);
    mapRef.current.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: 40, duration: 1000 },
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

  return (
    <div className="w-full h-80 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        mapStyle={MAPBOX_STYLE}
        scrollZoom
        onLoad={(e) => setZoom(e.target.getZoom())}
        onZoom={(e) => setZoom(e.viewState.zoom)}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <FullscreenControl position="top-right" />
        <ScaleControl position="bottom-left" />

        {/* Linha da rota conectando os waypoints (rota real pelas ruas).
            Estilo Google Maps: linha azul #4285F4 com contorno azul-escuro. */}
        {routeGeoJson && (
          <Source id="route" type="geojson" data={routeGeoJson}>
            <Layer
              id="route-casing"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{
                "line-color": "#1a5fc8",
                "line-width": 8,
                "line-opacity": 0.9,
              }}
            />
            <Layer
              id="route-line"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{
                "line-color": "#4285F4",
                "line-width": 5,
              }}
            />
          </Source>
        )}

        {/* Marcadores */}
        {pointsWithCoords.map((wp, idx) => {
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

          return (
            <Marker
              key={`${wp.lat}-${wp.lng}-${idx}`}
              longitude={wp.lng as number}
              latitude={wp.lat as number}
              anchor="bottom"
              draggable={!!onWaypointDrag}
              onDragEnd={(e) => {
                if (!onWaypointDrag) return;
                const realIndex =
                  waypointIndices?.[wp.waypointIndex] ?? wp.waypointIndex;
                onWaypointDrag(realIndex, {
                  lat: e.lngLat.lat,
                  lng: e.lngLat.lng,
                });
              }}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setPopupInfo({
                  idx: wp.waypointIndex,
                  lng: wp.lng as number,
                  lat: wp.lat as number,
                });
              }}
            >
              <div
                className={`inline-flex items-stretch rounded-lg overflow-hidden shadow-md border text-[9px] ${bgColor} ${borderColor} text-white ${
                  onWaypointDrag ? "cursor-grab active:cursor-grabbing" : ""
                }`}
                style={{
                  // Encolhe o marcador em zoom out (anchor="bottom":
                  // escala a partir da base para o pino nao sair do lugar)
                  transform: `scale(${markerScale})`,
                  transformOrigin: "bottom center",
                }}
              >
                <span
                  className={`px-1.5 py-1 flex items-center justify-center ${iconBg}`}
                >
                  <MapPin size={11} />
                </span>
                <span className="px-2 py-1 font-black tracking-wide text-[9px]">
                  {label}
                </span>
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
                  : popupInfo.idx === waypoints.length - 1
                    ? "Destino"
                    : `${popupInfo.idx}ª Parada`}
                :{" "}
              </span>
              {waypoints[popupInfo.idx]?.label}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
