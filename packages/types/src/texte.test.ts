import { describe, expect, it } from "vitest";
import { normaliserNom } from "./texte";

describe("normaliserNom", () => {
  it("met en minuscules et retire les accents", () => {
    expect(normaliserNom("Crème Fraîche")).toBe("creme fraiche");
    expect(normaliserNom("Épinard")).toBe("epinard");
  });

  it("« Œufs » et « oeuf » donnent la même clé", () => {
    expect(normaliserNom("Œufs")).toBe("oeuf");
    expect(normaliserNom("oeuf")).toBe("oeuf");
    expect(normaliserNom("œufs")).toBe(normaliserNom("Oeuf"));
  });

  it("retire le pluriel final s/x de chaque mot", () => {
    expect(normaliserNom("gousses d'ail")).toBe("gousse d'ail");
    expect(normaliserNom("pommes de terre")).toBe("pomme de terre");
    expect(normaliserNom("Poireaux")).toBe("poireau");
    expect(normaliserNom("tomates cerises")).toBe("tomate cerise");
  });

  it("singulier et pluriel se rejoignent", () => {
    expect(normaliserNom("Carottes")).toBe(normaliserNom("carotte"));
    expect(normaliserNom("noix")).toBe(normaliserNom("noix"));
  });

  it("réduit et retire les espaces superflus", () => {
    expect(normaliserNom("  huile   d'olive ")).toBe("huile d'olive");
    expect(normaliserNom("sel\t fin")).toBe("sel fin");
  });

  it("garde les mots courts intacts", () => {
    expect(normaliserNom("os")).toBe("os");
    expect(normaliserNom("riz")).toBe("riz");
  });

  it("chaîne vide → vide", () => {
    expect(normaliserNom("   ")).toBe("");
  });
});
