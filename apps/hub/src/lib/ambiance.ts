import { useEffect, useState } from "react";
import { AMBIANCES, ambianceAt, type Ambiance } from "@family-hub/design";
import { parseOpenMeteoSun, type SunTimes } from "./sunTimes";

/**
 * Ambiance jour/nuit du hub (design system Alpage + Veillée).
 *
 * Deux appels au plus :
 * - racine de l'app, sans localisation (login, écrans de chargement) :
 *   repli 07–19 uniquement ;
 * - Layout, avec la localisation du foyer : lever/coucher via Open-Meteo,
 *   cache `localStorage` sous `fh.sun.<YYYY-MM-DD>.<lat>,<lon>` (2 décimales).
 *
 * Priorité : tant qu'un appel « localisé » est monté, il est seul à poser la
 * classe ; l'appel de la racine s'abstient (compteur module). Au démontage du
 * dernier appel localisé (déconnexion), le repli est réappliqué aussitôt.
 *
 * Recalcul chaque minute ; pose `amb-jour` / `amb-nuit` sur <html> et met à
 * jour `<meta name="theme-color">`.
 */

interface LocalisationSoleil {
  lat: number;
  lon: number;
  timezone: string;
}

const PREFIXE_CACHE = "fh.sun.";

/** Nombre d'appels localisés montés (Layout) : ils ont priorité sur la racine. */
let appelsLocalises = 0;

function cleDuJour(d: Date, lat: number, lon: number): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const j = String(d.getDate()).padStart(2, "0");
  return `${PREFIXE_CACHE}${y}-${m}-${j}.${lat.toFixed(2)},${lon.toFixed(2)}`;
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

function memeSoleil(a: SunTimes | null, b: SunTimes | null): boolean {
  return a?.sunrise === b?.sunrise && a?.sunset === b?.sunset;
}

export function useAmbiance(localisation?: LocalisationSoleil): Ambiance {
  const lat = localisation?.lat;
  const lon = localisation?.lon;
  const timezone = localisation?.timezone;
  const localise = lat !== undefined && lon !== undefined && !!timezone;

  const [maintenant, setMaintenant] = useState(() => new Date());
  const [sun, setSun] = useState<SunTimes | null>(null);

  const cle =
    lat !== undefined && lon !== undefined && timezone ? cleDuJour(maintenant, lat, lon) : null;

  /* Horloge : recalcul chaque minute. */
  useEffect(() => {
    const id = window.setInterval(() => setMaintenant(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  /* Priorité de l'appel localisé ; au démontage du dernier, repli 07–19. */
  useEffect(() => {
    if (!localise) return;
    appelsLocalises += 1;
    return () => {
      appelsLocalises -= 1;
      if (appelsLocalises === 0) appliquer(ambianceAt(new Date(), null));
    };
  }, [localise]);

  /* Lever / coucher : cache du jour, sinon une requête Open-Meteo par clé. */
  useEffect(() => {
    if (!cle || lat === undefined || lon === undefined || !timezone) {
      setSun((prev) => (prev === null ? prev : null));
      return;
    }
    const enCache = lireCache(cle);
    if (enCache) {
      setSun((prev) => (memeSoleil(prev, enCache) ? prev : enCache));
      return;
    }
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
        setSun((prev) => (memeSoleil(prev, lu) ? prev : lu));
      })
      .catch(() => {
        /* hors ligne ou annulé : repli 07–19 via ambianceAt */
      });
    return () => ctrl.abort();
  }, [cle, lat, lon, timezone]);

  const ambiance = ambianceAt(maintenant, sun);

  useEffect(() => {
    /* La racine s'abstient tant qu'un appel localisé est monté. */
    if (!localise && appelsLocalises > 0) return;
    appliquer(ambiance);
  }, [ambiance, localise]);

  return ambiance;
}
