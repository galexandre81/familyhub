import type { Ambiance } from "./tokens";

const REPLI_LEVER = 7 * 60;
const REPLI_COUCHER = 19 * 60;

function minutes(hhmm: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mn = Number(m[2]);
  if (h > 23 || mn > 59) return null;
  return h * 60 + mn;
}

/** Jour de lever (inclus) à coucher (exclu), heure locale ; repli 07:00–19:00. */
export function ambianceAt(
  now: Date,
  sun?: { sunrise: string; sunset: string } | null,
): Ambiance {
  const t = now.getHours() * 60 + now.getMinutes();
  const lever = minutes(sun?.sunrise);
  const coucher = minutes(sun?.sunset);
  const [a, b] =
    lever !== null && coucher !== null && lever < coucher
      ? [lever, coucher]
      : [REPLI_LEVER, REPLI_COUCHER];
  return t >= a && t < b ? "jour" : "nuit";
}
