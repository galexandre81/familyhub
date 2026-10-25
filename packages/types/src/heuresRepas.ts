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

/** Un repas reste « le prochain » jusqu'à une heure après son heure. */
const DUREE_REPAS_MIN = 60;

/** Heure locale d'un repas pour un jour ISO `YYYY-MM-DD`. */
export function heureDuRepas(
  dateISO: string,
  repas: Repas,
  heures: HeuresRepas = HEURES_REPAS_DEFAUT,
): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const jour = new Date(y, m - 1, d).getDay();
  const weekend = jour === 0 || jour === 6;
  const [hh, mm] = (weekend ? heures.weekend : heures.semaine)[repas].split(":").map(Number);
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
  const limite = now.getTime() - DUREE_REPAS_MIN * 60_000;
  const res: Array<{ slot: S; heure: Date }> = [];
  for (const slot of slots) {
    if (!slot.date || slot.annule || slot.recetteIds.length === 0) continue;
    const heure = heureDuRepas(slot.date, slot.repas, heures);
    if (heure.getTime() >= limite) res.push({ slot, heure });
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
