/**
 * Moteur de règles côté Family Hub : le MÊME calcul que l'agent du PC
 * (contrat § 3 et § 12), pour afficher ce qui s'applique et ce qui va changer
 * sans attendre que le PC rende compte (jusqu'à ~90 s). Il n'applique rien :
 * seul le PC bloque. Pour chaque dimension (pc, internet, mode) séparément :
 * exception active > plage du planning > valeurs par défaut.
 *
 * Ce que le hub ne voit pas : les exceptions posées SUR le PC (code parent).
 * `status/current` les rapporte (source « code » ou « local »).
 * Toutes les heures sont en heure locale (Europe/Paris = Zurich).
 */
import { CLE_JOUR, JUSQUA_NOUVEL_ORDRE_MS, SEUIL_ALERTE_QUOTA, VALEUR } from "./schema.js";
import type {
  Categorie,
  ConfigAppareil,
  Defauts,
  Dimension,
  EtatEffectif,
  Exception,
  Jour,
  Mode,
  ModeInternet,
  Plage,
  Planning,
  RapportNextdns,
  Reseau,
  Source,
} from "./types.js";

/** [contrat] PC autorisé, internet filtré, mode Devoirs. */
export const DEFAUTS: Defauts = {
  pc: VALEUR.pc.autorise,
  internet: VALEUR.internet.complet,
  mode: VALEUR.mode.devoirs,
};

const soir = (debut: string): Plage[] => [{ debut, fin: "07:00", pc: VALEUR.pc.verrouille }];

/** [contrat § 2.2] 21h30 → 7h dimanche à jeudi, 22h30 → 7h vendredi et samedi. */
export const PLANNING_DEFAUT: Planning = {
  sun: soir("21:30"),
  mon: soir("21:30"),
  tue: soir("21:30"),
  wed: soir("21:30"),
  thu: soir("21:30"),
  fri: soir("22:30"),
  sat: soir("22:30"),
};

/** [contrat, réponse 1 du 27.10] Nom affiché et emoji de chaque mode, dans l'ordre du plus fermé au plus ouvert. */
export const MODES: ReadonlyArray<{ mode: Mode; libelle: string; emoji: string }> = [
  { mode: VALEUR.mode.devoirs, libelle: "Devoirs", emoji: "📘" },
  { mode: VALEUR.mode.devoirsInternet, libelle: "Devoirs + Internet", emoji: "🔎" },
  { mode: VALEUR.mode.libre, libelle: "Temps libre", emoji: "🎨" },
  { mode: VALEUR.mode.libreInternet, libelle: "Temps libre + Internet", emoji: "🌍" },
];

export function infosMode(mode: Mode): { libelle: string; emoji: string } {
  return MODES.find((m) => m.mode === mode) ?? MODES[0];
}

/** [contrat § 12] Catégories d'applis permises par mode. */
export const CATEGORIES_PAR_MODE: Record<Mode, readonly Categorie[]> = {
  [VALEUR.mode.devoirs]: [VALEUR.categorie.ecole],
  [VALEUR.mode.devoirsInternet]: [VALEUR.categorie.ecole],
  [VALEUR.mode.libre]: [VALEUR.categorie.ecole, VALEUR.categorie.creation, VALEUR.categorie.jeu, VALEUR.categorie.autre],
  [VALEUR.mode.libreInternet]: [VALEUR.categorie.ecole, VALEUR.categorie.creation, VALEUR.categorie.jeu, VALEUR.categorie.autre],
};

/** [contrat § 12] Un mode « + Internet » ouvre tout internet filtré ; les autres, la liste école. */
export function modeAvecInternet(mode: Mode): boolean {
  return mode === VALEUR.mode.devoirsInternet || mode === VALEUR.mode.libreInternet;
}

/** [réponse 1 du 27.10] Filtrage réel : coupé > liste école > c'est le mode qui décide. */
export function reseauDe(internet: ModeInternet, mode: Mode): Reseau {
  if (internet === VALEUR.internet.coupe) return VALEUR.reseau.coupe;
  if (internet === VALEUR.internet.ecole) return VALEUR.reseau.ecole;
  return modeAvecInternet(mode) ? VALEUR.reseau.complet : VALEUR.reseau.ecole;
}

/** Restriction de chaque valeur : en cas de chevauchement, la plus restrictive gagne (égalité : la première). */
const RESTRICTION: Record<Dimension, Record<string, number>> = {
  pc: { [VALEUR.pc.verrouille]: 1, [VALEUR.pc.autorise]: 0 },
  internet: { [VALEUR.internet.coupe]: 2, [VALEUR.internet.ecole]: 1, [VALEUR.internet.complet]: 0 },
  mode: {
    [VALEUR.mode.devoirs]: 2,
    [VALEUR.mode.devoirsInternet]: 1,
    [VALEUR.mode.libre]: 1,
    [VALEUR.mode.libreInternet]: 0,
  },
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

function veille(d: Date): Date {
  const v = new Date(d);
  v.setDate(v.getDate() - 1);
  return v;
}

/** Une plage passe minuit quand sa fin n'est pas après son début. */
export function passeMinuit(p: Pick<Plage, "debut" | "fin">): boolean {
  return enMinutes(p.fin) <= enMinutes(p.debut);
}

/** Plages qui couvrent cet instant : celles du jour, puis celles de la veille qui passent minuit. */
export function plagesActives(planning: Planning, quand: Date): Plage[] {
  const m = quand.getHours() * 60 + quand.getMinutes();
  const duJour = planning[jourDe(quand)].filter((p) => {
    const debut = enMinutes(p.debut);
    return passeMinuit(p) ? m >= debut : m >= debut && m < enMinutes(p.fin);
  });
  const deLaVeille = planning[jourDe(veille(quand))].filter((p) => passeMinuit(p) && m < enMinutes(p.fin));
  return [...duJour, ...deLaVeille];
}

/** Valeur que le planning impose à une dimension, ou undefined. */
export function valeurPlanning<D extends Dimension>(planning: Planning, dim: D, quand: Date): Plage[D] {
  let retenue: Plage[D] = undefined;
  for (const p of plagesActives(planning, quand)) {
    const v = p[dim];
    if (v === undefined) continue;
    if (retenue === undefined || RESTRICTION[dim][v] > RESTRICTION[dim][retenue as string]) retenue = v;
  }
  return retenue;
}

/** L'exception compte tant que son échéance n'est pas atteinte. */
export function exceptionActive(e: Exception | null, quand: Date): e is Exception {
  return e !== null && e.jusqua.getTime() > quand.getTime();
}

/** Échéance « jusqu'à ce qu'un parent le déverrouille ». */
export function sansFin(jusqua: Date): boolean {
  return jusqua.getTime() >= JUSQUA_NOUVEL_ORDRE_MS;
}

type Config = Pick<ConfigAppareil, "planning" | "defauts" | "exception">;

function resoudre<D extends Dimension>(config: Config, dim: D, quand: Date): { valeur: Defauts[D]; source: Source } {
  const ex = exceptionActive(config.exception, quand) ? config.exception : null;
  const parException = ex?.[dim];
  if (parException !== undefined) return { valeur: parException as Defauts[D], source: VALEUR.source.exception };
  const parPlanning = valeurPlanning(config.planning, dim, quand);
  if (parPlanning !== undefined) return { valeur: parPlanning as Defauts[D], source: VALEUR.source.planning };
  return { valeur: config.defauts[dim], source: VALEUR.source.defaut };
}

export function etatEffectif(config: Config, quand: Date): EtatEffectif {
  const pc = resoudre(config, "pc", quand);
  const internet = resoudre(config, "internet", quand);
  const mode = resoudre(config, "mode", quand);
  return {
    pc: pc.valeur,
    sourcePc: pc.source,
    internet: internet.valeur,
    sourceInternet: internet.source,
    mode: mode.valeur,
    sourceMode: mode.source,
    reseau: reseauDe(internet.valeur, mode.valeur),
  };
}

/** Instants où l'état peut changer : bornes des plages et fin d'exception. */
function bornes(config: Pick<ConfigAppareil, "planning" | "exception">, depuis: Date, jours: number): Date[] {
  const out: Date[] = [];
  for (let i = -1; i <= jours; i++) {
    const jour = new Date(depuis);
    jour.setDate(jour.getDate() + i);
    for (const p of config.planning[jourDe(jour)]) {
      for (const [h, decalage] of [
        [p.debut, 0],
        [p.fin, passeMinuit(p) ? 1 : 0],
      ] as const) {
        const t = new Date(jour);
        t.setDate(t.getDate() + decalage);
        t.setHours(Math.floor(enMinutes(h) / 60), enMinutes(h) % 60, 0, 0);
        out.push(t);
      }
    }
  }
  if (config.exception) out.push(config.exception.jusqua);
  return out.filter((t) => t.getTime() > depuis.getTime()).sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Prochain changement d'une dimension (« verrouillage à 21h30 », « retour en
 * Devoirs à 18h00 »), ou null si rien ne change dans les huit jours.
 */
export function prochainChangement<D extends Dimension>(
  config: Config,
  dim: D,
  maintenant: Date,
): { quand: Date; valeur: Defauts[D] } | null {
  const actuel = resoudre(config, dim, maintenant).valeur;
  for (const t of bornes(config, maintenant, 8)) {
    const valeur = resoudre(config, dim, t).valeur;
    if (valeur !== actuel) return { quand: t, valeur };
  }
  return null;
}

/** Compatibilité : le prochain changement de l'accès au PC. */
export function prochainChangementPc(config: Config, maintenant: Date) {
  const c = prochainChangement(config, "pc", maintenant);
  return c ? { quand: c.quand, pc: c.valeur } : null;
}

/**
 * Exception posée quand un parent accorde « plus de temps » jusqu'à `demandee`.
 * Accorder du temps n'en retire jamais : un déblocage déjà plus long est gardé.
 * Le mode et internet d'une exception en cours restent (même échéance) — un
 * temps libre accordé n'est pas perdu parce qu'on accorde du temps.
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
  return {
    pc: VALEUR.pc.autorise,
    ...(ex?.internet ? { internet: ex.internet } : {}),
    ...(ex?.mode ? { mode: ex.mode } : {}),
    jusqua,
    par,
    poseLe: null,
  };
}

/** Part du quota NextDNS du mois déjà consommée (0 à 1 et plus). */
export function partDuQuota(r: Pick<RapportNextdns, "requetesDuMois" | "limiteDuMois">): number {
  return r.limiteDuMois > 0 ? r.requetesDuMois / r.limiteDuMois : 0;
}

/** Les parents sont prévenus à partir de SEUIL_ALERTE_QUOTA (au-delà de la limite, le filtrage s'arrête). */
export function alerteQuota(r: Pick<RapportNextdns, "requetesDuMois" | "limiteDuMois"> | null): boolean {
  return !!r && partDuQuota(r) >= SEUIL_ALERTE_QUOTA;
}
