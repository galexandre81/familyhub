/**
 * Tests unitaires sur le parsing/validation des outputs LLM.
 * Lancement : `npm test` côté functions/.
 */

import { describe, expect, it } from "vitest";
import {
  buildMockMealPlanOutput,
  parseMealPlanLLMOutput,
  validateMealPlanReferences,
} from "./index";

describe("parseMealPlanLLMOutput", () => {
  it("accepte un output valide complet (mock)", () => {
    const mock = buildMockMealPlanOutput();
    const parsed = parseMealPlanLLMOutput(mock);
    expect(parsed.recettes.length).toBeGreaterThan(0);
    expect(parsed.slots.length).toBe(21); // 7 jours × 3 repas
    expect(parsed.courses.length).toBeGreaterThan(0);
  });

  it("rejette un slotId malformé", () => {
    const bad = buildMockMealPlanOutput();
    bad.slots[0].slotId = "invalid";
    expect(() => parseMealPlanLLMOutput(bad)).toThrow(/invalide/i);
  });

  it("rejette une recette sans ingredient", () => {
    const bad = buildMockMealPlanOutput();
    bad.recettes[0].ingredients = [];
    expect(() => parseMealPlanLLMOutput(bad)).toThrow(/invalide/i);
  });

  it("rejette une difficulté hors enum", () => {
    const bad: ReturnType<typeof buildMockMealPlanOutput> = JSON.parse(
      JSON.stringify(buildMockMealPlanOutput()),
    );
    (bad.recettes[0] as { difficulte: number }).difficulte = 5;
    expect(() => parseMealPlanLLMOutput(bad)).toThrow(/invalide/i);
  });

  it("rejette un rayon inconnu", () => {
    const bad: ReturnType<typeof buildMockMealPlanOutput> = JSON.parse(
      JSON.stringify(buildMockMealPlanOutput()),
    );
    (bad.recettes[0].ingredients[0] as { rayon: string }).rayon = "rayon-inconnu";
    expect(() => parseMealPlanLLMOutput(bad)).toThrow(/invalide/i);
  });

  it("rejette une référence à une recette inexistante", () => {
    const bad = buildMockMealPlanOutput();
    bad.slots[0].recetteTempIds = ["r-fantome"];
    expect(() => parseMealPlanLLMOutput(bad)).toThrow(/inconnue|incohérent/i);
  });

  it("rejette un batchSourceSlotId inexistant (format valide mais pas de slot correspondant)", () => {
    const bad = buildMockMealPlanOutput();
    // Retire le slot 6-diner puis pointe vers lui depuis un autre slot
    bad.slots = bad.slots.filter((s) => s.slotId !== "6-diner");
    bad.slots[0].batchSourceSlotId = "6-diner";
    expect(() => parseMealPlanLLMOutput(bad)).toThrow(/incohérent/i);
  });

  it("rejette un tempId dupliqué", () => {
    const bad = buildMockMealPlanOutput();
    bad.recettes.push({ ...bad.recettes[0] });
    expect(() => parseMealPlanLLMOutput(bad)).toThrow(/dupliqué|incohérent/i);
  });

  it("rejette un slotId dupliqué", () => {
    const bad = buildMockMealPlanOutput();
    bad.slots.push({ ...bad.slots[0] });
    expect(() => parseMealPlanLLMOutput(bad)).toThrow(/dupliqué|incohérent/i);
  });
});

describe("validateMealPlanReferences", () => {
  it("retourne ok=true sur le mock par défaut", () => {
    const result = validateMealPlanReferences(buildMockMealPlanOutput());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("liste plusieurs erreurs si plusieurs problèmes", () => {
    const bad = buildMockMealPlanOutput();
    bad.slots[0].recetteTempIds = ["r-fantome-1"];
    bad.slots[1].recetteTempIds = ["r-fantome-2"];
    const result = validateMealPlanReferences(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
