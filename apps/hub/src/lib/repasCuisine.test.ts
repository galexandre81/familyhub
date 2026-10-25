import { describe, expect, it } from "vitest";
import type { Recette } from "@family-hub/types";
import {
  assemblerRepas,
  etapesTriees,
  libelleEtape,
  portionsParDefaut,
  quantiteAjustee,
  titreRepas,
} from "./repasCuisine";

function recette(nom: string, portions = 4): Recette {
  return { nom, portions, ingredients: [], etapes: [] } as unknown as Recette;
}

describe("assemblerRepas", () => {
  it("garde l'ordre (plat principal d'abord) et signale les recettes manquantes", () => {
    const plat = recette("Poulet");
    const accomp = recette("Riz");
    const r = assemblerRepas(["plat", "absente", "accomp"], { plat, accomp, absente: undefined });
    expect(r.presentes).toEqual([
      { id: "plat", recette: plat },
      { id: "accomp", recette: accomp },
    ]);
    expect(r.manquantes).toEqual(["absente"]);
  });
  it("ignore les doublons", () => {
    const plat = recette("Poulet");
    const r = assemblerRepas(["plat", "plat"], { plat });
    expect(r.presentes).toHaveLength(1);
    expect(r.manquantes).toEqual([]);
  });
});

describe("quantiteAjustee", () => {
  it("accepte un nombre, null ou undefined sans planter", () => {
    expect(quantiteAjustee(200, 4, 2)).toBe("100");
    expect(quantiteAjustee(1.5, 4, 6)).toBe("2,3");
    expect(quantiteAjustee(null, 4, 2)).toBe("");
    expect(quantiteAjustee(undefined, 4, 2)).toBe("");
    expect(quantiteAjustee(undefined, 0, 2)).toBe("");
  });
  it("fraction simple", () => {
    expect(quantiteAjustee("1/2", 2, 4)).toBe("1");
  });
  it("décimale à virgule, arrondi à 1 décimale", () => {
    expect(quantiteAjustee("1,5", 4, 6)).toBe("2,3");
  });
  it("entier", () => {
    expect(quantiteAjustee("200", 4, 2)).toBe("100");
  });
  it("texte non numérique inchangé", () => {
    expect(quantiteAjustee("qsp", 4, 8)).toBe("qsp");
    expect(quantiteAjustee("", 4, 8)).toBe("");
  });
  it("garde le texte qui suit le nombre", () => {
    expect(quantiteAjustee("2 gousses", 4, 2)).toBe("1 gousses");
  });
  it("point décimal accepté, rendu en virgule", () => {
    expect(quantiteAjustee("0.5", 1, 3)).toBe("1,5");
  });
  it("portions de base invalides : inchangé", () => {
    expect(quantiteAjustee("200", 0, 4)).toBe("200");
  });
});

describe("portionsParDefaut", () => {
  it("nombre de présents (invités compris)", () => {
    expect(portionsParDefaut({ profilsPresents: ["a", "b", "c"], invitesNoms: ["Marc"] }, 4)).toBe(4);
    expect(portionsParDefaut({ profilsPresents: ["a", "b"] }, 6)).toBe(2);
  });
  it("sinon portions de la recette", () => {
    expect(portionsParDefaut({ profilsPresents: [] }, 6)).toBe(6);
    expect(portionsParDefaut(undefined, 3)).toBe(3);
  });
  it("repli à 4 sans rien", () => {
    expect(portionsParDefaut(undefined, undefined)).toBe(4);
  });
});

describe("libelleEtape", () => {
  it("court : inchangé", () => {
    expect(libelleEtape("Cuire les pâtes")).toBe("Cuire les pâtes");
  });
  it("long : coupé à 30 caractères avec points de suspension", () => {
    const l = libelleEtape("Faire revenir les oignons dans le beurre à feu doux");
    expect(l.length).toBeLessThanOrEqual(30);
    expect(l.startsWith("Faire revenir les oignons")).toBe(true);
    expect(l.endsWith("…")).toBe(true);
  });
  it("espaces et sauts de ligne normalisés", () => {
    expect(libelleEtape("  Cuire\n  le riz ")).toBe("Cuire le riz");
  });
});

describe("etapesTriees", () => {
  it("trie par ordre", () => {
    const e = etapesTriees([
      { ordre: 2, description: "b" },
      { ordre: 1, description: "a" },
    ]);
    expect(e.map((x) => x.description)).toEqual(["a", "b"]);
  });
});

describe("titreRepas", () => {
  it("repas et date en français", () => {
    expect(titreRepas("diner", "2026-10-27")).toBe("Dîner du mardi 27 octobre");
    expect(titreRepas("petitDej", "2026-10-25")).toBe("Petit-déjeuner du dimanche 25 octobre");
  });
  it("sans date : le repas seul", () => {
    expect(titreRepas("dej", undefined)).toBe("Déjeuner");
  });
});
