import type { Timestamp } from "../common";

/**
 * Profil d'un membre du foyer (Julie, Adèle, Guillaume…).
 *
 * Identité visuelle : initiale + couleur, optionnellement un emoji unicode
 * (ex: "🦊", "🐻"). Pas de photo Firebase Storage en MVP — décision Phase 3.0.
 *
 * Note : pas de champ allergies dans la famille actuelle. Si besoin futur,
 * ajouter `allergies: string[]` ici et propager au snapshot des plans.
 */
export interface Profil {
  nom: string;
  /** Couleur de fond du badge identité (hex, ex: "#E07A5F"). */
  couleur: string;
  /** Initiale affichée dans le badge (1 char, ex: "J"). */
  initiale: string;
  /** Emoji unicode optionnel pour identité visuelle (ex: "🦊"). */
  emoji?: string;
  dateNaissance?: Timestamp;
  regimes: string[];
  aversions: string[];
  objectifsNutrition: string[];
  prefsCuisson: string[];
  /** Texte libre, ex: "ne mange pas de légumineuses entières — ballonnements". */
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Snapshot figé d'un profil au moment du lancement d'un plan.
 * Garantit la cohérence historique : un plan archivé reste lisible même
 * si le profil a changé depuis (ex: nouvelle aversion ajoutée).
 */
export interface ProfilSnapshot {
  nom: string;
  regimes: string[];
  aversions: string[];
  objectifsNutrition: string[];
  prefsCuisson: string[];
  notes?: string;
}
