/**
 * Remplacements d'un article de courses (« yaourt à la place de crème ») —
 * logique pure : texte saisi, rapprochement d'un article avec les lignes
 * d'ingrédients d'une recette, semaine en cours, texte de la liste.
 */
import { normaliserNom, type ArticleCourses } from "@family-hub/types";
import { libelleQuantite } from "./coursesTelephone";

export const LONGUEUR_MAX_REMPLACEMENT = 100;

/** Texte saisi, rogné et tronqué ; vide → null. */
export function texteRemplacement(brut: string): string | null {
  const texte = brut.trim().slice(0, LONGUEUR_MAX_REMPLACEMENT).trim();
  return texte === "" ? null : texte;
}

/** Ponctuation retirée avant comparaison (l'apostrophe reste). */
const PONCTUATION = /[.,;:!?()[\]"«»\-–—/]/g;

/** Clé de comparaison d'un nom : ponctuation → espace, puis `normaliserNom`. */
export function cleIngredient(nom: string): string {
  return normaliserNom(nom.replace(PONCTUATION, " "));
}

function mots(cle: string): string[] {
  return cle.split(" ").filter((m) => m !== "");
}

function contientTous(grand: string[], petit: string[]): boolean {
  return petit.length > 0 && petit.every((m) => grand.includes(m));
}

/**
 * Lignes d'une recette qui correspondent à l'article : d'abord toutes celles
 * de clé identique ; sinon, si une seule ligne contient tous les mots de
 * l'article (ou l'inverse), celle-là ; zéro ou plusieurs → aucune.
 */
export function indicesIngredient(nomArticle: string, ingredients: Array<{ libelle: string }>): number[] {
  const cle = cleIngredient(nomArticle);
  const cles = ingredients.map((i) => cleIngredient(i.libelle));
  const identiques: number[] = [];
  cles.forEach((c, i) => {
    if (c === cle) identiques.push(i);
  });
  if (identiques.length > 0) return identiques;
  const motsArticle = mots(cle);
  const proches: number[] = [];
  cles.forEach((c, i) => {
    const motsLigne = mots(c);
    if (contientTous(motsLigne, motsArticle) || contientTous(motsArticle, motsLigne)) proches.push(i);
  });
  return proches.length === 1 ? proches : [];
}

export interface RemplacementActif {
  nomArticle: string;
  remplacement: string;
  recetteIds: string[];
}

export function remplacementsDeRecette(actifs: RemplacementActif[], recetteId: string): RemplacementActif[] {
  return actifs.filter((a) => a.recetteIds.includes(recetteId));
}

/** « Cette semaine : yaourt à la place de Crème » (rappel dans les recettes). */
export function texteRappel(a: RemplacementActif): string {
  return `Cette semaine : ${a.remplacement} à la place de ${a.nomArticle}`;
}

/** Libellé exact d'une ligne → remplacement ; le premier actif gagne. */
export function carteRemplacements(
  ingredients: Array<{ libelle: string }>,
  actifs: RemplacementActif[],
): Map<string, string> {
  const carte = new Map<string, string>();
  for (const actif of actifs) {
    for (const i of indicesIngredient(actif.nomArticle, ingredients)) {
      const libelle = ingredients[i].libelle;
      if (!carte.has(libelle)) carte.set(libelle, actif.remplacement);
    }
  }
  return carte;
}

/** La semaine est en cours si `aujourdhui` est entre le début et la fin, bornes comprises. */
export function semaineEnCours(
  debutISO: string | undefined,
  finISO: string | undefined,
  aujourdhuiISO: string,
): boolean {
  if (!debutISO || !finISO) return false;
  return debutISO <= aujourdhuiISO && aujourdhuiISO <= finISO;
}

/** « à la place de : Crème, 40 cl » (sans la quantité si elle est vide). */
export function origineRemplacement(a: Pick<ArticleCourses, "nom" | "quantite" | "unite">): string {
  const q = libelleQuantite(a);
  return q ? `à la place de : ${a.nom}, ${q}` : `à la place de : ${a.nom}`;
}

/** Ligne de texte d'un article : « Crème (40 cl) » ou « yaourt (à la place de : Crème, 40 cl) ». */
export function libelleArticleTexte(
  a: Pick<ArticleCourses, "nom" | "quantite" | "unite" | "remplacement">,
): string {
  if (a.remplacement) return `${a.remplacement} (${origineRemplacement(a)})`;
  const q = libelleQuantite(a);
  return q ? `${a.nom} (${q})` : a.nom;
}

/**
 * Lit chaque id ; un échec (refus, réseau) ou une absence (`null`) est
 * simplement absent du résultat : un écran partiel vaut mieux qu'aucun.
 */
export async function lectureTolerante<T>(
  ids: string[],
  lire: (id: string) => Promise<T | null>,
): Promise<Record<string, T>> {
  const resultats = await Promise.allSettled(ids.map((id) => lire(id)));
  const sortie: Record<string, T> = {};
  resultats.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value !== null) sortie[ids[i]] = r.value;
  });
  return sortie;
}
