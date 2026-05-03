export interface ShoppingListConfig {
  /** "rayon" = groupé par rayon ; "ordre-saisie" = ordre d'ajout. */
  groupage: "rayon" | "ordre-saisie";
  masquerCoches: boolean;
}

export const defaultShoppingListConfig: ShoppingListConfig = {
  groupage: "rayon",
  masquerCoches: false,
};
