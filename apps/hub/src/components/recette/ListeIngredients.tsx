/**
 * Ingrédients d'une recette, quantités ajustées au nombre de personnes
 * (mode recette, page batch cooking).
 */
import type { Recette } from "@family-hub/types";
import { quantiteAjustee } from "../../lib/repasCuisine";

export default function ListeIngredients({ recette, portions }: { recette: Recette; portions: number }) {
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
          <span className="min-w-0">{ing.libelle}</span>
        </li>
      ))}
    </ul>
  );
}
