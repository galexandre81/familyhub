/**
 * Foyer ouvert par le hub quand le compte en a plusieurs : celui de
 * `users/{uid}.defaultHouseholdId` s'il en fait bien partie, sinon le premier.
 * `useHouseholds` renvoie les foyers dans cet ordre : `useActiveHouseholdId`
 * (et les pages qui lisent `households[0]`) voient donc tous le même foyer.
 */
export function ordonnerFoyers<T extends { id: string }>(
  foyers: T[],
  defaultHouseholdId: string | null | undefined,
): T[] {
  const i = defaultHouseholdId ? foyers.findIndex((f) => f.id === defaultHouseholdId) : -1;
  if (i <= 0) return foyers;
  return [foyers[i], ...foyers.slice(0, i), ...foyers.slice(i + 1)];
}
