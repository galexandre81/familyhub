import { describe, it, expect } from "vitest";
import { transformOpenMeteoToLocationData } from "./weather";

/**
 * Construit une réponse Open-Meteo factice avec des séries horaires déterministes.
 * `hourlyStart` est l'heure de DÉBUT des données horaires (souvent minuit local),
 * volontairement décalée de `current_weather.time` pour exercer l'ancrage.
 */
function buildResponse(opts: {
  currentTime?: string;
  currentTemp?: number;
  currentCode?: number;
  isDay?: 0 | 1;
  hourlyStartHour?: number; // ex 0 = minuit ; les heures suivantes sont +1h chacune
  hourlyCount?: number;
  withHourly?: boolean;
  withDaily?: boolean;
}) {
  const {
    currentTime = "2026-06-17T14:00",
    currentTemp = 21,
    currentCode = 0,
    isDay = 1,
    hourlyStartHour = 0,
    hourlyCount = 24,
    withHourly = true,
    withDaily = true,
  } = opts;

  const json: Record<string, unknown> = {
    current_weather: {
      temperature: currentTemp,
      weathercode: currentCode,
      is_day: isDay,
      time: currentTime,
    },
  };

  if (withHourly) {
    const time: string[] = [];
    const temperature_2m: number[] = [];
    const weather_code: number[] = [];
    const datePrefix = currentTime.slice(0, 10); // "YYYY-MM-DD"
    for (let i = 0; i < hourlyCount; i++) {
      const hour = hourlyStartHour + i;
      const hh = String(hour).padStart(2, "0");
      time.push(`${datePrefix}T${hh}:00`);
      // Température = l'heure elle-même, pour vérifier facilement l'index choisi.
      temperature_2m.push(hour);
      // weather_code = 3 (couvert) partout sauf l'heure courante (=currentCode),
      // ce qui permet de distinguer "index 0" de "heure courante".
      weather_code.push(3);
    }
    json.hourly = { time, temperature_2m, weather_code };
  }

  if (withDaily) {
    json.daily = {
      time: ["2026-06-17", "2026-06-18"],
      temperature_2m_max: [25, 27],
      temperature_2m_min: [12, 13],
      sunrise: ["2026-06-17T05:48", "2026-06-18T05:48"],
      sunset: ["2026-06-17T21:34", "2026-06-18T21:35"],
      weather_code: [0, 61],
    };
  }

  return json as never;
}

describe("transformOpenMeteoToLocationData", () => {
  it("maps current temperature, weather code, label and icon", () => {
    const json = buildResponse({ currentTemp: 18, currentCode: 0, isDay: 1 });
    const out = transformOpenMeteoToLocationData(json, [0, 6, 12]);

    expect(out.current.tempC).toBe(18);
    expect(out.current.weatherCode).toBe(0);
    expect(out.current.label).toBe("Ensoleillé");
    expect(out.current.iconKey).toBe("sun");
  });

  it("uses the night icon for the current condition when is_day is 0", () => {
    const json = buildResponse({ currentCode: 0, isDay: 0 });
    const out = transformOpenMeteoToLocationData(json, [0]);
    expect(out.current.iconKey).toBe("moon");
  });

  it("anchors forecastHours offsets to the CURRENT hour, not array index 0", () => {
    // current_weather.time = 14:00, hourly commence à minuit (index 0 = 00:00).
    // forecastHours [0, 6] doit donc pointer 14:00 (temp=14) et 20:00 (temp=20),
    // PAS l'index 0 (00:00, temp=0) ni l'index 6 (06:00, temp=6).
    const json = buildResponse({
      currentTime: "2026-06-17T14:00",
      hourlyStartHour: 0,
      hourlyCount: 24,
    });
    const out = transformOpenMeteoToLocationData(json, [0, 6]);

    expect(out.forecast).toHaveLength(2);
    expect(out.forecast[0].hourOffset).toBe(0);
    expect(out.forecast[0].tempC).toBe(14); // 14:00, l'heure courante
    expect(out.forecast[1].hourOffset).toBe(6);
    expect(out.forecast[1].tempC).toBe(20); // 14:00 + 6h = 20:00
  });

  it("clamps forecast offsets that fall beyond the hourly array bounds", () => {
    // current = 22:00, hourly va de 00:00 à 23:00 (24 valeurs). offset 6 = 28:00,
    // hors limites → doit être borné au dernier index (23:00, temp=23).
    const json = buildResponse({
      currentTime: "2026-06-17T22:00",
      hourlyStartHour: 0,
      hourlyCount: 24,
    });
    const out = transformOpenMeteoToLocationData(json, [0, 6]);

    expect(out.forecast[0].tempC).toBe(22); // heure courante
    expect(out.forecast[1].tempC).toBe(23); // borné au dernier point dispo
  });

  it("falls back to current weather for the forecast when hourly is missing", () => {
    const json = buildResponse({
      currentTemp: 17,
      currentCode: 3,
      withHourly: false,
    });
    const out = transformOpenMeteoToLocationData(json, [0, 6, 12]);

    expect(out.forecast).toHaveLength(3);
    for (const point of out.forecast) {
      expect(point.tempC).toBe(17);
      expect(point.weatherCode).toBe(3);
      expect(point.iconKey).toBe("cloud");
    }
  });

  it("derives daily min/max and trims sunrise/sunset to HH:MM when daily is present", () => {
    const json = buildResponse({});
    const out = transformOpenMeteoToLocationData(json, [0]);

    expect(out.daily.minC).toBe(12);
    expect(out.daily.maxC).toBe(25);
    expect(out.daily.sunrise).toBe("05:48");
    expect(out.daily.sunset).toBe("21:34");
    expect(out.weekly).toHaveLength(2);
    expect(out.weekly[0].date).toBe("2026-06-17");
    expect(out.weekly[1].iconKey).toBe("rain"); // weather_code 61 = pluie
  });

  it("degrades gracefully when daily is missing (no weekly, daily falls back to current temp)", () => {
    const json = buildResponse({ currentTemp: 19, withDaily: false });
    const out = transformOpenMeteoToLocationData(json, [0]);

    expect(out.weekly).toEqual([]);
    expect(out.daily.minC).toBe(19);
    expect(out.daily.maxC).toBe(19);
    expect(out.daily.sunrise).toBe("");
    expect(out.daily.sunset).toBe("");
  });

  it("throws when current_weather is missing", () => {
    const json = { hourly: { time: [], temperature_2m: [], weather_code: [] } } as never;
    expect(() => transformOpenMeteoToLocationData(json, [0])).toThrow();
  });
});
