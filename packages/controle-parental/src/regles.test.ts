import { describe, expect, it } from "vitest";
import { JUSQUA_NOUVEL_ORDRE_MS, VALEUR } from "./schema.js";
import {
  CATEGORIES_PAR_MODE,
  DEFAUTS,
  PLANNING_DEFAUT,
  enMinutes,
  etatEffectif,
  exceptionActive,
  exceptionApresAccordTemps,
  jourLocal,
  prochainChangement,
  prochainChangementPc,
  reseauDe,
  sansFin,
  valeurPlanning,
} from "./regles.js";
import type { Exception, Planning } from "./types.js";

// Semaine du lundi 26.10.2026 (heure locale). Dimanche 25, vendredi 30, samedi 31.
const le = (jour: number, h: number, m = 0) => new Date(2026, 9, jour, h, m);
const ex = (e: Partial<Exception> & { jusqua: Date }): Exception => ({ par: "Papa", poseLe: null, ...e });
const config = (exception: Exception | null = null, planning: Planning = PLANNING_DEFAUT) => ({
  planning,
  defauts: DEFAUTS,
  exception,
});
const { autorise, verrouille } = VALEUR.pc;
const M = VALEUR.mode;

describe("planning par défaut (contrat § 2.2)", () => {
  it.each([
    ["lundi 21:29", le(26, 21, 29), undefined],
    ["lundi 21:30", le(26, 21, 30), verrouille],
    ["mardi 06:59 (soir de lundi)", le(27, 6, 59), verrouille],
    ["mardi 07:00", le(27, 7, 0), undefined],
    ["dimanche 21:30 (soir de semaine)", le(25, 21, 30), verrouille],
    ["vendredi 21:30 (week-end : pas encore)", le(30, 21, 30), undefined],
    ["vendredi 22:30", le(30, 22, 30), verrouille],
    ["samedi 06:30 (soir de vendredi)", le(31, 6, 30), verrouille],
    ["dimanche 06:59 (soir de samedi)", le(25 + 7, 6, 59), verrouille],
    ["mercredi 15:00", le(28, 15, 0), undefined],
  ])("%s → %s", (_n, quand, attendu) => {
    expect(valeurPlanning(PLANNING_DEFAUT, "pc", quand)).toBe(attendu);
  });

  it("un jour sans plage ne verrouille pas, même après minuit", () => {
    const p = { ...PLANNING_DEFAUT, tue: [] };
    expect(valeurPlanning(p, "pc", le(27, 23, 0))).toBeUndefined();
    expect(valeurPlanning(p, "pc", le(28, 2, 0))).toBeUndefined();
  });

  it("une plage de mode dans la journée", () => {
    const p = { ...PLANNING_DEFAUT, wed: [{ debut: "16:30", fin: "18:00", mode: M.libre }, ...PLANNING_DEFAUT.wed] };
    expect(valeurPlanning(p, "mode", le(28, 16, 29))).toBeUndefined();
    expect(valeurPlanning(p, "mode", le(28, 16, 30))).toBe(M.libre);
    expect(valeurPlanning(p, "mode", le(28, 18, 0))).toBeUndefined();
    expect(valeurPlanning(p, "pc", le(28, 17, 0))).toBeUndefined();
  });

  it("deux plages qui se chevauchent : la plus restrictive gagne", () => {
    const p = {
      ...PLANNING_DEFAUT,
      wed: [
        { debut: "14:00", fin: "18:00", mode: M.libreInternet, internet: VALEUR.internet.complet },
        { debut: "16:00", fin: "17:00", mode: M.devoirs, internet: VALEUR.internet.coupe },
      ],
    };
    expect(valeurPlanning(p, "mode", le(28, 16, 30))).toBe(M.devoirs);
    expect(valeurPlanning(p, "internet", le(28, 16, 30))).toBe(VALEUR.internet.coupe);
    expect(valeurPlanning(p, "mode", le(28, 15, 0))).toBe(M.libreInternet);
  });

  it("à égalité de restriction (devoirs + internet / libre), la première plage listée gagne", () => {
    const p = {
      ...PLANNING_DEFAUT,
      wed: [
        { debut: "14:00", fin: "18:00", mode: M.devoirsInternet },
        { debut: "14:00", fin: "18:00", mode: M.libre },
      ],
    };
    expect(valeurPlanning(p, "mode", le(28, 15, 0))).toBe(M.devoirsInternet);
  });
});

describe("priorité exception > planning > défauts, dimension par dimension", () => {
  it("sans rien : PC autorisé, internet filtré, mode Devoirs — donc liste école", () => {
    expect(etatEffectif(config(), le(28, 15, 0))).toEqual({
      pc: autorise,
      sourcePc: VALEUR.source.defaut,
      internet: VALEUR.internet.complet,
      sourceInternet: VALEUR.source.defaut,
      mode: M.devoirs,
      sourceMode: VALEUR.source.defaut,
      reseau: VALEUR.reseau.ecole,
    });
  });

  it("« Temps libre + Internet jusqu'à 18h » : tout internet ; à 18h, retour seul en Devoirs", () => {
    const e = ex({ mode: M.libreInternet, jusqua: le(28, 18, 0) });
    expect(etatEffectif(config(e), le(28, 16, 0))).toMatchObject({ mode: M.libreInternet, reseau: VALEUR.reseau.complet });
    expect(etatEffectif(config(e), le(28, 18, 0))).toMatchObject({ mode: M.devoirs, reseau: VALEUR.reseau.ecole });
  });

  it("un mode accordé ne lève pas le verrouillage du soir", () => {
    const e = ex({ mode: M.libre, jusqua: le(26, 23, 0) });
    const s = etatEffectif(config(e), le(26, 22, 0));
    expect(s.pc).toBe(verrouille);
    expect(s.sourcePc).toBe(VALEUR.source.planning);
    expect(s.mode).toBe(M.libre);
  });

  it("« débloquer jusqu'à 23h » l'emporte sur le planning puis expire seule, sans changer le mode", () => {
    const e = ex({ pc: autorise, jusqua: le(26, 23, 0) });
    expect(etatEffectif(config(e), le(26, 22, 0))).toMatchObject({ pc: autorise, sourcePc: VALEUR.source.exception, mode: M.devoirs });
    expect(etatEffectif(config(e), le(26, 23, 0)).pc).toBe(verrouille);
  });

  it("« couper internet » passe avant tout mode", () => {
    const e = ex({ internet: VALEUR.internet.coupe, jusqua: le(28, 18, 0) });
    expect(etatEffectif(config(e), le(28, 15, 0)).reseau).toBe(VALEUR.reseau.coupe);
  });

  it("une exception échue ne compte plus, à la milliseconde", () => {
    const e = ex({ pc: verrouille, jusqua: le(28, 18, 0) });
    expect(exceptionActive(e, new Date(le(28, 18, 0).getTime() - 1))).toBe(true);
    expect(exceptionActive(e, le(28, 18, 0))).toBe(false);
    expect(exceptionActive(null, le(28, 18, 0))).toBe(false);
  });
});

describe("filtrage réel (réponse 1 du 27.10)", () => {
  it.each([
    [VALEUR.internet.complet, M.devoirs, VALEUR.reseau.ecole],
    [VALEUR.internet.complet, M.devoirsInternet, VALEUR.reseau.complet],
    [VALEUR.internet.complet, M.libre, VALEUR.reseau.ecole],
    [VALEUR.internet.complet, M.libreInternet, VALEUR.reseau.complet],
    [VALEUR.internet.ecole, M.libreInternet, VALEUR.reseau.ecole],
    [VALEUR.internet.coupe, M.libreInternet, VALEUR.reseau.coupe],
  ])("internet %s + mode %s → %s", (internet, mode, reseau) => {
    expect(reseauDe(internet, mode)).toBe(reseau);
  });

  it("applis permises : Devoirs = école ; Temps libre = tout", () => {
    expect(CATEGORIES_PAR_MODE[M.devoirs]).toEqual([VALEUR.categorie.ecole]);
    expect(CATEGORIES_PAR_MODE[M.libre]).toContain(VALEUR.categorie.jeu);
  });
});

describe("prochain changement", () => {
  it("lundi après-midi : verrouillage à 21h30 ; vendredi : 22h30", () => {
    expect(prochainChangementPc(config(), le(26, 15, 0))).toEqual({ quand: le(26, 21, 30), pc: verrouille });
    expect(prochainChangementPc(config(), le(30, 15, 0))).toEqual({ quand: le(30, 22, 30), pc: verrouille });
  });

  it("la nuit : débloqué à 7h le lendemain", () => {
    expect(prochainChangementPc(config(), le(26, 23, 0))).toEqual({ quand: le(27, 7, 0), pc: autorise });
  });

  it("temps libre jusqu'à 18h : retour en Devoirs à 18h", () => {
    const e = ex({ mode: M.libre, jusqua: le(28, 18, 0) });
    expect(prochainChangement(config(e), "mode", le(28, 16, 0))).toEqual({ quand: le(28, 18, 0), valeur: M.devoirs });
  });

  it("verrouillé jusqu'à nouvel ordre : rien ne change dans la semaine", () => {
    const e = ex({ pc: verrouille, jusqua: new Date(JUSQUA_NOUVEL_ORDRE_MS) });
    expect(prochainChangementPc(config(e), le(26, 15, 0))).toBeNull();
    expect(sansFin(e.jusqua)).toBe(true);
  });
});

describe("accorder « plus de temps »", () => {
  it("ne raccourcit jamais un déblocage plus long", () => {
    const e = ex({ pc: autorise, jusqua: le(26, 13, 55) });
    expect(exceptionApresAccordTemps(e, le(26, 13, 25), "Maman", le(26, 12, 55)).jusqua).toEqual(le(26, 13, 55));
  });

  it("garde le mode accordé en cours (le temps libre n'est pas perdu)", () => {
    const e = ex({ mode: M.libre, jusqua: le(26, 18, 0) });
    const r = exceptionApresAccordTemps(e, le(26, 22, 30), "Maman", le(26, 17, 0));
    expect(r).toMatchObject({ pc: autorise, mode: M.libre, jusqua: le(26, 22, 30), par: "Maman" });
  });

  it("remplace un « verrouiller maintenant »", () => {
    const e = ex({ pc: verrouille, jusqua: le(26, 23, 0) });
    expect(exceptionApresAccordTemps(e, le(26, 16, 30), "Papa", le(26, 16, 0)).pc).toBe(autorise);
  });
});

describe("outils", () => {
  it("heures", () => {
    expect(enMinutes("07:00")).toBe(420);
    expect(() => enMinutes("24:00")).toThrow();
  });
  it("jour local du document d'usage", () => {
    expect(jourLocal(le(26, 0, 5))).toBe("2026-10-26");
  });
});
