#!/usr/bin/env node
/**
 * Simulateur d'appareil piloté : joue le rôle du PC des enfants contre les
 * ÉMULATEURS Firebase, pour développer et tester l'écran parent sans le vrai
 * PC. Mode d'emploi : docs/controle-parental/SIMULATEUR.md.
 *
 *   node scripts/simulateur-appareil.mjs preparer --parent a@test.local [--parent b@test.local] [--enfant c@test.local]
 *   node scripts/simulateur-appareil.mjs jouer [--heure 21:25] [--vitesse 60] [--rythme 10] [--appli org.kde.krita]
 *   node scripts/simulateur-appareil.mjs journee
 *   node scripts/simulateur-appareil.mjs demande temps|site|appli [--cible x] [--message "…"]
 *   node scripts/simulateur-appareil.mjs refus <idAppli>
 *   node scripts/simulateur-appareil.mjs hors-ligne [--depuis 3h|45min]
 *   node scripts/simulateur-appareil.mjs etat
 *
 * Côté appareil, le simulateur se connecte avec un compte dédié et passe par
 * les VRAIES règles Firestore : chacune de ses écritures est aussi un test des
 * règles. Seul `preparer` (foyer d'essai, compte de l'appareil) utilise les
 * droits d'administration — de l'émulateur seulement : le projet est forcé à
 * « demo-fh », qui n'existe pas chez Google.
 */
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { connectFirestoreEmulator, getDoc, doc, getFirestore } from "firebase/firestore";
import {
  CHAMP_CONFIG,
  VALEUR,
  appliVers,
  chemin,
  creerDemande,
  ecouterConfig,
  ecrireEtat,
  ecrireUsage,
  etatEffectif,
  jourLocal,
  lireConfig,
  nouvelleConfigVers,
  prochainChangementPc,
  usageDepuis,
} from "@family-hub/controle-parental";

const PROJET = "demo-fh";
const HOTE = "127.0.0.1";
const PORT_AUTH = 9099;
const PORT_FIRESTORE = 8080;
const FOYER_ESSAI = "foyer-essai";
const APPAREIL_DEFAUT = "pc-essai";
const COMPTE_APPAREIL = { email: "appareil-essai@appareils.invalid", motDePasse: "emulateur-seulement" };
const VERSION = "simulateur-0.1";

/** Palette du PC (phase 7 du prompt de l'agent), catégories réalistes. */
const APPLIS = [
  ["org.libreoffice.LibreOffice", "LibreOffice", VALEUR.categorie.ecole, true],
  ["com.google.Chrome", "Chrome", VALEUR.categorie.autre, true],
  ["org.kde.krita", "Krita", VALEUR.categorie.creation, true],
  ["org.inkscape.Inkscape", "Inkscape", VALEUR.categorie.creation, true],
  ["org.musescore.MuseScore", "MuseScore", VALEUR.categorie.creation, true],
  ["io.lmms.LMMS", "LMMS", VALEUR.categorie.creation, true],
  ["org.thonny.Thonny", "Thonny", VALEUR.categorie.ecole, true],
  ["klavaro", "Klavaro", VALEUR.categorie.ecole, true],
  ["org.stellarium.Stellarium", "Stellarium", VALEUR.categorie.ecole, true],
  ["net.supertuxkart.SuperTuxKart", "SuperTuxKart", VALEUR.categorie.jeu, false],
];
const LISTE_ECOLE = ["index-education.net", "ent.exemple-college.fr"];

// ---------------------------------------------------------------- arguments

const [, , commande, ...reste] = process.argv;
const options = { parent: [], enfant: [] };
const positionnels = [];
for (let i = 0; i < reste.length; i++) {
  const a = reste[i];
  if (!a.startsWith("--")) {
    positionnels.push(a);
    continue;
  }
  const cle = a.slice(2);
  const valeur = reste[i + 1];
  if (valeur === undefined || valeur.startsWith("--")) throw new Error(`--${cle} attend une valeur`);
  i++;
  if (Array.isArray(options[cle])) options[cle].push(valeur);
  else options[cle] = valeur;
}
const APPAREIL = options.appareil ?? APPAREIL_DEFAUT;

function dureeEnMs(s) {
  const m = /^(\d+)\s*(h|min)$/.exec(s ?? "");
  if (!m) throw new Error(`Durée illisible : « ${s} » (ex. 3h, 45min)`);
  return Number(m[1]) * (m[2] === "h" ? 3_600_000 : 60_000);
}

/**
 * Horloge simulée : il est `--heure` au départ, puis le temps passe `--vitesse`
 * fois plus vite (60 : une minute par seconde). Jamais l'horloge du système.
 */
function horloge(heure, vitesse = 1) {
  const reel0 = Date.now();
  const depart = new Date(reel0);
  if (heure) {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(heure);
    if (!m) throw new Error(`--heure attend HH:MM, reçu « ${heure} »`);
    depart.setHours(Number(m[1]), Number(m[2]), 0, 0);
  }
  if (!(vitesse > 0)) throw new Error("--vitesse attend un nombre positif");
  return () => new Date(depart.getTime() + (Date.now() - reel0) * vitesse);
}

const hhmm = (d) => d.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
const duree = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min} min`);
const PC_TEXTE = { [VALEUR.pc.autorise]: "PC autorisé", [VALEUR.pc.verrouille]: "PC verrouillé" };
const NET_TEXTE = { [VALEUR.internet.complet]: "internet complet", [VALEUR.internet.ecole]: "mode école" };

// ---------------------------------------------------------------- connexions

function webAppareil() {
  const app = initializeApp({ projectId: PROJET, apiKey: "demo-cle" }, `appareil-${Date.now()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOTE}:${PORT_AUTH}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, HOTE, PORT_FIRESTORE);
  return { auth, db };
}

async function connecterAppareil() {
  const { auth, db } = webAppareil();
  try {
    await signInWithEmailAndPassword(auth, COMPTE_APPAREIL.email, COMPTE_APPAREIL.motDePasse);
  } catch (e) {
    throw new Error(
      `Connexion de l'appareil impossible (${e.code ?? e.message}). Les émulateurs tournent-ils ? « preparer » a-t-il été lancé ?`,
    );
  }
  return db;
}

/** Admin SDK, sur l'émulateur UNIQUEMENT : variables posées ici, projet demo-. */
async function admin() {
  if (!PROJET.startsWith("demo-")) throw new Error("Refus : le simulateur ne travaille que sur un projet demo-.");
  process.env.FIRESTORE_EMULATOR_HOST = `${HOTE}:${PORT_FIRESTORE}`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = `${HOTE}:${PORT_AUTH}`;
  // Sans ces deux variables, le SDK cherche un serveur Google Cloud (délai, avertissement).
  process.env.GCLOUD_PROJECT = PROJET;
  process.env.METADATA_SERVER_DETECTION = "none";
  const { initializeApp: init, getApps } = await import("firebase-admin/app");
  const { getAuth: auth } = await import("firebase-admin/auth");
  const { getFirestore: firestore } = await import("firebase-admin/firestore");
  const app = getApps()[0] ?? init({ projectId: PROJET });
  return { auth: auth(app), db: firestore(app) };
}

async function config(db) {
  const c = await lireConfig(db, APPAREIL);
  if (!c) throw new Error(`L'appareil « ${APPAREIL} » n'existe pas (lancer « preparer »).`);
  return c;
}

async function usageDuJour(db, jour) {
  const s = await getDoc(doc(db, chemin.usage(APPAREIL, jour)));
  return s.exists()
    ? usageDepuis(jour, s.data())
    : { jour, minutesSession: 0, minutesParAppli: {}, lancementsRefuses: [], codeParent: [], majLe: null };
}

function etatPour(c, quand) {
  const e = etatEffectif(c, quand);
  const raison = e.raisonInternet === VALEUR.raison.exception ? e.raisonInternet : e.raisonPc;
  return { pc: e.pc, internet: e.internet, raison, vuLe: new Date(), version: VERSION };
}

// ---------------------------------------------------------------- commandes

async function preparer() {
  if (options.parent.length === 0) throw new Error("Au moins un --parent <adresse> (compte déjà connecté une fois au hub).");
  const { auth, db } = await admin();

  const uidDe = async (email) => {
    try {
      return (await auth.getUserByEmail(email)).uid;
    } catch {
      throw new Error(
        `Aucun compte « ${email} » dans l'émulateur. Ouvrir d'abord le hub (VITE_EMULATEURS=1), se connecter avec cette adresse, puis relancer.`,
      );
    }
  };
  const parents = await Promise.all(options.parent.map(uidDe));
  const enfants = await Promise.all(options.enfant.map(uidDe));
  const roles = Object.fromEntries([...parents.map((u) => [u, "parent"]), ...enfants.map((u) => [u, "enfant"])]);

  // Même forme qu'un foyer créé par le hub (useCreateHousehold).
  await db.doc(`households/${FOYER_ESSAI}`).set({
    nom: "Foyer d'essai",
    ownerUid: parents[0],
    membres: [...parents, ...enfants],
    roles,
    parametres: { localisation: {}, langue: "fr", systemeUnites: "metric" },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  for (const uid of [...parents, ...enfants]) {
    await db.doc(`users/${uid}`).set({ householdsIds: [FOYER_ESSAI], defaultHouseholdId: FOYER_ESSAI }, { merge: true });
  }

  let compte;
  try {
    compte = await auth.getUserByEmail(COMPTE_APPAREIL.email);
  } catch {
    compte = await auth.createUser({ email: COMPTE_APPAREIL.email, password: COMPTE_APPAREIL.motDePasse });
  }

  await db.doc(chemin.config(APPAREIL)).set({
    ...nouvelleConfigVers({ foyer: FOYER_ESSAI, compteAppareil: compte.uid, nom: "PC des enfants", par: parents[0], quand: new Date() }),
    [CHAMP_CONFIG.applis]: Object.fromEntries(
      APPLIS.map(([id, nom, categorie, autorisee]) => [id, appliVers({ autorisee, categorie, nom })]),
    ),
    [CHAMP_CONFIG.listeEcole]: LISTE_ECOLE,
  });

  console.log(`Foyer d'essai prêt : ${parents.length} parent(s), ${enfants.length} enfant(s).`);
  console.log(`Appareil « ${APPAREIL} » relié au compte ${COMPTE_APPAREIL.email}, ${APPLIS.length} applis, planning par défaut.`);
  console.log("Recharger le hub : la carte « PC des enfants » mène à l'écran parent.");
}

/** Boucle de l'appareil : lit la config en direct, applique, compte le temps, rend compte. */
async function jouer() {
  const db = await connecterAppareil();
  const maintenant = horloge(options.heure, Number(options.vitesse ?? 1));
  const rythme = Number(options.rythme ?? 10);
  const appli = options.appli ?? "org.kde.krita";
  let c = await config(db);
  let usage = await usageDuJour(db, jourLocal(maintenant()));
  let precedent = null;

  ecouterConfig(db, APPAREIL, (nouvelle) => {
    if (nouvelle) {
      c = nouvelle;
      console.log(`  ↳ config reçue (${hhmm(maintenant())})`);
    }
  });

  const tour = async () => {
    const t = maintenant();
    const jour = jourLocal(t);
    if (usage.jour !== jour) usage = await usageDuJour(db, jour);
    const etat = etatPour(c, t);
    await ecrireEtat(db, APPAREIL, etat);

    // Une minute de PC par tour quand le PC est autorisé : le temps défile vite à l'écran.
    if (etat.pc === VALEUR.pc.autorise) {
      usage.minutesSession += 1;
      usage.minutesParAppli[appli] = (usage.minutesParAppli[appli] ?? 0) + 1;
    }
    usage.majLe = new Date();
    await ecrireUsage(db, APPAREIL, usage);

    const suite = prochainChangementPc(c, t);
    const ligne = `${hhmm(t)} · ${PC_TEXTE[etat.pc]} · ${NET_TEXTE[etat.internet]} · ${duree(usage.minutesSession)} aujourd'hui${
      suite ? ` · ${suite.pc === VALEUR.pc.verrouille ? "verrouillage" : "déblocage"} à ${hhmm(suite.quand)}` : ""
    }`;
    if (precedent && precedent !== etat.pc) {
      console.log(etat.pc === VALEUR.pc.verrouille ? "  ⚠ verrouillage : la session serait fermée" : "  ✓ déverrouillé");
    }
    precedent = etat.pc;
    console.log(ligne);
  };

  console.log(`Simulateur « ${APPAREIL} » : un tour toutes les ${rythme} s (Ctrl+C pour arrêter).`);
  await tour();
  setInterval(() => tour().catch((e) => console.error("Écriture refusée :", e.message)), rythme * 1000);
}

/** Une journée réaliste d'usage, d'un coup (pour l'écran « La journée »). */
async function journee() {
  const db = await connecterAppareil();
  const t = horloge(options.heure)();
  const jour = jourLocal(t);
  const a = (h, m) => {
    const d = new Date(t);
    d.setHours(h, m, 0, 0);
    return d;
  };
  await ecrireUsage(db, APPAREIL, {
    jour,
    minutesSession: 155,
    minutesParAppli: {
      "com.google.Chrome": 62,
      "org.kde.krita": 41,
      "org.libreoffice.LibreOffice": 27,
      "org.thonny.Thonny": 15,
      klavaro: 10,
    },
    lancementsRefuses: [
      { appli: "net.supertuxkart.SuperTuxKart", quand: a(16, 12) },
      { appli: "net.supertuxkart.SuperTuxKart", quand: a(20, 47) },
    ],
    codeParent: [],
    majLe: new Date(),
  });
  await ecrireEtat(db, APPAREIL, etatPour(await config(db), t));
  console.log(`Journée du ${jour} écrite : 2h35 de PC, 5 applis, 2 lancements refusés.`);
}

async function demande() {
  const type = { temps: VALEUR.typeDemande.temps, site: VALEUR.typeDemande.site, appli: VALEUR.typeDemande.appli }[positionnels[0]];
  if (!type) throw new Error("demande temps|site|appli");
  const exemples = {
    [VALEUR.typeDemande.temps]: [null, "Je peux finir mon dessin ? Encore 30 minutes s'il te plaît"],
    [VALEUR.typeDemande.site]: ["scratch.mit.edu", "Le prof de techno nous fait faire Scratch"],
    [VALEUR.typeDemande.appli]: ["net.supertuxkart.SuperTuxKart", "Juste une course avant le dîner ?"],
  };
  const [cible, message] = exemples[type];
  const db = await connecterAppareil();
  const id = await creerDemande(db, APPAREIL, { type, cible: options.cible ?? cible, message: options.message ?? message });
  console.log(`Demande « ${positionnels[0]} » envoyée (${id}).`);
}

async function refus() {
  const appli = positionnels[0] ?? "net.supertuxkart.SuperTuxKart";
  const db = await connecterAppareil();
  const t = horloge(options.heure)();
  const usage = await usageDuJour(db, jourLocal(t));
  usage.lancementsRefuses.push({ appli, quand: t });
  usage.majLe = new Date();
  await ecrireUsage(db, APPAREIL, usage);
  console.log(`Lancement refusé noté : ${appli} à ${hhmm(t)}.`);
}

async function horsLigne() {
  const db = await connecterAppareil();
  const depuis = dureeEnMs(options.depuis ?? "3h");
  const vuLe = new Date(Date.now() - depuis);
  await ecrireEtat(db, APPAREIL, { ...etatPour(await config(db), vuLe), vuLe });
  console.log(`Dernier signe de vie posé à ${hhmm(vuLe)} : ne pas relancer « jouer » pour garder l'appareil hors ligne.`);
}

async function etat() {
  const db = await connecterAppareil();
  const c = await config(db);
  const t = horloge(options.heure)();
  const e = etatEffectif(c, t);
  const suite = prochainChangementPc(c, t);
  console.log(`${hhmm(t)} · ${PC_TEXTE[e.pc]} (${e.raisonPc}) · ${NET_TEXTE[e.internet]} (${e.raisonInternet})`);
  if (c.exception) console.log(`Exception jusqu'à ${c.exception.jusqua.toLocaleString("fr-CH")}`);
  if (suite) console.log(`Prochain changement : ${PC_TEXTE[suite.pc]} à ${suite.quand.toLocaleString("fr-CH")}`);
  console.log(`Liste école : ${c.listeEcole.join(", ") || "vide"} · ${Object.keys(c.applis).length} applis`);
}

const COMMANDES = { preparer, jouer, journee, demande, refus, "hors-ligne": horsLigne, etat };
const action = COMMANDES[commande];
if (!action) {
  console.error(`Commandes : ${Object.keys(COMMANDES).join(", ")}. Mode d'emploi : docs/controle-parental/SIMULATEUR.md`);
  process.exit(1);
}
action()
  .then(() => {
    if (commande !== "jouer") process.exit(0);
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
