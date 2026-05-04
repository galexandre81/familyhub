import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import type {
  DisplayDeviceType,
  DisplayLayoutEntry,
  GridConfig,
  HouseholdParametres,
  Profil,
  Resolution,
  ShoppingListItem,
  TileType,
  Theme,
} from "@family-hub/types";

interface CreateHouseholdInput {
  uid: string;
  nom: string;
  parametres: HouseholdParametres;
}

export function useCreateHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ uid, nom, parametres }: CreateHouseholdInput) => {
      const householdRef = await addDoc(collection(db, "households"), {
        nom,
        ownerUid: uid,
        membres: [uid],
        parametres,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, `users/${uid}`),
        {
          householdsIds: arrayUnion(householdRef.id),
          defaultHouseholdId: householdRef.id,
        },
        { merge: true },
      );

      return householdRef.id;
    },
    onSuccess: (_id, vars) => {
      void qc.invalidateQueries({ queryKey: ["households", vars.uid] });
      void qc.invalidateQueries({ queryKey: ["user", vars.uid] });
    },
  });
}

interface UpdateHouseholdInput {
  uid: string;
  householdId: string;
  patch: Partial<{
    nom: string;
    parametres: HouseholdParametres;
  }>;
}

export function useUpdateHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ householdId, patch }: UpdateHouseholdInput) => {
      await updateDoc(doc(db, `households/${householdId}`), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["households", vars.uid] });
    },
  });
}

interface CreateDisplayInput {
  householdId: string;
  nom: string;
  type: DisplayDeviceType;
  resolution: Resolution;
  theme: Theme;
  gridConfig: GridConfig;
}

export function useCreateDisplay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDisplayInput) => {
      const { householdId, ...rest } = input;
      const ref = await addDoc(collection(db, `households/${householdId}/displays`), {
        ...rest,
        layout: [] as DisplayLayoutEntry[],
        authToken: "",
        authTokenExpiresAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    },
    onSuccess: (_id, vars) => {
      void qc.invalidateQueries({ queryKey: ["displays", vars.householdId] });
    },
  });
}

interface UpdateDisplayLayoutInput {
  householdId: string;
  displayId: string;
  layout: DisplayLayoutEntry[];
}

export function useUpdateDisplayLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ householdId, displayId, layout }: UpdateDisplayLayoutInput) => {
      await updateDoc(doc(db, `households/${householdId}/displays/${displayId}`), {
        layout,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["displays", vars.householdId] });
      void qc.invalidateQueries({ queryKey: ["display", vars.householdId, vars.displayId] });
    },
  });
}

interface DeleteDisplayInput {
  householdId: string;
  displayId: string;
}

export function useDeleteDisplay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ householdId, displayId }: DeleteDisplayInput) => {
      await deleteDoc(doc(db, `households/${householdId}/displays/${displayId}`));
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["displays", vars.householdId] });
    },
  });
}

interface RefreshWeatherTileResponse {
  success: boolean;
}

export function useRefreshWeatherTile() {
  return useMutation({
    mutationFn: async ({
      householdId,
      tileId,
    }: {
      householdId: string;
      tileId: string;
    }): Promise<RefreshWeatherTileResponse> => {
      const fn = httpsCallable<
        { householdId: string; tileId: string },
        RefreshWeatherTileResponse
      >(functions, "refreshWeatherTile");
      const res = await fn({ householdId, tileId });
      return res.data;
    },
  });
}

interface SyncCalendarTileResponse {
  success: boolean;
  eventsCount: number;
}

export function useSyncCalendarTile() {
  return useMutation({
    mutationFn: async ({
      householdId,
      tileId,
    }: {
      householdId: string;
      tileId: string;
    }): Promise<SyncCalendarTileResponse> => {
      const fn = httpsCallable<
        { householdId: string; tileId: string },
        SyncCalendarTileResponse
      >(functions, "syncCalendarTile");
      const res = await fn({ householdId, tileId });
      return res.data;
    },
  });
}

interface CreateDisplayTokenResponse {
  setupToken: string;
  setupShortId: string;
  expiresAt: number;
  setupUrl: string;
  shortUrl: string;
}

export function useCreateDisplayToken() {
  return useMutation({
    mutationFn: async ({
      householdId,
      displayId,
    }: {
      householdId: string;
      displayId: string;
    }): Promise<CreateDisplayTokenResponse> => {
      const fn = httpsCallable<
        { householdId: string; displayId: string },
        CreateDisplayTokenResponse
      >(functions, "createDisplayToken");
      const res = await fn({ householdId, displayId });
      return res.data;
    },
  });
}

interface CreateTileInput {
  householdId: string;
  type: TileType;
  nom: string;
  config: Record<string, unknown>;
  refreshIntervalSeconds: number;
}

export function useCreateTile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTileInput) => {
      const { householdId, ...rest } = input;
      const ref = await addDoc(collection(db, `households/${householdId}/tiles`), {
        ...rest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    },
    onSuccess: (_id, vars) => {
      void qc.invalidateQueries({ queryKey: ["tiles", vars.householdId] });
    },
  });
}

interface UpdateTileInput {
  householdId: string;
  tileId: string;
  patch: Partial<{
    nom: string;
    config: Record<string, unknown>;
    refreshIntervalSeconds: number;
  }>;
}

export function useUpdateTile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ householdId, tileId, patch }: UpdateTileInput) => {
      await updateDoc(doc(db, `households/${householdId}/tiles/${tileId}`), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["tiles", vars.householdId] });
      void qc.invalidateQueries({ queryKey: ["tile", vars.householdId, vars.tileId] });
    },
  });
}

interface DeleteTileInput {
  householdId: string;
  tileId: string;
}

export function useDeleteTile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ householdId, tileId }: DeleteTileInput) => {
      await deleteDoc(doc(db, `households/${householdId}/tiles/${tileId}`));
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["tiles", vars.householdId] });
    },
  });
}

/* --- Kitchen Buddy : plans (Phase 3.3) --- */

interface CreateMealPlanInput {
  householdId: string;
  dateDebutISO: string;
  contexte: { batchCookingOk: boolean; style: string; frigoTexte: string };
  presence: Array<{ jour: number; repas: "petitDej" | "dej" | "diner"; profilIds: string[] }>;
}

export function useCreateMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMealPlanInput) => {
      const fn = httpsCallable<CreateMealPlanInput, { planId: string; slotsCreated: number }>(
        functions,
        "createMealPlan",
      );
      const res = await fn(input);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["draftPlan", vars.householdId] });
      void qc.invalidateQueries({ queryKey: ["activePlan", vars.householdId] });
    },
  });
}

interface PlanRefInput {
  householdId: string;
  planId: string;
}

export function useValidateMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlanRefInput) => {
      const fn = httpsCallable<PlanRefInput, { success: true }>(functions, "validateMealPlan");
      await fn(input);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["draftPlan", vars.householdId] });
      void qc.invalidateQueries({ queryKey: ["activePlan", vars.householdId] });
      void qc.invalidateQueries({ queryKey: ["plan", vars.householdId, vars.planId] });
    },
  });
}

export function useDeleteMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlanRefInput) => {
      const fn = httpsCallable<PlanRefInput, { success: true }>(functions, "deleteMealPlan");
      await fn(input);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["draftPlan", vars.householdId] });
      void qc.invalidateQueries({ queryKey: ["activePlan", vars.householdId] });
      void qc.invalidateQueries({ queryKey: ["plan", vars.householdId, vars.planId] });
    },
  });
}

interface SlotActionInput {
  householdId: string;
  planId: string;
  slotId: string;
}

function makeSlotMutation(name: "acceptSlot" | "refuseSlot") {
  return function useSlotAction() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (input: SlotActionInput) => {
        const fn = httpsCallable<SlotActionInput, { success: true }>(functions, name);
        await fn(input);
      },
      onSuccess: (_data, vars) => {
        void qc.invalidateQueries({ queryKey: ["planSlots", vars.householdId, vars.planId] });
        void qc.invalidateQueries({ queryKey: ["plan", vars.householdId, vars.planId] });
      },
    });
  };
}

export const useAcceptSlot = makeSlotMutation("acceptSlot");
export const useRefuseSlot = makeSlotMutation("refuseSlot");

export function useUpdateSlotPresence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SlotActionInput & { profilIds: string[] }) => {
      const fn = httpsCallable<typeof input, { success: true }>(functions, "updateSlotPresence");
      await fn(input);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["planSlots", vars.householdId, vars.planId] });
    },
  });
}

/* --- Recettes (livre de recettes : upvote / downvote / restore / delete) --- */

interface RecetteRefInput {
  householdId: string;
  recetteId: string;
}

/**
 * Upvote : passe le statut de la recette en "favorite".
 * Un upvote depuis "excluded" la réintroduit aussi.
 */
export function useUpvoteRecette() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ householdId, recetteId }: RecetteRefInput) => {
      await updateDoc(doc(db, `households/${householdId}/recettes/${recetteId}`), {
        statut: "favorite",
        excluded: false,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["recettes", vars.householdId] });
    },
  });
}

/**
 * Downvote : marque excluded=true. La recette n'est plus piochée pour les
 * futurs plans, mais reste consultable dans le livre (filtre).
 */
export function useDownvoteRecette() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ householdId, recetteId }: RecetteRefInput) => {
      await updateDoc(doc(db, `households/${householdId}/recettes/${recetteId}`), {
        excluded: true,
        statut: "accepted", // perd le statut favorite si elle l'avait
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["recettes", vars.householdId] });
    },
  });
}

/** Restore une recette downvotée (excluded=false), garde son statut accepted. */
export function useRestoreRecette() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ householdId, recetteId }: RecetteRefInput) => {
      await updateDoc(doc(db, `households/${householdId}/recettes/${recetteId}`), {
        excluded: false,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["recettes", vars.householdId] });
    },
  });
}

/** Suppression définitive d'une recette du livre. */
export function useDeleteRecette() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ householdId, recetteId }: RecetteRefInput) => {
      await deleteDoc(doc(db, `households/${householdId}/recettes/${recetteId}`));
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["recettes", vars.householdId] });
    },
  });
}

/* --- Profils famille (Kitchen Buddy Phase 3.1) --- */

type ProfilCreateInput = Omit<Profil, "createdAt" | "updatedAt">;
type ProfilPatchInput = Partial<Omit<Profil, "createdAt" | "updatedAt">>;

export function useCreateProfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      profil,
    }: {
      householdId: string;
      profil: ProfilCreateInput;
    }) => {
      const ref = await addDoc(collection(db, `households/${householdId}/profils`), {
        ...profil,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    },
    onSuccess: (_id, vars) => {
      void qc.invalidateQueries({ queryKey: ["profils", vars.householdId] });
    },
  });
}

export function useUpdateProfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      profilId,
      patch,
    }: {
      householdId: string;
      profilId: string;
      patch: ProfilPatchInput;
    }) => {
      await updateDoc(doc(db, `households/${householdId}/profils/${profilId}`), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["profils", vars.householdId] });
    },
  });
}

export function useDeleteProfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      profilId,
    }: {
      householdId: string;
      profilId: string;
    }) => {
      await deleteDoc(doc(db, `households/${householdId}/profils/${profilId}`));
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["profils", vars.householdId] });
    },
  });
}

/* --- Timers (collection partagée live, pas dans snapshot) --- */

interface CreateTimerInput {
  householdId: string;
  label: string;
  durationSeconds: number;
}

export function useCreateTimer() {
  return useMutation({
    mutationFn: async ({ householdId, label, durationSeconds }: CreateTimerInput) => {
      const startedAt = Date.now();
      const endsAt = startedAt + durationSeconds * 1000;
      const ref = await addDoc(collection(db, `households/${householdId}/timers`), {
        label,
        durationSeconds,
        startedAt: new Date(startedAt),
        endsAt: new Date(endsAt),
        status: "running",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    },
  });
}

/* --- Liste de courses (Phase 3.4 — UI minimale, full mobile en 3.4 dédiée) --- */

/**
 * Toggle l'état coché d'un item de la liste de courses.
 * Stratégie : on relit le doc en client, on remplace l'item dans
 * l'array, on écrit l'array entier. Acceptable pour un foyer (1-2
 * utilisateurs concurrents max).
 */
export function useToggleShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      listId,
      itemId,
      items,
      uid,
    }: {
      householdId: string;
      listId: string;
      planId: string;
      itemId: string;
      items: ShoppingListItem[];
      uid: string;
    }) => {
      const newItems = items.map((it) =>
        it.id === itemId
          ? {
              ...it,
              checked: !it.checked,
              ...(it.checked
                ? {}
                : { checkedAt: new Date(), checkedBy: uid }),
            }
          : it,
      );
      await updateDoc(
        doc(db, `households/${householdId}/shoppingLists/${listId}`),
        {
          items: newItems,
          updatedAt: serverTimestamp(),
        },
      );
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: ["planShoppingList", vars.householdId, vars.planId],
      });
    },
  });
}

/**
 * Toggle "session de batch terminée".
 */
export function useToggleBatchSessionDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      planId,
      sessionId,
      currentDone,
    }: {
      householdId: string;
      planId: string;
      sessionId: string;
      currentDone: boolean;
    }) => {
      await updateDoc(
        doc(
          db,
          `households/${householdId}/mealPlans/${planId}/batchSessions/${sessionId}`,
        ),
        {
          done: !currentDone,
          ...(currentDone ? {} : { doneAt: serverTimestamp() }),
        },
      );
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: ["planBatchSessions", vars.householdId, vars.planId],
      });
    },
  });
}
