/**
 * Onglet « Semaine » (téléphone) — logique pure : jours d'un plan (un plan
 * peut commencer n'importe quel jour et durer plus de 7 jours), jour affiché
 * au départ, repas passés, plans voisins pour les flèches.
 */
import { heureDuRepas, type HeuresRepas, type Repas } from "@family-hub/types";
import { dateISOLocale } from "./aujourdhui";

export const ORDRE_REPAS: Repas[] = ["petitDej", "dej", "diner"];

const JOURS_COURTS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

/** Garde-fou : un plan ne dépasse pas 31 jours à l'écran. */
const JOURS_MAX = 31;

/** Un repas est « passé » une heure après son heure (même règle que `prochainsRepas`). */
const DUREE_REPAS_MIN = 60;

export interface JourDuPlan<S> {
  dateISO: string;
  /** « mar ». */
  libelleCourt: string;
  /** Numéro du jour dans le mois. */
  numero: number;
  repas: Array<{ repas: Repas; slot?: S }>;
}

/** Date JS d'un Timestamp Firestore (web), `{ seconds }`, Date ou chaîne ISO. */
export function dateDuTimestamp(ts: unknown): Date | undefined {
  if (!ts) return undefined;
  if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? undefined : ts;
  if (typeof ts === "string") {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  if (typeof ts === "object") {
    const o = ts as { toDate?: () => Date; seconds?: number };
    if (typeof o.toDate === "function") return o.toDate();
    if (typeof o.seconds === "number") return new Date(o.seconds * 1000);
  }
  return undefined;
}

function dateLocale(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/**
 * Jours du plan, du premier au dernier, avec leurs 3 repas.
 * Plage = union de dateDebut → dateFin (dates locales) et des dates des créneaux.
 */
export function joursDuPlan<S extends { date?: string; repas: Repas }>(
  slots: S[],
  plan: { dateDebut?: unknown; dateFin?: unknown },
): JourDuPlan<S>[] {
  const bornes: string[] = [];
  const debut = dateDuTimestamp(plan.dateDebut);
  const fin = dateDuTimestamp(plan.dateFin);
  if (debut) bornes.push(dateISOLocale(debut));
  if (fin) bornes.push(dateISOLocale(fin));
  for (const s of slots) {
    if (s.date && /^\d{4}-\d{2}-\d{2}$/.test(s.date)) bornes.push(s.date);
  }
  if (bornes.length === 0) return [];
  bornes.sort();

  const premier = dateLocale(bornes[0]);
  const dernier = dateLocale(bornes[bornes.length - 1]);
  const n = Math.min(JOURS_MAX, Math.round((dernier.getTime() - premier.getTime()) / 86_400_000) + 1);

  const parCle = new Map<string, S>();
  for (const s of slots) if (s.date) parCle.set(`${s.date}_${s.repas}`, s);

  const jours: JourDuPlan<S>[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(premier.getFullYear(), premier.getMonth(), premier.getDate() + i, 12);
    const dateISO = dateISOLocale(d);
    jours.push({
      dateISO,
      libelleCourt: JOURS_COURTS[d.getDay()],
      numero: d.getDate(),
      repas: ORDRE_REPAS.map((repas) => ({ repas, slot: parCle.get(`${dateISO}_${repas}`) })),
    });
  }
  return jours;
}

/** Aujourd'hui (date locale) s'il est dans le plan, sinon le premier jour. */
export function jourInitial(jours: Array<{ dateISO: string }>, now: Date): string {
  const aujourdhui = dateISOLocale(now);
  return jours.find((j) => j.dateISO === aujourdhui)?.dateISO ?? jours[0]?.dateISO ?? "";
}

export function repasPasse(dateISO: string, repas: Repas, now: Date, heures: HeuresRepas): boolean {
  return heureDuRepas(dateISO, repas, heures).getTime() < now.getTime() - DUREE_REPAS_MIN * 60_000;
}

/** Plans triés par début décroissant (`useAllPlans`) : précédent = plus ancien. */
export function planVoisins(
  plans: Array<{ id: string }>,
  planId: string | undefined,
): { precedentId?: string; suivantId?: string } {
  const i = plans.findIndex((p) => p.id === planId);
  if (i < 0) return { precedentId: undefined, suivantId: undefined };
  return { precedentId: plans[i + 1]?.id, suivantId: plans[i - 1]?.id };
}
