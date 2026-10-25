/**
 * Onglet « iPad de cuisine » (PC) — logique pure : quel écran du foyer est
 * l'iPad de cuisine, état de son appairage, écrans d'avant à supprimer.
 */
import { versMs } from "./minuteurs";

interface EcranLu {
  id: string;
  type: string;
  authToken?: string;
  authTokenExpiresAt?: unknown;
  updatedAt?: unknown;
}

const TYPES_TABLETTE = ["ipad-mini-1", "modern-tablet"];

/** L'iPad de cuisine : la tablette modifiée le plus récemment ; null s'il n'y en a pas. */
export function choisirIpad<E extends EcranLu>(ecrans: E[]): E | null {
  const tablettes = ecrans.filter((e) => TYPES_TABLETTE.includes(e.type));
  if (tablettes.length === 0) return null;
  return tablettes.reduce((a, b) => ((versMs(b.updatedAt) ?? 0) > (versMs(a.updatedAt) ?? 0) ? b : a));
}

/** Les autres écrans (téléphones et PC appairés avant la refonte) : à supprimer. */
export function autresEcrans<E extends EcranLu>(ecrans: E[], ipad: E | null): E[] {
  return ecrans.filter((e) => e.id !== ipad?.id);
}

export type EtatAppairage =
  | { etat: "jamais" }
  | { etat: "appaire"; jusquau: number | null }
  | { etat: "expire"; depuis: number };

/** Appairé (jusqu'à quand), expiré (depuis quand) ou jamais appairé. */
export function etatAppairage(e: EcranLu, nowMs: number): EtatAppairage {
  if (!e.authToken) return { etat: "jamais" };
  const fin = versMs(e.authTokenExpiresAt);
  if (fin !== null && fin <= nowMs) return { etat: "expire", depuis: fin };
  return { etat: "appaire", jusquau: fin };
}
