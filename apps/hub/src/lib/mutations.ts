import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  writeBatch,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  arrayUnion,
  type FieldValue,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import { isValidIcalUrl } from "./calendarUrl";
import { lierProfilLocalement } from "./personnes";
import { rafraichirEcransSansAttendre } from "./rafraichirEcrans";
import { toast } from "../components/Toast";
import type {
  DisplayDeviceType,
  DisplayLayoutEntry,
  GridConfig,
  HeuresRepas,
  HouseholdParametres,
  Profil,
  Resolution,
  TileType,
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
        roles: { [uid]: "parent" },
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

interface CreateInvitationResponse {
  code: string;
  expiresAt: number;
}

/** Crée un lien d'invitation (usage unique, 7 jours) dans le foyer. */
export function useCreateInvitation() {
  return useMutation({
    mutationFn: async ({ householdId }: { householdId: string }) => {
      const fn = httpsCallable<{ householdId: string }, CreateInvitationResponse>(
        functions,
        "createInvitation",
      );
      const res = await fn({ householdId });
      return res.data;
    },
  });
}

interface AcceptInvitationResponse {
  householdId: string;
  nom: string;
}

/**
 * Accepte une invitation avec le compte connecté. Les foyers sont rechargés
 * AVANT la fin de la mutation : sans ça, l'accueil afficherait un instant
 * « Créer mon foyer » alors que la personne vient d'entrer dans un foyer.
 */
export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ code }: { code: string; uid: string }) => {
      const fn = httpsCallable<{ code: string }, AcceptInvitationResponse>(
        functions,
        "acceptInvitation",
      );
      const res = await fn({ code });
      return res.data;
    },
    onSuccess: (_data, vars) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["households", vars.uid] }),
        qc.invalidateQueries({ queryKey: ["user", vars.uid] }),
      ]),
  });
}

interface UpdateHouseholdInput {
  uid: string;
  householdId: string;
  /**
   * Champs à écrire. Les réglages isolés passent par un chemin pointé
   * (`"parametres.placard"`…) : deux modifications rapprochées de réglages
   * différents ne s'écrasent pas (les autres champs de `parametres` restent).
   * `deleteField()` retire un réglage.
   */
  patch: Partial<{
    nom: string;
    parametres: HouseholdParametres;
    "parametres.placard": string[];
    "parametres.heuresRepas": HeuresRepas;
    "parametres.modeleRechercheDrive": string | FieldValue;
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
  /** Ajoutés au plan 4 (absents d'un serveur pas encore redéployé). */
  weatherTiles?: number;
  calendarTiles?: number;
}

/**
 * Bouton « Mettre à jour les écrans » : recalcule tout de suite les tuiles
 * menu, recette du jour, météo et agenda du foyer (portée « tout »).
 */
export function useRefreshHouseholdDisplays() {
  return useMutation({
    mutationFn: async ({
      householdId,
    }: {
      householdId: string;
    }): Promise<RefreshHouseholdDisplaysResponse> => {
      const fn = httpsCallable<
        { householdId: string; portee: "tout" },
        RefreshHouseholdDisplaysResponse
      >(functions, "refreshHouseholdDisplays");
      const res = await fn({ householdId, portee: "tout" });
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
        rafraichirEcransSansAttendre(vars.householdId, "menu");
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
      rafraichirEcransSansAttendre(vars.householdId, "menu");
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
      rafraichirEcransSansAttendre(vars.householdId, "menu");
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
      // `done` figure dans le snapshot du menu affiché par l'iPad.
      rafraichirEcransSansAttendre(vars.householdId, "menu");
    },
  });
}

/**
 * « C'est moi » : relie le profil choisi au compte et l'enlève de tout autre
 * profil du même compte. Optimiste : le cache `["profils", hid]` change tout
 * de suite et l'écriture part sans attendre le serveur (hors ligne, Firestore
 * la garde et l'envoie au retour du réseau). Un refus est affiché quand il
 * arrive, et le cache est alors relu.
 */
export function useLierProfilAuCompte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      householdId,
      profilId,
      uid,
      autresProfilIds,
    }: {
      householdId: string;
      profilId: string;
      uid: string;
      /** Profils du foyer portant déjà ce uid (à délier). */
      autresProfilIds: string[];
    }) => {
      const batch = writeBatch(db);
      for (const id of autresProfilIds) {
        if (id === profilId) continue;
        batch.update(doc(db, `households/${householdId}/profils/${id}`), {
          uid: deleteField(),
          updatedAt: serverTimestamp(),
        });
      }
      batch.update(doc(db, `households/${householdId}/profils/${profilId}`), {
        uid,
        updatedAt: serverTimestamp(),
      });
      // Pas d'await : la promesse ne se résout qu'à l'accusé du serveur.
      batch.commit().catch((err: unknown) => {
        console.error("[c'est moi]", err);
        toast("Ton profil n'a pas pu être enregistré — réessaie.", { type: "error" });
        void qc.invalidateQueries({ queryKey: ["profils", householdId] });
      });
    },
    onMutate: ({ householdId, profilId, uid }) => {
      qc.setQueryData<Array<Profil & { id: string }>>(["profils", householdId], (avant) =>
        avant ? lierProfilLocalement(avant, profilId, uid) : avant,
      );
    },
  });
}
