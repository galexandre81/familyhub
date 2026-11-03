/**
 * Ingrédients d'une recette, quantités ajustées au nombre de personnes
 * (mode recette, page batch cooking).
 */
import type { Recette } from "@family-hub/types";
import { quantiteAjustee } from "../../lib/repasCuisine";
import { carteRemplacements, type RemplacementActif } from "../../lib/remplacements";
import NomIngredient from "./NomIngredient";

export default function ListeIngredients({
  recette,
  portions,
  remplacements = [],
}: {
  recette: Recette;
  portions: number;
  remplacements?: RemplacementActif[];
}) {
  const carte = carteRemplacements(recette.ingredients, remplacements);
  if (recette.ingredients.length === 0) {
    return <p className="text-base text-cream-mute">Aucun ingrédient indiqué.</p>;
  }
  return (
    <ul className="space-y-1">
      {recette.ingredients.map((ing, i) => (
        <li key={`${ing.libelle}-${i}`} className="flex gap-3 text-base leading-snug">
          <span className="shrink-0 min-w-20 text-right font-semibold tabular-nums">
            {quantiteAjustee(ing.quantite, recette.portions, portions)}
            {ing.unite ? ` ${ing.unite}` : ""}
          </span>
          <span className="min-w-0">
            <NomIngredient libelle={ing.libelle} remplacement={carte.get(ing.libelle)} />
          </span>
        </li>
      ))}
    </ul>
  );
}
