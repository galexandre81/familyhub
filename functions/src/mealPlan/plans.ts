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
import { requireId, requireIdArray, requireObject } from "../lib/validate";
import type { Repas, ProfilSnapshot, SlotStatut } from "../types";

const REPAS_LIST: Repas[] = ["petitDej", "dej", "diner"];
/** 7 jours × 3 repas = 21 slots : au-delà, l'entrée est forcément malformée. */
const MAX_PRESENCE = 50;
/** Borne du nombre de profils présents à un repas. */
const MAX_PROFILS_PAR_SLOT = 50;
/** Taille d'un batch Firestore (limite dure à 500 écritures). */
const TAILLE_BATCH = 500;

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

    const input = (req.data ?? {}) as Partial<Record<keyof CreateMealPlanInput, unknown>>;
    const householdId = requireId(input.householdId, "householdId");
    const dateDebutISO = input.dateDebutISO;
    if (typeof dateDebutISO !== "string" || !dateDebutISO) {
      throw new HttpsError("invalid-argument", "householdId et dateDebutISO requis");
    }
    const contexteBrut = requireObject(input.contexte, "contexte");
    if (contexteBrut.frigoTexte != null && typeof contexteBrut.frigoTexte !== "string") {
      throw new HttpsError("invalid-argument", "frigoTexte doit être une chaîne");
    }
    if (typeof contexteBrut.frigoTexte === "string" && contexteBrut.frigoTexte.length > 2000) {
      throw new HttpsError("invalid-argument", "frigoTexte limité à 2000 caractères");
    }
    const contexte = contexteBrut as Partial<CreateMealPlanInput["contexte"]>;
    if (!Array.isArray(input.presence)) {
      throw new HttpsError("invalid-argument", "presence doit être un tableau");
    }
    if (input.presence.length > MAX_PRESENCE) {
      throw new HttpsError("invalid-argument", `presence limité à ${MAX_PRESENCE} éléments`);
    }
    const presence = input.presence.map((brut, i) => {
      const p = requireObject(brut, `presence[${i}]`);
      if (!Number.isInteger(p.jour) || (p.jour as number) < 0 || (p.jour as number) > 6) {
        throw new HttpsError("invalid-argument", `presence[${i}].jour invalide`);
      }
      if (!REPAS_LIST.includes(p.repas as Repas)) {
        throw new HttpsError("invalid-argument", `presence[${i}].repas invalide`);
      }
      return {
        jour: p.jour as number,
        repas: p.repas as Repas,
        profilIds: requireIdArray(p.profilIds, `presence[${i}].profilIds`, MAX_PROFILS_PAR_SLOT),
      };
    });

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
    // dateFin = dateDebut + 6 jours, à la même heure. Surtout pas 23:59:59 UTC
    // (l'ancien setHours sur un serveur en UTC) : à Paris c'est déjà le
    // lendemain, et la tuile weekly-menu (qui lit les dates à Paris) ajoutait
    // un 8ᵉ jour vide.
    const dateFin = new Date(dateDebut.getTime() + 6 * 86_400_000);

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

    const input = (req.data ?? {}) as Partial<ValidateMealPlanInput>;
    const householdId = requireId(input.householdId, "householdId");
    const planId = requireId(input.planId, "planId");
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
 * Supprime un plan + toutes ses sous-collections (slots, courses, chatMessages),
 * ainsi que ses listes de courses (`households/{h}/shoppingLists`, planId == plan).
 * Les recettes générées par le plan ne sont PAS supprimées (elles ont leur vie propre
 * dans la bibliothèque, et restent référencées par les plans archivés).
 */
export const deleteMealPlan = onCall<DeleteMealPlanInput, Promise<{ success: true }>>(
  { region: "europe-west1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");

    const input = (req.data ?? {}) as Partial<DeleteMealPlanInput>;
    const householdId = requireId(input.householdId, "householdId");
    // planId vide : l'ancien code répondait « succès » sans rien supprimer.
    const planId = requireId(input.planId, "planId");
    await assertHouseholdMember(uid, householdId);

    // Listes de courses du plan : collection du FOYER, hors du doc plan, donc
    // non couvertes par le recursiveDelete. Supprimées même si le plan n'existe
    // plus (orphelines d'une suppression antérieure).
    const listesSnap = await db
      .collection(`households/${householdId}/shoppingLists`)
      .where("planId", "==", planId)
      .get();
    for (let i = 0; i < listesSnap.docs.length; i += TAILLE_BATCH) {
      const batch = db.batch();
      listesSnap.docs.slice(i, i + TAILLE_BATCH).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    const planRef = db.doc(`households/${householdId}/mealPlans/${planId}`);
    const planSnap = await planRef.get();
    if (!planSnap.exists) {
      logger.info("MealPlan déjà absent", { householdId, planId, listesSupprimees: listesSnap.size });
      return { success: true };
    }

    // Suppression récursive du doc + TOUTES ses sous-collections
    // (slots, courses, batchSessions, chatMessages, shoppingLists, ...).
    // recursiveDelete gère le batching interne (>500 writes) sans risque.
    await db.recursiveDelete(planRef);

    logger.info("MealPlan supprimé", { householdId, planId, listesSupprimees: listesSnap.size });
    return { success: true };
  },
);
