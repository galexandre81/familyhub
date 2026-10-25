import { describe, expect, it } from "vitest";
import type { RecetteIngredient } from "@family-hub/types";
import { ingredientsParRayon } from "./ficheRecette";

function ing(libelle: string, rayon: string | undefined): RecetteIngredient {
  return { libelle, quantite: "1", unite: "", rayon } as unknown as RecetteIngredient;
}

describe("ingredientsParRayon", () => {
  it("range les rayons dans l'ordre du magasin et garde l'ordre de la recette", () => {
    const groupes = ingredientsParRayon([
      ing("sel", "sec-epicerie"),
      ing("tomate", "frais-fruits-legumes"),
      ing("poivre", "sec-epicerie"),
    ]);
    expect(groupes.map((g) => g.libelle)).toEqual(["Fruits & légumes", "Épicerie"]);
    expect(groupes[1].items.map((i) => i.libelle)).toEqual(["sel", "poivre"]);
  });

  it("met les rayons absents ou inconnus dans « Autre » au lieu de les perdre", () => {
    const groupes = ingredientsParRayon([
      ing("truc", undefined),
      ing("machin", "rayon-inconnu"),
      ing("bidule", "autre"),
      ing("oeuf", "frais-laitier"),
    ]);
    expect(groupes.map((g) => g.rayon)).toEqual(["frais-laitier", "autre"]);
    expect(groupes[1].items.map((i) => i.libelle)).toEqual(["truc", "machin", "bidule"]);
  });

  it("liste vide → aucun groupe", () => {
    expect(ingredientsParRayon([])).toEqual([]);
  });
});
