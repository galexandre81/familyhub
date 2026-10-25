import { describe, expect, it } from "vitest";
import { ambianceAt } from "./ambiance";
const at = (hhmm: string) => new Date(`2026-10-27T${hhmm}:00`);
describe("ambianceAt", () => {
  const sun = { sunrise: "07:58", sunset: "17:52" };
  it("jour entre lever et coucher", () => expect(ambianceAt(at("12:00"), sun)).toBe("jour"));
  it("nuit à l'instant du coucher", () => expect(ambianceAt(at("17:52"), sun)).toBe("nuit"));
  it("jour à l'instant du lever", () => expect(ambianceAt(at("07:58"), sun)).toBe("jour"));
  it("nuit juste avant le lever", () => expect(ambianceAt(at("07:57"), sun)).toBe("nuit"));
  it("repli 07:00–19:00 sans soleil", () => {
    expect(ambianceAt(at("06:59"), null)).toBe("nuit");
    expect(ambianceAt(at("07:00"), null)).toBe("jour");
    expect(ambianceAt(at("19:00"), null)).toBe("nuit");
  });
  it("repli si heures illisibles", () => expect(ambianceAt(at("20:00"), { sunrise: "", sunset: "" })).toBe("nuit"));
});
