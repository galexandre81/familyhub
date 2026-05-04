import type { Timestamp } from "./common";
import type { ProfilSnapshot } from "./profil";

export type MealPlanStatut = "draft" | "active" | "archived";
export type Repas = "petitDej" | "dej" | "diner";
export type SlotStatut = "vide" | "propose" | "accepte";

/** Identifiant lisible d'un repas dans le format d'import Claude.ai. */
export type RepasImport = "petit-dej" | "dejeuner" | "diner";

/** Mapping bidirectionnel entre `Repas` (legacy) et `RepasImport` (nouveau). */
export const REPAS_IMPORT_TO_LEGACY: Record<RepasImport, Repas> = {
  "petit-dej": "petitDej",
  dejeuner: "dej",
  diner: "diner",
};
export const REPAS_LEGACY_TO_IMPORT: Record<Repas, RepasImport> = {
  petitDej: "petit-dej",
  dej: "dejeuner",
  diner: "diner",
};

/**
 * Un plan = une semaine de repas pour le foyer.
 *
 * Invariant : au plus un plan `active` par foyer à un instant donné.
 * L'import d'un nouveau plan archive le précédent automatiquement.
 *
 * `snapshotProfils` est figé à la création — modifications ultérieures
 * d'un profil n'impactent pas un plan déjà lancé.
 */
export interface MealPlan {
  /** Lundi 00:00 dans la timezone du foyer. */
  dateDebut: Timestamp;
  /** Dimanche 23:59 dans la timezone du foyer. */
  dateFin: Timestamp;
  statut: MealPlanStatut;
  /** Snapshot figé des profils, indexé par profilId. */
  snapshotProfils: Record<string, ProfilSnapshot>;
  contexte: {
    batchCookingOk: boolean;
    /** Texte libre, ex: "plus végé cette semaine". */
    style: string;
    /** Texte libre, ex: "reste de poulet, 3 courgettes". Cap 2000 chars (validé côté CF). */
    frigoTexte: string;
  };
  /** Présent quand `statut === "active"`. */
  activatedAt?: Timestamp;
  /** Présent quand `statut === "archived"`. */
  archivedAt?: Timestamp;
  /** Commentaire libre du LLM importé (résumé du plan). */
  commentaireImport?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

/**
 * Un slot = un repas (jour + créneau).
 *
 * Deux conventions d'ID coexistent pendant la migration :
 * - `{jour}-{repas}` (legacy, ex: "0-dej") créé par `createMealPlan` CF
 * - `{date}_{repas}` (Phase 3, ex: "2026-05-04_dejeuner") créé à l'import JSON
 *
 * Les champs `date`, `source`, `batchSessionId`, `invitesNoms` sont
 * optionnels pour back-compat ; ils sont posés à l'import JSON.
 */
export interface MealPlanSlot {
  /** 0 = lundi, 6 = dimanche (legacy, encore renseigné par createMealPlan). */
  jour: number;
  repas: Repas;
  /** Liste des profilIds présents à ce repas. */
  profilsPresents: string[];
  /** 0..N recettes (1 plat principal + accompagnements). */
  recetteIds: string[];
  /** ISO date YYYY-MM-DD (Phase 3, posé à l'import). */
  date?: string;
  /** "fresh" (cuisiné le jour J) ou "batch" (issu d'une session batch). */
  source?: "fresh" | "batch";
  /** ID de la `BatchSession` consommée si source === "batch". */
  batchSessionId?: string;
  /** Invités hors foyer (texte libre). */
  invitesNoms?: string[];
  /**
   * Legacy : si ce slot consomme un batch préparé ailleurs, pointe vers le
   * slot source. Remplacé par `batchSessionId` en Phase 3.
   */
  batchSourceSlotId?: string;
  statut: SlotStatut;
  /** Note libre, ex: "Marc et Sophie invités", "pizzas commandées". */
  notes?: string;
  /** Notation post-repas (1 à 5 étoiles). Posée par recipe-mode iPad. */
  rating?: 1 | 2 | 3 | 4 | 5;
  ratedAt?: Timestamp;
  /** profilId de qui a noté. */
  ratedBy?: string;
}

/**
 * Session de batch cooking (typiquement dimanche après-midi).
 * Stockée en sous-collection `mealPlans/{planId}/batchSessions/{sessionId}`.
 *
 * Les slots qui consomment ce batch ont `source: "batch"` et
 * `batchSessionId` pointant ici.
 */
export interface BatchSession {
  planId: string;
  /** ISO date YYYY-MM-DD du jour de la session. */
  date: string;
  dureeEstimeeMinutes: number;
  /** Recettes à préparer pendant cette session. */
  recetteIds: string[];
  /** Notes du LLM sur la session, ex: "épluche tous les oignons d'abord". */
  notes?: string;
  done: boolean;
  doneAt?: Timestamp;
}
