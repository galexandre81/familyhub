import { describe, expect, it } from "vitest";
import {
  carteRemplacements,
  cleIngredient,
  indicesIngredient,
  libelleArticleTexte,
  remplacementsDeRecette,
  semaineEnCours,
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
