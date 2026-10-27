/**
 * Traduction document Firestore ↔ modèle Family Hub, selon le contrat.
 * Lecture TOLÉRANTE : un champ absent ou mal formé retombe sur une valeur sûre
 * (planning par défaut, état inconnu) plutôt que de casser l'écran — c'est le
 * PC, pas nous, qui écrit status, usage et requests, et il écrit ses dates en
 * CHAÎNES ISO. Écriture STRICTE : on n'écrit que des valeurs du schéma.
 * À l'écriture, une `Date` devient un Timestamp Firestore (conversion du SDK).
 */
import {
  CHAMP_APPLI,
  CHAMP_CATALOGUE,
  CHAMP_CHANGEMENT,
  CHAMP_CONFIG,
  CHAMP_DEMANDE,
  CHAMP_ETAT,
  CHAMP_EVENEMENT,
  CHAMP_PLAGE,
  CHAMP_RAPPORT,
  CHAMP_REGLE,
  CHAMP_SAUVEGARDE,
  CHAMP_SITE,
  CHAMP_USAGE,
  CLE_JOUR,
  LISTE_ECOLE_INITIALE,
  PREFIXE_INTERNE,
  QUOTA_GRATUIT_NEXTDNS,
  SUFFIXE_ETAT,
  VALEUR,
  VERSION_SCHEMA,
} from "./schema.js";
import { DEFAUTS, PLANNING_DEFAUT, heureValide } from "./regles.js";
import type {
  AccesPc,
  Appli,
  Categorie,
  ConfigAppareil,
  Defauts,
  Demande,
  Dimension,
  EntreeCatalogue,
  EtatAppareil,
  EtatDimension,
  Evenement,
  Exception,
  ExecutablesInconnus,
  Mode,
  ModeInternet,
  Plage,
  Planning,
  RapportNextdns,
  Reglage,
  Reseau,
  SiteDuJour,
  Source,
  StatutDemande,
  TypeDemande,
  UsageJour,
} from "./types.js";

type Brut = Record<string, unknown>;

function estObjet(v: unknown): v is Brut {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parmi<T extends string>(valeurs: Record<string, T>, v: unknown): T | null {
  return (Object.values(valeurs) as unknown[]).includes(v) ? (v as T) : null;
}

/** Timestamp Firestore, Date, millisecondes ou texte ISO → Date. */
export function enDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (estObjet(v) && typeof v.toDate === "function") return (v.toDate as () => Date)();
  if (typeof v === "number" || typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function texte(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function nombre(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}

function textes(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
}

const DIMENSIONS: Dimension[] = ["pc", "internet", "mode"];

/** Les dimensions présentes et valides d'un réglage (plage, exception, défauts). */
function reglageDepuis(o: Brut): Reglage {
  const r: Reglage = {};
  const pc = parmi<AccesPc>(VALEUR.pc, o[CHAMP_REGLE.pc]);
  const internet = parmi<ModeInternet>(VALEUR.internet, o[CHAMP_REGLE.internet]);
  const mode = parmi<Mode>(VALEUR.mode, o[CHAMP_REGLE.mode]);
  if (pc) r.pc = pc;
  if (internet) r.internet = internet;
  if (mode) r.mode = mode;
  return r;
}

function reglageVers(r: Reglage): Brut {
  return {
    ...(r.pc ? { [CHAMP_REGLE.pc]: r.pc } : {}),
    ...(r.internet ? { [CHAMP_REGLE.internet]: r.internet } : {}),
    ...(r.mode ? { [CHAMP_REGLE.mode]: r.mode } : {}),
  };
}

// ---------------------------------------------------------------- config

function plageDepuis(v: unknown): Plage | null {
  if (!estObjet(v)) return null;
  const debut = v[CHAMP_PLAGE.debut];
  const fin = v[CHAMP_PLAGE.fin];
  if (typeof debut !== "string" || typeof fin !== "string" || !heureValide(debut) || !heureValide(fin)) return null;
  if (debut === fin) return null;
  const r = reglageDepuis(v);
  return Object.keys(r).length ? { debut, fin, ...r } : null;
}

/** Planning absent → défaut ; un jour absent → celui du défaut ; une plage invalide est écartée (le PC fait de même). */
function planningDepuis(v: unknown): Planning {
  if (!estObjet(v)) return { ...PLANNING_DEFAUT };
  const out = {} as Planning;
  for (const j of CLE_JOUR) {
    const jour = v[j];
    out[j] = !(j in v)
      ? PLANNING_DEFAUT[j]
      : Array.isArray(jour)
        ? jour.map(plageDepuis).filter((p): p is Plage => p !== null)
        : [];
  }
  return out;
}

export function planningVers(p: Planning): Brut {
  const out: Brut = {};
  for (const j of CLE_JOUR) {
    out[j] = p[j].map((pl) => ({ [CHAMP_PLAGE.debut]: pl.debut, [CHAMP_PLAGE.fin]: pl.fin, ...reglageVers(pl) }));
  }
  return out;
}

function defautsDepuis(v: unknown): Defauts {
  const r = estObjet(v) ? reglageDepuis(v) : {};
  return { pc: r.pc ?? DEFAUTS.pc, internet: r.internet ?? DEFAUTS.internet, mode: r.mode ?? DEFAUTS.mode };
}

/** Sans échéance lisible, une exception n'existe pas (le PC l'ignore aussi). */
function exceptionDepuis(v: unknown): Exception | null {
  if (!estObjet(v)) return null;
  const jusqua = enDate(v[CHAMP_REGLE.jusqua]);
  const r = reglageDepuis(v);
  if (!jusqua || !Object.keys(r).length) return null;
  return { ...r, jusqua, par: texte(v[CHAMP_REGLE.par]) ?? "", poseLe: enDate(v[CHAMP_REGLE.poseLe]) };
}

/** L'heure de pose est passée à part par l'appelant (serverTimestamp() côté SDK). */
export function exceptionVers(e: Exception, poseLe: unknown): Brut {
  if (!e.pc && !e.internet && !e.mode) throw new Error("Une exception porte sur le PC, internet ou le mode.");
  return {
    ...reglageVers(e),
    [CHAMP_REGLE.jusqua]: e.jusqua,
    [CHAMP_REGLE.par]: e.par.slice(0, 60),
    [CHAMP_REGLE.poseLe]: poseLe,
  };
}

function applisDepuis(v: unknown): Record<string, Appli> {
  const out: Record<string, Appli> = {};
  if (!estObjet(v)) return out;
  for (const [id, a] of Object.entries(v)) {
    if (!estObjet(a)) continue;
    const categorie = parmi<Categorie>(VALEUR.categorie, a[CHAMP_APPLI.categorie]);
    out[id] = { autorisee: a[CHAMP_APPLI.autorisee] !== false, ...(categorie ? { categorie } : {}) };
  }
  return out;
}

export function appliVers(a: Appli): Brut {
  return {
    [CHAMP_APPLI.autorisee]: a.autorisee,
    ...(a.categorie ? { [CHAMP_APPLI.categorie]: a.categorie } : {}),
  };
}

function limitesDepuis(v: unknown): Partial<Record<Categorie, number>> {
  const out: Partial<Record<Categorie, number>> = {};
  if (!estObjet(v)) return out;
  for (const [cat, m] of Object.entries(v)) {
    const c = parmi<Categorie>(VALEUR.categorie, cat);
    if (c && typeof m === "number" && m > 0) out[c] = m;
  }
  return out;
}

export function limitesVers(l: Partial<Record<Categorie, number>>): Brut {
  const out: Brut = {};
  for (const [c, m] of Object.entries(l)) if (typeof m === "number" && m > 0) out[c] = Math.round(m);
  return out;
}

function nomsParentsDepuis(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (estObjet(v)) for (const [uid, n] of Object.entries(v)) if (texte(n)) out[uid] = n as string;
  return out;
}

export function configDepuis(id: string, data: Brut): ConfigAppareil {
  return {
    id,
    foyer: texte(data[CHAMP_CONFIG.foyer]) ?? "",
    compteAppareil: texte(data[CHAMP_CONFIG.compteAppareil]),
    nom: texte(data[CHAMP_CONFIG.nom]),
    planning: planningDepuis(data[CHAMP_CONFIG.planning]),
    defauts: defautsDepuis(data[CHAMP_CONFIG.defauts]),
    exception: exceptionDepuis(data[CHAMP_CONFIG.exception]),
    reinitialiserLocalAvant: enDate(data[CHAMP_CONFIG.reinitialiserLocalAvant]),
    listeEcole: textes(data[CHAMP_CONFIG.listeEcole]),
    applis: applisDepuis(data[CHAMP_CONFIG.applis]),
    limites: limitesDepuis(data[CHAMP_CONFIG.limites]),
    executablesInconnus:
      parmi<ExecutablesInconnus>(VALEUR.executablesInconnus, data[CHAMP_CONFIG.executablesInconnus]) ??
      VALEUR.executablesInconnus.signaler,
    nomsParents: nomsParentsDepuis(data[CHAMP_CONFIG.nomsParents]),
    modifieLe: enDate(data[CHAMP_CONFIG.modifieLe]),
    modifiePar: texte(data[CHAMP_CONFIG.modifiePar]),
  };
}

/** Document de config complet, à la création d'un appareil (contrat § 2.8). */
export function nouvelleConfigVers(c: {
  foyer: string;
  compteAppareil: string | null;
  nom: string | null;
  nomsParents: Record<string, string>;
  par: string;
  quand: Date;
}): Brut {
  return {
    [CHAMP_CONFIG.versionSchema]: VERSION_SCHEMA,
    [CHAMP_CONFIG.foyer]: c.foyer,
    [CHAMP_CONFIG.compteAppareil]: c.compteAppareil,
    [CHAMP_CONFIG.nom]: c.nom,
    [CHAMP_CONFIG.planning]: planningVers(PLANNING_DEFAUT),
    [CHAMP_CONFIG.defauts]: reglageVers(DEFAUTS),
    [CHAMP_CONFIG.exception]: null,
    [CHAMP_CONFIG.reinitialiserLocalAvant]: null,
    [CHAMP_CONFIG.listeEcole]: [...LISTE_ECOLE_INITIALE],
    [CHAMP_CONFIG.applis]: {},
    [CHAMP_CONFIG.limites]: {},
    [CHAMP_CONFIG.executablesInconnus]: VALEUR.executablesInconnus.signaler,
    [CHAMP_CONFIG.nomsParents]: c.nomsParents,
    [CHAMP_CONFIG.modifieLe]: c.quand,
    [CHAMP_CONFIG.modifiePar]: c.par,
  };
}

// ---------------------------------------------------------------- état (écrit par le PC)

function dimensionDepuis<V extends string>(data: Brut, dim: Dimension, valeurs: Record<string, V>): EtatDimension<V> | null {
  const valeur = parmi<V>(valeurs, data[dim]);
  if (!valeur) return null;
  return {
    valeur,
    raison: texte(data[dim + SUFFIXE_ETAT.raison]),
    source: parmi<Source>(VALEUR.source, data[dim + SUFFIXE_ETAT.source]),
    jusqua: enDate(data[dim + SUFFIXE_ETAT.jusqua]),
  };
}

function catalogueDepuis(v: unknown): Record<string, EntreeCatalogue> {
  const out: Record<string, EntreeCatalogue> = {};
  if (!estObjet(v)) return out;
  for (const [id, a] of Object.entries(v)) {
    if (!estObjet(a)) continue;
    out[id] = {
      nom: texte(a[CHAMP_CATALOGUE.nom]) ?? id,
      categorie: parmi<Categorie>(VALEUR.categorie, a[CHAMP_CATALOGUE.categorie]),
      categorieParDefaut: parmi<Categorie>(VALEUR.categorie, a[CHAMP_CATALOGUE.categorieParDefaut]),
      autorisee: a[CHAMP_CATALOGUE.autorisee] !== false,
      raison: texte(a[CHAMP_CATALOGUE.raison]),
    };
  }
  return out;
}

export function etatDepuis(data: Brut | undefined): EtatAppareil | null {
  if (!data) return null;
  const pc = dimensionDepuis<AccesPc>(data, "pc", VALEUR.pc);
  const internet = dimensionDepuis<ModeInternet>(data, "internet", VALEUR.internet);
  if (!pc || !internet) return null;
  const mode = dimensionDepuis<Mode>(data, "mode", VALEUR.mode) ?? {
    valeur: DEFAUTS.mode,
    raison: null,
    source: null,
    jusqua: null,
  };
  const prochain: EtatAppareil["prochainChangement"] = {};
  const brutProchain = data[CHAMP_ETAT.prochainChangement];
  if (estObjet(brutProchain)) {
    for (const dim of DIMENSIONS) {
      const c = brutProchain[dim];
      const quand = estObjet(c) ? enDate(c[CHAMP_CHANGEMENT.quand]) : null;
      const valeur = estObjet(c) ? texte(c[CHAMP_CHANGEMENT.valeur]) : null;
      prochain[dim] = quand && valeur ? { quand, valeur } : null;
    }
  }
  const refusees: Record<string, string> = {};
  const brutRefusees = data[CHAMP_ETAT.applisRefusees];
  if (estObjet(brutRefusees)) for (const [id, r] of Object.entries(brutRefusees)) refusees[id] = texte(r) ?? "";
  const brutSauvegarde = data[CHAMP_ETAT.sauvegarde];
  return {
    pc,
    internet,
    mode,
    libelleMode: texte(data[CHAMP_ETAT.libelleMode]),
    reseau: parmi<Reseau>(VALEUR.reseau, data[CHAMP_ETAT.reseau]),
    resume: texte(data[CHAMP_ETAT.resume]),
    prochainChangement: prochain,
    sessionOuverte: data[CHAMP_ETAT.sessionOuverte] === true,
    fermetureA: enDate(data[CHAMP_ETAT.fermetureA]),
    minutesDuJour: nombre(data[CHAMP_ETAT.minutesDuJour]),
    applisRefusees: refusees,
    vuLe: enDate(data[CHAMP_ETAT.vuLe]),
    heurePc: enDate(data[CHAMP_ETAT.heurePc]),
    version: texte(data[CHAMP_ETAT.version]),
    erreursConfig: textes(data[CHAMP_ETAT.erreursConfig]),
    sauvegarde: estObjet(brutSauvegarde)
      ? { date: enDate(brutSauvegarde[CHAMP_SAUVEGARDE.date]), resultat: texte(brutSauvegarde[CHAMP_SAUVEGARDE.resultat]) }
      : null,
    catalogue: catalogueDepuis(data[CHAMP_ETAT.catalogue]),
  };
}

/** Ce que le PC écrit (simulateur, tests) : dates en chaînes ISO, comme l'agent. */
export function etatVers(e: {
  pc: AccesPc;
  internet: ModeInternet;
  mode: Mode;
  raisons: Partial<Record<Dimension, string>>;
  sources: Partial<Record<Dimension, Source>>;
  jusqua: Partial<Record<Dimension, Date | null>>;
  libelleMode: string;
  reseau: Reseau;
  resume: string;
  minutesDuJour: number;
  sessionOuverte: boolean;
  applisRefusees: Record<string, string>;
  vuLe: Date;
  version: string;
}): Brut {
  const out: Brut = {
    [CHAMP_ETAT.pc]: e.pc,
    [CHAMP_ETAT.internet]: e.internet,
    [CHAMP_ETAT.mode]: e.mode,
    [CHAMP_ETAT.libelleMode]: e.libelleMode,
    [CHAMP_ETAT.reseau]: e.reseau,
    [CHAMP_ETAT.resume]: e.resume,
    [CHAMP_ETAT.minutesDuJour]: e.minutesDuJour,
    [CHAMP_ETAT.sessionOuverte]: e.sessionOuverte,
    [CHAMP_ETAT.applisRefusees]: e.applisRefusees,
    [CHAMP_ETAT.vuLe]: e.vuLe.toISOString(),
    [CHAMP_ETAT.version]: e.version,
    [CHAMP_ETAT.erreursConfig]: [],
  };
  for (const dim of DIMENSIONS) {
    out[dim + SUFFIXE_ETAT.raison] = e.raisons[dim] ?? null;
    out[dim + SUFFIXE_ETAT.source] = e.sources[dim] ?? null;
    out[dim + SUFFIXE_ETAT.jusqua] = e.jusqua[dim]?.toISOString() ?? null;
  }
  return out;
}

// ---------------------------------------------------------------- usage (écrit par le PC)

function evenementsDepuis(v: unknown, lire: (e: Brut) => Partial<Evenement>): Evenement[] {
  if (!Array.isArray(v)) return [];
  return v.filter(estObjet).map((e) => ({ quand: enDate(e[CHAMP_EVENEMENT.quand] ?? e[CHAMP_EVENEMENT.date]), ...lire(e) }));
}

function secondesParCle(v: unknown, garder: (cle: string) => boolean = () => true): Record<string, number> {
  const out: Record<string, number> = {};
  if (estObjet(v)) for (const [k, s] of Object.entries(v)) if (!k.startsWith(PREFIXE_INTERNE) && garder(k)) out[k] = nombre(s);
  return out;
}

export function usageDepuis(jour: string, data: Brut): UsageJour {
  const noms: Record<string, string> = {};
  const brutNoms = data[CHAMP_USAGE.nomsApplis];
  if (estObjet(brutNoms)) for (const [id, n] of Object.entries(brutNoms)) if (texte(n)) noms[id] = n as string;
  const limites: Partial<Record<Categorie, string>> = {};
  const brutLimites = data[CHAMP_USAGE.limitesAtteintes];
  if (estObjet(brutLimites)) {
    for (const [c, h] of Object.entries(brutLimites)) {
      const cat = parmi<Categorie>(VALEUR.categorie, c);
      if (cat && texte(h)) limites[cat] = h as string;
    }
  }
  return {
    jour,
    secondesSession: nombre(data[CHAMP_USAGE.secondesSession]),
    secondesActives: nombre(data[CHAMP_USAGE.secondesActives]),
    secondesParAppli: secondesParCle(data[CHAMP_USAGE.secondesParAppli]),
    nomsApplis: noms,
    secondesParCategorie: secondesParCle(data[CHAMP_USAGE.secondesParCategorie], (k) =>
      parmi(VALEUR.categorie, k) !== null,
    ) as Partial<Record<Categorie, number>>,
    lancementsRefuses: evenementsDepuis(data[CHAMP_USAGE.lancementsRefuses], (e) => ({
      ...(texte(e[CHAMP_EVENEMENT.appli]) ? { appli: e[CHAMP_EVENEMENT.appli] as string } : {}),
    })),
    codeParent: evenementsDepuis(data[CHAMP_USAGE.codeParent], (e) => ({
      reussi: e[CHAMP_EVENEMENT.resultat] === VALEUR.resultatCode.ok,
    })),
    executablesInconnus: evenementsDepuis(data[CHAMP_USAGE.executablesInconnus], (e) => ({
      ...(texte(e[CHAMP_EVENEMENT.executable]) ? { detail: e[CHAMP_EVENEMENT.executable] as string } : {}),
    })),
    vpnBloques: evenementsDepuis(data[CHAMP_USAGE.vpnBloques], (e) => ({
      ...(texte(e[CHAMP_EVENEMENT.detail]) ? { detail: e[CHAMP_EVENEMENT.detail] as string } : {}),
    })),
    limitesAtteintes: limites,
    majLe: enDate(data[CHAMP_USAGE.majLe]),
  };
}

/** Ce que le PC écrit (simulateur, tests). */
export function usageVers(u: UsageJour): Brut {
  return {
    [CHAMP_USAGE.date]: u.jour,
    [CHAMP_USAGE.secondesSession]: u.secondesSession,
    [CHAMP_USAGE.secondesActives]: u.secondesActives,
    [CHAMP_USAGE.secondesParAppli]: { ...u.secondesParAppli },
    [CHAMP_USAGE.nomsApplis]: { ...u.nomsApplis },
    [CHAMP_USAGE.secondesParCategorie]: { ...u.secondesParCategorie },
    [CHAMP_USAGE.lancementsRefuses]: u.lancementsRefuses.map((e) => ({
      [CHAMP_EVENEMENT.quand]: e.quand?.toISOString() ?? null,
      [CHAMP_EVENEMENT.appli]: e.appli ?? null,
    })),
    [CHAMP_USAGE.codeParent]: u.codeParent.map((e) => ({
      [CHAMP_EVENEMENT.quand]: e.quand?.toISOString() ?? null,
      [CHAMP_EVENEMENT.resultat]: e.reussi ? VALEUR.resultatCode.ok : VALEUR.resultatCode.echec,
    })),
    [CHAMP_USAGE.executablesInconnus]: u.executablesInconnus.map((e) => ({
      [CHAMP_EVENEMENT.quand]: e.quand?.toISOString() ?? null,
      [CHAMP_EVENEMENT.executable]: e.detail ?? null,
    })),
    [CHAMP_USAGE.vpnBloques]: u.vpnBloques.map((e) => ({
      [CHAMP_EVENEMENT.date]: e.quand?.toISOString() ?? null,
      [CHAMP_EVENEMENT.detail]: e.detail ?? null,
    })),
    [CHAMP_USAGE.limitesAtteintes]: { ...u.limitesAtteintes },
    [CHAMP_USAGE.majLe]: u.majLe?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------- demandes

export function demandeDepuis(id: string, data: Brut): Demande | null {
  const type = parmi<TypeDemande>(VALEUR.typeDemande, data[CHAMP_DEMANDE.type]);
  if (!type) return null;
  const duree = data[CHAMP_DEMANDE.dureeMinutes];
  return {
    id,
    type,
    detail: typeof data[CHAMP_DEMANDE.detail] === "string" ? (data[CHAMP_DEMANDE.detail] as string) : "",
    message: typeof data[CHAMP_DEMANDE.message] === "string" ? (data[CHAMP_DEMANDE.message] as string) : "",
    dureeMinutes: typeof duree === "number" && duree > 0 ? Math.round(duree) : null,
    creeeLe: enDate(data[CHAMP_DEMANDE.creeeLe]),
    statut: parmi<StatutDemande>(VALEUR.statutDemande, data[CHAMP_DEMANDE.statut]) ?? VALEUR.statutDemande.enAttente,
    reponse: texte(data[CHAMP_DEMANDE.reponse]),
    traitePar: texte(data[CHAMP_DEMANDE.traitePar]),
    traiteLe: enDate(data[CHAMP_DEMANDE.traiteLe]),
  };
}

/** Demande telle que le PC la crée (simulateur, tests). */
export function nouvelleDemandeVers(d: {
  id: string;
  /** Qui demande, tel que le PC l'écrit (le simulateur le reçoit en argument). */
  de: string;
  type: TypeDemande;
  detail: string;
  message: string;
  dureeMinutes: number | null;
  creeeLe: Date;
}): Brut {
  return {
    [CHAMP_DEMANDE.id]: d.id,
    [CHAMP_DEMANDE.creeeLe]: d.creeeLe.toISOString(),
    [CHAMP_DEMANDE.de]: d.de,
    [CHAMP_DEMANDE.type]: d.type,
    [CHAMP_DEMANDE.detail]: d.detail,
    [CHAMP_DEMANDE.message]: d.message,
    [CHAMP_DEMANDE.dureeMinutes]: d.dureeMinutes,
    [CHAMP_DEMANDE.statut]: VALEUR.statutDemande.enAttente,
  };
}

/** Décision d'un PARENT : uniquement les champs de CHAMPS_DEMANDE_PARENT. `traiteLe` : serverTimestamp(). */
export function decisionVers(d: { statut: StatutDemande; par: string; traiteLe: unknown; reponse?: string }): Brut {
  return {
    [CHAMP_DEMANDE.statut]: d.statut,
    [CHAMP_DEMANDE.reponse]: d.reponse ?? null,
    [CHAMP_DEMANDE.traitePar]: d.par,
    [CHAMP_DEMANDE.traiteLe]: d.traiteLe,
  };
}

// ---------------------------------------------------------------- NextDNS

function sitesDepuis(v: unknown): SiteDuJour[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(estObjet)
    .map((s) => ({ domaine: texte(s[CHAMP_SITE.domaine]) ?? "", requetes: nombre(s[CHAMP_SITE.requetes]) }))
    .filter((s) => s.domaine);
}

export function rapportNextdnsDepuis(data: Brut | undefined): RapportNextdns | null {
  if (!data) return null;
  return {
    jour: texte(data[CHAMP_RAPPORT.jour]),
    visites: sitesDepuis(data[CHAMP_RAPPORT.visites]),
    bloques: sitesDepuis(data[CHAMP_RAPPORT.bloques]),
    toujoursAutorises: textes(data[CHAMP_RAPPORT.toujoursAutorises]),
    toujoursBloques: textes(data[CHAMP_RAPPORT.toujoursBloques]),
    requetesDuMois: nombre(data[CHAMP_RAPPORT.requetesDuMois]),
    limiteDuMois: nombre(data[CHAMP_RAPPORT.limiteDuMois]) || QUOTA_GRATUIT_NEXTDNS,
    majLe: enDate(data[CHAMP_RAPPORT.majLe]),
  };
}

