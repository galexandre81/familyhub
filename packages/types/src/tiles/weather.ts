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
  /** ID de la location à afficher dans la vue compacte de la tuile */
  selectedLocationId: string;
  /** Heures de prévision relatives au présent, ex: [0, 6, 12] */
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
  /** Format "HH:MM" en time-zone locale */
  sunrise: string;
  sunset: string;
}

export interface WeatherWeeklyDay {
  /** ISO "YYYY-MM-DD" */
  date: string;
  minC: number;
  maxC: number;
  weatherCode: number;
  iconKey: WeatherIconKey;
}

export interface WeatherSingleLocationData {
  current: WeatherCurrent;
  forecast: WeatherForecastPoint[];
  daily: WeatherDaily;
  /** Prévision sur ~7 jours (jour 0 = aujourd'hui) */
  weekly: WeatherWeeklyDay[];
}

/**
 * Snapshot data pour une tuile météo : un dict de données par locationId.
 * La vue compacte lit `byLocation[selectedLocationId]`.
 * La vue expand affiche toutes les locations.
 */
export interface WeatherData {
  byLocation: Record<string, WeatherSingleLocationData>;
}
