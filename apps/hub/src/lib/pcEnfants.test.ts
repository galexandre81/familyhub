import { describe, expect, it } from "vitest";
import { NOM_PC_DEFAUT, titrePcEnfants } from "./pcEnfants";

describe("titrePcEnfants", () => {
  it("nom réglé : affiché tel quel (sans espaces autour)", () => {
    expect(titrePcEnfants({ nomPcEnfants: "  PC de Léo " })).toBe("PC de Léo");
  });
  it("absent, vide ou blanc : nom par défaut", () => {
    expect(titrePcEnfants(undefined)).toBe(NOM_PC_DEFAUT);
    expect(titrePcEnfants({})).toBe(NOM_PC_DEFAUT);
    expect(titrePcEnfants({ nomPcEnfants: "   " })).toBe(NOM_PC_DEFAUT);
  });
  it("trop long : coupé à 30 caractères", () => {
    expect(titrePcEnfants({ nomPcEnfants: "x".repeat(50) })).toHaveLength(30);
  });
});
