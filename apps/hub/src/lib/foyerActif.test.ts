import { describe, expect, it } from "vitest";
import { ordonnerFoyers } from "./foyerActif";

const f = (id: string) => ({ id });

describe("ordonnerFoyers", () => {
  it("met le foyer par défaut en tête quand le compte en est membre", () => {
    expect(ordonnerFoyers([f("a"), f("b"), f("c")], "b").map((x) => x.id)).toEqual(["b", "a", "c"]);
  });
  it("garde l'ordre si le foyer par défaut n'est pas parmi les foyers du compte", () => {
    expect(ordonnerFoyers([f("a"), f("b")], "z").map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("garde l'ordre sans foyer par défaut", () => {
    expect(ordonnerFoyers([f("a"), f("b")], undefined).map((x) => x.id)).toEqual(["a", "b"]);
    expect(ordonnerFoyers([], "a")).toEqual([]);
  });
  it("déjà en tête : inchangé", () => {
    expect(ordonnerFoyers([f("a"), f("b")], "a").map((x) => x.id)).toEqual(["a", "b"]);
  });
});
