/**
 * Écran « PC des enfants » : tout ce qui s'affiche en mots. Aucune notion
 * technique (ni « exception », ni « DNS », ni « override ») : des phrases.
 * Fonctions pures, testées dans phrases.test.ts.
 *
 * Deux sources d'état : la config (ce que les parents ont décidé, calculé
 * tout de suite par le moteur du module) et `status/current` (ce que le PC
 * applique vraiment, jusqu'à ~90 s plus tard, code parent compris).
 */
import {
  CATEGORIES_PAR_MODE,
  JUSQUA_NOUVEL_ORDRE_MS,
  MODES,
  PREFIXE_AUTRE_APPLI,
  VALEUR,
  alerteQuota,
  etatEffectif,
  exceptionActive,
  infosMode,
  jourLocal,
  modeAvecInternet,
  partDuQuota,
  prochainChangement,
  sansFin,
  type Categorie,
  type ConfigAppareil,
  type Demande,
  type EtatAppareil,
  type Mode,
  type RapportNextdns,
  type Reglage,
  type Reseau,
  type UsageJour,
} from "@family-hub/controle-parental";
import { heureDuRepas, type HeuresRepas } from "@family-hub/types";

/** Au-delà, le PC est dit « hors ligne » (il écrit son état toutes les 60 s ; seuil accepté au contrat). */
export const SEUIL_HORS_LIGNE_MS = 10 * 60_000;
/** Le PC reflète une décision en 90 s au plus : au-delà, un écart n'est plus « en cours ». */
export const DELAI_APPLICATION_MS = 3 * 60_000;
/** Une sauvegarde plus vieille est signalée. */
export const SAUVEGARDE_MAX_MS = 2 * 24 * 3_600_000;
/** Écart toléré entre l'horloge du PC et celle du serveur. */
export const ECART_HORLOGE_MS = 5 * 60_000;
/** Longueur maximale du nom montré à l'enfant (contrat : `by` ≤ 60). */
export const NOM_PARENT_MAX = 60;

export const LIBELLE_CATEGORIE: Record<Categorie, string> = {
  [VALEUR.categorie.ecole]: "École",
  [VALEUR.categorie.creation]: "Création",
  [VALEUR.categorie.jeu]: "Jeu",
  [VALEUR.categorie.autre]: "Autre",
};

function memeJour(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function lendemain(d: Date): Date {
  const l = new Date(d);
  l.setDate(l.getDate() + 1);
  return l;
}

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « 21h30 », « 7h00 ». */
export function heure(d: Date): string {
  return `${d.getHours()}h${String(d.getMinutes()).padStart(2, "0")}`;
}

/** « 21h30 », « demain 7h00 », « jeudi 21h30 » selon la distance à maintenant. */
export function quandTexte(d: Date, maintenant: Date): string {
  if (memeJour(d, maintenant)) return heure(d);
  if (memeJour(d, lendemain(maintenant))) return `demain ${heure(d)}`;
  return `${d.toLocaleDateString("fr-FR", { weekday: "long" })} ${heure(d)}`;
}

/** « jusqu'à 21h30 », « jusqu'à demain 7h00 », ou « jusqu'à nouvel ordre ». */
export function jusquaTexte(d: Date, maintenant: Date): string {
  return sansFin(d) ? "jusqu'à nouvel ordre" : `jusqu'à ${quandTexte(d, maintenant)}`;
}

/** « 2h35 », « 45 min », « 0 min ». */
export function dureeTexte(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

/** Le PC compte en secondes ; l'écran, en minutes pleines. */
export function dureeSecondesTexte(secondes: number): string {
  return dureeTexte(Math.floor(secondes / 60));
}

// ---------------------------------------------------------------- modes

export function libelleMode(mode: Mode): string {
  return infosMode(mode).libelle;
}

const seulementEcole = (mode: Mode) => CATEGORIES_PAR_MODE[mode].every((c) => c === VALEUR.categorie.ecole);

/** Sous-titre d'une tuile : « École seulement », « Tout, internet filtré »… (contrat § 12). */
export function resumeMode(mode: Mode): string {
  const net = modeAvecInternet(mode);
  if (seulementEcole(mode)) return net ? "Applis d'école, tout internet filtré" : "École seulement";
  return net ? "Tout, internet filtré" : "Toutes les applis, sites de l'école";
}

/** Ce que le PC permet en vrai, en une phrase : le mode ET le filtrage réel (internet coupé l'emporte). */
export function cePermet(mode: Mode, reseau: Reseau): string {
  const applis = seulementEcole(mode) ? "Les applis d'école" : "Toutes les applis autorisées";
  const net =
    reseau === VALEUR.reseau.coupe
      ? "pas d'internet"
      : reseau === VALEUR.reseau.ecole
        ? "seulement les sites de l'école"
        : "tout internet, filtré";
  return `${applis}, et ${net}.`;
}

// ---------------------------------------------------------------- noms

/** Le nom que l'enfant voit pour ce parent (« Papa »), réglé par le fondateur. */
export function nomMontre(config: Pick<ConfigAppareil, "nomsParents">, uid: string): string {
  return config.nomsParents[uid]?.trim().slice(0, NOM_PARENT_MAX) || "Un parent";
}

// ---------------------------------------------------------------- carte « Mode en cours »

export interface CarteMode {
  mode: Mode;
  libelle: string;
  description: string;
  /** « Mode habituel », « Selon le planning », « Choisi par Papa jusqu'à 18h00 ». */
  origine: string;
  /** « PC autorisé · se verrouille à 21h30 », « PC verrouillé jusqu'à demain 7h00 ». */
  pc: string;
  verrouille: boolean;
  /** « Internet coupé jusqu'à 19h00 » quand internet est coupé, sinon null. */
  internet: string | null;
  /** « Puis retour en Devoirs à 18h00 », ou null. */
  ensuite: string | null;
}

/** La carte du haut, calculée sur la config (ce qui est décidé, sans attendre le PC). */
export function carteMode(config: ConfigAppareil, maintenant: Date, etat?: EtatAppareil | null): CarteMode {
  const e = etatEffectif(config, maintenant);
  const ex = exceptionActive(config.exception, maintenant) ? config.exception : null;
  const parEx = (texte: string) => (ex ? `${texte} ${jusquaTexte(ex.jusqua, maintenant)}` : texte);

  const origine =
    e.sourceMode === VALEUR.source.exception && ex
      ? `Choisi par ${ex.par} ${jusquaTexte(ex.jusqua, maintenant)}`
      : e.sourceMode === VALEUR.source.planning
        ? "Selon le planning"
        : "Mode habituel";
  const suiteMode = e.sourceMode === VALEUR.source.exception ? prochainChangement(config, "mode", maintenant) : null;

  const verrouille = e.pc === VALEUR.pc.verrouille;
  const suitePc = prochainChangement(config, "pc", maintenant);
  let pc: string;
  if (verrouille) {
    pc =
      e.sourcePc === VALEUR.source.exception
        ? parEx("PC verrouillé")
        : suitePc
          ? `PC verrouillé jusqu'à ${quandTexte(suitePc.quand, maintenant)}`
          : "PC verrouillé";
    // Le PC laisse quelques minutes pour enregistrer avant de fermer la session.
    if (etat?.fermetureA && etat.fermetureA.getTime() > maintenant.getTime()) {
      pc += ` · fermeture à ${heure(etat.fermetureA)}`;
    }
  } else if (e.sourcePc === VALEUR.source.exception) {
    pc = parEx("PC débloqué");
  } else if (suitePc?.valeur === VALEUR.pc.verrouille) {
    pc = `PC autorisé · se verrouille à ${quandTexte(suitePc.quand, maintenant)}`;
  } else {
    pc = "PC autorisé";
  }

  const internet =
    e.internet === VALEUR.internet.coupe
      ? e.sourceInternet === VALEUR.source.exception
        ? parEx("Internet coupé")
        : "Internet coupé"
      : null;

  return {
    mode: e.mode,
    libelle: libelleMode(e.mode),
    description: cePermet(e.mode, e.reseau),
    origine,
    pc,
    verrouille,
    internet,
    ensuite:
      suiteMode && !sansFin(suiteMode.quand)
        ? `Puis retour en ${libelleMode(suiteMode.valeur)} à ${quandTexte(suiteMode.quand, maintenant)}`
        : null,
  };
}

/** Ligne courte de la carte d'Aujourd'hui : « Devoirs · se verrouille à 21h30 ». */
export function resumeCarte(config: ConfigAppareil, maintenant: Date): string {
  const c = carteMode(config, maintenant);
  if (c.verrouille) return c.pc;
  const pc = c.pc.replace(/^PC autorisé( · )?/, "");
  return [c.libelle, c.internet, pc].filter(Boolean).join(" · ");
}

/**
 * Ce que le PC fait autrement que la config : un code parent tapé sur place,
 * ou un changement pas encore pris. Rien quand il est hors ligne (la fraîcheur
 * le dit déjà).
 */
export function ecartAvecLePc(config: ConfigAppareil, etat: EtatAppareil | null, maintenant: Date): string[] {
  if (!etat || !fraicheur(etat, maintenant).enLigne) return [];
  const surLePc = (d: { source: string | null; jusqua: Date | null }, texte: string) => {
    const fin = d.jusqua ? ` ${jusquaTexte(d.jusqua, maintenant)}` : "";
    if (d.source === VALEUR.source.codeParent) return `${texte} avec le code parent, sur le PC${fin}`;
    if (d.source === VALEUR.source.local) return `${texte} sur le PC${fin}`;
    return null;
  };
  const locaux = [
    surLePc(etat.pc, etat.pc.valeur === VALEUR.pc.autorise ? "PC débloqué" : "PC verrouillé"),
    surLePc(etat.mode, `Mode ${libelleMode(etat.mode.valeur)}`),
    surLePc(etat.internet, "Internet changé"),
  ].filter((x): x is string => x !== null);
  if (locaux.length) return locaux;

  const e = etatEffectif(config, maintenant);
  const pareil = etat.pc.valeur === e.pc && etat.internet.valeur === e.internet && etat.mode.valeur === e.mode;
  if (pareil) return [];
  const recent = !!config.modifieLe && maintenant.getTime() - config.modifieLe.getTime() < DELAI_APPLICATION_MS;
  return [recent ? "En cours d'application sur le PC…" : "Le PC n'a pas encore pris le dernier changement."];
}

/** Ce que le PC signale de travers : réglage illisible, sauvegarde, horloge. */
export function alertesPc(etat: EtatAppareil | null, maintenant: Date): string[] {
  if (!etat) return [];
  const out: string[] = [];
  for (const err of etat.erreursConfig) out.push(`Le PC ne comprend pas un réglage : ${err}`);
  const s = etat.sauvegarde;
  if (s) {
    if (s.resultat === VALEUR.resultatSauvegarde.echec) out.push("La dernière sauvegarde du PC a échoué.");
    else if (s.resultat === VALEUR.resultatSauvegarde.nonConnecte) {
      out.push("La dernière sauvegarde du PC n'a pas pu se faire : sa destination n'était pas branchée.");
    }
    if (s.date && maintenant.getTime() - s.date.getTime() > SAUVEGARDE_MAX_MS) {
      out.push(`Pas de sauvegarde depuis le ${s.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.`);
    }
  }
  if (etat.heurePc && etat.vuLe && Math.abs(etat.heurePc.getTime() - etat.vuLe.getTime()) > ECART_HORLOGE_MS) {
    out.push("L'heure du PC est fausse : il risque de se verrouiller à la mauvaise heure.");
  }
  return out;
}

// ---------------------------------------------------------------- fraîcheur

export interface Fraicheur {
  enLigne: boolean;
  texte: string;
}

/** « En ligne · il y a 1 min », « Hors ligne depuis 21h10 », « Le PC ne s'est encore jamais connecté ». */
export function fraicheur(etat: EtatAppareil | null, maintenant: Date): Fraicheur {
  if (!etat?.vuLe) return { enLigne: false, texte: "Le PC ne s'est encore jamais connecté" };
  const ecart = maintenant.getTime() - etat.vuLe.getTime();
  if (ecart < SEUIL_HORS_LIGNE_MS) {
    const min = Math.max(0, Math.floor(ecart / 60_000));
    return { enLigne: true, texte: min < 1 ? "En ligne · à l'instant" : `En ligne · il y a ${min} min` };
  }
  const d = etat.vuLe;
  const quand = memeJour(d, maintenant)
    ? heure(d)
    : memeJour(lendemain(d), maintenant)
      ? `hier ${heure(d)}`
      : `le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
  return { enLigne: false, texte: `Hors ligne depuis ${quand}` };
}

// ---------------------------------------------------------------- décisions

/** Ce qu'une nouvelle décision remplacerait (« Temps libre jusqu'à 18h00, choisi par Papa »), ou null. */
export function exceptionEnCours(config: ConfigAppareil, maintenant: Date): string | null {
  const ex = exceptionActive(config.exception, maintenant) ? config.exception : null;
  if (!ex) return null;
  const parts: string[] = [];
  if (ex.mode) parts.push(libelleMode(ex.mode));
  if (ex.pc === VALEUR.pc.autorise) parts.push("PC débloqué");
  if (ex.pc === VALEUR.pc.verrouille) parts.push("PC verrouillé");
  if (ex.internet === VALEUR.internet.coupe) parts.push("internet coupé");
  if (ex.internet === VALEUR.internet.ecole) parts.push("sites de l'école seulement");
  if (ex.internet === VALEUR.internet.complet) parts.push("internet ouvert");
  if (!parts.length) return null;
  return majuscule(`${parts.join(" et ")} ${jusquaTexte(ex.jusqua, maintenant)}, choisi par ${ex.par}`);
}

/**
 * Pied de la feuille « Jusqu'à quand ? » : ce qui revient ensuite, et le
 * verrouillage du soir qui reste en place quand la décision ne touche pas au PC.
 */
export function noteApres(config: ConfigAppareil, decision: Reglage, maintenant: Date): string {
  const sans = { ...config, exception: null };
  const phrases: string[] = [];
  if (decision.mode) {
    phrases.push(`Ensuite, le PC revient tout seul en ${libelleMode(etatEffectif(sans, maintenant).mode)}.`);
  }
  if (decision.pc === VALEUR.pc.verrouille) phrases.push("Ensuite, le PC se déverrouille tout seul, sauf la nuit.");
  if (decision.pc === VALEUR.pc.autorise) phrases.push("Ensuite, le planning reprend.");
  if (decision.internet) phrases.push("Ensuite, internet revient tout seul.");
  if (!decision.pc) {
    const verrou = prochainChangement(sans, "pc", maintenant);
    if (verrou?.valeur === VALEUR.pc.verrouille) {
      phrases.push(`Le verrouillage de ${quandTexte(verrou.quand, maintenant)} reste en place.`);
    }
  }
  return phrases.join(" ");
}

export interface ChoixEcheance {
  libelle: string;
  jusqua: Date;
  /** L'option principale, en haut et en pleine largeur. */
  principal?: boolean;
}

/** Arrondi à la minute (« dans 30 min » tombe sur une heure lisible). */
function dans(maintenant: Date, minutes: number): Date {
  const d = new Date(maintenant.getTime() + minutes * 60_000);
  d.setSeconds(0, 0);
  return d;
}

function a(base: Date, h: number, m: number): Date {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

export type SorteDecision = "mode" | "verrouiller" | "debloquer" | "couper";

/**
 * Propositions « jusqu'à… » (décision du 27.10) : en tête « Jusqu'à ce que je
 * change », pour toutes les décisions ; puis des durées courtes ; puis des
 * repères (le dîner, aux heures de repas du foyer ; demain matin pour
 * verrouiller ou couper internet). L'heure libre reste à l'écran.
 */
export function choixEcheances(maintenant: Date, sorte: SorteDecision, heures?: HeuresRepas): ChoixEcheance[] {
  const choix: ChoixEcheance[] = [
    { libelle: "Jusqu'à ce que je change", jusqua: new Date(JUSQUA_NOUVEL_ORDRE_MS), principal: true },
    { libelle: "30 min", jusqua: dans(maintenant, 30) },
    { libelle: "1 h", jusqua: dans(maintenant, 60) },
    { libelle: "2 h", jusqua: dans(maintenant, 120) },
  ];
  const diner = heureDuRepas(jourLocal(maintenant), "diner", heures);
  if (diner.getTime() > maintenant.getTime() + 30 * 60_000) {
    choix.push({ libelle: `Jusqu'au dîner (${heure(diner)})`, jusqua: diner });
  }
  if (sorte === "verrouiller" || sorte === "couper") {
    choix.push({ libelle: "Jusqu'à demain matin (7h00)", jusqua: a(lendemain(maintenant), 7, 0) });
  }
  return choix;
}

/** Heure libre « HH:MM » : aujourd'hui si elle n'est pas passée, sinon demain. */
export function echeanceDepuisHeure(hhmm: string, maintenant: Date): Date | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  const d = a(maintenant, Number(m[1]), Number(m[2]));
  return d.getTime() > maintenant.getTime() ? d : a(lendemain(maintenant), Number(m[1]), Number(m[2]));
}

// ---------------------------------------------------------------- demandes

const modeConnu = (v: string): v is Mode => MODES.some((m) => m.mode === v);

/** Durée d'une demande de temps ou de mode, 30 min si le PC n'en donne pas. */
export function dureeDemandee(d: Demande): number {
  return d.dureeMinutes ?? 30;
}

/** Ce que demande l'enfant, en mots. `nomAppli` traduit un id d'appli en nom lisible. */
export function titreDemande(d: Demande, nomAppli: (id: string) => string): string {
  const duree = d.dureeMinutes ? dureeTexte(d.dureeMinutes) : null;
  switch (d.type) {
    case VALEUR.typeDemande.temps:
      return duree ? `Plus de temps : ${duree}` : "Plus de temps";
    case VALEUR.typeDemande.mode: {
      const mode = modeConnu(d.detail) ? libelleMode(d.detail) : "Un autre mode";
      return duree ? `${mode} pendant ${duree}` : mode;
    }
    case VALEUR.typeDemande.site:
      return d.detail ? `Le site ${d.detail}` : "Un site";
    case VALEUR.typeDemande.appli:
      return d.detail ? `L'appli ${nomAppli(d.detail)}` : "Une appli";
    default:
      return "Un message";
  }
}

/** Le bouton « oui » : la durée est dans le bouton (« Oui, 45 min »). */
export function boutonOui(d: Demande): string {
  if (d.type === VALEUR.typeDemande.temps || d.type === VALEUR.typeDemande.mode) {
    return `Oui, ${dureeTexte(dureeDemandee(d))}`;
  }
  return d.type === VALEUR.typeDemande.autre ? "Vu" : "Oui";
}

/** « il y a 5 min », « à 16h12 », « hier à 20h47 ». */
export function ilYA(d: Date | null, maintenant: Date): string {
  if (!d) return "";
  const min = Math.floor((maintenant.getTime() - d.getTime()) / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (memeJour(d, maintenant)) return `à ${heure(d)}`;
  if (memeJour(lendemain(d), maintenant)) return `hier à ${heure(d)}`;
  return `le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
}

// ---------------------------------------------------------------- journée

/** Nom lisible d'une appli : celui du jour, du catalogue du PC, ou « Autre (classe) ». */
export function nomAppli(id: string, usage: UsageJour | null, etat: EtatAppareil | null): string {
  const connu = usage?.nomsApplis[id] ?? etat?.catalogue[id]?.nom;
  if (connu) return connu;
  return id.startsWith(PREFIXE_AUTRE_APPLI) ? `Autre (${id.slice(PREFIXE_AUTRE_APPLI.length)})` : id;
}

/** Temps par appli, du plus long au plus court ; moins d'une minute ne s'affiche pas. */
export function applisDuJour(usage: UsageJour | null, etat: EtatAppareil | null) {
  return Object.entries(usage?.secondesParAppli ?? {})
    .filter(([, s]) => s >= 60)
    .sort((x, y) => y[1] - x[1])
    .map(([id, secondes]) => ({ id, nom: nomAppli(id, usage, etat), secondes }));
}

/** Les événements du jour, une ligne chacun : refus, code parent, programme inconnu, VPN, limites. */
export function evenementsDuJour(usage: UsageJour | null, etat: EtatAppareil | null): string[] {
  if (!usage) return [];
  const dates: Array<{ quand: number; texte: string }> = [];
  const ordre = (d: Date | null) => d?.getTime() ?? 0;
  const aHeure = (d: Date | null) => (d ? ` à ${heure(d)}` : "");
  for (const e of usage.lancementsRefuses) {
    const raison = e.appli ? etat?.applisRefusees[e.appli] : null;
    const nom = e.appli ? nomAppli(e.appli, usage, etat) : "Une appli";
    dates.push({ quand: ordre(e.quand), texte: `${nom} refusé${aHeure(e.quand)}${raison ? ` (${raison})` : ""}` });
  }
  for (const e of usage.codeParent) {
    dates.push({ quand: ordre(e.quand), texte: `Code parent ${e.reussi ? "utilisé" : "erroné"}${aHeure(e.quand)}` });
  }
  for (const e of usage.executablesInconnus) {
    const nom = e.detail?.split(/[\\/]/).pop();
    dates.push({ quand: ordre(e.quand), texte: `Programme inconnu${nom ? ` « ${nom} »` : ""} lancé${aHeure(e.quand)}` });
  }
  for (const e of usage.vpnBloques) dates.push({ quand: ordre(e.quand), texte: `VPN bloqué${aHeure(e.quand)}` });
  const lignes = dates.sort((x, y) => x.quand - y.quand).map((x) => x.texte);
  for (const [c, h] of Object.entries(usage.limitesAtteintes)) {
    lignes.push(`Limite « ${LIBELLE_CATEGORIE[c as Categorie]} » atteinte à ${h}`);
  }
  return lignes;
}

// ---------------------------------------------------------------- internet (NextDNS)

/** « 48 000 » : séparateur des milliers à la française. */
export function nombreTexte(n: number): string {
  return Math.round(n).toLocaleString("fr-FR").replace(/\s/g, " ");
}

/** Le quota du filtre internet en mots, pour les deux parents. */
export function phraseQuota(r: Pick<RapportNextdns, "requetesDuMois" | "limiteDuMois">): { texte: string; alerte: boolean } {
  const part = Math.round(partDuQuota(r) * 100);
  if (alerteQuota(r)) {
    return {
      alerte: true,
      texte:
        `Le filtre internet arrive à ${part} % de sa limite gratuite du mois. Au-delà, il ne bloque plus rien ` +
        `(sites pour adultes compris) jusqu'au 1er du mois : il faut passer le filtre à l'offre payante (environ 2 CHF par mois).`,
    };
  }
  return {
    alerte: false,
    texte: `Filtre internet : ${nombreTexte(r.requetesDuMois)} requêtes ce mois-ci sur ${nombreTexte(r.limiteDuMois)} gratuites (${part} %)`,
  };
}

/** Sous-titre de la ligne repliée « Internet aujourd'hui ». */
export function resumeInternet(r: RapportNextdns | null, maintenant: Date): string {
  if (!r) return "Le filtre n'est pas encore relié";
  const bloques = r.jour === jourLocal(maintenant) ? r.bloques.length : 0;
  const sites = bloques === 0 ? "Aucun site bloqué" : bloques === 1 ? "1 site bloqué" : `${bloques} sites bloqués`;
  return `${sites} · le filtre a utilisé ${Math.round(partDuQuota(r) * 100)} % du mois`;
}
