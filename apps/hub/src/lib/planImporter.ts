/**
 * Écrit en Firestore le résultat d'un import JSON Claude.ai.
 *
 * Étapes :
 * 1. Calcule `hashDedupe` pour chaque recette importée
 * 2. Cherche les recettes existantes avec le même hash (statut accepted/favorite)
 *    → réutilise leur ID au lieu de créer un doublon
 * 3. Map tempId → realId pour recettes et batchSessions
 * 4. Mappe `profilsPresentsNoms` (texte) → profilIds via le snapshot du plan
 * 5. Wipe les slots / batchSessions existants du plan
 * 6. Crée les nouvelles entités, archive le précédent plan actif, promeut le nouveau
 * 7. Liste de courses (format 2, un document par article) :
 *    - ré-import du même plan : même document de liste, articles fusionnés
 *      (`fusionnerReimport`) — le tri, les coches et les oublis survivent ;
 *      une liste encore à l'ancien format est convertie au passage ;
 *    - nouveau plan : liste neuve, avec les oublis non cochés de la liste du
 *      plan actif précédent (`oublisAReporter`).
 *
 * Lot principal atomique (plan, slots, recettes, batchs, document de liste,
 * archives). Les articles y sont aussi tant que le total tient sous
 * `MAX_OPS_LOT` (import entièrement atomique) ; au-delà, ils partent juste
 * après, en lots supplémentaires (`ecrireParLots`).
 */

import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type QuerySnapshot,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { ecrireParLots } from "./ecritureParLots";
import {
  articlesDuPlan,
  doitMigrer,
  fusionnerReimport,
  migrerArticles,
  oublisAReporter,
  type ArticleAvecId,
} from "./listeCourses";
import type {
  PlanImport,
  RecetteImport,
  RayonImport,
} from "./planImportSchema";
import {
  estProduitPlacard,
  REPAS_IMPORT_TO_LEGACY,
  type ArticleCourses,
  type Household,
  type Profil,
  type ShoppingList,
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

/** Sous la limite Firestore de 500 écritures par lot, avec de la marge. */
const MAX_OPS_LOT = 450;

export interface ImportPlanResult {
  recettesCreated: number;
  recettesReused: number;
  slotsCreated: number;
  batchSessionsCreated: number;
  shoppingItemsCreated: number;
  archivedPreviousPlanIds: string[];
  /** Noms de `profilsPresentsNoms` non rattachés à un profil (ignorés). */
  unresolvedProfilNoms: string[];
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
  // Normalise les accents (NFD + suppression des diacritiques) pour que
  // "Léa" et "Lea" matchent le même profil.
  const normalizeNom = (s: string): string =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();
  const profilNomToId = new Map<string, string>();
  for (const p of profils) {
    profilNomToId.set(normalizeNom(p.nom), p.id);
  }
  const resolveProfils = (noms: string[]): { ids: string[]; unresolved: string[] } => {
    const ids: string[] = [];
    const unresolved: string[] = [];
    for (const n of noms) {
      const id = profilNomToId.get(normalizeNom(n));
      if (id) ids.push(id);
      else unresolved.push(n);
    }
    return { ids, unresolved };
  };

  // ---- 6. Lectures : slots, batchSessions, listes du plan, plans actifs, foyer ----
  const slotsRef = collection(db, `households/${householdId}/mealPlans/${planId}/slots`);
  const batchesRef = collection(
    db,
    `households/${householdId}/mealPlans/${planId}/batchSessions`,
  );
  /* Listes du PLAN COURANT seulement (ré-import) : les listes des autres
     plans ne sont jamais touchées. */
  const planShoppingQ = query(
    collection(db, `households/${householdId}/shoppingLists`),
    where("planId", "==", planId),
  );

  const [oldSlotsSnap, oldBatchesSnap, planShoppingSnap, activePlanSnap, householdSnap] =
    await Promise.all([
    getDocs(slotsRef),
    getDocs(batchesRef),
    getDocs(planShoppingQ),
    getDocs(
      query(
        collection(db, `households/${householdId}/mealPlans`),
        where("statut", "==", "active"),
      ),
    ),
    getDoc(doc(db, `households/${householdId}`)),
  ]);
  // Produits de placard du foyer ; absent = liste par défaut.
  const placardFoyer = (householdSnap.data() as Household | undefined)?.parametres?.placard;
  const estPlacard = (nom: string) => estProduitPlacard(nom, placardFoyer);

  // Articles des listes du plan (ré-import), en sous-collection `items`.
  const oldShoppingItemsSnaps = await Promise.all(
    planShoppingSnap.docs.map((d) => getDocs(collection(d.ref, "items"))),
  );

  // Nouveau plan : articles des listes du (des) plan(s) actif(s) précédent(s),
  // pour reporter leurs oublis. Inutile en ré-import (la fusion les garde).
  const plansPrecedents = activePlanSnap.docs.map((d) => d.id).filter((id) => id !== planId);
  const articlesPrecedents: ArticleCourses[] = [];
  if (planShoppingSnap.empty && plansPrecedents.length > 0) {
    const listesPrecedentes = await getDocs(
      query(
        collection(db, `households/${householdId}/shoppingLists`),
        where("planId", "in", plansPrecedents.slice(0, 30)),
      ),
    );
    const itemsPrecedents = await Promise.all(
      listesPrecedentes.docs.map((d) => getDocs(collection(d.ref, "items"))),
    );
    listesPrecedentes.docs.forEach((d, i) => {
      articlesPrecedents.push(
        ...articlesDeListe(d.data() as ShoppingList, itemsPrecedents[i], estPlacard),
      );
    });
  }

  // ---- 7. Big batch write ----
  const batch = writeBatch(db);

  /** Écritures du lot principal (pour décider où vont les articles). */
  let opsPrincipales = 0;

  // Wipes : slots + batches du plan courant (recréés plus bas).
  oldSlotsSnap.docs.forEach((d) => batch.delete(d.ref));
  oldBatchesSnap.docs.forEach((d) => batch.delete(d.ref));
  opsPrincipales += oldSlotsSnap.size + oldBatchesSnap.size;

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
  // `jour` est ancré sur la date MINIMALE des slots (pas le 1ᵉ élément du
  // tableau, qui n'est pas forcément le plus tôt) pour que des dates distinctes
  // donnent des index distincts.
  const slotDates = data.slots.map((s) => s.date).sort();
  const minSlotDate = slotDates.length > 0 ? slotDates[0] : undefined;
  // Tri chronologique stable (par date, puis ordre des repas) pour que les
  // slots soient écrits dans l'ordre du calendrier.
  const REPAS_ORDER: Record<string, number> = {
    "petit-dej": 0,
    dejeuner: 1,
    diner: 2,
  };
  const slotsSorted = [...data.slots].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (REPAS_ORDER[a.repas] ?? 99) - (REPAS_ORDER[b.repas] ?? 99);
  });
  let slotsCreated = 0;
  const unresolvedNoms = new Set<string>();
  for (const s of slotsSorted) {
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
      jour: dayIndexFromISO(s.date, minSlotDate ?? s.date),
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

  opsPrincipales +=
    recettesToCreate.length + recettesToBumpUsage.length + data.batchSessions.length + slotsCreated;

  // Liste de courses (1 doc par plan, format 2 : articles en sous-collection)
  const nouveauxArticles = articlesDuPlan(
    data.shoppingList.items.map((it) => ({
      nom: it.nom,
      quantite: it.quantite,
      unite: it.unite,
      rayon: it.rayon,
      recetteIds: (it.recetteTempIds ?? [])
        .map((tid) => recetteTempToReal.get(tid))
        .filter((x): x is string => !!x),
      placard: it.placard,
    })),
    placardFoyer,
  );
  /** Écritures d'articles : dans le lot principal ou en lots supplémentaires. */
  const opsArticles: Array<(b: WriteBatch) => void> = [];
  const listeExistante = planShoppingSnap.docs[0];
  if (listeExistante) {
    // Ré-import : même document de liste, articles fusionnés.
    const itemsCol = collection(listeExistante.ref, "items");
    const itemsSnap = oldShoppingItemsSnaps[0];
    const idsEnBase = new Set(itemsSnap.docs.map((d) => d.id));
    const existants = articlesDeListe(listeExistante.data() as ShoppingList, itemsSnap, estPlacard);
    const { aEcrire, aSupprimer } = fusionnerReimport(existants, nouveauxArticles);
    for (const { id, data: article } of aEcrire) {
      const ref = id ? doc(itemsCol, id) : doc(itemsCol);
      const valeur = id ? article : { ...article, createdAt: serverTimestamp() };
      opsArticles.push((b) => b.set(ref, valeur));
    }
    // Un id issu de l'ancien tableau n'a pas de document : rien à effacer.
    for (const id of aSupprimer) {
      if (idsEnBase.has(id)) opsArticles.push((b) => b.delete(doc(itemsCol, id)));
    }
    // Ancien format : le tableau disparaît, la liste passe au format 2.
    batch.update(listeExistante.ref, {
      format: 2,
      items: deleteField(),
      updatedAt: serverTimestamp(),
    });
    opsPrincipales += 1;
    // Anomalie : plusieurs listes pour ce plan → seule la première est gardée.
    planShoppingSnap.docs.slice(1).forEach((d, i) => {
      batch.delete(d.ref);
      opsPrincipales += 1;
      oldShoppingItemsSnaps[i + 1].docs.forEach((it) => opsArticles.push((b) => b.delete(it.ref)));
    });
  } else {
    // Nouveau plan : liste neuve + oublis non cochés du plan précédent.
    const listeRef = doc(collection(db, `households/${householdId}/shoppingLists`));
    const itemsCol = collection(listeRef, "items");
    batch.set(listeRef, {
      planId,
      format: 2,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    opsPrincipales += 1;
    const articles = [...nouveauxArticles, ...oublisAReporter(articlesPrecedents, nouveauxArticles)];
    for (const article of articles) {
      const ref = doc(itemsCol);
      opsArticles.push((b) => b.set(ref, { ...article, createdAt: serverTimestamp() }));
    }
  }

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
    opsPrincipales += 1;
  }

  // Réécrit dateDebut/dateFin du plan à partir des vraies dates des slots
  // importés. Évite le bug où le wizard pose dateDebut=lundi mais le JSON
  // contient des slots qui débordent (avant lundi ou après dimanche).
  const slotDatesSorted = data.slots
    .map((s) => s.date)
    .filter((d): d is string => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  const planDateUpdates: { dateDebut?: Date; dateFin?: Date } = {};
  if (slotDatesSorted.length > 0) {
    const minISO = slotDatesSorted[0];
    const maxISO = slotDatesSorted[slotDatesSorted.length - 1];
    // Construit en local pour respecter la timezone du foyer.
    const [ymin, mmin, dmin] = minISO.split("-").map(Number);
    const [ymax, mmax, dmax] = maxISO.split("-").map(Number);
    planDateUpdates.dateDebut = new Date(ymin, mmin - 1, dmin, 0, 0, 0, 0);
    planDateUpdates.dateFin = new Date(ymax, mmax - 1, dmax, 23, 59, 59, 999);
  }

  // Promote ce plan en active
  const planRef = doc(db, `households/${householdId}/mealPlans/${planId}`);
  batch.update(planRef, {
    statut: "active",
    activatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...planDateUpdates,
    ...(data.commentaireGeneral ? { commentaireImport: data.commentaireGeneral } : {}),
  });

  opsPrincipales += 1; // promotion du plan

  /* Articles dans le lot principal si tout tient (import entièrement
     atomique) ; sinon le lot principal part d'abord, puis les articles. */
  if (opsPrincipales + opsArticles.length <= MAX_OPS_LOT) {
    opsArticles.forEach((op) => op(batch));
    await batch.commit();
  } else {
    await batch.commit();
    await ecrireParLots(() => writeBatch(db), opsArticles, MAX_OPS_LOT);
  }

  return {
    recettesCreated: recettesToCreate.length,
    recettesReused: recettesToBumpUsage.length,
    slotsCreated,
    batchSessionsCreated: data.batchSessions.length,
    shoppingItemsCreated: nouveauxArticles.length,
    archivedPreviousPlanIds: archivedIds,
    unresolvedProfilNoms: Array.from(unresolvedNoms),
  };
}

// ---- helpers ----

/**
 * Articles d'une liste existante : sous-collection (format 2) ou, pour une
 * liste encore à l'ancien format, conversion en mémoire du tableau (mêmes ids
 * que la migration des téléphones) pour que tri et coches survivent.
 */
function articlesDeListe(
  liste: ShoppingList,
  itemsSnap: QuerySnapshot,
  estPlacard: (nom: string) => boolean,
): ArticleAvecId[] {
  if (doitMigrer(liste)) {
    return migrerArticles(liste.items ?? [], estPlacard).map(({ id, data }) => ({ ...data, id }));
  }
  return itemsSnap.docs.map((d) => ({ ...(d.data() as ArticleCourses), id: d.id }));
}

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
 * Calcule le `jour` = offset en jours depuis la date MINIMALE des slots.
 * Champ legacy : la grille principale utilise désormais `slot.date`. On
 * conserve `jour` pour le tri et la rétro-compat des consommateurs qui ne
 * lisent pas encore `date`. Pas de clamp à 6 — un plan peut dépasser 7 jours.
 *
 * L'ancre `anchorDateISO` doit être la date la plus tôt des slots : tous les
 * offsets sont alors >= 0 sans clamp, et des dates distinctes donnent des
 * index distincts (pas de collapse à 0).
 *
 * Note : on ancre à midi pour neutraliser les sauts d'heure d'été.
 */
function dayIndexFromISO(dateISO: string, anchorDateISO: string): number {
  const d = new Date(`${dateISO}T12:00:00`);
  const anchor = new Date(`${anchorDateISO}T12:00:00`);
  const diffMs = d.getTime() - anchor.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}
