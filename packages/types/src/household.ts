import type { Language, Localisation, Timestamp, UnitSystem } from "./common";

export interface HouseholdParametres {
  localisation: Localisation;
  langue: Language;
  systemeUnites: UnitSystem;
}

export interface Household {
  nom: string;
  ownerUid: string;
  membres: string[];
  parametres: HouseholdParametres;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
