import type { Repas } from "./mealPlan";

/** Heures des repas au format "HH:MM", en semaine et le week-end (samedi/dimanche). */
export type HeuresRepas = {
  semaine: Record<Repas, string>;
  weekend: Record<Repas, string>;
};

export const HEURES_REPAS_DEFAUT: HeuresRepas = {
  semaine: { petitDej: "07:00", dej: "12:15", diner: "19:00" },
  weekend: { petitDej: "08:00", dej: "12:15", diner: "19:00" },
};

const FORMAT_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Heure "HH:MM" valide ? */
export function heureValide(v: unknown): v is string {
  return typeof v === "string" && FORMAT_HEURE.test(v);
}

/** Complète/corrige des heures partielles ou invalides, champ par champ, avec les défauts. */
export function heuresRepasValides(h?: {
  semaine?: Partial<Record<Repas, string>>;
  weekend?: Partial<Record<Repas, string>>;
}): HeuresRepas {
  const periode = (k: "semaine" | "weekend"): Record<Repas, string> => {
    const def = HEURES_REPAS_DEFAUT[k];
    const src = h?.[k];
    return {
      petitDej: heureValide(src?.petitDej) ? src.petitDej : def.petitDej,
      dej: heureValide(src?.dej) ? src.dej : def.dej,
      diner: heureValide(src?.diner) ? src.diner : def.diner,
    };
  };
  return { semaine: periode("semaine"), weekend: periode("weekend") };
}

/** Un repas reste « le prochain » jusqu'à une heure après son heure. */
export const DUREE_REPAS_MIN = 60;

/** Vrai quand le repas prévu à `heure` est fini : plus de DUREE_REPAS_MIN minutes après son heure. */
export function repasEstPasse(heure: Date, now: Date): boolean {
  return heure.getTime() < now.getTime() - DUREE_REPAS_MIN * 60_000;
}

/** Heure locale d'un repas pour un jour ISO `YYYY-MM-DD`. */
export function heureDuRepas(
  dateISO: string,
  repas: Repas,
  heures?: Partial<HeuresRepas>,
): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const jour = new Date(y, m - 1, d).getDay();
  const weekend = jour === 0 || jour === 6;
  const [hh, mm] = heuresRepasValides(heures)[weekend ? "weekend" : "semaine"][repas]
    .split(":")
    .map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** Prochains repas à venir (ou commencés depuis moins d'une heure), triés par heure. */
export function prochainsRepas<
  S extends { date?: string; repas: Repas; annule?: boolean; recetteIds: string[] },
>(
  slots: S[],
  now: Date,
  heures: HeuresRepas = HEURES_REPAS_DEFAUT,
  n = 2,
): Array<{ slot: S; heure: Date }> {
  const res: Array<{ slot: S; heure: Date }> = [];
  for (const slot of slots) {
    if (!slot.date || slot.annule || slot.recetteIds.length === 0) continue;
    const heure = heureDuRepas(slot.date, slot.repas, heures);
    if (!repasEstPasse(heure, now)) res.push({ slot, heure });
  }
  res.sort((a, b) => a.heure.getTime() - b.heure.getTime());
  return res.slice(0, n);
}

/** Minutes (arrondies) entre `now` et `heure` ; négatif si l'heure est passée. */
export function minutesAvant(heure: Date, now: Date): number {
  return Math.round((heure.getTime() - now.getTime()) / 60_000);
}

export function libelleDans(minutes: number): string {
  if (minutes <= 0) return "maintenant";
  if (minutes < 60) return `dans ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `dans ${h} h` : `dans ${h} h ${String(m).padStart(2, "0")}`;
}
