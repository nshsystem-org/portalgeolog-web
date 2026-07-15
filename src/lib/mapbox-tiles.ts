// Helper para URLs de tiles de mapa.
// Prioriza Mapbox (visual similar ao Google Maps, melhor precisao para BR).
// Se o token Mapbox nao estiver configurado, faz fallback para OpenStreetMap.

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

// Style "streets-v12" do Mapbox: ruas nomeadas, visual familiar.
const MAPBOX_STYLE = "mapbox/streets-v12";

export function getMapboxTileUrl(): string {
  if (MAPBOX_TOKEN) {
    return `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE}/tiles/256/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`;
  }
  // Fallback OpenStreetMap (gratis, sem token)
  return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
}

export function getMapAttribution(): string {
  if (MAPBOX_TOKEN) {
    return '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://www.mapbox.com/about/maps/">Mapbox</a>';
  }
  return '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
}

export function hasMapboxToken(): boolean {
  return Boolean(MAPBOX_TOKEN);
}
