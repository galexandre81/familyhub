import { describe, expect, it } from "vitest";
import { autresEcrans, choisirIpad, etatAppairage } from "./ipadCuisine";

const NOW = Date.UTC(2026, 9, 25, 18, 0);

describe("choisirIpad", () => {
  it("prend la tablette modifiée le plus récemment, jamais un téléphone ou un PC", () => {
    const ecrans = [
      { id: "tel", type: "mobile", updatedAt: new Date(NOW) },
      { id: "vieil-ipad", type: "ipad-mini-1", updatedAt: new Date(NOW - 10_000) },
      { id: "ipad", type: "ipad-mini-1", updatedAt: new Date(NOW - 1_000) },
      { id: "pc", type: "desktop", updatedAt: new Date(NOW) },
    ];
    expect(choisirIpad(ecrans)?.id).toBe("ipad");
    expect(autresEcrans(ecrans, choisirIpad(ecrans)).map((e) => e.id)).toEqual(["tel", "vieil-ipad", "pc"]);
  });
  it("aucune tablette : null, et tous les écrans sont « autres »", () => {
    const ecrans = [{ id: "tel", type: "mobile" }];
    expect(choisirIpad(ecrans)).toBeNull();
    expect(autresEcrans(ecrans, null)).toHaveLength(1);
  });
});

describe("etatAppairage", () => {
  it("jamais appairé : pas de jeton", () => {
    expect(etatAppairage({ id: "a", type: "ipad-mini-1", authToken: "" }, NOW)).toEqual({ etat: "jamais" });
  });
  it("appairé : jeton valable, avec sa date de fin", () => {
    expect(
      etatAppairage({ id: "a", type: "ipad-mini-1", authToken: "t", authTokenExpiresAt: new Date(NOW + 1000) }, NOW),
    ).toEqual({ etat: "appaire", jusquau: NOW + 1000 });
  });
  it("expiré : date de fin passée", () => {
    expect(
      etatAppairage({ id: "a", type: "ipad-mini-1", authToken: "t", authTokenExpiresAt: { seconds: NOW / 1000 - 60 } }, NOW),
    ).toEqual({ etat: "expire", depuis: NOW - 60_000 });
  });
});
