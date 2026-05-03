import type { Repas } from "../kitchenBuddy/mealPlan";

export interface CuisineQuoiConfig {
  /** Caractéristiques préremplies dans le formulaire (ex: ["rapide", "végé"]). */
  presetsCaracteristiques?: string[];
}

/**
 * Pas de data snapshot — la tuile est un déclencheur qui ouvre un modal
 * et appelle generateAdHocRecipe à la volée.
 *
 * Le formulaire envoie : qui mange (profilIds), ingrédients dispo (texte
 * libre), type de repas. La recette générée est sauvée dans `recettes`
 * avec statut `accepted` (side-quest hors plan, n'impacte pas le plan actif).
 */
export interface CuisineQuoiFormulaire {
  profilsPresents: string[];
  ingredientsTexte: string;
  repas: Repas;
}

export const defaultCuisineQuoiConfig: CuisineQuoiConfig = {
  presetsCaracteristiques: [],
};
