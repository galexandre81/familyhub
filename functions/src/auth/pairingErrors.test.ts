import { describe, it, expect } from "vitest";
import { erreurAppairage, RAISONS_APPAIRAGE } from "./pairingErrors";

describe("erreurAppairage", () => {
  it("couvre exactement les quatre raisons définitives", () => {
    expect([...RAISONS_APPAIRAGE].sort()).toEqual(
      ["deleted", "expired", "revoked", "token-mismatch"],
    );
  });

  it("écran supprimé → not-found", () => {
    expect(erreurAppairage("deleted")).toMatchObject({ code: "not-found", reason: "deleted" });
  });

  it("révoqué et token remplacé → permission-denied", () => {
    expect(erreurAppairage("revoked").code).toBe("permission-denied");
    expect(erreurAppairage("token-mismatch").code).toBe("permission-denied");
  });

  it("expiré → failed-precondition, jamais deadline-exceeded (code produit par le SDK sur timeout réseau)", () => {
    expect(erreurAppairage("expired").code).toBe("failed-precondition");
    for (const r of RAISONS_APPAIRAGE) {
      expect(erreurAppairage(r).code).not.toBe("deadline-exceeded");
    }
  });

  it("chaque raison a un message non vide", () => {
    for (const r of RAISONS_APPAIRAGE) {
      expect(erreurAppairage(r).message.length).toBeGreaterThan(0);
    }
  });
});
