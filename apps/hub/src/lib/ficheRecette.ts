/**
 * Fiche d'une recette (livre de recettes) : ingrédients rangés par rayon.
 */
import type { RecetteIngredient } from "@family-hub/types";

export const LIBELLES_RAYON: Record<string, string> = {
  "frais-fruits-legumes": "Fruits & légumes",
  "frais-laitier": "Crèmerie",
  "frais-boucherie": "Boucherie",
  "frais-poissonnerie": "Poissonnerie",
  "sec-epicerie": "Épicerie",
  surgele: "Surgelé",
  boulangerie: "Boulangerie",
  autre: "Autre",
};

/** Ordre de la promenade en magasin. */
export const ORDRE_RAYONS = [
  "frais-fruits-legumes",
  "frais-boucherie",
  "frais-poissonnerie",
  "frais-laitier",
  "boulangerie",
  "sec-epicerie",
  "surgele",
  "autre",
];

export interface GroupeRayon {
  rayon: string;
  libelle: string;
  items: RecetteIngredient[];
}

/**
 * Regroupe les ingrédients par rayon, dans l'ordre du magasin. Un ingrédient
 * sans rayon ou d'un rayon inconnu (recette importée) va dans « Autre » :
 * aucun ingrédient ne disparaît de la fiche. L'ordre de la recette est gardé
 * à l'intérieur de chaque rayon.
 */
export function ingredientsParRayon(ingredients: readonly RecetteIngredient[]): GroupeRayon[] {
  const groupes = new Map<string, RecetteIngredient[]>();
  for (const ing of ingredients) {
    const rayon = ing.rayon && LIBELLES_RAYON[ing.rayon] ? ing.rayon : "autre";
    const liste = groupes.get(rayon) ?? [];
    liste.push(ing);
    groupes.set(rayon, liste);
  }
  return ORDRE_RAYONS.filter((r) => groupes.has(r)).map((rayon) => ({
    rayon,
    libelle: LIBELLES_RAYON[rayon],
    items: groupes.get(rayon)!,
  }));
}
