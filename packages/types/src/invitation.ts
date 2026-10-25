import type { Timestamp } from "./common";
import type { RoleFoyer } from "./household";

/**
 * `invitations/{code}` — lien d'invitation dans un foyer, à usage unique,
 * valable 7 jours. Lu et écrit uniquement par les Functions
 * (`createInvitation`, `acceptInvitation`).
 */
export interface Invitation {
  householdId: string;
  createdBy: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  role: RoleFoyer;
  usedBy?: string;
  usedAt?: Timestamp;
}

/** Raisons de refus renvoyées par `acceptInvitation` (`details.raison`). */
export type RaisonRefusInvitation = "introuvable" | "expiree" | "deja-utilisee" | "deja-membre";
