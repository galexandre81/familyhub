import { describe, expect, it } from "vitest";
import type { ArticleCourses, ShoppingListItem } from "@family-hub/types";
import {
  articleOubli,
  articlesDuPlan,
  cleArticle,
  fusionnerReimport,
  oublisAReporter,
  doitMigrer,
  grouperParRayon,
  migrerArticles,
  patchCoche,
  prochainOrdre,
  rayonCanonique,
  vueDrive,
  vueMagasin,
  vueTri,
} from "./listeCourses";

const ancien = (id: string, extra: Partial<ShoppingListItem> = {}): ShoppingListItem => ({
  id,
  nom: `article ${id}`,
  quantite: 1,
  unite: "",
  rayon: "epicerie",
  recetteIds: [],
  checked: false,
  ajoutManuel: false,
  ...extra,
});

type A = ArticleCourses & { id: string };
const art = (id: string, extra: Partial<ArticleCourses> = {}): A => ({
  id,
  nom: id,
  quantite: 1,
  unite: "",
  rayon: "epicerie",
  recetteIds: [],
  ajoutManuel: false,
  destination: "a-trier",
  placard: false,
  checked: false,
  ordre: 0,
  ...extra,
});

describe("cleArticle", () => {
  it("« Œufs » et « oeuf » avec la même unité ont la même clé", () => {
    expect(cleArticle({ nom: "Œufs", unite: " Pièces " })).toBe(
      cleArticle({ nom: "oeuf", unite: "pièces" }),
    );
    expect(cleArticle({ nom: "Œufs", unite: "" })).toBe("oeuf|");
  });

  it("des unités différentes donnent des clés différentes", () => {
    expect(cleArticle({ nom: "lait", unite: "L" })).not.toBe(cleArticle({ nom: "lait", unite: "ml" }));
  });
});

describe("migrerArticles", () => {
  it("garde l'id de l'ancien article (id déterministe) et l'ordre du tableau", () => {
    const r = migrerArticles([ancien("a"), ancien("b"), ancien("c")], () => false);
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(r.map((x) => x.data.ordre)).toEqual([0, 1, 2]);
  });

  it("est idempotente : deux appareils produisent exactement les mêmes écritures", () => {
    const items = [ancien("a", { checked: true, checkedBy: "u1" }), ancien("b")];
    const premier = migrerArticles(items, (n) => n === "article b");
    const second = migrerArticles(items, (n) => n === "article b");
    expect(second).toEqual(premier);
  });

  it("un id en double n'est migré qu'une fois (pas de doublon)", () => {
    const r = migrerArticles([ancien("a"), ancien("a", { nom: "autre" }), ancien("b")], () => false);
    expect(r.map((x) => x.id)).toEqual(["a", "b"]);
    expect(r[0].data.nom).toBe("article a");
  });

  it("coché → destination magasin, coche conservée ; non coché → à trier", () => {
    const [c, n] = migrerArticles(
      [ancien("a", { checked: true, checkedBy: "u1", checkedAt: "2026-10-01" }), ancien("b")],
      () => false,
    );
    expect(c.data).toMatchObject({ destination: "magasin", checked: true, checkedBy: "u1", checkedAt: "2026-10-01" });
    expect(n.data).toMatchObject({ destination: "a-trier", checked: false, checkedBy: null, checkedAt: null });
  });

  it("calcule placard avec la fonction injectée", () => {
    const r = migrerArticles([ancien("a", { nom: "Sel" }), ancien("b", { nom: "Poireaux" })], (nom) => nom === "Sel");
    expect(r.map((x) => x.data.placard)).toEqual([true, false]);
  });

  it("n'écrit jamais de champ undefined (Firestore le refuse) ; rayon manquant → autres", () => {
    const sansRayon = { ...ancien("a"), rayon: undefined } as unknown as ShoppingListItem;
    const [r] = migrerArticles([sansRayon], () => false);
    expect(Object.values(r.data).some((v) => v === undefined)).toBe(false);
    expect(r.data.rayon).toBe("autres");
    expect(r.data.recetteIds).toEqual([]);
  });
});

describe("doitMigrer", () => {
  it("ancien format avec tableau → oui ; format 2 ou sans tableau → non", () => {
    expect(doitMigrer({ items: [] })).toBe(true);
    expect(doitMigrer({ items: [ancien("a")] })).toBe(true);
    expect(doitMigrer({ format: 2, items: [ancien("a")] })).toBe(false);
    expect(doitMigrer({ format: 2 })).toBe(false);
    expect(doitMigrer({})).toBe(false);
  });
});

describe("patchCoche", () => {
  it("ne contient que les champs de la coche", () => {
    const p = patchCoche(true, "u1", "HORODATAGE");
    expect(Object.keys(p).sort()).toEqual(["checked", "checkedAt", "checkedBy"]);
    expect(p).toEqual({ checked: true, checkedBy: "u1", checkedAt: "HORODATAGE" });
  });

  it("décocher efface qui et quand", () => {
    expect(patchCoche(false, "u1", "HORODATAGE")).toEqual({ checked: false, checkedBy: null, checkedAt: null });
  });
});

describe("rayonCanonique", () => {
  it("rayons du nouveau format inchangés", () => {
    expect(rayonCanonique("cremerie")).toBe("cremerie");
    expect(rayonCanonique("fruits-legumes")).toBe("fruits-legumes");
  });
  it("rayons legacy → le plus proche, « autre » → autres", () => {
    expect(rayonCanonique("frais-laitier")).toBe("cremerie");
    expect(rayonCanonique("frais-fruits-legumes")).toBe("fruits-legumes");
    expect(rayonCanonique("sec-epicerie")).toBe("epicerie");
    expect(rayonCanonique("surgele")).toBe("surgeles");
    expect(rayonCanonique("autre")).toBe("autres");
  });
  it("rayon inconnu ou absent → autres", () => {
    expect(rayonCanonique("rayon-bizarre")).toBe("autres");
    expect(rayonCanonique(undefined)).toBe("autres");
  });
});

describe("grouperParRayon", () => {
  it("ordre des rayons fixe, libellés français, rayons vides absents", () => {
    const g = grouperParRayon([
      art("lait", { rayon: "cremerie" }),
      art("pain", { rayon: "boulangerie" }),
      art("pomme", { rayon: "fruits-legumes" }),
      art("eau", { rayon: "boissons" }),
    ]);
    expect(g.map((x) => x.rayon)).toEqual(["fruits-legumes", "boulangerie", "cremerie", "boissons"]);
    expect(g.map((x) => x.libelle)).toEqual(["Fruits et légumes", "Boulangerie", "Crémerie", "Boissons"]);
  });

  it("rayon legacy « autre » et rayon inconnu → Autres, jamais perdus", () => {
    const g = grouperParRayon([
      art("a", { rayon: "autre" }),
      art("b", { rayon: "zzz" as never }),
      art("c", { rayon: "frais-boucherie" }),
    ]);
    expect(g.map((x) => [x.rayon, x.articles.map((a) => a.id)])).toEqual([
      ["boucherie", ["c"]],
      ["autres", ["a", "b"]],
    ]);
    expect(g[1].libelle).toBe("Autres");
  });

  it("dans un rayon : non cochés par ordre, puis cochés en bas ; restants = non cochés", () => {
    const g = grouperParRayon([
      art("x", { ordre: 1, checked: true }),
      art("y", { ordre: 3 }),
      art("z", { ordre: 2 }),
      art("w", { ordre: 0, checked: true }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].articles.map((a) => a.id)).toEqual(["z", "y", "w", "x"]);
    expect(g[0].restants).toBe(2);
  });
});

describe("vues", () => {
  const articles = [
    art("sel", { placard: true, ordre: 4 }),
    art("poivre", { placard: true, destination: "deja", ordre: 1 }),
    art("poireau", { ordre: 2 }),
    art("lait", { destination: "drive", ordre: 0 }),
    art("pain", { destination: "magasin", ordre: 3 }),
    art("ail", { ordre: 1 }),
  ];

  it("vueTri : placard à vérifier d'abord, puis les autres à trier, puis les déjà triés", () => {
    const v = vueTri(articles);
    expect(v.placard.map((a) => a.id)).toEqual(["sel"]);
    expect(v.aTrier.map((a) => a.id)).toEqual(["ail", "poireau"]);
    expect(v.tries.map((a) => a.id)).toEqual(["lait", "poivre", "pain"]);
  });

  it("vueTri : un article est « placard » si son drapeau est vrai OU si le prédicat le dit", () => {
    const liste = [art("farine", { ordre: 0 }), art("poireau", { ordre: 1 }), art("sel", { placard: true, ordre: 2 })];
    const v = vueTri(liste, (a) => a.nom === "farine");
    expect(v.placard.map((a) => a.id)).toEqual(["farine", "sel"]);
    expect(v.aTrier.map((a) => a.id)).toEqual(["poireau"]);
  });

  it("vueMagasin : magasin + non triés, jamais « déjà » ni drive", () => {
    expect(vueMagasin(articles).map((a) => a.id)).toEqual(["ail", "poireau", "pain", "sel"]);
  });

  it("vueDrive : seulement drive", () => {
    expect(vueDrive(articles).map((a) => a.id)).toEqual(["lait"]);
  });
});

describe("oubli", () => {
  it("prochainOrdre = max + 1 (0 si vide)", () => {
    expect(prochainOrdre([])).toBe(0);
    expect(prochainOrdre([art("a", { ordre: 3 }), art("b", { ordre: 7 }), art("c", { ordre: 1 })])).toBe(8);
  });

  it("articleOubli : ajout manuel, magasin, rayon autres", () => {
    const a = articleOubli("  Piles  ", 5);
    expect(a).toEqual({
      nom: "Piles",
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
      ordre: 5,
    });
  });
});

describe("articlesDuPlan", () => {
  const ligne = (nom: string, extra: { placard?: boolean } = {}) => ({
    nom,
    quantite: 2,
    unite: "pièces",
    rayon: "epicerie" as const,
    recetteIds: ["r1"],
    ...extra,
  });

  it("crée des articles à trier, non cochés, dans l'ordre de l'import", () => {
    const r = articlesDuPlan([ligne("Tomates"), ligne("Riz")]);
    expect(r).toEqual([
      {
        nom: "Tomates",
        quantite: 2,
        unite: "pièces",
        rayon: "epicerie",
        recetteIds: ["r1"],
        ajoutManuel: false,
        destination: "a-trier",
        placard: false,
        checked: false,
        checkedAt: null,
        checkedBy: null,
        ordre: 0,
      },
      expect.objectContaining({ nom: "Riz", ordre: 1 }),
    ]);
  });

  it("placard = drapeau du modèle OU produit de placard du foyer", () => {
    const r = articlesDuPlan(
      [ligne("Safran", { placard: true }), ligne("Sel fin"), ligne("Cumin"), ligne("Tomates")],
      ["cumin"],
    );
    expect(r.map((a) => a.placard)).toEqual([true, false, true, false]);
    // Sans liste du foyer : liste par défaut (le sel en fait partie).
    expect(articlesDuPlan([ligne("Sel fin")])[0].placard).toBe(true);
  });
});

describe("fusionnerReimport", () => {
  const nouveau = (nom: string, extra: Partial<ArticleCourses> = {}): ArticleCourses => {
    const { id: _id, ...data } = art(nom, { destination: "a-trier", ...extra });
    return data;
  };

  it("même produit : garde l'id, le tri et la coche ; prend quantité, rayon et recettes du nouveau", () => {
    const existants = [
      art("x1", {
        nom: "Œufs",
        unite: "pièces",
        quantite: 6,
        rayon: "cremerie",
        destination: "drive",
        checked: true,
        checkedBy: "uid-a",
        checkedAt: "T1" as never,
        recetteIds: ["r1"],
      }),
    ];
    const r = fusionnerReimport(existants, [
      nouveau("oeuf", { unite: "Pièces", quantite: 12, rayon: "epicerie", recetteIds: ["r2"], ordre: 3 }),
    ]);
    expect(r.aSupprimer).toEqual([]);
    expect(r.aEcrire).toEqual([
      {
        id: "x1",
        data: expect.objectContaining({
          nom: "oeuf",
          quantite: 12,
          rayon: "epicerie",
          recetteIds: ["r2"],
          destination: "drive",
          checked: true,
          checkedBy: "uid-a",
          checkedAt: "T1",
          ordre: 3,
        }),
      },
    ]);
  });

  it("un oubli (ajout manuel) absent du nouveau plan est conservé, après les articles du plan", () => {
    const existants = [art("o1", { nom: "Piles", ajoutManuel: true, destination: "magasin", ordre: 1 })];
    const r = fusionnerReimport(existants, [nouveau("Riz", { ordre: 0 }), nouveau("Pâtes", { ordre: 1 })]);
    expect(r.aSupprimer).toEqual([]);
    const oubli = r.aEcrire.find((e) => e.id === "o1");
    expect(oubli?.data).toMatchObject({ nom: "Piles", ajoutManuel: true, destination: "magasin", ordre: 2 });
  });

  it("un article du plan qui a disparu est supprimé ; un nouvel article est créé sans id", () => {
    const existants = [art("a1", { nom: "Courgettes" }), art("a2", { nom: "Riz" })];
    const r = fusionnerReimport(existants, [nouveau("Riz"), nouveau("Lentilles")]);
    expect(r.aSupprimer).toEqual(["a1"]);
    expect(r.aEcrire.map((e) => [e.id, e.data.nom])).toEqual([
      ["a2", "Riz"],
      [undefined, "Lentilles"],
    ]);
  });

  it("un oubli qui entre dans le plan devient un article du plan (gardant son tri)", () => {
    const existants = [art("o1", { nom: "Riz", ajoutManuel: true, destination: "deja" })];
    const r = fusionnerReimport(existants, [nouveau("riz")]);
    expect(r.aEcrire).toEqual([
      { id: "o1", data: expect.objectContaining({ ajoutManuel: false, destination: "deja" }) },
    ]);
  });

  it("deux articles existants pour la même clé : un seul est repris, l'autre supprimé", () => {
    const existants = [art("a1", { nom: "Riz" }), art("a2", { nom: "riz" })];
    const r = fusionnerReimport(existants, [nouveau("Riz")]);
    expect(r.aEcrire.map((e) => e.id)).toEqual(["a1"]);
    expect(r.aSupprimer).toEqual(["a2"]);
  });

  it("aucun champ undefined dans ce qui est écrit (refusé par Firestore)", () => {
    const existants = [art("x1", { nom: "Riz", checked: true, checkedBy: "u" })];
    const r = fusionnerReimport(existants, [nouveau("Riz")]);
    for (const { data } of r.aEcrire) {
      expect(Object.values(data).some((v) => v === undefined)).toBe(false);
    }
  });
});

describe("oublisAReporter", () => {
  it("reprend les oublis non cochés, remis au magasin, sans id", () => {
    const r = oublisAReporter([
      art("o1", { nom: "Piles", ajoutManuel: true, destination: "drive", ordre: 7 }),
      art("o2", { nom: "Ampoule", ajoutManuel: true, checked: true, checkedBy: "u" }),
      art("p1", { nom: "Riz", ajoutManuel: false }),
    ]);
    expect(r).toEqual([
      {
        nom: "Piles",
        quantite: 1,
        unite: "",
        rayon: "epicerie",
        recetteIds: [],
        ajoutManuel: true,
        destination: "magasin",
        placard: false,
        checked: false,
        checkedAt: null,
        checkedBy: null,
        ordre: 0,
      },
    ]);
  });

  it("ne reprend pas un oubli déjà dans le nouveau plan ; numérote après lui", () => {
    const { id: _id, ...riz } = art("n1", { nom: "Riz", ordre: 0 });
    const r = oublisAReporter(
      [
        art("o1", { nom: "riz", ajoutManuel: true }),
        art("o2", { nom: "Piles", ajoutManuel: true }),
        art("o3", { nom: "Lampe", ajoutManuel: true }),
      ],
      [riz],
    );
    expect(r.map((a) => [a.nom, a.ordre])).toEqual([
      ["Piles", 1],
      ["Lampe", 2],
    ]);
  });

  it("deux oublis identiques ne sont reportés qu'une fois", () => {
    const r = oublisAReporter([
      art("o1", { nom: "Piles", ajoutManuel: true }),
      art("o2", { nom: "piles", ajoutManuel: true }),
    ]);
    expect(r).toHaveLength(1);
  });
});
