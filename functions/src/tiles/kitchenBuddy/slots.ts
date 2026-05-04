/**
 * Cloud Functions sur les slots individuels (Kitchen Buddy Phase 3.3).
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
import { db } from "../../lib/admin";
import { assertHouseholdMember } from "../../lib/household";
import type { SlotStatut } from "../../types";

interface SlotActionInput {
  householdId: string;
  planId: string;
  slotId: string;
}

export const acceptSlot = onCall<SlotActionInput, Promise<{ success: true }>>(
  { region: "europe-west1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");
    const { householdId, planId, slotId } = req.data;
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
    const { householdId, planId, slotId } = req.data;
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
    const { householdId, planId, slotId, profilIds } = req.data;
    await assertHouseholdMember(uid, householdId);

    if (!Array.isArray(profilIds)) {
      throw new HttpsError("invalid-argument", "profilIds doit être un tableau");
    }
    const slotRef = db.doc(
      `households/${householdId}/mealPlans/${planId}/slots/${slotId}`,
    );
    await slotRef.update({ profilsPresents: profilIds });
    return { success: true };
  },
);
