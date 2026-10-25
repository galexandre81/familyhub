import { useEffect, useState } from "react";
import { AMBIANCES, ambianceAt, type Ambiance } from "@family-hub/design";
import { parseOpenMeteoSun, type SunTimes } from "./sunTimes";

/**
 * Ambiance jour/nuit du hub (design system Alpage + Veillée).
 *
 * - Sans localisation (racine de l'app : login, écrans de chargement) : on
 *   lit le lever/coucher du jour en cache s'il existe, sinon repli 07–19.
 * - Avec localisation (Layout) : on récupère lever/coucher via Open-Meteo,
 *   mis en cache `localStorage` sous `fh.sun.<YYYY-MM-DD>` (date locale).
 *
 * Recalcul chaque minute ; pose `amb-jour` / `amb-nuit` sur <html> et met à
 * jour `<meta name="theme-color">`. Les deux appels convergent : celui de la
 * racine relit le cache écrit par celui du Layout à la minute suivante.
 */

interface LocalisationSoleil {
  lat: number;
  lon: number;
  timezone: string;
}

const PREFIXE_CACHE = "fh.sun.";

function cleDuJour(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const j = String(d.getDate()).padStart(2, "0");
  return `${PREFIXE_CACHE}${y}-${m}-${j}`;
}

function lireCache(cle: string): SunTimes | null {
  try {
    const brut = window.localStorage.getItem(cle);
    if (!brut) return null;
    const v = JSON.parse(brut) as Partial<SunTimes>;
    return typeof v.sunrise === "string" && typeof v.sunset === "string"
      ? { sunrise: v.sunrise, sunset: v.sunset }
      : null;
  } catch {
    return null;
  }
}

function ecrireCache(cle: string, sun: SunTimes): void {
  try {
    window.localStorage.setItem(cle, JSON.stringify(sun));
  } catch {
    /* stockage indisponible : on se contente de l'état en mémoire */
  }
}

function appliquer(a: Ambiance): void {
  const html = document.documentElement;
  html.classList.toggle("amb-jour", a === "jour");
  html.classList.toggle("amb-nuit", a === "nuit");
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = AMBIANCES[a].fond;
}

export function useAmbiance(localisation?: LocalisationSoleil): Ambiance {
  const [maintenant, setMaintenant] = useState(() => new Date());
  const [sun, setSun] = useState<SunTimes | null>(() => lireCache(cleDuJour(new Date())));

  const cle = cleDuJour(maintenant);
  const lat = localisation?.lat;
  const lon = localisation?.lon;
  const timezone = localisation?.timezone;

  /* Horloge : recalcul chaque minute. */
  useEffect(() => {
    const id = window.setInterval(() => setMaintenant(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  /* Chaque minute : relecture du cache (l'autre appel a pu l'écrire). */
  useEffect(() => {
    const enCache = lireCache(cle);
    if (enCache) setSun(enCache);
  }, [cle, maintenant]);

  /* Une requête Open-Meteo par jour et par localisation, si rien en cache. */
  useEffect(() => {
    if (lireCache(cle)) return;
    if (lat === undefined || lon === undefined || !timezone) return;
    const ctrl = new AbortController();
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}` +
      `&daily=sunrise,sunset&forecast_days=1&timezone=${encodeURIComponent(timezone)}`;
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: unknown) => {
        const lu = parseOpenMeteoSun(json);
        if (!lu) return;
        ecrireCache(cle, lu);
        setSun(lu);
      })
      .catch(() => {
        /* hors ligne ou annulé : repli 07–19 via ambianceAt */
      });
    return () => ctrl.abort();
  }, [cle, lat, lon, timezone]);

  const ambiance = ambianceAt(maintenant, sun);

  useEffect(() => {
    appliquer(ambiance);
  }, [ambiance]);

  return ambiance;
}
