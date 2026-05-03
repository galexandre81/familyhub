/**
 * Cloud Function de génération LLM d'un plan de repas (Kitchen Buddy Phase 3.3).
 *
 * Étapes (cf. spec §6.2) :
 * 1. Auth + membership
 * 2. Verrou idempotence (generatingAt < 60s → refuse)
 * 3. Cap tokens (tokensUsed >= 500_000 → refuse)
 * 4. Charge plan + slots + profils snapshot
 * 5. Construit prompt + appelle LLM (mock ou Gemini)
 * 6. Parse + valide output (Zod + intégrité refs)
 * 7. Nettoie les recettes/courses précédentes (idempotence regen)
 * 8. Crée recettes (statut draft) + assigne slots (statut propose) + courses
 * 9. Met à jour plan (generatedAt, llmModel, tokensUsed cumulé)
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
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
import type { ProfilSnapshot, Repas, RecetteOrigine } from "../../types";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const GENERATION_LOCK_SECONDS = 60;
const PLAN_TOKEN_CAP = 500_000;

interface GenerateMealPlanInput {
  householdId: string;
  planId: string;
}

interface GenerateMealPlanResponse {
  success: true;
  slotsGenerated: number;
  recettesCreees: number;
  coursesCreees: number;
  tokensUsedTotal: number;
}

function deduceSeason(d: Date): GenerateMealPlanContext["saison"] {
  const m = d.getMonth(); // 0-indexed
  if (m === 11 || m <= 1) return "hiver";
  if (m <= 4) return "printemps";
  if (m <= 7) return "ete";
  return "automne";
}

function ageFromBirthdate(birth: Date | undefined): number | undefined {
  if (!birth || isNaN(birth.getTime())) return undefined;
  const ms = Date.now() - birth.getTime();
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
}

export const generateMealPlan = onCall<
  GenerateMealPlanInput,
  Promise<GenerateMealPlanResponse>
>(
  {
    region: "europe-west1",
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");

    const { householdId, planId } = req.data;
    if (!householdId || !planId) {
      throw new HttpsError("invalid-argument", "householdId et planId requis");
    }
    await assertHouseholdMember(uid, householdId);

    const planRef = db.doc(`households/${householdId}/mealPlans/${planId}`);

    /* --- 1. Verrou idempotence + cap tokens (transaction) --- */
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(planRef);
      if (!snap.exists) {
        throw new HttpsError("not-found", "Plan introuvable");
      }
      const data = snap.data()!;
      const generatingAt: Timestamp | undefined = data.generatingAt;
      if (generatingAt) {
        const ageMs = Date.now() - generatingAt.toMillis();
        if (ageMs < GENERATION_LOCK_SECONDS * 1000) {
          throw new HttpsError(
            "aborted",
            `Génération déjà en cours (commencée il y a ${Math.round(ageMs / 1000)}s)`,
          );
        }
      }
      const tokensUsed: number = data.tokensUsed ?? 0;
      if (tokensUsed >= PLAN_TOKEN_CAP) {
        throw new HttpsError(
          "resource-exhausted",
          `Cap de ${PLAN_TOKEN_CAP} tokens atteint pour ce plan (${tokensUsed} utilisés)`,
        );
      }
      tx.update(planRef, {
        generatingAt: FieldValue.serverTimestamp(),
      });
    });

    try {
      /* --- 2. Charge plan + slots + profils en parallèle --- */
      const [planSnap, slotsSnap, profilsSnap] = await Promise.all([
        planRef.get(),
        planRef.collection("slots").get(),
        db.collection(`households/${householdId}/profils`).get(),
      ]);
      const plan = planSnap.data()!;
      const snapshotProfils = (plan.snapshotProfils ?? {}) as Record<string, ProfilSnapshot>;
      const dateDebut: Date = plan.dateDebut.toDate();
      const dateFin: Date = plan.dateFin.toDate();

      // Hydrate les profils du snapshot avec l'âge calculé depuis le profil live
      // (snapshot fige les contraintes, pas l'âge — qui peut évoluer pendant la semaine)
      const ageById = new Map<string, number | undefined>();
      for (const doc of profilsSnap.docs) {
        const dn = doc.data().dateNaissance;
        ageById.set(doc.id, ageFromBirthdate(dn?.toDate?.() ?? undefined));
      }

      const profils = Object.entries(snapshotProfils).map(([id, snap]) => ({
        id,
        ...snap,
        age: ageById.get(id),
      }));

      const presence = slotsSnap.docs.map((d) => {
        const data = d.data();
        return {
          slotId: d.id,
          jour: data.jour as number,
          repas: data.repas as Repas,
          profilIds: (data.profilsPresents as string[]) ?? [],
        };
      });

      /* --- 3. Construit prompt + appelle LLM --- */
      const ctx: GenerateMealPlanContext = {
        dateDebutISO: dateDebut.toISOString().slice(0, 10),
        dateFinISO: dateFin.toISOString().slice(0, 10),
        saison: deduceSeason(dateDebut),
        profils,
        presence,
        contexte: plan.contexte,
      };

      const provider = getProvider();
      logger.info("Génération plan : appel LLM", {
        provider: provider.name,
        slotsCount: presence.length,
      });

      const llmResult = await provider.generateStructured<unknown>({
        systemPrompt: GENERATE_MEAL_PLAN_SYSTEM_PROMPT,
        userPrompt: buildGenerateMealPlanUserPrompt(ctx),
        schema: mealPlanJSONSchema,
        maxOutputTokens: parseInt(process.env.LLM_MAX_TOKENS_GENERATION || "8000", 10),
      });

      /* --- 4. Parse + valide --- */
      const output = parseMealPlanLLMOutput(llmResult.data);

      /* --- 5. Nettoyage idempotence : supprime recettes draft du plan + courses --- */
      const oldRecettesSnap = await db
        .collection(`households/${householdId}/recettes`)
        .where("origine.planId", "==", planId)
        .where("statut", "==", "draft")
        .get();
      const oldCoursesSnap = await planRef.collection("courses").get();

      const cleanupBatch = db.batch();
      for (const doc of oldRecettesSnap.docs) cleanupBatch.delete(doc.ref);
      for (const doc of oldCoursesSnap.docs) cleanupBatch.delete(doc.ref);
      if (!oldRecettesSnap.empty || !oldCoursesSnap.empty) {
        await cleanupBatch.commit();
      }

      /* --- 6. Écriture : recettes (puis slots + courses dans un batch) --- */
      // recettes d'abord pour avoir les vrais IDs Firestore
      const tempIdToRealId = new Map<string, string>();
      const recettesBatch = db.batch();
      for (const r of output.recettes) {
        const ref = db.collection(`households/${householdId}/recettes`).doc();
        tempIdToRealId.set(r.tempId, ref.id);
        recettesBatch.set(ref, {
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
            genereePar: "llm" as RecetteOrigine,
            llmModel: llmResult.model,
          },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await recettesBatch.commit();

      // slots + courses + plan update
      const finalBatch = db.batch();
      for (const s of output.slots) {
        const slotRef = planRef.collection("slots").doc(s.slotId);
        const recetteIds = s.recetteTempIds
          .map((tid) => tempIdToRealId.get(tid))
          .filter((x): x is string => !!x);
        finalBatch.update(slotRef, {
          recetteIds,
          batchSourceSlotId: s.batchSourceSlotId ?? FieldValue.delete(),
          statut: recetteIds.length > 0 ? "propose" : "vide",
        });
      }
      for (const c of output.courses) {
        const courseRef = planRef.collection("courses").doc();
        finalBatch.set(courseRef, {
          libelle: c.libelle,
          quantite: c.quantite,
          unite: c.unite,
          rayon: c.rayon,
          coche: false,
          ajoutManuel: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      const totalTokens =
        (plan.tokensUsed ?? 0) + llmResult.usage.inputTokens + llmResult.usage.outputTokens;

      finalBatch.update(planRef, {
        generatedAt: FieldValue.serverTimestamp(),
        llmModel: llmResult.model,
        tokensUsed: totalTokens,
        generatingAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await finalBatch.commit();

      logger.info("Plan généré avec succès", {
        planId,
        recettes: output.recettes.length,
        slots: output.slots.length,
        courses: output.courses.length,
        tokensUsed: llmResult.usage,
      });

      return {
        success: true,
        slotsGenerated: output.slots.length,
        recettesCreees: output.recettes.length,
        coursesCreees: output.courses.length,
        tokensUsedTotal: totalTokens,
      };
    } catch (err) {
      // Libère le verrou en cas d'échec
      await planRef
        .update({ generatingAt: FieldValue.delete() })
        .catch(() => undefined);
      if (err instanceof HttpsError) throw err;
      logger.error("Échec génération plan", { planId, err });
      throw new HttpsError(
        "internal",
        err instanceof Error ? err.message : "Erreur inconnue",
      );
    }
  },
);
