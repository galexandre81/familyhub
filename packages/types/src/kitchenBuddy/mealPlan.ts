import type { Timestamp } from "../common";
import type { ProfilSnapshot } from "./profil";

export type MealPlanStatut = "draft" | "active" | "archived";
export type Repas = "petitDej" | "dej" | "diner";
export type SlotStatut = "vide" | "propose" | "accepte";

/**
 * Un plan = une semaine de repas pour le foyer.
 *
 * Invariant : au plus un plan `active` par foyer à un instant donné.
 * Lancer un nouveau plan archive le précédent.
 *
 * `snapshotProfils` est figé à la génération — modifications ultérieures
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

/**
 * Un slot = un repas (jour + créneau).
 *
 * ID convention : `{jour}-{repas}` (ex: "0-dej", "2-diner") pour accès direct
 * sans query.
 */
export interface MealPlanSlot {
  /** 0 = lundi, 6 = dimanche. */
  jour: number;
  repas: Repas;
  /** Liste des profilIds présents à ce repas. */
  profilsPresents: string[];
  /** 0..N recettes (1 plat principal + accompagnements). */
  recetteIds: string[];
  /**
   * Si ce slot consomme un batch préparé ailleurs (ex: granola du dimanche
   * réutilisé le mardi), pointe vers le slot source.
   */
  batchSourceSlotId?: string;
  statut: SlotStatut;
  /** Note libre, ex: "Marc et Sophie invités". */
  notes?: string;
}
