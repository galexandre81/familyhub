import { describe, expect, it } from "vitest";
import type { DisplayLayoutEntry } from "@family-hub/types";
import { TYPES_TABLEAU, layoutCuisine, typesPresents } from "./ecranCuisine";

const pos = (col: number, row = 0) => ({ col, row, w: 1, h: 1 });
const toutes = TYPES_TABLEAU.map((type) => ({ id: `t-${type}`, type }));

describe("layoutCuisine", () => {
  it("demande la création des types sans tuile quand le layout est vide", () => {
    const r = layoutCuisine([], []);
    expect(r.layout).toEqual([]);
    expect(r.aCreer).toEqual([...TYPES_TABLEAU]);
    expect(r.retirees).toEqual([]);
  });

  it("ajoute au layout les tuiles existantes manquantes", () => {
    const r = layoutCuisine([], toutes);
    expect(r.aCreer).toEqual([]);
    expect(r.layout.map((e) => e.tileId).sort()).toEqual(toutes.map((t) => t.id).sort());
  });

  it("retire la liste de courses et l'horloge, garde le reste", () => {
    const tuiles = [...toutes, { id: "courses", type: "shopping-list" }, { id: "h", type: "clock" }, { id: "x", type: "autre" }];
    const actuel: DisplayLayoutEntry[] = [
      { tileId: "courses", position: pos(0) },
      { tileId: "h", position: pos(1) },
      { tileId: "x", position: pos(2) },
      { tileId: "t-weather", position: pos(3) },
    ];
    const r = layoutCuisine(actuel, tuiles);
    expect(r.retirees.sort()).toEqual(["courses", "h"]);
    const ids = r.layout.map((e) => e.tileId);
    expect(ids).not.toContain("courses");
    expect(ids).not.toContain("h");
    expect(ids).toContain("x");
    expect(r.layout.find((e) => e.tileId === "t-weather")!.position).toEqual(pos(3));
  });

  it("donne des positions uniques", () => {
    const r = layoutCuisine([{ tileId: "t-radio", position: pos(0) }], toutes);
    const cles = r.layout.map((e) => `${e.position.col},${e.position.row}`);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it("est idempotent", () => {
    const un = layoutCuisine([], toutes);
    const deux = layoutCuisine(un.layout, toutes);
    expect(deux.layout).toEqual(un.layout);
    expect(deux.aCreer).toEqual([]);
    expect(deux.retirees).toEqual([]);
  });

  it("typesPresents indique les types déjà dans le layout", () => {
    const p = typesPresents([{ tileId: "t-radio", position: pos(0) }], toutes);
    expect(p.has("radio")).toBe(true);
    expect(p.has("weather")).toBe(false);
  });
});
