import { describe, expect, it } from "vitest";
import { HEURES_REPAS_DEFAUT, type Repas } from "@family-hub/types";
import { dateISOLocale, millisecondesAvantMinute, remplissageBarre, resumeAujourdhui, texteDuJour } from "./aujourdhui";

type S = {
  id: string;
  date?: string;
  repas: Repas;
  recetteIds: string[];
  profilsPresents: string[];
  annule?: boolean;
};

const slot = (id: string, date: string, repas: Repas, recetteIds: string[], extra: Partial<S> = {}): S => ({
  id,
  date,
  repas,
  recetteIds,
  profilsPresents: ["p1"],
  ...extra,
});

const recettes = {
  r1: { nom: "Porridge" },
  r2: { nom: "Lasagnes" },
  r3: { nom: "Salade verte" },
  r4: { nom: "Pain" },
  r5: { nom: "Soupe" },
  r6: { nom: "Chili" },
};

// Mardi 27 octobre 2026 (semaine : 07:00 / 12:15 / 19:00).
const JOUR = "2026-10-27";
const slots = [
  slot("pd", JOUR, "petitDej", ["r1"]),
  slot("dej", JOUR, "dej", ["r2", "r3", "r4"]),
  slot("din", JOUR, "diner", ["r5"]),
  slot("demain-pd", "2026-10-28", "petitDej", ["r1"]),
];

describe("resumeAujourdhui", () => {
  it("prend le prochain repas, avec plat principal et accompagnements", () => {
    const now = new Date(2026, 9, 27, 10, 45);
    const r = resumeAujourdhui(slots, recettes, [], now, HEURES_REPAS_DEFAUT);
    expect(r.prochain?.slot.id).toBe("dej");
    expect(r.prochain?.plat).toBe("Lasagnes");
    expect(r.prochain?.accompagnements).toEqual(["Salade verte", "Pain"]);
    expect(r.prochain?.minutes).toBe(90);
    expect(r.prochain?.dans).toBe("dans 1 h 30");
    expect(r.prochain?.heureTexte).toBe("12:15");
    expect(r.prochain?.jourTexte).toBeUndefined();
    expect(r.prochain?.remplissage).toBeCloseTo(0.5);
  });

  it("efface les repas passés et exclut le prochain des autres repas du jour", () => {
    const now = new Date(2026, 9, 27, 10, 45);
    const r = resumeAujourdhui(slots, recettes, [], now, HEURES_REPAS_DEFAUT);
    expect(r.autresDuJour.map((a) => [a.slot.id, a.passe])).toEqual([
      ["pd", true],
      ["din", false],
    ]);
    expect(r.autresDuJour[1].noms).toEqual(["Soupe"]);
    expect(r.autresDuJour[1].heureTexte).toBe("19:00");
  });

  it("un repas commencé depuis moins d'une heure reste le prochain, pas passé", () => {
    const now = new Date(2026, 9, 27, 12, 45);
    const r = resumeAujourdhui(slots, recettes, [], now, HEURES_REPAS_DEFAUT);
    expect(r.prochain?.slot.id).toBe("dej");
    expect(r.prochain?.dans).toBe("maintenant");
    expect(r.prochain?.remplissage).toBe(0);
  });

  it("le soir après le dîner : prochain = demain, tous les repas du jour passés", () => {
    const now = new Date(2026, 9, 27, 21, 0);
    const r = resumeAujourdhui(slots, recettes, [], now, HEURES_REPAS_DEFAUT);
    expect(r.prochain?.slot.id).toBe("demain-pd");
    expect(r.prochain?.jourTexte).toBe("Demain");
    expect(r.autresDuJour.every((a) => a.passe)).toBe(true);
    expect(r.autresDuJour).toHaveLength(3);
  });

  it("garde un repas annulé du jour en le signalant, ignore les repas vides", () => {
    const now = new Date(2026, 9, 27, 10, 0);
    const s = [
      slot("dej", JOUR, "dej", ["r2"]),
      slot("din", JOUR, "diner", ["r6"], { annule: true }),
      slot("pd", JOUR, "petitDej", []),
    ];
    const r = resumeAujourdhui(s, recettes, [], now, HEURES_REPAS_DEFAUT);
    expect(r.prochain?.slot.id).toBe("dej");
    expect(r.autresDuJour.map((a) => [a.slot.id, a.annule])).toEqual([["din", true]]);
  });

  it("recette introuvable : pas de nom inventé", () => {
    const now = new Date(2026, 9, 27, 10, 0);
    const r = resumeAujourdhui([slot("dej", JOUR, "dej", ["inconnue", "r3"])], recettes, [], now, HEURES_REPAS_DEFAUT);
    expect(r.prochain?.plat).toBeUndefined();
    expect(r.prochain?.accompagnements).toEqual(["Salade verte"]);
  });

  it("renvoie les batchs du jour, tous s'il y en a plusieurs", () => {
    const now = new Date(2026, 9, 27, 10, 0);
    const batch = [
      { id: "b0", date: "2026-10-25", recetteIds: [], done: true },
      { id: "b1", date: JOUR, recetteIds: ["r6"], done: false },
      { id: "b2", date: JOUR, recetteIds: ["r5"], done: true },
    ];
    const r = resumeAujourdhui(slots, recettes, batch, now, HEURES_REPAS_DEFAUT);
    expect(r.batchsDuJour.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(resumeAujourdhui(slots, recettes, [batch[0]], now, HEURES_REPAS_DEFAUT).batchsDuJour).toEqual([]);
  });

  it("sans plan (aucun slot) : rien à afficher", () => {
    const r = resumeAujourdhui([], {}, [], new Date(2026, 9, 27, 10, 0), HEURES_REPAS_DEFAUT);
    expect(r.prochain).toBeUndefined();
    expect(r.autresDuJour).toEqual([]);
    expect(r.batchsDuJour).toEqual([]);
  });

  it("utilise les heures du week-end", () => {
    // Samedi 31 octobre 2026 : petit-déjeuner 08:00.
    const now = new Date(2026, 9, 31, 7, 30);
    const r = resumeAujourdhui([slot("pd", "2026-10-31", "petitDej", ["r1"])], recettes, [], now, HEURES_REPAS_DEFAUT);
    expect(r.prochain?.heureTexte).toBe("08:00");
    expect(r.prochain?.minutes).toBe(30);
  });
});

describe("remplissageBarre", () => {
  it("pleine à 3 h ou plus, vide à l'heure du repas ou après", () => {
    expect(remplissageBarre(240)).toBe(1);
    expect(remplissageBarre(180)).toBe(1);
    expect(remplissageBarre(60)).toBeCloseTo(1 / 3);
    expect(remplissageBarre(0)).toBe(0);
    expect(remplissageBarre(-20)).toBe(0);
  });
});

describe("dateISOLocale", () => {
  it("formate la date locale en AAAA-MM-JJ", () => {
    expect(dateISOLocale(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("texteDuJour", () => {
  const now = new Date(2026, 9, 27, 21, 0); // mardi
  it("rien pour aujourd'hui, « Demain » pour le lendemain, le jour sinon", () => {
    expect(texteDuJour("2026-10-27", now)).toBeUndefined();
    expect(texteDuJour("2026-10-28", now)).toBe("Demain");
    expect(texteDuJour("2026-10-29", now)).toBe("Jeudi");
  });
});

describe("millisecondesAvantMinute", () => {
  it("temps restant jusqu'à la prochaine minute pleine", () => {
    expect(millisecondesAvantMinute(new Date(2026, 9, 27, 10, 0, 45, 500))).toBe(14_500);
    expect(millisecondesAvantMinute(new Date(2026, 9, 27, 10, 0, 0, 0))).toBe(60_000);
  });
});
