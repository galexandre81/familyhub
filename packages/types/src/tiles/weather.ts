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

export interface WeatherConfig {
  lat: number;
  lon: number;
  ville: string;
  /** Heures de prévision relatives au present, ex: [0, 6, 12] */
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

export interface WeatherData {
  current: WeatherCurrent;
  forecast: WeatherForecastPoint[];
  daily: WeatherDaily;
}
