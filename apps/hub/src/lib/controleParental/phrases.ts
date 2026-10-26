/**
 * Écran « PC des enfants » : tout ce qui s'affiche en mots. Aucune notion
 * technique (ni « exception », ni « DNS », ni « override ») : des phrases.
 * Fonctions pures, testées dans phrases.test.ts.
 */
import {
  VALEUR,
  alerteQuota,
  partDuQuota,
  etatEffectif,
  exceptionActive,
  prochainChangementPc,
  sansFin,
  JUSQUA_NOUVEL_ORDRE_MS,
  type ConfigAppareil,
  type Demande,
  type EtatAppareil,
  type RapportNextdns,
} from "@family-hub/controle-parental";

/** Au-delà, le PC est dit « hors ligne ». À aligner sur la cadence réelle de l'agent (contrat). */
export const SEUIL_HORS_LIGNE_MS = 10 * 60_000;

function memeJour(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function lendemain(d: Date): Date {
  const l = new Date(d);
  l.setDate(l.getDate() + 1);
  return l;
}

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

/**
 * « jusqu'à 21h30 », « jusqu'à demain 7h00 », ou, pour un verrouillage sans
 * fin, « jusqu'à ce qu'un parent le déverrouille ».
 */
export function jusquaTexte(d: Date, maintenant: Date): string {
  return sansFin(d) ? "jusqu'à ce qu'un parent le déverrouille" : `jusqu'à ${quandTexte(d, maintenant)}`;
}

/** « 2h35 », « 45 min », « 0 min ». */
export function dureeTexte(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

/** L'état en une phrase : « PC autorisé, internet complet, verrouillage à 21h30 ». */
export function phraseEtat(config: ConfigAppareil, maintenant: Date): string {
  const e = etatEffectif(config, maintenant);
  const ex = exceptionActive(config.exception, maintenant) ? config.exception : null;
  const suite = prochainChangementPc(config, maintenant);
  const parties: string[] = [];

  if (e.pc === VALEUR.pc.verrouille) {
    if (e.raisonPc === VALEUR.raison.planning) {
      parties.push(suite ? `PC verrouillé pour la nuit, jusqu'à ${quandTexte(suite.quand, maintenant)}` : "PC verrouillé");
    } else {
      parties.push(ex ? `PC verrouillé ${jusquaTexte(ex.jusqua, maintenant)}` : "PC verrouillé");
    }
  } else if (ex?.pc === VALEUR.pc.autorise) {
    parties.push(`PC débloqué ${jusquaTexte(ex.jusqua, maintenant)}`);
  } else {
    parties.push("PC autorisé");
  }

  if (e.internet === VALEUR.internet.ecole) {
    parties.push(ex ? `mode école ${jusquaTexte(ex.jusqua, maintenant)}` : "mode école");
  } else {
    parties.push("internet complet");
  }

  // Le prochain verrouillage, s'il n'est pas déjà dit par « jusqu'à ».
  if (e.pc === VALEUR.pc.autorise && !ex?.pc && suite?.pc === VALEUR.pc.verrouille) {
    parties.push(`verrouillage à ${quandTexte(suite.quand, maintenant)}`);
  }

  const phrase = parties.join(", ");
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

export interface Fraicheur {
  enLigne: boolean;
  texte: string;
}

/** « En ligne · vu à l'instant », « Hors ligne depuis 21h10 », « Le PC ne s'est encore jamais connecté ». */
export function fraicheur(etat: EtatAppareil | null, maintenant: Date): Fraicheur {
  if (!etat?.vuLe) return { enLigne: false, texte: "Le PC ne s'est encore jamais connecté" };
  const ecart = maintenant.getTime() - etat.vuLe.getTime();
  if (ecart < SEUIL_HORS_LIGNE_MS) {
    const min = Math.max(0, Math.floor(ecart / 60_000));
    return { enLigne: true, texte: min < 1 ? "En ligne · vu à l'instant" : `En ligne · vu il y a ${min} min` };
  }
  const d = etat.vuLe;
  const quand = memeJour(d, maintenant)
    ? heure(d)
    : memeJour(lendemain(d), maintenant)
      ? `hier ${heure(d)}`
      : `le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
  return { enLigne: false, texte: `Hors ligne depuis ${quand}` };
}

/** Ce que demande l'enfant, en mots. `nomAppli` traduit un id d'appli en nom lisible. */
export function titreDemande(d: Demande, nomAppli: (id: string) => string): string {
  if (d.type === VALEUR.typeDemande.temps) return "Plus de temps";
  if (d.type === VALEUR.typeDemande.site) return d.cible ? `Le site ${d.cible}` : "Un site";
  return d.cible ? `L'appli ${nomAppli(d.cible)}` : "Une appli";
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

export interface ChoixEcheance {
  libelle: string;
  jusqua: Date;
}

/** Arrondi à la minute pleine suivante (« dans 30 min » tombe sur une heure lisible). */
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

/**
 * Propositions « jusqu'à… » : courtes durées, puis des repères de la journée.
 * Toutes sont dans le futur ; une heure libre reste possible à l'écran.
 */
export function choixEcheances(maintenant: Date, sorte: "debloquer" | "verrouiller" | "ecole"): ChoixEcheance[] {
  const choix: ChoixEcheance[] = [
    { libelle: "30 min", jusqua: dans(maintenant, 30) },
    { libelle: "1 h", jusqua: dans(maintenant, 60) },
    { libelle: "2 h", jusqua: dans(maintenant, 120) },
  ];
  const repere = (libelle: string, d: Date) => {
    if (d.getTime() > maintenant.getTime() + 2 * 3_600_000) choix.push({ libelle, jusqua: d });
  };
  if (sorte === "debloquer") {
    repere(`Ce soir ${heure(a(maintenant, 22, 0))}`, a(maintenant, 22, 0));
    repere(`Ce soir ${heure(a(maintenant, 23, 0))}`, a(maintenant, 23, 0));
  } else if (sorte === "verrouiller") {
    repere(`Jusqu'à ${heure(a(maintenant, 18, 0))}`, a(maintenant, 18, 0));
    choix.push({ libelle: `Demain ${heure(a(maintenant, 7, 0))}`, jusqua: a(lendemain(maintenant), 7, 0) });
    // En tête : verrouillé tant qu'un parent ne le déverrouille pas.
    choix.unshift({ libelle: "Jusqu'à ce que je le déverrouille", jusqua: new Date(JUSQUA_NOUVEL_ORDRE_MS) });
  } else {
    repere(`Jusqu'à ${heure(a(maintenant, 17, 0))}`, a(maintenant, 17, 0));
    repere(`Jusqu'à ${heure(a(maintenant, 19, 0))}`, a(maintenant, 19, 0));
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

/** Ce que remplacerait une nouvelle échéance (« débloqué jusqu'à 23h00 »), ou null. */
export function exceptionEnCours(config: ConfigAppareil, maintenant: Date): string | null {
  const ex = exceptionActive(config.exception, maintenant) ? config.exception : null;
  if (!ex) return null;
  const parts: string[] = [];
  if (ex.pc === VALEUR.pc.autorise) parts.push("débloqué");
  if (ex.pc === VALEUR.pc.verrouille) parts.push("verrouillé");
  if (ex.internet === VALEUR.internet.ecole) parts.push("mode école");
  if (ex.internet === VALEUR.internet.complet) parts.push("internet complet");
  return `${parts.join(" et ")} ${jusquaTexte(ex.jusqua, maintenant)}`;
}
