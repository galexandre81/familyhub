/**
 * Notifications des demandes de l'enfant : la logique, sans Firebase ni
 * réseau (testée seule). Une demande créée par le PC fait sonner chaque
 * téléphone ou navigateur qu'un parent du foyer a abonné ; les jetons que
 * le service de notification déclare morts sont retirés de la liste.
 */
import { CHAMP_ABONNE, CHAMP_CONFIG, CHAMP_DEMANDE, VALEUR } from "./genere/schema";
import { estParentDuFoyer } from "./nextdnsRegles";

type Brut = Record<string, unknown> | null;

export interface Notification {
  titre: string;
  corps: string;
  /** Page ouverte au toucher. */
  url: string;
  /** Une même demande renvoyée remplace sa notification au lieu d'en empiler une deuxième. */
  tag: string;
}

/** Envoi d'un message à des jetons : pour chacun, l'erreur éventuelle (code du service). */
export type Envoyer = (jetons: string[], n: Notification) => Promise<Array<{ jeton: string; erreur?: string }>>;

export interface Dependances {
  lireConfig: (appareilId: string) => Promise<Brut>;
  lireFoyer: (foyerId: string) => Promise<Brut>;
  lireAbonnes: (appareilId: string) => Promise<Array<{ uid: string; donnees: Brut }>>;
  envoyer: Envoyer;
  retirerJetons: (appareilId: string, uid: string, jetons: string[]) => Promise<void>;
}

/** Codes du service de notification qui veulent dire « ce téléphone n'écoute plus ». */
const JETON_MORT = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

const LIBELLE_MODE: Record<string, string> = {
  [VALEUR.mode.devoirs]: "Devoirs",
  [VALEUR.mode.devoirsInternet]: "Devoirs + Internet",
  [VALEUR.mode.libre]: "Temps libre",
  [VALEUR.mode.libreInternet]: "Temps libre + Internet",
};

const MESSAGE_MAX = 200;

const texte = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Même écriture que l'écran : « 30 min », « 1h30 ». */
export function dureeTexte(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

/** Ce que demande l'enfant, en mots (mêmes phrases que la liste des demandes du hub). */
export function phraseDemande(d: Brut): string {
  const minutes = d?.[CHAMP_DEMANDE.dureeMinutes];
  const duree = typeof minutes === "number" && minutes > 0 ? dureeTexte(minutes) : null;
  const detail = texte(d?.[CHAMP_DEMANDE.detail]);
  switch (d?.[CHAMP_DEMANDE.type]) {
    case VALEUR.typeDemande.temps:
      return duree ? `Plus de temps : ${duree}` : "Plus de temps";
    case VALEUR.typeDemande.mode: {
      const mode = LIBELLE_MODE[detail] ?? "Un autre mode";
      return duree ? `${mode} pendant ${duree}` : mode;
    }
    case VALEUR.typeDemande.site:
      return detail ? `Le site ${detail}` : "Un site";
    case VALEUR.typeDemande.appli:
      return detail ? `L'appli ${detail}` : "Une appli";
    default:
      return "Un message";
  }
}

export function notificationDe(demandeId: string, d: Brut, config: Brut): Notification {
  const nom = texte(config?.[CHAMP_CONFIG.nom]) || "PC des enfants";
  let message = texte(d?.[CHAMP_DEMANDE.message]);
  if (message.length > MESSAGE_MAX) message = `${message.slice(0, MESSAGE_MAX - 1)}…`;
  return {
    titre: `${nom} : une demande`,
    corps: message ? `${phraseDemande(d)}\n« ${message} »` : phraseDemande(d),
    url: "/pc",
    tag: `demande-${demandeId}`,
  };
}

/** Jetons des parents ACTUELS du foyer (un parent retiré du foyer n'est plus prévenu). */
export function jetonsAPrevenir(
  abonnes: Array<{ uid: string; donnees: Brut }>,
  foyer: Brut,
): Array<{ uid: string; jeton: string }> {
  const vus = new Set<string>();
  const sortie: Array<{ uid: string; jeton: string }> = [];
  for (const { uid, donnees } of abonnes) {
    if (!estParentDuFoyer(foyer, uid)) continue;
    const jetons = donnees?.[CHAMP_ABONNE.jetons];
    if (!Array.isArray(jetons)) continue;
    for (const jeton of jetons) {
      if (typeof jeton !== "string" || !jeton || vus.has(jeton)) continue;
      vus.add(jeton);
      sortie.push({ uid, jeton });
    }
  }
  return sortie;
}

/**
 * Une demande vient d'être créée : prévient les parents abonnés. Rend ce qui
 * s'est passé (pour le journal) ; ne lève pas pour un téléphone injoignable.
 */
export async function prevenirDeLaDemande(
  appareilId: string,
  demandeId: string,
  demande: Brut,
  deps: Dependances,
): Promise<{ envoyes: number; echecs: number; retires: number; raison?: string }> {
  if (demande?.[CHAMP_DEMANDE.statut] !== VALEUR.statutDemande.enAttente) {
    return { envoyes: 0, echecs: 0, retires: 0, raison: "pas en attente" };
  }
  const config = await deps.lireConfig(appareilId);
  const foyerId = config?.[CHAMP_CONFIG.foyer];
  if (typeof foyerId !== "string" || !foyerId) return { envoyes: 0, echecs: 0, retires: 0, raison: "appareil sans foyer" };
  const cibles = jetonsAPrevenir(await deps.lireAbonnes(appareilId), await deps.lireFoyer(foyerId));
  if (cibles.length === 0) return { envoyes: 0, echecs: 0, retires: 0, raison: "aucun abonné" };

  const resultats = await deps.envoyer(
    cibles.map((c) => c.jeton),
    notificationDe(demandeId, demande, config),
  );
  const morts = new Map<string, string[]>();
  let echecs = 0;
  for (const r of resultats) {
    if (!r.erreur) continue;
    echecs++;
    if (!JETON_MORT.has(r.erreur)) continue;
    const uid = cibles.find((c) => c.jeton === r.jeton)?.uid;
    if (uid) morts.set(uid, [...(morts.get(uid) ?? []), r.jeton]);
  }
  let retires = 0;
  for (const [uid, jetons] of morts) {
    await deps.retirerJetons(appareilId, uid, jetons);
    retires += jetons.length;
  }
  return { envoyes: resultats.length - echecs, echecs, retires };
}
