import { describe, expect, it } from "vitest";
import { VALEUR } from "./schema.js";
import {
  DEFAUTS,
  PLANNING_DEFAUT,
  enMinutes,
  etatEffectif,
  exceptionActive,
  jourLocal,
  prochainChangementPc,
  verrouilleParPlanning,
} from "./regles.js";
import type { Exception } from "./types.js";

// Semaine du lundi 26.10.2026 (heure locale). Dimanche 25, vendredi 30, samedi 31.
const le = (jour: number, h: number, m = 0) => new Date(2026, 9, jour, h, m);
const config = (exception: Exception | null = null) => ({
  planning: PLANNING_DEFAUT,
  defauts: DEFAUTS,
  exception,
});
const { autorise, verrouille } = VALEUR.pc;

describe("planning par défaut", () => {
  it.each([
    ["lundi 21:29", le(26, 21, 29), false],
    ["lundi 21:30", le(26, 21, 30), true],
    ["mardi 06:59 (soir de lundi)", le(27, 6, 59), true],
    ["mardi 07:00", le(27, 7, 0), false],
    ["dimanche 21:30 (soir de semaine)", le(25, 21, 30), true],
    ["jeudi 21:30", le(29, 21, 30), true],
    ["vendredi 21:30 (week-end : pas encore)", le(30, 21, 30), false],
    ["vendredi 22:29", le(30, 22, 29), false],
    ["vendredi 22:30", le(30, 22, 30), true],
    ["samedi 06:30 (soir de vendredi)", le(31, 6, 30), true],
    ["samedi 22:30", le(31, 22, 30), true],
    ["dimanche 07:00", le(25 + 7, 7, 0), false],
    ["dimanche 06:59 (soir de samedi)", le(25 + 7, 6, 59), true],
    ["mercredi 15:00", le(28, 15, 0), false],
  ])("%s → verrouillé : %s", (_n, quand, attendu) => {
    expect(verrouilleParPlanning(PLANNING_DEFAUT, quand)).toBe(attendu);
  });

  it("un soir sans créneau ne verrouille pas, même après minuit", () => {
    const sansMardi = { ...PLANNING_DEFAUT, tue: null };
    expect(verrouilleParPlanning(sansMardi, le(27, 23, 0))).toBe(false);
    expect(verrouilleParPlanning(sansMardi, le(28, 2, 0))).toBe(false);
  });

  it("un créneau dans la journée (sans passer minuit)", () => {
    const midi = { ...PLANNING_DEFAUT, wed: { debut: "12:00", fin: "13:30" } };
    expect(verrouilleParPlanning(midi, le(28, 11, 59))).toBe(false);
    expect(verrouilleParPlanning(midi, le(28, 12, 0))).toBe(true);
    expect(verrouilleParPlanning(midi, le(28, 13, 30))).toBe(false);
    // et rien ne déborde sur le lendemain matin
    expect(verrouilleParPlanning(midi, le(29, 6, 0))).toBe(false);
  });
});

describe("priorité exception > planning > défauts", () => {
  it("sans rien : valeurs par défaut", () => {
    expect(etatEffectif(config(), le(28, 15, 0))).toEqual({
      pc: autorise,
      raisonPc: VALEUR.raison.defaut,
      internet: VALEUR.internet.complet,
      raisonInternet: VALEUR.raison.defaut,
    });
  });

  it("le planning verrouille le soir", () => {
    const e = etatEffectif(config(), le(26, 22, 0));
    expect(e.pc).toBe(verrouille);
    expect(e.raisonPc).toBe(VALEUR.raison.planning);
  });

  it("« débloquer jusqu'à 23h » l'emporte sur le planning, puis expire seule", () => {
    const ex = { pc: autorise, jusqua: le(26, 23, 0), par: "p" };
    expect(etatEffectif(config(ex), le(26, 22, 0)).pc).toBe(autorise);
    expect(etatEffectif(config(ex), le(26, 22, 0)).raisonPc).toBe(VALEUR.raison.exception);
    expect(etatEffectif(config(ex), le(26, 23, 0)).pc).toBe(verrouille);
  });

  it("« verrouiller maintenant » l'après-midi", () => {
    const ex = { pc: verrouille, jusqua: le(28, 18, 0), par: "p" };
    expect(etatEffectif(config(ex), le(28, 15, 0)).pc).toBe(verrouille);
    expect(etatEffectif(config(ex), le(28, 18, 0)).pc).toBe(autorise);
  });

  it("le mode école ne touche pas à l'accès au PC (dimensions indépendantes)", () => {
    const ex = { internet: VALEUR.internet.ecole, jusqua: le(26, 23, 0), par: "p" };
    const e = etatEffectif(config(ex), le(26, 22, 0));
    expect(e.internet).toBe(VALEUR.internet.ecole);
    expect(e.raisonInternet).toBe(VALEUR.raison.exception);
    expect(e.pc).toBe(verrouille);
    expect(e.raisonPc).toBe(VALEUR.raison.planning);
  });

  it("une exception échue ne compte plus, à la milliseconde", () => {
    const ex = { pc: verrouille, jusqua: le(28, 18, 0), par: "p" };
    expect(exceptionActive(ex, new Date(le(28, 18, 0).getTime() - 1))).toBe(true);
    expect(exceptionActive(ex, le(28, 18, 0))).toBe(false);
    expect(exceptionActive(null, le(28, 18, 0))).toBe(false);
  });
});

describe("prochain changement (« verrouillage à 21h30 »)", () => {
  it("lundi après-midi : verrouillage à 21h30", () => {
    expect(prochainChangementPc(config(), le(26, 15, 0))).toEqual({ quand: le(26, 21, 30), pc: verrouille });
  });

  it("vendredi après-midi : verrouillage à 22h30", () => {
    expect(prochainChangementPc(config(), le(30, 15, 0))).toEqual({ quand: le(30, 22, 30), pc: verrouille });
  });

  it("la nuit : débloqué à 7h le lendemain", () => {
    expect(prochainChangementPc(config(), le(26, 23, 0))).toEqual({ quand: le(27, 7, 0), pc: autorise });
  });

  it("débloqué jusqu'à 23h : le verrou revient à 23h", () => {
    const ex = { pc: autorise, jusqua: le(26, 23, 0), par: "p" };
    expect(prochainChangementPc(config(ex), le(26, 22, 0))).toEqual({ quand: le(26, 23, 0), pc: verrouille });
  });

  it("une exception qui finit pendant le verrou du planning n'est pas un changement", () => {
    const ex = { pc: verrouille, jusqua: le(26, 22, 0), par: "p" };
    expect(prochainChangementPc(config(ex), le(26, 20, 0))).toEqual({ quand: le(27, 7, 0), pc: autorise });
  });

  it("planning vide et pas d'exception : rien ne change", () => {
    const vide = { sun: null, mon: null, tue: null, wed: null, thu: null, fri: null, sat: null };
    expect(prochainChangementPc({ planning: vide, defauts: DEFAUTS, exception: null }, le(26, 15, 0))).toBeNull();
  });
});

describe("outils", () => {
  it("heures", () => {
    expect(enMinutes("07:00")).toBe(420);
    expect(enMinutes("21:30")).toBe(1290);
    expect(() => enMinutes("24:00")).toThrow();
    expect(() => enMinutes("7:00")).toThrow();
  });

  it("jour local du document d'usage", () => {
    expect(jourLocal(le(26, 0, 5))).toBe("2026-10-26");
    expect(jourLocal(le(26, 23, 59))).toBe("2026-10-26");
  });
});
