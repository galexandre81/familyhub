/**
 * Cloud Functions sur les slots individuels (Kitchen Buddy Phase 3.3).
 *
 * - acceptSlot : statut "propose" → "accepte"
 * - refuseSlot : statut → "vide" + retire les recettes
 * - updateSlotPresence : modifie qui mange à ce repas
 * - regenerateSlot : régénère 1 seul slot via le LLM, en injectant le contexte
 *   du reste du plan pour cohérence (varietés, ingrédients déjà utilisés)
 *
 * Note : `regenerateSlot` n'utilise PAS `generateStructured` car on veut
 * 1 seule recette + contexte minimal (économie tokens). On envoie un sub-prompt
 * spécialisé.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../lib/admin";
import { assertHouseholdMember } from "../../lib/household";
import {
  GENERATE_MEAL_PLAN_SYSTEM_PROMPT,
  buildGenerateMealPlanUserPrompt,
  getProvider,
  mealPlanJSONSchema,
  parseMealPlanLLMOutput,
  type GenerateMealPlanContext,
} from "./llm";
import type { Repas, RecetteOrigine, ProfilSnapshot, SlotStatut } from "../../types";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const PLAN_TOKEN_CAP = 500_000;

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

interface RegenerateSlotInput extends SlotActionInput {
  /**
   * Feedback utilisateur optionnel injecté dans le prompt LLM.
   * Ex: "trop redondant, propose autre chose", "j'aime bien mais ajoute un féculent",
   * "plus protéiné s'il te plaît". N'est PAS stocké en base.
   */
  userFeedback?: string;
}

interface RegenerateSlotResponse {
  success: true;
  recetteIds: string[];
  tokensUsedTotal: number;
}

/**
 * Régénère 1 seul slot. Le contexte envoyé au LLM contient :
 * - profils présents au slot (pour les contraintes)
 * - liste des autres recettes du plan (pour varier)
 * - le frigo + style + saison
 * - le feedback utilisateur optionnel (ex: "trop redondant", "ajoute un féculent")
 *
 * Réutilise le même prompt système que generateMealPlan, mais avec une seule
 * ligne de présence. Le LLM doit produire 1+ recettes pour ce slot uniquement.
 */
export const regenerateSlot = onCall<RegenerateSlotInput, Promise<RegenerateSlotResponse>>(
  {
    region: "europe-west1",
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");
    const { householdId, planId, slotId, userFeedback } = req.data;
    await assertHouseholdMember(uid, householdId);

    const planRef = db.doc(`households/${householdId}/mealPlans/${planId}`);
    const [planSnap, slotsSnap] = await Promise.all([
      planRef.get(),
      planRef.collection("slots").get(),
    ]);
    if (!planSnap.exists) throw new HttpsError("not-found", "Plan introuvable");

    const plan = planSnap.data()!;
    const tokensUsed: number = plan.tokensUsed ?? 0;
    if (tokensUsed >= PLAN_TOKEN_CAP) {
      throw new HttpsError(
        "resource-exhausted",
        `Cap de ${PLAN_TOKEN_CAP} tokens atteint pour ce plan`,
      );
    }

    const targetSlot = slotsSnap.docs.find((d) => d.id === slotId)?.data();
    if (!targetSlot) throw new HttpsError("not-found", "Slot introuvable");

    const snapshotProfils = (plan.snapshotProfils ?? {}) as Record<string, ProfilSnapshot>;
    const profilsPresents: string[] = targetSlot.profilsPresents ?? [];
    if (profilsPresents.length === 0) {
      throw new HttpsError(
        "failed-precondition",
        "Aucun profil présent à ce slot — rien à générer",
      );
    }

    // Recettes des autres slots (pour le contexte "varier")
    const autresRecetteIds = new Set<string>();
    for (const sd of slotsSnap.docs) {
      if (sd.id === slotId) continue;
      const rids = (sd.data().recetteIds as string[]) ?? [];
      rids.forEach((rid) => autresRecetteIds.add(rid));
    }
    const recettesActuelles: string[] = [];
    if (autresRecetteIds.size > 0) {
      // Charge les noms en batch (max 30 pour éviter une query trop lourde)
      const ids = Array.from(autresRecetteIds).slice(0, 30);
      const docs = await Promise.all(
        ids.map((rid) =>
          db.doc(`households/${householdId}/recettes/${rid}`).get(),
        ),
      );
      for (const d of docs) {
        const nom = d.data()?.nom;
        if (typeof nom === "string") recettesActuelles.push(nom);
      }
    }

    const ctxStyle = String(plan.contexte?.style ?? "");
    const parts: string[] = [];
    if (ctxStyle) parts.push(ctxStyle);
    if (recettesActuelles.length > 0) {
      parts.push(
        `IMPORTANT : varie par rapport aux recettes déjà au plan : ${recettesActuelles.join(", ")}`,
      );
    }
    if (userFeedback && userFeedback.trim()) {
      parts.push(
        `FEEDBACK UTILISATEUR sur la précédente proposition pour ce slot : "${userFeedback.trim().slice(0, 500)}". Tiens-en compte STRICTEMENT.`,
      );
    }
    const styleAvecVariete = parts.join(" ; ");

    // Prompt avec un seul slot
    const ctx: GenerateMealPlanContext = {
      dateDebutISO: plan.dateDebut.toDate().toISOString().slice(0, 10),
      dateFinISO: plan.dateFin.toDate().toISOString().slice(0, 10),
      saison: deduceSeasonFromDate(plan.dateDebut.toDate()),
      profils: Object.entries(snapshotProfils).map(([id, snap]) => ({ id, ...snap })),
      presence: [
        {
          slotId,
          jour: targetSlot.jour as number,
          repas: targetSlot.repas as Repas,
          profilIds: profilsPresents,
        },
      ],
      contexte: {
        batchCookingOk: !!plan.contexte?.batchCookingOk,
        style: styleAvecVariete,
        frigoTexte: String(plan.contexte?.frigoTexte ?? ""),
      },
    };

    const provider = getProvider();
    const llmResult = await provider.generateStructured<unknown>({
      systemPrompt: GENERATE_MEAL_PLAN_SYSTEM_PROMPT,
      userPrompt: buildGenerateMealPlanUserPrompt(ctx),
      schema: mealPlanJSONSchema,
      maxOutputTokens: 2000,
    });
    const output = parseMealPlanLLMOutput(llmResult.data);

    // Cleanup ancien : supprime les recettes draft du plan référencées par CE slot uniquement
    // (les recettes partagées avec d'autres slots ne sont pas touchées)
    const oldRecetteIds: string[] = (targetSlot.recetteIds as string[]) ?? [];
    if (oldRecetteIds.length > 0) {
      const otherSlots = slotsSnap.docs.filter((d) => d.id !== slotId);
      const stillReferenced = new Set<string>();
      for (const sd of otherSlots) {
        for (const rid of (sd.data().recetteIds as string[]) ?? []) {
          stillReferenced.add(rid);
        }
      }
      const cleanupBatch = db.batch();
      for (const oldId of oldRecetteIds) {
        if (stillReferenced.has(oldId)) continue;
        const r = await db
          .doc(`households/${householdId}/recettes/${oldId}`)
          .get();
        if (r.exists && r.data()?.statut === "draft") {
          cleanupBatch.delete(r.ref);
        }
      }
      await cleanupBatch.commit().catch(() => undefined);
    }

    // Crée les nouvelles recettes
    const tempIdToRealId = new Map<string, string>();
    const writeBatch = db.batch();
    for (const r of output.recettes) {
      const ref = db.collection(`households/${householdId}/recettes`).doc();
      tempIdToRealId.set(r.tempId, ref.id);
      writeBatch.set(ref, {
        nom: r.nom,
        description: r.description,
        portions: r.portions,
        tempsPrepMinutes: r.tempsPrepMinutes,
        tempsCuissonMinutes: r.tempsCuissonMinutes,
        difficulte: r.difficulte,
        ingredients: r.ingredients,
        etapes: r.etapes,
        tags: r.tags,
        saison: r.saison,
        estBatch: r.estBatch,
        statut: "draft",
        origine: {
          planId,
          slotId,
          genereePar: "llm" as RecetteOrigine,
          llmModel: llmResult.model,
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const newRecetteIds: string[] = [];
    const matchingSlot = output.slots.find((s) => s.slotId === slotId) ?? output.slots[0];
    if (matchingSlot) {
      for (const tid of matchingSlot.recetteTempIds) {
        const real = tempIdToRealId.get(tid);
        if (real) newRecetteIds.push(real);
      }
    }

    writeBatch.update(planRef.collection("slots").doc(slotId), {
      recetteIds: newRecetteIds,
      statut: newRecetteIds.length > 0 ? "propose" : "vide",
      batchSourceSlotId:
        matchingSlot?.batchSourceSlotId ?? FieldValue.delete(),
    });

    const totalTokens = tokensUsed + llmResult.usage.inputTokens + llmResult.usage.outputTokens;
    writeBatch.update(planRef, {
      tokensUsed: totalTokens,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeBatch.commit();

    logger.info("Slot régénéré", {
      planId,
      slotId,
      newRecetteIds,
      tokensUsed: llmResult.usage,
    });

    return { success: true, recetteIds: newRecetteIds, tokensUsedTotal: totalTokens };
  },
);

function deduceSeasonFromDate(d: Date): "hiver" | "printemps" | "ete" | "automne" {
  const m = d.getMonth();
  if (m === 11 || m <= 1) return "hiver";
  if (m <= 4) return "printemps";
  if (m <= 7) return "ete";
  return "automne";
}
