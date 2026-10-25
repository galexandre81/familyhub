/**
 * Ambiance de l'iPad (apps/display/public/js/ambiance.js, ES5) :
 * lecture du lever/coucher dans les données de la tuile météo, et parité
 * avec ambianceAt du design system. Le fichier est exécuté tel quel dans un
 * contexte vm, une fois comme dans Safari (window) et une fois en CommonJS.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { ambianceAt } from "./ambiance";

interface ApiAmbiance {
  ambianceFromSun(now: Date, sunrise?: unknown, sunset?: unknown): "jour" | "nuit";
  sunFromWeatherData(
    data: unknown,
    selectedLocationId?: string | null,
  ): { sunrise: string; sunset: string } | null;
}

const SOURCE = readFileSync(
  fileURLToPath(new URL("../../../apps/display/public/js/ambiance.js", import.meta.url)),
  "utf8",
);

function chargerCommeSafari(): ApiAmbiance {
  const window: { FamilyHubAmbiance?: ApiAmbiance } = {};
  runInNewContext(SOURCE, { window });
  if (!window.FamilyHubAmbiance) throw new Error("window.FamilyHubAmbiance absent");
  return window.FamilyHubAmbiance;
}

function chargerCommeCommonJS(): ApiAmbiance {
  const module: { exports: Partial<ApiAmbiance> } = { exports: {} };
  runInNewContext(SOURCE, { module });
  return module.exports as ApiAmbiance;
}

const amb = chargerCommeSafari();
const at = (hhmm: string) => new Date(`2026-10-27T${hhmm}:00`);

describe("ambiance.js (iPad) — chargement", () => {
  it("expose window.FamilyHubAmbiance et module.exports", () => {
    expect(typeof amb.sunFromWeatherData).toBe("function");
    expect(typeof chargerCommeCommonJS().ambianceFromSun).toBe("function");
  });
});

describe("sunFromWeatherData", () => {
  const data = {
    byLocation: {
      paris: { daily: { sunrise: "07:58", sunset: "17:52" } },
      nice: { daily: { sunrise: "07:30", sunset: "18:10" } },
    },
  };

  it("prend la localisation choisie dans la config de la tuile", () => {
    expect(amb.sunFromWeatherData(data, "nice")).toEqual({ sunrise: "07:30", sunset: "18:10" });
  });

  it("sinon la première entrée de byLocation", () => {
    expect(amb.sunFromWeatherData(data, null)).toEqual({ sunrise: "07:58", sunset: "17:52" });
    expect(amb.sunFromWeatherData(data, "inconnue")).toEqual({ sunrise: "07:58", sunset: "17:52" });
  });

  it("saute une localisation choisie sans daily (fetch en échec)", () => {
    const partiel = { byLocation: { a: {}, b: { daily: { sunrise: "08:00", sunset: "17:00" } } } };
    expect(amb.sunFromWeatherData(partiel, "a")).toEqual({ sunrise: "08:00", sunset: "17:00" });
  });

  it("accepte l'ancienne forme { daily }", () => {
    expect(amb.sunFromWeatherData({ daily: { sunrise: "06:00", sunset: "20:00" } }, null)).toEqual({
      sunrise: "06:00",
      sunset: "20:00",
    });
  });

  it("renvoie null sans données exploitables", () => {
    expect(amb.sunFromWeatherData(null, null)).toBeNull();
    expect(amb.sunFromWeatherData({}, "x")).toBeNull();
    expect(amb.sunFromWeatherData({ byLocation: {} }, null)).toBeNull();
  });

  it("de bout en bout : nuit à 18:00 à Paris, jour à 18:00 à Nice", () => {
    const paris = amb.sunFromWeatherData(data, "paris");
    const nice = amb.sunFromWeatherData(data, "nice");
    expect(amb.ambianceFromSun(at("18:00"), paris?.sunrise, paris?.sunset)).toBe("nuit");
    expect(amb.ambianceFromSun(at("18:00"), nice?.sunrise, nice?.sunset)).toBe("jour");
  });
});

describe("ambianceFromSun — parité avec ambianceAt", () => {
  const cas: Array<[string, { sunrise: string; sunset: string } | null]> = [];
  const soleils = [
    { sunrise: "07:58", sunset: "17:52" },
    { sunrise: "", sunset: "" },
    { sunrise: "19:00", sunset: "07:00" },
    { sunrise: "25:00", sunset: "17:00" },
    null,
  ];
  for (const s of soleils) {
    for (const h of ["00:00", "06:59", "07:00", "07:57", "07:58", "12:00", "17:51", "17:52", "18:59", "19:00", "23:59"]) {
      cas.push([h, s]);
    }
  }
  it.each(cas)("%s avec %j", (h, s) => {
    expect(amb.ambianceFromSun(at(h), s?.sunrise, s?.sunset)).toBe(ambianceAt(at(h), s));
  });
});
