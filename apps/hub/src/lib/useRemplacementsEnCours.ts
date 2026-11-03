/**
 * Remplacements notés sur les listes de courses des semaines en cours : sert à
 * annoter les recettes (« yaourt à la place de crème »).
 *
 * Plans récents (`useAllPlans`, 3) → ceux dont la semaine contient aujourd'hui
 * (du plus ancien du premier repas et des batchs du plan jusqu'à `dateFin`)
 * → leurs listes (`planId in`) → leurs articles ayant un `remplacement`.
 * Aucun plan en cours : `[]`, sans lecture.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";
import type { ArticleCourses } from "@family-hub/types";
import { db } from "./firebase";
import { dateISOLocale } from "./aujourdhui";
import { dateDuTimestamp } from "./semaine";
import { useAllPlans } from "./queries";
import {
  planIdsCandidatsBatch,
  planIdsEnCours,
  type PlanDates,
  type RemplacementActif,
} from "./remplacements";

export function useRemplacementsEnCours(householdId?: string): RemplacementActif[] {
  const plansQ = useAllPlans(householdId, 3);
  const aujourdhuiISO = dateISOLocale(new Date());

  const plans = useMemo<PlanDates[]>(
    () =>
      (plansQ.data ?? []).map((p) => {
        const debut = dateDuTimestamp(p.dateDebut);
        const fin = dateDuTimestamp(p.dateFin);
        return {
          id: p.id,
          debutISO: debut ? dateISOLocale(debut) : undefined,
          finISO: fin ? dateISOLocale(fin) : undefined,
        };
      }),
    [plansQ.data],
  );

  /* Un batch cuisiné avant le premier repas (la veille) compte : on ne lit les
     batchs que des plans qui n'ont pas encore commencé. */
  const candidats = useMemo(() => planIdsCandidatsBatch(plans, aujourdhuiISO), [plans, aujourdhuiISO]);
  const batchsQ = useQuery({
    enabled: !!householdId && candidats.length > 0,
    queryKey: ["remplacementsBatchsCandidats", householdId, candidats],
    queryFn: async (): Promise<Record<string, string[]>> => {
      if (!householdId) return {};
      const lots = await Promise.all(
        candidats.map(async (id) => {
          try {
            const snap = await getDocs(collection(db, `households/${householdId}/mealPlans/${id}/batchSessions`));
            return [id, snap.docs.map((d) => String(d.data().date ?? ""))] as const;
          } catch {
            return [id, [] as string[]] as const;
          }
        }),
      );
      return Object.fromEntries(lots);
    },
  });

  const ids = useMemo(
    () => planIdsEnCours(plans, batchsQ.data ?? {}, aujourdhuiISO),
    [plans, batchsQ.data, aujourdhuiISO],
  );

  const q = useQuery({
    enabled: !!householdId && ids.length > 0,
    queryKey: ["remplacementsEnCours", householdId, ids],
    queryFn: async (): Promise<RemplacementActif[]> => {
      if (!householdId || ids.length === 0) return [];
      const listes = await getDocs(
        query(collection(db, "households", householdId, "shoppingLists"), where("planId", "in", ids)),
      );
      const articles = await Promise.all(
        listes.docs.map((l) => getDocs(collection(db, "households", householdId, "shoppingLists", l.id, "items"))),
      );
      const actifs: RemplacementActif[] = [];
      for (const snap of articles) {
        for (const d of snap.docs) {
          const a = d.data() as ArticleCourses;
          if (a.remplacement) {
            actifs.push({ nomArticle: a.nom, remplacement: a.remplacement, recetteIds: a.recetteIds ?? [] });
          }
        }
      }
      return actifs;
    },
  });

  return ids.length === 0 ? EMPTY : (q.data ?? EMPTY);
}

const EMPTY: RemplacementActif[] = [];
