/**
 * Repas d'un article de courses : à partir des recettes d'origine de l'article,
 * les repas de la semaine qui les utilisent (repas ordinaires et sessions batch),
 * avec la quantité propre à chaque repas. Logique pure.
 */
import type { ArticleCourses, BatchSession, MealPlanSlot, Recette, Repas } from "@family-hub/types";
import { portionsParDefaut, quantiteAjustee } from "./repasCuisine";
import { indicesIngredient } from "./remplacements";

export type EntreeRepasArticle =
  | {
      type: "repas";
      cle: string;
      recetteId: string;
      nomRecette?: string;
      date?: string;
      repas: Repas;
      annule: boolean;
      passe: boolean;
      quantite: string | null;
      portions: number;
    }
  | {
      type: "batch";
      cle: string;
      recetteId: string;
      nomRecette?: string;
      dateCuisine: string;
      mange: Array<{ date?: string; repas: Repas; annule: boolean }>;
      annule: boolean;
      passe: boolean;
      quantite: string | null;
      portions: number;
    }
  | { type: "hors-menu"; cle: string; recetteId: string; nomRecette?: string };

export interface RepasDeLArticle {
  entrees: EntreeRepasArticle[];
  nombreRepas: number;
  libelleBouton: string;
}

const RANG_REPAS: Record<Repas, number> = { petitDej: 0, dej: 1, diner: 2 };

/** `debutISO` + `jours` jours, en ISO (calcul en UTC : pas de décalage d'heure d'été). */
function ajouterJours(debutISO: string, jours: number): string | undefined {
  const [a, m, j] = debutISO.split("-").map(Number);
  if (!a || !m || !j) return undefined;
  return new Date(Date.UTC(a, m - 1, j + jours)).toISOString().slice(0, 10);
}

function dateDuSlot(slot: MealPlanSlot, debutPlanISO: string | undefined): string | undefined {
  if (slot.date) return slot.date;
  if (debutPlanISO && Number.isFinite(slot.jour)) return ajouterJours(debutPlanISO, slot.jour);
  return undefined;
}

/** Une ligne par ingrédient correspondant, ajustée aux portions, jointes par « + » (sans addition). */
function quantiteDeLaRecette(nomArticle: string, recette: Recette | undefined, portions: number): string | null {
  if (!recette) return null;
  const indices = indicesIngredient(nomArticle, recette.ingredients ?? []);
  if (indices.length === 0) return null;
  return indices
    .map((i) => {
      const ligne = recette.ingredients[i];
      return `${quantiteAjustee(ligne.quantite, recette.portions, portions)} ${ligne.unite ?? ""}`.trim();
    })
    .join(" + ");
}

interface Tri {
  date?: string;
  rang: number;
}

function comparer(a: Tri, b: Tri): number {
  if (a.date !== b.date) {
    if (a.date === undefined) return 1;
    if (b.date === undefined) return -1;
    return a.date < b.date ? -1 : 1;
  }
  return a.rang - b.rang;
}

export function repasDeLArticle(
  article: Pick<ArticleCourses, "nom" | "recetteIds">,
  slots: Array<MealPlanSlot & { id: string }>,
  batchs: Array<BatchSession & { id: string }>,
  recettes: Record<string, Recette | undefined>,
  aujourdhuiISO: string,
  debutPlanISO?: string,
): RepasDeLArticle {
  const enTri: Array<{ entree: EntreeRepasArticle; tri: Tri }> = [];
  const repasComptes = new Set<string>();
  const batchsSansRepas = new Set<string>();

  const estPasse = (date: string | undefined) => date !== undefined && date < aujourdhuiISO;

  for (const recetteId of new Set(article.recetteIds)) {
    const recette = recettes[recetteId];
    const nomRecette = recette?.nom;
    const sessions = batchs.filter((b) => b.recetteIds.includes(recetteId));
    const idsSessions = new Set(sessions.map((b) => b.id));
    let trouvees = 0;

    // Repas ordinaires : un batch consommé n'a pas de ligne séparée.
    for (const slot of slots) {
      if (!slot.recetteIds.includes(recetteId)) continue;
      if (slot.batchSessionId && idsSessions.has(slot.batchSessionId)) continue;
      const date = dateDuSlot(slot, debutPlanISO);
      const portions = portionsParDefaut(slot, recette?.portions);
      const annule = slot.annule === true;
      if (!annule) repasComptes.add(slot.id);
      trouvees++;
      enTri.push({
        tri: { date, rang: RANG_REPAS[slot.repas] ?? 1 },
        entree: {
          type: "repas",
          cle: `repas-${slot.id}-${recetteId}`,
          recetteId,
          nomRecette,
          date,
          repas: slot.repas,
          annule,
          passe: estPasse(date),
          quantite: quantiteDeLaRecette(article.nom, recette, portions),
          portions,
        },
      });
    }

    for (const session of sessions) {
      const consommateurs = slots
        .filter((s) => s.batchSessionId === session.id && s.recetteIds.includes(recetteId))
        .map((s) => ({ id: s.id, date: dateDuSlot(s, debutPlanISO), repas: s.repas, annule: s.annule === true }))
        .sort((a, b) => comparer({ date: a.date, rang: RANG_REPAS[a.repas] }, { date: b.date, rang: RANG_REPAS[b.repas] }));
      for (const c of consommateurs) if (!c.annule) repasComptes.add(c.id);
      if (consommateurs.length === 0) batchsSansRepas.add(session.id);
      trouvees++;
      const portions = recette?.portions && recette.portions > 0 ? recette.portions : 4;
      enTri.push({
        tri: { date: session.date, rang: -1 },
        entree: {
          type: "batch",
          cle: `batch-${session.id}-${recetteId}`,
          recetteId,
          nomRecette,
          dateCuisine: session.date,
          mange: consommateurs.map(({ date, repas, annule }) => ({ date, repas, annule })),
          annule: consommateurs.length > 0 && consommateurs.every((c) => c.annule),
          passe:
            consommateurs.length === 0 ? estPasse(session.date) : consommateurs.every((c) => estPasse(c.date)),
          quantite: quantiteDeLaRecette(article.nom, recette, portions),
          portions,
        },
      });
    }

    if (trouvees === 0) {
      enTri.push({
        tri: { date: undefined, rang: 99 },
        entree: { type: "hors-menu", cle: `hors-menu-${recetteId}`, recetteId, nomRecette },
      });
    }
  }

  enTri.sort((a, b) => {
    const horsA = a.entree.type === "hors-menu";
    const horsB = b.entree.type === "hors-menu";
    if (horsA !== horsB) return horsA ? 1 : -1;
    return comparer(a.tri, b.tri);
  });

  const entrees = enTri.map((e) => e.entree);
  const nombreRepas = repasComptes.size + batchsSansRepas.size;
  const seulementHorsMenu = entrees.length > 0 && entrees.every((e) => e.type === "hors-menu");
  return { entrees, nombreRepas, libelleBouton: seulementHorsMenu ? "Voir" : `${nombreRepas} repas` };
}
