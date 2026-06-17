import { describe, it, expect } from "vitest";
import { parsePlanImport, type PlanImport } from "./planImportSchema";

/** Plan minimal valide, sérialisable, mutable par test. */
function minimalPlan(): PlanImport {
  return {
    recettes: [
      {
        tempId: "r1",
        titre: "Omelette",
        portions: 2,
        dureePreparation: 5,
        dureeCuisson: 5,
        difficulte: "facile",
        tags: [],
        ingredients: [
          {
            nom: "oeuf",
            quantite: 4,
            unite: "u",
            rayon: "cremerie",
          },
        ],
        etapes: [{ ordre: 1, texte: "Battre les oeufs" }],
      },
    ],
    batchSessions: [],
    slots: [
      {
        date: "2026-06-17",
        repas: "dejeuner",
        profilsPresentsNoms: ["Marie"],
        invitesNoms: [],
        source: "fresh",
        recetteTempIds: ["r1"],
      },
    ],
    shoppingList: { items: [] },
  };
}

function parse(plan: unknown) {
  return parsePlanImport(JSON.stringify(plan));
}

describe("parsePlanImport", () => {
  it("parse un plan minimal valide", () => {
    const res = parse(minimalPlan());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.recettes).toHaveLength(1);
      expect(res.data.slots).toHaveLength(1);
    }
  });

  it("tolère un fence ```json autour du JSON", () => {
    const res = parsePlanImport("```json\n" + JSON.stringify(minimalPlan()) + "\n```");
    expect(res.ok).toBe(true);
  });

  it("rejette une date calendaire impossible (2026-02-31)", () => {
    const plan = minimalPlan();
    plan.slots[0].date = "2026-02-31";
    const res = parse(plan);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => /impossible/i.test(e))).toBe(true);
    }
  });

  it("rejette des slots en doublon (date, repas)", () => {
    const plan = minimalPlan();
    plan.slots.push({
      date: "2026-06-17",
      repas: "dejeuner",
      profilsPresentsNoms: ["Marie"],
      invitesNoms: [],
      source: "fresh",
      recetteTempIds: ["r1"],
    });
    const res = parse(plan);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => /même date et le même repas/i.test(e))).toBe(true);
    }
  });

  it("rejette une fenêtre de plan > 31 jours", () => {
    const plan = minimalPlan();
    plan.slots.push({
      date: "2026-08-01", // ~45 jours après le 2026-06-17
      repas: "diner",
      profilsPresentsNoms: ["Marie"],
      invitesNoms: [],
      source: "fresh",
      recetteTempIds: ["r1"],
    });
    const res = parse(plan);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => /max 31|fenêtre du plan/i.test(e))).toBe(true);
    }
  });

  it("rejette un JSON syntaxiquement invalide", () => {
    const res = parsePlanImport("{ pas du json");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => /JSON invalide/i.test(e))).toBe(true);
    }
  });

  it("rejette un tempId de recette dupliqué", () => {
    const plan = minimalPlan();
    plan.recettes.push({ ...plan.recettes[0] }); // même tempId "r1"
    const res = parse(plan);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => /uniques/i.test(e))).toBe(true);
    }
  });
});
