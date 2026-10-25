// Génère apps/display/public/icons/icon-180.png : icône « écran d'accueil » de l'iPad
// (apple-touch-icon + manifest.json). 180×180, fond #EEF4EA (« fond jour » du design
// system) avec un carré central plus sombre. Encodeur PNG maison : scripts/lib/png.mjs.
//
// Usage : node scripts/generate-display-icon.mjs   (le PNG produit est versionné)
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { encoderPng } from "./lib/png.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../apps/display/public/icons/icon-180.png");

const TAILLE = 180;
const FOND = [0xee, 0xf4, 0xea]; // #EEF4EA
const CARRE = [0x3e, 0x5c, 0x46]; // vert sombre, lisible sur le fond clair
const MARGE = 54; // carré central de 72×72

const png = encoderPng(TAILLE, TAILLE, (x, y) => {
  const dedans = x >= MARGE && x < TAILLE - MARGE && y >= MARGE && y < TAILLE - MARGE;
  return dedans ? CARRE : FOND;
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`[icon] ${OUT} (${png.length} octets, ${TAILLE}×${TAILLE})`);
