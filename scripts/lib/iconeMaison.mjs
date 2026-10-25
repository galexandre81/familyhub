// Dessin de l'icône Family Hub (téléphone et iPad) : une maison claire avec
// une fenêtre allumée ambre, sur le bleu nuit de l'ambiance « Veillée »
// (packages/design/src/tokens.ts : fond nuit #0F1B2D, texte nuit #F2F5F8,
// « maintenant » nuit #FFB547). Le fond couvre toute l'icône (Android découpe
// en rond ou en carré arrondi, iOS arrondit les coins) ; la maison tient dans
// le cercle central de 80 % (zone sûre des icônes « maskable »).
//
// Rendu déterministe : coordonnées dans [0, 1], 4 × 4 échantillons par pixel
// pour lisser les bords. Renvoie une fonction (x, y) → [r, v, b] pour
// encoderPng (scripts/lib/png.mjs).

const FOND = [0x0f, 0x1b, 0x2d]; // #0F1B2D
const MAISON = [0xf2, 0xf5, 0xf8]; // #F2F5F8
const FENETRE = [0xff, 0xb5, 0x47]; // #FFB547

/** Point dans un rectangle à coins arrondis [x0, x1] × [y0, y1], rayon r. */
function dansRect(px, py, x0, y0, x1, y1, r = 0) {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  const cx = Math.min(Math.max(px, x0 + r), x1 - r);
  const cy = Math.min(Math.max(py, y0 + r), y1 - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

/** Point dans le triangle du toit (sommet en haut, base horizontale). */
function dansToit(px, py) {
  const sommetX = 0.5;
  const sommetY = 0.22;
  const baseY = 0.5;
  const demiBase = 0.29;
  if (py < sommetY || py > baseY) return false;
  const t = (py - sommetY) / (baseY - sommetY);
  return Math.abs(px - sommetX) <= demiBase * t;
}

/** Couleur au point (u, v) de l'icône, u et v dans [0, 1]. */
function couleur(u, v) {
  // Fenêtre allumée (4 carreaux : croisillon couleur maison).
  const fx0 = 0.415;
  const fx1 = 0.585;
  const fy0 = 0.545;
  const fy1 = 0.715;
  if (dansRect(u, v, fx0, fy0, fx1, fy1, 0.018)) {
    const croisillon = Math.abs(u - 0.5) <= 0.011 || Math.abs(v - (fy0 + fy1) / 2) <= 0.011;
    return croisillon ? MAISON : FENETRE;
  }
  const maison =
    dansToit(u, v) ||
    dansRect(u, v, 0.27, 0.46, 0.73, 0.78, 0.03) || // corps
    dansRect(u, v, 0.615, 0.27, 0.675, 0.42, 0.008); // cheminée
  return maison ? MAISON : FOND;
}

const ECHANTILLONS = 4;

/** Fonction de pixel pour encoderPng, pour une icône de `taille` × `taille`. */
export function pixelIconeMaison(taille) {
  return (x, y) => {
    let r = 0;
    let v = 0;
    let b = 0;
    for (let i = 0; i < ECHANTILLONS; i++) {
      for (let j = 0; j < ECHANTILLONS; j++) {
        const c = couleur(
          (x + (i + 0.5) / ECHANTILLONS) / taille,
          (y + (j + 0.5) / ECHANTILLONS) / taille,
        );
        r += c[0];
        v += c[1];
        b += c[2];
      }
    }
    const n = ECHANTILLONS * ECHANTILLONS;
    return [Math.round(r / n), Math.round(v / n), Math.round(b / n)];
  };
}

/** Couleur de fond, pour le manifest (background_color de l'écran de lancement). */
export const FOND_ICONE = "#0F1B2D";
