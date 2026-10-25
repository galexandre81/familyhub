/**
 * Règles pures d'une invitation dans un foyer (aucun import admin : testable
 * sans émulateur). `acceptInvitation` les applique dans sa transaction.
 */

// Copie de `RoleFoyer` (packages/types/src/household.ts) : les Functions ne
// dépendent pas des workspaces (cf. functions/src/types.ts). Garder alignés.
export type RoleFoyer = "parent" | "enfant";

/** Doc `invitations/{code}` tel que lu par l'Admin SDK. */
export interface InvitationDoc {
  householdId: string;
  createdBy: string;
  role: RoleFoyer;
  /** Timestamp Firestore (seul `toMillis` sert ici). */
  expiresAt: { toMillis(): number };
  usedBy?: string | null;
}

// Copie de `RaisonRefusInvitation` (packages/types/src/invitation.ts), aussi
// traduite côté hub (apps/hub/src/lib/invitations.ts). Garder alignés.
export type RaisonRefusInvitation = "introuvable" | "expiree" | "deja-utilisee" | "deja-membre";

export type VerdictInvitation = { ok: true } | { ok: false; raison: RaisonRefusInvitation };

/** Durée de validité d'un lien d'invitation. */
export const DUREE_INVITATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Dit si `uid` peut entrer dans le foyer avec cette invitation.
 * Ordre : introuvable, déjà membre (Marie qui rouvre son propre lien lit
 * « Tu fais déjà partie de ce foyer » plutôt que « déjà servi »), déjà
 * utilisée, expirée (`expiresAt` égal à maintenant = expirée).
 */
export function validerInvitation(
  inv: InvitationDoc | undefined,
  uid: string,
  membres: string[],
  nowMs: number,
): VerdictInvitation {
  if (!inv) return { ok: false, raison: "introuvable" };
  if (membres.includes(uid)) return { ok: false, raison: "deja-membre" };
  if (inv.usedBy) return { ok: false, raison: "deja-utilisee" };
  if (inv.expiresAt.toMillis() <= nowMs) return { ok: false, raison: "expiree" };
  return { ok: true };
}

/**
 * Carte `roles` complète après l'arrivée de `uid`. Un foyer créé avant les
 * rôles n'a pas de `roles` : ses membres existants (Alex) deviennent
 * parents — sinon `{marie: parent}` seul ferait perdre le statut de parent au
 * fondateur, et les règles interdisent au client de réparer `roles`.
 */
export function rolesApresArrivee(
  roles: Record<string, RoleFoyer> | undefined,
  membres: string[],
  uid: string,
  role: RoleFoyer,
): Record<string, RoleFoyer> {
  const valide = typeof roles === "object" && roles !== null && !Array.isArray(roles);
  const out: Record<string, RoleFoyer> = {};
  if (valide) {
    Object.assign(out, roles);
  } else {
    for (const m of membres) out[m] = "parent";
  }
  out[uid] = role;
  return out;
}
