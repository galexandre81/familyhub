import type { Language, Localisation, Timestamp, UnitSystem } from "./common";

export interface HouseholdParametres {
  localisation: Localisation;
  langue: Language;
  systemeUnites: UnitSystem;
  /** ID du thème UI (cf. apps/hub/src/lib/themes.ts). Défaut "caractere". */
  themeId?: string;
}

export interface Household {
  nom: string;
  ownerUid: string;
  membres: string[];
  parametres: HouseholdParametres;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
