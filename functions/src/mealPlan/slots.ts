/**
 * Cloud Functions sur les slots individuels (Phase 3).
 *
 * - acceptSlot : statut "propose" → "accepte"
 * - refuseSlot : statut → "vide" + retire les recettes
 * - updateSlotPresence : modifie qui mange à ce repas
 *
 * `regenerateSlot` (régénération via LLM) a été retirée avec le pivot
 * vers human-in-the-loop Claude.ai. La régénération d'un slot passera
 * par export `.md` mini → Claude.ai → import JSON dans une phase ultérieure.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../lib/admin";
import { assertHouseholdMember } from "../lib/household";
import { requireId, requireIdArray } from "../lib/validate";
import type { SlotStatut } from "../types";

/** Borne du nombre de profils présents à un repas. */
const MAX_PROFILS_PAR_SLOT = 50;

interface SlotActionInput {
  householdId: string;
  planId: string;
  slotId: string;
}

/** Valide les trois ids communs à toutes les actions sur un slot. */
function lireSlotInput(data: unknown): SlotActionInput {
  const input = (data ?? {}) as Partial<Record<keyof SlotActionInput, unknown>>;
  return {
    householdId: requireId(input.householdId, "householdId"),
    planId: requireId(input.planId, "planId"),
    slotId: requireId(input.slotId, "slotId"),
  };
}

export const acceptSlot = onCall<SlotActionInput, Promise<{ success: true }>>(
  { region: "europe-west1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");
    const { householdId, planId, slotId } = lireSlotInput(req.data);
    await assertHouseholdMember(uid, householdId);

    const slotRef = db.doc(
      `households/${householdId}/mealPlans/${planId}/slots/${slotId}`,
    );
    const snap = await slotRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Slot introuvable");
    if (snap.data()?.statut !== "propose") {
      throw new HttpsError(
        "failed-precondition",
        "Seul un slot en statut 'propose' peut être accepté",
      );
    }
    await slotRef.update({ statut: "accepte" as SlotStatut });
    return { success: true };
  },
);

export const refuseSlot = onCall<SlotActionInput, Promise<{ success: true }>>(
  { region: "europe-west1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");
    const { householdId, planId, slotId } = lireSlotInput(req.data);
    await assertHouseholdMember(uid, householdId);

    const slotRef = db.doc(
      `households/${householdId}/mealPlans/${planId}/slots/${slotId}`,
    );
    await slotRef.update({
      statut: "vide" as SlotStatut,
      recetteIds: [],
      batchSourceSlotId: FieldValue.delete(),
    });
    return { success: true };
  },
);

interface UpdatePresenceInput {
  householdId: string;
  planId: string;
  slotId: string;
  profilIds: string[];
}

export const updateSlotPresence = onCall<UpdatePresenceInput, Promise<{ success: true }>>(
  { region: "europe-west1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");
    const { householdId, planId, slotId } = lireSlotInput(req.data);
    const profilIds = requireIdArray(
      (req.data as Partial<UpdatePresenceInput> | null)?.profilIds,
      "profilIds",
      MAX_PROFILS_PAR_SLOT,
    );
    await assertHouseholdMember(uid, householdId);
    const slotRef = db.doc(
      `households/${householdId}/mealPlans/${planId}/slots/${slotId}`,
    );
    await slotRef.update({ profilsPresents: profilIds });
    return { success: true };
  },
);
