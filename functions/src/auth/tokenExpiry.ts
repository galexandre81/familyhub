/** Durée de vie de l'authToken d'un écran : 90 jours, glissante. */
export const AUTH_TOKEN_TTL_MS = 90 * 24 * 3600 * 1000;

/**
 * Nouvelle date d'expiration de l'authToken d'un écran, à partir de `nowMs`.
 * Appelée à chaque appairage et à chaque rafraîchissement réussi : un écran
 * allumé au moins une fois tous les 90 jours ne perd jamais son appairage.
 */
export function prochaineExpiration(nowMs: number): number {
  return nowMs + AUTH_TOKEN_TTL_MS;
}
