import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  creerRafraichisseur,
  messageEcransMisAJour,
  patchToucheHeuresRepas,
} from "./rafraichissementGroupe";

describe("creerRafraichisseur — regroupement par foyer (1,5 s après le dernier appel)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("une rafale de clics donne un seul appel, 1,5 s après le dernier", () => {
    const appeler = vi.fn(() => Promise.resolve());
    const rafraichir = creerRafraichisseur(appeler, 1500);
    rafraichir("h1", "menu");
    vi.advanceTimersByTime(1000);
    rafraichir("h1", "menu");
    vi.advanceTimersByTime(1000);
    rafraichir("h1", "menu");
    vi.advanceTimersByTime(1499);
    expect(appeler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(appeler).toHaveBeenCalledTimes(1);
    expect(appeler).toHaveBeenCalledWith("h1", "menu");
  });

  it("« tout » l'emporte sur « menu » dans une même rafale", () => {
    const appeler = vi.fn(() => Promise.resolve());
    const rafraichir = creerRafraichisseur(appeler, 1500);
    rafraichir("h1", "tout");
    rafraichir("h1", "menu");
    vi.advanceTimersByTime(1500);
    expect(appeler).toHaveBeenCalledTimes(1);
    expect(appeler).toHaveBeenCalledWith("h1", "tout");
  });

  it("deux foyers ont chacun leur minuterie", () => {
    const appeler = vi.fn(() => Promise.resolve());
    const rafraichir = creerRafraichisseur(appeler, 1500);
    rafraichir("h1", "menu");
    vi.advanceTimersByTime(1000);
    rafraichir("h2", "tout");
    vi.advanceTimersByTime(500);
    expect(appeler).toHaveBeenCalledTimes(1);
    expect(appeler).toHaveBeenLastCalledWith("h1", "menu");
    vi.advanceTimersByTime(1000);
    expect(appeler).toHaveBeenCalledTimes(2);
    expect(appeler).toHaveBeenLastCalledWith("h2", "tout");
  });

  it("après un envoi, une nouvelle rafale repart de « menu »", () => {
    const appeler = vi.fn(() => Promise.resolve());
    const rafraichir = creerRafraichisseur(appeler, 1500);
    rafraichir("h1", "tout");
    vi.advanceTimersByTime(1500);
    rafraichir("h1", "menu");
    vi.advanceTimersByTime(1500);
    expect(appeler).toHaveBeenCalledTimes(2);
    expect(appeler).toHaveBeenLastCalledWith("h1", "menu");
  });

  it("un échec n'est qu'un avertissement console", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rafraichir = creerRafraichisseur(() => Promise.reject(new Error("réseau")), 1500);
    rafraichir("h1", "menu");
    vi.advanceTimersByTime(1500);
    await vi.runAllTimersAsync();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("messageEcransMisAJour", () => {
  it("détaille ce qui a été rafraîchi", () => {
    expect(
      messageEcransMisAJour({ weeklyMenuTiles: 1, recipeTodayTiles: 1, weatherTiles: 1, calendarTiles: 0 }),
    ).toBe("Écrans mis à jour : menu, recette du jour, météo.");
  });

  it("aucune tuile", () => {
    expect(
      messageEcransMisAJour({ weeklyMenuTiles: 0, recipeTodayTiles: 0, weatherTiles: 0, calendarTiles: 0 }),
    ).toBe("Écrans mis à jour (aucune tuile à rafraîchir).");
  });

  it("serveur pas encore redéployé (sans météo ni agenda)", () => {
    expect(messageEcransMisAJour({ weeklyMenuTiles: 2, recipeTodayTiles: 0 })).toBe(
      "Écrans mis à jour : menu.",
    );
  });
});

describe("patchToucheHeuresRepas — l'iPad doit recalculer le prochain repas", () => {
  it("chemin pointé parametres.heuresRepas (ou une de ses heures)", () => {
    expect(patchToucheHeuresRepas({ "parametres.heuresRepas": { diner: "19:30" } })).toBe(true);
    expect(patchToucheHeuresRepas({ "parametres.heuresRepas.diner": "19:30" })).toBe(true);
  });
  it("objet parametres contenant heuresRepas", () => {
    expect(patchToucheHeuresRepas({ parametres: { heuresRepas: { dejeuner: "12:00" } } })).toBe(true);
  });
  it("autres réglages : non", () => {
    expect(patchToucheHeuresRepas({ "parametres.placard": ["sel"] })).toBe(false);
    expect(patchToucheHeuresRepas({ parametres: { placard: [] } })).toBe(false);
    expect(patchToucheHeuresRepas({ nom: "Maison" })).toBe(false);
    expect(patchToucheHeuresRepas({ "parametres.heuresRepasX": 1 })).toBe(false);
    expect(patchToucheHeuresRepas(undefined)).toBe(false);
  });
});
