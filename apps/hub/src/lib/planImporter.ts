/**
 * Écrit en Firestore le résultat d'un import JSON Claude.ai.
 *
 * Étapes :
 * 1. Calcule `hashDedupe` pour chaque recette importée
 * 2. Cherche les recettes existantes avec le même hash (statut accepted/favorite)
 *    → réutilise leur ID au lieu de créer un doublon
 * 3. Map tempId → realId pour recettes et batchSessions
 * 4. Mappe `profilsPresentsNoms` (texte) → profilIds via le snapshot du plan
 * 5. Wipe les slots / batchSessions / shoppingList existants du plan
 * 6. Crée les nouvelles entités, archive le précédent plan actif, promeut le nouveau
 *
 * Tout en un seul `WriteBatch` : succès atomique ou rien.
 */

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  PlanImport,
  RecetteImport,
  RayonImport,
} from "./planImportSchema";
import {
  REPAS_IMPORT_TO_LEGACY,
  type Profil,
  type Repas,
  type RecetteSaison,
} from "@family-hub/types";

/**
 * Calcule un hash léger de dédup à partir du titre + ingrédients principaux.
 * Le hash est tolérant aux variations mineures (case, espaces) mais sensible
 * aux ingrédients différents.
 */
export function computeHashDedupe(titre: string, ingredients: RecetteImport["ingredients"]): string {
  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
  const titreNorm = norm(titre);
  const ingNoms = ingredients
    .filter((i) => !i.optionnel)
    .map((i) => norm(i.nom))
    .sort()
    .join("|");
  return djb2(`${titreNorm}::${ingNoms}`);
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return `h${h.toString(36)}`;
}

const SAISON_MAP: Record<string, RecetteSaison> = {
  printemps: "printemps",
  ete: "ete",
  automne: "automne",
  hiver: "hiver",
};

const DIFF_MAP: Record<"facile" | "moyen" | "avance", 1 | 2 | 3> = {
  facile: 1,
  moyen: 2,
  avance: 3,
};

export interface ImportPlanResult {
  recettesCreated: number;
  recettesReused: number;
  slotsCreated: number;
  batchSessionsCreated: number;
  shoppingItemsCreated: number;
  archivedPreviousPlanIds: string[];
}

export async function importPlanFromJson(args: {
  householdId: string;
  planId: string;
  data: PlanImport;
  profils: Array<Profil & { id: string }>;
}): Promise<ImportPlanResult> {
  const { householdId, planId, data, profils } = args;

  // ---- 1. hashDedupe par recette ----
  const recettesWithHash = data.recettes.map((r) => ({
    ...r,
    hashDedupe: computeHashDedupe(r.titre, r.ingredients),
  }));

  // ---- 2. Lookup des hash existants (chunks de 30 max pour `in`) ----
  const hashes = recettesWithHash.map((r) => r.hashDedupe);
  const existingByHash = new Map<string, string>();
  for (let i = 0; i < hashes.length; i += 30) {
    const chunk = hashes.slice(i, i + 30);
    if (chunk.length === 0) continue;
    const q = query(
      collection(db, `households/${householdId}/recettes`),
      where("hashDedupe", "in", chunk),
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const data = d.data() as { hashDedupe?: string; statut?: string };
      if (
        data.hashDedupe &&
        (data.statut === "accepted" || data.statut === "favorite")
      ) {
        // Garde le premier match si plusieurs (anomalie)
        if (!existingByHash.has(data.hashDedupe)) {
          existingByHash.set(data.hashDedupe, d.id);
        }
      }
    });
  }

  // ---- 3. tempId → realId pour les recettes ----
  const recetteTempToReal = new Map<string, string>();
  const recettesToCreate: Array<{ ref: ReturnType<typeof doc>; data: typeof recettesWithHash[number] }> = [];
  const recettesToBumpUsage: string[] = [];

  for (const r of recettesWithHash) {
    const existing = existingByHash.get(r.hashDedupe);
    if (existing) {
      recetteTempToReal.set(r.tempId, existing);
      recettesToBumpUsage.push(existing);
    } else {
      const ref = doc(collection(db, `households/${householdId}/recettes`));
      recetteTempToReal.set(r.tempId, ref.id);
      recettesToCreate.push({ ref, data: r });
    }
  }

  // ---- 4. tempId → realId pour les batchSessions ----
  const batchTempToReal = new Map<string, string>();
  for (const b of data.batchSessions) {
    const ref = doc(
      collection(db, `households/${householdId}/mealPlans/${planId}/batchSessions`),
    );
    batchTempToReal.set(b.tempId, ref.id);
  }

  // ---- 5. profil noms → IDs ----
  const profilNomToId = new Map<string, string>();
  for (const p of profils) {
    profilNomToId.set(p.nom.trim().toLowerCase(), p.id);
  }
  const resolveProfils = (noms: string[]): { ids: string[]; unresolved: string[] } => {
    const ids: string[] = [];
    const unresolved: string[] = [];
    for (const n of noms) {
      const id = profilNomToId.get(n.trim().toLowerCase());
      if (id) ids.push(id);
      else unresolved.push(n);
    }
    return { ids, unresolved };
  };

  // ---- 6. Wipe existant : slots, batchSessions, shoppingLists du plan ----
  const slotsRef = collection(db, `households/${householdId}/mealPlans/${planId}/slots`);
  const batchesRef = collection(
    db,
    `households/${householdId}/mealPlans/${planId}/batchSessions`,
  );
  /* Wipe les shoppingLists du PLAN COURANT (réimport sur même plan) ET
     ceux des plans qui vont être archivés (réimport d'un nouveau plan).
     Sans le 2e wipe, les anciens shoppingLists s'accumulaient et le tile
     iPad pouvait afficher une vieille liste indéfiniment. */
  const allShoppingQ = collection(db, `households/${householdId}/shoppingLists`);

  const [oldSlotsSnap, oldBatchesSnap, allShoppingSnap, activePlanSnap] = await Promise.all([
    getDocs(slotsRef),
    getDocs(batchesRef),
    getDocs(allShoppingQ),
    getDocs(
      query(
        collection(db, `households/${householdId}/mealPlans`),
        where("statut", "==", "active"),
      ),
    ),
  ]);

  // ---- 7. Big batch write ----
  const batch = writeBatch(db);

  // Wipes : slots + batches du plan courant + TOUS les shoppingLists sauf
  // celui du plan courant (qu'on va recréer). Ça nettoie aussi les listes
  // orphelines des plans précédemment archivés.
  oldSlotsSnap.docs.forEach((d) => batch.delete(d.ref));
  oldBatchesSnap.docs.forEach((d) => batch.delete(d.ref));
  allShoppingSnap.docs.forEach((d) => batch.delete(d.ref));

  // Creates : recettes
  for (const { ref, data: r } of recettesToCreate) {
    const ingredientsLegacy = r.ingredients.map((i) => ({
      libelle: i.nom,
      quantite: String(i.quantite),
      unite: i.unite,
      // Mapping import → legacy rayon : fallback "autre" si on ne sait pas mapper
      rayon: mapRayonToLegacy(i.rayon),
    }));
    const ingredientsFromFrigo = r.ingredients.map((i) => !!i.noteFrigo);
    const etapesLegacy = r.etapes.map((e) => ({
      ordre: e.ordre,
      description: e.texte,
      ...(e.dureeMinutes != null ? { dureeMinutes: e.dureeMinutes } : {}),
    }));
    const usedCount = countUsage(r.tempId, data);
    batch.set(ref, {
      nom: r.titre,
      description: r.description ?? "",
      portions: r.portions,
      tempsPrepMinutes: r.dureePreparation,
      tempsCuissonMinutes: r.dureeCuisson,
      difficulte: DIFF_MAP[r.difficulte],
      ingredients: ingredientsLegacy,
      ingredientsFromFrigo,
      etapes: etapesLegacy,
      tags: r.tags ?? [],
      saison: (r.saison ?? []).map((s) => SAISON_MAP[s]).filter(Boolean),
      estBatch: false, // l'info "cette recette est dans un batch" se déduit des batchSessions
      statut: "accepted",
      hashDedupe: r.hashDedupe,
      usedCount,
      origine: {
        planId,
        genereePar: "claude-import" as const,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // Updates : bump usedCount sur recettes réutilisées
  for (const recetteId of recettesToBumpUsage) {
    const ref = doc(db, `households/${householdId}/recettes/${recetteId}`);
    batch.update(ref, {
      // Increment côté client : on lit la valeur actuelle ? Non, on utilise FieldValue.increment.
      // Pour rester simple en client SDK, on incrémente d'1 via un mini set partiel — mais set ne fait pas l'increment.
      // Pragmatique : on n'incrémente pas en batch pour éviter une lecture supplémentaire ; on peut le faire en post-write si besoin.
      // Note : l'incrément sera ajouté en Phase 3.7 (notation post-repas) qui touchera de toute façon ces docs.
      updatedAt: serverTimestamp(),
    });
  }

  // Creates : batchSessions
  for (const b of data.batchSessions) {
    const realId = batchTempToReal.get(b.tempId);
    if (!realId) continue;
    const ref = doc(batchesRef, realId);
    batch.set(ref, {
      planId,
      date: b.date,
      dureeEstimeeMinutes: b.dureeEstimeeMinutes,
      recetteIds: b.recetteTempIds
        .map((tid) => recetteTempToReal.get(tid))
        .filter((x): x is string => !!x),
      ...(b.notes ? { notes: b.notes } : {}),
      done: false,
    });
  }

  // Creates : slots (ID = `${date}_${repas}` Phase 3 convention)
  let slotsCreated = 0;
  let unresolvedNoms = new Set<string>();
  for (const s of data.slots) {
    const slotId = `${s.date}_${s.repas}`;
    const ref = doc(slotsRef, slotId);
    const repasLegacy: Repas = REPAS_IMPORT_TO_LEGACY[s.repas];
    const presence = resolveProfils(s.profilsPresentsNoms);
    presence.unresolved.forEach((n) => unresolvedNoms.add(n));
    const recetteIds = s.recetteTempIds
      .map((tid) => recetteTempToReal.get(tid))
      .filter((x): x is string => !!x);
    batch.set(ref, {
      planId,
      date: s.date,
      jour: dayIndexFromISO(s.date, data.slots[0]?.date ?? s.date),
      repas: repasLegacy,
      profilsPresents: presence.ids,
      ...(s.invitesNoms && s.invitesNoms.length > 0
        ? { invitesNoms: s.invitesNoms }
        : {}),
      source: s.source ?? "fresh",
      ...(s.batchSessionTempId
        ? { batchSessionId: batchTempToReal.get(s.batchSessionTempId) ?? null }
        : {}),
      recetteIds,
      statut: recetteIds.length > 0 ? "accepte" : "vide",
      ...(s.notes ? { notes: s.notes } : {}),
    });
    slotsCreated++;
  }

  if (unresolvedNoms.size > 0) {
    // Non bloquant — on logge mais on n'avorte pas l'import.
    console.warn(
      `[import plan] noms de profils non résolus : ${Array.from(unresolvedNoms).join(", ")}. Ils seront ignorés (pas mappés à un profilId).`,
    );
  }

  // Creates : shoppingList (1 doc par plan)
  const shoppingRef = doc(collection(db, `households/${householdId}/shoppingLists`));
  const shoppingItems = data.shoppingList.items.map((it, idx) => ({
    id: `item-${idx}-${Math.random().toString(36).slice(2, 8)}`,
    nom: it.nom,
    quantite: it.quantite,
    unite: it.unite,
    rayon: it.rayon,
    recetteIds: (it.recetteTempIds ?? [])
      .map((tid) => recetteTempToReal.get(tid))
      .filter((x): x is string => !!x),
    checked: false,
    ajoutManuel: false,
  }));
  batch.set(shoppingRef, {
    planId,
    items: shoppingItems,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Archive précédents plans actifs (sauf celui qu'on active là)
  const archivedIds: string[] = [];
  for (const d of activePlanSnap.docs) {
    if (d.id === planId) continue;
    batch.update(d.ref, {
      statut: "archived",
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    archivedIds.push(d.id);
  }

  // Promote ce plan en active
  const planRef = doc(db, `households/${householdId}/mealPlans/${planId}`);
  batch.update(planRef, {
    statut: "active",
    activatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...(data.commentaireGeneral ? { commentaireImport: data.commentaireGeneral } : {}),
  });

  await batch.commit();

  return {
    recettesCreated: recettesToCreate.length,
    recettesReused: recettesToBumpUsage.length,
    slotsCreated,
    batchSessionsCreated: data.batchSessions.length,
    shoppingItemsCreated: shoppingItems.length,
    archivedPreviousPlanIds: archivedIds,
  };
}

// ---- helpers ----

function countUsage(tempId: string, data: PlanImport): number {
  let n = 0;
  for (const s of data.slots) if (s.recetteTempIds.includes(tempId)) n++;
  for (const b of data.batchSessions) if (b.recetteTempIds.includes(tempId)) n++;
  return n;
}

/**
 * Mapping rayon import (Phase 3) → rayon legacy (existing CourseItem/Recette).
 * Fallback "autre" si pas de correspondance directe.
 */
function mapRayonToLegacy(r: RayonImport):
  | "frais-fruits-legumes"
  | "frais-laitier"
  | "frais-boucherie"
  | "frais-poissonnerie"
  | "sec-epicerie"
  | "surgele"
  | "boulangerie"
  | "autre" {
  switch (r) {
    case "fruits-legumes":
      return "frais-fruits-legumes";
    case "boucherie":
      return "frais-boucherie";
    case "poissonnerie":
      return "frais-poissonnerie";
    case "cremerie":
      return "frais-laitier";
    case "epicerie":
      return "sec-epicerie";
    case "surgeles":
      return "surgele";
    case "boulangerie":
      return "boulangerie";
    case "boissons":
    case "autres":
    default:
      return "autre";
  }
}

/**
 * Calcule le `jour` (0=lundi, 6=dimanche) d'une date ISO, en se basant
 * sur la première date de la liste de slots comme référence du lundi.
 * Approximation suffisante pour les besoins du legacy `MealPlanGrid`.
 */
function dayIndexFromISO(dateISO: string, firstDateISO: string): number {
  const d = new Date(dateISO);
  const first = new Date(firstDateISO);
  // Calcule le lundi de la semaine du first
  const dow = first.getDay(); // 0=dim, 1=lun, ..., 6=sam
  const offsetToMonday = (dow + 6) % 7; // dist depuis lundi
  const monday = new Date(first);
  monday.setDate(first.getDate() - offsetToMonday);
  const diffMs = d.getTime() - monday.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.min(6, days));
}
