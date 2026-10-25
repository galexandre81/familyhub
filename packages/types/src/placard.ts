import { normaliserNom } from "./texte";

/** Produits qu'on a en général à la maison (liste par défaut, modifiable dans les paramètres). */
export const PLACARD_DEFAUT: string[] = [
  "sel",
  "poivre",
  "farine",
  "sucre",
  "sucre glace",
  "huile",
  "huile d'olive",
  "vinaigre",
  "moutarde",
  "levure chimique",
  "bicarbonate",
  "bouillon",
  "cube",
  "épices",
  "herbes de Provence",
  "paprika",
  "cumin",
  "curry",
  "piment d'Espelette",
  "cannelle",
  "muscade",
  "sauce soja",
  "miel",
  "maïzena",
];

/** Mots normalisés ; apostrophes et traits d'union séparent les mots (« d'olive » → « d olive »). */
function mots(texte: string): string[] {
  return normaliserNom(texte)
    .replace(/['’`\-‐‑]+/g, " ")
    .split(/\s+/)
    .filter((m) => m.length > 0);
}

/**
 * Vrai si le nom commence, mot entier par mot entier, par une entrée de la
 * liste (« Huile d'olive vierge » ✓ pour « huile d'olive », « selle d'agneau »
 * ✗ pour « sel », « poivrons rouges » ✗ pour « poivre »).
 */
export function estProduitPlacard(nom: string, placard: string[] = PLACARD_DEFAUT): boolean {
  const mn = mots(nom);
  if (mn.length === 0) return false;
  return placard.some((entree) => {
    const me = mots(entree);
    return me.length > 0 && me.length <= mn.length && me.every((m, i) => m === mn[i]);
  });
}
