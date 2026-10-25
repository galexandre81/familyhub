// Vérifie que le CSS de l'iPad (apps/display/public/css/*.css) n'utilise rien que
// Safari 9 (iPad mini 1, iOS 9.3.6) ignore en silence : variables CSS `var(`,
// `gap` / `row-gap` / `column-gap` (non supportés en flexbox avant Safari 14.1),
// grilles CSS `display: grid` / `inline-grid`. Rien ne casse visiblement : la règle
// est simplement sautée et la mise en page se dégrade sans message.
//
// Contrôle supplémentaire, par règle : pas de `display: flex` (ou inline-flex)
// sur un <button>. Safari < 11 ne sait pas faire d'un bouton un conteneur flex
// (flexbugs #9) : la mise en page du contenu passe par un <span> intérieur.
// Le CSS seul ne dit pas quelles classes finissent sur un bouton ; on s'appuie
// donc sur une convention : sélecteur `button` ou classe contenant le mot
// « btn » (ex. `.fh-min-btn`, `.tile-timer-preset-btn`). Heuristique : une
// classe de bouton nommée autrement passe entre les mailles.
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

// Dette connue, antérieure à la règle (radio, assistant du livre de recettes) :
// à corriger en passant leur contenu dans un <span> intérieur, puis à retirer d'ici.
const BOUTONS_FLEX_TOLERES = new Set([".tile-radio-compact-btn", ".wiz-icon-btn"]);
const RE_FLEX = /(^|[;{\s])display\s*:\s*(-webkit-)?(inline-)?flex\b/;

/** Dernier composé d'un sélecteur simple (celui qui reçoit le style). */
function sujet(selecteur) {
  const morceaux = selecteur.trim().split(/\s*[>+~]\s*|\s+/);
  return morceaux[morceaux.length - 1].replace(/::?[\w-]+(\([^)]*\))?/g, "");
}
function estBouton(compose) {
  return /^button\b/i.test(compose) || /\.(?:[\w]+-)*btn(?:-[\w]+)*(?![\w-])/.test(compose);
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
  // Par règle (les règles internes d'un @media sont lues aussi).
  const texte = lignes.join("\n");
  const reRegle = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = reRegle.exec(texte)) !== null) {
    if (!RE_FLEX.test(m[2])) continue;
    const ligne = texte.slice(0, m.index + m[0].indexOf("{")).split("\n").length;
    for (const sel of m[1].split(",")) {
      const s = sel.trim();
      if (!s || BOUTONS_FLEX_TOLERES.has(s)) continue;
      if (estBouton(sujet(s))) {
        erreurs.push(`${relative(ROOT, chemin)}:${ligne} — \`display: flex\` sur un bouton (\`${s}\`) : Safari 9 ne fait pas d'un <button> un conteneur flex, utiliser un <span> intérieur`);
      }
    }
  }
}

if (erreurs.length > 0) {
  console.error(`[css] ${erreurs.length} règle(s) CSS que Safari 9 (iPad) ignore :`);
  for (const e of erreurs) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`[css] OK — ${fichiers.length} fichier(s) CSS de l'iPad sans var(, gap, grid ni flex sur un bouton.`);
