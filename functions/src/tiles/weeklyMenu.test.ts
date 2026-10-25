import { describe, it, expect } from "vitest";
import {
  construireSlotSnapshot,
  dateISOFromTimestamp,
  heuresRepasDuFoyer,
  porteeRafraichissement,
  profilsDuFoyer,
} from "./weeklyMenu";

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

describe("construireSlotSnapshot — données du tableau iPad", () => {
  const nomById = new Map([["r1", "Gratin"]]);
  const base = { jour: 2, repas: "diner" as const, date: "2026-10-28", todayISO: "2026-10-28", nomById };

  it("embarque les ids des présents et le drapeau annulé", () => {
    const s = construireSlotSnapshot(
      { recetteIds: ["r1", "rX"], profilsPresents: ["p1", "p2"], invitesNoms: ["Mamie"], annule: true },
      base,
    );
    expect(s.profilsPresents).toEqual(["p1", "p2"]);
    expect(s.annule).toBe(true);
    // champs historiques conservés (anciens iPads)
    expect(s.profilsCount).toBe(2);
    expect(s.invitesCount).toBe(1);
    expect(s.recetteNoms).toEqual(["Gratin"]);
    expect(s.isToday).toBe(true);
    expect(s.isPast).toBe(false);
  });

  it("créneau absent : aucun présent, non annulé", () => {
    const s = construireSlotSnapshot(undefined, base);
    expect(s.profilsPresents).toEqual([]);
    expect(s.annule).toBe(false);
    expect(s.recetteIds).toEqual([]);
  });

  it("annule absent ou non booléen vaut false ; présents mal formés filtrés", () => {
    const s = construireSlotSnapshot(
      { profilsPresents: ["p1", 3, null], annule: "oui" } as never,
      base,
    );
    expect(s.annule).toBe(false);
    expect(s.profilsPresents).toEqual(["p1"]);
  });
});

describe("profilsDuFoyer", () => {
  it("indexe les profils par id avec initiale, nom et couleurs", () => {
    const r = profilsDuFoyer([
      { id: "p1", data: { nom: "Marie", initiale: "M", couleurPersonne: "sapin", couleur: "#123456", regimes: [] } },
      { id: "p2", data: { nom: "léo", couleur: "#abcdef" } },
    ]);
    expect(r).toEqual({
      p1: { initiale: "M", nom: "Marie", couleurPersonne: "sapin", couleur: "#123456" },
      p2: { initiale: "L", nom: "léo", couleur: "#abcdef" },
    });
  });

  it("ignore une couleur de personne hors palette", () => {
    const r = profilsDuFoyer([{ id: "p1", data: { nom: "Al", initiale: "A", couleurPersonne: "rose" } }]);
    expect(r.p1).toEqual({ initiale: "A", nom: "Al" });
  });
});

describe("heuresRepasDuFoyer", () => {
  it("copie les heures du foyer telles quelles (l'iPad normalise)", () => {
    const h = { semaine: { petitDej: "07:30" }, weekend: { diner: "pas une heure" } };
    expect(heuresRepasDuFoyer({ parametres: { heuresRepas: h } })).toEqual(h);
  });

  it("rend undefined sans heures", () => {
    expect(heuresRepasDuFoyer(undefined)).toBeUndefined();
    expect(heuresRepasDuFoyer({ parametres: {} })).toBeUndefined();
    expect(heuresRepasDuFoyer({ parametres: { heuresRepas: "x" } })).toBeUndefined();
  });
});

describe("porteeRafraichissement", () => {
  it("par défaut « tout » (anciens hubs)", () => {
    expect(porteeRafraichissement(undefined)).toBe("tout");
  });

  it("accepte « menu » et « tout »", () => {
    expect(porteeRafraichissement("menu")).toBe("menu");
    expect(porteeRafraichissement("tout")).toBe("tout");
  });

  it("refuse toute autre valeur", () => {
    expect(() => porteeRafraichissement("meteo")).toThrow();
    expect(() => porteeRafraichissement(1)).toThrow();
    expect(() => porteeRafraichissement(null)).toThrow();
  });
});
