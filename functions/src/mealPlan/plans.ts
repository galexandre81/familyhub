/**
 * Cloud Functions de gestion des plans de repas (Phase 3).
 *
 * - createMealPlan : initialise un plan en draft + tous les slots (vides)
 * - validateMealPlan : passe draft → active, archive le précédent
 * - deleteMealPlan : supprime un plan + sous-collections (slots, courses)
 *
 * Convention d'IDs slots : `{jour}-{repas}` ex "0-dej". Permet l'accès direct
 * sans query.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../lib/admin";
import { assertHouseholdMember } from "../lib/household";
import type { Repas, ProfilSnapshot, SlotStatut } from "../types";

const REPAS_LIST: Repas[] = ["petitDej", "dej", "diner"];

interface CreateMealPlanInput {
  householdId: string;
  /** Date du lundi (ISO 8601, début de semaine). */
  dateDebutISO: string;
  contexte: {
    batchCookingOk: boolean;
    style: string;
    frigoTexte: string;
  };
  /**
   * Présence par slot. Si un slot est absent de la liste, il est créé vide
   * avec aucun profil présent.
   */
  presence: Array<{
    jour: number;
    repas: Repas;
    profilIds: string[];
  }>;
}

interface CreateMealPlanResponse {
  planId: string;
  slotsCreated: number;
}

/**
 * Crée un plan en `draft` + tous les 21 slots associés.
 * Snapshot des profils figé à ce moment-là.
 *
 * Note : ne lance PAS la génération LLM. C'est `generateMealPlan` qui s'en charge
 * pour permettre à l'utilisateur de revoir la grille de présence avant.
 */
export const createMealPlan = onCall<CreateMealPlanInput, Promise<CreateMealPlanResponse>>(
  { region: "europe-west1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");

    const { householdId, dateDebutISO, contexte, presence } = req.data;
    if (!householdId || !dateDebutISO) {
      throw new HttpsError("invalid-argument", "householdId et dateDebutISO requis");
    }
    if (contexte?.frigoTexte && contexte.frigoTexte.length > 2000) {
      throw new HttpsError("invalid-argument", "frigoTexte limité à 2000 caractères");
    }

    await assertHouseholdMember(uid, householdId);

    // Snapshot figé des profils
    const profilsSnap = await db
      .collection(`households/${householdId}/profils`)
      .get();
    const snapshotProfils: Record<string, ProfilSnapshot> = {};
    for (const doc of profilsSnap.docs) {
      const p = doc.data();
      snapshotProfils[doc.id] = {
        nom: String(p.nom ?? ""),
        regimes: Array.isArray(p.regimes) ? p.regimes : [],
        aversions: Array.isArray(p.aversions) ? p.aversions : [],
        objectifsNutrition: Array.isArray(p.objectifsNutrition) ? p.objectifsNutrition : [],
        prefsCuisson: Array.isArray(p.prefsCuisson) ? p.prefsCuisson : [],
        notes: typeof p.notes === "string" ? p.notes : undefined,
      };
    }
    if (Object.keys(snapshotProfils).length === 0) {
      throw new HttpsError(
        "failed-precondition",
        "Aucun profil dans ce foyer. Créez au moins un profil avant de lancer un plan.",
      );
    }

    const dateDebut = new Date(dateDebutISO);
    if (isNaN(dateDebut.getTime())) {
      throw new HttpsError("invalid-argument", "dateDebutISO invalide");
    }
    const dateFin = new Date(dateDebut.getTime());
    dateFin.setDate(dateFin.getDate() + 6);
    dateFin.setHours(23, 59, 59, 999);

    // Création du plan
    const planRef = db.collection(`households/${householdId}/mealPlans`).doc();
    const presenceMap = new Map(
      presence.map((p) => [`${p.jour}-${p.repas}`, p.profilIds]),
    );

    const batch = db.batch();
    batch.set(planRef, {
      dateDebut,
      dateFin,
      statut: "draft",
      snapshotProfils,
      contexte: {
        batchCookingOk: !!contexte.batchCookingOk,
        style: String(contexte.style ?? ""),
        frigoTexte: String(contexte.frigoTexte ?? ""),
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: uid,
    });

    let slotsCreated = 0;
    for (let jour = 0; jour < 7; jour++) {
      for (const repas of REPAS_LIST) {
        const slotId = `${jour}-${repas}`;
        const slotRef = planRef.collection("slots").doc(slotId);
        const profilsPresents = presenceMap.get(slotId) ?? [];
        batch.set(slotRef, {
          jour,
          repas,
          profilsPresents,
          recetteIds: [],
          statut: "vide" as SlotStatut,
        });
        slotsCreated++;
      }
    }

    await batch.commit();
    logger.info("MealPlan créé", { householdId, planId: planRef.id, slotsCreated });

    return { planId: planRef.id, slotsCreated };
  },
);

interface ValidateMealPlanInput {
  householdId: string;
  planId: string;
}

/**
 * Passe le plan en `active` et archive le plan actif précédent (s'il existe).
 * Garantit l'invariant "au plus un plan actif par foyer".
 */
export const validateMealPlan = onCall<ValidateMealPlanInput, Promise<{ success: true }>>(
  { region: "europe-west1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");

    const { householdId, planId } = req.data;
    await assertHouseholdMember(uid, householdId);

    const planRef = db.doc(`households/${householdId}/mealPlans/${planId}`);
    const activesQuery = db
      .collection(`households/${householdId}/mealPlans`)
      .where("statut", "==", "active");

    // Transaction : on (re)lit le plan + les actifs courants, puis on archive
    // et active dans la même opération atomique pour garantir l'invariant
    // "au plus un plan actif" (sinon une race peut laisser deux actifs).
    const previousArchived = await db.runTransaction(async (txn) => {
      const planSnap = await txn.get(planRef);
      if (!planSnap.exists) {
        throw new HttpsError("not-found", "Plan introuvable");
      }
      if (planSnap.data()?.statut !== "draft") {
        throw new HttpsError("failed-precondition", "Seul un plan en draft peut être validé");
      }

      const previousActive = await txn.get(activesQuery);
      for (const doc of previousActive.docs) {
        txn.update(doc.ref, {
          statut: "archived",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      txn.update(planRef, {
        statut: "active",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return previousActive.size;
    });

    logger.info("MealPlan validé (active)", {
      householdId,
      planId,
      previousArchived,
    });
    return { success: true };
  },
);

interface DeleteMealPlanInput {
  householdId: string;
  planId: string;
}

/**
 * Supprime un plan + toutes ses sous-collections (slots, courses, chatMessages).
 * Les recettes générées par le plan ne sont PAS supprimées (elles ont leur vie propre
 * dans la bibliothèque, et restent référencées par les plans archivés).
 */
export const deleteMealPlan = onCall<DeleteMealPlanInput, Promise<{ success: true }>>(
  { region: "europe-west1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");

    const { householdId, planId } = req.data;
    await assertHouseholdMember(uid, householdId);

    const planRef = db.doc(`households/${householdId}/mealPlans/${planId}`);
    const planSnap = await planRef.get();
    if (!planSnap.exists) return { success: true };

    // Suppression récursive du doc + TOUTES ses sous-collections
    // (slots, courses, batchSessions, chatMessages, shoppingLists, ...).
    // recursiveDelete gère le batching interne (>500 writes) sans risque.
    await db.recursiveDelete(planRef);

    logger.info("MealPlan supprimé", { householdId, planId });
    return { success: true };
  },
);
