import type { HeuresRepas } from "./heuresRepas";
import type { Language, Localisation, Timestamp, UnitSystem } from "./common";

export interface HouseholdParametres {
  localisation: Localisation;
  langue: Language;
  systemeUnites: UnitSystem;
  /** Heures des repas ; absent = HEURES_REPAS_DEFAUT. */
  heuresRepas?: HeuresRepas;
  /** Produits de placard du foyer ; absent = PLACARD_DEFAUT. */
  placard?: string[];
  /**
   * Adresse de recherche du drive, `{terme}` = nom du produit ; absent =
   * recherche Intermarché (`RECHERCHE_DRIVE_DEFAUT`, apps/hub/src/lib/drive.ts).
   */
  modeleRechercheDrive?: string;
}

/** Rôle d'une personne dans le foyer. Copie dans functions/src/household/invitationRules.ts. */
export type RoleFoyer = "parent" | "enfant";

export interface Household {
  nom: string;
  ownerUid: string;
  membres: string[];
  /** uid → rôle. Absent sur les foyers créés avant les invitations. */
  roles?: Record<string, RoleFoyer>;
  parametres: HouseholdParametres;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
