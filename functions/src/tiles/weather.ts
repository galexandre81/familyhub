import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import type {
  WeatherConfig,
  WeatherData,
  WeatherIconKey,
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

function transformOpenMeteoToTileData(json: OpenMeteoResponse, config: WeatherConfig): WeatherData {
  const cw = json.current_weather;
  if (!cw) {
    throw new HttpsError("internal", "Réponse Open-Meteo invalide (current_weather manquant)");
  }
  const isDay = cw.is_day === 1;

  const forecast = (config.forecastHours ?? [0, 6, 12]).map((hourOffset) => {
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
  };
}

async function fetchOpenMeteo(config: WeatherConfig): Promise<OpenMeteoResponse> {
  const params = new URLSearchParams({
    latitude: String(config.lat),
    longitude: String(config.lon),
    current_weather: "true",
    hourly: "temperature_2m,weather_code",
    daily: "temperature_2m_max,temperature_2m_min,sunrise,sunset",
    timezone: "auto",
  });
  const url = `${OPEN_METEO_BASE}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new HttpsError("internal", `Open-Meteo a répondu ${res.status}`);
  }
  return (await res.json()) as OpenMeteoResponse;
}

export const refreshWeatherTile = onCall(
  { region: "europe-west1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");

    const { householdId, tileId } = req.data as { householdId: string; tileId: string };
    if (!householdId || !tileId) {
      throw new HttpsError("invalid-argument", "householdId et tileId requis");
    }

    await assertHouseholdMember(uid, householdId);

    const tileSnap = await db.doc(`households/${householdId}/tiles/${tileId}`).get();
    if (!tileSnap.exists) {
      throw new HttpsError("not-found", `Tile ${tileId} introuvable`);
    }
    const tile = tileSnap.data();
    if (tile?.type !== "weather") {
      throw new HttpsError("failed-precondition", `Tile ${tileId} n'est pas de type weather`);
    }

    const config = tile.config as WeatherConfig;
    const json = await fetchOpenMeteo(config);
    const tileData = transformOpenMeteoToTileData(json, config);

    await rebuildSnapshotForTile(householdId, tileId, "weather", tileData);

    return { success: true };
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
        const config = doc.data().config as WeatherConfig;
        const json = await fetchOpenMeteo(config);
        const tileData = transformOpenMeteoToTileData(json, config);
        await rebuildSnapshotForTile(householdId, tileId, "weather", tileData);
      } catch (err) {
        logger.error(`Échec refresh weather tile ${doc.ref.path}`, err);
      }
    }
  },
);

export { transformOpenMeteoToTileData };
