/**
 * Vendored subset des types partagés (`packages/types`) utilisés par les Cloud Functions.
 *
 * Pourquoi ne pas dépendre de `@family-hub/types` directement ?
 * Parce que le déploiement Firebase Functions packe uniquement `functions/`
 * et que Cloud Build ne sait pas résoudre les workspaces npm locaux.
 *
 * Ce fichier doit rester aligné avec `packages/types/src/`. Tous les imports ici
 * sont type-only — aucun runtime cost.
 */

export type TileType =
  | "clock"
  | "weather"
  | "calendar"
  | "radio"
  | "timer"
  | "recipe-today"
  | "recipe-mode"
  | "shopping-list"
  | "meal-planner-week"
  | "cuisine-quoi";

export type WeatherIconKey =
  | "sun"
  | "moon"
  | "cloud"
  | "cloud-sun"
  | "cloud-moon"
  | "rain"
  | "snow"
  | "fog"
  | "storm";

export interface WeatherLocation {
  id: string;
  ville: string;
  pays?: string;
  lat: number;
  lon: number;
  timezone?: string;
}

export interface WeatherConfig {
  locations: WeatherLocation[];
  selectedLocationId: string;
  forecastHours: number[];
}

export interface WeatherCurrent {
  tempC: number;
  weatherCode: number;
  label: string;
  iconKey: WeatherIconKey;
}

export interface WeatherForecastPoint {
  hourOffset: number;
  tempC: number;
  weatherCode: number;
  iconKey: WeatherIconKey;
}

export interface WeatherDaily {
  minC: number;
  maxC: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherSingleLocationData {
  current: WeatherCurrent;
  forecast: WeatherForecastPoint[];
  daily: WeatherDaily;
}

export interface WeatherData {
  byLocation: Record<string, WeatherSingleLocationData>;
}
