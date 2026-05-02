/**
 * Open-Meteo Geocoding API : ville → { lat, lon, pays, timezone, … }.
 * Gratuit, pas de clé. Doc : https://open-meteo.com/en/docs/geocoding-api
 */

export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code?: string;
  timezone: string;
  admin1?: string;
  admin2?: string;
  population?: number;
}

interface ApiResponse {
  results?: GeocodingResult[];
}

const ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";

export async function searchCity(
  query: string,
  options: { count?: number; language?: string } = {},
): Promise<GeocodingResult[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({
    name: query.trim(),
    count: String(options.count ?? 5),
    language: options.language ?? "fr",
    format: "json",
  });
  const res = await fetch(`${ENDPOINT}?${params}`);
  if (!res.ok) {
    throw new Error(`Geocoding failed: ${res.status}`);
  }
  const data = (await res.json()) as ApiResponse;
  return data.results ?? [];
}

export function formatCityLabel(r: GeocodingResult): string {
  const parts = [r.name];
  if (r.admin1 && r.admin1 !== r.name) parts.push(r.admin1);
  parts.push(r.country);
  return parts.join(", ");
}
