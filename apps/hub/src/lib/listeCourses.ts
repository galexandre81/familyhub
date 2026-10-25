/**
 * Liste de courses, format 2 (un document par article) : logique pure.
 *
 * Aucune dépendance Firebase ici : le hook `useListeCourses` fait les
 * lectures/écritures et passe les horodatages serveur en paramètre.
 */
import {
  estProduitPlacard,
  normaliserNom,
  PLACARD_DEFAUT,
  type ArticleCourses,
  type ShoppingList,
  type ShoppingListItem,
  type ShoppingListRayon,
} from "@family-hub/types";

export type ArticleAvecId = ArticleCourses & { id: string };

/** Clé de fusion « même produit, même unité » (« Œufs » = « oeuf »). */
export function cleArticle(a: { nom: string; unite: string }): string {
  return `${normaliserNom(a.nom)}|${a.unite.trim().toLowerCase()}`;
}

/** Rayons dans l'ordre de passage en magasin, avec leur libellé. */
export const RAYONS: ReadonlyArray<{ rayon: ShoppingListRayon; libelle: string }> = [
  { rayon: "fruits-legumes", libelle: "Fruits et légumes" },
  { rayon: "boulangerie", libelle: "Boulangerie" },
  { rayon: "boucherie", libelle: "Boucherie" },
  { rayon: "poissonnerie", libelle: "Poissonnerie" },
  { rayon: "cremerie", libelle: "Crémerie" },
  { rayon: "surgeles", libelle: "Surgelés" },
  { rayon: "epicerie", libelle: "Épicerie" },
  { rayon: "boissons", libelle: "Boissons" },
  { rayon: "autres", libelle: "Autres" },
];

/** Anciens rayons (`RayonCourses`) → rayon le plus proche du format actuel. */
const RAYON_LEGACY: Record<string, ShoppingListRayon> = {
  "frais-fruits-legumes": "fruits-legumes",
  "frais-laitier": "cremerie",
  "frais-boucherie": "boucherie",
  "frais-poissonnerie": "poissonnerie",
  "sec-epicerie": "epicerie",
  surgele: "surgeles",
  boulangerie: "boulangerie",
  autre: "autres",
};

const RAYONS_CONNUS = new Set<string>(RAYONS.map((r) => r.rayon));

/** Rayon affichable : format actuel tel quel, legacy → le plus proche, inconnu → « autres ». */
export function rayonCanonique(rayon: string | undefined | null): ShoppingListRayon {
  if (!rayon) return "autres";
  if (RAYONS_CONNUS.has(rayon)) return rayon as ShoppingListRayon;
  return RAYON_LEGACY[rayon] ?? "autres";
}

/** La liste est encore à l'ancien format (articles dans le tableau du document). */
export function doitMigrer(liste: Pick<ShoppingList, "format" | "items">): boolean {
  return liste.format !== 2 && Array.isArray(liste.items);
}

/**
 * Ancien tableau → documents d'articles. Déterministe (id = ancien `item.id`,
 * mêmes données pour une même entrée) : deux appareils qui migrent en même
 * temps écrivent exactement la même chose. Aucun champ `undefined` (refusé
 * par Firestore). Un id en double n'est gardé qu'une fois (le premier).
 */
export function migrerArticles(
  anciens: ShoppingListItem[],
  estPlacard: (nom: string) => boolean,
): Array<{ id: string; data: ArticleCourses }> {
  const vus = new Set<string>();
  const resultat: Array<{ id: string; data: ArticleCourses }> = [];
  anciens.forEach((it, index) => {
    if (!it?.id || vus.has(it.id)) return;
    vus.add(it.id);
    const nom = typeof it.nom === "string" ? it.nom : "";
    const coche = it.checked === true;
    resultat.push({
      id: it.id,
      data: {
        nom,
        quantite: typeof it.quantite === "number" ? it.quantite : 1,
        unite: typeof it.unite === "string" ? it.unite : "",
        rayon: it.rayon ?? "autres",
        recetteIds: Array.isArray(it.recetteIds) ? it.recetteIds : [],
        ajoutManuel: it.ajoutManuel === true,
        destination: coche ? "magasin" : "a-trier",
        placard: estPlacard(nom),
        checked: coche,
        checkedAt: coche ? (it.checkedAt ?? null) : null,
        checkedBy: coche ? (it.checkedBy ?? null) : null,
        ordre: index,
      },
    });
  });
  return resultat;
}

/** Champs à écrire pour cocher/décocher — rien d'autre (pas d'écrasement concurrent). */
export function patchCoche<H>(
  coche: boolean,
  uid: string,
  horodatage: H,
): { checked: boolean; checkedBy: string | null; checkedAt: H | null } {
  return {
    checked: coche,
    checkedBy: coche ? uid : null,
    checkedAt: coche ? horodatage : null,
  };
}

const parOrdre = (a: ArticleAvecId, b: ArticleAvecId) => a.ordre - b.ordre;

export interface GroupeRayon<T extends ArticleAvecId = ArticleAvecId> {
  rayon: ShoppingListRayon;
  libelle: string;
  articles: T[];
  /** Articles non cochés. */
  restants: number;
}

/**
 * Regroupe par rayon dans l'ordre du magasin ; rayon inconnu → « Autres ».
 * Dans un rayon : non cochés (par ordre), puis cochés en bas. Rayons vides omis.
 */
export function grouperParRayon<T extends ArticleAvecId>(articles: T[]): GroupeRayon<T>[] {
  const parRayon = new Map<ShoppingListRayon, T[]>();
  for (const a of articles) {
    const r = rayonCanonique(a.rayon);
    const liste = parRayon.get(r);
    if (liste) liste.push(a);
    else parRayon.set(r, [a]);
  }
  const groupes: GroupeRayon<T>[] = [];
  for (const { rayon, libelle } of RAYONS) {
    const liste = parRayon.get(rayon);
    if (!liste) continue;
    const restants = liste.filter((a) => !a.checked).sort(parOrdre);
    const coches = liste.filter((a) => a.checked).sort(parOrdre);
    groupes.push({ rayon, libelle, articles: [...restants, ...coches], restants: restants.length });
  }
  return groupes;
}

/**
 * Vue du tri : d'abord « Sûrement dans le placard — à vérifier » (placard
 * non trié), puis les autres à trier, puis les déjà triés (affichés repliés).
 */
export function vueTri<T extends ArticleAvecId>(
  articles: T[],
  /** Statut « placard » calculé à la lecture (liste du foyer) ; s'ajoute au drapeau stocké. */
  estPlacard: (article: T) => boolean = () => false,
): { placard: T[]; aTrier: T[]; tries: T[] } {
  const tries = [...articles].sort(parOrdre);
  const placard = (a: T) => a.placard || estPlacard(a);
  return {
    placard: tries.filter((a) => a.destination === "a-trier" && placard(a)),
    aTrier: tries.filter((a) => a.destination === "a-trier" && !placard(a)),
    tries: tries.filter((a) => a.destination !== "a-trier"),
  };
}

/** Au magasin : ce qui y est destiné et ce qui n'a pas été trié (par défaut au magasin). */
export function vueMagasin<T extends ArticleAvecId>(articles: T[]): T[] {
  return articles
    .filter((a) => a.destination === "magasin" || a.destination === "a-trier")
    .sort(parOrdre);
}

/** Au drive : seulement ce qui y a été trié. */
export function vueDrive<T extends ArticleAvecId>(articles: T[]): T[] {
  return articles.filter((a) => a.destination === "drive").sort(parOrdre);
}

/** Ordre d'un nouvel article : après tous les autres. */
export function prochainOrdre(articles: Array<Pick<ArticleCourses, "ordre">>): number {
  return articles.reduce((max, a) => Math.max(max, a.ordre + 1), 0);
}

/** Oubli ajouté à la main : part au magasin, rayon « Autres ». */
export function articleOubli(nom: string, ordre: number): ArticleCourses {
  return {
    nom: nom.trim(),
    quantite: 1,
    unite: "",
    rayon: "autres",
    recetteIds: [],
    ajoutManuel: true,
    destination: "magasin",
    placard: false,
    checked: false,
    checkedAt: null,
    checkedBy: null,
    ordre,
  };
}

/** Une ligne de la liste importée, recettes déjà résolues en vrais ids. */
export interface LigneImport {
  nom: string;
  quantite: number;
  unite: string;
  rayon: ShoppingListRayon;
  recetteIds: string[];
  /** Drapeau « produit de placard » posé par le modèle. */
  placard?: boolean;
}

/**
 * Articles d'un plan importé : à trier, non cochés, dans l'ordre de l'import.
 * `placard` = drapeau du modèle OU produit de placard du foyer (absent =
 * liste par défaut).
 */
export function articlesDuPlan(lignes: LigneImport[], placardFoyer?: string[]): ArticleCourses[] {
  return lignes.map((l, ordre) => ({
    nom: l.nom,
    quantite: l.quantite,
    unite: l.unite,
    rayon: l.rayon,
    recetteIds: l.recetteIds,
    ajoutManuel: false,
    destination: "a-trier",
    placard: l.placard === true || estProduitPlacard(l.nom, placardFoyer ?? PLACARD_DEFAUT),
    checked: false,
    checkedAt: null,
    checkedBy: null,
    ordre,
  }));
}

/** Copie sans champ `undefined` (refusé par Firestore). */
function sansUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Ré-import d'un plan sur sa liste existante, sans perdre le tri ni les coches.
 *
 * - Même produit (`cleArticle`) : garde l'id, la destination et la coche de
 *   l'existant ; prend quantité, rayon, recettes, ordre et placard du nouveau.
 * - Oubli (ajout manuel) absent du nouveau plan : conservé, renuméroté après
 *   les articles du plan.
 * - Autre existant absent du nouveau plan : supprimé.
 * - Nouveau sans équivalent : créé (`id` absent).
 */
export function fusionnerReimport(
  existants: ArticleAvecId[],
  nouveaux: ArticleCourses[],
): { aEcrire: Array<{ id?: string; data: ArticleCourses }>; aSupprimer: string[] } {
  const parCle = new Map<string, ArticleAvecId[]>();
  for (const e of [...existants].sort(parOrdre)) {
    const cle = cleArticle(e);
    const liste = parCle.get(cle);
    if (liste) liste.push(e);
    else parCle.set(cle, [e]);
  }
  const repris = new Set<string>();
  const aEcrire: Array<{ id?: string; data: ArticleCourses }> = [];
  for (const n of nouveaux) {
    const e = parCle.get(cleArticle(n))?.find((x) => !repris.has(x.id));
    if (!e) {
      aEcrire.push({ data: sansUndefined(n) });
      continue;
    }
    repris.add(e.id);
    aEcrire.push({
      id: e.id,
      data: sansUndefined({
        ...n,
        // Un oubli repris par le plan reste un ajout manuel : un ré-import
        // qui retire ce produit ne doit pas effacer l'ajout de la famille.
        ajoutManuel: e.ajoutManuel || n.ajoutManuel,
        destination: e.destination,
        checked: e.checked,
        checkedBy: e.checkedBy ?? null,
        checkedAt: e.checkedAt ?? null,
        createdAt: e.createdAt,
      }),
    });
  }
  let ordre = prochainOrdre(nouveaux);
  const aSupprimer: string[] = [];
  for (const e of [...existants].sort(parOrdre)) {
    if (repris.has(e.id)) continue;
    if (e.ajoutManuel) {
      const { id, ...data } = e;
      aEcrire.push({ id, data: sansUndefined({ ...data, ordre: ordre++ }) });
    } else {
      aSupprimer.push(e.id);
    }
  }
  return { aEcrire, aSupprimer };
}

/** Champs qu'un ré-import possède ; le reste (tri, coche) appartient aux téléphones. */
export type ChampsDuPlan = Pick<
  ArticleCourses,
  "nom" | "unite" | "quantite" | "rayon" | "recetteIds" | "placard" | "ordre" | "ajoutManuel"
>;

/**
 * Ce qu'un ré-import écrit (en `merge`) sur un article déjà en base : jamais
 * `destination`, `checked`, `checkedBy`, `checkedAt` — un téléphone qui coche
 * pendant l'import ne voit pas sa coche annulée.
 */
export function champsDuPlan(a: ArticleCourses): ChampsDuPlan {
  return {
    nom: a.nom,
    unite: a.unite,
    quantite: a.quantite,
    rayon: a.rayon,
    recetteIds: a.recetteIds,
    placard: a.placard,
    ordre: a.ordre,
    ajoutManuel: a.ajoutManuel,
  };
}

/**
 * Oublis du plan précédent à reporter dans la liste d'un nouveau plan :
 * ajouts manuels non cochés, remis au magasin, sans doublon ni produit déjà
 * présent dans `nouveaux`, numérotés après eux.
 */
export function oublisAReporter(
  articlesPlanPrecedent: Array<ArticleCourses & { id?: string }>,
  nouveaux: ArticleCourses[] = [],
): ArticleCourses[] {
  const vus = new Set(nouveaux.map(cleArticle));
  let ordre = prochainOrdre(nouveaux);
  const resultat: ArticleCourses[] = [];
  for (const a of [...articlesPlanPrecedent].sort((x, y) => x.ordre - y.ordre)) {
    if (!a.ajoutManuel || a.checked) continue;
    const cle = cleArticle(a);
    if (vus.has(cle)) continue;
    vus.add(cle);
    resultat.push({
      nom: a.nom,
      quantite: a.quantite,
      unite: a.unite,
      rayon: a.rayon,
      recetteIds: a.recetteIds ?? [],
      ajoutManuel: true,
      destination: "magasin",
      placard: a.placard === true,
      checked: false,
      checkedAt: null,
      checkedBy: null,
      ordre: ordre++,
    });
  }
  return resultat;
}
