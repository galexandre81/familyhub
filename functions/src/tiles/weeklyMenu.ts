/**
 * Cloud Functions de la tuile `weekly-menu`.
 *
 * Calcule un snapshot léger des plans de repas du foyer (noms des recettes
 * + compteurs présents, pas les ingrédients/étapes) pour l'affichage sur
 * iPad / téléphone.
 *
 * Embarque le plan actif + jusqu'aux 12 plans archivés les plus récents,
 * pour permettre la navigation en arrière dans l'historique sans refetch.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { db } from "../lib/admin";
import { assertHouseholdMember } from "../lib/household";
import { rebuildSnapshotForTile } from "../snapshot/builder";
import type {
  Repas,
  WeeklyMenuBatchSnapshot,
  WeeklyMenuData,
  WeeklyMenuSlotSnapshot,
  WeeklyPlanSnapshot,
} from "../types";

const REPAS_ORDER: Repas[] = ["petitDej", "dej", "diner"];
const MAX_ARCHIVED_PLANS = 12;
/** Garde-fou : un plan ne peut pas excéder 31 jours dans le snapshot. */
const MAX_PLAN_DAYS = 31;

function getNowParisDateISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dateISOFromTimestamp(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof ts === "string") return ts.slice(0, 10);
  if (typeof ts === "object" && ts !== null) {
    if ("toDate" in ts && typeof (ts as { toDate: () => Date }).toDate === "function") {
      return (ts as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
    }
    if ("seconds" in ts) {
      return new Date((ts as { seconds: number }).seconds * 1000)
        .toISOString()
        .slice(0, 10);
    }
  }
  if (ts instanceof Date) return ts.toISOString().slice(0, 10);
  return null;
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetweenISO(startISO: string, endISO: string): number {
  const a = new Date(`${startISO}T12:00:00Z`).getTime();
  const b = new Date(`${endISO}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Construit le snapshot d'un seul plan : itère par date (dateDebut → dateFin),
 * indexe les slots par (date, repas). Si un slot n'a pas de `date` (legacy),
 * on dérive depuis `dateDebut + jour`.
 */
async function buildPlanSnapshot(
  householdId: string,
  planId: string,
  plan: Record<string, unknown>,
  todayISO: string,
  nomById: Map<string, string>,
  slotsSnap: FirebaseFirestore.QuerySnapshot,
  batchesSnap: FirebaseFirestore.QuerySnapshot,
): Promise<{ snapshot: WeeklyPlanSnapshot; recetteIds: Set<string> }> {
  let dateDebutISO = dateISOFromTimestamp(plan.dateDebut) ?? todayISO;
  let dateFinISO = dateISOFromTimestamp(plan.dateFin) ?? addDaysISO(dateDebutISO, 6);
  const statut =
    (plan.statut as "active" | "archived" | "draft" | undefined) ?? "archived";

  // Index par "date|repas". On préfère slot.date (Phase 3), fallback dateDebut+jour.
  const slotMap = new Map<string, Record<string, unknown>>();
  const localRecetteIds = new Set<string>();
  const realSlotDates: string[] = [];
  for (const d of slotsSnap.docs) {
    const data = d.data() as Record<string, unknown>;
    const repas = data.repas as Repas | undefined;
    if (!repas) continue;
    const rawDate = typeof data.date === "string" ? data.date : null;
    const jour = typeof data.jour === "number" ? data.jour : null;
    const slotDateISO = rawDate ?? (jour != null ? addDaysISO(dateDebutISO, jour) : null);
    if (!slotDateISO) continue;
    slotMap.set(`${slotDateISO}|${repas}`, data);
    realSlotDates.push(slotDateISO);
    const ids = (data.recetteIds as string[]) || [];
    ids.forEach((rid) => localRecetteIds.add(rid));
  }
  batchesSnap.docs.forEach((d) => {
    const ids = (d.data().recetteIds as string[]) || [];
    ids.forEach((rid) => localRecetteIds.add(rid));
  });

  // Défensif : si les slots débordent du dateDebut/dateFin posé sur le doc
  // plan (cas import JSON dont les dates dépassent le wizard), on étend la
  // plage rendue pour englober tous les slots.
  if (realSlotDates.length > 0) {
    realSlotDates.sort();
    const slotMin = realSlotDates[0];
    const slotMax = realSlotDates[realSlotDates.length - 1];
    if (slotMin < dateDebutISO) dateDebutISO = slotMin;
    if (slotMax > dateFinISO) dateFinISO = slotMax;
  }

  // Plage de jours réelle, cappée pour éviter l'explosion (plans mal formés).
  const nDaysRaw = daysBetweenISO(dateDebutISO, dateFinISO) + 1;
  const nDays = Math.max(1, Math.min(MAX_PLAN_DAYS, nDaysRaw));

  const semaine: WeeklyMenuSlotSnapshot[] = [];
  for (let i = 0; i < nDays; i++) {
    const slotDateISO = addDaysISO(dateDebutISO, i);
    for (const repas of REPAS_ORDER) {
      const data = slotMap.get(`${slotDateISO}|${repas}`);
      const profilsPresents = (data?.profilsPresents as string[]) || [];
      const invitesNoms = (data?.invitesNoms as string[]) || [];
      const recetteIdsLocal = (data?.recetteIds as string[]) || [];
      const source = data?.source as "fresh" | "batch" | undefined;
      const recetteNoms = recetteIdsLocal
        .map((rid) => nomById.get(rid))
        .filter((n): n is string => !!n);
      semaine.push({
        jour: i,
        repas,
        date: slotDateISO,
        recetteIds: recetteIdsLocal,
        recetteNoms,
        profilsCount: profilsPresents.length,
        invitesCount: invitesNoms.length,
        isBatchConsumer: source === "batch",
        isToday: slotDateISO === todayISO,
        isPast: slotDateISO < todayISO,
      });
    }
  }

  const batchSessions: WeeklyMenuBatchSnapshot[] = [];
  for (const d of batchesSnap.docs) {
    const data = d.data() as Record<string, unknown>;
    const ids = (data.recetteIds as string[]) || [];
    const noms = ids.map((rid) => nomById.get(rid)).filter((n): n is string => !!n);
    batchSessions.push({
      id: d.id,
      date: typeof data.date === "string" ? data.date : "",
      dureeEstimeeMinutes: Number(data.dureeEstimeeMinutes) || 0,
      recetteIds: ids,
      recetteNoms: noms,
      ...(data.notes ? { notes: String(data.notes) } : {}),
      done: !!data.done,
    });
  }
  batchSessions.sort((a, b) => a.date.localeCompare(b.date));

  return {
    snapshot: {
      planId,
      statut,
      dateDebutISO,
      dateFinISO,
      semaine,
      batchSessions,
    },
    recetteIds: localRecetteIds,
  };
}

async function buildWeeklyMenuData(householdId: string): Promise<WeeklyMenuData> {
  const generatedAtISO = new Date().toISOString();
  const todayISO = getNowParisDateISO();

  // Récupère tous les plans non-draft. Tri par `dateDebut` desc côté serveur.
  const allPlansSnap = await db
    .collection(`households/${householdId}/mealPlans`)
    .where("statut", "in", ["active", "archived"])
    .orderBy("dateDebut", "desc")
    .limit(MAX_ARCHIVED_PLANS + 1) // 1 actif + jusqu'à 12 archivés
    .get();

  if (allPlansSnap.empty) {
    return {
      hasActivePlan: false,
      semaine: [],
      batchSessions: [],
      plans: [],
      generatedAtISO,
    };
  }

  // Pré-charge TOUTES les recettes référencées dans TOUS les plans, en une passe.
  // (sinon on aurait N×M reads pour M plans × N recettes par plan)
  const firstPassSlotsAndBatches = await Promise.all(
    allPlansSnap.docs.map((planDoc) =>
      Promise.all([
        db.collection(`households/${householdId}/mealPlans/${planDoc.id}/slots`).get(),
        db.collection(`households/${householdId}/mealPlans/${planDoc.id}/batchSessions`).get(),
      ]),
    ),
  );
  const allRecetteIds = new Set<string>();
  for (const [slotsSnap, batchesSnap] of firstPassSlotsAndBatches) {
    slotsSnap.docs.forEach((d) => {
      ((d.data().recetteIds as string[]) || []).forEach((rid) => allRecetteIds.add(rid));
    });
    batchesSnap.docs.forEach((d) => {
      ((d.data().recetteIds as string[]) || []).forEach((rid) => allRecetteIds.add(rid));
    });
  }

  const nomById = new Map<string, string>();
  if (allRecetteIds.size > 0) {
    const docs = await Promise.all(
      Array.from(allRecetteIds).map((rid) =>
        db.doc(`households/${householdId}/recettes/${rid}`).get(),
      ),
    );
    docs.forEach((d) => {
      if (d.exists) {
        const nom = (d.data() as Record<string, unknown>).nom;
        if (typeof nom === "string") nomById.set(d.id, nom);
      }
    });
  }

  // Build chaque plan en réutilisant les slots/batches déjà chargés lors de la
  // 1ʳᵉ passe (même ordre que allPlansSnap.docs) — évite de re-fetcher.
  const plans: WeeklyPlanSnapshot[] = [];
  for (let i = 0; i < allPlansSnap.docs.length; i++) {
    const planDoc = allPlansSnap.docs[i];
    const [slotsSnap, batchesSnap] = firstPassSlotsAndBatches[i];
    const { snapshot } = await buildPlanSnapshot(
      householdId,
      planDoc.id,
      planDoc.data(),
      todayISO,
      nomById,
      slotsSnap,
      batchesSnap,
    );
    plans.push(snapshot);
  }

  // Plan actif : pointe vers le plan avec statut="active", sinon le 1er
  // (qui par tri desc est le plus récent ⇒ probablement l'actif).
  const active = plans.find((p) => p.statut === "active");

  return {
    hasActivePlan: !!active,
    ...(active
      ? {
          planId: active.planId,
          dateDebutISO: active.dateDebutISO,
          dateFinISO: active.dateFinISO,
          semaine: active.semaine,
          batchSessions: active.batchSessions,
        }
      : { semaine: [], batchSessions: [] }),
    plans,
    generatedAtISO,
  };
}

interface RefreshInput {
  householdId: string;
  tileId: string;
}

export const refreshWeeklyMenuTile = onCall<RefreshInput, Promise<{ success: true }>>(
  { region: "europe-west1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");

    const { householdId, tileId } = req.data;
    if (!householdId || !tileId) {
      throw new HttpsError("invalid-argument", "householdId et tileId requis");
    }

    await assertHouseholdMember(uid, householdId);

    const tileSnap = await db.doc(`households/${householdId}/tiles/${tileId}`).get();
    if (!tileSnap.exists) {
      throw new HttpsError("not-found", `Tile ${tileId} introuvable`);
    }
    if (tileSnap.data()?.type !== "weekly-menu") {
      throw new HttpsError(
        "failed-precondition",
        `Tile ${tileId} n'est pas de type weekly-menu`,
      );
    }

    const data = await buildWeeklyMenuData(householdId);
    await rebuildSnapshotForTile(householdId, tileId, "weekly-menu", data);
    logger.info("refreshWeeklyMenuTile DONE", {
      householdId,
      tileId,
      hasPlan: data.hasActivePlan,
      slotsCount: data.semaine.length,
      plansCount: data.plans?.length ?? 0,
    });
    return { success: true };
  },
);

export const scheduledWeeklyMenuRefresh = onSchedule(
  {
    schedule: "every 15 minutes",
    region: "europe-west1",
    timeZone: "Europe/Paris",
  },
  async () => {
    const tilesSnap = await db
      .collectionGroup("tiles")
      .where("type", "==", "weekly-menu")
      .get();
    logger.info(`scheduledWeeklyMenuRefresh: ${tilesSnap.size} tile(s)`);

    const byHousehold = new Map<string, string[]>();
    for (const doc of tilesSnap.docs) {
      const householdId = doc.ref.parent.parent?.id;
      if (!householdId) continue;
      const list = byHousehold.get(householdId) ?? [];
      list.push(doc.id);
      byHousehold.set(householdId, list);
    }

    for (const [householdId, tileIds] of byHousehold) {
      try {
        const data = await buildWeeklyMenuData(householdId);
        for (const tileId of tileIds) {
          await rebuildSnapshotForTile(householdId, tileId, "weekly-menu", data);
        }
        logger.info(
          `[weekly-menu] foyer ${householdId} : ${tileIds.length} tile(s)`,
        );
      } catch (err) {
        logger.error(`[weekly-menu] échec refresh foyer ${householdId}`, err);
      }
    }
  },
);
