/**
 * Lectures et écritures Firestore du contrôle parental (SDK modulaire, celui
 * du hub ; utilisable aussi depuis Node par le simulateur). Côté parents :
 * écouter, poser une exception, revenir à la normale, liste école, planning,
 * applis, limites, décider une demande. Côté appareil (simulateur) : écrire
 * status, usage et requests comme l'agent du PC.
 *
 * Chaque écriture de config est signée (uid du parent et heure ; les
 * règles le vérifient) ; une exception porte en plus le nom montré à
 * l'enfant et l'heure du serveur à laquelle elle est posée (qui départage côté PC).
 */
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  FieldPath,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { CHAMP_CONFIG, CHAMP_DEMANDE, COLLECTION_APPAREILS, VALEUR, chemin } from "./schema.js";
import { exceptionApresAccordTemps } from "./regles.js";
import {
  appliVers,
  configDepuis,
  decisionVers,
  demandeDepuis,
  etatDepuis,
  exceptionVers,
  limitesVers,
  nouvelleConfigVers,
  nouvelleDemandeVers,
  planningVers,
  rapportNextdnsDepuis,
  usageDepuis,
  usageVers,
} from "./conversion.js";
import type {
  Appli,
  Categorie,
  ConfigAppareil,
  Demande,
  EtatAppareil,
  Exception,
  ExecutablesInconnus,
  Mode,
  Planning,
  RapportNextdns,
  TypeDemande,
  UsageJour,
} from "./types.js";

const signature = (uid: string) => ({
  [CHAMP_CONFIG.modifiePar]: uid,
  [CHAMP_CONFIG.modifieLe]: serverTimestamp(),
});

// ---------------------------------------------------------------- lecture

/** Appareils du foyer (en pratique un seul : le PC des enfants). */
export function ecouterAppareilsDuFoyer(
  db: Firestore,
  foyer: string,
  rappel: (appareils: ConfigAppareil[]) => void,
  erreur?: (e: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTION_APPAREILS), where(CHAMP_CONFIG.foyer, "==", foyer));
  return onSnapshot(q, (s) => rappel(s.docs.map((d) => configDepuis(d.id, d.data()))), erreur);
}

export function ecouterConfig(
  db: Firestore,
  appareilId: string,
  rappel: (c: ConfigAppareil | null) => void,
  erreur?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, chemin.config(appareilId)),
    (s) => rappel(s.exists() ? configDepuis(s.id, s.data()) : null),
    erreur,
  );
}

export async function lireConfig(db: Firestore, appareilId: string): Promise<ConfigAppareil | null> {
  const s = await getDoc(doc(db, chemin.config(appareilId)));
  return s.exists() ? configDepuis(s.id, s.data()) : null;
}

export function ecouterEtat(
  db: Firestore,
  appareilId: string,
  rappel: (e: EtatAppareil | null) => void,
  erreur?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(doc(db, chemin.etat(appareilId)), (s) => rappel(etatDepuis(s.data())), erreur);
}

export function ecouterUsage(
  db: Firestore,
  appareilId: string,
  jour: string,
  rappel: (u: UsageJour | null) => void,
  erreur?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, chemin.usage(appareilId, jour)),
    (s) => rappel(s.exists() ? usageDepuis(jour, s.data()) : null),
    erreur,
  );
}

/** Demandes en attente, plus anciennes d'abord. */
export function ecouterDemandesEnAttente(
  db: Firestore,
  appareilId: string,
  rappel: (d: Demande[]) => void,
  erreur?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, chemin.demandes(appareilId)),
    where(CHAMP_DEMANDE.statut, "==", VALEUR.statutDemande.enAttente),
  );
  return onSnapshot(
    q,
    (s) =>
      rappel(
        s.docs
          .map((d) => demandeDepuis(d.id, d.data()))
          .filter((d): d is Demande => d !== null)
          .sort((a, b) => (a.creeeLe?.getTime() ?? 0) - (b.creeeLe?.getTime() ?? 0)),
      ),
    erreur,
  );
}

/** Rapport NextDNS de l'appareil (sites du jour, quota du mois). Écrit par la fonction serveur seule. */
export function ecouterRapportNextdns(
  db: Firestore,
  appareilId: string,
  rappel: (r: RapportNextdns | null) => void,
  erreur?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(doc(db, chemin.rapportNextdns(appareilId)), (s) => rappel(rapportNextdnsDepuis(s.data())), erreur);
}

// ---------------------------------------------------------------- parents

export async function creerAppareil(
  db: Firestore,
  c: {
    appareilId: string;
    foyer: string;
    compteAppareil: string | null;
    nom: string | null;
    nomsParents: Record<string, string>;
    uid: string;
  },
): Promise<void> {
  await setDoc(doc(db, chemin.config(c.appareilId)), {
    ...nouvelleConfigVers({ ...c, par: c.uid, quand: new Date() }),
    ...signature(c.uid),
  });
}

/** Relie le compte Firebase de l'appareil (son uid) à sa config ; vide = PC coupé de Family Hub. */
export async function associerCompteAppareil(db: Firestore, appareilId: string, compte: string, uid: string) {
  await updateDoc(doc(db, chemin.config(appareilId)), { [CHAMP_CONFIG.compteAppareil]: compte, ...signature(uid) });
}

/**
 * Pose l'exception (elle REMPLACE la précédente : une seule à la fois, contrat
 * § 2.3). `e.par` est le nom montré à l'enfant ; `uid` signe l'écriture.
 */
export async function poserException(db: Firestore, appareilId: string, e: Omit<Exception, "poseLe">, uid: string) {
  if (e.jusqua.getTime() <= Date.now()) throw new Error("L'échéance doit être dans le futur.");
  await updateDoc(doc(db, chemin.config(appareilId)), {
    [CHAMP_CONFIG.exception]: exceptionVers({ ...e, poseLe: null }, serverTimestamp()),
    ...signature(uid),
  });
}

/** Retour au planning, et annulation d'un code parent saisi sur le PC (contrat § 2.4). */
export async function revenirALaNormale(db: Firestore, appareilId: string, uid: string) {
  await updateDoc(doc(db, chemin.config(appareilId)), {
    [CHAMP_CONFIG.exception]: null,
    [CHAMP_CONFIG.reinitialiserLocalAvant]: serverTimestamp(),
    ...signature(uid),
  });
}

export async function ajouterSiteEcole(db: Firestore, appareilId: string, domaine: string, uid: string) {
  await updateDoc(doc(db, chemin.config(appareilId)), {
    [CHAMP_CONFIG.listeEcole]: arrayUnion(domaine),
    ...signature(uid),
  });
}

export async function retirerSiteEcole(db: Firestore, appareilId: string, domaine: string, uid: string) {
  await updateDoc(doc(db, chemin.config(appareilId)), {
    [CHAMP_CONFIG.listeEcole]: arrayRemove(domaine),
    ...signature(uid),
  });
}

export async function enregistrerPlanning(db: Firestore, appareilId: string, p: Planning, uid: string) {
  await updateDoc(doc(db, chemin.config(appareilId)), {
    [CHAMP_CONFIG.planning]: planningVers(p),
    ...signature(uid),
  });
}

/** Un id d'appli pourrait contenir un point : chemin de champ explicite. */
export async function enregistrerAppli(db: Firestore, appareilId: string, id: string, a: Appli, uid: string) {
  await updateDoc(
    doc(db, chemin.config(appareilId)),
    new FieldPath(CHAMP_CONFIG.applis, id),
    appliVers(a),
    CHAMP_CONFIG.modifiePar,
    uid,
    CHAMP_CONFIG.modifieLe,
    serverTimestamp(),
  );
}

export async function enregistrerLimites(
  db: Firestore,
  appareilId: string,
  l: Partial<Record<Categorie, number>>,
  uid: string,
) {
  await updateDoc(doc(db, chemin.config(appareilId)), {
    [CHAMP_CONFIG.limites]: limitesVers(l),
    ...signature(uid),
  });
}

export async function enregistrerNomsParents(db: Firestore, appareilId: string, noms: Record<string, string>, uid: string) {
  await updateDoc(doc(db, chemin.config(appareilId)), { [CHAMP_CONFIG.nomsParents]: noms, ...signature(uid) });
}

export async function enregistrerExecutablesInconnus(
  db: Firestore,
  appareilId: string,
  v: ExecutablesInconnus,
  uid: string,
) {
  await updateDoc(doc(db, chemin.config(appareilId)), { [CHAMP_CONFIG.executablesInconnus]: v, ...signature(uid) });
}

export async function refuserDemande(db: Firestore, appareilId: string, demandeId: string, uid: string, reponse?: string) {
  await updateDoc(
    doc(db, chemin.demande(appareilId, demandeId)),
    decisionVers({ statut: VALEUR.statutDemande.refusee, par: uid, traiteLe: serverTimestamp(), reponse }),
  );
}

const MODES = Object.values(VALEUR.mode) as string[];

/**
 * Accepter, en un seul envoi : la décision ET son effet (contrat § 8.4) —
 * accepter ne fait rien tout seul côté PC.
 * - temps : PC autorisé jusqu'à `jusqua` (jamais moins qu'un déblocage en cours) ;
 * - mode  : le mode demandé jusqu'à `jusqua` (remplace l'exception en cours) ;
 * - site  : ajouté à la liste école (le hub l'autorise aussi dans NextDNS) ;
 * - appli : autorisée ;
 * - autre : marquée traitée, sans action.
 * `par` est le nom montré à l'enfant, `uid` signe l'écriture.
 */
export async function accepterDemande(
  db: Firestore,
  config: ConfigAppareil,
  demande: Demande,
  o: { jusqua: Date | null; par: string; uid: string },
) {
  const maintenant = new Date();
  const avecDuree = demande.type === VALEUR.typeDemande.temps || demande.type === VALEUR.typeDemande.mode;
  if (avecDuree && (!o.jusqua || o.jusqua.getTime() <= maintenant.getTime())) {
    throw new Error("Choisir jusqu'à quand.");
  }
  if (demande.type === VALEUR.typeDemande.mode && !MODES.includes(demande.detail)) {
    throw new Error("Mode demandé inconnu.");
  }
  const b = writeBatch(db);
  const refConfig = doc(db, chemin.config(config.id));
  b.update(
    doc(db, chemin.demande(config.id, demande.id)),
    decisionVers({
      statut: demande.type === VALEUR.typeDemande.autre ? VALEUR.statutDemande.traitee : VALEUR.statutDemande.acceptee,
      par: o.uid,
      traiteLe: serverTimestamp(),
    }),
  );
  if (demande.type === VALEUR.typeDemande.temps && o.jusqua) {
    const e = exceptionApresAccordTemps(config.exception, o.jusqua, o.par, maintenant);
    b.update(refConfig, { [CHAMP_CONFIG.exception]: exceptionVers(e, serverTimestamp()), ...signature(o.uid) });
  } else if (demande.type === VALEUR.typeDemande.mode && o.jusqua) {
    const e: Exception = { mode: demande.detail as Mode, jusqua: o.jusqua, par: o.par, poseLe: null };
    b.update(refConfig, { [CHAMP_CONFIG.exception]: exceptionVers(e, serverTimestamp()), ...signature(o.uid) });
  } else if (demande.type === VALEUR.typeDemande.site && demande.detail) {
    b.update(refConfig, { [CHAMP_CONFIG.listeEcole]: arrayUnion(demande.detail), ...signature(o.uid) });
  } else if (demande.type === VALEUR.typeDemande.appli && demande.detail) {
    const actuelle = config.applis[demande.detail];
    b.update(
      refConfig,
      new FieldPath(CHAMP_CONFIG.applis, demande.detail),
      appliVers({ ...actuelle, autorisee: true }),
      CHAMP_CONFIG.modifiePar,
      o.uid,
      CHAMP_CONFIG.modifieLe,
      serverTimestamp(),
    );
  }
  await b.commit();
}

// ---------------------------------------------------------------- appareil (simulateur)

export async function ecrireEtat(db: Firestore, appareilId: string, brut: Record<string, unknown>) {
  await setDoc(doc(db, chemin.etat(appareilId)), brut);
}

export async function ecrireUsage(db: Firestore, appareilId: string, u: UsageJour) {
  await setDoc(doc(db, chemin.usage(appareilId, u.jour)), usageVers(u));
}

/** Id au format du PC : AAAAMMJJ-HHMMSS-xxxx. */
export function idDemande(quand: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const hasard = Math.random().toString(36).slice(2, 6).padEnd(4, "0");
  return `${quand.getFullYear()}${p(quand.getMonth() + 1)}${p(quand.getDate())}-${p(quand.getHours())}${p(
    quand.getMinutes(),
  )}${p(quand.getSeconds())}-${hasard}`;
}

export async function creerDemande(
  db: Firestore,
  appareilId: string,
  d: { de: string; type: TypeDemande; detail: string; message: string; dureeMinutes: number | null },
): Promise<string> {
  const creeeLe = new Date();
  const id = idDemande(creeeLe);
  await setDoc(doc(db, chemin.demande(appareilId, id)), nouvelleDemandeVers({ ...d, id, creeeLe }));
  return id;
}

