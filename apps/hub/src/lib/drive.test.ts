import { describe, expect, it } from "vitest";
import type { ArticleCourses } from "@family-hub/types";
import {
  htmlListeMagasin,
  lienRechercheDrive,
  modeleDriveValide,
  RECHERCHE_DRIVE_DEFAUT,
  texteListeDrive,
} from "./drive";

type A = ArticleCourses & { id: string };
const art = (id: string, extra: Partial<ArticleCourses> = {}): A => ({
  id,
  nom: id,
  quantite: 1,
  unite: "",
  rayon: "epicerie",
  recetteIds: [],
  ajoutManuel: false,
  destination: "drive",
  placard: false,
  checked: false,
  checkedAt: null,
  checkedBy: null,
  ordre: 0,
  ...extra,
});

describe("lienRechercheDrive", () => {
  it("utilise la recherche Intermarché par défaut", () => {
    expect(RECHERCHE_DRIVE_DEFAUT).toBe("https://www.intermarche.com/recherche/{terme}");
    expect(lienRechercheDrive("lait")).toBe("https://www.intermarche.com/recherche/lait");
  });

  it("encode les accents et les espaces", () => {
    expect(lienRechercheDrive("crème fraîche")).toBe(
      "https://www.intermarche.com/recherche/cr%C3%A8me%20fra%C3%AEche",
    );
  });

  it("encode l'apostrophe, droite ou typographique", () => {
    expect(lienRechercheDrive("gousse d'ail")).toBe("https://www.intermarche.com/recherche/gousse%20d%27ail");
    expect(lienRechercheDrive("gousse d’ail")).toBe("https://www.intermarche.com/recherche/gousse%20d%27ail");
  });

  it("retire les espaces autour du nom", () => {
    expect(lienRechercheDrive("  pâtes  ")).toBe("https://www.intermarche.com/recherche/p%C3%A2tes");
  });

  it("suit un modèle personnalisé (chaque {terme} est remplacé)", () => {
    expect(lienRechercheDrive("riz basmati", "https://drive.exemple.fr/s?q={terme}&t={terme}")).toBe(
      "https://drive.exemple.fr/s?q=riz%20basmati&t=riz%20basmati",
    );
  });

  it("revient au modèle par défaut si le modèle est vide ou invalide", () => {
    expect(lienRechercheDrive("lait", "")).toBe("https://www.intermarche.com/recherche/lait");
    expect(lienRechercheDrive("lait", "   ")).toBe("https://www.intermarche.com/recherche/lait");
    expect(lienRechercheDrive("lait", "https://exemple.fr/sans-terme")).toBe(
      "https://www.intermarche.com/recherche/lait",
    );
    expect(lienRechercheDrive("lait", "javascript:alert({terme})")).toBe(
      "https://www.intermarche.com/recherche/lait",
    );
  });
});

describe("modeleDriveValide", () => {
  it("demande une adresse web avec {terme}", () => {
    expect(modeleDriveValide("https://www.intermarche.com/recherche/{terme}")).toBe(true);
    expect(modeleDriveValide("http://exemple.fr/?q={terme}")).toBe(true);
    expect(modeleDriveValide("https://exemple.fr/")).toBe(false);
    expect(modeleDriveValide("exemple.fr/{terme}")).toBe(false);
    expect(modeleDriveValide("https://exemple.fr/ {terme}")).toBe(false);
    expect(modeleDriveValide("")).toBe(false);
  });
});

describe("texteListeDrive", () => {
  it("un article du drive non coché par ligne, dans l'ordre, avec la quantité", () => {
    const articles = [
      art("b", { nom: "Riz", quantite: 500, unite: "g", ordre: 2 }),
      art("a", { nom: "Lait", quantite: 2, unite: "", ordre: 1 }),
      art("c", { nom: "Sel", ordre: 3 }),
      art("d", { nom: "Beurre", checked: true, ordre: 0 }),
      art("e", { nom: "Tomates", destination: "magasin", ordre: 0 }),
      art("f", { nom: "Farine", destination: "deja", ordre: 0 }),
      art("g", { nom: "Œufs", destination: "a-trier", ordre: 0 }),
    ];
    expect(texteListeDrive(articles)).toBe("Lait (2)\nRiz (500 g)\nSel");
  });

  it("vide s'il n'y a rien à commander", () => {
    expect(texteListeDrive([])).toBe("");
    expect(texteListeDrive([art("a", { checked: true })])).toBe("");
  });
});

describe("htmlListeMagasin", () => {
  const date = new Date(2026, 9, 26);

  it("articles du magasin non cochés, par rayon, échappés", () => {
    const html = htmlListeMagasin(
      [
        art("a", { nom: "Tomates <bio>", destination: "magasin", rayon: "fruits-legumes", quantite: 1, unite: "kg" }),
        art("b", { nom: "Pâtes", destination: "a-trier", rayon: "epicerie" }),
        art("c", { nom: "Beurre", destination: "magasin", rayon: "cremerie", checked: true }),
        art("d", { nom: "Riz", destination: "drive" }),
        art("e", { nom: "Sel", destination: "deja" }),
      ],
      date,
    );
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Tomates &lt;bio&gt;");
    expect(html).toContain("1 kg");
    expect(html).toContain("Pâtes");
    expect(html).not.toContain("Beurre");
    expect(html).not.toContain("Riz");
    expect(html).not.toContain(">Sel<");
    expect(html.indexOf("Fruits et légumes")).toBeGreaterThan(-1);
    expect(html.indexOf("Fruits et légumes")).toBeLessThan(html.indexOf("Épicerie"));
    expect(html).toContain("lundi 26 octobre 2026");
  });

  it("vide s'il n'y a rien à acheter au magasin", () => {
    expect(htmlListeMagasin([art("a", { destination: "drive" })], date)).toBe("");
  });
});
