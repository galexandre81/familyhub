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
  | "livre-recettes"
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

export interface WeatherWeeklyDay {
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
  weekly: WeatherWeeklyDay[];
}

export interface WeatherData {
  byLocation: Record<string, WeatherSingleLocationData>;
}

export interface CalendarConfig {
  daysAhead: number;
  maxEvents: number;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  startISO: string;
  endISO: string;
  allDay: boolean;
  location?: string;
}

export interface CalendarData {
  events: CalendarEvent[];
  fetchedAt: string;
}

/* --- Kitchen Buddy (Phase 3) ---
 * Sous-ensemble des types `@family-hub/types/kitchenBuddy/*` nécessaires
 * côté Cloud Functions. Garder aligné avec packages/types/src/kitchenBuddy/.
 */

export type RayonCourses =
  | "frais-fruits-legumes"
  | "frais-laitier"
  | "frais-boucherie"
  | "frais-poissonnerie"
  | "sec-epicerie"
  | "surgele"
  | "boulangerie"
  | "autre";

export type Repas = "petitDej" | "dej" | "diner";
export type MealPlanStatut = "draft" | "active" | "archived";
export type SlotStatut = "vide" | "propose" | "accepte";
export type RecetteStatut = "draft" | "accepted" | "favorite";
export type RecetteOrigine = "llm" | "manuelle" | "import" | "seed";
export type RecetteSaison = "hiver" | "printemps" | "ete" | "automne" | "toutes";

export interface ProfilSnapshot {
  nom: string;
  regimes: string[];
  aversions: string[];
  objectifsNutrition: string[];
  prefsCuisson: string[];
  notes?: string;
}

export interface RecetteIngredient {
  libelle: string;
  quantite: string;
  unite: string;
  rayon: RayonCourses;
}

export interface RecetteEtape {
  ordre: number;
  description: string;
  dureeMinutes?: number;
}
