import type { Timestamp } from "./common";
import type { RayonCourses } from "./recette";

/**
 * Liste de courses associée à un plan actif (1-1 avec `MealPlan`).
 * Stockée à `households/{hid}/shoppingLists/{listId}`.
 *
 * Items dénormalisés en array dans le doc pour atomicité au cochage
 * et simplicité de manipulation. Volume attendu : ~30-60 items par
 * semaine, bien dans les limites Firestore.
 */
export interface ShoppingList {
  planId: string;
  items: ShoppingListItem[];
  /** Timestamp du dernier "Envoyer aux courses" via Web Share. */
  lastSharedAt?: Timestamp;
  /** Libellé app cible, ex: "partage natif", "Google Keep". */
  lastSharedTo?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Un item de la liste de courses. ID local au tableau (pas un doc
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
