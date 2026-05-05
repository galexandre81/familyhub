/**
 * Cloud Functions de la tuile `weekly-menu` (Phase 3.5).
 *
 * Calcule un snapshot léger du plan actif (juste les noms des recettes
 * et le nombre de mangeurs par slot, pas les ingrédients/étapes —
 * pour l'affichage de la grille semaine sur iPad).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { db } from "../lib/admin";
import { assertHouseholdMember } from "../lib/household";
import { rebuildSnapshotForTile } from "../snapshot/builder";
import type { Repas, WeeklyMenuData, WeeklyMenuSlotSnapshot } from "../types";

const REPAS_ORDER: Repas[] = ["petitDej", "dej", "diner"];

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

async function buildWeeklyMenuData(householdId: string): Promise<WeeklyMenuData> {
  const generatedAtISO = new Date().toISOString();
  const todayISO = getNowParisDateISO();

  const planQ = await db
    .collection(`households/${householdId}/mealPlans`)
    .where("statut", "==", "active")
    .get();
  if (planQ.empty) {
    return {
      hasActivePlan: false,
      semaine: [],
      generatedAtISO,
    };
  }
  const planDoc = planQ.docs[0];
  const planId = planDoc.id;
  const plan = planDoc.data();

  const dateDebutISO = dateISOFromTimestamp(plan.dateDebut) ?? todayISO;
  const dateFinISO = dateISOFromTimestamp(plan.dateFin) ?? addDaysISO(dateDebutISO, 6);

  const slotsSnap = await db
    .collection(`households/${householdId}/mealPlans/${planId}/slots`)
    .get();

  // Collect all recetteIds we need to resolve to names
  const recetteIds = new Set<string>();
  slotsSnap.docs.forEach((d) => {
    const ids = (d.data().recetteIds as string[]) || [];
    ids.forEach((rid) => recetteIds.add(rid));
  });

  const nomById = new Map<string, string>();
  if (recetteIds.size > 0) {
    const docs = await Promise.all(
      Array.from(recetteIds).map((rid) =>
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

  // Build a map by (jour, repas) for the 21 cells of the week
  const slotMap = new Map<string, Record<string, unknown>>();
  slotsSnap.docs.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    const jour = typeof data.jour === "number" ? data.jour : null;
    const repas = data.repas as Repas | undefined;
    if (jour == null || !repas) return;
    slotMap.set(`${jour}-${repas}`, data);
  });

  const semaine: WeeklyMenuSlotSnapshot[] = [];
  for (let jour = 0; jour < 7; jour++) {
    const slotDateISO = addDaysISO(dateDebutISO, jour);
    for (const repas of REPAS_ORDER) {
      const data = slotMap.get(`${jour}-${repas}`);
      const profilsPresents = (data?.profilsPresents as string[]) || [];
      const invitesNoms = (data?.invitesNoms as string[]) || [];
      const recetteIdsLocal = (data?.recetteIds as string[]) || [];
      const source = data?.source as "fresh" | "batch" | undefined;
      const recetteNoms = recetteIdsLocal
        .map((rid) => nomById.get(rid))
        .filter((n): n is string => !!n);
      semaine.push({
        jour,
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

  return {
    hasActivePlan: true,
    planId,
    dateDebutISO,
    dateFinISO,
    semaine,
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
    });
    return { success: true };
  },
);

export const scheduledWeeklyMenuRefresh = onSchedule(
  {
    schedule: "every 60 minutes",
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
