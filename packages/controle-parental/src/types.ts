/**
 * Modèle du contrôle parental tel que Family Hub le manipule. Aucun nom de
 * champ Firestore ici : la traduction est dans `conversion.ts`, les noms dans
 * `schema.ts`. Les dates sont des `Date` ; heures du planning en "HH:MM",
 * heure locale (Europe/Paris, la même que Zurich).
 */
import type { CLE_JOUR, VALEUR } from "./schema.js";

type Valeurs<T> = T[keyof T];

export type AccesPc = Valeurs<typeof VALEUR.pc>;
export type ModeInternet = Valeurs<typeof VALEUR.internet>;
export type Mode = Valeurs<typeof VALEUR.mode>;
export type Reseau = Valeurs<typeof VALEUR.reseau>;
export type Categorie = Valeurs<typeof VALEUR.categorie>;
export type Source = Valeurs<typeof VALEUR.source>;
export type TypeDemande = Valeurs<typeof VALEUR.typeDemande>;
export type StatutDemande = Valeurs<typeof VALEUR.statutDemande>;
export type ExecutablesInconnus = Valeurs<typeof VALEUR.executablesInconnus>;
export type Jour = (typeof CLE_JOUR)[number];

/** Les trois dimensions pilotées, chacune indépendante. */
export type Dimension = "pc" | "internet" | "mode";

/** Ce qu'une plage, une exception ou les défauts fixent (au moins une dimension). */
export interface Reglage {
  pc?: AccesPc;
  internet?: ModeInternet;
  mode?: Mode;
}

/** Plage `[debut, fin[` d'un jour ; si fin ≤ debut, elle passe minuit. */
export interface Plage extends Reglage {
  debut: string;
  fin: string;
}

export type Planning = Record<Jour, Plage[]>;

export interface Defauts {
  pc: AccesPc;
  internet: ModeInternet;
  mode: Mode;
}

/** Exception : une seule à la fois, une seule échéance, toujours une échéance. */
export interface Exception extends Reglage {
  jusqua: Date;
  /** Nom montré à l'enfant (« Papa »). */
  par: string;
  poseLe: Date | null;
}

export interface Appli {
  autorisee: boolean;
  categorie?: Categorie;
}

export interface ConfigAppareil {
  id: string;
  foyer: string;
  compteAppareil: string | null;
  nom: string | null;
  planning: Planning;
  defauts: Defauts;
  exception: Exception | null;
  reinitialiserLocalAvant: Date | null;
  listeEcole: string[];
  applis: Record<string, Appli>;
  /** minutes par jour, par catégorie limitée. */
  limites: Partial<Record<Categorie, number>>;
  executablesInconnus: ExecutablesInconnus;
  /** uid → nom montré à l'enfant. */
  nomsParents: Record<string, string>;
  modifieLe: Date | null;
  modifiePar: string | null;
}

/** L'état d'une dimension tel que le PC le rapporte. */
export interface EtatDimension<V> {
  valeur: V;
  /** Phrase prête à afficher (« planning du dimanche (21h30–7h00) »). */
  raison: string | null;
  source: Source | null;
  jusqua: Date | null;
}

export interface EntreeCatalogue {
  nom: string;
  categorie: Categorie | null;
  categorieParDefaut: Categorie | null;
  autorisee: boolean;
  raison: string | null;
}

/** `status/current` : ce que le PC applique, et quand il a parlé pour la dernière fois. */
export interface EtatAppareil {
  pc: EtatDimension<AccesPc>;
  internet: EtatDimension<ModeInternet>;
  mode: EtatDimension<Mode>;
  libelleMode: string | null;
  reseau: Reseau | null;
  resume: string | null;
  prochainChangement: Partial<Record<Dimension, { quand: Date; valeur: string } | null>>;
  sessionOuverte: boolean;
  fermetureA: Date | null;
  minutesDuJour: number;
  /** id → raison du refus (« pas en mode Devoirs »). */
  applisRefusees: Record<string, string>;
  vuLe: Date | null;
  heurePc: Date | null;
  version: string | null;
  erreursConfig: string[];
  sauvegarde: { date: Date | null; resultat: string | null } | null;
  /** Catalogue publié par le PC (vide tant que l'agent ne le publie pas). */
  catalogue: Record<string, EntreeCatalogue>;
}

export interface Evenement {
  quand: Date | null;
  appli?: string;
  detail?: string;
  /** Code parent : réussi ou raté. */
  reussi?: boolean;
}

export interface UsageJour {
  /** "AAAA-MM-JJ" */
  jour: string;
  secondesSession: number;
  secondesActives: number;
  /** id du catalogue, ou « autre:<classe> » : secondes. */
  secondesParAppli: Record<string, number>;
  nomsApplis: Record<string, string>;
  secondesParCategorie: Partial<Record<Categorie, number>>;
  lancementsRefuses: Evenement[];
  codeParent: Evenement[];
  executablesInconnus: Evenement[];
  vpnBloques: Evenement[];
  /** catégorie → heure (texte) */
  limitesAtteintes: Partial<Record<Categorie, string>>;
  majLe: Date | null;
}

export interface Demande {
  id: string;
  type: TypeDemande;
  detail: string;
  message: string;
  dureeMinutes: number | null;
  creeeLe: Date | null;
  statut: StatutDemande;
  reponse: string | null;
  traitePar: string | null;
  traiteLe: Date | null;
}

/** État effectif calculé, dimension par dimension, avec sa source. */
export interface EtatEffectif {
  pc: AccesPc;
  sourcePc: Source;
  internet: ModeInternet;
  sourceInternet: Source;
  mode: Mode;
  sourceMode: Source;
  /** Filtrage réel qui en découle. */
  reseau: Reseau;
}

/** Un site du rapport NextDNS, avec son nombre de visites (requêtes) du jour. */
export interface SiteDuJour {
  domaine: string;
  requetes: number;
}

/** Rapport NextDNS de l'appareil (écrit par la fonction serveur). */
export interface RapportNextdns {
  /** "AAAA-MM-JJ" décrit par visites et bloques. */
  jour: string | null;
  visites: SiteDuJour[];
  bloques: SiteDuJour[];
  toujoursAutorises: string[];
  toujoursBloques: string[];
  requetesDuMois: number;
  limiteDuMois: number;
  majLe: Date | null;
}
