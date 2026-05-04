import type { Repas } from "../mealPlan";

export interface RecipeTodayConfig {
  showAccompagnements: boolean;
  /** "auto" = déduit du créneau horaire ; "manual" = bouton pour switch. */
  detectionRepas: "auto" | "manual";
}

/**
 * Une recette dénormalisée dans le snapshot, contenant tout ce dont
 * l'iPad a besoin pour afficher la tuile compacte ET le mode cuisine
 * plein écran sans aller chercher d'autres docs Firestore.
 */
export interface RecipeTodayRecette {
  recetteId: string;
  nom: string;
  description?: string;
  /** Portions de référence de la recette (telle qu'enregistrée). */
  portions: number;
  tempsPrepMinutes: number;
  tempsCuissonMinutes: number;
  tempsTotalMinutes: number;
  difficulte: number;
  ingredients: Array<{
    libelle: string;
    quantite: string;
    unite: string;
    rayon?: string;
    /** True = au frigo, ne sera pas en courses. */
    noteFrigo?: boolean;
  }>;
  etapes: Array<{
    ordre: number;
    description: string;
    /** Si > 0 : déclenche le bouton "+ timer X min" en mode cuisine. */
    dureeMinutes?: number;
  }>;
  tags: string[];
}

export interface RecipeTodayData {
  /**
   * "aucun" = pas de plan actif ou aucun slot trouvé.
   * Sinon : créneau du moment ("petitDej" entre 0h-10h, "dej" 10h-15h,
   * "diner" 15h-24h).
   */
  repasActif: Repas | "aucun";
  /** Libellé du repas, ex: "Ce midi", "Ce soir", "Demain matin". */
  repasLabel?: string;
  /** ISO date YYYY-MM-DD du slot affiché (peut être demain si aujourd'hui est fini). */
  date?: string;
  /** ID du slot Firestore (utile pour notation post-repas). */
  slotId?: string;
  /** True si on affiche un slot futur faute de slot du moment. */
  isFallbackToNext?: boolean;
  recettes: RecipeTodayRecette[];
  /** Profils présents au slot avec leurs infos visuelles. */
  profilsPresents: Array<{
    id: string;
    nom: string;
    initiale: string;
    couleur: string;
    emoji?: string;
  }>;
  /** Invités hors foyer (texte libre). */
  invitesNoms?: string[];
  /** "fresh" ou "batch". */
  source?: "fresh" | "batch";
  /** Notes libres du slot, ex: "pizzas commandées". */
  notes?: string;
  /** Timestamp ISO du calcul (debug). */
  generatedAtISO: string;
}

export const defaultRecipeTodayConfig: RecipeTodayConfig = {
  showAccompagnements: true,
  detectionRepas: "auto",
};
