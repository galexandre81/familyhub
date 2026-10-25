/**
 * Prochain repas de l'iPad (apps/display/public/js/repas.js, ES5) : le fichier
 * livré est exécuté tel quel dans un contexte vm, une fois comme dans Safari
 * (window) et une fois en CommonJS, puis comparé à @family-hub/types
 * (import relatif de la source : pas de dépendance ajoutée au paquet design).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  heureDuRepas as heureDuRepasTs,
  libelleDans as libelleDansTs,
  minutesAvant as minutesAvantTs,
  prochainsRepas as prochainsRepasTs,
} from "../../types/src/heuresRepas";

type Repas = "petitDej" | "dej" | "diner";
interface Slot {
  date?: string;
  repas: Repas;
  recetteIds: string[];
  annule?: boolean;
}
interface ApiRepas {
  heureDuRepas(dateISO: string, repas: Repas, heures?: unknown): Date;
  prochainsRepas(slots: Slot[], now: Date, heures?: unknown, n?: number): Array<{ slot: Slot; heure: Date }>;
  minutesAvant(heure: Date, now: Date): number;
  libelleDans(minutes: number): string;
  remplissageBarre(minutes: number): number;
  libelleMoment(repas: Repas, dateISO: string, now: Date, heures?: unknown): string;
}

const SOURCE = readFileSync(
  fileURLToPath(new URL("../../../apps/display/public/js/repas.js", import.meta.url)),
  "utf8",
);

function chargerCommeSafari(): ApiRepas {
  const window: { FamilyHubRepas?: ApiRepas } = {};
  runInNewContext(SOURCE, { window });
  if (!window.FamilyHubRepas) throw new Error("window.FamilyHubRepas absent");
  return window.FamilyHubRepas;
}

const r = chargerCommeSafari();
// 2026-10-26 = lundi ; 2026-10-31 = samedi ; 2026-11-01 = dimanche.
const at = (iso: string) => new Date(iso);
const s = (date: string, repas: Repas, extra: Partial<Slot> = {}): Slot => ({
  date,
  repas,
  recetteIds: ["r1"],
  ...extra,
});

describe("repas.js (iPad) — chargement", () => {
  it("expose window.FamilyHubRepas et module.exports", () => {
    expect(typeof r.prochainsRepas).toBe("function");
    const module: { exports: Partial<ApiRepas> } = { exports: {} };
    runInNewContext(SOURCE, { module });
    expect(typeof module.exports.libelleMoment).toBe("function");
  });
});

describe("heureDuRepas", () => {
  it("semaine : 07:00 / 12:15 / 19:00", () => {
    expect(r.heureDuRepas("2026-10-26", "petitDej").getTime()).toBe(at("2026-10-26T07:00:00").getTime());
    expect(r.heureDuRepas("2026-10-26", "dej").getTime()).toBe(at("2026-10-26T12:15:00").getTime());
    expect(r.heureDuRepas("2026-10-26", "diner").getTime()).toBe(at("2026-10-26T19:00:00").getTime());
  });
  it("week-end : petit-déjeuner à 08:00 (samedi et dimanche)", () => {
    expect(r.heureDuRepas("2026-10-31", "petitDej").getTime()).toBe(at("2026-10-31T08:00:00").getTime());
    expect(r.heureDuRepas("2026-11-01", "petitDej").getTime()).toBe(at("2026-11-01T08:00:00").getTime());
  });
  it("heures du foyer, avec repli sur les défauts si invalides", () => {
    const h = { semaine: { dej: "13:00", diner: "25:99" }, weekend: { petitDej: "9h" } };
    expect(r.heureDuRepas("2026-10-26", "dej", h).getTime()).toBe(at("2026-10-26T13:00:00").getTime());
    expect(r.heureDuRepas("2026-10-26", "diner", h).getTime()).toBe(at("2026-10-26T19:00:00").getTime());
    expect(r.heureDuRepas("2026-10-31", "petitDej", h).getTime()).toBe(at("2026-10-31T08:00:00").getTime());
    expect(r.heureDuRepas("2026-10-26", "dej", null).getTime()).toBe(at("2026-10-26T12:15:00").getTime());
  });
});

describe("prochainsRepas", () => {
  const slots = [
    s("2026-10-26", "diner"),
    s("2026-10-26", "dej"),
    s("2026-10-27", "dej"),
    s("2026-10-26", "petitDej", { annule: true }),
    s("2026-10-28", "dej", { recetteIds: [] }),
  ];
  it("trie par heure, saute annulés et sans recette, limite à n", () => {
    const res = r.prochainsRepas(slots, at("2026-10-26T08:00:00"), undefined, 2);
    expect(res.map((x) => x.slot.repas + x.slot.date)).toEqual(["dej2026-10-26", "diner2026-10-26"]);
    expect(r.prochainsRepas(slots, at("2026-10-26T08:00:00"), undefined, 5)).toHaveLength(3);
  });
  it("un repas reste prochain jusqu'à 1 h après son heure (borne incluse)", () => {
    expect(r.prochainsRepas(slots, at("2026-10-26T13:15:00"), undefined, 1)[0].slot.repas).toBe("dej");
    const apres = r.prochainsRepas(slots, at("2026-10-26T13:15:01"), undefined, 1)[0];
    expect(apres.slot.repas).toBe("diner");
  });
  it("passe minuit : le dernier dîner reste prochain jusqu'à 20:00, puis demain", () => {
    expect(r.prochainsRepas(slots, at("2026-10-26T20:00:00"), undefined, 1)[0].slot.repas).toBe("diner");
    const res = r.prochainsRepas(slots, at("2026-10-26T23:59:00"), undefined, 1)[0];
    expect(res.slot.date).toBe("2026-10-27");
  });
  it("slot sans date ignoré ; anciens snapshots sans annule/profilsPresents acceptés", () => {
    const res = r.prochainsRepas([{ repas: "dej", recetteIds: ["x"] }, s("2026-10-26", "dej")], at("2026-10-26T08:00:00"));
    expect(res).toHaveLength(1);
  });
  it("week-end : le petit-déjeuner du samedi est à 08:00", () => {
    const res = r.prochainsRepas([s("2026-10-31", "petitDej")], at("2026-10-31T07:30:00"));
    expect(res[0].heure.getTime()).toBe(at("2026-10-31T08:00:00").getTime());
  });
  it("heures invalides → défauts", () => {
    const res = r.prochainsRepas([s("2026-10-26", "dej")], at("2026-10-26T08:00:00"), { semaine: { dej: "zz" } });
    expect(res[0].heure.getTime()).toBe(at("2026-10-26T12:15:00").getTime());
  });
});

describe("minutesAvant / libelleDans / remplissageBarre", () => {
  it("libellés", () => {
    expect(r.libelleDans(-5)).toBe("maintenant");
    expect(r.libelleDans(0)).toBe("maintenant");
    expect(r.libelleDans(10)).toBe("dans 10 min");
    expect(r.libelleDans(59)).toBe("dans 59 min");
    expect(r.libelleDans(60)).toBe("dans 1 h");
    expect(r.libelleDans(90)).toBe("dans 1 h 30");
    expect(r.libelleDans(125)).toBe("dans 2 h 05");
    expect(r.libelleDans(120)).toBe("dans 2 h");
  });
  it("remplissage : pleine à 180 min et plus, vide à 0 (comme le hub)", () => {
    expect(r.remplissageBarre(180)).toBe(1);
    expect(r.remplissageBarre(400)).toBe(1);
    expect(r.remplissageBarre(90)).toBe(0.5);
    expect(r.remplissageBarre(0)).toBe(0);
    expect(r.remplissageBarre(-30)).toBe(0);
  });
  it("minutesAvant arrondit et devient négatif une fois passé", () => {
    const h = at("2026-10-26T12:15:00");
    expect(r.minutesAvant(h, at("2026-10-26T12:05:00"))).toBe(10);
    expect(r.minutesAvant(h, at("2026-10-26T12:05:40"))).toBe(9);
    expect(r.minutesAvant(h, at("2026-10-26T12:25:00"))).toBe(-10);
  });
});

describe("libelleMoment", () => {
  const now = at("2026-10-26T10:00:00"); // lundi
  it("aujourd'hui : repas + heure du foyer", () => {
    expect(r.libelleMoment("petitDej", "2026-10-26", now)).toBe("Petit-déjeuner · 07:00");
    expect(r.libelleMoment("dej", "2026-10-26", now)).toBe("Déjeuner · 12:15");
    expect(r.libelleMoment("diner", "2026-10-26", now, { semaine: { diner: "19:30" } })).toBe("Dîner · 19:30");
  });
  it("aujourd'hui un samedi : petit-déjeuner à 08:00", () => {
    expect(r.libelleMoment("petitDej", "2026-10-31", at("2026-10-31T06:00:00"))).toBe("Petit-déjeuner · 08:00");
  });
  it("demain : matin / midi / soir", () => {
    expect(r.libelleMoment("petitDej", "2026-10-27", now)).toBe("Demain matin");
    expect(r.libelleMoment("dej", "2026-10-27", now)).toBe("Demain midi");
    expect(r.libelleMoment("diner", "2026-10-27", now)).toBe("Demain soir");
  });
  it("demain à cheval sur un changement de mois", () => {
    expect(r.libelleMoment("dej", "2026-11-01", at("2026-10-31T22:00:00"))).toBe("Demain midi");
  });
  it("autres jours : jour de la semaine, numéro, repas", () => {
    expect(r.libelleMoment("diner", "2026-10-27", at("2026-10-25T10:00:00"))).toBe("Mardi 27 · Dîner");
    expect(r.libelleMoment("dej", "2026-11-01", now)).toBe("Dimanche 1 · Déjeuner");
    expect(r.libelleMoment("petitDej", "2026-10-31", now)).toBe("Samedi 31 · Petit-déjeuner");
  });
});

describe("parité avec @family-hub/types", () => {
  const dates = ["2026-10-25", "2026-10-26", "2026-10-30", "2026-10-31", "2026-11-01", "2026-12-31"];
  const repasList: Repas[] = ["petitDej", "dej", "diner"];
  const heuresFoyer = { semaine: { dej: "13:05", diner: "bad" }, weekend: { petitDej: "09:30" } };

  it("heureDuRepas", () => {
    for (const d of dates) {
      for (const rp of repasList) {
        for (const h of [undefined, heuresFoyer]) {
          expect(r.heureDuRepas(d, rp, h).getTime()).toBe(heureDuRepasTs(d, rp, h).getTime());
        }
      }
    }
  });

  it("prochainsRepas sur une grille d'instants", () => {
    const slots: Slot[] = [];
    for (const d of dates) for (const rp of repasList) slots.push(s(d, rp));
    slots.push(s("2026-10-26", "dej", { annule: true }), s("2026-10-27", "diner", { recetteIds: [] }));
    const instants = [
      "2026-10-24T23:59:00", "2026-10-25T08:00:00", "2026-10-25T08:59:59", "2026-10-25T09:00:01",
      "2026-10-26T00:00:00", "2026-10-26T13:15:00", "2026-10-26T13:15:01", "2026-10-26T20:00:00",
      "2026-10-31T07:59:00", "2026-10-31T19:30:00", "2026-11-01T20:00:01", "2026-12-31T23:59:00",
    ];
    for (const i of instants) {
      for (const h of [undefined, heuresFoyer]) {
        for (const n of [1, 2, 4]) {
          const now = at(i);
          const attendu = prochainsRepasTs(slots, now, h as never, n).map((x) => [x.slot, x.heure.getTime()]);
          const obtenu = r.prochainsRepas(slots, now, h, n).map((x) => [x.slot, x.heure.getTime()]);
          expect(obtenu).toEqual(attendu);
        }
      }
    }
  });

  it("minutesAvant et libelleDans", () => {
    const h = at("2026-10-26T12:15:00");
    for (const dec of [-90, -1, 0, 1, 10, 59, 60, 61, 90, 120, 125, 600]) {
      const now = new Date(h.getTime() - dec * 60_000);
      expect(r.minutesAvant(h, now)).toBe(minutesAvantTs(h, now));
      expect(r.libelleDans(dec)).toBe(libelleDansTs(dec));
    }
  });
});
