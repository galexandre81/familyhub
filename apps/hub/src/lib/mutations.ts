import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import { isValidIcalUrl } from "./calendarUrl";
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

/**
 * Supprime un écran côté serveur (callable `deleteDisplay`) : révoque la
 * session de l'iPad, supprime son compte Auth, ses codes d'appairage, le doc
 * display et son snapshot. Un simple deleteDoc laissait l'iPad connecté.
 */
export function useDeleteDisplay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ householdId, displayId }: DeleteDisplayInput) => {
      const fn = httpsCallable<DeleteDisplayInput, { success: true }>(
        functions,
        "deleteDisplay",
      );
      const res = await fn({ householdId, displayId });
      return res.data;
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["displays", vars.householdId] });
      void qc.invalidateQueries({ queryKey: ["display", vars.householdId, vars.displayId] });
    },
  });
}

interface RefreshHouseholdDisplaysResponse {
  success: true;
  weeklyMenuTiles: number;
  recipeTodayTiles: number;
}

/**
 * Recalcule tout de suite toutes les tuiles « Menu de la semaine » et
 * « Recette du jour » du foyer (sinon : une fois par nuit côté serveur).
 */
export function useRefreshHouseholdDisplays() {
  return useMutation({
    mutationFn: async ({
      householdId,
    }: {
      householdId: string;
    }): Promise<RefreshHouseholdDisplaysResponse> => {
      const fn = httpsCallable<{ householdId: string }, RefreshHouseholdDisplaysResponse>(
        functions,
        "refreshHouseholdDisplays",
      );
      const res = await fn({ householdId });
      return res.data;
    },
  });
}

/**
 * Enregistre (ou retire) l'adresse secrète iCal du foyer dans
 * `households/{hid}/private/calendar`. Lisible par les membres du foyer,
 * jamais par les iPads. `icalUrl: null` supprime le document.
 */
export function useSaveCalendarUrl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      icalUrl,
    }: {
      householdId: string;
      icalUrl: string | null;
    }) => {
      const ref = doc(db, `households/${householdId}/private/calendar`);
      if (icalUrl === null) {
        await deleteDoc(ref);
        return;
      }
      if (!isValidIcalUrl(icalUrl)) {
        throw new Error("L'adresse iCal doit commencer par https://");
      }
      await setDoc(
        ref,
        { icalUrl: icalUrl.trim(), updatedAt: serverTimestamp() },
        { merge: true },
      );
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["calendarPrivate", vars.householdId] });
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

export function useRefreshRecipeTodayTile() {
  return useMutation({
    mutationFn: async ({
      householdId,
      tileId,
    }: {
      householdId: string;
      tileId: string;
    }): Promise<{ success: true }> => {
      const fn = httpsCallable<
        { householdId: string; tileId: string },
        { success: true }
      >(functions, "refreshRecipeTodayTile");
      const res = await fn({ householdId, tileId });
      return res.data;
    },
  });
}

export function useRefreshWeeklyMenuTile() {
  return useMutation({
    mutationFn: async ({
      householdId,
      tileId,
    }: {
      householdId: string;
      tileId: string;
    }): Promise<{ success: true }> => {
      const fn = httpsCallable<
        { householdId: string; tileId: string },
        { success: true }
      >(functions, "refreshWeeklyMenuTile");
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

/**
 * Patch un slot d'un plan : notes ou annule. L'écriture est faite côté
 * client (rules autorisent les members à écrire dans les sous-collections
 * du foyer). Optimistic update via invalidation de la query slots.
 */
export function useUpdateSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      planId,
      slotId,
      patch,
    }: {
      householdId: string;
      planId: string;
      slotId: string;
      patch: { notes?: string; annule?: boolean };
    }) => {
      await updateDoc(
        doc(db, `households/${householdId}/mealPlans/${planId}/slots/${slotId}`),
        patch,
      );
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["planSlots", vars.householdId, vars.planId] });
    },
  });
}

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
 * Clé partagée par toutes les mutations qui touchent `items` : permet de
 * savoir si une autre écriture est encore en vol avant de refetch (sinon le
 * refetch écraserait la mise à jour optimiste d'un clic plus récent).
 */
export const SHOPPING_ITEMS_MUTATION_KEY = ["shoppingItems"] as const;

/**
 * Applique UNE modification au tableau `items` d'une liste de courses, dans
 * une transaction Firestore : on relit le document côté serveur, on applique
 * le changement (ciblé par id d'item) sur l'état le plus récent, on écrit.
 * Deux clics rapides ou deux téléphones ne s'annulent donc plus : chaque
 * écriture part de la version réelle, pas du cache local.
 */
async function updateShoppingItems(
  householdId: string,
  listId: string,
  apply: (items: ShoppingListItem[]) => ShoppingListItem[],
  extra: Record<string, unknown> = {},
): Promise<void> {
  const ref = doc(db, `households/${householdId}/shoppingLists/${listId}`);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Liste de courses introuvable.");
    const current = ((snap.data() as { items?: ShoppingListItem[] }).items ?? []).slice();
    tx.update(ref, {
      items: apply(current),
      ...extra,
      updatedAt: serverTimestamp(),
    });
  });
}

function applyAddItem(items: ShoppingListItem[], item: ShoppingListItem): ShoppingListItem[] {
  if (items.some((it) => it.id === item.id)) return items;
  return [...items, item];
}

function applyRemoveItem(items: ShoppingListItem[], itemId: string): ShoppingListItem[] {
  return items.filter((it) => it.id !== itemId);
}

/**
 * Pose l'état coché demandé (et non un « inverse ») : si deux personnes
 * cochent le même article, le résultat reste coché au lieu de s'annuler.
 */
function applySetChecked(
  items: ShoppingListItem[],
  itemId: string,
  checked: boolean,
  uid: string,
): ShoppingListItem[] {
  return items.map((it) => {
    if (it.id !== itemId || it.checked === checked) return it;
    return checked
      ? ({ ...it, checked: true, checkedAt: new Date(), checkedBy: uid } as unknown as ShoppingListItem)
      : { ...it, checked: false };
  });
}

type ShoppingListCache = { items: ShoppingListItem[] } | null | undefined;

/**
 * Callbacks communs : mise à jour optimiste du cache `planShoppingList`,
 * rollback en cas d'erreur, refetch une fois la dernière écriture en vol
 * terminée.
 */
function useShoppingItemsCallbacks<V extends { householdId: string; planId: string }>(
  applyLocal: (items: ShoppingListItem[], vars: V) => ShoppingListItem[],
) {
  const qc = useQueryClient();
  return {
    mutationKey: SHOPPING_ITEMS_MUTATION_KEY,
    onMutate: async (vars: V) => {
      const key = ["planShoppingList", vars.householdId, vars.planId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ShoppingListCache>(key);
      if (previous) {
        qc.setQueryData(key, { ...previous, items: applyLocal(previous.items, vars) });
      }
      return { previous };
    },
    onError: (_err: unknown, vars: V, ctx: { previous: ShoppingListCache } | undefined) => {
      if (ctx?.previous) {
        qc.setQueryData(["planShoppingList", vars.householdId, vars.planId], ctx.previous);
      }
    },
    onSettled: (_data: unknown, _err: unknown, vars: V) => {
      // isMutating compte encore la mutation courante : on ne refetch qu'à la dernière.
      if (qc.isMutating({ mutationKey: SHOPPING_ITEMS_MUTATION_KEY }) <= 1) {
        void qc.invalidateQueries({
          queryKey: ["planShoppingList", vars.householdId, vars.planId],
        });
      }
    },
  };
}

interface AddShoppingItemInput {
  householdId: string;
  listId: string;
  planId: string;
  item: Omit<ShoppingListItem, "id" | "checked" | "ajoutManuel" | "recetteIds">;
}

type AddShoppingItemVars = AddShoppingItemInput & { itemId: string };

function newManualItem(vars: AddShoppingItemVars): ShoppingListItem {
  return {
    ...vars.item,
    id: vars.itemId,
    checked: false,
    ajoutManuel: true,
    recetteIds: [],
  };
}

/**
 * Ajoute un item à la liste de courses (saisie manuelle).
 * Reset `lastSharedAt` à null pour signaler à l'UI qu'une mise à jour
 * existe depuis le dernier partage Keep.
 */
export function useAddShoppingItem() {
  const callbacks = useShoppingItemsCallbacks<AddShoppingItemVars>((items, vars) =>
    applyAddItem(items, newManualItem(vars)),
  );
  const mutation = useMutation({
    ...callbacks,
    mutationFn: async (vars: AddShoppingItemVars) => {
      await updateShoppingItems(
        vars.householdId,
        vars.listId,
        (items) => applyAddItem(items, newManualItem(vars)),
        // Reset shared status : la liste a changé depuis le dernier envoi.
        { lastSharedAt: null },
      );
    },
  });
  // L'id est généré ici pour que le cache optimiste et le serveur aient le même.
  const withId = (input: AddShoppingItemInput): AddShoppingItemVars => ({
    ...input,
    itemId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  return {
    ...mutation,
    mutate: (input: AddShoppingItemInput) => mutation.mutate(withId(input)),
    mutateAsync: (input: AddShoppingItemInput) => mutation.mutateAsync(withId(input)),
  };
}

interface RemoveShoppingItemInput {
  householdId: string;
  listId: string;
  planId: string;
  itemId: string;
}

/**
 * Supprime un item de la liste. Reset `lastSharedAt` à null.
 */
export function useRemoveShoppingItem() {
  const callbacks = useShoppingItemsCallbacks<RemoveShoppingItemInput>((items, vars) =>
    applyRemoveItem(items, vars.itemId),
  );
  return useMutation({
    ...callbacks,
    mutationFn: async ({ householdId, listId, itemId }: RemoveShoppingItemInput) => {
      await updateShoppingItems(
        householdId,
        listId,
        (items) => applyRemoveItem(items, itemId),
        { lastSharedAt: null },
      );
    },
  });
}

/**
 * Marque la liste comme partagée (à appeler après un share natif réussi).
 */
export function useMarkShoppingShared() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      listId,
      sharedTo,
    }: {
      householdId: string;
      listId: string;
      planId: string;
      sharedTo: string;
    }) => {
      await updateDoc(
        doc(db, `households/${householdId}/shoppingLists/${listId}`),
        {
          lastSharedAt: serverTimestamp(),
          lastSharedTo: sharedTo,
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

interface ToggleShoppingItemInput {
  householdId: string;
  listId: string;
  planId: string;
  itemId: string;
  /** État voulu après le clic (= inverse de ce que l'utilisateur voyait). */
  checked: boolean;
  uid: string;
}

/**
 * Coche / décoche un item de la liste de courses, en transaction (cf.
 * `updateShoppingItems`) : seul l'item ciblé change, sur l'état serveur.
 *
 * Note : le cochage NE reset PAS lastSharedAt (le brief §7.3 précise
 * que seuls les ajouts/retraits le font, pas les cochages).
 */
export function useToggleShoppingItem() {
  const callbacks = useShoppingItemsCallbacks<ToggleShoppingItemInput>((items, vars) =>
    applySetChecked(items, vars.itemId, vars.checked, vars.uid),
  );
  return useMutation({
    ...callbacks,
    mutationFn: async ({ householdId, listId, itemId, checked, uid }: ToggleShoppingItemInput) => {
      await updateShoppingItems(householdId, listId, (items) =>
        applySetChecked(items, itemId, checked, uid),
      );
    },
  });
}

/* --- Notation post-repas (Phase 3.7) --- */

/**
 * Note un repas : enregistre la note sur le slot ET sur la recette.
 * Si rating >= 4, marque la recette comme `favorite` automatiquement
 * (cf. brief §9.1) — elle apparaîtra alors dans le livre des favoris.
 *
 * Stratégie : write batch atomique sur 2 docs (slot + recette).
 * Si pas de planId/slotId, on note quand même la recette seule (cas
 * « j'ai cuisiné cette recette ailleurs », hors plan).
 */
export function useRateRecette() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      recetteId,
      rating,
      planId,
      slotId,
      ratedBy,
      comment,
    }: {
      householdId: string;
      recetteId: string;
      rating: 1 | 2 | 3 | 4 | 5;
      planId?: string;
      slotId?: string;
      ratedBy?: string;
      comment?: string;
    }) => {
      const recetteRef = doc(db, `households/${householdId}/recettes/${recetteId}`);
      const recetteUpdates: Record<string, unknown> = {
        notation: rating,
        updatedAt: serverTimestamp(),
      };
      if (rating >= 4) {
        recetteUpdates.statut = "favorite";
        // Si la recette était excluded, on la réintroduit côté livre
        recetteUpdates.excluded = false;
      }
      if (comment && comment.trim()) {
        recetteUpdates.notesUtilisateur = comment.trim();
      }

      if (planId && slotId) {
        const slotRef = doc(
          db,
          `households/${householdId}/mealPlans/${planId}/slots/${slotId}`,
        );
        const slotUpdates: Record<string, unknown> = {
          rating,
          ratedAt: serverTimestamp(),
        };
        if (ratedBy) slotUpdates.ratedBy = ratedBy;
        // 2 writes en parallèle (Promise.all). Pas un transaction Firestore mais
        // les 2 docs sont indépendants côté business logic.
        await Promise.all([
          updateDoc(slotRef, slotUpdates),
          updateDoc(recetteRef, recetteUpdates),
        ]);
      } else {
        await updateDoc(recetteRef, recetteUpdates);
      }
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: ["recette", vars.householdId, vars.recetteId],
      });
      void qc.invalidateQueries({
        queryKey: ["recettes", vars.householdId],
      });
      if (vars.planId) {
        void qc.invalidateQueries({
          queryKey: ["planSlots", vars.householdId, vars.planId],
        });
      }
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
