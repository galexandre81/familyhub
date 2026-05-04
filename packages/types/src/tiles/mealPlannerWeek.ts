import type { Repas } from "../mealPlan";

export interface MealPlannerWeekConfig {
  /** "compacte" = grille semaine seule ; "complete" = grille + chat. */
  vue: "compacte" | "complete";
}

export interface MealPlannerWeekSlotSnapshot {
  jour: number;
  repas: Repas;
  /** Noms des recettes (résumé), pas IDs — pour affichage direct. */
  recetteNoms: string[];
  /** Noms des profils présents (pas IDs). */
  profilsPresents: string[];
  /** True si ce slot consomme un batch préparé ailleurs. */
  estBatchConsommateur?: boolean;
  /** True si ce slot prépare un batch consommé par d'autres. */
  estBatchSource?: boolean;
}

/**
 * Snapshot read-only pour affichage Display (iPad mural, mobile).
 * Le hub PC lit le plan en live (édition).
 */
export interface MealPlannerWeekData {
  planId: string;
  /** ISO 8601 du lundi de la semaine. */
  dateDebutISO: string;
  semaine: MealPlannerWeekSlotSnapshot[];
}

export const defaultMealPlannerWeekConfig: MealPlannerWeekConfig = {
  vue: "complete",
};
