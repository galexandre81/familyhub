import type { Timestamp } from "./common";
import type { RayonCourses } from "./recette";

/**
 * Liste de courses associée à un plan actif (1-1 avec `MealPlan`).
 * Stockée à `households/{hid}/shoppingLists/{listId}`.
 *
 * Format 2 (`format: 2`) : un document par article dans la sous-collection
 * `items` (voir `ArticleCourses`) — deux téléphones qui cochent des articles
 * différents hors ligne ne s'écrasent plus. L'ancien format gardait les
 * articles dans le tableau `items` du document ; il est migré à la première
 * ouverture (apps/hub/src/lib/useListeCourses.ts).
 */
export interface ShoppingList {
  planId: string;
  /** 2 = articles en sous-collection `items`. Absent = ancien format (tableau). */
  format?: 2;
  /**
   * @deprecated Ancien format : articles dans le tableau du document. Retiré
   * par la migration (`deleteField`) ; ne plus écrire.
   */
  items?: ShoppingListItem[];
  /** Timestamp du dernier "Envoyer aux courses" via Web Share. */
  lastSharedAt?: Timestamp;
  /** Libellé app cible, ex: "partage natif", "Google Keep". */
  lastSharedTo?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Où l'article sera acheté (ou s'il est déjà à la maison), choisi au tri. */
export type DestinationArticle = "a-trier" | "deja" | "drive" | "magasin";

/**
 * Un article de la liste de courses, format 2 : un document par article à
 * `households/{hid}/shoppingLists/{listId}/items/{itemId}`. Chaque action
 * (tri, coche) ne modifie que ses propres champs.
 */
export interface ArticleCourses {
  nom: string;
  quantite: number;
  unite: string;
  rayon: ShoppingListRayon | RayonCourses;
  /** Recettes d'origine. Vide si ajout manuel. */
  recetteIds: string[];
  /** True si ajouté à la main (oubli), hors du plan. */
  ajoutManuel: boolean;
  destination: DestinationArticle;
  /** Produit qu'on a en général à la maison : à vérifier au tri, jamais effacé. */
  placard: boolean;
  checked: boolean;
  checkedAt?: Timestamp | null;
  /** uid du compte qui a coché. */
  checkedBy?: string | null;
  /** Position d'origine (import) ; les oublis prennent max + 1. */
  ordre: number;
  createdAt?: Timestamp;
}

/**
 * Ancien format : un item de la liste de courses. ID local au tableau (pas un doc
 * Firestore), généré côté client à l'import ou à l'ajout manuel.
 */
export interface ShoppingListItem {
  id: string;
  nom: string;
  /** Quantité numérique. Pour les "qsp" ou "1 botte" → quantité = 1, unité descriptive. */
  quantite: number;
  unite: string;
  rayon: RayonCourses | ShoppingListRayon;
  /** Recettes d'origine (info traçabilité). Vide si ajout manuel. */
  recetteIds: string[];
  checked: boolean;
  checkedAt?: Timestamp;
  /** profilId ou uid de qui a coché. */
  checkedBy?: string;
  /** True si ajouté à la main hors du plan. */
  ajoutManuel: boolean;
}

/**
 * Rayons utilisés par le format d'import Claude.ai (cf. brief §3.2).
 * Différent de `RayonCourses` legacy mais coexistent — l'UI mappe
 * vers un libellé via `rayonLabel()`.
 */
export type ShoppingListRayon =
  | "fruits-legumes"
  | "boucherie"
  | "poissonnerie"
  | "cremerie"
  | "epicerie"
  | "surgeles"
  | "boulangerie"
  | "boissons"
  | "autres";
