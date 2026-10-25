import type { DisplayLayoutEntry, TileType, WeatherConfig } from "@family-hub/types";
import {
  defaultCalendarConfig,
  defaultLivreRecettesConfig,
  defaultRadioStations,
  defaultRecipeTodayConfig,
  defaultTimerPresets,
} from "@family-hub/types";

/** Sources de données dont le tableau de cuisine de l'iPad a besoin. */
export const TYPES_TABLEAU: TileType[] = [
  "weather",
  "calendar",
  "weekly-menu",
  "recipe-today",
  "timer",
  "radio",
  "settings",
  "livre-recettes",
];

/** Types qui n'ont plus leur place sur l'iPad de cuisine. */
export const TYPES_RETIRES: TileType[] = ["shopping-list", "clock"];

const COLONNES = 4;

export interface TuileMinimale {
  id: string;
  type: string;
}

export interface ResultatCuisine {
  layout: DisplayLayoutEntry[];
  /** Types pour lesquels aucune tuile n'existe encore dans le foyer. */
  aCreer: TileType[];
  /** Identifiants de tuiles retirées de la liste. */
  retirees: string[];
}

/** Types déjà présents dans la liste de l'écran. */
export function typesPresents(
  layout: DisplayLayoutEntry[],
  tuiles: TuileMinimale[],
): Set<string> {
  const parId = new Map(tuiles.map((t) => [t.id, t.type]));
  const types = new Set<string>();
  for (const e of layout) {
    const t = parId.get(e.tileId);
    if (t) types.add(t);
  }
  return types;
}

/**
 * Calcule la liste de sources d'un écran de cuisine : ajoute les tuiles
 * existantes qui manquent, retire liste de courses et horloge, garde le reste.
 * Les types sans aucune tuile sont renvoyés dans `aCreer` ; après leur
 * création, rappeler la fonction avec la liste de tuiles complétée.
 * Les positions n'ont plus de sens à l'écran : elles sont seulement uniques.
 */
export function layoutCuisine(
  layoutActuel: DisplayLayoutEntry[],
  tuiles: TuileMinimale[],
): ResultatCuisine {
  const parId = new Map(tuiles.map((t) => [t.id, t.type]));
  const retirees: string[] = [];
  const layout: DisplayLayoutEntry[] = [];
  for (const e of layoutActuel) {
    const type = parId.get(e.tileId);
    if (type && (TYPES_RETIRES as string[]).includes(type)) retirees.push(e.tileId);
    else layout.push(e);
  }

  const occupees = new Set<string>();
  for (const e of layout) {
    for (let c = e.position.col; c < e.position.col + e.position.w; c++) {
      for (let r = e.position.row; r < e.position.row + e.position.h; r++) {
        occupees.add(`${c},${r}`);
      }
    }
  }
  function placeLibre() {
    for (let i = 0; ; i++) {
      const col = i % COLONNES;
      const row = Math.floor(i / COLONNES);
      if (!occupees.has(`${col},${row}`)) {
        occupees.add(`${col},${row}`);
        return { col, row, w: 1, h: 1 };
      }
    }
  }

  const presents = typesPresents(layout, tuiles);
  const aCreer: TileType[] = [];
  for (const type of TYPES_TABLEAU) {
    if (presents.has(type)) continue;
    const tuile = tuiles.find((t) => t.type === type);
    if (tuile) layout.push({ tileId: tuile.id, position: placeLibre() });
    else aCreer.push(type);
  }
  return { layout, aCreer, retirees };
}

export interface TuileACreer {
  nom: string;
  config: Record<string, unknown>;
  refreshIntervalSeconds: number;
}

export const NOMS_SOURCES: Record<string, string> = {
  weather: "Météo",
  calendar: "Agenda",
  "weekly-menu": "Menu de la semaine",
  "recipe-today": "Recette du jour",
  timer: "Minuteur",
  radio: "Radio",
  settings: "Réglages",
  "livre-recettes": "Livre de recettes",
};

/** Tuile par défaut pour un type manquant (météo : lieu du foyer). */
export function tuileParDefaut(
  type: TileType,
  localisation?: { ville: string; lat: number; lon: number },
): TuileACreer {
  const nom = NOMS_SOURCES[type] ?? "Tuile";
  switch (type) {
    case "weather": {
      const id = `loc-${Date.now()}`;
      const config: WeatherConfig = {
        locations: [
          {
            id,
            ville: localisation?.ville ?? "Paris",
            lat: localisation?.lat ?? 48.8566,
            lon: localisation?.lon ?? 2.3522,
          },
        ],
        selectedLocationId: id,
        forecastHours: [0, 6, 12],
      };
      return {
        nom: localisation?.ville ? `Météo ${localisation.ville}` : nom,
        config: config as unknown as Record<string, unknown>,
        refreshIntervalSeconds: 1800,
      };
    }
    case "calendar":
      return { nom, config: defaultCalendarConfig as unknown as Record<string, unknown>, refreshIntervalSeconds: 900 };
    case "radio":
      return {
        nom,
        config: { stations: defaultRadioStations, defaultStationId: defaultRadioStations[0]?.id ?? "" },
        refreshIntervalSeconds: 0,
      };
    case "timer":
      return { nom, config: { presets: defaultTimerPresets }, refreshIntervalSeconds: 0 };
    case "livre-recettes":
      return { nom, config: defaultLivreRecettesConfig as unknown as Record<string, unknown>, refreshIntervalSeconds: 0 };
    case "recipe-today":
      return { nom, config: defaultRecipeTodayConfig as unknown as Record<string, unknown>, refreshIntervalSeconds: 1800 };
    case "weekly-menu":
      return { nom, config: {}, refreshIntervalSeconds: 3600 };
    default:
      return { nom, config: {}, refreshIntervalSeconds: 0 };
  }
}
