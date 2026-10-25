import { describe, expect, it } from "vitest";
import type { Household, Profil } from "@family-hub/types";
import { couleurDuProfil, estParent, profilDuCompte } from "./personnes";

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
  it("roles absent : non-membre", () => expect(estParent(h(undefined), "u9")).toBe(false));
});
