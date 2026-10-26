/**
 * Schéma Firestore du contrôle parental : le SEUL fichier du dépôt qui écrit
 * un chemin, un nom de champ ou une valeur stockée. Tout le reste (hub,
 * simulateur, tests) passe par ces constantes et par `conversion.ts`.
 *
 * Source : le brief « spécification prévue » du 26.10.2026, PAS le contrat
 * réel. Le contrat (CONTRAT-FAMILY-HUB.md, produit par l'agent du PC) fera
 * foi : pour s'y aligner, on ne modifie que ce fichier (et `conversion.ts`
 * si une FORME change, pas seulement un nom). Chaque constante est marquée :
 *   [brief]   nommée telle quelle dans le brief ;
 *   [supposé] le brief nomme la chose mais pas le champ, ou pas les valeurs ;
 *   [hub]     ajout côté Family Hub, absent du brief (à faire connaître à
 *             l'agent s'il doit le lire).
 *
 * Les règles Firestore (firestore.rules) répètent forcément ces noms, leur
 * langage n'important rien : un test de cohérence les compare à ce fichier.
 */

/**
 * Collection racine des appareils pilotés. [brief] `devices/{id}`. L'id réel
 * n'est jamais écrit dans le code (dépôt public) : le hub retrouve les
 * appareils de son foyer par requête, le simulateur reçoit l'id en argument.
 */
export const COLLECTION_APPAREILS = "devices";

/** Sous-collections et document d'état. [brief] */
export const SOUS_COLLECTION = {
  etat: "status",
  usage: "usage",
  demandes: "requests",
} as const;
/** [brief] `status/current` : un seul document d'état par appareil. */
export const DOC_ETAT_COURANT = "current";

/** Document de configuration `devices/{id}` (écrit par les parents). */
export const CHAMP_CONFIG = {
  /** [hub] Foyer qui possède l'appareil : ses parents le pilotent. */
  foyer: "householdId",
  /** [hub] Uid du compte Firebase Auth de l'appareil (« badge » du PC). */
  compteAppareil: "deviceUid",
  /** [hub] Nom affiché (« PC des enfants »). */
  nom: "name",
  /** [brief] Planning hebdomadaire. */
  planning: "schedule",
  /** [brief] Valeurs par défaut hors planning et hors exception. */
  defauts: "defaults",
  /** [brief] Exception en cours. */
  exception: "override",
  /** [brief] Liste blanche du mode école (domaines). */
  listeEcole: "schoolAllowlist",
  /** [brief] Applis contrôlées. */
  applis: "apps",
  /** [brief] Limites quotidiennes par catégorie. */
  limites: "categoryLimits",
  /** [hub] Horodatage de la dernière modification par un parent. */
  modifieLe: "updatedAt",
  /** [hub] Uid du parent auteur de la dernière modification. */
  modifiePar: "updatedBy",
} as const;

/** Champs de `defaults` et de `override`. [brief] `override { pc, internet, until, by }` */
export const CHAMP_REGLE = {
  pc: "pc",
  internet: "internet",
  jusqua: "until",
  par: "by",
} as const;

/**
 * Planning : un créneau de verrouillage par SOIR, porté par le jour où il
 * commence (le verrou de dimanche 21h30 se termine lundi 07h00). [supposé]
 * Clé = jour de la semaine, valeur = créneau ou null (pas de verrouillage).
 */
export const CLE_JOUR = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export const CHAMP_CRENEAU = {
  debut: "lockFrom",
  fin: "lockUntil",
} as const;

/** Applis : `apps { id: { allowed, category } }`. [brief] */
export const CHAMP_APPLI = {
  autorisee: "allowed",
  categorie: "category",
  /** [hub] Nom lisible, si l'agent le fournit ; sinon l'id est affiché. */
  nom: "label",
} as const;

/** Limites : `categoryLimits { categorie: { enabled, minutes } }`. [supposé] */
export const CHAMP_LIMITE = {
  active: "enabled",
  minutes: "minutesPerDay",
} as const;

/** `status/current` (écrit par l'appareil). [brief] état, raison, lastSeen, version */
export const CHAMP_ETAT = {
  pc: "pc",
  internet: "internet",
  raison: "reason",
  vuLe: "lastSeen",
  version: "version",
} as const;

/** `usage/{AAAA-MM-JJ}` (écrit par l'appareil). [supposé] noms et formes */
export const CHAMP_USAGE = {
  minutesSession: "sessionMinutes",
  /** { idAppli: minutes } */
  minutesParAppli: "appMinutes",
  /** [{ app, at }] */
  lancementsRefuses: "deniedLaunches",
  /** [{ at }] */
  codeParent: "parentCodeUses",
  majLe: "updatedAt",
} as const;
export const CHAMP_EVENEMENT = {
  appli: "app",
  quand: "at",
} as const;

/** `requests/{id}` (créées par l'appareil, statut posé par un parent). [supposé] */
export const CHAMP_DEMANDE = {
  type: "type",
  message: "message",
  /** Ce que vise la demande : un domaine (site), un id d'appli (appli), rien (temps). */
  cible: "target",
  creeeLe: "createdAt",
  statut: "status",
  decidePar: "decidedBy",
  decideLe: "decidedAt",
  /** Échéance accordée quand la demande est acceptée avec une durée. */
  accordeJusqua: "grantedUntil",
} as const;

/** Les seuls champs d'une demande qu'un parent a le droit d'écrire. */
export const CHAMPS_DEMANDE_PARENT = [
  CHAMP_DEMANDE.statut,
  CHAMP_DEMANDE.decidePar,
  CHAMP_DEMANDE.decideLe,
  CHAMP_DEMANDE.accordeJusqua,
] as const;

/** Valeurs stockées. Clé = nom côté Family Hub, valeur = ce qui est écrit. */
export const VALEUR = {
  /** [brief] */
  pc: { autorise: "allowed", verrouille: "locked" },
  /** [brief] */
  internet: { complet: "filtered", ecole: "school" },
  /** [brief] catégories : école, création, jeu, autre — valeurs [supposé] */
  categorie: { ecole: "school", creation: "creative", jeu: "game", autre: "other" },
  /** [supposé] raison de l'état effectif, par dimension la plus prioritaire */
  raison: { exception: "override", planning: "schedule", defaut: "default", codeParent: "parentCode" },
  /** [supposé] */
  typeDemande: { temps: "time", site: "site", appli: "app" },
  /** [supposé] */
  statutDemande: { enAttente: "pending", acceptee: "accepted", refusee: "refused" },
} as const;

/** Chemins. Les identifiants sont passés par l'appelant, jamais écrits en dur. */
export const chemin = {
  config: (appareilId: string) => `${COLLECTION_APPAREILS}/${appareilId}`,
  etat: (appareilId: string) =>
    `${COLLECTION_APPAREILS}/${appareilId}/${SOUS_COLLECTION.etat}/${DOC_ETAT_COURANT}`,
  usages: (appareilId: string) => `${COLLECTION_APPAREILS}/${appareilId}/${SOUS_COLLECTION.usage}`,
  usage: (appareilId: string, jour: string) =>
    `${COLLECTION_APPAREILS}/${appareilId}/${SOUS_COLLECTION.usage}/${jour}`,
  demandes: (appareilId: string) =>
    `${COLLECTION_APPAREILS}/${appareilId}/${SOUS_COLLECTION.demandes}`,
  demande: (appareilId: string, demandeId: string) =>
    `${COLLECTION_APPAREILS}/${appareilId}/${SOUS_COLLECTION.demandes}/${demandeId}`,
};
