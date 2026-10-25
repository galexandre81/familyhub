/**
 * Minuteurs partagés avec l'iPad cuisine — logique pure.
 *
 * Document `households/{hid}/timers/{id}`, même forme que l'iPad
 * (apps/display/public/js/timer-singleton.js) : `label`, `durationSeconds`,
 * `startedAt`, `endsAt`, `status`, `pausedAt?`, `remainingSeconds?`,
 * `createdAt`, `updatedAt`. L'iPad écrit `endsAt` en Date (horloge locale) ;
 * Firestore les relit en Timestamp : tout passe par `versMs`.
 */
import type { TimerStatus } from "@family-hub/types";

/** Date, Timestamp Firestore (`toMillis`), `{ seconds, nanoseconds }` ou nombre. */
export type HorodatageLu = unknown;

export interface MinuteurLu {
  status: TimerStatus;
  endsAt: HorodatageLu;
  remainingSeconds?: number;
  durationSeconds?: number;
}

export interface Minuteur extends MinuteurLu {
  id: string;
  label: string;
  durationSeconds: number;
}

export function versMs(ts: HorodatageLu): number | null {
  if (ts === null || ts === undefined) return null;
  if (typeof ts === "number") return Number.isFinite(ts) ? ts : null;
  if (ts instanceof Date) {
    const v = ts.getTime();
    return Number.isNaN(v) ? null : v;
  }
  if (typeof ts === "object") {
    const o = ts as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
    if (typeof o.toMillis === "function") return o.toMillis();
    if (typeof o.seconds === "number") return o.seconds * 1000 + Math.floor((o.nanoseconds ?? 0) / 1e6);
  }
  return null;
}

/** Temps restant en ms (jamais négatif). En pause : `remainingSeconds`. */
export function tempsRestantMs(t: MinuteurLu, nowMs: number): number {
  if (t.status === "paused") return Math.max(0, (t.remainingSeconds ?? 0) * 1000);
  if (t.status !== "running") return 0;
  const fin = versMs(t.endsAt);
  if (fin === null) return 0;
  return Math.max(0, fin - nowMs);
}

/** Vrai quand un minuteur EN COURS vient d'atteindre zéro (à marquer `ended`). */
export function estTermine(t: MinuteurLu, nowMs: number): boolean {
  if (t.status !== "running") return false;
  const fin = versMs(t.endsAt);
  return fin !== null && nowMs >= fin;
}

const deux = (n: number) => String(n).padStart(2, "0");

/** « 09:00 », « 1:05:00 » au-delà d'une heure. Arrondi à la seconde supérieure. */
export function formatMinuteur(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${deux(m)}:${deux(s)}` : `${deux(m)}:${deux(s)}`;
}

/** Nom donné à un minuteur lancé sans nom : « 5 min », « 1 min 30 », « 1 h 05 », « 45 s ». */
export function libelleParDefaut(secondes: number): string {
  const total = Math.max(0, Math.round(secondes));
  if (total < 60) return `${total} s`;
  if (total >= 3600) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return m === 0 ? `${h} h` : `${h} h ${deux(m)}`;
  }
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m} min` : `${m} min ${deux(s)}`;
}

const MAX_MINUTES = 24 * 60;

/** Lit le champ « Autre » (minutes, virgule acceptée) → secondes, ou null si invalide. */
export function lireMinutesSaisies(saisie: string): number | null {
  const txt = saisie.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(txt)) return null;
  const minutes = Number(txt);
  if (minutes > MAX_MINUTES) return null;
  const secondes = Math.round(minutes * 60);
  return secondes >= 1 ? secondes : null;
}

export interface PatchAjoutMinute {
  status?: "running";
  endsAtMs?: number;
  remainingSeconds?: number;
  durationSeconds: number;
}

/** Champs à écrire pour « +1 min » selon l'état du minuteur. */
export function ajoutUneMinute(t: MinuteurLu, nowMs: number): PatchAjoutMinute {
  const durationSeconds = (t.durationSeconds ?? 0) + 60;
  if (t.status === "paused") {
    return { remainingSeconds: (t.remainingSeconds ?? 0) + 60, durationSeconds };
  }
  const base = Math.max(versMs(t.endsAt) ?? nowMs, nowMs);
  const patch: PatchAjoutMinute = { endsAtMs: base + 60_000, durationSeconds };
  if (t.status !== "running") return { status: "running", ...patch };
  return patch;
}

/** Le minuteur doit sonner : marqué `ended`, ou encore `running` mais arrivé à zéro ici (ex. hors ligne). */
export function estEnAlarme(t: MinuteurLu, nowMs: number): boolean {
  return t.status === "ended" || estTermine(t, nowMs);
}
