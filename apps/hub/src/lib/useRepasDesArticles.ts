/**
 * Repas d'un article de courses : lit les repas et sessions batch du plan et
 * les recettes de tous les slots et batchs, puis `resume(article)` calcule la
 * liste des repas (`repasDeLArticle`).
 *
 * La lecture des recettes est tolérante (une recette illisible est absente) et
 * part au montage de la page, pour remplir le cache avant le passage en magasin.
 */
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import type { ArticleCourses, Recette } from "@family-hub/types";
import { db } from "./firebase";
import { dateISOLocale } from "./aujourdhui";
import { dateDuTimestamp } from "./semaine";
import { usePlanBatchSessions, usePlanSlots, type MealPlanWithId } from "./queries";
import { lectureTolerante } from "./remplacements";
import {
  recetteIdsAChargerPourRepas,
  repasDeLArticle,
  repasIndisponibles,
  type RepasDeLArticle,
} from "./repasArticle";

export interface RepasDesArticlesApi {
  resume(article: Pick<ArticleCourses, "nom" | "recetteIds">): RepasDeLArticle;
  chargement: boolean;
}

export function useRepasDesArticles(
  householdId?: string,
  plan?: MealPlanWithId,
  articles: Array<Pick<ArticleCourses, "recetteIds">> = [],
): RepasDesArticlesApi {
  const planId = plan?.id;
  const slotsQ = usePlanSlots(householdId, planId);
  const batchsQ = usePlanBatchSessions(householdId, planId);

  const slots = useMemo(() => slotsQ.data ?? [], [slotsQ.data]);
  const batchs = useMemo(() => batchsQ.data ?? [], [batchsQ.data]);

  /* Les articles passent par une clé texte : un tableau neuf à chaque rendu ne relance rien. */
  const cleArticles = articles.flatMap((a) => a.recetteIds ?? []).sort().join(",");
  const recetteIds = useMemo(
    () => recetteIdsAChargerPourRepas(slots, batchs, cleArticles ? [{ recetteIds: cleArticles.split(",") }] : []),
    [slots, batchs, cleArticles],
  );

  const recettesQ = useQuery({
    enabled: !!householdId && recetteIds.length > 0,
    queryKey: ["repasArticlesRecettes", householdId, recetteIds.join(",")],
    queryFn: async (): Promise<Record<string, Recette>> => {
      if (!householdId) return {};
      return lectureTolerante(recetteIds, async (rid) => {
        const snap = await getDoc(doc(db, `households/${householdId}/recettes/${rid}`));
        return snap.exists() ? (snap.data() as Recette) : null;
      });
    },
  });
  const recettes = recettesQ.data;

  const debutPlanISO = useMemo(() => {
    const d = dateDuTimestamp(plan?.dateDebut);
    return d ? dateISOLocale(d) : undefined;
  }, [plan?.dateDebut]);
  const aujourdhuiISO = dateISOLocale(new Date());

  const chargement =
    !!planId && (slotsQ.isLoading || batchsQ.isLoading || (recetteIds.length > 0 && recettesQ.isLoading));

  /* Un plan avec une liste a toujours des repas : zéro repas, ou une lecture en
     erreur, veut dire « illisible » (hors réseau sans cache), pas « hors menu ». */
  const indisponible = repasIndisponibles({
    planId,
    chargement: slotsQ.isLoading || batchsQ.isLoading,
    erreur: slotsQ.isError || batchsQ.isError,
    nombreSlots: slots.length,
  });

  const resume = useCallback(
    (article: Pick<ArticleCourses, "nom" | "recetteIds">) =>
      repasDeLArticle(article, slots, batchs, recettes ?? {}, aujourdhuiISO, debutPlanISO, { indisponible }),
    [slots, batchs, recettes, aujourdhuiISO, debutPlanISO, indisponible],
  );

  return { resume, chargement };
}
