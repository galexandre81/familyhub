/**
 * Lectures et écritures Firestore du contrôle parental (SDK modulaire, celui
 * du hub ; utilisable aussi depuis Node par le simulateur). Côté parents :
 * écouter, poser une exception, revenir à la normale, liste école, planning,
 * applis, limites, décider une demande. Côté appareil (simulateur) : lire la
 * config, écrire status, usage et requests.
 *
 * Chaque écriture de config signe `modifiePar` / `modifieLe` : les règles
 * Firestore vérifient que l'auteur est bien le parent connecté.
 */
import {
  addDoc,
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
import {
  appliVers,
  configDepuis,
  decisionVers,
  demandeDepuis,
  etatDepuis,
  etatVers,
  exceptionVers,
  limitesVers,
  nouvelleConfigVers,
  nouvelleDemandeVers,
  planningVers,
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
  Limite,
  Planning,
  TypeDemande,
  UsageJour,
} from "./types.js";

const signature = (par: string) => ({
  [CHAMP_CONFIG.modifiePar]: par,
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

// ---------------------------------------------------------------- parents

export async function creerAppareil(
  db: Firestore,
  c: { appareilId: string; foyer: string; compteAppareil: string | null; nom: string | null; par: string },
): Promise<void> {
  await setDoc(doc(db, chemin.config(c.appareilId)), {
    ...nouvelleConfigVers({ ...c, quand: new Date() }),
    ...signature(c.par),
  });
}

/** Relie le compte Firebase de l'appareil (son uid) à sa config. */
export async function associerCompteAppareil(db: Firestore, appareilId: string, uid: string, par: string) {
  await updateDoc(doc(db, chemin.config(appareilId)), { [CHAMP_CONFIG.compteAppareil]: uid, ...signature(par) });
}

/** Toute exception a une échéance future ; l'appelant la choisit. */
export async function poserException(db: Firestore, appareilId: string, e: Exception) {
  if (e.jusqua.getTime() <= Date.now()) throw new Error("L'échéance doit être dans le futur.");
  await updateDoc(doc(db, chemin.config(appareilId)), {
    [CHAMP_CONFIG.exception]: exceptionVers(e),
    ...signature(e.par),
  });
}

export async function revenirALaNormale(db: Firestore, appareilId: string, par: string) {
  await updateDoc(doc(db, chemin.config(appareilId)), { [CHAMP_CONFIG.exception]: null, ...signature(par) });
}

export async function ajouterSiteEcole(db: Firestore, appareilId: string, domaine: string, par: string) {
  await updateDoc(doc(db, chemin.config(appareilId)), {
    [CHAMP_CONFIG.listeEcole]: arrayUnion(domaine),
    ...signature(par),
  });
}

export async function retirerSiteEcole(db: Firestore, appareilId: string, domaine: string, par: string) {
  await updateDoc(doc(db, chemin.config(appareilId)), {
    [CHAMP_CONFIG.listeEcole]: arrayRemove(domaine),
    ...signature(par),
  });
}

export async function enregistrerPlanning(db: Firestore, appareilId: string, p: Planning, par: string) {
  await updateDoc(doc(db, chemin.config(appareilId)), {
    [CHAMP_CONFIG.planning]: planningVers(p),
    ...signature(par),
  });
}

/** L'id d'une appli peut contenir un point (org.kde.krita) : chemin de champ explicite. */
export async function enregistrerAppli(db: Firestore, appareilId: string, id: string, a: Appli, par: string) {
  await updateDoc(
    doc(db, chemin.config(appareilId)),
    new FieldPath(CHAMP_CONFIG.applis, id),
    appliVers(a),
    CHAMP_CONFIG.modifiePar,
    par,
    CHAMP_CONFIG.modifieLe,
    serverTimestamp(),
  );
}

export async function enregistrerLimites(
  db: Firestore,
  appareilId: string,
  l: Partial<Record<Categorie, Limite>>,
  par: string,
) {
  await updateDoc(doc(db, chemin.config(appareilId)), {
    [CHAMP_CONFIG.limites]: limitesVers(l),
    ...signature(par),
  });
}

export async function refuserDemande(db: Firestore, appareilId: string, demandeId: string, par: string) {
  await updateDoc(
    doc(db, chemin.demande(appareilId, demandeId)),
    decisionVers({ statut: VALEUR.statutDemande.refusee, par, quand: new Date(), accordeJusqua: null }),
  );
}

/**
 * Accepter, en un seul envoi : la décision ET son effet.
 * - temps : PC autorisé jusqu'à l'échéance choisie (exception) ;
 * - site  : domaine ajouté à la liste école (le déblocage NextDNS viendra en phase 5) ;
 * - appli : appli autorisée.
 */
export async function accepterDemande(
  db: Firestore,
  config: ConfigAppareil,
  demande: Demande,
  accordeJusqua: Date | null,
  par: string,
) {
  if (
    demande.type === VALEUR.typeDemande.temps &&
    (!accordeJusqua || accordeJusqua.getTime() <= Date.now())
  ) {
    throw new Error("Plus de temps : choisir jusqu'à quand.");
  }
  const b = writeBatch(db);
  const refConfig = doc(db, chemin.config(config.id));
  b.update(
    doc(db, chemin.demande(config.id, demande.id)),
    decisionVers({ statut: VALEUR.statutDemande.acceptee, par, quand: new Date(), accordeJusqua }),
  );
  if (demande.type === VALEUR.typeDemande.temps && accordeJusqua) {
    b.update(refConfig, {
      [CHAMP_CONFIG.exception]: exceptionVers({ pc: VALEUR.pc.autorise, jusqua: accordeJusqua, par }),
      ...signature(par),
    });
  } else if (demande.type === VALEUR.typeDemande.site && demande.cible) {
    b.update(refConfig, {
      [CHAMP_CONFIG.listeEcole]: arrayUnion(demande.cible),
      ...signature(par),
    });
  } else if (demande.type === VALEUR.typeDemande.appli && demande.cible) {
    const actuelle = config.applis[demande.cible];
    b.update(
      refConfig,
      new FieldPath(CHAMP_CONFIG.applis, demande.cible),
      appliVers({ ...actuelle, categorie: actuelle?.categorie ?? VALEUR.categorie.autre, autorisee: true }),
      CHAMP_CONFIG.modifiePar,
      par,
      CHAMP_CONFIG.modifieLe,
      serverTimestamp(),
    );
  }
  await b.commit();
}

// ---------------------------------------------------------------- appareil (simulateur)

export async function ecrireEtat(db: Firestore, appareilId: string, e: EtatAppareil) {
  await setDoc(doc(db, chemin.etat(appareilId)), etatVers(e));
}

export async function ecrireUsage(db: Firestore, appareilId: string, u: UsageJour) {
  await setDoc(doc(db, chemin.usage(appareilId, u.jour)), usageVers(u));
}

export async function creerDemande(
  db: Firestore,
  appareilId: string,
  d: { type: TypeDemande; message: string; cible: string | null },
): Promise<string> {
  const ref = await addDoc(
    collection(db, chemin.demandes(appareilId)),
    nouvelleDemandeVers({ ...d, creeeLe: new Date() }),
  );
  return ref.id;
}
