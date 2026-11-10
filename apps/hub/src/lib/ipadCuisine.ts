/**
 * Onglet « iPad de cuisine » (PC) — logique pure : quel écran du foyer est
 * l'iPad de cuisine, lequel est l'ordinateur des enfants, état d'un
 * appairage, écrans d'avant à supprimer.
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
/** Type d'écran de l'ordinateur des enfants (second écran de cuisine, lecture seule). */
export const TYPE_ORDINATEUR = "desktop";

function plusRecent<E extends EcranLu>(ecrans: E[]): E | null {
  if (ecrans.length === 0) return null;
  return ecrans.reduce((a, b) => ((versMs(b.updatedAt) ?? 0) > (versMs(a.updatedAt) ?? 0) ? b : a));
}

/** L'iPad de cuisine : la tablette modifiée le plus récemment ; null s'il n'y en a pas. */
export function choisirIpad<E extends EcranLu>(ecrans: E[]): E | null {
  return plusRecent(ecrans.filter((e) => TYPES_TABLETTE.includes(e.type)));
}

/** L'ordinateur des enfants : l'écran de type ordinateur modifié le plus récemment ; null s'il n'y en a pas. */
export function choisirOrdinateur<E extends EcranLu>(ecrans: E[]): E | null {
  return plusRecent(ecrans.filter((e) => e.type === TYPE_ORDINATEUR));
}

/** Les autres écrans (téléphones et PC appairés avant la refonte) : à supprimer. */
export function autresEcrans<E extends EcranLu>(ecrans: E[], ipad: E | null, ordinateur: E | null = null): E[] {
  return ecrans.filter((e) => e.id !== ipad?.id && e.id !== ordinateur?.id);
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
