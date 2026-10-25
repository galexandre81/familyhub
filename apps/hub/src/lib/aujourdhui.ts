/**
 * Onglet « Aujourd'hui » (téléphone) — logique pure : prochain repas,
 * autres repas du jour (passés effacés), batch du jour.
 */
import {
  heureDuRepas,
  libelleDans,
  minutesAvant,
  prochainsRepas,
  type HeuresRepas,
  type Repas,
} from "@family-hub/types";

/** La barre de temps est pleine 3 h avant le repas, vide à l'heure du repas. */
export const MINUTES_BARRE_PLEINE = 180;

/** Un repas est « passé » une heure après son heure (même règle que `prochainsRepas`). */
const DUREE_REPAS_MIN = 60;

type SlotAujourdhui = {
  id: string;
  date?: string;
  repas: Repas;
  recetteIds: string[];
  annule?: boolean;
};

type BatchAujourdhui = { date: string };

export interface ProchainRepas<S> {
  slot: S;
  heure: Date;
  /** « 19:00 ». */
  heureTexte: string;
  /** Absent si le repas est aujourd'hui ; sinon « Demain » ou le jour (« Jeudi »). */
  jourTexte?: string;
  minutes: number;
  /** « dans 1 h 30 », « maintenant ». */
  dans: string;
  /** 1 = barre pleine (≥ 3 h avant), 0 = vide (heure du repas atteinte). */
  remplissage: number;
  /** Nom du plat principal (première recette), absent si la recette est introuvable. */
  plat?: string;
  accompagnements: string[];
}

export interface AutreRepas<S> {
  slot: S;
  heure: Date;
  heureTexte: string;
  passe: boolean;
  annule: boolean;
  noms: string[];
}

export interface ResumeAujourdhui<S, B> {
  prochain?: ProchainRepas<S>;
  autresDuJour: AutreRepas<S>[];
  batchDuJour?: B;
}

/** Date locale `AAAA-MM-JJ`. */
export function dateISOLocale(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const j = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${j}`;
}

export function remplissageBarre(minutes: number): number {
  return Math.min(1, Math.max(0, minutes / MINUTES_BARRE_PLEINE));
}

function heureTexte(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Absent pour aujourd'hui, « Demain », sinon le jour de la semaine (« Jeudi »). */
export function texteDuJour(dateISO: string | undefined, now: Date): string | undefined {
  if (!dateISO || dateISO === dateISOLocale(now)) return undefined;
  const lendemain = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (dateISO === dateISOLocale(lendemain)) return "Demain";
  const [y, m, d] = dateISO.split("-").map(Number);
  const jour = new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "long" });
  return jour.charAt(0).toUpperCase() + jour.slice(1);
}

export function resumeAujourdhui<S extends SlotAujourdhui, B extends BatchAujourdhui>(
  slots: S[],
  recettes: Record<string, { nom: string } | undefined>,
  batchSessions: B[],
  now: Date,
  heures: HeuresRepas,
): ResumeAujourdhui<S, B> {
  const aujourdhui = dateISOLocale(now);
  const nom = (id: string) => recettes[id]?.nom;
  const noms = (ids: string[]) => ids.map(nom).filter((n): n is string => !!n);

  const premier = prochainsRepas(slots, now, heures, 1)[0];
  let prochain: ProchainRepas<S> | undefined;
  if (premier) {
    const minutes = minutesAvant(premier.heure, now);
    const [platId, ...autres] = premier.slot.recetteIds;
    prochain = {
      slot: premier.slot,
      heure: premier.heure,
      heureTexte: heureTexte(premier.heure),
      jourTexte: texteDuJour(premier.slot.date, now),
      minutes,
      dans: libelleDans(minutes),
      remplissage: remplissageBarre(minutes),
      plat: nom(platId),
      accompagnements: noms(autres),
    };
  }

  const limitePasse = now.getTime() - DUREE_REPAS_MIN * 60_000;
  const autresDuJour = slots
    .filter(
      (s) => s.date === aujourdhui && s.recetteIds.length > 0 && s.id !== prochain?.slot.id,
    )
    .map((s) => {
      const heure = heureDuRepas(aujourdhui, s.repas, heures);
      return {
        slot: s,
        heure,
        heureTexte: heureTexte(heure),
        passe: heure.getTime() < limitePasse,
        annule: !!s.annule,
        noms: noms(s.recetteIds),
      };
    })
    .sort((a, b) => a.heure.getTime() - b.heure.getTime());

  const batchDuJour = batchSessions.find((b) => b.date === aujourdhui);

  return { prochain, autresDuJour, batchDuJour };
}
