/**
 * Règles nutrition structurées du foyer — vraie source de vérité partagée.
 *
 * Le script de seed référence un chemin inexistant
 * `packages/types/src/kitchenBuddy/reglesNutrition.ts` ; ce fichier-ci est
 * l'emplacement réel. La forme reste alignée avec
 * `scripts/seedRecipes/reglesNutrition.ts` (qui duplique le minimum car il
 * tourne hors workspaces), avec en plus des champs de portée (applicabilité,
 * repas concernés). Si la struct évolue, mettre à jour les deux fichiers.
 */

import type { RepasKey } from "./absence";

/** Identifiant de preset nutritionnel (ou "custom" pour une config libre). */
export type PresetNutritionId =
  | "equilibre"
  | "perte-poids"
  | "proteine"
  | "mediterraneen"
  | "vegetarien-equilibre"
  | "sans-sel-strict"
  | "custom";

export interface ReglesNutrition {
  presetId: PresetNutritionId;
  nomAffiche: string;
  ratios: { legumes: number; proteines: number; feculents: number };
  legumesPriorises: string[];
  legumesLimites: string[];
  maxFeculentsParRepas: number;
  proteineObligatoire: boolean;
  ingredientsAEviter: string[];
  notesLibres: string;
  /** "foyer" = tout le ménage ; sinon un profilId spécifique. */
  applicabilite: "foyer" | string;
  /** Repas concernés par ces règles. Défaut métier : ["dej", "diner"]. */
  repasConcernes: RepasKey[];
}

/**
 * Preset par défaut, miroir du défaut du seed (ratios 60/22/18) avec les
 * champs de portée ajoutés (applicabilite "foyer", repasConcernes dej+diner).
 */
export const DEFAULT_REGLES_NUTRITION: ReglesNutrition = {
  presetId: "equilibre",
  nomAffiche: "Équilibre famille",
  ratios: { legumes: 60, proteines: 22, feculents: 18 },
  legumesPriorises: [
    "brocoli", "courgette", "épinards", "haricots verts",
    "poivrons", "choux", "chou-fleur", "choux de Bruxelles",
    "salades vertes", "endives", "asperges", "champignons",
    "aubergine", "fenouil", "céleri", "concombre",
  ],
  legumesLimites: ["carottes", "betteraves", "potiron", "patate douce"],
  maxFeculentsParRepas: 1,
  proteineObligatoire: true,
  ingredientsAEviter: [],
  notesLibres:
    "Les légumes sont l'élément principal de chaque repas (60%). " +
    "Limiter les légumes naturellement sucrés (carottes, betteraves) à moins de 50% des légumes. " +
    "Une SEULE source de féculents par repas (riz OU pâtes OU pain OU pommes de terre).",
  applicabilite: "foyer",
  repasConcernes: ["dej", "diner"],
};
