/**
 * Traduction document Firestore ↔ modèle Family Hub. Lecture TOLÉRANTE : un
 * champ absent ou mal formé retombe sur une valeur sûre (planning par
 * défaut, état inconnu) plutôt que de casser l'écran — c'est l'agent du PC,
 * pas nous, qui écrit status, usage et requests. Écriture STRICTE : on
 * n'écrit que des valeurs du schéma.
 *
 * Les dates sortent en `Date` ; à l'écriture, une `Date` devient un
 * Timestamp Firestore (conversion faite par le SDK).
 */
import {
  CHAMP_APPLI,
  CHAMP_CONFIG,
  CHAMP_CRENEAU,
  CHAMP_DEMANDE,
  CHAMP_ETAT,
  CHAMP_EVENEMENT,
  CHAMP_LIMITE,
  CHAMP_REGLE,
  CHAMP_USAGE,
  CLE_JOUR,
  VALEUR,
} from "./schema.js";
import { DEFAUTS, PLANNING_DEFAUT, heureValide } from "./regles.js";
import type {
  AccesPc,
  Appli,
  Categorie,
  ConfigAppareil,
  Creneau,
  Defauts,
  Demande,
  EtatAppareil,
  Evenement,
  Exception,
  Limite,
  ModeInternet,
  Planning,
  Raison,
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

// ---------------------------------------------------------------- config

function creneauDepuis(v: unknown): Creneau | null {
  if (!estObjet(v)) return null;
  const debut = v[CHAMP_CRENEAU.debut];
  const fin = v[CHAMP_CRENEAU.fin];
  return typeof debut === "string" && typeof fin === "string" && heureValide(debut) && heureValide(fin)
    ? { debut, fin }
    : null;
}

/** Planning absent → planning par défaut ; un jour absent → celui du défaut ; null → pas de verrou. */
function planningDepuis(v: unknown): Planning {
  if (!estObjet(v)) return { ...PLANNING_DEFAUT };
  const out = {} as Planning;
  for (const j of CLE_JOUR) {
    out[j] = !(j in v) ? PLANNING_DEFAUT[j] : v[j] === null ? null : creneauDepuis(v[j]) ?? PLANNING_DEFAUT[j];
  }
  return out;
}

function defautsDepuis(v: unknown): Defauts {
  const o = estObjet(v) ? v : {};
  return {
    pc: parmi(VALEUR.pc, o[CHAMP_REGLE.pc]) ?? DEFAUTS.pc,
    internet: parmi(VALEUR.internet, o[CHAMP_REGLE.internet]) ?? DEFAUTS.internet,
  };
}

/** Sans échéance lisible, une exception n'existe pas (elle n'expirerait jamais). */
function exceptionDepuis(v: unknown): Exception | null {
  if (!estObjet(v)) return null;
  const jusqua = enDate(v[CHAMP_REGLE.jusqua]);
  const pc = parmi(VALEUR.pc, v[CHAMP_REGLE.pc]) ?? undefined;
  const internet = parmi(VALEUR.internet, v[CHAMP_REGLE.internet]) ?? undefined;
  if (!jusqua || (!pc && !internet)) return null;
  return { pc, internet, jusqua, par: texte(v[CHAMP_REGLE.par]) ?? "" };
}

function applisDepuis(v: unknown): Record<string, Appli> {
  const out: Record<string, Appli> = {};
  if (!estObjet(v)) return out;
  for (const [id, a] of Object.entries(v)) {
    if (!estObjet(a)) continue;
    out[id] = {
      autorisee: a[CHAMP_APPLI.autorisee] !== false,
      categorie: parmi(VALEUR.categorie, a[CHAMP_APPLI.categorie]) ?? VALEUR.categorie.autre,
      ...(texte(a[CHAMP_APPLI.nom]) ? { nom: a[CHAMP_APPLI.nom] as string } : {}),
    };
  }
  return out;
}

function limitesDepuis(v: unknown): Partial<Record<Categorie, Limite>> {
  const out: Partial<Record<Categorie, Limite>> = {};
  if (!estObjet(v)) return out;
  for (const [cat, l] of Object.entries(v)) {
    const c = parmi(VALEUR.categorie, cat);
    if (!c || !estObjet(l)) continue;
    out[c] = { active: l[CHAMP_LIMITE.active] === true, minutes: nombre(l[CHAMP_LIMITE.minutes]) };
  }
  return out;
}

export function configDepuis(id: string, data: Brut): ConfigAppareil {
  const liste = data[CHAMP_CONFIG.listeEcole];
  return {
    id,
    foyer: texte(data[CHAMP_CONFIG.foyer]) ?? "",
    compteAppareil: texte(data[CHAMP_CONFIG.compteAppareil]),
    nom: texte(data[CHAMP_CONFIG.nom]),
    planning: planningDepuis(data[CHAMP_CONFIG.planning]),
    defauts: defautsDepuis(data[CHAMP_CONFIG.defauts]),
    exception: exceptionDepuis(data[CHAMP_CONFIG.exception]),
    listeEcole: Array.isArray(liste) ? liste.filter((d): d is string => typeof d === "string") : [],
    applis: applisDepuis(data[CHAMP_CONFIG.applis]),
    limites: limitesDepuis(data[CHAMP_CONFIG.limites]),
    modifieLe: enDate(data[CHAMP_CONFIG.modifieLe]),
    modifiePar: texte(data[CHAMP_CONFIG.modifiePar]),
  };
}

export function planningVers(p: Planning): Brut {
  const out: Brut = {};
  for (const j of CLE_JOUR) {
    const c = p[j];
    out[j] = c ? { [CHAMP_CRENEAU.debut]: c.debut, [CHAMP_CRENEAU.fin]: c.fin } : null;
  }
  return out;
}

export function exceptionVers(e: Exception): Brut {
  if (!e.pc && !e.internet) throw new Error("Une exception porte sur le PC, sur internet, ou les deux.");
  return {
    ...(e.pc ? { [CHAMP_REGLE.pc]: e.pc } : {}),
    ...(e.internet ? { [CHAMP_REGLE.internet]: e.internet } : {}),
    [CHAMP_REGLE.jusqua]: e.jusqua,
    [CHAMP_REGLE.par]: e.par,
  };
}

export function appliVers(a: Appli): Brut {
  return {
    [CHAMP_APPLI.autorisee]: a.autorisee,
    [CHAMP_APPLI.categorie]: a.categorie,
    ...(a.nom ? { [CHAMP_APPLI.nom]: a.nom } : {}),
  };
}

export function limitesVers(l: Partial<Record<Categorie, Limite>>): Brut {
  const out: Brut = {};
  for (const [c, v] of Object.entries(l)) {
    if (v) out[c] = { [CHAMP_LIMITE.active]: v.active, [CHAMP_LIMITE.minutes]: v.minutes };
  }
  return out;
}

/** Document de config complet, à la création d'un appareil. */
export function nouvelleConfigVers(c: {
  foyer: string;
  compteAppareil: string | null;
  nom: string | null;
  par: string;
  quand: Date;
}): Brut {
  return {
    [CHAMP_CONFIG.foyer]: c.foyer,
    [CHAMP_CONFIG.compteAppareil]: c.compteAppareil,
    [CHAMP_CONFIG.nom]: c.nom,
    [CHAMP_CONFIG.planning]: planningVers(PLANNING_DEFAUT),
    [CHAMP_CONFIG.defauts]: { [CHAMP_REGLE.pc]: DEFAUTS.pc, [CHAMP_REGLE.internet]: DEFAUTS.internet },
    [CHAMP_CONFIG.exception]: null,
    [CHAMP_CONFIG.listeEcole]: [],
    [CHAMP_CONFIG.applis]: {},
    [CHAMP_CONFIG.limites]: {},
    [CHAMP_CONFIG.modifieLe]: c.quand,
    [CHAMP_CONFIG.modifiePar]: c.par,
  };
}

// ---------------------------------------------------------------- appareil

export function etatDepuis(data: Brut | undefined): EtatAppareil | null {
  if (!data) return null;
  const pc = parmi<AccesPc>(VALEUR.pc, data[CHAMP_ETAT.pc]);
  const internet = parmi<ModeInternet>(VALEUR.internet, data[CHAMP_ETAT.internet]);
  if (!pc || !internet) return null;
  return {
    pc,
    internet,
    raison: parmi<Raison>(VALEUR.raison, data[CHAMP_ETAT.raison]),
    vuLe: enDate(data[CHAMP_ETAT.vuLe]),
    version: texte(data[CHAMP_ETAT.version]),
  };
}

export function etatVers(e: EtatAppareil): Brut {
  return {
    [CHAMP_ETAT.pc]: e.pc,
    [CHAMP_ETAT.internet]: e.internet,
    [CHAMP_ETAT.raison]: e.raison,
    [CHAMP_ETAT.vuLe]: e.vuLe,
    [CHAMP_ETAT.version]: e.version,
  };
}

function evenementsDepuis(v: unknown): Evenement[] {
  if (!Array.isArray(v)) return [];
  return v.filter(estObjet).map((e) => ({
    ...(texte(e[CHAMP_EVENEMENT.appli]) ? { appli: e[CHAMP_EVENEMENT.appli] as string } : {}),
    quand: enDate(e[CHAMP_EVENEMENT.quand]),
  }));
}

function evenementsVers(es: Evenement[]): Brut[] {
  return es.map((e) => ({
    ...(e.appli ? { [CHAMP_EVENEMENT.appli]: e.appli } : {}),
    [CHAMP_EVENEMENT.quand]: e.quand,
  }));
}

export function usageDepuis(jour: string, data: Brut): UsageJour {
  const parAppli: Record<string, number> = {};
  const brut = data[CHAMP_USAGE.minutesParAppli];
  if (estObjet(brut)) for (const [id, m] of Object.entries(brut)) parAppli[id] = nombre(m);
  return {
    jour,
    minutesSession: nombre(data[CHAMP_USAGE.minutesSession]),
    minutesParAppli: parAppli,
    lancementsRefuses: evenementsDepuis(data[CHAMP_USAGE.lancementsRefuses]),
    codeParent: evenementsDepuis(data[CHAMP_USAGE.codeParent]),
    majLe: enDate(data[CHAMP_USAGE.majLe]),
  };
}

export function usageVers(u: UsageJour): Brut {
  return {
    [CHAMP_USAGE.minutesSession]: u.minutesSession,
    [CHAMP_USAGE.minutesParAppli]: { ...u.minutesParAppli },
    [CHAMP_USAGE.lancementsRefuses]: evenementsVers(u.lancementsRefuses),
    [CHAMP_USAGE.codeParent]: evenementsVers(u.codeParent),
    [CHAMP_USAGE.majLe]: u.majLe,
  };
}

export function demandeDepuis(id: string, data: Brut): Demande | null {
  const type = parmi<TypeDemande>(VALEUR.typeDemande, data[CHAMP_DEMANDE.type]);
  if (!type) return null;
  return {
    id,
    type,
    message: typeof data[CHAMP_DEMANDE.message] === "string" ? (data[CHAMP_DEMANDE.message] as string) : "",
    cible: texte(data[CHAMP_DEMANDE.cible]),
    creeeLe: enDate(data[CHAMP_DEMANDE.creeeLe]),
    statut: parmi<StatutDemande>(VALEUR.statutDemande, data[CHAMP_DEMANDE.statut]) ?? VALEUR.statutDemande.enAttente,
    decidePar: texte(data[CHAMP_DEMANDE.decidePar]),
    decideLe: enDate(data[CHAMP_DEMANDE.decideLe]),
    accordeJusqua: enDate(data[CHAMP_DEMANDE.accordeJusqua]),
  };
}

/** Demande telle que l'APPAREIL la crée (simulateur, tests). */
export function nouvelleDemandeVers(d: {
  type: TypeDemande;
  message: string;
  cible: string | null;
  creeeLe: Date;
}): Brut {
  return {
    [CHAMP_DEMANDE.type]: d.type,
    [CHAMP_DEMANDE.message]: d.message,
    [CHAMP_DEMANDE.cible]: d.cible,
    [CHAMP_DEMANDE.creeeLe]: d.creeeLe,
    [CHAMP_DEMANDE.statut]: VALEUR.statutDemande.enAttente,
  };
}

/** Décision d'un PARENT : uniquement les champs de CHAMPS_DEMANDE_PARENT. */
export function decisionVers(d: {
  statut: StatutDemande;
  par: string;
  quand: Date;
  accordeJusqua: Date | null;
}): Brut {
  return {
    [CHAMP_DEMANDE.statut]: d.statut,
    [CHAMP_DEMANDE.decidePar]: d.par,
    [CHAMP_DEMANDE.decideLe]: d.quand,
    [CHAMP_DEMANDE.accordeJusqua]: d.accordeJusqua,
  };
}
