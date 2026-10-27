// FICHIER GÉNÉRÉ — ne pas modifier. Copie de packages/controle-parental/src/schema.ts
// (node scripts/copier-controle-parental-functions.mjs).
/**
 * Schéma Firestore du contrôle parental : le SEUL fichier du dépôt qui écrit
 * un chemin, un nom de champ ou une valeur stockée. Tout le reste (hub,
 * simulateur, tests, fonctions par copie générée) passe par ces constantes et
 * par `conversion.ts`.
 *
 * Source : le CONTRAT réel de l'agent du PC (version 1, agent 1.0.0, reçu le
 * 27.10.2026, réponses vérifiées dans le code de l'agent). Chaque constante
 * est marquée :
 *   [contrat] nommée telle quelle dans le contrat ;
 *   [hub]     ajout côté Family Hub ; l'agent ignore tout champ inconnu, sans
 *             erreur (réponse a du 27.10).
 *
 * Les règles Firestore (firestore.rules) répètent forcément ces noms, leur
 * langage n'important rien : un test de cohérence les compare à ce fichier.
 */

/**
 * Collection racine des appareils pilotés. [contrat] `devices/{id}`. L'id réel
 * n'est jamais écrit dans le code (dépôt public) : le hub retrouve les
 * appareils de son foyer par requête, le simulateur reçoit l'id en argument.
 */
export const COLLECTION_APPAREILS = "devices";

/** Sous-collections et document d'état. [contrat] */
export const SOUS_COLLECTION = {
  etat: "status",
  usage: "usage",
  demandes: "requests",
} as const;
/** [contrat] `status/current` : un seul document d'état par appareil. */
export const DOC_ETAT_COURANT = "current";

/** Document de configuration `devices/{id}` (écrit par les parents, lu par le PC). */
export const CHAMP_CONFIG = {
  /** [hub] Foyer qui possède l'appareil : ses parents le pilotent (remplace `parentUids`, § 5). */
  foyer: "householdId",
  /** [contrat] Uid du compte Firebase Auth de l'appareil. */
  compteAppareil: "deviceUid",
  /** [contrat] Nom affiché (« PC des enfants »). Ignoré par le PC. */
  nom: "displayName",
  /** [contrat] `1`. Ignoré par le PC. */
  versionSchema: "schemaVersion",
  /** [contrat] Planning hebdomadaire : plages par jour. */
  planning: "schedule",
  /** [contrat] Valeurs hors planning et hors exception : { pc, internet, mode }. */
  defauts: "defaults",
  /** [contrat] Exception en cours (une seule, une seule échéance) ou null. */
  exception: "override",
  /** [contrat] Annule les exceptions posées SUR LE PC (code parent) antérieures. */
  reinitialiserLocalAvant: "resetLocalBefore",
  /** [contrat] Domaines ouverts en liste école (et leurs sous-domaines). */
  listeEcole: "schoolAllowlist",
  /** [contrat] { idAppli: { allowed, category } }. */
  applis: "apps",
  /** [contrat] { catégorie: minutesParJour } ; {} = aucune limite. */
  limites: "categoryLimits",
  /** [contrat] Programmes hors installation : signaler ou fermer. */
  executablesInconnus: "unknownExecutables",
  /** [hub] Nom montré à l'enfant pour chaque parent : { uid: "Papa" }. */
  nomsParents: "parentLabels",
  /** [hub] Horodatage de la dernière modification par un parent. */
  modifieLe: "updatedAt",
  /** [hub] Uid du parent auteur de la dernière modification. */
  modifiePar: "updatedBy",
} as const;

/**
 * Champs communs de `defaults`, `override` et des plages du planning. [contrat]
 * `by` est le NOM MONTRÉ À L'ENFANT (« Papa »), ≤ 60 caractères.
 */
export const CHAMP_REGLE = {
  pc: "pc",
  internet: "internet",
  mode: "mode",
  jusqua: "until",
  par: "by",
  poseLe: "setAt",
} as const;

/** [contrat] Jours du planning, dans l'ordre de Date.getDay(). */
export const CLE_JOUR = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
/**
 * [contrat] Une plage `[start, end[` qui règle pc, internet et/ou mode. Si
 * `end` ≤ `start`, elle passe minuit et appartient au jour où elle commence.
 */
export const CHAMP_PLAGE = {
  debut: "start",
  fin: "end",
} as const;

/** [contrat] `apps { id: { allowed, category } }`. */
export const CHAMP_APPLI = {
  autorisee: "allowed",
  categorie: "category",
} as const;

/** `status/current`, écrit par le PC toutes les 60 s. [contrat] */
export const CHAMP_ETAT = {
  pc: "pc",
  internet: "internet",
  mode: "mode",
  libelleMode: "modeLabel",
  /** Filtrage réel d'internet : liste école, filtré, coupé. */
  reseau: "network",
  /** Phrase prête à afficher. */
  resume: "summary",
  prochainChangement: "nextChange",
  exceptionsActives: "activeOverrides",
  sessionOuverte: "sessionActive",
  fermetureA: "lockPendingAt",
  minutesDuJour: "todayMinutes",
  applisRefusees: "deniedApps",
  vuLe: "lastSeen",
  heureSimulee: "simulatedTime",
  version: "version",
  modeDistant: "remoteMode",
  erreurDistante: "remoteError",
  erreursConfig: "configErrors",
  sauvegarde: "backup",
  /** [contrat, à venir côté PC] catalogue des applis installées. */
  catalogue: "apps",
  /** [contrat, à venir côté PC] horloge du PC (lastSeen deviendra l'heure du serveur). */
  heurePc: "deviceTime",
} as const;
/** Suffixes par dimension dans `status/current` : `pcReason`, `modeSource`, `internetUntil`… [contrat] */
export const SUFFIXE_ETAT = {
  raison: "Reason",
  source: "Source",
  jusqua: "Until",
} as const;
/** `nextChange.{dim}` et `activeOverrides.{dim}`. [contrat] */
export const CHAMP_CHANGEMENT = { quand: "at", valeur: "value" } as const;
export const CHAMP_EXCEPTION_ACTIVE = { valeur: "value", jusqua: "until", source: "source", par: "by" } as const;
/** `backup`. [contrat] */
export const CHAMP_SAUVEGARDE = { date: "date", resultat: "resultat", code: "code" } as const;
/** Catalogue publié par le PC (à venir). [contrat, réponse c] */
export const CHAMP_CATALOGUE = {
  nom: "name",
  categorie: "category",
  categorieParDefaut: "defaultCategory",
  autorisee: "allowed",
  raison: "reason",
} as const;

/** `usage/{AAAA-MM-JJ}`, jour de Paris, écrit toutes les 5 min. Durées en SECONDES. [contrat] */
export const CHAMP_USAGE = {
  date: "date",
  secondesSession: "sessionSeconds",
  secondesActives: "activeSeconds",
  /** { idAppli | "autre:<classe>": secondes } */
  secondesParAppli: "apps",
  nomsApplis: "appNames",
  secondesParCategorie: "categories",
  lancementsRefuses: "deniedLaunches",
  codeParent: "parentCodeUses",
  executablesInconnus: "unknownExecutables",
  vpnBloques: "blockedVpn",
  limitesAtteintes: "limitReached",
  majLe: "updatedAt",
} as const;
/** Champs des événements de `usage`. [contrat] */
export const CHAMP_EVENEMENT = {
  quand: "time",
  appli: "app",
  chemin: "path",
  resultat: "result",
  service: "service",
  executable: "exe",
  action: "action",
  date: "date",
  detail: "detail",
} as const;
/** Préfixe des champs internes de `usage`, à ignorer. [contrat] */
export const PREFIXE_INTERNE = "_";
/** Préfixe des applis hors catalogue dans `usage.apps`. [contrat] */
export const PREFIXE_AUTRE_APPLI = "autre:";

/** `requests/{id}`, créées par le PC, statut posé par un parent. [contrat] */
export const CHAMP_DEMANDE = {
  id: "id",
  creeeLe: "createdAt",
  de: "from",
  type: "type",
  /** Durée, adresse du site, id d'appli, ou nom technique du mode demandé. */
  detail: "detail",
  message: "message",
  dureeMinutes: "durationMinutes",
  statut: "status",
  reponse: "response",
  traitePar: "handledBy",
  traiteLe: "handledAt",
} as const;

/** Les seuls champs d'une demande qu'un parent a le droit d'écrire. [contrat § 5] */
export const CHAMPS_DEMANDE_PARENT = [
  CHAMP_DEMANDE.statut,
  CHAMP_DEMANDE.reponse,
  CHAMP_DEMANDE.traitePar,
  CHAMP_DEMANDE.traiteLe,
] as const;

/**
 * [hub, accepté au contrat le 27.10] Échéance d'un verrouillage « jusqu'à ce
 * qu'un parent le déverrouille ». Une date lointaine plutôt qu'une absence
 * d'échéance : l'agent ignore une exception sans échéance (et débloquerait).
 */
export const JUSQUA_NOUVEL_ORDRE_MS = Date.UTC(2100, 0, 1);

/** Valeurs stockées. Clé = nom côté Family Hub, valeur = ce qui est écrit. [contrat] */
export const VALEUR = {
  pc: { autorise: "allowed", verrouille: "locked" },
  internet: { complet: "filtered", ecole: "school", coupe: "blocked" },
  mode: {
    devoirs: "devoirs",
    devoirsInternet: "devoirs_internet",
    libre: "libre",
    libreInternet: "libre_internet",
  },
  /** Filtrage réel (`status.network`). */
  reseau: { ecole: "school", complet: "filtered", coupe: "blocked" },
  categorie: { ecole: "ecole", creation: "creation", jeu: "jeu", autre: "autre" },
  /** D'où vient l'état d'une dimension. */
  source: { exception: "override", local: "local", codeParent: "code", planning: "schedule", defaut: "default" },
  typeDemande: { temps: "time", site: "site", appli: "app", mode: "mode", autre: "other" },
  statutDemande: { enAttente: "pending", acceptee: "approved", refusee: "denied", traitee: "done" },
  executablesInconnus: { signaler: "report", fermer: "kill" },
  resultatCode: { ok: "ok", echec: "echec" },
  resultatSauvegarde: { ok: "ok", echec: "echec", nonConnecte: "non_connecte" },
} as const;

/** [contrat] Version du schéma écrite dans la config. */
export const VERSION_SCHEMA = 1;

// ─── NextDNS (côté Family Hub seulement : l'agent du PC n'y touche pas) ────

/**
 * [hub] Rapport des sites et quota du mois, écrit par la fonction serveur
 * (Admin), lu par les parents : `devices/{id}/reports/nextdns`.
 */
export const SOUS_COLLECTION_RAPPORTS = "reports";
export const DOC_RAPPORT_NEXTDNS = "nextdns";
export const CHAMP_RAPPORT = {
  /** "AAAA-MM-JJ" (heure de Zurich) du jour décrit par visites et bloques. */
  jour: "day",
  visites: "visitedSites",
  bloques: "blockedSites",
  toujoursAutorises: "alwaysAllowed",
  toujoursBloques: "alwaysBlocked",
  requetesDuMois: "monthQueries",
  limiteDuMois: "monthLimit",
  majLe: "updatedAt",
} as const;
export const CHAMP_SITE = {
  domaine: "siteName",
  requetes: "count",
} as const;

/**
 * [hub] Identifiant du profil NextDNS de l'appareil, posé à la main par le
 * propriétaire : `devices/{id}/private/nextdns`. Aucune règle ne l'ouvre :
 * seule la fonction serveur (Admin) le lit.
 */
export const SOUS_COLLECTION_PRIVE = "private";
export const DOC_PRIVE_NEXTDNS = "nextdns";
export const CHAMP_PRIVE_NEXTDNS = { profil: "profileId" } as const;

/** [hub] La fonction serveur appelée par les parents, et ses actions. */
export const FONCTION_NEXTDNS = "nextdnsAppareil";
export const ACTION_NEXTDNS = {
  rapport: "report",
  debloquer: "allow",
  bloquer: "block",
  retirer: "remove",
} as const;

/** Offre gratuite NextDNS : au-delà, le service cesse de FILTRER (pages des prix, 26.10.2026). */
export const QUOTA_GRATUIT_NEXTDNS = 300_000;
/** Part du quota à partir de laquelle les parents sont prévenus. */
export const SEUIL_ALERTE_QUOTA = 0.7;
/** Un rapport plus récent est servi tel quel, sans rappeler NextDNS. */
export const FRAICHEUR_RAPPORT_MS = 5 * 60_000;

// ─── Notifications des demandes (côté Family Hub seulement) ─────────────────

/**
 * [hub] Appareils d'un parent prévenus quand l'enfant envoie une demande :
 * `devices/{id}/notifySubscribers/{uid parent}`. Chaque parent tient SA
 * liste (un jeton par téléphone ou navigateur) ; la fonction serveur la lit
 * à chaque demande créée et retire les jetons morts.
 */
export const SOUS_COLLECTION_ABONNES = "notifySubscribers";
export const CHAMP_ABONNE = {
  jetons: "pushTokens",
  majLe: "updatedAt",
} as const;
/** Au-delà, le plus ancien jeton du parent est oublié. */
export const MAX_JETONS_PAR_PARENT = 10;

/** Chemins. Les identifiants sont passés par l'appelant, jamais écrits en dur. */
export const chemin = {
  abonnes: (appareilId: string) => `${COLLECTION_APPAREILS}/${appareilId}/${SOUS_COLLECTION_ABONNES}`,
  abonne: (appareilId: string, uid: string) =>
    `${COLLECTION_APPAREILS}/${appareilId}/${SOUS_COLLECTION_ABONNES}/${uid}`,
  rapportNextdns: (appareilId: string) =>
    `${COLLECTION_APPAREILS}/${appareilId}/${SOUS_COLLECTION_RAPPORTS}/${DOC_RAPPORT_NEXTDNS}`,
  priveNextdns: (appareilId: string) =>
    `${COLLECTION_APPAREILS}/${appareilId}/${SOUS_COLLECTION_PRIVE}/${DOC_PRIVE_NEXTDNS}`,
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

/**
 * [contrat § 2.5 + réponse f] Liste école du PC au 27.10.2026, pour initialiser
 * un appareil neuf : si le champ existe dans Firestore, il REMPLACE la liste du PC.
 */
export const LISTE_ECOLE_INITIALE = [
  "index-education.net",
  "index-education.com",
  "educonnect.education.gouv.fr",
  "education.gouv.fr",
  "gstatic.com",
  "googleapis.com",
  "accounts.google.com",
  "eclat-bfc.fr",
  "larousse.fr",
  "lerobert.com",
] as const;
