/**
 * Kitchen Buddy — Phase 3 (architecture human-in-the-loop avec Claude.ai).
 *
 * Ce fichier remplace progressivement les types historiques de
 * `packages/types/src/kitchenBuddy/` (ancienne architecture LLM Cloud
 * Function). Le code applicatif sera migré phase par phase ; tant que
 * la migration n'est pas terminée, ces types ne sont PAS ré-exportés
 * depuis `index.ts` pour éviter les collisions de noms (`Profil`,
 * `MealPlan`, `Recette`, `CourseItem`).
 *
 * Importer explicitement via `@family-hub/types/kitchen-buddy` (path
 * relatif à l'intérieur du package) une fois les chemins TS résolus.
 */

import type { Timestamp } from "./common";

// ---------- Profils ----------

/**
 * Membre du foyer. Contraintes alimentaires + identité visuelle.
 * Le `couleur` sert pour les pastilles dans la grille de présence.
 */
export interface KBProfil {
  id: string;
  nom: string;
  photoUrl?: string;
  couleur: string;
  /** ISO date YYYY-MM-DD, optionnel. */
  dateNaissance?: string;
  allergies: string[];
  regimes: string[];
  aversions: string[];
  objectifsNutrition: string[];
  prefsCuisson: string[];
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------- Plans de repas ----------

export type RepasType = "petit-dej" | "dejeuner" | "diner";
export type PlanStatut = "draft" | "active" | "archived";

/**
 * Un plan = une semaine (lundi → dimanche). Au plus un plan `active`
 * par foyer à un instant donné. L'import d'un nouveau plan archive
 * automatiquement le précédent.
 *
 * `profilsSnapshot` est figé à l'import : modifications ultérieures
 * d'un profil n'impactent pas un plan déjà actif/archivé.
 */
export interface KBMealPlan {
  id: string;
  /** ISO date du lundi (YYYY-MM-DD). */
  dateDebut: string;
  /** ISO date du dimanche (YYYY-MM-DD). */
  dateFin: string;
  statut: PlanStatut;
  contexte: {
    batchCookingOk: boolean;
    /** Texte libre, ex: "plus végé cette semaine". */
    style: string;
    /** Texte libre multi-lignes, ingrédients à écouler du frigo. */
    frigoTexte: string;
  };
  /** Snapshot figé des profils au moment de l'import. */
  profilsSnapshot: KBProfil[];
  createdAt: Timestamp;
  /** Quand statut est passé à `active`. */
  activatedAt?: Timestamp;
  archivedAt?: Timestamp;
}

/**
 * Un slot = un repas (date + créneau).
 *
 * Convention d'ID recommandée : `${date}_${repas}` (ex: "2026-05-04_dejeuner").
 * Sous-collection : `mealPlans/{planId}/slots/{slotId}`.
 */
export interface KBSlot {
  id: string;
  planId: string;
  /** ISO date YYYY-MM-DD. */
  date: string;
  repas: RepasType;
  /** IDs de profils présents (depuis `KBMealPlan.profilsSnapshot`). */
  profilsPresents: string[];
  /** Invités hors foyer (texte libre). */
  invitesNoms?: string[];
  /** `fresh` = cuisiné le jour J ; `batch` = sorti d'une session batch. */
  source: "fresh" | "batch";
  /** Présent si `source === "batch"`, pointe vers la `BatchSession` consommée. */
  batchSessionId?: string;
  /** 1 plat principal + accompagnements éventuels. Vide si "personne". */
  recetteIds: string[];
  /** Notes libres, ex: "pizzas commandées" (rétroactif). */
  notes?: string;
  /** Notation post-repas (1 à 5 étoiles). */
  rating?: 1 | 2 | 3 | 4 | 5;
  ratedAt?: Timestamp;
  /** profilId qui a noté. */
  ratedBy?: string;
}

// ---------- Batch sessions ----------

/**
 * Session de batch cooking (typiquement dimanche après-midi).
 * Les slots de la semaine consommant ce batch ont `source: "batch"`
 * et `batchSessionId` pointant ici.
 */
export interface KBBatchSession {
  id: string;
  planId: string;
  /** ISO date du jour de la session. */
  date: string;
  dureeEstimeeMinutes: number;
  /** Recettes à cuisiner pendant la session. */
  recetteIds: string[];
  /** Notes du LLM, ex: "épluche tous les oignons d'abord". */
  notes?: string;
  done: boolean;
  doneAt?: Timestamp;
}

// ---------- Recettes ----------

export type RecetteStatut = "draft" | "accepted" | "favorite";
export type RecetteSource = "claude-import" | "manual" | "edited";
export type RecetteDifficulte = "facile" | "moyen" | "avance";

export type KBRayonCourse =
  | "fruits-legumes"
  | "boucherie"
  | "poissonnerie"
  | "cremerie"
  | "epicerie"
  | "surgeles"
  | "boulangerie"
  | "boissons"
  | "autres";

export interface KBIngredient {
  nom: string;
  quantite: number;
  /** "g" | "ml" | "u" | "cs" | "cc" | "pincée" | ... */
  unite: string;
  rayon: KBRayonCourse;
  optionnel?: boolean;
  /** True si issu du frigo : n'ira PAS dans la liste de courses. */
  noteFrigo?: boolean;
}

export interface KBEtapeRecette {
  ordre: number;
  texte: string;
  /** Si présent, le mode cuisine affiche un bouton "+ timer X min". */
  dureeMinutes?: number;
}

export interface KBRecette {
  id: string;
  titre: string;
  description?: string;
  portions: number;
  dureePreparation: number;
  dureeCuisson: number;
  difficulte: RecetteDifficulte;
  ingredients: KBIngredient[];
  etapes: KBEtapeRecette[];
  tags: string[];
  /** Saisons recommandées ; vide ou absent = toute l'année. */
  saison?: string[];
  statut: RecetteStatut;
  /** Moyenne des `rating` des slots où la recette a servi. */
  rating?: number;
  ratingCount?: number;
  source: RecetteSource;
  /**
   * Hash de dédup à l'import :
   * `hash(titre.toLowerCase().trim() + ingredients.filter(notOptional).map(nom).sort().join('|'))`.
   * Permet de réutiliser une recette existante au lieu de créer un doublon.
   */
  hashDedupe: string;
  /** Compteur cumulé : nombre de slots où la recette a été servie. */
  usedCount?: number;
  createdAt: Timestamp;
}

// ---------- Liste de courses ----------

/**
 * Une `KBShoppingList` par plan actif (1-1). Les items sont
 * dénormalisés dans le doc (array) pour simplicité et atomicité au
 * cochage. Si la liste devient trop grande, migration vers
 * sous-collection `coursesItems/{itemId}` envisageable (les indexes
 * collection-group sont préparés en ce sens).
 */
export interface KBShoppingList {
  id: string;
  planId: string;
  items: KBCourseItem[];
  /** Null tant que jamais partagée via Web Share API. */
  lastSharedAt?: Timestamp;
  /** Libellé app cible, ex: "partage natif" / "Google Keep". */
  lastSharedTo?: string;
  updatedAt: Timestamp;
}

export interface KBCourseItem {
  id: string;
  nom: string;
  quantite: number;
  unite: string;
  rayon: KBRayonCourse;
  /** Recettes d'origine (info traçabilité). Vide si ajout manuel. */
  recetteIds: string[];
  checked: boolean;
  checkedAt?: Timestamp;
  /** profilId ou uid du membre qui a coché. */
  checkedBy?: string;
  /** True si ajouté à la main hors du plan. */
  ajoutManuel: boolean;
}

// ---------- JSON d'import (sortie attendue de Claude.ai) ----------

/**
 * Schéma validé par Zod côté client à l'import.
 * Les `tempId` sont remappés vers de vrais IDs Firestore au moment
 * du write ; le dédup recettes via `hashDedupe` peut réutiliser un
 * ID existant à la place.
 */
export interface KBPlanImport {
  recettes: Array<{
    tempId: string;
    titre: string;
    description?: string;
    portions: number;
    dureePreparation: number;
    dureeCuisson: number;
    difficulte: RecetteDifficulte;
    tags: string[];
    saison?: string[];
    ingredients: Array<{
      nom: string;
      quantite: number;
      unite: string;
      rayon: KBRayonCourse;
      optionnel?: boolean;
      noteFrigo?: boolean;
    }>;
    etapes: Array<{
      ordre: number;
      texte: string;
      dureeMinutes?: number;
    }>;
  }>;
  batchSessions: Array<{
    tempId: string;
    date: string;
    dureeEstimeeMinutes: number;
    recetteTempIds: string[];
    notes?: string;
  }>;
  slots: Array<{
    date: string;
    repas: RepasType;
    profilsPresentsNoms: string[];
    invitesNoms?: string[];
    source: "fresh" | "batch";
    batchSessionTempId?: string | null;
    recetteTempIds: string[];
    notes?: string;
  }>;
  shoppingList: {
    items: Array<{
      nom: string;
      quantite: number;
      unite: string;
      rayon: KBRayonCourse;
      recetteTempIds: string[];
    }>;
  };
  /** Commentaire général libre du LLM sur le plan généré. */
  commentaireGeneral?: string;
}
