/**
 * Moteur de règles côté Family Hub : le MÊME calcul que l'agent du PC, pour
 * afficher ce qui devrait s'appliquer et ce qui va changer. Il n'applique
 * rien : seul le PC bloque. Priorité, dimension par dimension :
 * exception active > planning > valeurs par défaut.
 *
 * Le planning ne porte que sur l'accès au PC (le brief ne planifie pas le
 * mode internet). Toutes les heures sont en heure LOCALE du foyer.
 */
import { CLE_JOUR, VALEUR } from "./schema.js";
import type {
  AccesPc,
  ConfigAppareil,
  Creneau,
  Defauts,
  EtatEffectif,
  Exception,
  Jour,
  Planning,
} from "./types.js";

/** [brief] PC autorisé, internet filtré. */
export const DEFAUTS: Defauts = {
  pc: VALEUR.pc.autorise,
  internet: VALEUR.internet.complet,
};

const SOIR_SEMAINE: Creneau = { debut: "21:30", fin: "07:00" };
const SOIR_WEEKEND: Creneau = { debut: "22:30", fin: "07:00" };

/** [brief] 21h30 → 7h dimanche à jeudi, 22h30 → 7h vendredi et samedi. */
export const PLANNING_DEFAUT: Planning = {
  sun: SOIR_SEMAINE,
  mon: SOIR_SEMAINE,
  tue: SOIR_SEMAINE,
  wed: SOIR_SEMAINE,
  thu: SOIR_SEMAINE,
  fri: SOIR_WEEKEND,
  sat: SOIR_WEEKEND,
};

const HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function heureValide(h: string): boolean {
  return HEURE.test(h);
}

/** "HH:MM" → minutes depuis minuit. */
export function enMinutes(h: string): number {
  const m = HEURE.exec(h);
  if (!m) throw new Error(`Heure invalide : ${h}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function jourDe(d: Date): Jour {
  return CLE_JOUR[d.getDay()];
}

/** "AAAA-MM-JJ" en heure locale : l'id du document d'usage du jour. */
export function jourLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function minutesDuJour(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function veille(d: Date): Date {
  const v = new Date(d);
  v.setDate(v.getDate() - 1);
  return v;
}

/** Un créneau passe minuit quand sa fin n'est pas après son début. */
function passeMinuit(c: Creneau): boolean {
  return enMinutes(c.fin) <= enMinutes(c.debut);
}

/** Le planning verrouille-t-il le PC à cet instant ? */
export function verrouilleParPlanning(planning: Planning, quand: Date): boolean {
  const m = minutesDuJour(quand);
  const aujourdhui = planning[jourDe(quand)];
  if (aujourdhui) {
    const debut = enMinutes(aujourdhui.debut);
    const fin = enMinutes(aujourdhui.fin);
    if (passeMinuit(aujourdhui) ? m >= debut : m >= debut && m < fin) return true;
  }
  const hier = planning[jourDe(veille(quand))];
  if (hier && passeMinuit(hier) && m < enMinutes(hier.fin)) return true;
  return false;
}

/** L'exception compte tant que son échéance n'est pas atteinte. */
export function exceptionActive(e: Exception | null, quand: Date): e is Exception {
  return e !== null && e.jusqua.getTime() > quand.getTime();
}

export function etatEffectif(
  config: Pick<ConfigAppareil, "planning" | "defauts" | "exception">,
  quand: Date,
): EtatEffectif {
  const e = exceptionActive(config.exception, quand) ? config.exception : null;

  let pc: AccesPc;
  let raisonPc: EtatEffectif["raisonPc"];
  if (e?.pc) {
    pc = e.pc;
    raisonPc = VALEUR.raison.exception;
  } else if (verrouilleParPlanning(config.planning, quand)) {
    pc = VALEUR.pc.verrouille;
    raisonPc = VALEUR.raison.planning;
  } else {
    pc = config.defauts.pc;
    raisonPc = VALEUR.raison.defaut;
  }

  const internet = e?.internet ?? config.defauts.internet;
  const raisonInternet = e?.internet ? VALEUR.raison.exception : VALEUR.raison.defaut;
  return { pc, raisonPc, internet, raisonInternet };
}

/**
 * Exception posée quand un parent accorde « plus de temps » jusqu'à `demandee`.
 * Accorder du temps n'en retire jamais : un déblocage déjà plus long est
 * gardé. Et cela ne touche pas à internet : un mode école en cours reste
 * (au besoin prolongé jusqu'à la même échéance — le sens le plus prudent).
 */
export function exceptionApresAccordTemps(
  actuelle: Exception | null,
  demandee: Date,
  par: string,
  maintenant: Date,
): Exception {
  const ex = exceptionActive(actuelle, maintenant) ? actuelle : null;
  const jusqua =
    ex?.pc === VALEUR.pc.autorise && ex.jusqua.getTime() > demandee.getTime() ? ex.jusqua : demandee;
  return { pc: VALEUR.pc.autorise, ...(ex?.internet ? { internet: ex.internet } : {}), jusqua, par };
}

/** Instants où l'état peut changer : bornes du planning et fin d'exception. */
function bornes(config: Pick<ConfigAppareil, "planning" | "exception">, depuis: Date, jours: number): Date[] {
  const out: Date[] = [];
  for (let i = -1; i <= jours; i++) {
    const jour = new Date(depuis);
    jour.setDate(jour.getDate() + i);
    const c = config.planning[jourDe(jour)];
    if (!c) continue;
    for (const [h, decalage] of [
      [c.debut, 0],
      [c.fin, passeMinuit(c) ? 1 : 0],
    ] as const) {
      const t = new Date(jour);
      t.setDate(t.getDate() + decalage);
      t.setHours(Math.floor(enMinutes(h) / 60), enMinutes(h) % 60, 0, 0);
      out.push(t);
    }
  }
  if (config.exception) out.push(config.exception.jusqua);
  return out.filter((t) => t.getTime() > depuis.getTime()).sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Prochain changement de l'accès au PC (« verrouillage à 21h30 », « débloqué
 * à 7h00 »), ou null si rien ne change dans les huit jours.
 */
export function prochainChangementPc(
  config: Pick<ConfigAppareil, "planning" | "defauts" | "exception">,
  maintenant: Date,
): { quand: Date; pc: AccesPc } | null {
  const actuel = etatEffectif(config, maintenant).pc;
  for (const t of bornes(config, maintenant, 8)) {
    const pc = etatEffectif(config, t).pc;
    if (pc !== actuel) return { quand: t, pc };
  }
  return null;
}
