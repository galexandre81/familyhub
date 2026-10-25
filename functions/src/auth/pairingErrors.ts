/**
 * Erreurs DÉFINITIVES de refreshDisplayToken : l'écran doit être reconfiguré,
 * retenter ne changera rien. Elles portent `details.reason` ; l'iPad ne se
 * fie qu'à ce marqueur, jamais au seul code : le SDK callable v8 produit lui-même
 * deadline-exceeded (timeout 70 s), permission-denied (HTTP 403) et not-found
 * (HTTP 404) sur une coupure réseau ou un incident de déploiement.
 * Liste à garder identique à PAIRING_REASONS dans apps/display/public/js/core.js.
 */
export const RAISONS_APPAIRAGE = ["deleted", "revoked", "token-mismatch", "expired"] as const;
export type RaisonAppairage = (typeof RAISONS_APPAIRAGE)[number];

export interface ErreurAppairage {
  code: "not-found" | "permission-denied" | "failed-precondition";
  message: string;
  reason: RaisonAppairage;
}

export function erreurAppairage(reason: RaisonAppairage): ErreurAppairage {
  switch (reason) {
    case "deleted":
      return { code: "not-found", message: "Display introuvable", reason };
    case "revoked":
      return { code: "permission-denied", message: "Cet écran a été révoqué", reason };
    case "token-mismatch":
      return { code: "permission-denied", message: "Token invalide", reason };
    case "expired":
      return {
        code: "failed-precondition",
        message: "Token expiré, reconfigurez le display",
        reason,
      };
  }
}
