import type { Timestamp } from "../common";
import type { RayonCourses } from "./recette";

/**
 * Item de la liste de courses associée à un plan.
 *
 * Générée par le LLM en sortie de generateMealPlan, puis mutable (toggle,
 * ajout manuel, suppression). Lecture/écriture client autorisée pour
 * permettre le cochage temps réel cross-device au supermarché.
 */
export interface CourseItem {
  libelle: string;
  /** String pour gérer "1 botte", "qsp", "500", etc. */
  quantite: string;
  unite: string;
  rayon: RayonCourses;
  coche: boolean;
  cochePar?: string;
  cocheAt?: Timestamp;
  /** True si ajouté à la main, false si généré par le LLM. */
  ajoutManuel: boolean;
  createdAt: Timestamp;
}
