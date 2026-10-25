// Génère les icônes de l'application installable du hub (téléphone) :
//   apps/hub/public/icons/icon-192.png, icon-512.png (manifest)
//   apps/hub/public/icons/apple-touch-icon.png (180, écran d'accueil iOS)
// Fond #EEF4EA (« fond jour ») avec un carré arrondi sombre #1E2B22 centré.
// Le carré occupe 50 % du côté : il reste dans la zone sûre des icônes
// « maskable » (cercle central de 80 %). Rendu déterministe, sans dépendance
// (encodeur PNG maison : scripts/lib/png.mjs).
//
// Usage : node scripts/generate-hub-icons.mjs   (les PNG produits sont versionnés)
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { encoderPng } from "./lib/png.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOSSIER = resolve(__dirname, "../apps/hub/public/icons");

const FOND = [0xee, 0xf4, 0xea]; // #EEF4EA
const CARRE = [0x1e, 0x2b, 0x22]; // #1E2B22

function icone(taille) {
  const cote = taille * 0.5;
  const debut = (taille - cote) / 2;
  const fin = debut + cote;
  const rayon = cote * 0.2;
  return encoderPng(taille, taille, (x, y) => {
    // Centre du pixel, pour un rendu symétrique.
    const px = x + 0.5;
    const py = y + 0.5;
    if (px < debut || px >= fin || py < debut || py >= fin) return FOND;
    // Coins arrondis : distance au centre du quart de cercle le plus proche.
    const cx = Math.min(Math.max(px, debut + rayon), fin - rayon);
    const cy = Math.min(Math.max(py, debut + rayon), fin - rayon);
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= rayon * rayon ? CARRE : FOND;
  });
}

mkdirSync(DOSSIER, { recursive: true });
for (const [nom, taille] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  const png = icone(taille);
  const chemin = resolve(DOSSIER, nom);
  writeFileSync(chemin, png);
  console.log(`[icon] ${chemin} (${png.length} octets, ${taille}×${taille})`);
}
