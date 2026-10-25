/**
 * Lecture des heures de lever / coucher du soleil renvoyées par Open-Meteo
 * (`daily=sunrise,sunset`). Les heures arrivent en ISO local au fuseau
 * demandé (ex. "2026-10-27T07:58") ; on n'en garde que "HH:MM".
 */
export interface SunTimes {
  sunrise: string;
  sunset: string;
}

function heure(iso: unknown): string | null {
  if (typeof iso !== "string") return null;
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : null;
}

export function parseOpenMeteoSun(json: unknown): SunTimes | null {
  if (!json || typeof json !== "object") return null;
  const daily = (json as { daily?: { sunrise?: unknown; sunset?: unknown } }).daily;
  if (!daily) return null;
  const sunrise = heure(Array.isArray(daily.sunrise) ? daily.sunrise[0] : undefined);
  const sunset = heure(Array.isArray(daily.sunset) ? daily.sunset[0] : undefined);
  return sunrise && sunset ? { sunrise, sunset } : null;
}
