import { describe, expect, it } from "vitest";
import type { Household, Profil } from "@family-hub/types";
import { couleurDuProfil, estParent, profilDuCompte, teinteLaPlusProche } from "./personnes";

describe("couleurDuProfil", () => {
  it("utilise la variable du design system quand couleurPersonne est présent", () => {
    expect(couleurDuProfil({ couleurPersonne: "toleRouge", couleur: "#E07A5F" })).toBe(
      "rgb(var(--c-p-toleRouge))",
    );
  });
  it("replie sur l'ancien hex sinon", () => {
    expect(couleurDuProfil({ couleur: "#E07A5F" })).toBe("#E07A5F");
  });
});

describe("profilDuCompte", () => {
  const p = (id: string, uid?: string) => ({ id, uid, nom: id }) as unknown as Profil & { id: string };
  it("trouve le profil relié au compte", () => {
    expect(profilDuCompte([p("a"), p("b", "u1")], "u1")?.id).toBe("b");
  });
  it("renvoie undefined sinon", () => {
    expect(profilDuCompte([p("a")], "u1")).toBeUndefined();
  });
});

describe("estParent", () => {
  const h = (roles: Household["roles"], membres = ["u1", "u2"]) =>
    ({ membres, roles }) as unknown as Household;
  it("parent explicite", () => expect(estParent(h({ u1: "parent" }), "u1")).toBe(true));
  it("enfant", () => expect(estParent(h({ u1: "parent", u2: "enfant" }), "u2")).toBe(false));
  it("roles absent : membre = parent", () => expect(estParent(h(undefined), "u2")).toBe(true));
  it("roles présent, uid absent : false", () =>
    expect(estParent(h({ u1: "parent" }), "u2")).toBe(false));
  it("roles absent : non-membre", () => expect(estParent(h(undefined), "u9")).toBe(false));
});

describe("teinteLaPlusProche", () => {
  it("retrouve la teinte exacte de la palette (jour ou nuit)", () => {
    expect(teinteLaPlusProche("#2B7A4B")).toBe("sapin");
    expect(teinteLaPlusProche("#B994F2")).toBe("lilas");
  });
  it("rapproche les anciens hex libres de la teinte la plus proche", () => {
    expect(teinteLaPlusProche("#81B29A")).toBe("sapin");
    expect(teinteLaPlusProche("#E07A5F")).toBe("toleRouge");
    expect(teinteLaPlusProche("#F2CC8F")).toBe("miel");
    expect(teinteLaPlusProche("#4A6F8F")).toBe("ardoise");
    expect(teinteLaPlusProche("#abc")).toBeTypeOf("string");
  });
  it("hex illisible ou absent → sapin", () => {
    expect(teinteLaPlusProche("rouge")).toBe("sapin");
    expect(teinteLaPlusProche(undefined)).toBe("sapin");
    expect(teinteLaPlusProche("")).toBe("sapin");
  });
});
