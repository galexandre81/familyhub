#!/usr/bin/env node
/**
 * Simulateur d'appareil piloté : joue le rôle du PC des enfants contre les
 * ÉMULATEURS Firebase, au format du contrat réel (agent 1.0.0), pour
 * développer et tester l'écran parent sans le vrai PC.
 * Mode d'emploi : docs/controle-parental/SIMULATEUR.md.
 *
 *   node scripts/simulateur-appareil.mjs preparer --parent a@test.local [--parent b@test.local] [--enfant c@test.local]
 *   node scripts/simulateur-appareil.mjs jouer [--heure 21:25] [--vitesse 60] [--rythme 10] [--appli krita]
 *   node scripts/simulateur-appareil.mjs journee
 *   node scripts/simulateur-appareil.mjs demande temps|site|appli|mode|autre [--detail x] [--duree 45] [--message "…"]
 *   node scripts/simulateur-appareil.mjs refus <idAppli>
 *   node scripts/simulateur-appareil.mjs hors-ligne [--depuis 3h|45min]
 *   node scripts/simulateur-appareil.mjs etat
 *
 * Côté appareil, le simulateur se connecte avec un compte dédié et passe par
 * les VRAIES règles Firestore. Seul `preparer` (foyer d'essai, compte de
 * l'appareil) utilise les droits d'administration — de l'émulateur seulement :
 * le projet est forcé à « demo-fh », qui n'existe pas chez Google.
 */
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { connectFirestoreEmulator, getDoc, doc, getFirestore } from "firebase/firestore";
import {
  CATEGORIES_PAR_MODE,
  CHAMP_CATALOGUE,
  CHAMP_ETAT,
  CHAMP_PRIVE_NEXTDNS,
  VALEUR,
  chemin,
  creerDemande,
  ecouterConfig,
  ecrireEtat,
  ecrireUsage,
  etatEffectif,
  etatVers,
  infosMode,
  jourDe,
  jourLocal,
  lireConfig,
  nouvelleConfigVers,
  plagesActives,
  prochainChangement,
  sansFin,
  usageDepuis,
} from "@family-hub/controle-parental";

const PROJET = "demo-fh";
const HOTE = "127.0.0.1";
const PORT_AUTH = 9099;
const PORT_FIRESTORE = 8080;
const FOYER_ESSAI = "foyer-essai";
const APPAREIL_DEFAUT = "pc-essai";
const COMPTE_APPAREIL = { email: "appareil-essai@appareils.invalid", motDePasse: "emulateur-seulement" };
const VERSION = "simulateur-1.0";

/** Catalogue réel du PC au 27.10.2026 (id, nom, catégorie appliquée). */
const CATALOGUE = [
  ["chrome", "Google Chrome", VALEUR.categorie.ecole],
  ["libreoffice", "LibreOffice", VALEUR.categorie.ecole],
  ["krita", "Krita", VALEUR.categorie.creation],
  ["inkscape", "Inkscape", VALEUR.categorie.creation],
  ["musescore", "MuseScore 3", VALEUR.categorie.creation],
  ["lmms", "LMMS", VALEUR.categorie.creation],
  ["thonny", "Thonny (Python)", VALEUR.categorie.creation],
  ["klavaro", "Klavaro (frappe)", VALEUR.categorie.creation],
  ["stellarium", "Stellarium", VALEUR.categorie.creation],
];
const NOMS_JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

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

const hhmm = (d) => `${d.getHours()}h${String(d.getMinutes()).padStart(2, "0")}`;
const duree = (s) => {
  const min = Math.round(s / 60);
  return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min} min`;
};

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

const usageVide = (jour) => ({
  jour,
  secondesSession: 0,
  secondesActives: 0,
  secondesParAppli: {},
  nomsApplis: {},
  secondesParCategorie: {},
  lancementsRefuses: [],
  codeParent: [],
  executablesInconnus: [],
  vpnBloques: [],
  limitesAtteintes: {},
  majLe: null,
});

async function usageDuJour(db, jour) {
  const s = await getDoc(doc(db, chemin.usage(APPAREIL, jour)));
  return s.exists() ? usageDepuis(jour, s.data()) : usageVide(jour);
}

// ---------------------------------------------------------------- l'agent, en petit

/** Raison d'une dimension, au format des phrases de l'agent. */
function raison(c, dim, source, quand) {
  if (source === VALEUR.source.exception) {
    const j = c.exception.jusqua;
    return `exception (${c.exception.par || "Family Hub"}) jusqu'à ${sansFin(j) ? "01/01 0h00" : hhmm(j)}`;
  }
  if (source === VALEUR.source.planning) {
    const p = plagesActives(c.planning, quand).find((pl) => pl[dim] !== undefined);
    const jour = NOMS_JOURS[CLE_JOUR_INDEX(p, c.planning, quand)];
    return `planning du ${jour} (${p.debut.replace(":", "h")}–${p.fin.replace(":", "h")})`;
  }
  return "réglage par défaut";
}

/** Jour auquel appartient la plage active (celui où elle commence). */
function CLE_JOUR_INDEX(plage, planning, quand) {
  return planning[jourDe(quand)].includes(plage) ? quand.getDay() : (quand.getDay() + 6) % 7;
}

/** Applis refusées en ce moment, avec la raison de l'agent. */
function applisRefusees(c, mode) {
  const out = {};
  for (const [id, , categorieCatalogue] of CATALOGUE) {
    const reglage = c.applis[id];
    const categorie = reglage?.categorie ?? categorieCatalogue;
    if (reglage && !reglage.autorisee) out[id] = "refusée par les parents";
    else if (!CATEGORIES_PAR_MODE[mode].includes(categorie)) out[id] = `pas en mode ${infosMode(mode).libelle}`;
  }
  return out;
}

function etatPour(c, quand, minutesDuJour) {
  const e = etatEffectif(c, quand);
  const { libelle } = infosMode(e.mode);
  const sources = { pc: e.sourcePc, internet: e.sourceInternet, mode: e.sourceMode };
  const suitePc = prochainChangement(c, "pc", quand);
  const refusees = applisRefusees(c, e.mode);
  const resume =
    `Mode ${libelle}. ` +
    (e.pc === VALEUR.pc.verrouille
      ? `PC verrouillé${suitePc ? `, déblocage à ${hhmm(suitePc.quand)}` : ""}.`
      : `PC disponible${suitePc ? `, verrouillage à ${hhmm(suitePc.quand)}` : ""}.`);
  const brut = etatVers({
    pc: e.pc,
    internet: e.internet,
    mode: e.mode,
    raisons: Object.fromEntries(Object.entries(sources).map(([d, s]) => [d, raison(c, d, s, quand)])),
    sources,
    jusqua: Object.fromEntries(
      Object.entries(sources).map(([d, s]) => [d, s === VALEUR.source.exception ? c.exception.jusqua : null]),
    ),
    libelleMode: libelle,
    reseau: e.reseau,
    resume,
    minutesDuJour,
    sessionOuverte: e.pc === VALEUR.pc.autorise,
    applisRefusees: refusees,
    vuLe: new Date(),
    version: VERSION,
  });
  // Catalogue publié par l'agent (prévu au contrat, réponse c).
  brut[CHAMP_ETAT.catalogue] = Object.fromEntries(
    CATALOGUE.map(([id, nom, categorieCatalogue]) => [
      id,
      {
        [CHAMP_CATALOGUE.nom]: nom,
        [CHAMP_CATALOGUE.categorie]: c.applis[id]?.categorie ?? categorieCatalogue,
        [CHAMP_CATALOGUE.categorieParDefaut]: categorieCatalogue,
        [CHAMP_CATALOGUE.autorisee]: !refusees[id],
        [CHAMP_CATALOGUE.raison]: refusees[id] ?? null,
      },
    ]),
  );
  return { brut, e, libelle };
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
        `Aucun compte « ${email} » dans l'émulateur. Ouvrir d'abord le hub (npm run dev:hub:essai), se connecter avec cette adresse, puis relancer.`,
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

  const nomsParents = Object.fromEntries(parents.map((u, i) => [u, i === 0 ? "Papa" : "Maman"]));
  await db
    .doc(chemin.config(APPAREIL))
    .set(nouvelleConfigVers({ foyer: FOYER_ESSAI, compteAppareil: compte.uid, nom: "PC des enfants", nomsParents, par: parents[0], quand: new Date() }));
  // Profil NextDNS de l'appareil (document privé, lu par la fonction seule) : celui de scripts/faux-nextdns.mjs.
  await db.doc(chemin.priveNextdns(APPAREIL)).set({ [CHAMP_PRIVE_NEXTDNS.profil]: "essaiPc" });

  console.log(`Foyer d'essai prêt : ${parents.length} parent(s), ${enfants.length} enfant(s).`);
  console.log(`Appareil « ${APPAREIL} » relié au compte ${COMPTE_APPAREIL.email}, planning et liste école du contrat.`);
  console.log("Recharger le hub : la carte « PC des enfants » mène à l'écran parent.");
}

/** Boucle de l'appareil : lit la config en direct, applique, compte le temps, rend compte. */
async function jouer() {
  const db = await connecterAppareil();
  const maintenant = horloge(options.heure, Number(options.vitesse ?? 1));
  const rythme = Number(options.rythme ?? 10);
  const appli = options.appli ?? "libreoffice";
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
    const { brut, e, libelle } = etatPour(c, t, Math.round(usage.secondesSession / 60));

    // Une minute de PC par tour quand le PC est autorisé : le temps défile vite à l'écran.
    if (e.pc === VALEUR.pc.autorise) {
      usage.secondesSession += 60;
      usage.secondesActives += 50;
      const refusee = !CATEGORIES_PAR_MODE[e.mode].includes(CATALOGUE.find(([id]) => id === appli)?.[2] ?? VALEUR.categorie.autre);
      if (!refusee) usage.secondesParAppli[appli] = (usage.secondesParAppli[appli] ?? 0) + 60;
      usage.nomsApplis[appli] = CATALOGUE.find(([id]) => id === appli)?.[1] ?? appli;
    }
    usage.majLe = new Date();
    await ecrireEtat(db, APPAREIL, brut);
    await ecrireUsage(db, APPAREIL, usage);

    if (precedent && precedent !== e.pc) {
      console.log(e.pc === VALEUR.pc.verrouille ? "  ⚠ verrouillage : la session serait fermée" : "  ✓ déverrouillé");
    }
    precedent = e.pc;
    console.log(`${hhmm(t)} · ${libelle} · ${e.pc === VALEUR.pc.verrouille ? "PC verrouillé" : "PC autorisé"} · internet ${e.reseau} · ${duree(usage.secondesSession)} aujourd'hui`);
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
    ...usageVide(jour),
    secondesSession: 9300,
    secondesActives: 7800,
    secondesParAppli: { chrome: 3720, krita: 2460, libreoffice: 1620, thonny: 900, "autre:bureau": 600 },
    nomsApplis: { chrome: "Google Chrome", krita: "Krita", libreoffice: "LibreOffice", thonny: "Thonny (Python)" },
    secondesParCategorie: { ecole: 5340, creation: 3360 },
    lancementsRefuses: [
      { appli: "krita", quand: a(16, 12) },
      { appli: "musescore", quand: a(17, 5) },
    ],
    codeParent: [{ quand: a(21, 38), reussi: false }],
    majLe: new Date(),
  });
  console.log(`Journée du ${jour} écrite : 2h35 de PC, 4 applis, 2 lancements refusés, un code parent erroné.`);
}

async function demande() {
  const type = {
    temps: VALEUR.typeDemande.temps,
    site: VALEUR.typeDemande.site,
    appli: VALEUR.typeDemande.appli,
    mode: VALEUR.typeDemande.mode,
    autre: VALEUR.typeDemande.autre,
  }[positionnels[0]];
  if (!type) throw new Error("demande temps|site|appli|mode|autre");
  const exemples = {
    [VALEUR.typeDemande.temps]: ["30 min", 30, "Je peux finir mon dessin ? Encore 30 minutes s'il te plaît"],
    [VALEUR.typeDemande.site]: ["scratch.mit.edu", null, "Le prof de techno nous fait faire Scratch"],
    [VALEUR.typeDemande.appli]: ["krita", null, "Pour le devoir d'arts plastiques"],
    [VALEUR.typeDemande.mode]: [VALEUR.mode.libre, 45, "J'ai fini mes devoirs !"],
    [VALEUR.typeDemande.autre]: ["", null, "Tu peux venir voir mon projet ?"],
  };
  const [detail, dureeMinutes, message] = exemples[type];
  const db = await connecterAppareil();
  const id = await creerDemande(db, APPAREIL, {
    de: options.de ?? "enfant",
    type,
    detail: options.detail ?? detail,
    dureeMinutes: options.duree ? Number(options.duree) : dureeMinutes,
    message: options.message ?? message,
  });
  console.log(`Demande « ${positionnels[0]} » envoyée (${id}).`);
}

async function refus() {
  const appli = positionnels[0] ?? "krita";
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
  const { brut } = etatPour(await config(db), vuLe, 0);
  brut[CHAMP_ETAT.vuLe] = vuLe.toISOString();
  await ecrireEtat(db, APPAREIL, brut);
  console.log(`Dernier signe de vie posé à ${hhmm(vuLe)} : ne pas relancer « jouer » pour garder l'appareil hors ligne.`);
}

async function etat() {
  const db = await connecterAppareil();
  const c = await config(db);
  const t = horloge(options.heure)();
  const { brut } = etatPour(c, t, 0);
  console.log(brut[CHAMP_ETAT.resume]);
  if (c.exception) console.log(`Exception jusqu'à ${c.exception.jusqua.toLocaleString("fr-CH")} (par ${c.exception.par})`);
  console.log(`Liste école : ${c.listeEcole.length} sites`);
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
