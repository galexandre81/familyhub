import { describe, expect, it } from "vitest";
import type { ArticleCourses, ShoppingListItem } from "@family-hub/types";
import {
  articleOubli,
  cleArticle,
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
