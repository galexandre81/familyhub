import type { Timestamp } from "../common";

export type RayonCourses =
  | "frais-fruits-legumes"
  | "frais-laitier"
  | "frais-boucherie"
  | "frais-poissonnerie"
  | "sec-epicerie"
  | "surgele"
  | "boulangerie"
  | "autre";

export interface RecetteIngredient {
  libelle: string;
  /** String pour gérer "qsp", "1 botte", "2", etc. */
  quantite: string;
  unite: string;
  rayon: RayonCourses;
}

export interface RecetteEtape {
  ordre: number;
  description: string;
  /** Si > 0 : déclenche le bouton "+ timer" en mode cuisine. */
  dureeMinutes?: number;
}

export type RecetteDifficulte = 1 | 2 | 3;
export type RecetteSaison = "hiver" | "printemps" | "ete" | "automne" | "toutes";
export type RecetteStatut = "draft" | "accepted" | "favorite";
export type RecetteOrigine = "llm" | "manuelle" | "import" | "seed";

export interface Recette {
  nom: string;
  description?: string;
  /** Pour combien de personnes la recette est calibrée. */
  portions: number;
  tempsPrepMinutes: number;
  tempsCuissonMinutes: number;
  difficulte: RecetteDifficulte;
  ingredients: RecetteIngredient[];
  etapes: RecetteEtape[];
  tags: string[];
  saison: RecetteSaison[];
  /** True si recette pensée pour batch cooking. */
  estBatch: boolean;
  statut: RecetteStatut;
  /** Notation post-repas (1-5 étoiles). */
  notation?: 1 | 2 | 3 | 4 | 5;
  /** Commentaire libre ajouté à la main par l'utilisateur. */
  notesUtilisateur?: string;
  origine: {
    /** Plan où la recette a été proposée pour la première fois. */
    planId?: string;
    slotId?: string;
    genereePar: RecetteOrigine;
    /** Modèle LLM si genereePar === "llm" ou "seed", ex: "gemini-2.0-flash". */
    llmModel?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
