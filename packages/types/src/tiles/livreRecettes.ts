export interface LivreRecettesConfig {
  /** Filtre sur les tags des recettes (ex: ["végétarien"]). Vide = toutes. */
  filtreTags: string[];
  tri: "alpha" | "recente" | "notation";
}

export interface LivreRecettesEntree {
  recetteId: string;
  nom: string;
  tags: string[];
  notation?: 1 | 2 | 3 | 4 | 5;
  tempsTotalMinutes: number;
  difficulte: 1 | 2 | 3;
}

/**
 * Snapshot rebuild à chaque markFavorite ou modification de recette favorite.
 */
export interface LivreRecettesData {
  recettes: LivreRecettesEntree[];
}

export const defaultLivreRecettesConfig: LivreRecettesConfig = {
  filtreTags: [],
  tri: "recente",
};
