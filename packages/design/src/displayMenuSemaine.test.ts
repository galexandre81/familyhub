/**
 * Menu de la semaine de l'iPad (apps/display/public/js/tiles/weekly-menu.js,
 * ES5) : le fichier livré est exécuté tel quel dans un contexte vm, comme
 * dans Safari (window). Fonctions pures de la vue plein écran.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  fileURLToPath(new URL("../../../apps/display/public/js/tiles/weekly-menu.js", import.meta.url)),
  "utf8",
);

type Slot = {
  repas: string;
  recetteIds?: string[];
  annule?: boolean;
  profilsCount?: number;
  invitesCount?: number;
  isBatchConsumer?: boolean;
};
type Menu = {
  repasAffiches(semaine: Slot[]): string[];
  metaCase(slot: Slot): string;
  plageSemaine(debut: string, fin?: string): string;
};

function charger(): Menu {
  const window: { Tiles?: Record<string, unknown> } = {};
  runInNewContext(SOURCE, { window, Date, Math, String, parseInt, isNaN });
  return window.Tiles!["weekly-menu"] as Menu;
}

describe("repasAffiches (colonnes de la semaine)", () => {
  const menu = charger();

  it("sans recette au petit-déjeuner : déjeuner et dîner seulement", () => {
    expect(menu.repasAffiches([
      { repas: "petitDej", recetteIds: [], profilsCount: 4 },
      { repas: "dej", recetteIds: ["a"] },
      { repas: "diner", recetteIds: [] },
    ])).toEqual(["dej", "diner"]);
    expect(menu.repasAffiches([])).toEqual(["dej", "diner"]);
  });

  it("un petit-déjeuner avec recette : les trois repas", () => {
    expect(menu.repasAffiches([
      { repas: "petitDej", recetteIds: ["p"] },
      { repas: "dej", recetteIds: [] },
    ])).toEqual(["petitDej", "dej", "diner"]);
  });
});

describe("metaCase (ligne sous le plat)", () => {
  const menu = charger();

  it("personnes, invités et batch", () => {
    expect(menu.metaCase({ repas: "diner", profilsCount: 4, invitesCount: 2, isBatchConsumer: true }))
      .toBe("4 pers. · +2 invités · batch");
    expect(menu.metaCase({ repas: "dej", profilsCount: 1, invitesCount: 1 })).toBe("1 pers. · +1 invité");
  });

  it("un repas annulé le dit en premier", () => {
    expect(menu.metaCase({ repas: "diner", annule: true, profilsCount: 3 })).toBe("Annulé · 3 pers.");
  });

  it("rien à dire : chaîne vide", () => {
    expect(menu.metaCase({ repas: "dej" })).toBe("");
  });
});

describe("plageSemaine (sous-titre)", () => {
  const menu = charger();

  it("même mois : le mois une seule fois", () => {
    expect(menu.plageSemaine("2026-10-22", "2026-10-28")).toBe("Du jeu. 22 au mer. 28 oct.");
  });

  it("à cheval sur deux mois : les deux mois", () => {
    expect(menu.plageSemaine("2026-10-29", "2026-11-04")).toBe("Du jeu. 29 oct. au mer. 4 nov.");
  });

  it("date invalide : chaîne vide", () => {
    expect(menu.plageSemaine("")).toBe("");
    expect(menu.plageSemaine("n'importe")).toBe("");
  });
});
