/**
 * Plein écran réglages de l'iPad (apps/display/public/js/tiles/settings.js,
 * ES5) : le fichier livré est exécuté tel quel dans un contexte vm, comme
 * dans Safari (window). Seule la fonction pure est appelée ici.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  fileURLToPath(new URL("../../../apps/display/public/js/tiles/settings.js", import.meta.url)),
  "utf8",
);

interface ApiReglages {
  indexNiveau(valeur: unknown, niveaux?: Array<{ value: number; label: string }>): number;
  expand: unknown;
}

function charger(): ApiReglages {
  const window: { Tiles?: Record<string, unknown> } = {};
  runInNewContext(SOURCE, { window });
  return window.Tiles!.settings as ApiReglages;
}

const t = charger();

describe("settings.js — indexNiveau (bouton de luminosité allumé)", () => {
  it("expose expand et indexNiveau sur window.Tiles.settings", () => {
    expect(typeof t.expand).toBe("function");
    expect(typeof t.indexNiveau).toBe("function");
  });
  it("niveaux par défaut : 0 = Max … 0,6 = Très basse", () => {
    expect(t.indexNiveau(0)).toBe(0);
    expect(t.indexNiveau(0.15)).toBe(1);
    expect(t.indexNiveau(0.3)).toBe(2);
    expect(t.indexNiveau(0.45)).toBe(3);
    expect(t.indexNiveau(0.6)).toBe(4);
  });
  it("tolère les arrondis (à 0,05 près)", () => {
    expect(t.indexNiveau(0.3000001)).toBe(2);
    expect(t.indexNiveau(0.17)).toBe(1);
  });
  it("valeur hors niveaux ou illisible : aucun bouton allumé", () => {
    expect(t.indexNiveau(0.225)).toBe(-1);
    expect(t.indexNiveau(undefined)).toBe(-1);
    expect(t.indexNiveau(Number.NaN)).toBe(-1);
  });
  it("niveaux fournis par l'appelant", () => {
    expect(t.indexNiveau(0.5, [{ value: 0, label: "a" }, { value: 0.5, label: "b" }])).toBe(1);
  });
});
