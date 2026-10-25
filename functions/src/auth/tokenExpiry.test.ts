import { describe, it, expect } from "vitest";
import { prochaineExpiration } from "./tokenExpiry";

describe("prochaineExpiration", () => {
  it("ajoute 90 jours à l'instant donné", () => {
    expect(prochaineExpiration(0)).toBe(7776000000);
  });

  it("glisse à partir de maintenant", () => {
    const now = Date.UTC(2026, 9, 26, 12, 0, 0);
    expect(prochaineExpiration(now)).toBe(now + 90 * 24 * 3600 * 1000);
  });
});
