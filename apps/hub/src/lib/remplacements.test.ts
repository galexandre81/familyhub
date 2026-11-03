import { describe, expect, it } from "vitest";
import {
  carteRemplacements,
  cleIngredient,
  debutRemplacement,
  indicesIngredient,
  lectureTolerante,
  planIdsCandidatsBatch,
  planIdsEnCours,
  libelleArticleTexte,
  remplacementsDeRecette,
  semaineEnCours,
  texteRappel,
  texteRemplacement,
} from "./remplacements";

describe("texteRemplacement", () => {
  it("rogne, tronque à 100, vide devient null", () => {
    expect(texteRemplacement("  yaourt  ")).toBe("yaourt");
    expect(texteRemplacement("   ")).toBeNull();
    expect(texteRemplacement("x".repeat(150))).toHaveLength(100);
  });
});

describe("cleIngredient", () => {
  it("retire la ponctuation, garde l'apostrophe", () => {
    expect(cleIngredient("Crème (fraîche), « épaisse »")).toBe("creme fraiche epaisse");
    expect(cleIngredient("sel - poivre / huile")).toBe("sel poivre huile");
    expect(cleIngredient("gousse d'ail")).toBe("gousse d'ail");
  });
});

describe("indicesIngredient", () => {
  it("trouve par clé identique, pluriel compris", () => {
    expect(indicesIngredient("Poivrons", [{ libelle: "poivron" }])).toEqual([0]);
    expect(indicesIngredient("beurre", [{ libelle: "Beurre" }, { libelle: "beurre" }])).toEqual([0, 1]);
  });
  it("sinon un seul candidat par inclusion de mots", () => {
    expect(indicesIngredient("oignons jaunes", [{ libelle: "sel" }, { libelle: "oignon" }])).toEqual([1]);
    expect(indicesIngredient("oignon", [{ libelle: "oignon jaune" }, { libelle: "sel" }])).toEqual([0]);
  });
  it("ambigu ou absent : aucun indice", () => {
    expect(indicesIngredient("crème", [{ libelle: "crème fraîche" }, { libelle: "crème liquide" }])).toEqual([]);
    expect(indicesIngredient("poulet", [{ libelle: "riz" }])).toEqual([]);
  });
});

describe("remplacementsDeRecette et carteRemplacements", () => {
  const actifs = [
    { nomArticle: "Beurre", remplacement: "margarine", recetteIds: ["r1", "r2"] },
    { nomArticle: "Crème", remplacement: "yaourt", recetteIds: ["r2"] },
  ];
  it("filtre par recette", () => {
    expect(remplacementsDeRecette(actifs, "r1")).toEqual([actifs[0]]);
    expect(remplacementsDeRecette(actifs, "r2")).toEqual(actifs);
    expect(remplacementsDeRecette(actifs, "r3")).toEqual([]);
  });
  it("carte : libellé exact vers remplacement, deux lignes identiques une clé", () => {
    const carte = carteRemplacements([{ libelle: "beurre" }, { libelle: "beurre" }, { libelle: "sel" }], actifs);
    expect([...carte.entries()]).toEqual([["beurre", "margarine"]]);
  });
  it("le premier actif gagne", () => {
    const carte = carteRemplacements(
      [{ libelle: "beurre" }],
      [actifs[0], { nomArticle: "beurre", remplacement: "huile", recetteIds: ["r1"] }],
    );
    expect(carte.get("beurre")).toBe("margarine");
  });
  it("aucun actif correspondant : carte vide", () => {
    expect(carteRemplacements([{ libelle: "sel" }], actifs).size).toBe(0);
  });
});

describe("semaineEnCours", () => {
  it("bornes comprises, borne absente faux", () => {
    expect(semaineEnCours("2026-11-02", "2026-11-08", "2026-11-08")).toBe(true);
    expect(semaineEnCours("2026-11-02", "2026-11-08", "2026-11-02")).toBe(true);
    expect(semaineEnCours("2026-11-02", "2026-11-08", "2026-11-09")).toBe(false);
    expect(semaineEnCours("2026-11-09", "2026-11-15", "2026-11-07")).toBe(false);
    expect(semaineEnCours(undefined, "2026-11-08", "2026-11-05")).toBe(false);
    expect(semaineEnCours("2026-11-02", undefined, "2026-11-05")).toBe(false);
  });
});

describe("libelleArticleTexte", () => {
  it("avec et sans remplacement", () => {
    expect(libelleArticleTexte({ nom: "Crème", quantite: 40, unite: "cl", remplacement: "yaourt" })).toBe(
      "yaourt (à la place de : Crème, 40 cl)",
    );
    expect(libelleArticleTexte({ nom: "Crème", quantite: 1, unite: "", remplacement: "yaourt" })).toBe(
      "yaourt (à la place de : Crème)",
    );
    expect(libelleArticleTexte({ nom: "Crème", quantite: 40, unite: "cl" })).toBe("Crème (40 cl)");
  });
});

describe("lectureTolerante", () => {
  it("une lecture rejetée est absente, la réussie est gardée", async () => {
    const res = await lectureTolerante(["a", "b"], async (id) => {
      if (id === "a") throw new Error("refus");
      return { id };
    });
    expect(res).toEqual({ b: { id: "b" } });
  });

  it("une lecture à null est absente", async () => {
    const res = await lectureTolerante(["a", "b"], async (id) => (id === "a" ? null : 1));
    expect(res).toEqual({ b: 1 });
  });
});

describe("texteRappel", () => {
  it("dit le remplacement de la semaine", () => {
    expect(texteRappel({ nomArticle: "Crème", remplacement: "yaourt", recetteIds: [] })).toBe(
      "Cette semaine : yaourt à la place de Crème",
    );
  });
});

describe("debutRemplacement : le batch de la veille compte", () => {
  it("un batch le dimanche avant le premier repas avance le début", () => {
    expect(debutRemplacement("2026-11-02", ["2026-11-01"])).toBe("2026-11-01");
    expect(semaineEnCours(debutRemplacement("2026-11-02", ["2026-11-01"]), "2026-11-08", "2026-11-01")).toBe(true);
  });
  it("sans batch, le début reste celui du plan", () => {
    expect(debutRemplacement("2026-11-02", [])).toBe("2026-11-02");
  });
  it("un batch dans la semaine ne change pas le début", () => {
    expect(debutRemplacement("2026-11-02", ["2026-11-04", "2026-11-06"])).toBe("2026-11-02");
  });
  it("dates de batch vides ignorées, plusieurs batchs : le plus ancien", () => {
    expect(debutRemplacement("2026-11-02", ["", "2026-10-31", "2026-11-01"])).toBe("2026-10-31");
  });
  it("sans début de plan : indéfini", () => {
    expect(debutRemplacement(undefined, ["2026-11-01"])).toBeUndefined();
  });
});

describe("remplacementsDeRecette : rappels identiques fusionnés", () => {
  it("deux plans en cours, même article et même remplacement : un seul rappel", () => {
    const a = [
      { nomArticle: "Crème", remplacement: "yaourt", recetteIds: ["r1"] },
      { nomArticle: "crème", remplacement: "Yaourt ", recetteIds: ["r1"] },
      { nomArticle: "Crème", remplacement: "skyr", recetteIds: ["r1"] },
    ];
    expect(remplacementsDeRecette(a, "r1")).toEqual([a[0], a[2]]);
  });
});

describe("plans en cours avec leurs batchs", () => {
  const plans = [
    { id: "fini", debutISO: "2026-10-19", finISO: "2026-10-25" },
    { id: "courant", debutISO: "2026-11-02", finISO: "2026-11-08" },
    { id: "suivant", debutISO: "2026-11-09", finISO: "2026-11-15" },
    { id: "sans-dates", debutISO: undefined, finISO: undefined },
  ];
  it("candidats au batch : seulement les plans pas encore commencés mais pas finis", () => {
    expect(planIdsCandidatsBatch(plans, "2026-11-07")).toEqual(["suivant"]);
  });
  it("le batch du dimanche avant le plan suivant le fait entrer en cours ce dimanche", () => {
    expect(planIdsEnCours(plans, { suivant: ["2026-11-08"] }, "2026-11-08")).toEqual(["courant", "suivant"]);
  });
  it("sans batch, le plan suivant n'est pas en cours la veille", () => {
    expect(planIdsEnCours(plans, {}, "2026-11-08")).toEqual(["courant"]);
  });
  it("un batch ne ressuscite pas un plan fini ni ne devance de plus que sa date", () => {
    expect(planIdsEnCours(plans, { suivant: ["2026-11-08"] }, "2026-11-07")).toEqual(["courant"]);
    expect(planIdsEnCours(plans, { fini: ["2026-10-18"] }, "2026-11-03")).toEqual(["courant"]);
  });
});
