import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import type {
  WeatherConfig,
  WeatherData,
  WeatherIconKey,
  WeatherLocation,
  WeatherSingleLocationData,
  WeatherWeeklyDay,
} from "../types";
import { admin, db } from "../lib/admin";
import { assertHouseholdMember } from "../lib/household";
import { rebuildSnapshotForTile } from "../snapshot/builder";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

interface OpenMeteoResponse {
  current_weather?: {
    temperature: number;
    weathercode: number;
    is_day: 0 | 1;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
    weather_code?: number[];
  };
}

function weatherCodeToIconKey(code: number, isDay: boolean): WeatherIconKey {
  if (code === 0) return isDay ? "sun" : "moon";
  if (code <= 2) return isDay ? "cloud-sun" : "cloud-moon";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95) return "storm";
  return "cloud";
}

function weatherCodeToLabel(code: number): string {
  if (code === 0) return "Ensoleillé";
  if (code <= 2) return "Partiellement nuageux";
  if (code === 3) return "Couvert";
  if (code === 45 || code === 48) return "Brouillard";
  if (code >= 51 && code <= 57) return "Bruine";
  if (code >= 61 && code <= 67) return "Pluie";
  if (code >= 71 && code <= 77) return "Neige";
  if (code >= 80 && code <= 82) return "Averses";
  if (code >= 85 && code <= 86) return "Averses de neige";
  if (code >= 95) return "Orage";
  return "Inconnu";
}

function transformOpenMeteoToLocationData(
  json: OpenMeteoResponse,
  forecastHours: number[],
): WeatherSingleLocationData {
  const cw = json.current_weather;
  if (!cw) {
    throw new HttpsError("internal", "Réponse Open-Meteo invalide (current_weather manquant)");
  }
  const isDay = cw.is_day === 1;

  const forecast = (forecastHours ?? [0, 6, 12]).map((hourOffset) => {
    const idx = Math.max(0, hourOffset);
    const hourly = json.hourly;
    if (!hourly) {
      return {
        hourOffset,
        tempC: cw.temperature,
        weatherCode: cw.weathercode,
        iconKey: weatherCodeToIconKey(cw.weathercode, isDay),
      };
    }
    const tempC = hourly.temperature_2m[idx] ?? cw.temperature;
    const wc = hourly.weather_code[idx] ?? cw.weathercode;
    return {
      hourOffset,
      tempC,
      weatherCode: wc,
      iconKey: weatherCodeToIconKey(wc, isDay),
    };
  });

  const daily = json.daily;
  const weekly: WeatherWeeklyDay[] = [];
  if (daily) {
    const len = Math.min(
      daily.time?.length ?? 0,
      daily.temperature_2m_max?.length ?? 0,
      daily.temperature_2m_min?.length ?? 0,
      daily.weather_code?.length ?? Number.POSITIVE_INFINITY,
    );
    for (let i = 0; i < Math.min(len, 7); i++) {
      const wc = daily.weather_code?.[i] ?? cw.weathercode;
      weekly.push({
        date: daily.time[i],
        minC: daily.temperature_2m_min[i],
        maxC: daily.temperature_2m_max[i],
        weatherCode: wc,
        iconKey: weatherCodeToIconKey(wc, true),
      });
    }
  }

  return {
    current: {
      tempC: cw.temperature,
      weatherCode: cw.weathercode,
      label: weatherCodeToLabel(cw.weathercode),
      iconKey: weatherCodeToIconKey(cw.weathercode, isDay),
    },
    forecast,
    daily: {
      minC: daily?.temperature_2m_min[0] ?? cw.temperature,
      maxC: daily?.temperature_2m_max[0] ?? cw.temperature,
      sunrise: (daily?.sunrise[0] ?? "").slice(11, 16),
      sunset: (daily?.sunset[0] ?? "").slice(11, 16),
    },
    weekly,
  };
}

async function fetchOpenMeteo(loc: WeatherLocation): Promise<OpenMeteoResponse> {
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    current_weather: "true",
    hourly: "temperature_2m,weather_code",
    daily: "temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset",
    forecast_days: "7",
    timezone: loc.timezone || "auto",
  });
  const url = `${OPEN_METEO_BASE}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new HttpsError("internal", `Open-Meteo a répondu ${res.status} pour ${loc.ville}`);
  }
  return (await res.json()) as OpenMeteoResponse;
}

/**
 * Compat : accepte aussi le vieux format single-location (lat/lon/ville à la racine du config).
 * Convertit en `{ locations: [...], selectedLocationId }` au runtime.
 */
function normalizeWeatherConfig(rawConfig: Record<string, unknown>): WeatherConfig {
  const cfg = rawConfig as Partial<WeatherConfig> & {
    lat?: number; lon?: number; ville?: string;
  };
  if (cfg.locations && Array.isArray(cfg.locations) && cfg.locations.length > 0) {
    return {
      locations: cfg.locations,
      selectedLocationId: cfg.selectedLocationId || cfg.locations[0].id,
      forecastHours: cfg.forecastHours || [0, 6, 12],
    };
  }
  // Vieux format : un seul lieu à la racine
  if (typeof cfg.lat === "number" && typeof cfg.lon === "number" && cfg.ville) {
    const fallbackId = "default";
    return {
      locations: [
        { id: fallbackId, ville: cfg.ville, lat: cfg.lat, lon: cfg.lon },
      ],
      selectedLocationId: fallbackId,
      forecastHours: cfg.forecastHours || [0, 6, 12],
    };
  }
  throw new HttpsError("failed-precondition", "Config météo invalide : ni locations[] ni lat/lon/ville");
}

async function buildWeatherDataForConfig(config: WeatherConfig): Promise<WeatherData> {
  const byLocation: Record<string, WeatherSingleLocationData> = {};
  for (const loc of config.locations) {
    try {
      const json = await fetchOpenMeteo(loc);
      byLocation[loc.id] = transformOpenMeteoToLocationData(json, config.forecastHours);
    } catch (err) {
      logger.error(`Échec fetch météo pour ${loc.ville}`, err);
      // On continue avec les autres locations ; la location en erreur sera absente de byLocation.
    }
  }
  return { byLocation };
}

export const refreshWeatherTile = onCall(
  { region: "europe-west1", invoker: "public" },
  async (req) => {
    logger.info("refreshWeatherTile START", { auth: req.auth?.uid, data: req.data });
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");

    const { householdId, tileId } = req.data as { householdId: string; tileId: string };
    if (!householdId || !tileId) {
      throw new HttpsError("invalid-argument", "householdId et tileId requis");
    }

    await assertHouseholdMember(uid, householdId);
    logger.info("Membership OK", { uid, householdId });

    const tileSnap = await db.doc(`households/${householdId}/tiles/${tileId}`).get();
    if (!tileSnap.exists) {
      throw new HttpsError("not-found", `Tile ${tileId} introuvable`);
    }
    const tile = tileSnap.data();
    if (tile?.type !== "weather") {
      throw new HttpsError("failed-precondition", `Tile ${tileId} n'est pas de type weather (got ${tile?.type})`);
    }
    logger.info("Tile loaded", { type: tile.type, config: tile.config });

    const config = normalizeWeatherConfig(tile.config as Record<string, unknown>);
    logger.info("Refreshing weather for locations", { count: config.locations.length });

    const tileData = await buildWeatherDataForConfig(config);
    const fetchedIds = Object.keys(tileData.byLocation);
    logger.info("Open-Meteo fetched", { fetched: fetchedIds, total: config.locations.length });

    if (fetchedIds.length === 0) {
      throw new HttpsError("internal", "Aucune location n'a pu être rafraîchie");
    }

    await rebuildSnapshotForTile(householdId, tileId, "weather", tileData);
    logger.info("refreshWeatherTile DONE");

    return { success: true, locationsFetched: fetchedIds.length, locationsTotal: config.locations.length };
  },
);

export const scheduledWeatherRefresh = onSchedule(
  { schedule: "every 30 minutes", region: "europe-west1", timeZone: "Europe/Paris" },
  async () => {
    const tilesSnap = await db.collectionGroup("tiles").where("type", "==", "weather").get();
    logger.info(`scheduledWeatherRefresh: ${tilesSnap.size} tuile(s) météo à rafraîchir`);

    for (const doc of tilesSnap.docs) {
      try {
        const tileId = doc.id;
        const householdId = doc.ref.parent.parent?.id;
        if (!householdId) continue;
        const config = normalizeWeatherConfig(doc.data().config as Record<string, unknown>);
        const tileData = await buildWeatherDataForConfig(config);
        if (Object.keys(tileData.byLocation).length === 0) {
          logger.warn(`Aucune location fetched pour tile ${doc.ref.path}, skip snapshot update`);
          continue;
        }
        await rebuildSnapshotForTile(householdId, tileId, "weather", tileData);
      } catch (err) {
        logger.error(`Échec refresh weather tile ${doc.ref.path}`, err);
      }
    }
  },
);

export { transformOpenMeteoToLocationData };
