/**
 * `Timestamp` is intentionally `unknown`-ish here because the package is shared between
 * Cloud Functions (admin SDK Timestamp) and the hub (web SDK Timestamp). Each consumer
 * narrows it locally via the appropriate Firestore import.
 */
export type Timestamp = { seconds: number; nanoseconds: number } | Date | string;

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
  | "weekly-menu"
  | "batch-mode"
  | "livre-recettes"
  | "cuisine-quoi"
  | "profils"
  | "settings";

export type DisplayDeviceType = "ipad-mini-1" | "modern-tablet" | "desktop" | "mobile";

export type Theme = "light" | "dark" | "auto";

export type Language = "fr" | "en";

export type UnitSystem = "metric" | "imperial";

export interface Localisation {
  ville: string;
  pays: string;
  lat: number;
  lon: number;
  timezone: string;
}
