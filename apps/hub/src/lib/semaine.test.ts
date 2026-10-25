import { describe, expect, it } from "vitest";
import { HEURES_REPAS_DEFAUT, type Repas } from "@family-hub/types";
import { dateDuTimestamp, joursDuPlan, jourInitial, planVoisins, repasPasse } from "./semaine";

type S = { id: string; date?: string; repas: Repas; recetteIds: string[] };
const slot = (id: string, date: string, repas: Repas): S => ({ id, date, repas, recetteIds: ["r"] });

// Plan réel : samedi 24 → samedi 31 octobre 2026 (8 jours).
const plan = {
  dateDebut: new Date(2026, 9, 24, 0, 0),
  dateFin: new Date(2026, 9, 31, 23, 59),
};

describe("joursDuPlan", () => {
  it("plan du samedi 24 au samedi 31 → 8 jours dans l'ordre", () => {
    const jours = joursDuPlan([], plan);
    expect(jours).toHaveLength(8);
    expect(jours.map((j) => j.dateISO)).toEqual([
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ]);
    expect(jours.map((j) => j.libelleCourt)).toEqual(["sam", "dim", "lun", "mar", "mer", "jeu", "ven", "sam"]);
    expect(jours.map((j) => j.numero)).toEqual([24, 25, 26, 27, 28, 29, 30, 31]);
  });

  it("range les 3 repas du jour dans l'ordre, avec le créneau s'il existe", () => {
    const slots = [slot("din", "2026-10-27", "diner"), slot("pd", "2026-10-27", "petitDej")];
    const mardi = joursDuPlan(slots, plan).find((j) => j.dateISO === "2026-10-27")!;
    expect(mardi.repas.map((r) => r.repas)).toEqual(["petitDej", "dej", "diner"]);
    expect(mardi.repas.map((r) => r.slot?.id)).toEqual(["pd", undefined, "din"]);
  });

  it("élargit la plage aux créneaux qui débordent du plan", () => {
    const jours = joursDuPlan([slot("x", "2026-11-01", "dej")], plan);
    expect(jours).toHaveLength(9);
    expect(jours[8].dateISO).toBe("2026-11-01");
    expect(jours[8].repas[1].slot?.id).toBe("x");
  });

  it("accepte les Timestamps Firestore ({ seconds })", () => {
    const p = {
      dateDebut: { seconds: plan.dateDebut.getTime() / 1000, nanoseconds: 0 },
      dateFin: { seconds: plan.dateFin.getTime() / 1000, nanoseconds: 0 },
    };
    expect(joursDuPlan([], p)).toHaveLength(8);
  });

  it("sans dates de plan, se rabat sur les dates des créneaux", () => {
    const jours = joursDuPlan([slot("a", "2026-10-26", "dej"), slot("b", "2026-10-28", "dej")], {});
    expect(jours.map((j) => j.dateISO)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28"]);
  });

  it("sans aucune date, renvoie une liste vide", () => {
    expect(joursDuPlan([], {})).toEqual([]);
  });
});

describe("jourInitial", () => {
  const jours = joursDuPlan([], plan);

  it("aujourd'hui s'il est dans le plan (date locale, même tard le soir)", () => {
    expect(jourInitial(jours, new Date(2026, 9, 27, 23, 30))).toBe("2026-10-27");
    expect(jourInitial(jours, new Date(2026, 9, 25, 0, 10))).toBe("2026-10-25");
  });

  it("sinon le premier jour", () => {
    expect(jourInitial(jours, new Date(2026, 10, 5, 12, 0))).toBe("2026-10-24");
    expect(jourInitial(jours, new Date(2026, 9, 1, 12, 0))).toBe("2026-10-24");
  });

  it("liste vide → chaîne vide", () => {
    expect(jourInitial([], new Date())).toBe("");
  });
});

describe("repasPasse", () => {
  it("passé une heure après son heure", () => {
    // Mardi : déjeuner 12:15.
    expect(repasPasse("2026-10-27", "dej", new Date(2026, 9, 27, 13, 10), HEURES_REPAS_DEFAUT)).toBe(false);
    expect(repasPasse("2026-10-27", "dej", new Date(2026, 9, 27, 13, 20), HEURES_REPAS_DEFAUT)).toBe(true);
    expect(repasPasse("2026-10-28", "petitDej", new Date(2026, 9, 27, 21, 0), HEURES_REPAS_DEFAUT)).toBe(false);
  });
});

describe("planVoisins", () => {
  // useAllPlans : triés par dateDebut décroissante.
  const plans = [{ id: "c" }, { id: "b" }, { id: "a" }];

  it("précédent = plus ancien, suivant = plus récent", () => {
    expect(planVoisins(plans, "b")).toEqual({ precedentId: "a", suivantId: "c" });
    expect(planVoisins(plans, "c")).toEqual({ precedentId: "b", suivantId: undefined });
    expect(planVoisins(plans, "a")).toEqual({ precedentId: undefined, suivantId: "b" });
  });

  it("plan inconnu → aucun voisin", () => {
    expect(planVoisins(plans, "z")).toEqual({ precedentId: undefined, suivantId: undefined });
  });
});

describe("dateDuTimestamp", () => {
  it("Date, { seconds }, chaîne, toDate()", () => {
    const d = new Date(2026, 9, 24);
    expect(dateDuTimestamp(d)?.getTime()).toBe(d.getTime());
    expect(dateDuTimestamp({ seconds: d.getTime() / 1000, nanoseconds: 0 })?.getTime()).toBe(d.getTime());
    expect(dateDuTimestamp({ toDate: () => d })?.getTime()).toBe(d.getTime());
    expect(dateDuTimestamp(d.toISOString())?.getTime()).toBe(d.getTime());
    expect(dateDuTimestamp(undefined)).toBeUndefined();
    expect(dateDuTimestamp("n'importe quoi")).toBeUndefined();
  });
});
