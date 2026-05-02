import { useQuery } from "@tanstack/react-query";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  CourseItem,
  Display,
  Household,
  MealPlan,
  MealPlanSlot,
  Profil,
  Recette,
  Tile,
  User,
} from "@family-hub/types";

export function useUserDoc(uid: string | undefined) {
  return useQuery({
    enabled: !!uid,
    queryKey: ["user", uid],
    queryFn: async (): Promise<User | null> => {
      if (!uid) return null;
      const snap = await getDoc(doc(db, `users/${uid}`));
      return snap.exists() ? (snap.data() as User) : null;
    },
  });
}

export function useHouseholds(uid: string | undefined) {
  return useQuery({
    enabled: !!uid,
    queryKey: ["households", uid],
    queryFn: async (): Promise<Array<Household & { id: string }>> => {
      if (!uid) return [];
      const q = query(collection(db, "households"), where("membres", "array-contains", uid));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Household) }));
    },
  });
}

export function useDisplays(householdId: string | undefined) {
  return useQuery({
    enabled: !!householdId,
    queryKey: ["displays", householdId],
    queryFn: async (): Promise<Array<Display & { id: string }>> => {
      if (!householdId) return [];
      const snap = await getDocs(collection(db, `households/${householdId}/displays`));
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Display) }));
    },
  });
}

export function useTiles(householdId: string | undefined) {
  return useQuery({
    enabled: !!householdId,
    queryKey: ["tiles", householdId],
    queryFn: async (): Promise<Array<Tile & { id: string }>> => {
      if (!householdId) return [];
      const snap = await getDocs(collection(db, `households/${householdId}/tiles`));
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Tile) }));
    },
  });
}

export function useDisplay(householdId: string | undefined, displayId: string | undefined) {
  return useQuery({
    enabled: !!householdId && !!displayId,
    queryKey: ["display", householdId, displayId],
    queryFn: async (): Promise<(Display & { id: string }) | null> => {
      if (!householdId || !displayId) return null;
      const snap = await getDoc(doc(db, `households/${householdId}/displays/${displayId}`));
      return snap.exists() ? ({ id: snap.id, ...(snap.data() as Display) }) : null;
    },
  });
}

export function useTile(householdId: string | undefined, tileId: string | undefined) {
  return useQuery({
    enabled: !!householdId && !!tileId,
    queryKey: ["tile", householdId, tileId],
    queryFn: async (): Promise<(Tile & { id: string }) | null> => {
      if (!householdId || !tileId) return null;
      const snap = await getDoc(doc(db, `households/${householdId}/tiles/${tileId}`));
      return snap.exists() ? ({ id: snap.id, ...(snap.data() as Tile) }) : null;
    },
  });
}

/**
 * Convenience hook for "the current household" — Phase 1, on prend le premier
 * (chaque user en a typiquement un seul). À étendre plus tard avec un sélecteur.
 */
export function useActiveHouseholdId(uid: string | undefined): string | undefined {
  const { data } = useHouseholds(uid);
  return data?.[0]?.id;
}

export function useProfils(householdId: string | undefined) {
  return useQuery({
    enabled: !!householdId,
    queryKey: ["profils", householdId],
    queryFn: async (): Promise<Array<Profil & { id: string }>> => {
      if (!householdId) return [];
      const snap = await getDocs(collection(db, `households/${householdId}/profils`));
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Profil) }))
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    },
  });
}

/* --- Kitchen Buddy : plans, slots, recettes, courses --- */

export type MealPlanWithId = MealPlan & { id: string };
export type MealPlanSlotWithId = MealPlanSlot & { id: string };
export type RecetteWithId = Recette & { id: string };
export type CourseItemWithId = CourseItem & { id: string };

/**
 * Récupère le plan actif (statut === "active"), null si aucun.
 * Si plusieurs (anomalie), retourne le plus récent.
 */
export function useActivePlan(householdId: string | undefined) {
  return useQuery({
    enabled: !!householdId,
    queryKey: ["activePlan", householdId],
    queryFn: async (): Promise<MealPlanWithId | null> => {
      if (!householdId) return null;
      const q = query(
        collection(db, `households/${householdId}/mealPlans`),
        where("statut", "==", "active"),
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...(snap.docs[0].data() as MealPlan) };
    },
  });
}

/**
 * Récupère le plan en cours d'édition (draft) le plus récent, null si aucun.
 */
export function useDraftPlan(householdId: string | undefined) {
  return useQuery({
    enabled: !!householdId,
    queryKey: ["draftPlan", householdId],
    queryFn: async (): Promise<MealPlanWithId | null> => {
      if (!householdId) return null;
      const q = query(
        collection(db, `households/${householdId}/mealPlans`),
        where("statut", "==", "draft"),
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...(snap.docs[0].data() as MealPlan) };
    },
  });
}

export function usePlan(householdId: string | undefined, planId: string | undefined) {
  return useQuery({
    enabled: !!householdId && !!planId,
    queryKey: ["plan", householdId, planId],
    queryFn: async (): Promise<MealPlanWithId | null> => {
      if (!householdId || !planId) return null;
      const snap = await getDoc(doc(db, `households/${householdId}/mealPlans/${planId}`));
      return snap.exists() ? { id: snap.id, ...(snap.data() as MealPlan) } : null;
    },
  });
}

export function usePlanSlots(householdId: string | undefined, planId: string | undefined) {
  return useQuery({
    enabled: !!householdId && !!planId,
    queryKey: ["planSlots", householdId, planId],
    queryFn: async (): Promise<MealPlanSlotWithId[]> => {
      if (!householdId || !planId) return [];
      const snap = await getDocs(
        collection(db, `households/${householdId}/mealPlans/${planId}/slots`),
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as MealPlanSlot) }))
        .sort((a, b) => {
          if (a.jour !== b.jour) return a.jour - b.jour;
          const order = { petitDej: 0, dej: 1, diner: 2 };
          return order[a.repas] - order[b.repas];
        });
    },
  });
}

export function usePlanCourses(householdId: string | undefined, planId: string | undefined) {
  return useQuery({
    enabled: !!householdId && !!planId,
    queryKey: ["planCourses", householdId, planId],
    queryFn: async (): Promise<CourseItemWithId[]> => {
      if (!householdId || !planId) return [];
      const snap = await getDocs(
        collection(db, `households/${householdId}/mealPlans/${planId}/courses`),
      );
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as CourseItem) }));
    },
  });
}

/**
 * Toutes les recettes du foyer (livre de recettes).
 * Trie : favorites en premier, puis par création récente.
 */
export function useRecettes(householdId: string | undefined) {
  return useQuery({
    enabled: !!householdId,
    queryKey: ["recettes", householdId],
    queryFn: async (): Promise<RecetteWithId[]> => {
      if (!householdId) return [];
      const snap = await getDocs(collection(db, `households/${householdId}/recettes`));
      const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Recette) }));
      // Tri : favorites > accepted (non-excluded) > excluded, puis alpha
      const score = (r: RecetteWithId): number => {
        if (r.excluded) return 3;
        if (r.statut === "favorite") return 0;
        if (r.statut === "accepted") return 1;
        return 2;
      };
      return all.sort((a, b) => {
        const sa = score(a);
        const sb = score(b);
        if (sa !== sb) return sa - sb;
        return a.nom.localeCompare(b.nom, "fr");
      });
    },
  });
}

/**
 * Recettes référencées par le plan (jointure côté client : on lit les IDs
 * référencés par les slots, puis on charge les docs correspondants).
 */
export function usePlanRecettes(
  householdId: string | undefined,
  slots: MealPlanSlotWithId[] | undefined,
) {
  const recetteIds = Array.from(new Set((slots ?? []).flatMap((s) => s.recetteIds)));
  return useQuery({
    enabled: !!householdId && recetteIds.length > 0,
    queryKey: ["planRecettes", householdId, recetteIds.sort().join(",")],
    queryFn: async (): Promise<Record<string, RecetteWithId>> => {
      if (!householdId || recetteIds.length === 0) return {};
      const docs = await Promise.all(
        recetteIds.map((rid) =>
          getDoc(doc(db, `households/${householdId}/recettes/${rid}`)),
        ),
      );
      const out: Record<string, RecetteWithId> = {};
      for (const d of docs) {
        if (d.exists()) {
          out[d.id] = { id: d.id, ...(d.data() as Recette) };
        }
      }
      return out;
    },
  });
}
