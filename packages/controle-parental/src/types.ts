/**
 * Modèle du contrôle parental tel que Family Hub le manipule. Aucun nom de
 * champ Firestore ici : la traduction est dans `conversion.ts`, les noms dans
 * `schema.ts`. Les dates sont des `Date` ; heures du planning en "HH:MM",
 * heure locale du foyer.
 */
import type { CLE_JOUR, VALEUR } from "./schema";

type Valeurs<T> = T[keyof T];

export type AccesPc = Valeurs<typeof VALEUR.pc>;
export type ModeInternet = Valeurs<typeof VALEUR.internet>;
export type Categorie = Valeurs<typeof VALEUR.categorie>;
export type Raison = Valeurs<typeof VALEUR.raison>;
export type TypeDemande = Valeurs<typeof VALEUR.typeDemande>;
export type StatutDemande = Valeurs<typeof VALEUR.statutDemande>;
export type Jour = (typeof CLE_JOUR)[number];

/** Verrouillage d'un soir : de `debut` ce jour-là à `fin` (le lendemain si fin <= debut). */
export interface Creneau {
  debut: string;
  fin: string;
}

/** Un créneau par soir, ou null : pas de verrouillage ce soir-là. */
export type Planning = Record<Jour, Creneau | null>;

export interface Defauts {
  pc: AccesPc;
  internet: ModeInternet;
}

/** Exception : au moins une dimension, et TOUJOURS une échéance. */
export interface Exception {
  pc?: AccesPc;
  internet?: ModeInternet;
  jusqua: Date;
  /** Uid du parent qui l'a posée. */
  par: string;
}

export interface Appli {
  autorisee: boolean;
  categorie: Categorie;
  nom?: string;
}

export interface Limite {
  active: boolean;
  minutes: number;
}

export interface ConfigAppareil {
  id: string;
  foyer: string;
  compteAppareil: string | null;
  nom: string | null;
  planning: Planning;
  defauts: Defauts;
  exception: Exception | null;
  listeEcole: string[];
  applis: Record<string, Appli>;
  limites: Partial<Record<Categorie, Limite>>;
  modifieLe: Date | null;
  modifiePar: string | null;
}

/** Ce que l'appareil dit appliquer, et quand il a parlé pour la dernière fois. */
export interface EtatAppareil {
  pc: AccesPc;
  internet: ModeInternet;
  raison: Raison | null;
  vuLe: Date | null;
  version: string | null;
}

export interface Evenement {
  appli?: string;
  quand: Date | null;
}

export interface UsageJour {
  /** "AAAA-MM-JJ" */
  jour: string;
  minutesSession: number;
  minutesParAppli: Record<string, number>;
  lancementsRefuses: Evenement[];
  codeParent: Evenement[];
  majLe: Date | null;
}

export interface Demande {
  id: string;
  type: TypeDemande;
  message: string;
  cible: string | null;
  creeeLe: Date | null;
  statut: StatutDemande;
  decidePar: string | null;
  decideLe: Date | null;
  accordeJusqua: Date | null;
}

/** État effectif calculé, dimension par dimension, avec sa raison. */
export interface EtatEffectif {
  pc: AccesPc;
  raisonPc: Raison;
  internet: ModeInternet;
  raisonInternet: Raison;
}
