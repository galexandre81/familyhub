/**
 * Règles du contrôle parental (collection racine des appareils), sur
 * l'émulateur. Chaque cas autorisé ET chaque cas interdit du brief : appareil
 * (lecture de sa config, écriture de status/usage/requests seulement),
 * parents (lecture de tout, écriture de la config et du statut des
 * demandes), personne d'autre — ni un membre non parent, ni un écran, ni un
 * parent d'un autre foyer.
 *
 * Les documents sont construits par le module de schéma (fichiers purs,
 * importés par chemin : ce dossier a sa propre installation) : aucun nom de
 * champ n'est écrit ici.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  CHAMP_ABONNE,
  CHAMP_CONFIG,
  CHAMP_DEMANDE,
  CHAMP_PRIVE_NEXTDNS,
  CHAMP_RAPPORT,
  CHAMP_REGLE,
  COLLECTION_APPAREILS,
  SOUS_COLLECTION,
  VALEUR,
  chemin,
} from "../packages/controle-parental/src/schema";
import {
  decisionVers,
  etatVers,
  exceptionVers,
  nouvelleConfigVers,
  nouvelleDemandeVers,
  usageVers,
} from "../packages/controle-parental/src/conversion";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, "..", "firestore.rules");

const FOYER = "foyer-a";
const FOYER_B = "foyer-b";
const FOYER_ANCIEN = "foyer-ancien";
const PARENT = "parent-1";
const PARENT_2 = "parent-2";
const ENFANT = "enfant-1";
const PARENT_B = "parent-b";
const MEMBRE_ANCIEN = "membre-ancien";
const INCONNU = "inconnu-1";
const APPAREIL = "compte-appareil-1";
const APPAREIL_B = "compte-appareil-b";
const PC = "appareil-test";
const PC_B = "appareil-test-b";
const PC_ANCIEN = "appareil-ancien";
const JOUR = "2026-10-26";
const DEMANDE = "demande-1";

const plusTard = () => new Date(Date.now() + 3_600_000);

let env: RulesTestEnvironment;
const db = (uid: string, claims?: Record<string, unknown>) => env.authenticatedContext(uid, claims).firestore();
const ecran = () => db("display:d1", { isDisplay: true, householdId: FOYER, displayId: "d1" });

const config = (foyer: string, compteAppareil: string | null, par: string) =>
  nouvelleConfigVers({ foyer, compteAppareil, nom: "PC des enfants", nomsParents: { [par]: "Papa" }, par, quand: new Date() });
const etat = () =>
  etatVers({
    pc: VALEUR.pc.autorise,
    internet: VALEUR.internet.complet,
    mode: VALEUR.mode.devoirs,
    raisons: {},
    sources: {},
    jusqua: {},
    libelleMode: "Devoirs",
    reseau: VALEUR.reseau.ecole,
    resume: "Mode Devoirs.",
    minutesDuJour: 30,
    sessionOuverte: true,
    applisRefusees: {},
    vuLe: new Date(),
    version: "test",
  });
const usage = (jour = JOUR) =>
  usageVers({
    jour,
    secondesSession: 1800,
    secondesActives: 1500,
    secondesParAppli: { krita: 1800 },
    nomsApplis: {},
    secondesParCategorie: {},
    lancementsRefuses: [],
    codeParent: [],
    executablesInconnus: [],
    vpnBloques: [],
    limitesAtteintes: {},
    majLe: new Date(),
  });
const demande = () =>
  nouvelleDemandeVers({
    id: DEMANDE,
    de: "enfant",
    type: VALEUR.typeDemande.temps,
    detail: "30",
    message: "encore un peu",
    dureeMinutes: 30,
    creeeLe: new Date(),
  });
const decision = (par: string, statut: string = VALEUR.statutDemande.acceptee) =>
  decisionVers({ statut: statut as never, par, traiteLe: new Date() });
const exception = (e: Record<string, unknown>) =>
  exceptionVers({ par: "Papa", poseLe: null, jusqua: plusTard(), ...e } as never, new Date());
const signe = (par: string) => ({ [CHAMP_CONFIG.modifiePar]: par, [CHAMP_CONFIG.modifieLe]: new Date() });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-fh",
    firestore: { rules: readFileSync(RULES_PATH, "utf8"), host: "127.0.0.1", port: 8080 },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    const foyer = (membres: string[], roles?: Record<string, string>) => ({
      nom: "Foyer", ownerUid: membres[0], membres, ...(roles ? { roles } : {}), createdAt: 1, updatedAt: 1,
    });
    await setDoc(doc(d, "households", FOYER), foyer([PARENT, PARENT_2, ENFANT], { [PARENT]: "parent", [PARENT_2]: "parent", [ENFANT]: "enfant" }));
    await setDoc(doc(d, "households", FOYER_B), foyer([PARENT_B], { [PARENT_B]: "parent" }));
    await setDoc(doc(d, "households", FOYER_ANCIEN), foyer([MEMBRE_ANCIEN]));
    await setDoc(doc(d, chemin.config(PC)), config(FOYER, APPAREIL, PARENT));
    await setDoc(doc(d, chemin.config(PC_B)), config(FOYER_B, APPAREIL_B, PARENT_B));
    await setDoc(doc(d, chemin.config(PC_ANCIEN)), config(FOYER_ANCIEN, null, MEMBRE_ANCIEN));
    await setDoc(doc(d, chemin.etat(PC)), etat());
    await setDoc(doc(d, chemin.usage(PC, JOUR)), usage());
    await setDoc(doc(d, chemin.demande(PC, DEMANDE)), demande());
  });
});

describe("parents : autorisé", () => {
  it("lire la config", async () => {
    await assertSucceeds(getDoc(doc(db(PARENT), chemin.config(PC))));
    await assertSucceeds(getDoc(doc(db(PARENT_2), chemin.config(PC))));
  });

  it("retrouver les appareils de son foyer (requête filtrée)", async () => {
    await assertSucceeds(
      getDocs(query(collection(db(PARENT_2), COLLECTION_APPAREILS), where(CHAMP_CONFIG.foyer, "==", FOYER))),
    );
  });

  it("lire l'état, l'usage et les demandes", async () => {
    const p = db(PARENT_2);
    await assertSucceeds(getDoc(doc(p, chemin.etat(PC))));
    await assertSucceeds(getDoc(doc(p, chemin.usage(PC, JOUR))));
    await assertSucceeds(getDocs(collection(p, chemin.demandes(PC))));
  });

  it("créer l'appareil de son foyer", async () => {
    await assertSucceeds(setDoc(doc(db(PARENT), chemin.config("nouveau")), config(FOYER, null, PARENT)));
  });

  it("poser une exception avec échéance, puis revenir à la normale", async () => {
    const ref = doc(db(PARENT_2), chemin.config(PC));
    await assertSucceeds(
      updateDoc(ref, {
        [CHAMP_CONFIG.exception]: exception({ pc: VALEUR.pc.verrouille, par: "Maman" }),
        ...signe(PARENT_2),
      }),
    );
    await assertSucceeds(updateDoc(ref, { [CHAMP_CONFIG.exception]: null, ...signe(PARENT_2) }));
  });

  it("ajouter un site à la liste école ; relier le compte de l'appareil", async () => {
    const ref = doc(db(PARENT), chemin.config(PC));
    await assertSucceeds(updateDoc(ref, { [CHAMP_CONFIG.listeEcole]: ["exemple.fr"], ...signe(PARENT) }));
    await assertSucceeds(updateDoc(ref, { [CHAMP_CONFIG.compteAppareil]: "autre-compte", ...signe(PARENT) }));
  });

  it("décider une demande (accepter, refuser)", async () => {
    const ref = doc(db(PARENT_2), chemin.demande(PC, DEMANDE));
    await assertSucceeds(updateDoc(ref, decision(PARENT_2, VALEUR.statutDemande.refusee)));
    await assertSucceeds(updateDoc(ref, decision(PARENT_2, VALEUR.statutDemande.acceptee)));
  });

  it("foyer ancien sans rôles : tout membre est parent", async () => {
    await assertSucceeds(getDoc(doc(db(MEMBRE_ANCIEN), chemin.config(PC_ANCIEN))));
    await assertSucceeds(
      updateDoc(doc(db(MEMBRE_ANCIEN), chemin.config(PC_ANCIEN)), { [CHAMP_CONFIG.listeEcole]: [], ...signe(MEMBRE_ANCIEN) }),
    );
  });
});

describe("parents : interdit", () => {
  it("lister TOUS les appareils (sans filtre sur son foyer)", async () => {
    await assertFails(getDocs(collection(db(PARENT), COLLECTION_APPAREILS)));
  });

  it("créer un appareil pour un autre foyer", async () => {
    await assertFails(setDoc(doc(db(PARENT), chemin.config("intrus")), config(FOYER_B, null, PARENT)));
  });

  it("déplacer l'appareil dans un autre foyer", async () => {
    await assertFails(
      updateDoc(doc(db(PARENT), chemin.config(PC)), { [CHAMP_CONFIG.foyer]: FOYER_B, ...signe(PARENT) }),
    );
  });

  it("une exception sans échéance", async () => {
    await assertFails(
      updateDoc(doc(db(PARENT), chemin.config(PC)), {
        [CHAMP_CONFIG.exception]: {
          ...exception({ pc: VALEUR.pc.autorise }),
          [CHAMP_REGLE.jusqua]: null,
        },
        ...signe(PARENT),
      }),
    );
  });

  it("un champ inconnu dans la config", async () => {
    await assertFails(updateDoc(doc(db(PARENT), chemin.config(PC)), { champInconnu: true, ...signe(PARENT) }));
  });

  it("signer au nom d'un autre parent, ou ne pas signer", async () => {
    const ref = doc(db(PARENT), chemin.config(PC));
    await assertFails(updateDoc(ref, { [CHAMP_CONFIG.listeEcole]: [], ...signe(PARENT_2) }));
    await assertFails(setDoc(ref, { ...config(FOYER, APPAREIL, PARENT), [CHAMP_CONFIG.modifiePar]: null }));
  });

  it("écrire l'état ou l'usage à la place de l'appareil", async () => {
    await assertFails(setDoc(doc(db(PARENT), chemin.etat(PC)), etat()));
    await assertFails(setDoc(doc(db(PARENT), chemin.usage(PC, JOUR)), usage()));
  });

  it("créer une demande, ou la supprimer", async () => {
    await assertFails(addDoc(collection(db(PARENT), chemin.demandes(PC)), demande()));
    await assertFails(deleteDoc(doc(db(PARENT), chemin.demande(PC, DEMANDE))));
  });

  it("dans une décision : toucher au message, signer pour un autre, remettre en attente", async () => {
    const ref = doc(db(PARENT), chemin.demande(PC, DEMANDE));
    await assertFails(updateDoc(ref, { ...decision(PARENT), [CHAMP_DEMANDE.message]: "réécrit" }));
    await assertFails(updateDoc(ref, decision(PARENT_2)));
    await assertFails(updateDoc(ref, decision(PARENT, VALEUR.statutDemande.enAttente)));
  });

  it("le parent d'un autre foyer ne voit rien", async () => {
    const b = db(PARENT_B);
    await assertFails(getDoc(doc(b, chemin.config(PC))));
    await assertFails(getDoc(doc(b, chemin.etat(PC))));
    await assertFails(getDocs(collection(b, chemin.demandes(PC))));
    await assertFails(getDocs(query(collection(b, COLLECTION_APPAREILS), where(CHAMP_CONFIG.foyer, "==", FOYER))));
  });
});

describe("appareil : autorisé", () => {
  it("lire sa config", async () => {
    await assertSucceeds(getDoc(doc(db(APPAREIL), chemin.config(PC))));
  });

  it("écrire son état", async () => {
    await assertSucceeds(setDoc(doc(db(APPAREIL), chemin.etat(PC)), etat()));
  });

  it("écrire l'usage du jour (création puis mise à jour)", async () => {
    await assertSucceeds(setDoc(doc(db(APPAREIL), chemin.usage(PC, "2026-10-27")), usage("2026-10-27")));
    await assertSucceeds(setDoc(doc(db(APPAREIL), chemin.usage(PC, "2026-10-27")), usage("2026-10-27")));
  });

  it("créer une demande en attente, et relire ses demandes", async () => {
    await assertSucceeds(addDoc(collection(db(APPAREIL), chemin.demandes(PC)), demande()));
    await assertSucceeds(getDocs(collection(db(APPAREIL), chemin.demandes(PC))));
  });
});

describe("appareil : interdit", () => {
  it("modifier sa config (se débloquer lui-même)", async () => {
    await assertFails(
      updateDoc(doc(db(APPAREIL), chemin.config(PC)), {
        [CHAMP_CONFIG.exception]: exception({ pc: VALEUR.pc.autorise }),
        ...signe(APPAREIL),
      }),
    );
  });

  it("créer un appareil, supprimer sa config", async () => {
    await assertFails(setDoc(doc(db(APPAREIL), chemin.config("un-autre-appareil")), config(FOYER, APPAREIL, APPAREIL)));
    await assertFails(deleteDoc(doc(db(APPAREIL), chemin.config(PC))));
  });

  it("lister les appareils", async () => {
    await assertFails(getDocs(query(collection(db(APPAREIL), COLLECTION_APPAREILS), where(CHAMP_CONFIG.foyer, "==", FOYER))));
  });

  it("écrire un autre document d'état, un usage mal nommé, ou supprimer", async () => {
    await assertFails(setDoc(doc(db(APPAREIL), `${chemin.config(PC)}/${SOUS_COLLECTION.etat}/autre`), etat()));
    await assertFails(setDoc(doc(db(APPAREIL), chemin.usage(PC, "aujourdhui")), usage()));
    await assertFails(deleteDoc(doc(db(APPAREIL), chemin.usage(PC, JOUR))));
  });

  it("s'accorder sa propre demande : créée acceptée, ou acceptée après coup", async () => {
    await assertFails(
      addDoc(collection(db(APPAREIL), chemin.demandes(PC)), { ...demande(), [CHAMP_DEMANDE.statut]: VALEUR.statutDemande.acceptee }),
    );
    await assertFails(updateDoc(doc(db(APPAREIL), chemin.demande(PC, DEMANDE)), decision(APPAREIL)));
    await assertFails(deleteDoc(doc(db(APPAREIL), chemin.demande(PC, DEMANDE))));
  });

  it("toucher à un autre appareil", async () => {
    await assertFails(getDoc(doc(db(APPAREIL), chemin.config(PC_B))));
    await assertFails(setDoc(doc(db(APPAREIL), chemin.etat(PC_B)), etat()));
    await assertFails(addDoc(collection(db(APPAREIL), chemin.demandes(PC_B)), demande()));
  });

  it("lire le foyer et ses données (recettes, profils)", async () => {
    await assertFails(getDoc(doc(db(APPAREIL), "households", FOYER)));
    await assertFails(getDocs(collection(db(APPAREIL), "households", FOYER, "profils")));
  });
});

describe("cas du contrat réel (27.10)", () => {
  it("le PC réécrit sa demande tant qu'elle est en attente (renvoi après coupure)", async () => {
    await assertSucceeds(setDoc(doc(db(APPAREIL), chemin.demande(PC, DEMANDE)), demande()));
  });

  it("le PC ne peut pas marquer sa demande traitée, ni la réécrire une fois décidée", async () => {
    await assertFails(updateDoc(doc(db(APPAREIL), chemin.demande(PC, DEMANDE)), decision(APPAREIL)));
    await assertSucceeds(updateDoc(doc(db(PARENT), chemin.demande(PC, DEMANDE)), decision(PARENT)));
    await assertFails(setDoc(doc(db(APPAREIL), chemin.demande(PC, DEMANDE)), demande()));
  });

  it("un parent marque « traitée » une demande sans action (type autre)", async () => {
    await assertSucceeds(updateDoc(doc(db(PARENT), chemin.demande(PC, DEMANDE)), decision(PARENT, VALEUR.statutDemande.traitee)));
  });

  it("« Revenir à la normale » : exception effacée et code parent annulé", async () => {
    await assertSucceeds(
      updateDoc(doc(db(PARENT_2), chemin.config(PC)), {
        [CHAMP_CONFIG.exception]: null,
        [CHAMP_CONFIG.reinitialiserLocalAvant]: new Date(),
        ...signe(PARENT_2),
      }),
    );
  });

  it("accorder un mode jusqu'à une heure, avec le nom montré à l'enfant", async () => {
    await assertSucceeds(
      updateDoc(doc(db(PARENT_2), chemin.config(PC)), {
        [CHAMP_CONFIG.exception]: exception({ mode: VALEUR.mode.libre, par: "Maman" }),
        ...signe(PARENT_2),
      }),
    );
  });

  it("un nom montré à l'enfant de plus de 60 caractères est refusé", async () => {
    await assertFails(
      updateDoc(doc(db(PARENT), chemin.config(PC)), {
        [CHAMP_CONFIG.exception]: { ...exception({ pc: VALEUR.pc.verrouille }), [CHAMP_REGLE.par]: "x".repeat(61) },
        ...signe(PARENT),
      }),
    );
  });

  it("personne ne supprime l'état du PC, pas même le PC", async () => {
    await assertFails(deleteDoc(doc(db(APPAREIL), chemin.etat(PC))));
    await assertFails(deleteDoc(doc(db(PARENT), chemin.etat(PC))));
  });
});

describe("NextDNS : rapport et profil privé", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await setDoc(doc(d, chemin.rapportNextdns(PC)), { [CHAMP_RAPPORT.jour]: JOUR, [CHAMP_RAPPORT.requetesDuMois]: 1000 });
      await setDoc(doc(d, chemin.priveNextdns(PC)), { [CHAMP_PRIVE_NEXTDNS.profil]: "abc123" });
    });
  });

  it("les parents lisent le rapport", async () => {
    await assertSucceeds(getDoc(doc(db(PARENT), chemin.rapportNextdns(PC))));
    await assertSucceeds(getDoc(doc(db(PARENT_2), chemin.rapportNextdns(PC))));
  });

  it("personne n'écrit le rapport depuis un navigateur ; le PC et l'enfant ne le lisent pas", async () => {
    await assertFails(setDoc(doc(db(PARENT), chemin.rapportNextdns(PC)), { [CHAMP_RAPPORT.requetesDuMois]: 0 }));
    await assertFails(setDoc(doc(db(APPAREIL), chemin.rapportNextdns(PC)), { [CHAMP_RAPPORT.requetesDuMois]: 0 }));
    await assertFails(getDoc(doc(db(APPAREIL), chemin.rapportNextdns(PC))));
    await assertFails(getDoc(doc(db(ENFANT), chemin.rapportNextdns(PC))));
    await assertFails(getDoc(doc(db(PARENT_B), chemin.rapportNextdns(PC))));
  });

  it("le profil NextDNS n'est lisible par aucun client, même un parent", async () => {
    for (const uid of [PARENT, PARENT_2, APPAREIL, ENFANT]) {
      await assertFails(getDoc(doc(db(uid), chemin.priveNextdns(PC))));
      await assertFails(setDoc(doc(db(uid), chemin.priveNextdns(PC)), { [CHAMP_PRIVE_NEXTDNS.profil]: "un-autre-profil" }));
    }
  });
});

describe("notifications des demandes : la liste de jetons de chaque parent", () => {
  const liste = (jetons: string[]) => ({ [CHAMP_ABONNE.jetons]: jetons, [CHAMP_ABONNE.majLe]: new Date() });

  it("un parent écrit, relit et efface SA liste", async () => {
    const p = db(PARENT);
    await assertSucceeds(setDoc(doc(p, chemin.abonne(PC, PARENT)), liste(["jeton-tel"])));
    await assertSucceeds(getDoc(doc(p, chemin.abonne(PC, PARENT))));
    await assertSucceeds(setDoc(doc(p, chemin.abonne(PC, PARENT)), liste(["jeton-tel", "jeton-pc"])));
    await assertSucceeds(deleteDoc(doc(p, chemin.abonne(PC, PARENT))));
  });

  it("ni la liste de l'autre parent, ni un champ inconnu, ni plus de 10 jetons", async () => {
    await assertFails(setDoc(doc(db(PARENT_2), chemin.abonne(PC, PARENT)), liste(["intrus"])));
    await assertFails(setDoc(doc(db(PARENT), chemin.abonne(PC, PARENT)), { ...liste(["a"]), autre: 1 }));
    await assertFails(setDoc(doc(db(PARENT), chemin.abonne(PC, PARENT)), liste(Array.from({ length: 11 }, (_, i) => `j${i}`))));
  });

  it("ni l'enfant, ni le PC, ni un parent d'un autre foyer, ni un écran", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), chemin.abonne(PC, PARENT)), liste(["jeton-tel"])));
    for (const c of [db(ENFANT), db(APPAREIL), db(PARENT_B), ecran()]) {
      await assertFails(getDoc(doc(c, chemin.abonne(PC, PARENT))));
      await assertFails(getDocs(collection(c, chemin.abonnes(PC))));
    }
    await assertFails(setDoc(doc(db(ENFANT), chemin.abonne(PC, ENFANT)), liste(["x"])));
    await assertFails(setDoc(doc(db(APPAREIL), chemin.abonne(PC, APPAREIL)), liste(["x"])));
    await assertFails(setDoc(doc(db(PARENT_B), chemin.abonne(PC, PARENT_B)), liste(["x"])));
  });
});

describe("personne d'autre", () => {
  it("un membre non parent (l'enfant) ne lit ni n'écrit rien", async () => {
    const e = db(ENFANT);
    await assertFails(getDoc(doc(e, chemin.config(PC))));
    await assertFails(getDocs(query(collection(e, COLLECTION_APPAREILS), where(CHAMP_CONFIG.foyer, "==", FOYER))));
    await assertFails(updateDoc(doc(e, chemin.config(PC)), { [CHAMP_CONFIG.exception]: null, ...signe(ENFANT) }));
    await assertFails(getDoc(doc(e, chemin.etat(PC))));
    await assertFails(updateDoc(doc(e, chemin.demande(PC, DEMANDE)), decision(ENFANT)));
  });

  it("l'écran de cuisine d'un AUTRE foyer ne voit pas le PC", async () => {
    const autre = db("display:d2", { isDisplay: true, householdId: FOYER_B, displayId: "d2" });
    await assertFails(getDoc(doc(autre, chemin.config(PC))));
    await assertFails(getDoc(doc(autre, chemin.etat(PC))));
    await assertFails(getDoc(doc(autre, chemin.demande(PC, DEMANDE))));
    await assertFails(getDocs(query(collection(autre, COLLECTION_APPAREILS), where(CHAMP_CONFIG.foyer, "==", FOYER))));
  });

  it("un compte inconnu, ou personne de connecté", async () => {
    await assertFails(getDoc(doc(db(INCONNU), chemin.config(PC))));
    await assertFails(setDoc(doc(db(INCONNU), chemin.etat(PC)), etat()));
    const anonyme = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonyme, chemin.config(PC))));
    await assertFails(addDoc(collection(anonyme, chemin.demandes(PC)), demande()));
  });
});

describe("écran de cuisine du foyer : il lit tout, il n'écrit rien", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await setDoc(doc(d, chemin.rapportNextdns(PC)), { [CHAMP_RAPPORT.jour]: JOUR, [CHAMP_RAPPORT.requetesDuMois]: 1000 });
      await setDoc(doc(d, chemin.priveNextdns(PC)), { [CHAMP_PRIVE_NEXTDNS.profil]: "abc123" });
    });
  });

  it("lit la config, l'état, l'usage, les demandes et le rapport internet", async () => {
    const e = ecran();
    await assertSucceeds(getDocs(query(collection(e, COLLECTION_APPAREILS), where(CHAMP_CONFIG.foyer, "==", FOYER), limit(1))));
    await assertSucceeds(getDoc(doc(e, chemin.config(PC))));
    await assertSucceeds(getDoc(doc(e, chemin.etat(PC))));
    await assertSucceeds(getDoc(doc(e, chemin.usage(PC, JOUR))));
    await assertSucceeds(getDocs(query(collection(e, chemin.demandes(PC)), orderBy(CHAMP_DEMANDE.creeeLe, "desc"), limit(40))));
    await assertSucceeds(getDoc(doc(e, chemin.rapportNextdns(PC))));
  });

  it("ne s'accorde rien : ni décision sur une demande, ni exception, ni mode, ni déverrouillage", async () => {
    const e = ecran();
    await assertFails(updateDoc(doc(e, chemin.demande(PC, DEMANDE)), decision("display:d1")));
    await assertFails(
      updateDoc(doc(e, chemin.config(PC)), {
        [CHAMP_CONFIG.exception]: exception({ [CHAMP_REGLE.pc]: VALEUR.pc.autorise }),
        ...signe("display:d1"),
      }),
    );
    await assertFails(
      updateDoc(doc(e, chemin.config(PC)), { [CHAMP_CONFIG.exception]: null, ...signe("display:d1") }),
    );
    await assertFails(setDoc(doc(e, chemin.config(PC)), config(FOYER, APPAREIL, "display:d1")));
    await assertFails(deleteDoc(doc(e, chemin.config(PC))));
  });

  it("n'écrit ni à la place du PC, ni le rapport, ni les notifications ; ne lit pas le profil privé", async () => {
    const e = ecran();
    await assertFails(setDoc(doc(e, chemin.etat(PC)), etat()));
    await assertFails(setDoc(doc(e, chemin.usage(PC, JOUR)), usage()));
    await assertFails(setDoc(doc(e, chemin.demande(PC, "demande-ecran")), demande()));
    await assertFails(deleteDoc(doc(e, chemin.demande(PC, DEMANDE))));
    await assertFails(setDoc(doc(e, chemin.rapportNextdns(PC)), { [CHAMP_RAPPORT.requetesDuMois]: 0 }));
    await assertFails(getDoc(doc(e, chemin.priveNextdns(PC))));
    await assertFails(setDoc(doc(e, chemin.abonne(PC, "display:d1")), { [CHAMP_ABONNE.jetons]: ["x"] }));
  });
});
