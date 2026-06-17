import { describe, it, expect } from "vitest";
import { clampPortions, PORTIONS_MIN, PORTIONS_MAX } from "./recipeConstants";

describe("recipeConstants", () => {
  it("expose des bornes cohérentes", () => {
    expect(PORTIONS_MIN).toBe(1);
    expect(PORTIONS_MAX).toBe(30);
    expect(PORTIONS_MIN).toBeLessThan(PORTIONS_MAX);
  });

  describe("clampPortions", () => {
    it("laisse une valeur dans l'intervalle inchangée", () => {
      expect(clampPortions(4)).toBe(4);
      expect(clampPortions(PORTIONS_MIN)).toBe(PORTIONS_MIN);
      expect(clampPortions(PORTIONS_MAX)).toBe(PORTIONS_MAX);
    });

    it("clampe en dessous du minimum", () => {
      expect(clampPortions(0)).toBe(PORTIONS_MIN);
      expect(clampPortions(-10)).toBe(PORTIONS_MIN);
    });

    it("clampe au dessus du maximum", () => {
      expect(clampPortions(31)).toBe(PORTIONS_MAX);
      expect(clampPortions(1000)).toBe(PORTIONS_MAX);
    });
  });
});
