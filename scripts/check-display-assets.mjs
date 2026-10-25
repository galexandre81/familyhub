// Vérifie que chaque fichier référencé (src= / href=) par les pages de l'iPad
// (index.html, setup.html) existe bien dans apps/display/public. Sans ce contrôle,
// un fichier manquant passe inaperçu : Firebase Hosting réécrit tout chemin
// /display/** inconnu vers display/index.html, donc le navigateur reçoit du HTML
// à la place du JS et la tuile ne se charge pas, sans erreur 404.
//
// - La partie ?v=… / #… est ignorée.
// - Les liens externes (http:, https:, //, data:, mailto:, #) sont ignorés.
// - Les chemins absolus /display/… sont rapportés à apps/display/public ; les
//   autres chemins absolus (hors iPad) sont ignorés ; un dossier vaut son index.html.
// - js/firebase-config.js est généré au build (copy-display-into-hub-dist.mjs).
//
// Usage : node scripts/check-display-assets.mjs [dossier]  (défaut : apps/display/public)
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = resolve(process.argv[2] || resolve(ROOT, "apps/display/public"));
const PAGES = ["index.html", "setup.html"];
const GENERES = new Set(["js/firebase-config.js"]);

const erreurs = [];
let verifies = 0;

for (const page of PAGES) {
  const chemin = resolve(SRC, page);
  if (!existsSync(chemin)) {
    erreurs.push(`${relative(ROOT, chemin)} — page absente`);
    continue;
  }
  const lignes = readFileSync(chemin, "utf8").split("\n");
  lignes.forEach((ligne, i) => {
    const re = /\b(?:src|href)\s*=\s*["']([^"']*)["']/gi;
    let m;
    while ((m = re.exec(ligne)) !== null) {
      let url = m[1].split("#")[0].split("?")[0];
      if (!url || /^([a-z]+:|\/\/)/i.test(url)) continue;
      if (url.startsWith("/")) {
        if (!url.startsWith("/display/")) continue;
        url = url.slice("/display/".length);
      }
      // Lien vers un dossier (ex. /display/) : c'est son index.html qui est servi.
      if (url === "" || url.endsWith("/")) url += "index.html";
      if (GENERES.has(url)) continue;
      verifies++;
      const cible = resolve(SRC, url);
      if (!existsSync(cible) || !statSync(cible).isFile()) {
        erreurs.push(`${relative(ROOT, chemin)}:${i + 1} — fichier introuvable : ${m[1]}`);
      }
    }
  });
}

if (erreurs.length > 0) {
  console.error(`[assets] ${erreurs.length} fichier(s) référencé(s) par les pages de l'iPad introuvable(s) :`);
  for (const e of erreurs) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`[assets] OK — ${verifies} référence(s) vérifiée(s) dans ${PAGES.join(", ")}.`);
