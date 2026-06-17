import { describe, it, expect } from "vitest";
import type { Absence, Profil } from "@family-hub/types";
import {
  buildPlanMd,
  realDayLabel,
  deduceSaison,
  isAbsent,
  type BuildPlanMdInput,
} from "./planMd";

/**
 * Helper local : libellé jour-de-semaine capitalisé "à la française",
 * dérivé exactement comme le code applicatif (toLocaleDateString fr-FR).
 * Permet des assertions robustes au fuseau horaire de la machine de CI.
 */
function frWeekday(iso: string): string {
  const wd = new Date(iso).toLocaleDateString("fr-FR", { weekday: "long" });
  return wd.charAt(0).toUpperCase() + wd.slice(1);
}

function makeProfil(id: string, nom: string): Profil & { id: string } {
  return {
    id,
    nom,
    couleur: "#000000",
    initiale: nom.charAt(0),
    regimes: [],
    aversions: [],
    objectifsNutrition: [],
    prefsCuisson: [],
    createdAt: { seconds: 0, nanoseconds: 0 } as never,
    updatedAt: { seconds: 0, nanoseconds: 0 } as never,
  };
}

function baseInput(overrides: Partial<BuildPlanMdInput> = {}): BuildPlanMdInput {
  return {
    householdNom: "Test",
    dateDebutISO: "2026-06-17", // un mercredi
    profils: [makeProfil("p1", "Marie")],
    presence: {},
    contexte: { batchCookingOk: false, style: "", frigoTexte: "" },
    historiqueRecettes: [],
    nbJours: 3,
    ...overrides,
  };
}

describe("realDayLabel", () => {
  it("dérive le libellé du vrai jour calendaire (pas positionnel)", () => {
    const wed = new Date("2026-06-17"); // mercredi 17
    expect(realDayLabel(wed, 0)).toBe(`${frWeekday("2026-06-17")} 17`);
    expect(realDayLabel(wed, 1)).toBe(`${frWeekday("2026-06-18")} 18`);
  });
});

describe("buildPlanMd — libellés de jours", () => {
  it("démarre le tableau sur le VRAI jour (mercredi), pas 'Lundi' (guard régression)", () => {
    const md = buildPlanMd(baseInput({ dateDebutISO: "2026-06-17", nbJours: 3 }));

    const tableRows = md
      .split("\n")
      .filter((l) => l.startsWith("| ") && !l.startsWith("| Jour") && !l.startsWith("|---"));

    // Première ligne de données = mercredi 17, surtout PAS lundi.
    expect(tableRows[0]).toContain(`${frWeekday("2026-06-17")} 17`);
    expect(tableRows[0]).not.toContain("Lundi");
  });

  it("le jour-de-semaine du titre correspond à la première ligne du tableau", () => {
    const md = buildPlanMd(baseInput({ dateDebutISO: "2026-06-17" }));
    const wd = frWeekday("2026-06-17");

    const titleLine = md.split("\n").find((l) => l.startsWith("Le plan démarre"));
    expect(titleLine).toBeDefined();
    // Le titre contient le jour-de-semaine en minuscule (formatDateLong).
    expect(titleLine!.toLowerCase()).toContain(wd.toLowerCase());

    const firstRow = md
      .split("\n")
      .find((l) => l.startsWith("| ") && !l.startsWith("| Jour") && !l.startsWith("|---"));
    expect(firstRow).toContain(wd);
  });

  it("nbJours contrôle le nombre de lignes de jours", () => {
    for (const nb of [3, 5, 7]) {
      const md = buildPlanMd(baseInput({ nbJours: nb }));
      const rows = md
        .split("\n")
        .filter((l) => l.startsWith("| ") && !l.startsWith("| Jour") && !l.startsWith("|---"));
      expect(rows).toHaveLength(nb);
    }
  });
});

describe("isAbsent", () => {
  const interval: Absence = {
    kind: "interval",
    profilId: "p1",
    from: "2026-06-17",
    to: "2026-06-19",
    repas: ["dej"],
  };

  it("matche dans l'intervalle pour le bon repas", () => {
    expect(isAbsent(interval, "2026-06-18", "dej")).toBe(true);
  });

  it("ne traverse PAS les repas : une absence 'dej' n'affecte pas 'diner'", () => {
    expect(isAbsent(interval, "2026-06-18", "diner")).toBe(false);
    expect(isAbsent(interval, "2026-06-18", "petitDej")).toBe(false);
  });

  it("ne matche pas hors de l'intervalle", () => {
    expect(isAbsent(interval, "2026-06-16", "dej")).toBe(false);
    expect(isAbsent(interval, "2026-06-20", "dej")).toBe(false);
  });

  it("repas undefined = tous les repas de l'intervalle", () => {
    const allMeals: Absence = {
      kind: "interval",
      profilId: "p1",
      from: "2026-06-17",
      to: "2026-06-19",
    };
    expect(isAbsent(allMeals, "2026-06-18", "dej")).toBe(true);
    expect(isAbsent(allMeals, "2026-06-18", "diner")).toBe(true);
    expect(isAbsent(allMeals, "2026-06-18", "petitDej")).toBe(true);
  });

  it("recurring : matche le bon weekday + repas, sans traverser les repas", () => {
    // 2026-06-17 est un mercredi → getDay() === 3
    const recurring: Absence = {
      kind: "recurring",
      profilId: "p1",
      weekdays: [3],
      repas: ["dej"],
    };
    expect(new Date("2026-06-17").getDay()).toBe(3);
    expect(isAbsent(recurring, "2026-06-17", "dej")).toBe(true); // mercredi midi
    expect(isAbsent(recurring, "2026-06-17", "diner")).toBe(false); // pas le dîner
    expect(isAbsent(recurring, "2026-06-18", "dej")).toBe(false); // jeudi
  });
});

describe("deduceSaison — bornes", () => {
  it("hiver : décembre, janvier, février", () => {
    expect(deduceSaison(new Date("2026-12-15"))).toBe("hiver");
    expect(deduceSaison(new Date("2026-01-15"))).toBe("hiver");
    expect(deduceSaison(new Date("2026-02-28"))).toBe("hiver");
  });
  it("printemps : mars, avril, mai", () => {
    expect(deduceSaison(new Date("2026-03-01"))).toBe("printemps");
    expect(deduceSaison(new Date("2026-05-31"))).toBe("printemps");
  });
  it("ete : juin, juillet, aout", () => {
    expect(deduceSaison(new Date("2026-06-01"))).toBe("ete");
    expect(deduceSaison(new Date("2026-08-31"))).toBe("ete");
  });
  it("automne : septembre, octobre, novembre", () => {
    expect(deduceSaison(new Date("2026-09-01"))).toBe("automne");
    expect(deduceSaison(new Date("2026-11-30"))).toBe("automne");
  });
});
