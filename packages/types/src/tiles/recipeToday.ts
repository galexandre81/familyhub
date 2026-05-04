import type { Repas } from "../mealPlan";

export interface RecipeTodayConfig {
  showAccompagnements: boolean;
  /** "auto" = déduit du créneau horaire ; "manual" = bouton pour switch. */
  detectionRepas: "auto" | "manual";
}

export interface RecipeTodayRecette {
  recetteId: string;
  nom: string;
  /** Portions recalculées selon profilsPresents du slot. */
  portionsAjustees: number;
  tempsTotalMinutes: number;
}

export interface RecipeTodayData {
  /** "aucun" si aucun slot ne match l'heure ou si pas de plan actif. */
  repasActif: Repas | "aucun";
  recettes: RecipeTodayRecette[];
  /** Noms des profils présents au slot actif. */
  profilsPresents: string[];
}

export const defaultRecipeTodayConfig: RecipeTodayConfig = {
  showAccompagnements: true,
  detectionRepas: "auto",
};
