// Copie les woff (latin + latin-ext, pour « œ ») de @fontsource vers l'iPad.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const dest = resolve(racine, "apps/display/public/fonts");
mkdirSync(dest, { recursive: true });
const polices = [
  ["bricolage-grotesque", [500, 700, 800]],
  ["atkinson-hyperlegible", [400, 700]],
];
for (const [nom, poids] of polices) {
  for (const p of poids) {
    for (const sous of ["latin", "latin-ext"]) {
      const f = `${nom}-${sous}-${p}-normal.woff`;
      const src = resolve(racine, "node_modules/@fontsource", nom, "files", f);
      if (!existsSync(src)) throw new Error("police introuvable : " + src);
      copyFileSync(src, resolve(dest, f));
    }
  }
}
console.log("polices copiées dans", dest);
