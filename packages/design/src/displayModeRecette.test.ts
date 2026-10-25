/**
 * Mode recette de l'iPad (apps/display/public/js/mode-recette.js, ES5) : le
 * fichier livré est exécuté tel quel dans un contexte vm (window, puis
 * CommonJS) ; ses fonctions pures sont comparées à celles du hub
 * (apps/hub/src/lib/repasCuisine.ts, import relatif : aucune dépendance
 * ajoutée au paquet design). Le code DOM n'est jamais appelé ici.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  assemblerRepas as assemblerRepasTs,
  etapesTriees as etapesTrieesTs,
  libelleEtape as libelleEtapeTs,
  quantiteAjustee as quantiteAjusteeTs,
} from "../../../apps/hub/src/lib/repasCuisine";

interface Etape {
  ordre: number;
  description: string;
  dureeMinutes?: number;
}
interface ApiModeRecette {
  assemblerRepasEs5(
    ids: string[],
    recettes: Record<string, unknown>,
  ): { presentes: Array<{ id: string; recette: unknown }>; manquantes: string[] };
  quantiteAjusteeEs5(q: unknown, base: number, portions: number): string;
  libelleEtapeEs5(description: string): string;
  etapesTrieesEs5(etapes: Etape[] | undefined): Etape[];
  portionsInitialesEs5(portions: unknown, recettes: Array<{ portions?: unknown }>): number;
  repasOrdonneEs5(ids: string[], recettes: Record<string, unknown>): Array<{ id: string; recette: unknown }>;
}

const SOURCE = readFileSync(
  fileURLToPath(new URL("../../../apps/display/public/js/mode-recette.js", import.meta.url)),
  "utf8",
);

function chargerCommeSafari(): ApiModeRecette {
  const window: { FamilyHubModeRecette?: ApiModeRecette } = {};
  runInNewContext(SOURCE, { window });
  if (!window.FamilyHubModeRecette) throw new Error("window.FamilyHubModeRecette absent");
  return window.FamilyHubModeRecette;
}

const m = chargerCommeSafari();

describe("mode-recette.js (iPad) — chargement", () => {
  it("expose window.FamilyHubModeRecette (ouvrir/fermer) et module.exports", () => {
    const w = m as unknown as { ouvrir: unknown; fermer: unknown; estOuvert: unknown };
    expect(typeof w.ouvrir).toBe("function");
    expect(typeof w.fermer).toBe("function");
    expect(typeof w.estOuvert).toBe("function");
    const module: { exports: Partial<ApiModeRecette> } = { exports: {} };
    runInNewContext(SOURCE, { module });
    expect(typeof module.exports.quantiteAjusteeEs5).toBe("function");
  });
});

describe("quantiteAjusteeEs5 — parité avec le hub", () => {
  it("valeurs du brief", () => {
    expect(m.quantiteAjusteeEs5("1/2", 2, 4)).toBe("1");
    expect(m.quantiteAjusteeEs5("1,5", 4, 6)).toBe("2,3");
    expect(m.quantiteAjusteeEs5("qsp", 4, 6)).toBe("qsp");
    expect(m.quantiteAjusteeEs5(200, 4, 2)).toBe("100");
  });
  it("même résultat que quantiteAjustee pour un jeu de cas", () => {
    const cas: Array<[unknown, number, number]> = [
      ["200", 4, 6], ["0.5", 2, 3], ["2 gousses", 4, 2], ["1 / 3", 3, 4], ["1/0", 2, 4],
      ["", 4, 6], ["  ", 4, 6], [null, 4, 6], [undefined, 4, 6], [3, 4, 5], ["1,25 kg", 4, 8],
      ["200", 0, 6], ["200", 4, 0], ["200", NaN, 6], ["une pincée", 4, 8], ["10", 3, 1],
      ["7", 4, 4], ["1.05", 1, 1], ["2\ngousses", 4, 8],
    ];
    for (const [q, base, p] of cas) {
      expect(m.quantiteAjusteeEs5(q, base, p), JSON.stringify([q, base, p])).toBe(
        quantiteAjusteeTs(q as string, base, p),
      );
    }
  });
});

describe("assemblerRepasEs5 — parité avec le hub", () => {
  it("ordre du slot (plat d'abord), doublons ignorés, manquantes listées", () => {
    const recettes = { a: { nom: "Plat" }, c: { nom: "Dessert" } };
    const ids = ["a", "b", "a", "c"];
    const res = m.assemblerRepasEs5(ids, recettes);
    expect(res).toEqual(assemblerRepasTs(ids, recettes as never));
    expect(res.presentes.map((x) => x.id)).toEqual(["a", "c"]);
    expect(res.manquantes).toEqual(["b"]);
  });
  it("liste vide ou absente", () => {
    expect(m.assemblerRepasEs5([], {})).toEqual({ presentes: [], manquantes: [] });
    expect(m.assemblerRepasEs5(undefined as never, {})).toEqual({ presentes: [], manquantes: [] });
  });
});

describe("libelleEtapeEs5 / etapesTrieesEs5 — parité avec le hub", () => {
  it("début de l'étape, 30 caractères au plus", () => {
    const textes = [
      "Faire bouillir l'eau",
      "  Faire   revenir les oignons\n dans le beurre jusqu'à ce qu'ils soient dorés ",
      "123456789012345678901234567890",
      "1234567890123456789012345678 01",
    ];
    for (const t of textes) expect(m.libelleEtapeEs5(t)).toBe(libelleEtapeTs(t));
  });
  it("tri par ordre sans modifier l'entrée", () => {
    const etapes = [{ ordre: 2, description: "b" }, { ordre: 1, description: "a" }];
    expect(m.etapesTrieesEs5(etapes)).toEqual(etapesTrieesTs(etapes));
    expect(etapes[0].ordre).toBe(2);
    expect(m.etapesTrieesEs5(undefined)).toEqual([]);
  });
});

describe("repasOrdonneEs5", () => {
  it("garde chaque recette à sa place, manquantes comprises (recette null), sans doublon", () => {
    const a = { nom: "Plat" };
    const c = { nom: "Dessert" };
    expect(m.repasOrdonneEs5(["a", "b", "a", "c"], { a, c })).toEqual([
      { id: "a", recette: a },
      { id: "b", recette: null },
      { id: "c", recette: c },
    ]);
    expect(m.repasOrdonneEs5(undefined as never, {})).toEqual([]);
  });
});

describe("portionsInitialesEs5", () => {
  it("portions de l'appelant, sinon celles de la première recette, sinon 4", () => {
    expect(m.portionsInitialesEs5(6, [{ portions: 2 }])).toBe(6);
    expect(m.portionsInitialesEs5(undefined, [{ portions: 2 }, { portions: 8 }])).toBe(2);
    expect(m.portionsInitialesEs5(0, [{ portions: "3" }])).toBe(3);
    expect(m.portionsInitialesEs5(undefined, [])).toBe(4);
    expect(m.portionsInitialesEs5(2.6, [])).toBe(3);
  });
});

describe("issueLectureEs5 / libelleIndispoEs5 — lecture d'une recette", () => {
  const api = m as ApiModeRecette & {
    issueLectureEs5(
      issue: "trouve" | "absent" | "erreur" | "delai",
      donnees: unknown,
      copie: unknown,
      horsLigne: boolean,
    ): { recette: unknown; motif: null | "introuvable" | "hors-reseau" };
    libelleIndispoEs5(motif: string | null, nom: string): string;
  };
  const doc = { nom: "Gratin" };
  const copie = { nom: "Gratin (copie)" };

  it("doc lu → la recette", () => {
    expect(api.issueLectureEs5("trouve", doc, copie, false)).toEqual({ recette: doc, motif: null });
  });
  it("doc absent → introuvable, même avec une copie", () => {
    expect(api.issueLectureEs5("absent", null, copie, false)).toEqual({ recette: null, motif: "introuvable" });
  });
  it("délai ou erreur avec copie → la copie", () => {
    expect(api.issueLectureEs5("delai", null, copie, true)).toEqual({ recette: copie, motif: null });
    expect(api.issueLectureEs5("erreur", null, copie, false)).toEqual({ recette: copie, motif: null });
  });
  it("délai sans copie → hors-reseau (on n'attend pas sans fin)", () => {
    expect(api.issueLectureEs5("delai", null, null, true)).toEqual({ recette: null, motif: "hors-reseau" });
  });
  it("erreur hors ligne sans copie → hors-reseau ; erreur en ligne → introuvable", () => {
    expect(api.issueLectureEs5("erreur", null, null, true).motif).toBe("hors-reseau");
    expect(api.issueLectureEs5("erreur", null, null, false).motif).toBe("introuvable");
  });
  it("libellés", () => {
    expect(api.libelleIndispoEs5("hors-reseau", "")).toBe("Recette indisponible sans réseau");
    expect(api.libelleIndispoEs5("introuvable", "Gratin")).toBe("Recette indisponible : Gratin");
    expect(api.libelleIndispoEs5(null, "")).toBe("Recette indisponible");
  });
});
