// Vérifie que le CSS de l'iPad (apps/display/public/css/*.css) n'utilise rien que
// Safari 9 (iPad mini 1, iOS 9.3.6) ignore en silence : variables CSS `var(`,
// `gap` / `row-gap` / `column-gap` (non supportés en flexbox avant Safari 14.1),
// grilles CSS `display: grid` / `inline-grid`. Rien ne casse visiblement : la règle
// est simplement sautée et la mise en page se dégrade sans message.
//
// Usage : node scripts/check-display-css.mjs [dossier]  (défaut : apps/display/public/css)
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIR = resolve(process.argv[2] || resolve(ROOT, "apps/display/public/css"));

const REGLES = [
  { re: /var\(/, msg: "`var(` (variables CSS non supportées par Safari 9)" },
  { re: /(^|[;{\s])(row-gap|column-gap|gap)\s*:/, msg: "propriété `gap`/`row-gap`/`column-gap` (ignorée en flexbox par Safari 9)" },
  { re: /display\s*:\s*(inline-)?grid\b/, msg: "`display: grid` / `inline-grid` (grilles CSS non supportées par Safari 9)" },
];

/** Remplace les commentaires par des espaces en gardant les retours à la ligne. */
function sansCommentaires(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
}

const erreurs = [];
const fichiers = readdirSync(DIR).filter((n) => n.endsWith(".css"));
for (const nom of fichiers) {
  const chemin = join(DIR, nom);
  const lignes = sansCommentaires(readFileSync(chemin, "utf8")).split("\n");
  lignes.forEach((ligne, i) => {
    for (const r of REGLES) {
      if (r.re.test(ligne)) erreurs.push(`${relative(ROOT, chemin)}:${i + 1} — ${r.msg}`);
    }
  });
}

if (erreurs.length > 0) {
  console.error(`[css] ${erreurs.length} règle(s) CSS que Safari 9 (iPad) ignore :`);
  for (const e of erreurs) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`[css] OK — ${fichiers.length} fichier(s) CSS de l'iPad sans var(, gap ni grid.`);
