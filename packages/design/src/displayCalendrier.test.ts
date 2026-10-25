/**
 * Vue semaine de l'agenda de l'iPad (apps/display/public/js/tiles/calendar.js,
 * ES5) : le fichier livré est exécuté tel quel dans un contexte vm, comme
 * dans Safari (window).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  fileURLToPath(new URL("../../../apps/display/public/js/tiles/calendar.js", import.meta.url)),
  "utf8",
);

function charger(): { libelleJourSemaine(date: Date, now: Date): string } {
  const window: { Tiles?: Record<string, unknown> } = {};
  runInNewContext(SOURCE, { window, Date, Math, String });
  return window.Tiles!.calendar as { libelleJourSemaine(date: Date, now: Date): string };
}

describe("libelleJourSemaine (vue semaine de l'agenda)", () => {
  const cal = charger();
  // Dimanche 25 octobre 2026, 16:39.
  const now = new Date(2026, 9, 25, 16, 39);

  it("les jours passés de la semaine portent leur nom, pas « Aujourd'hui »", () => {
    expect(cal.libelleJourSemaine(new Date(2026, 9, 19), now)).toBe("lundi");
    expect(cal.libelleJourSemaine(new Date(2026, 9, 24), now)).toBe("samedi");
  });

  it("aujourd'hui et demain gardent leur libellé relatif", () => {
    expect(cal.libelleJourSemaine(new Date(2026, 9, 25), now)).toBe("Aujourd'hui");
    expect(cal.libelleJourSemaine(new Date(2026, 9, 26), now)).toBe("Demain");
  });

  it("au-delà de demain : le nom du jour", () => {
    expect(cal.libelleJourSemaine(new Date(2026, 9, 28), now)).toBe("mercredi");
  });
});
