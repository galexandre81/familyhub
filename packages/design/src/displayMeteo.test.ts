/**
 * Plein écran météo de l'iPad (apps/display/public/js/tiles/weather.js, ES5) :
 * le fichier livré est exécuté tel quel dans un contexte vm, comme dans
 * Safari (window). Seules les fonctions pures sont appelées ici.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  fileURLToPath(new URL("../../../apps/display/public/js/tiles/weather.js", import.meta.url)),
  "utf8",
);

interface ApiMeteo {
  libelleJour(isoDate: string, idx: number): { nom: string; date: string };
  prochainesHeures(ld: unknown): Array<{ quand: string; temp: string; iconKey?: string }>;
  degres(v: unknown): string;
  expand: unknown;
}

function charger(): ApiMeteo {
  const window: { Tiles?: Record<string, unknown> } = {};
  runInNewContext(SOURCE, { window });
  return window.Tiles!.weather as ApiMeteo;
}

const m = charger();
const simple = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("weather.js — chargement", () => {
  it("expose expand et les fonctions pures sur window.Tiles.weather", () => {
    expect(typeof m.expand).toBe("function");
    expect(typeof m.libelleJour).toBe("function");
  });
});

describe("degres", () => {
  it("arrondit et ajoute le signe degré", () => {
    expect(m.degres(12.4)).toBe("12°");
    expect(m.degres(12.5)).toBe("13°");
    expect(m.degres(-3.6)).toBe("-4°");
  });
  it("jamais « -0° »", () => {
    expect(m.degres(-0.2)).toBe("0°");
  });
  it("vide si ce n'est pas un nombre", () => {
    expect(m.degres(undefined)).toBe("");
    expect(m.degres(Number.NaN)).toBe("");
    expect(m.degres("12")).toBe("");
  });
});

describe("libelleJour", () => {
  it("aujourd'hui et demain par leur nom relatif, avec la date courte", () => {
    // 2026-10-25 = dimanche.
    expect(simple(m.libelleJour("2026-10-25", 0))).toEqual({ nom: "Aujourd'hui", date: "25 oct." });
    expect(simple(m.libelleJour("2026-10-26", 1))).toEqual({ nom: "Demain", date: "26 oct." });
  });
  it("au-delà : le nom du jour (date lue en heure locale, sans décalage UTC)", () => {
    expect(simple(m.libelleJour("2026-10-28", 3))).toEqual({ nom: "Mercredi", date: "28 oct." });
    expect(simple(m.libelleJour("2027-01-01", 4))).toEqual({ nom: "Vendredi", date: "1 janv." });
  });
  it("date illisible : pas d'exception, libellés vides au-delà de demain", () => {
    expect(simple(m.libelleJour("", 3))).toEqual({ nom: "", date: "" });
    expect(simple(m.libelleJour("n'importe quoi", 0))).toEqual({ nom: "Aujourd'hui", date: "" });
  });
});

describe("prochainesHeures", () => {
  it("garde les heures à venir (offset > 0), 3 au plus", () => {
    const ld = {
      forecast: [
        { hourOffset: 0, tempC: 12.4, iconKey: "rain" },
        { hourOffset: 6, tempC: 9.1, iconKey: "cloud-moon" },
        { hourOffset: 12, tempC: -0.3, iconKey: "cloud" },
        { hourOffset: 18, tempC: 5, iconKey: "sun" },
        { hourOffset: 24, tempC: 6, iconKey: "sun" },
      ],
    };
    expect(simple(m.prochainesHeures(ld))).toEqual([
      { quand: "Dans 6 h", temp: "9°", iconKey: "cloud-moon" },
      { quand: "Dans 12 h", temp: "0°", iconKey: "cloud" },
      { quand: "Dans 18 h", temp: "5°", iconKey: "sun" },
    ]);
  });
  it("snapshot sans prévision ou partiel : liste vide, pas d'exception", () => {
    expect(simple(m.prochainesHeures(null))).toEqual([]);
    expect(simple(m.prochainesHeures({}))).toEqual([]);
    expect(simple(m.prochainesHeures({ forecast: [null, { hourOffset: 6 }] }))).toEqual([]);
  });
});
