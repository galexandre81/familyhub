// Vérifie que tout le JavaScript de l'iPad (apps/display/public) est de l'ES5 strict,
// fichiers .js ET scripts inline des .html. L'écran tourne sur un iPad mini 1 bloqué
// en iOS 9.3.6 : une seule syntaxe plus récente (virgule finale dans un appel, `let`,
// fonction fléchée…) et Safari refuse le script ENTIER, sans rien afficher.
// C'est arrivé en juin 2026 : une virgule finale dans setup.html a cassé l'appairage.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";
import { parse } from "acorn";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "apps/display/public");

// Bibliothèques tierces déjà compilées pour les vieux navigateurs : non vérifiées.
const EXCLUS = [/[\\/]vendor[\\/]/, /\.min\.js$/];

function fichiers(dir) {
  const out = [];
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) out.push(...fichiers(chemin));
    else out.push(chemin);
  }
  return out;
}

const erreurs = [];
let verifies = 0;

function verifier(code, origine, decalageLigne) {
  verifies++;
  try {
    parse(code, { ecmaVersion: 5, sourceType: "script" });
  } catch (err) {
    const ligne = (err.loc?.line ?? 0) + decalageLigne;
    erreurs.push(`${origine}:${ligne} — ${err.message.replace(/\s*\(\d+:\d+\)$/, "")}`);
  }
}

for (const chemin of fichiers(SRC)) {
  if (EXCLUS.some((re) => re.test(chemin))) continue;
  const rel = relative(ROOT, chemin);
  if (chemin.endsWith(".js")) {
    verifier(readFileSync(chemin, "utf8"), rel, 0);
  } else if (chemin.endsWith(".html")) {
    const html = readFileSync(chemin, "utf8");
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      if (!m[1].trim()) continue;
      const ligneDebut = html.slice(0, m.index + m[0].indexOf(">") + 1).split("\n").length - 1;
      verifier(m[1], rel, ligneDebut);
    }
  }
}

if (erreurs.length > 0) {
  console.error(`[es5] ${erreurs.length} script(s) de l'iPad ne sont pas de l'ES5 (Safari 9 les refusera) :`);
  for (const e of erreurs) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`[es5] ${verifies} script(s) de l'iPad vérifiés : ES5 OK.`);
