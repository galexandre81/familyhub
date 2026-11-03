/**
 * Remplacements de la semaine sur l'iPad (apps/display/public/js/
 * remplacements.js, ES5) : le fichier livré est exécuté tel quel dans un
 * contexte vm ; ses fonctions pures sont comparées à celles du hub
 * (apps/hub/src/lib/remplacements.ts). Le code DOM n'est jamais appelé ici.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  carteRemplacements as carteTs,
  cleIngredient as cleTs,
  debutRemplacement as debutTs,
  planIdsEnCours as planIdsTs,
  indicesIngredient as indicesTs,
  remplacementsDeRecette as deRecetteTs,
  semaineEnCours as semaineTs,
  texteRappel as rappelTs,
  type RemplacementActif,
} from "../../../apps/hub/src/lib/remplacements";

interface Ing {
  libelle: string;
}
interface Plan {
  planId: string;
  dateDebutISO: string;
  dateFinISO: string;
  batchSessions?: Array<{ date: string }>;
}
interface ApiRemplacements {
  cleIngredientEs5(nom: string): string;
  indicesIngredientEs5(nom: string, ings: Ing[]): number[];
  carteRemplacementsEs5(ings: Ing[], actifs: RemplacementActif[]): Record<string, string>;
  remplacementsDeRecetteEs5(actifs: RemplacementActif[], recetteId: string): RemplacementActif[];
  semaineEnCoursEs5(debut: string | undefined, fin: string | undefined, aujourdhui: string): boolean;
  plansEnCoursEs5(plans: Plan[] | undefined, aujourdhui: string): Plan[];
  debutRemplacementEs5(debut: string | undefined, datesBatch: string[]): string | undefined;
  texteRappelEs5(a: RemplacementActif): string;
  dateISOLocaleEs5(d: Date): string;
  lire(): Promise<RemplacementActif[]>;
}

const SOURCE = readFileSync(
  fileURLToPath(new URL("../../../apps/display/public/js/remplacements.js", import.meta.url)),
  "utf8",
);

function charger(extra: Record<string, unknown> = {}): ApiRemplacements {
  const window: Record<string, unknown> = { ...extra };
  runInNewContext(SOURCE, { window });
  if (!window.FamilyHubRemplacements) throw new Error("window.FamilyHubRemplacements absent");
  return window.FamilyHubRemplacements as ApiRemplacements;
}

const r = charger();

const NOMS = [
  "Crème (fraîche), « épaisse »",
  "Œufs",
  "ŒUFS Bio",
  "Cœur de palmier",
  "Sœur Æther",
  "gousses d'ail",
  "Noix",
  "os",
  "Ça  Été   À la façon d'Ïle Ôtée",
  "Pâtes  Ñoquis Ünü Ýaourt Ÿ",
  "Épinards-poireaux / navets – choux — kale",
  "Riz, haricots & maïs: élan; ?!",
  "Crème brûlée Où Çà Ûn",
  "ÀÁÂÃÄÅ àáâãäå ÈÉÊË èéêë ÌÍÎÏ ìíîï ÒÓÔÕÖ òóôõö ÙÚÛÜ ùúûü ÇçÑñÝýÿ",
  "",
  "   ",
];

describe("chargement", () => {
  it("expose window.FamilyHubRemplacements et module.exports", () => {
    expect(typeof r.lire).toBe("function");
    const module: { exports: Partial<ApiRemplacements> } = { exports: {} };
    runInNewContext(SOURCE, { module });
    expect(typeof module.exports.cleIngredientEs5).toBe("function");
  });
  it("reste ES5 : ni normalize( ni flèche", () => {
    expect(SOURCE).not.toContain("normalize(");
    expect(SOURCE).not.toContain("=>");
  });
});

describe("cleIngredientEs5 : parité avec le hub", () => {
  it.each(NOMS)("%s", (nom) => {
    expect(r.cleIngredientEs5(nom)).toEqual(cleTs(nom));
  });
});

describe("indicesIngredientEs5 : parité avec le hub", () => {
  const recette: Ing[] = [
    { libelle: "Crème fraîche" },
    { libelle: "oignon jaune" },
    { libelle: "Œufs" },
    { libelle: "Beurre" },
    { libelle: "beurre" },
    { libelle: "crème liquide" },
    { libelle: "gousse d'ail" },
    { libelle: "Riz" },
  ];
  const articles = ["Crème", "oignons jaunes", "oignon", "oeuf", "ŒUFS", "beurre", "Beurre", "ail", "gousses d'ail", "poulet", "riz", "", "Cœur"];
  it.each(articles)("article %s", (nom) => {
    expect(r.indicesIngredientEs5(nom, recette)).toEqual(indicesTs(nom, recette));
  });
  it("liste vide", () => {
    expect(r.indicesIngredientEs5("riz", [])).toEqual([]);
  });
});

describe("carteRemplacementsEs5 et remplacementsDeRecetteEs5", () => {
  const actifs: RemplacementActif[] = [
    { nomArticle: "Beurre", remplacement: "margarine", recetteIds: ["r1", "r2"] },
    { nomArticle: "Beurre", remplacement: "huile", recetteIds: ["r1"] },
    { nomArticle: "Crème", remplacement: "yaourt", recetteIds: ["r2"] },
    { nomArticle: "Œufs", remplacement: "compote", recetteIds: ["r1"] },
  ];
  const ings: Ing[] = [{ libelle: "beurre" }, { libelle: "Beurre" }, { libelle: "oeuf" }, { libelle: "sel" }];
  it("même carte que le hub, le premier actif gagne", () => {
    const es5 = r.carteRemplacementsEs5(ings, actifs);
    expect(es5).toEqual(Object.fromEntries(carteTs(ings, actifs)));
    expect(es5.beurre).toBe("margarine");
  });
  it("un libellé comme « constructor » ou « toString » fonctionne", () => {
    const a: RemplacementActif[] = [
      { nomArticle: "constructor", remplacement: "x", recetteIds: ["r"] },
      { nomArticle: "toString", remplacement: "y", recetteIds: ["r"] },
    ];
    const libelles = [{ libelle: "constructor" }, { libelle: "toString" }, { libelle: "valueOf" }];
    const carte = r.carteRemplacementsEs5(libelles, a);
    expect(Object.prototype.hasOwnProperty.call(carte, "constructor")).toBe(true);
    expect(carte["constructor"]).toBe("x");
    expect(carte["toString"]).toBe("y");
    expect(Object.prototype.hasOwnProperty.call(carte, "valueOf")).toBe(false);
  });
  it("deux plans en cours qui disent la même chose : un seul rappel, comme le hub", () => {
    const doubles: RemplacementActif[] = [
      { nomArticle: "Crème", remplacement: "yaourt", recetteIds: ["r1"] },
      { nomArticle: "crème", remplacement: "Yaourt ", recetteIds: ["r1"] },
      { nomArticle: "Crème", remplacement: "skyr", recetteIds: ["r1"] },
    ];
    expect(r.remplacementsDeRecetteEs5(doubles, "r1")).toEqual(deRecetteTs(doubles, "r1"));
    expect(r.remplacementsDeRecetteEs5(doubles, "r1")).toEqual([doubles[0], doubles[2]]);
  });
  it("filtre par recette comme le hub", () => {
    expect(r.remplacementsDeRecetteEs5(actifs, "r2")).toEqual(deRecetteTs(actifs, "r2"));
    expect(r.remplacementsDeRecetteEs5(actifs, "zz")).toEqual([]);
    const sansIds = [{ nomArticle: "a", remplacement: "b" }] as unknown as RemplacementActif[];
    expect(r.remplacementsDeRecetteEs5(sansIds, "r1")).toEqual([]);
  });
});

describe("texteRappelEs5", () => {
  it("même texte que le hub", () => {
    const a = { nomArticle: "Crème", remplacement: "yaourt", recetteIds: [] };
    expect(r.texteRappelEs5(a)).toBe(rappelTs(a));
    expect(r.texteRappelEs5(a)).toBe("Cette semaine : yaourt à la place de Crème");
  });
});

describe("semaineEnCoursEs5", () => {
  const cas: Array<[string | undefined, string | undefined, string]> = [
    ["2026-11-02", "2026-11-08", "2026-11-02"],
    ["2026-11-02", "2026-11-08", "2026-11-08"],
    ["2026-11-02", "2026-11-08", "2026-11-01"],
    ["2026-11-02", "2026-11-08", "2026-11-09"],
    ["2026-11-02", "2026-11-08", "2026-11-05"],
    [undefined, "2026-11-08", "2026-11-05"],
    ["2026-11-02", undefined, "2026-11-05"],
    ["", "", "2026-11-05"],
  ];
  it.each(cas)("%s → %s à %s", (d, f, a) => {
    expect(r.semaineEnCoursEs5(d, f, a)).toBe(semaineTs(d, f, a));
  });
});

describe("plansEnCoursEs5", () => {
  const plans: Plan[] = [
    { planId: "actif-fini", dateDebutISO: "2026-10-19", dateFinISO: "2026-10-25" },
    { planId: "archive-courant", dateDebutISO: "2026-11-02", dateFinISO: "2026-11-08" },
    { planId: "actif-futur", dateDebutISO: "2026-11-09", dateFinISO: "2026-11-15" },
    { planId: "sans-dates", dateDebutISO: "", dateFinISO: "" },
  ];
  it("garde le plan dont la semaine court, même archivé, écarte fini et futur", () => {
    const ids = r.plansEnCoursEs5(plans, "2026-11-04").map((p) => p.planId);
    expect(ids).toEqual(["archive-courant"]);
  });
  it("bornes comprises, plusieurs plans possibles", () => {
    const deux = plans.concat([{ planId: "chevauche", dateDebutISO: "2026-11-08", dateFinISO: "2026-11-14" }]);
    expect(r.plansEnCoursEs5(deux, "2026-11-08").map((p) => p.planId)).toEqual(["archive-courant", "chevauche"]);
  });
  it("entrée absente ou vide : liste vide", () => {
    expect(r.plansEnCoursEs5(undefined, "2026-11-04")).toEqual([]);
    expect(r.plansEnCoursEs5([], "2026-11-04")).toEqual([]);
  });
});

/* Mêmes cas que « debutRemplacement : le batch de la veille compte » du hub. */
describe("debutRemplacementEs5 : parité avec le hub", () => {
  const cas: Array<[string | undefined, string[], string | undefined]> = [
    ["2026-11-02", ["2026-11-01"], "2026-11-01"],
    ["2026-11-02", [], "2026-11-02"],
    ["2026-11-02", ["2026-11-04", "2026-11-06"], "2026-11-02"],
    ["2026-11-02", ["", "2026-10-31", "2026-11-01"], "2026-10-31"],
    [undefined, ["2026-11-01"], undefined],
  ];
  it.each(cas)("%s + %j", (debut, batchs, attendu) => {
    expect(r.debutRemplacementEs5(debut, batchs)).toBe(attendu);
    expect(debutTs(debut, batchs)).toBe(attendu);
  });
});

describe("plansEnCoursEs5 avec les batchs du snapshot", () => {
  const plans: Plan[] = [
    { planId: "courant", dateDebutISO: "2026-11-02", dateFinISO: "2026-11-08" },
    { planId: "suivant", dateDebutISO: "2026-11-09", dateFinISO: "2026-11-15", batchSessions: [{ date: "2026-11-08" }] },
    { planId: "sans-batch", dateDebutISO: "2026-11-09", dateFinISO: "2026-11-15", batchSessions: [] },
  ];
  const cas: Array<[string, string[]]> = [
    ["2026-11-08", ["courant", "suivant"]],
    ["2026-11-07", ["courant"]],
    ["2026-11-09", ["suivant", "sans-batch"]],
  ];
  it.each(cas)("le %s", (jour, attendus) => {
    expect(r.plansEnCoursEs5(plans, jour).map((p) => p.planId)).toEqual(attendus);
    const hub = planIdsTs(
      plans.map((p) => ({ id: p.planId, debutISO: p.dateDebutISO, finISO: p.dateFinISO })),
      Object.fromEntries(plans.map((p) => [p.planId, (p.batchSessions ?? []).map((b) => b.date)])),
      jour,
    );
    expect(hub).toEqual([...attendus].sort());
  });
});

describe("dateISOLocaleEs5", () => {
  it("jour civil local, mois et jour sur deux chiffres", () => {
    expect(r.dateISOLocaleEs5(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(r.dateISOLocaleEs5(new Date(2026, 10, 8, 0, 1))).toBe("2026-11-08");
    expect(r.dateISOLocaleEs5(new Date(2026, 11, 31, 12, 0))).toBe("2026-12-31");
  });
});

describe("lire()", () => {
  it("résout [] sans FamilyHubGetDb", async () => {
    expect(await r.lire()).toEqual([]);
  });
  it("résout [] sans snapshot", async () => {
    const api = charger({
      FamilyHubGetDb: () => ({}),
      FamilyHubGetHouseholdId: () => "h",
      FamilyHubGetTileSnapshotByType: () => null,
    });
    expect(await api.lire()).toEqual([]);
  });
  it("résout [] si la lecture lève", async () => {
    const api = charger({
      FamilyHubGetDb: () => {
        throw new Error("boum");
      },
      FamilyHubGetHouseholdId: () => "h",
      FamilyHubGetTileSnapshotByType: () => ({ plans: [{ planId: "P", dateDebutISO: "2000-01-01", dateFinISO: "2999-01-01" }] }),
    });
    expect(await api.lire()).toEqual([]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const plansEnCours = { plans: [{ planId: "P", dateDebutISO: "2000-01-01", dateFinISO: "2999-01-01" }] };
  const dbQuiNeRepondJamais = () => ({
    collection: () => ({
      doc: () => ({
        collection: () => ({ where: () => ({ get: () => new Promise(() => undefined) }) }),
      }),
    }),
  });
  it("résout [] si la lecture ne répond jamais : seulement après 20 s, pas avant", async () => {
    vi.useFakeTimers();
    const api = charger({
      FamilyHubGetDb: dbQuiNeRepondJamais,
      FamilyHubGetHouseholdId: () => "h",
      FamilyHubGetTileSnapshotByType: () => plansEnCours,
      setTimeout: (f: () => void, ms: number) => globalThis.setTimeout(f, ms),
      clearTimeout: (id: unknown) => globalThis.clearTimeout(id as number),
    });
    let fini = false;
    const p = api.lire().then((v) => {
      fini = true;
      return v;
    });
    await vi.advanceTimersByTimeAsync(19_999);
    expect(fini).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(fini).toBe(true);
    expect(await p).toEqual([]);
  });
  it("une réponse à 10 s est bien rendue, avec les articles (plus de coupure à 3 s)", async () => {
    vi.useFakeTimers();
    const articles = [{ data: () => ({ nom: "Crème", remplacement: "yaourt", recetteIds: ["r1"] }) }];
    const lente = <T,>(valeur: T) =>
      new Promise<T>((resolve) => {
        globalThis.setTimeout(() => resolve(valeur), 10_000);
      });
    const db = {
      collection: () => ({
        doc: () => ({
          collection: () => ({
            where: () => ({ get: () => lente({ docs: [{ id: "L1" }] }) }),
            doc: () => ({ collection: () => ({ get: () => Promise.resolve({ docs: articles }) }) }),
          }),
        }),
      }),
    };
    const api = charger({
      FamilyHubGetDb: () => db,
      FamilyHubGetHouseholdId: () => "h",
      FamilyHubGetTileSnapshotByType: () => plansEnCours,
      setTimeout: (f: () => void, ms: number) => globalThis.setTimeout(f, ms),
      clearTimeout: (id: unknown) => globalThis.clearTimeout(id as number),
    });
    const p = api.lire();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await p).toEqual([{ nomArticle: "Crème", remplacement: "yaourt", recetteIds: ["r1"] }]);
  });
  it("après une réponse rapide, la minuterie est annulée et ne rien résoudre de plus", async () => {
    const posees: unknown[] = [];
    const annulees: unknown[] = [];
    const api = charger({
      FamilyHubGetDb: () => ({
        collection: () => ({
          doc: () => ({
            collection: () => ({
              where: () => ({ get: () => Promise.resolve({ docs: [] }) }),
            }),
          }),
        }),
      }),
      FamilyHubGetHouseholdId: () => "h",
      FamilyHubGetTileSnapshotByType: () => plansEnCours,
      setTimeout: (_f: () => void, ms: number) => {
        posees.push(ms);
        return 42;
      },
      clearTimeout: (id: unknown) => {
        annulees.push(id);
      },
    });
    expect(await api.lire()).toEqual([]);
    expect(posees).toEqual([20000]);
    expect(annulees).toEqual([42]);
  });
  it("lit les articles des listes du plan en cours et ne garde que les remplacements", async () => {
    const demandes: string[] = [];
    const articles = [
      { data: () => ({ nom: "Crème", remplacement: "yaourt", recetteIds: ["r1"] }) },
      { data: () => ({ nom: "Sel", recetteIds: ["r1"] }) },
      { data: () => ({ nom: "Riz", remplacement: "", recetteIds: ["r1"] }) },
      { data: () => ({ nom: "Pain", remplacement: "brioche" }) },
    ];
    const listes = {
      where: (champ: string, op: string, id: string) => ({
        get: () => {
          demandes.push(`${champ} ${op} ${id}`);
          return Promise.resolve({ docs: [{ id: "L1" }] });
        },
      }),
      doc: (id: string) => ({
        collection: (nom: string) => ({
          get: () => {
            demandes.push(`${id}/${nom}`);
            return Promise.resolve({ docs: articles });
          },
        }),
      }),
    };
    const db = { collection: () => ({ doc: () => ({ collection: () => listes }) }) };
    const api = charger({
      FamilyHubGetDb: () => db,
      FamilyHubGetHouseholdId: () => "h",
      FamilyHubGetTileSnapshotByType: () => ({
        plans: [
          { planId: "P1", dateDebutISO: "2000-01-01", dateFinISO: "2999-12-31" },
          { planId: "P0", dateDebutISO: "2020-01-01", dateFinISO: "2020-01-07" },
        ],
      }),
    });
    const actifs = await api.lire();
    expect(demandes).toEqual(["planId == P1", "L1/items"]);
    expect(actifs).toEqual([
      { nomArticle: "Crème", remplacement: "yaourt", recetteIds: ["r1"] },
      { nomArticle: "Pain", remplacement: "brioche", recetteIds: [] },
    ]);
  });
});
