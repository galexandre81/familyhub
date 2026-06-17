import type { Repas } from "./mealPlan";

/**
 * Clé de repas du wizard (présence) : "petitDej" | "dej" | "diner".
 *
 * On réutilise le vocabulaire existant `Repas` (cf. mealPlan.ts) plutôt que
 * de redéfinir les littéraux, pour garder une seule source de vérité.
 * `RepasKey` est exposé comme alias pour la lisibilité côté absences.
 */
export type RepasKey = Repas;

/**
 * Absence ponctuelle sur un intervalle de dates (inclusif).
 *
 * Exprime "X est absent du 12 au 15, pour le déjeuner uniquement".
 */
export interface AbsenceInterval {
  kind: "interval";
  profilId: string;
  /** Date ISO YYYY-MM-DD, bornes incluses. */
  from: string;
  /** Date ISO YYYY-MM-DD, bornes incluses. */
  to: string;
  /** Repas concernés ; `undefined` = tous les repas de l'intervalle. */
  repas?: RepasKey[];
}

/**
 * Absence récurrente liée à un rythme hebdomadaire.
 *
 * Exprime "X mange ailleurs tous les mercredis midi".
 */
export interface AbsenceRecurrente {
  kind: "recurring";
  profilId: string;
  /** Jours de la semaine, convention JS getDay : 0 = dimanche … 6 = samedi. */
  weekdays: number[];
  /** Repas concernés (obligatoire pour une récurrence). */
  repas: RepasKey[];
}

/**
 * Union des deux formes d'absence (ponctuelle ou récurrente).
 */
export type Absence = AbsenceInterval | AbsenceRecurrente;
