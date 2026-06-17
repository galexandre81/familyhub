/**
 * Bornes partagées pour le sélecteur de portions des recettes.
 * Utilisées par RecetteDetail (page) et RecetteDetailModal (modale /menu)
 * ainsi que pour clamper la valeur dérivée de l'URL (?portions=N).
 */
export const PORTIONS_MIN = 1;
export const PORTIONS_MAX = 30;

/** Clampe une valeur de portions dans [PORTIONS_MIN, PORTIONS_MAX]. */
export function clampPortions(n: number): number {
  return Math.min(PORTIONS_MAX, Math.max(PORTIONS_MIN, n));
}
