import { describe, expect, it } from "vitest";
import { jetonsApresAjout } from "./firestore.js";
import { MAX_JETONS_PAR_PARENT } from "./schema.js";

describe("jetons d'un parent prévenu des demandes", () => {
  it("ajoute le nouveau jeton à la fin", () => {
    expect(jetonsApresAjout(["a"], "b")).toEqual(["a", "b"]);
  });

  it("le même téléphone réabonné ne compte qu'une fois, et devient le plus récent", () => {
    expect(jetonsApresAjout(["a", "b"], "a")).toEqual(["b", "a"]);
  });

  it("au-delà du plafond, le plus ancien est oublié", () => {
    const pleine = Array.from({ length: MAX_JETONS_PAR_PARENT }, (_, i) => `j${i}`);
    const apres = jetonsApresAjout(pleine, "neuf");
    expect(apres).toHaveLength(MAX_JETONS_PAR_PARENT);
    expect(apres[0]).toBe("j1");
    expect(apres.at(-1)).toBe("neuf");
  });
});
