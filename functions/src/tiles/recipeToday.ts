/**
 * Cloud Functions de la tuile `recipe-today` (Phase 3.5).
 *
 * Calcule, pour chaque tuile recipe-today active, le slot du moment
 * (selon l'heure de Paris) dans le plan actif, dénormalise les
 * recettes + profils présents + métadonnées du slot dans le snapshot
 * du display.
 *
 * - refreshRecipeTodayTile : callable, refresh on-demand d'une tuile
 * - scheduledRecipeTodayRefresh : cron toutes les 30 min, refresh
 *   tous les tiles `recipe-today` de tous les foyers
 *
 * Logique du "slot du moment" :
 * - hour < 10  → petit-déj du jour
 * - 10 ≤ h < 15 → déjeuner du jour
 * - 15 ≤ h < 24 → dîner du jour
 *
 * Si le slot du moment est vide (pas de recetteIds), on bascule sur
 * le prochain slot rempli (jusqu'à 2 jours en avant). Si rien dans
 * la fenêtre, on retourne `repasActif: "aucun"`.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { db } from "../lib/admin";
import { assertHouseholdMember } from "../lib/household";
import { rebuildSnapshotForTile } from "../snapshot/builder";
import type {
  Repas,
  RecipeTodayData,
  RecipeTodayRecette,
} from "../types";

const REPAS_ORDER: Repas[] = ["petitDej", "dej", "diner"];

const REPAS_LABEL_TODAY: Record<Repas, string> = {
  petitDej: "Ce matin",
  dej: "Ce midi",
  diner: "Ce soir",
};

const REPAS_LABEL_TOMORROW: Record<Repas, string> = {
  petitDej: "Demain matin",
  dej: "Demain midi",
  diner: "Demain soir",
};

/** Heure courante à Paris (DST géré par Intl) + date ISO du jour à Paris. */
function getNowInParis(): { dateISO: string; hour: number } {
  const now = new Date();
  const hour = parseInt(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hour12: false,
    }).format(now),
    10,
  );
  // en-CA produit YYYY-MM-DD natif
  const dateISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return { dateISO, hour };
}

function deduceRepasFromHour(hour: number): Repas {
  if (hour < 10) return "petitDej";
  if (hour < 15) return "dej";
  return "diner";
}

function nextDayISO(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Itère sur (date, repas) en avançant chronologiquement à partir du point de départ. */
function* slotsAhead(
  startDate: string,
  startRepas: Repas,
  daysHorizon = 2,
): Generator<{ date: string; repas: Repas; dayOffset: number }> {
  let date = startDate;
  let repasIdx = REPAS_ORDER.indexOf(startRepas);
  for (let day = 0; day < daysHorizon; day++) {
    while (repasIdx < REPAS_ORDER.length) {
      yield { date, repas: REPAS_ORDER[repasIdx], dayOffset: day };
      repasIdx++;
    }
    date = nextDayISO(date);
    repasIdx = 0;
  }
}

interface MinimalSlotData {
  id: string;
  recetteIds?: string[];
  profilsPresents?: string[];
  invitesNoms?: string[];
  source?: "fresh" | "batch";
  notes?: string;
}

/**
 * Cherche le premier slot non vide à partir de (currentDate, currentRepas)
 * dans le plan donné. Ne retourne que les slots ayant au moins une recette.
 */
async function findCurrentOrNextSlot(
  householdId: string,
  planId: string,
  currentDate: string,
  currentRepas: Repas,
): Promise<{
  slot: MinimalSlotData;
  date: string;
  repas: Repas;
  dayOffset: number;
} | null> {
  for (const { date, repas, dayOffset } of slotsAhead(
    currentDate,
    currentRepas,
    2,
  )) {
    const q = await db
      .collection(`households/${householdId}/mealPlans/${planId}/slots`)
      .where("date", "==", date)
      .where("repas", "==", repas)
      .get();
    if (q.empty) continue;
    const docSnap = q.docs[0];
    const data = docSnap.data() as MinimalSlotData;
    const ids = data.recetteIds ?? [];
    if (ids.length === 0) continue;
    return {
      slot: { ...data, id: docSnap.id },
      date,
      repas,
      dayOffset,
    };
  }
  return null;
}

async function fetchRecettes(
  householdId: string,
  recetteIds: string[],
): Promise<RecipeTodayRecette[]> {
  if (recetteIds.length === 0) return [];
  const docs = await Promise.all(
    recetteIds.map((rid) =>
      db.doc(`households/${householdId}/recettes/${rid}`).get(),
    ),
  );
  const out: RecipeTodayRecette[] = [];
  for (const d of docs) {
    if (!d.exists) continue;
    const data = d.data() as Record<string, unknown>;
    const tempsPrep = (data.tempsPrepMinutes as number) || 0;
    const tempsCuisson = (data.tempsCuissonMinutes as number) || 0;
    const ingFromFrigo = (data.ingredientsFromFrigo as boolean[]) || [];
    const ingredientsRaw = (data.ingredients as Array<Record<string, unknown>>) || [];
    const etapesRaw = (data.etapes as Array<Record<string, unknown>>) || [];
    out.push({
      recetteId: d.id,
      nom: (data.nom as string) || "(sans nom)",
      ...(data.description ? { description: data.description as string } : {}),
      portions: (data.portions as number) || 4,
      tempsPrepMinutes: tempsPrep,
      tempsCuissonMinutes: tempsCuisson,
      tempsTotalMinutes: tempsPrep + tempsCuisson,
      difficulte: (data.difficulte as number) || 1,
      ingredients: ingredientsRaw.map((ing, idx) => ({
        libelle: String(ing.libelle ?? ""),
        quantite: String(ing.quantite ?? ""),
        unite: String(ing.unite ?? ""),
        ...(ing.rayon ? { rayon: String(ing.rayon) } : {}),
        ...(ingFromFrigo[idx] ? { noteFrigo: true } : {}),
      })),
      etapes: etapesRaw.map((e) => ({
        ordre: Number(e.ordre ?? 0),
        description: String(e.description ?? ""),
        ...(e.dureeMinutes && Number(e.dureeMinutes) > 0
          ? { dureeMinutes: Number(e.dureeMinutes) }
          : {}),
      })),
      tags: (data.tags as string[]) || [],
    });
  }
  return out;
}

interface ProfilSummary {
  id: string;
  nom: string;
  initiale: string;
  couleur: string;
  emoji?: string;
}

async function fetchProfils(
  householdId: string,
  profilIds: string[],
): Promise<ProfilSummary[]> {
  if (profilIds.length === 0) return [];
  const docs = await Promise.all(
    profilIds.map((pid) =>
      db.doc(`households/${householdId}/profils/${pid}`).get(),
    ),
  );
  const out: ProfilSummary[] = [];
  for (const d of docs) {
    if (!d.exists) continue;
    const data = d.data() as Record<string, unknown>;
    const nom = (data.nom as string) || "?";
    out.push({
      id: d.id,
      nom,
      initiale:
        (data.initiale as string) ||
        (nom.charAt(0).toUpperCase() || "?"),
      couleur: (data.couleur as string) || "#888",
      ...(data.emoji ? { emoji: data.emoji as string } : {}),
    });
  }
  return out;
}

/**
 * Construit la donnée recipe-today pour un foyer (lit le plan actif,
 * trouve le slot du moment, dénormalise recettes + profils).
 * Retourne `repasActif: "aucun"` si pas de plan actif ou pas de slot
 * non vide dans la fenêtre 2 jours.
 */
async function buildRecipeTodayData(
  householdId: string,
): Promise<RecipeTodayData> {
  const generatedAtISO = new Date().toISOString();

  const planQ = await db
    .collection(`households/${householdId}/mealPlans`)
    .where("statut", "==", "active")
    .get();
  if (planQ.empty) {
    return {
      repasActif: "aucun",
      recettes: [],
      profilsPresents: [],
      generatedAtISO,
    };
  }
  const planDoc = planQ.docs[0];
  const planId = planDoc.id;

  const { dateISO, hour } = getNowInParis();
  const startRepas = deduceRepasFromHour(hour);

  const found = await findCurrentOrNextSlot(
    householdId,
    planId,
    dateISO,
    startRepas,
  );
  if (!found) {
    return {
      repasActif: "aucun",
      recettes: [],
      profilsPresents: [],
      generatedAtISO,
    };
  }

  const recettes = await fetchRecettes(householdId, found.slot.recetteIds ?? []);
  const profilsPresents = await fetchProfils(
    householdId,
    found.slot.profilsPresents ?? [],
  );

  const isFallback = found.dayOffset > 0 || found.repas !== startRepas;
  const labelMap =
    found.dayOffset === 0 ? REPAS_LABEL_TODAY : REPAS_LABEL_TOMORROW;

  return {
    repasActif: found.repas,
    repasLabel: labelMap[found.repas],
    date: found.date,
    slotId: found.slot.id,
    ...(isFallback ? { isFallbackToNext: true } : {}),
    recettes,
    profilsPresents,
    ...(found.slot.invitesNoms && found.slot.invitesNoms.length > 0
      ? { invitesNoms: found.slot.invitesNoms }
      : {}),
    ...(found.slot.source ? { source: found.slot.source } : {}),
    ...(found.slot.notes ? { notes: found.slot.notes } : {}),
    generatedAtISO,
  };
}

/* --- Cloud Function : refresh on-demand pour une tuile --- */

interface RefreshInput {
  householdId: string;
  tileId: string;
}

export const refreshRecipeTodayTile = onCall<RefreshInput, Promise<{ success: true }>>(
  { region: "europe-west1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");

    const { householdId, tileId } = req.data;
    if (!householdId || !tileId) {
      throw new HttpsError("invalid-argument", "householdId et tileId requis");
    }

    await assertHouseholdMember(uid, householdId);

    const tileSnap = await db
      .doc(`households/${householdId}/tiles/${tileId}`)
      .get();
    if (!tileSnap.exists) {
      throw new HttpsError("not-found", `Tile ${tileId} introuvable`);
    }
    if (tileSnap.data()?.type !== "recipe-today") {
      throw new HttpsError(
        "failed-precondition",
        `Tile ${tileId} n'est pas de type recipe-today`,
      );
    }

    const data = await buildRecipeTodayData(householdId);
    await rebuildSnapshotForTile(householdId, tileId, "recipe-today", data);
    logger.info("refreshRecipeTodayTile DONE", {
      householdId,
      tileId,
      repas: data.repasActif,
      recettesCount: data.recettes.length,
    });
    return { success: true };
  },
);

/* --- Cloud Function : refresh scheduled --- */

export const scheduledRecipeTodayRefresh = onSchedule(
  {
    schedule: "every 30 minutes",
    region: "europe-west1",
    timeZone: "Europe/Paris",
  },
  async () => {
    const tilesSnap = await db
      .collectionGroup("tiles")
      .where("type", "==", "recipe-today")
      .get();
    logger.info(`scheduledRecipeTodayRefresh: ${tilesSnap.size} tile(s)`);

    // On groupe par householdId pour ne calculer la data qu'une fois par foyer.
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
        const data = await buildRecipeTodayData(householdId);
        for (const tileId of tileIds) {
          await rebuildSnapshotForTile(
            householdId,
            tileId,
            "recipe-today",
            data,
          );
        }
        logger.info(
          `[recipe-today] foyer ${householdId} : ${tileIds.length} tile(s), repas=${data.repasActif}`,
        );
      } catch (err) {
        logger.error(
          `[recipe-today] échec refresh foyer ${householdId}`,
          err,
        );
      }
    }
  },
);
