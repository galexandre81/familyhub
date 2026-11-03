/**
 * Remplacements notés sur les listes de courses des semaines en cours : sert à
 * annoter les recettes (« yaourt à la place de crème »).
 *
 * Plans récents (`useAllPlans`, 3) → ceux dont la semaine contient aujourd'hui
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
import { semaineEnCours, type RemplacementActif } from "./remplacements";

export function useRemplacementsEnCours(householdId?: string): RemplacementActif[] {
  const plansQ = useAllPlans(householdId, 3);
  const aujourdhuiISO = dateISOLocale(new Date());

  const ids = useMemo(
    () =>
      (plansQ.data ?? [])
        .filter((p) => {
          const debut = dateDuTimestamp(p.dateDebut);
          const fin = dateDuTimestamp(p.dateFin);
          return semaineEnCours(
            debut ? dateISOLocale(debut) : undefined,
            fin ? dateISOLocale(fin) : undefined,
            aujourdhuiISO,
          );
        })
        .map((p) => p.id)
        .sort(),
    [plansQ.data, aujourdhuiISO],
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
