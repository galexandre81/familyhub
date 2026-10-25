import type { Language, Localisation, Timestamp, UnitSystem } from "./common";

export interface HouseholdParametres {
  localisation: Localisation;
  langue: Language;
  systemeUnites: UnitSystem;
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
