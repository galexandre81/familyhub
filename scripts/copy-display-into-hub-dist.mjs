// Copies apps/display/public/* into apps/hub/dist/display/ so the single Firebase
// Hosting site can serve both the React hub (root) and the vanilla display (/display/*).
//
// Génère aussi dist/display/js/firebase-config.js à partir des MÊMES variables
// VITE_FIREBASE_* que le hub (apps/hub/.env.local, ou l'environnement). Avant, ce
// fichier était versionné avec la config du projet d'origine : qui forkait et
// l'oubliait avait un hub sur SON projet et des iPads appairés sur celui d'un autre.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "apps/display/public");
const DEST = resolve(ROOT, "apps/hub/dist/display");
const HUB = resolve(ROOT, "apps/hub");

const CHAMPS = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "VITE_FIREBASE_APP_ID",
};

/** Lecture minimale d'un fichier .env (CLE=valeur, # commentaires). */
function lireEnv(chemin) {
  if (!existsSync(chemin)) return {};
  const vars = {};
  for (const ligne of readFileSync(chemin, "utf8").split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    vars[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return vars;
}

if (!existsSync(SRC)) {
  console.warn(`[copy-display] source absent: ${SRC} — skipping`);
  process.exit(0);
}

// Même ordre de priorité que Vite en build : .env < .env.local < .env.production
// < .env.production.local < variables d'environnement du processus.
const env = {
  ...lireEnv(resolve(HUB, ".env")),
  ...lireEnv(resolve(HUB, ".env.local")),
  ...lireEnv(resolve(HUB, ".env.production")),
  ...lireEnv(resolve(HUB, ".env.production.local")),
};
for (const cle of Object.values(CHAMPS)) {
  if (process.env[cle]) env[cle] = process.env[cle];
}

const config = {};
const manquants = [];
for (const [champ, cle] of Object.entries(CHAMPS)) {
  if (env[cle]) config[champ] = env[cle];
  else manquants.push(cle);
}
if (manquants.length > 0) {
  console.error(
    `[copy-display] config Firebase incomplète pour l'iPad, manquent : ${manquants.join(", ")}.\n` +
      "  → Renseigne-les dans apps/hub/.env.local (voir ONBOARDING.md § 6.4).",
  );
  process.exit(1);
}

mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true });

// ES5 strict : le fichier est lu par Safari 9 (iPad mini 1, iOS 9.3.6).
const contenu =
  "/* Généré par scripts/copy-display-into-hub-dist.mjs depuis les VITE_FIREBASE_*\n" +
  "   du hub. Ne pas éditer : modifier apps/hub/.env.local puis rebuilder. */\n" +
  "window.__FIREBASE_CONFIG__ = " +
  JSON.stringify(config, null, 2) +
  ";\n";
mkdirSync(resolve(DEST, "js"), { recursive: true });
writeFileSync(resolve(DEST, "js/firebase-config.js"), contenu);

console.log(`[copy-display] copied ${SRC} -> ${DEST} (+ js/firebase-config.js pour ${config.projectId})`);
