import { describe, expect, it } from "vitest";
import { estProduitPlacard, PLACARD_DEFAUT } from "./placard";

describe("estProduitPlacard", () => {
  it("reconnaît les produits de la liste par défaut", () => {
    expect(estProduitPlacard("Huile d'olive")).toBe(true);
    expect(estProduitPlacard("Piment d'Espelette")).toBe(true);
    expect(estProduitPlacard("Sel fin")).toBe(true);
    expect(estProduitPlacard("sel")).toBe(true);
    expect(estProduitPlacard("Sucre glace")).toBe(true);
    expect(estProduitPlacard("Herbes de Provence")).toBe(true);
    expect(estProduitPlacard("Huile d'olive vierge")).toBe(true);
    expect(estProduitPlacard("Maïzena")).toBe(true);
  });

  it("correspond par mot entier en début de nom", () => {
    expect(estProduitPlacard("poivrons rouges")).toBe(false);
    expect(estProduitPlacard("selle d'agneau")).toBe(false);
    expect(estProduitPlacard("pommes de terre")).toBe(false);
    expect(estProduitPlacard("farine")).toBe(true);
    expect(estProduitPlacard("poivre noir")).toBe(true);
  });

  it("ignore pluriel, accents et casse", () => {
    expect(estProduitPlacard("Épices")).toBe(true);
    expect(estProduitPlacard("épice")).toBe(true);
    expect(estProduitPlacard("CUBES de bouillon")).toBe(true);
  });

  it("ne reconnaît pas un mot qui n'est pas en début de nom", () => {
    expect(estProduitPlacard("pâtes au sel")).toBe(false);
  });

  it("utilise la liste fournie", () => {
    expect(estProduitPlacard("sel", ["riz"])).toBe(false);
    expect(estProduitPlacard("Riz basmati", ["riz"])).toBe(true);
    expect(estProduitPlacard("sel", [])).toBe(false);
  });

  it("la liste par défaut contient les 24 entrées", () => {
    expect(PLACARD_DEFAUT).toHaveLength(24);
  });
});
