import { describe, it, expect } from "vitest";
import { dateISOFromTimestamp } from "./weeklyMenu";

describe("dateISOFromTimestamp — jour civil à Paris", () => {
  it("minuit local Paris (écrit par l'importeur du hub) reste le bon jour", () => {
    // 28.09.2026 00:00+02:00 = 27.09 22:00Z : l'UTC donnait le 27.
    expect(dateISOFromTimestamp(new Date("2026-09-27T22:00:00Z"))).toBe("2026-09-28");
  });

  it("minuit UTC (écrit par createMealPlan) tombe le même jour à Paris", () => {
    expect(dateISOFromTimestamp(new Date("2026-09-28T00:00:00Z"))).toBe("2026-09-28");
  });

  it("fin de journée locale (dateFin de l'importeur) reste le même jour", () => {
    // 04.10.2026 23:59:59.999+02:00
    expect(dateISOFromTimestamp(new Date("2026-10-04T21:59:59.999Z"))).toBe("2026-10-04");
  });

  it("gère l'heure d'hiver", () => {
    // 01.01.2027 00:00+01:00
    expect(dateISOFromTimestamp(new Date("2026-12-31T23:00:00Z"))).toBe("2027-01-01");
  });

  it("accepte un Timestamp Firestore (toDate) ou sa forme brute (seconds)", () => {
    const d = new Date("2026-09-27T22:00:00Z");
    expect(dateISOFromTimestamp({ toDate: () => d })).toBe("2026-09-28");
    expect(dateISOFromTimestamp({ seconds: d.getTime() / 1000 })).toBe("2026-09-28");
  });

  it("prend une chaîne telle quelle", () => {
    expect(dateISOFromTimestamp("2026-09-28")).toBe("2026-09-28");
    expect(dateISOFromTimestamp("2026-09-28T00:00:00+02:00")).toBe("2026-09-28");
  });

  it("rend null pour une valeur absente ou invalide", () => {
    expect(dateISOFromTimestamp(null)).toBeNull();
    expect(dateISOFromTimestamp(undefined)).toBeNull();
    expect(dateISOFromTimestamp(new Date("pas une date"))).toBeNull();
    expect(dateISOFromTimestamp({ autre: 1 })).toBeNull();
  });
});
