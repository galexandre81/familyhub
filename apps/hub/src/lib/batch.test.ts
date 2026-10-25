import { describe, expect, it } from "vitest";
import type { Repas } from "@family-hub/types";
import { batchsProches, dureeTexte, jourDuBatch, repasDuBatch } from "./batch";

type S = { id: string; date?: string; repas: Repas; batchSessionId?: string };

describe("batchsProches", () => {
  const now = new Date(2026, 9, 25, 16, 39); // dimanche 25 octobre
  const sessions = [
    { id: "hier", date: "2026-10-24" },
    { id: "auj", date: "2026-10-25" },
    { id: "dem", date: "2026-10-26" },
    { id: "apres", date: "2026-10-27" },
  ];

  it("garde les sessions d'aujourd'hui et de demain, dans l'ordre", () => {
    expect(batchsProches(sessions, now)).toEqual([
      { batch: sessions[1], quand: "aujourdhui" },
      { batch: sessions[2], quand: "demain" },
    ]);
  });

  it("rien quand aucune session n'est proche", () => {
    expect(batchsProches([sessions[0], sessions[3]], now)).toEqual([]);
  });

  it("demain se calcule au changement de mois", () => {
    const fin = new Date(2026, 9, 31, 20, 0);
    expect(batchsProches([{ id: "n", date: "2026-11-01" }], fin)).toEqual([
      { batch: { id: "n", date: "2026-11-01" }, quand: "demain" },
    ]);
  });
});

describe("dureeTexte", () => {
  it("heures et minutes", () => {
    expect(dureeTexte(150)).toBe("2 h 30");
    expect(dureeTexte(120)).toBe("2 h");
    expect(dureeTexte(65)).toBe("1 h 05");
  });
  it("moins d'une heure", () => {
    expect(dureeTexte(45)).toBe("45 min");
  });
  it("durée inconnue", () => {
    expect(dureeTexte(0)).toBeNull();
    expect(dureeTexte(Number.NaN)).toBeNull();
  });
});

describe("jourDuBatch", () => {
  const now = new Date(2026, 9, 25, 9, 0);
  it("aujourd'hui, demain, sinon la date en toutes lettres", () => {
    expect(jourDuBatch("2026-10-25", now)).toBe("Aujourd'hui");
    expect(jourDuBatch("2026-10-26", now)).toBe("Demain");
    expect(jourDuBatch("2026-10-28", now)).toBe("Mercredi 28 octobre");
  });
});

describe("repasDuBatch", () => {
  it("les repas qui consomment la session, par date puis par repas", () => {
    const slots: S[] = [
      { id: "a", date: "2026-10-28", repas: "diner", batchSessionId: "b1" },
      { id: "b", date: "2026-10-27", repas: "diner", batchSessionId: "b1" },
      { id: "c", date: "2026-10-27", repas: "dej", batchSessionId: "b1" },
      { id: "d", date: "2026-10-27", repas: "dej", batchSessionId: "autre" },
      { id: "e", date: "2026-10-27", repas: "petitDej" },
    ];
    expect(repasDuBatch(slots, "b1").map((s) => s.id)).toEqual(["c", "b", "a"]);
  });
});
