import { HttpsError } from "firebase-functions/v2/https";

/**
 * Validation des entrées des callables.
 *
 * Un id venu de `req.data` finit dans un chemin Firestore : un « / » y
 * désignerait un autre document, un objet ou un nombre ferait planter le SDK
 * avec une erreur interne illisible. On refuse donc tôt, en `invalid-argument`.
 */
const MOTIF_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Rend `value` si c'est un id sûr pour un chemin Firestore, sinon `invalid-argument`. */
export function requireId(value: unknown, name: string): string {
  if (typeof value !== "string" || !MOTIF_ID.test(value)) {
    throw new HttpsError("invalid-argument", `${name} invalide ou manquant`);
  }
  return value;
}

/** Tableau d'ids borné (`max` éléments), chacun validé par `requireId`. */
export function requireIdArray(value: unknown, name: string, max: number): string[] {
  if (!Array.isArray(value)) {
    throw new HttpsError("invalid-argument", `${name} doit être un tableau`);
  }
  if (value.length > max) {
    throw new HttpsError("invalid-argument", `${name} limité à ${max} éléments`);
  }
  return value.map((v, i) => requireId(v, `${name}[${i}]`));
}

/** Objet simple (ni tableau ni null), sinon `invalid-argument`. */
export function requireObject(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", `${name} requis`);
  }
  return value as Record<string, unknown>;
}
