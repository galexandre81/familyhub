// Génère apps/display/public/icons/icon-180.png : icône « écran d'accueil » de l'iPad
// (apple-touch-icon + manifest.json). 180×180, même dessin que le téléphone
// (scripts/lib/iconeMaison.mjs). Encodeur PNG maison : scripts/lib/png.mjs.
//
// Usage : node scripts/generate-display-icon.mjs   (le PNG produit est versionné)
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { encoderPng } from "./lib/png.mjs";
import { pixelIconeMaison } from "./lib/iconeMaison.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../apps/display/public/icons/icon-180.png");

const TAILLE = 180;
const png = encoderPng(TAILLE, TAILLE, pixelIconeMaison(TAILLE));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`[icon] ${OUT} (${png.length} octets, ${TAILLE}×${TAILLE})`);
