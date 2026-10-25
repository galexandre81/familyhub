// Génère les icônes de l'application installable du hub (téléphone) :
//   apps/hub/public/icons/icon-192.png, icon-512.png (manifest)
//   apps/hub/public/icons/apple-touch-icon.png (180, écran d'accueil iOS)
// Dessin commun avec l'iPad : scripts/lib/iconeMaison.mjs (maison et fenêtre
// allumée sur bleu nuit, zone sûre « maskable » respectée). Rendu
// déterministe, sans dépendance (encodeur PNG maison : scripts/lib/png.mjs).
//
// Usage : node scripts/generate-hub-icons.mjs   (les PNG produits sont versionnés)
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { encoderPng } from "./lib/png.mjs";
import { pixelIconeMaison } from "./lib/iconeMaison.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOSSIER = resolve(__dirname, "../apps/hub/public/icons");

mkdirSync(DOSSIER, { recursive: true });
for (const [nom, taille] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  const png = encoderPng(taille, taille, pixelIconeMaison(taille));
  const chemin = resolve(DOSSIER, nom);
  writeFileSync(chemin, png);
  console.log(`[icon] ${chemin} (${png.length} octets, ${taille}×${taille})`);
}
