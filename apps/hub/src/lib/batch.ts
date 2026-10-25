/**
 * Batch cooking (téléphone) — logique pure : sessions à annoncer, durée,
 * jour lisible, repas préparés par une session.
 */
import type { Repas } from "@family-hub/types";
import { dateISOLocale } from "./aujourdhui";
import { ORDRE_REPAS } from "./semaine";

export type QuandBatch = "aujourdhui" | "demain";

/** Sessions d'aujourd'hui puis de demain : la veille, on sait ce qui attend. */
export function batchsProches<B extends { date: string }>(
  sessions: B[],
  now: Date,
): Array<{ batch: B; quand: QuandBatch }> {
  const aujourdhui = dateISOLocale(now);
  const demain = dateISOLocale(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  return [
    ...sessions.filter((b) => b.date === aujourdhui).map((batch) => ({ batch, quand: "aujourdhui" as const })),
    ...sessions.filter((b) => b.date === demain).map((batch) => ({ batch, quand: "demain" as const })),
  ];
}

/** « 2 h 30 », « 2 h », « 45 min » ; null si la durée n'est pas connue. */
export function dureeTexte(minutes: number): string | null {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** « Aujourd'hui », « Demain », sinon « Mercredi 28 octobre ». */
export function jourDuBatch(dateISO: string, now: Date): string {
  if (dateISO === dateISOLocale(now)) return "Aujourd'hui";
  if (dateISO === dateISOLocale(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))) {
    return "Demain";
  }
  const [y, m, d] = dateISO.split("-").map(Number);
  const texte = new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Repas qui mangent ce que la session prépare, dans l'ordre de la semaine. */
export function repasDuBatch<S extends { date?: string; repas: Repas; batchSessionId?: string }>(
  slots: S[],
  batchId: string,
): S[] {
  return slots
    .filter((s) => s.batchSessionId === batchId)
    .sort(
      (a, b) =>
        (a.date ?? "").localeCompare(b.date ?? "") ||
        ORDRE_REPAS.indexOf(a.repas) - ORDRE_REPAS.indexOf(b.repas),
    );
}
