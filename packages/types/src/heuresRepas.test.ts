import { describe, expect, it } from "vitest";
import {
  HEURES_REPAS_DEFAUT,
  heuresRepasValides,
  heureDuRepas,
  libelleDans,
  minutesAvant,
  prochainsRepas,
} from "./heuresRepas";
import type { Repas } from "./mealPlan";

type S = { date?: string; repas: Repas; annule?: boolean; recetteIds: string[] };
const slot = (date: string | undefined, repas: Repas, extra: Partial<S> = {}): S => ({
  date,
  repas,
  recetteIds: ["r1"],
  ...extra,
});

describe("heureDuRepas", () => {
  it("semaine : petit-déj 07:00", () => {
    expect(heureDuRepas("2026-10-27", "petitDej")).toEqual(new Date(2026, 9, 27, 7, 0));
  });
  it("week-end : petit-déj 08:00 (samedi et dimanche)", () => {
    expect(heureDuRepas("2026-10-24", "petitDej")).toEqual(new Date(2026, 9, 24, 8, 0));
    expect(heureDuRepas("2026-10-25", "petitDej")).toEqual(new Date(2026, 9, 25, 8, 0));
  });
  it("déjeuner 12:15 et dîner 19:00", () => {
    expect(heureDuRepas("2026-10-27", "dej")).toEqual(new Date(2026, 9, 27, 12, 15));
    expect(heureDuRepas("2026-10-27", "diner")).toEqual(new Date(2026, 9, 27, 19, 0));
  });
  it("utilise des heures personnalisées", () => {
    const h = { ...HEURES_REPAS_DEFAUT, semaine: { ...HEURES_REPAS_DEFAUT.semaine, dej: "13:30" } };
    expect(heureDuRepas("2026-10-27", "dej", h)).toEqual(new Date(2026, 9, 27, 13, 30));
  });
});

describe("prochainsRepas", () => {
  const sam = "2026-10-24";
  const mar = "2026-10-27";
  const slots = [
    slot(sam, "petitDej"),
    slot(sam, "dej"),
    slot(mar, "dej"),
    slot(mar, "diner"),
  ];

  it("samedi 07:30 : le petit-déj de 08:00 est le prochain", () => {
    const r = prochainsRepas(slots, new Date(2026, 9, 24, 7, 30));
    expect(r[0].slot).toBe(slots[0]);
    expect(r[0].heure).toEqual(new Date(2026, 9, 24, 8, 0));
    expect(r).toHaveLength(2);
    expect(r[1].slot).toBe(slots[1]);
  });

  it("mardi 13:00 : le déjeuner reste prochain jusqu'à 13:15", () => {
    const r = prochainsRepas(slots, new Date(2026, 9, 27, 13, 0));
    expect(r[0].slot).toBe(slots[2]);
    const r15 = prochainsRepas(slots, new Date(2026, 9, 27, 13, 15));
    expect(r15[0].slot).toBe(slots[2]);
  });

  it("mardi 13:16 : le dîner devient prochain", () => {
    const r = prochainsRepas(slots, new Date(2026, 9, 27, 13, 16));
    expect(r[0].slot).toBe(slots[3]);
  });

  it("ignore annulé, sans date, sans recette", () => {
    const s = [
      slot(mar, "dej", { annule: true }),
      slot(undefined, "dej"),
      slot(mar, "dej", { recetteIds: [] }),
      slot(mar, "diner"),
    ];
    const r = prochainsRepas(s, new Date(2026, 9, 27, 8, 0));
    expect(r).toHaveLength(1);
    expect(r[0].slot).toBe(s[3]);
  });

  it("trie par heure et limite à n", () => {
    const s = [slot(mar, "diner"), slot(mar, "dej"), slot(mar, "petitDej")];
    const r = prochainsRepas(s, new Date(2026, 9, 27, 6, 0), undefined, 3);
    expect(r.map((x) => x.slot.repas)).toEqual(["petitDej", "dej", "diner"]);
    expect(prochainsRepas(s, new Date(2026, 9, 27, 6, 0), undefined, 1)).toHaveLength(1);
  });
});

describe("minutesAvant / libelleDans", () => {
  it("minutesAvant arrondit à la minute", () => {
    expect(minutesAvant(new Date(2026, 9, 27, 12, 15), new Date(2026, 9, 27, 12, 5))).toBe(10);
  });
  it("libellés", () => {
    expect(libelleDans(10)).toBe("dans 10 min");
    expect(libelleDans(59)).toBe("dans 59 min");
    expect(libelleDans(90)).toBe("dans 1 h 30");
    expect(libelleDans(120)).toBe("dans 2 h");
    expect(libelleDans(65)).toBe("dans 1 h 05");
    expect(libelleDans(0)).toBe("maintenant");
    expect(libelleDans(-20)).toBe("maintenant");
  });
});

describe("heures invalides ou absentes", () => {
  it("retombe sur les défauts champ par champ", () => {
    const bad = {
      semaine: { petitDej: "", dej: "25:00", diner: "19:30" },
    } as unknown as Parameters<typeof heureDuRepas>[2];
    expect(heureDuRepas("2026-10-27", "petitDej", bad)).toEqual(new Date(2026, 9, 27, 7, 0));
    expect(heureDuRepas("2026-10-27", "dej", bad)).toEqual(new Date(2026, 9, 27, 12, 15));
    expect(heureDuRepas("2026-10-27", "diner", bad)).toEqual(new Date(2026, 9, 27, 19, 30));
    expect(heureDuRepas("2026-10-24", "petitDej", bad)).toEqual(new Date(2026, 9, 24, 8, 0));
  });
  it("heuresRepasValides normalise", () => {
    expect(heuresRepasValides(undefined)).toEqual(HEURES_REPAS_DEFAUT);
    expect(heuresRepasValides({ weekend: { diner: "20:00" } } as never).weekend).toEqual({
      ...HEURES_REPAS_DEFAUT.weekend,
      diner: "20:00",
    });
  });
  it("changement d'heure (dimanche 25 octobre 2026) : dîner 19:00 local", () => {
    const d = heureDuRepas("2026-10-25", "diner");
    expect([d.getHours(), d.getMinutes(), d.getDate()]).toEqual([19, 0, 25]);
  });
});
