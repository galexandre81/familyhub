import { describe, expect, it } from "vitest";
import type { BatchSession, MealPlanSlot, Recette, Repas } from "@family-hub/types";
import {
  joursDuBatch,
  recetteIdsAChargerPourRepas,
  repasDeLArticle,
  repasIndisponibles,
  titreEntreeBatch,
} from "./repasArticle";

type Slot = MealPlanSlot & { id: string };
type Batch = BatchSession & { id: string };

const slot = (id: string, date: string, repas: Repas, recetteIds: string[], extra: Partial<Slot> = {}): Slot => ({
  id,
  jour: 0,
  date,
  repas,
  profilsPresents: [],
  recetteIds,
  statut: "accepte",
  ...extra,
});

const batch = (id: string, date: string, recetteIds: string[], extra: Partial<Batch> = {}): Batch => ({
  id,
  planId: "p",
  date,
  dureeEstimeeMinutes: 60,
  recetteIds,
  done: false,
  ...extra,
});

const recette = (nom: string, portions: number, ingredients: Recette["ingredients"]): Recette =>
  ({ nom, portions, ingredients }) as Recette;

const ing = (libelle: string, quantite: string, unite: string) => ({ libelle, quantite, unite, rayon: "autre" as const });

const recettes: Record<string, Recette | undefined> = {
  r1: recette("Gratin", 4, [ing("Crème", "200", "g")]),
  r2: recette("Soupe", 4, [ing("Crème", "100", "g")]),
};
const article = { nom: "Crème", recetteIds: ["r1"] };
const AUJ = "2026-11-03";

describe("repasDeLArticle", () => {
  it("recette dans deux repas : 2 entrées, « 2 repas »", () => {
    const r = repasDeLArticle(
      article,
      [slot("a", "2026-11-05", "dej", ["r1"]), slot("b", "2026-11-06", "diner", ["r1"])],
      [],
      recettes,
      AUJ,
    );
    expect(r.entrees).toHaveLength(2);
    expect(r.entrees.every((e) => e.type === "repas")).toBe(true);
    expect(r.nombreRepas).toBe(2);
    expect(r.libelleBouton).toBe("2 repas");
  });

  it("deux recettes dans le même repas : 2 entrées, « 1 repas »", () => {
    const r = repasDeLArticle(
      { nom: "Crème", recetteIds: ["r1", "r2"] },
      [slot("a", "2026-11-05", "dej", ["r1", "r2"])],
      [],
      recettes,
      AUJ,
    );
    expect(r.entrees).toHaveLength(2);
    expect(new Set(r.entrees.map((e) => e.cle)).size).toBe(2);
    expect(r.nombreRepas).toBe(1);
    expect(r.libelleBouton).toBe("1 repas");
  });

  it("repas annulé : entrée annule, non compté ; tous annulés : « 0 repas »", () => {
    const r = repasDeLArticle(
      article,
      [slot("a", "2026-11-05", "dej", ["r1"], { annule: true }), slot("b", "2026-11-06", "dej", ["r1"])],
      [],
      recettes,
      AUJ,
    );
    expect(r.entrees.filter((e) => e.type === "repas" && e.annule)).toHaveLength(1);
    expect(r.nombreRepas).toBe(1);
    const tous = repasDeLArticle(article, [slot("a", "2026-11-05", "dej", ["r1"], { annule: true })], [], recettes, AUJ);
    expect(tous.nombreRepas).toBe(0);
    expect(tous.libelleBouton).toBe("0 repas");
  });

  it("repas passé : passe: true, compté", () => {
    const r = repasDeLArticle(
      article,
      [slot("a", "2026-11-02", "dej", ["r1"]), slot("b", AUJ, "dej", ["r1"])],
      [],
      recettes,
      AUJ,
    );
    const [e1, e2] = r.entrees;
    expect(e1.type === "repas" && e1.passe).toBe(true);
    expect(e2.type === "repas" && e2.passe).toBe(false);
    expect(r.nombreRepas).toBe(2);
  });

  it("batch mangé mardi et jeudi : 1 entrée, mange de longueur 2, « 2 repas »", () => {
    const r = repasDeLArticle(
      article,
      [
        slot("a", "2026-11-10", "dej", ["r1"], { batchSessionId: "b1", source: "batch" }),
        slot("b", "2026-11-12", "dej", ["r1"], { batchSessionId: "b1", source: "batch" }),
      ],
      [batch("b1", "2026-11-08", ["r1"])],
      recettes,
      AUJ,
    );
    expect(r.entrees).toHaveLength(1);
    const e = r.entrees[0];
    expect(e.type).toBe("batch");
    if (e.type === "batch") {
      expect(e.mange).toHaveLength(2);
      expect(e.dateCuisine).toBe("2026-11-08");
      expect(e.portions).toBe(4);
    }
    expect(r.nombreRepas).toBe(2);
    expect(r.libelleBouton).toBe("2 repas");
  });

  it("mardi annulé : mange[0].annule, « 1 repas »", () => {
    const r = repasDeLArticle(
      article,
      [
        slot("a", "2026-11-10", "dej", ["r1"], { batchSessionId: "b1", annule: true }),
        slot("b", "2026-11-12", "dej", ["r1"], { batchSessionId: "b1" }),
      ],
      [batch("b1", "2026-11-08", ["r1"])],
      recettes,
      AUJ,
    );
    const e = r.entrees[0];
    expect(e.type === "batch" && e.mange[0].annule).toBe(true);
    expect(e.type === "batch" && e.annule).toBe(false);
    expect(r.libelleBouton).toBe("1 repas");
  });

  it("tous annulés : annule: true, « 0 repas », même avec done: true", () => {
    const r = repasDeLArticle(
      article,
      [slot("a", "2026-11-10", "dej", ["r1"], { batchSessionId: "b1", annule: true })],
      [batch("b1", "2026-11-08", ["r1"], { done: true })],
      recettes,
      AUJ,
    );
    const e = r.entrees[0];
    expect(e.type === "batch" && e.annule).toBe(true);
    expect(r.libelleBouton).toBe("0 repas");
  });

  it("batch sans repas : mange: [], « 1 repas »", () => {
    const r = repasDeLArticle(article, [], [batch("b1", "2026-11-08", ["r1"])], recettes, AUJ);
    const e = r.entrees[0];
    expect(e.type === "batch" && e.mange).toEqual([]);
    expect(e.type === "batch" && e.annule).toBe(false);
    expect(r.libelleBouton).toBe("1 repas");
  });

  it("session [r1, r2] : seuls les repas qui contiennent la recette de l'article sont rattachés", () => {
    const slots = [
      slot("a", "2026-11-10", "dej", ["r1"], { batchSessionId: "b1" }),
      slot("b", "2026-11-12", "dej", ["r2"], { batchSessionId: "b1" }),
    ];
    const sessions = [batch("b1", "2026-11-08", ["r1", "r2"])];
    const r = repasDeLArticle(article, slots, sessions, recettes, AUJ);
    expect(r.entrees).toHaveLength(1);
    const e = r.entrees[0];
    expect(e.type === "batch" && e.mange).toHaveLength(1);
    expect(r.libelleBouton).toBe("1 repas");

    const annuleR2 = [slots[0], { ...slots[1], annule: true }];
    const r2 = repasDeLArticle(article, annuleR2, sessions, recettes, AUJ);
    const e2 = r2.entrees[0];
    expect(e2.type === "batch" && e2.annule).toBe(false);
    expect(e2.type === "batch" && e2.mange[0].annule).toBe(false);
    expect(r2.libelleBouton).toBe("1 repas");
  });

  it("deux recettes d'une même session sans repas : 1 repas", () => {
    const r = repasDeLArticle(
      { nom: "Crème", recetteIds: ["r1", "r2"] },
      [],
      [batch("b1", "2026-11-08", ["r1", "r2"])],
      recettes,
      AUJ,
    );
    expect(r.entrees).toHaveLength(2);
    expect(r.nombreRepas).toBe(1);
    expect(r.libelleBouton).toBe("1 repas");
  });

  it("batch plus un repas ordinaire de la même recette : 2 entrées", () => {
    const r = repasDeLArticle(
      article,
      [
        slot("a", "2026-11-10", "dej", ["r1"], { batchSessionId: "b1" }),
        slot("b", "2026-11-11", "diner", ["r1"]),
      ],
      [batch("b1", "2026-11-08", ["r1"])],
      recettes,
      AUJ,
    );
    expect(r.entrees.map((e) => e.type)).toEqual(["batch", "repas"]);
    expect(r.nombreRepas).toBe(2);
  });

  it("un repas rattaché à une session sans cette recette reste un repas ordinaire", () => {
    const r = repasDeLArticle(
      article,
      [slot("a", "2026-11-10", "dej", ["r1"], { batchSessionId: "b9" })],
      [batch("b9", "2026-11-08", ["r2"])],
      recettes,
      AUJ,
    );
    expect(r.entrees.map((e) => e.type)).toEqual(["repas"]);
  });

  it("tri sur le jour de cuisine du batch, puis petit-déjeuner, déjeuner, dîner", () => {
    const r = repasDeLArticle(
      article,
      [
        slot("a", "2026-11-12", "dej", ["r1"]),
        slot("c", "2026-11-14", "dej", ["r1"], { batchSessionId: "b1" }),
        slot("d", "2026-11-05", "diner", ["r1"]),
        slot("e", "2026-11-05", "petitDej", ["r1"]),
      ],
      [batch("b1", "2026-11-08", ["r1"])],
      recettes,
      AUJ,
    );
    expect(r.entrees.map((e) => e.type)).toEqual(["repas", "repas", "batch", "repas"]);
    expect(r.entrees.map((e) => (e.type === "batch" ? e.dateCuisine : e.type === "repas" ? e.date : ""))).toEqual([
      "2026-11-05",
      "2026-11-05",
      "2026-11-08",
      "2026-11-12",
    ]);
    const premier = r.entrees[0];
    expect(premier.type === "repas" && premier.repas).toBe("petitDej");
  });

  it("passe du batch vrai seulement si tous ses repas sont passés", () => {
    const b = [batch("b1", "2026-10-30", ["r1"])];
    const un = repasDeLArticle(
      article,
      [
        slot("a", "2026-11-01", "dej", ["r1"], { batchSessionId: "b1" }),
        slot("b", "2026-11-05", "dej", ["r1"], { batchSessionId: "b1" }),
      ],
      b,
      recettes,
      AUJ,
    );
    expect(un.entrees[0].type === "batch" && un.entrees[0].passe).toBe(false);
    const tous = repasDeLArticle(article, [slot("a", "2026-11-01", "dej", ["r1"], { batchSessionId: "b1" })], b, recettes, AUJ);
    expect(tous.entrees[0].type === "batch" && tous.entrees[0].passe).toBe(true);
    const sans = repasDeLArticle(article, [], b, recettes, AUJ);
    expect(sans.entrees[0].type === "batch" && sans.entrees[0].passe).toBe(true);
  });

  it("recette dans aucun repas : hors-menu, « Voir »", () => {
    const r = repasDeLArticle(article, [slot("a", "2026-11-05", "dej", ["r2"])], [], recettes, AUJ);
    expect(r.entrees).toHaveLength(1);
    expect(r.entrees[0]).toMatchObject({ type: "hors-menu", recetteId: "r1", nomRecette: "Gratin" });
    expect(r.nombreRepas).toBe(0);
    expect(r.libelleBouton).toBe("Voir");
  });

  it("hors-menu en dernier", () => {
    const r = repasDeLArticle(
      { nom: "Crème", recetteIds: ["r2", "r1"] },
      [slot("a", "2026-11-05", "dej", ["r1"])],
      [],
      recettes,
      AUJ,
    );
    expect(r.entrees.map((e) => e.type)).toEqual(["repas", "hors-menu"]);
    expect(r.libelleBouton).toBe("1 repas");
  });

  it("recette manquante dans recettes : entrée présente, quantite: null", () => {
    const r = repasDeLArticle(
      { nom: "Crème", recetteIds: ["rX"] },
      [slot("a", "2026-11-05", "dej", ["rX"])],
      [],
      recettes,
      AUJ,
    );
    expect(r.entrees).toHaveLength(1);
    const e = r.entrees[0];
    expect(e.type === "repas" && e.quantite).toBeNull();
    expect(e.type === "repas" && e.portions).toBe(4);
  });

  it("portions : recette pour 4, 2 présents, 200 g : 100 g", () => {
    const r = repasDeLArticle(
      article,
      [slot("a", "2026-11-05", "dej", ["r1"], { profilsPresents: ["x", "y"] })],
      [],
      recettes,
      AUJ,
    );
    const e = r.entrees[0];
    expect(e.type === "repas" && e.quantite).toBe("100 g");
    expect(e.type === "repas" && e.portions).toBe(2);
  });

  it("batch : quantité de la recette telle quelle", () => {
    const r = repasDeLArticle(article, [], [batch("b1", "2026-11-08", ["r1"])], recettes, AUJ);
    const e = r.entrees[0];
    expect(e.type === "batch" && e.quantite).toBe("200 g");
  });

  it("deux lignes au même nom : « 20 g + 30 g »", () => {
    const rec = { r1: recette("Gratin", 4, [ing("Crème", "20", "g"), ing("Crème", "30", "g")]) };
    const r = repasDeLArticle(
      article,
      [slot("a", "2026-11-05", "dej", ["r1"], { profilsPresents: ["a", "b", "c", "d"] })],
      [],
      rec,
      AUJ,
    );
    const e = r.entrees[0];
    expect(e.type === "repas" && e.quantite).toBe("20 g + 30 g");
  });

  it("aucune ligne ne correspond : quantite: null", () => {
    const rec = { r1: recette("Gratin", 4, [ing("Farine", "20", "g")]) };
    const r = repasDeLArticle(article, [slot("a", "2026-11-05", "dej", ["r1"])], [], rec, AUJ);
    const e = r.entrees[0];
    expect(e.type === "repas" && e.quantite).toBeNull();
  });

  it("slot sans date : date issue de debutPlanISO + jour", () => {
    const s = slot("a", "", "dej", ["r1"], { jour: 2 });
    delete s.date;
    const r = repasDeLArticle(article, [s], [], recettes, AUJ, "2026-10-31");
    const e = r.entrees[0];
    expect(e.type === "repas" && e.date).toBe("2026-11-02");
    expect(e.type === "repas" && e.passe).toBe(true);
  });
});

describe("titreEntreeBatch", () => {
  const entree = (mange: Array<{ date?: string; repas: Repas; annule: boolean }>) => ({
    type: "batch" as const,
    cle: "b",
    recetteId: "r",
    dateCuisine: "2026-11-08",
    mange,
    annule: false,
    passe: false,
    quantite: null,
    portions: 4,
  });

  it("dit le jour de cuisine et les jours où l'on mange", () => {
    expect(
      titreEntreeBatch(
        entree([
          { date: "2026-11-10", repas: "diner", annule: false },
          { date: "2026-11-12", repas: "dej", annule: false },
        ]),
      ),
    ).toBe("Cuisiné dimanche 8 · mangé mardi 10 et jeudi 12");
  });

  it("sans repas rattaché, ne dit que le jour de cuisine", () => {
    expect(titreEntreeBatch(entree([]))).toBe("Cuisiné dimanche 8");
  });

  it("midi et soir du même jour : le jour n'est dit qu'une fois", () => {
    expect(
      titreEntreeBatch(
        entree([
          { date: "2026-11-10", repas: "dej", annule: false },
          { date: "2026-11-10", repas: "diner", annule: false },
        ]),
      ),
    ).toBe("Cuisiné dimanche 8 · mangé mardi 10");
  });

  it("joursDuBatch : un jour n'est barré que si tous ses repas sont annulés", () => {
    expect(
      joursDuBatch(
        entree([
          { date: "2026-11-10", repas: "dej", annule: true },
          { date: "2026-11-10", repas: "diner", annule: false },
          { date: "2026-11-12", repas: "dej", annule: true },
          { date: "2026-11-12", repas: "diner", annule: true },
          { date: undefined, repas: "dej", annule: false },
        ]),
      ),
    ).toEqual([
      { libelle: "mardi 10", annule: false },
      { libelle: "jeudi 12", annule: true },
    ]);
  });
});

describe("quantité d'une ligne sans quantité", () => {
  const sansQuantite: Record<string, Recette | undefined> = {
    r1: recette("Gratin", 4, [ing("Crème", "20", "g"), ing("Crème", "", "")]),
    r2: recette("Soupe", 4, [ing("Crème", "", "")]),
    r3: recette("Quiche", 4, [ing("Crème", "20", "g"), ing("Crème", "5", "cl")]),
  };
  const une = (recetteId: string) =>
    repasDeLArticle({ nom: "Crème", recetteIds: [recetteId] }, [slot("a", "2026-11-05", "dej", [recetteId])], [], sansQuantite, AUJ)
      .entrees[0];

  it("une ligne sans quantité parmi d'autres : rien, pas « 20 g + »", () => {
    expect(une("r1")).toMatchObject({ type: "repas", quantite: null });
  });
  it("une seule ligne sans quantité : rien", () => {
    expect(une("r2")).toMatchObject({ type: "repas", quantite: null });
  });
  it("toutes les lignes ont une quantité : jointes par « + »", () => {
    expect(une("r3")).toMatchObject({ type: "repas", quantite: "20 g + 5 cl" });
  });
});

describe("repas illisibles (hors réseau, erreur)", () => {
  it("repasIndisponibles : plan sans repas lus ou lecture en erreur", () => {
    expect(repasIndisponibles({ planId: "p", chargement: false, erreur: false, nombreSlots: 0 })).toBe(true);
    expect(repasIndisponibles({ planId: "p", chargement: false, erreur: true, nombreSlots: 12 })).toBe(true);
    expect(repasIndisponibles({ planId: "p", chargement: false, erreur: false, nombreSlots: 12 })).toBe(false);
    expect(repasIndisponibles({ planId: "p", chargement: true, erreur: false, nombreSlots: 0 })).toBe(false);
    expect(repasIndisponibles({ planId: undefined, chargement: false, erreur: false, nombreSlots: 0 })).toBe(false);
  });

  it("indisponible : bouton « Voir », aucune entrée hors-menu, état signalé", () => {
    const r = repasDeLArticle(article, [], [], recettes, AUJ, undefined, { indisponible: true });
    expect(r.indisponible).toBe(true);
    expect(r.entrees).toEqual([]);
    expect(r.libelleBouton).toBe("Voir");
    expect(r.nombreRepas).toBe(0);
  });

  it("sans l'indicateur, des slots vides donnent toujours « hors-menu » (comportement inchangé)", () => {
    const r = repasDeLArticle(article, [], [], recettes, AUJ);
    expect(r.indisponible).toBe(false);
    expect(r.entrees[0]).toMatchObject({ type: "hors-menu" });
  });
});

describe("recetteIdsAChargerPourRepas", () => {
  it("réunit les recettes des repas, des batchs et des articles, sans doublon, triées", () => {
    expect(
      recetteIdsAChargerPourRepas(
        [{ recetteIds: ["b", "a"] }],
        [{ recetteIds: ["c"] }],
        [{ recetteIds: ["a", "d"] }, { recetteIds: [] }],
      ),
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("garde une recette liée à un article mais absente du menu (pour afficher son nom)", () => {
    expect(recetteIdsAChargerPourRepas([], [], [{ recetteIds: ["hors-menu"] }])).toEqual(["hors-menu"]);
  });

  it("sans articles, ne lit que les repas et les batchs", () => {
    expect(recetteIdsAChargerPourRepas([{ recetteIds: ["x"] }], [])).toEqual(["x"]);
  });
});
