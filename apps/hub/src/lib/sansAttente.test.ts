import { describe, it, expect, vi } from "vitest";
import { lancerSansAttendre } from "./sansAttente";

describe("lancerSansAttendre", () => {
  it("lance l'appel sans rendre de promesse", () => {
    const appel = vi.fn(() => Promise.resolve("ok"));
    expect(lancerSansAttendre(appel, "test")).toBeUndefined();
    expect(appel).toHaveBeenCalledTimes(1);
  });

  it("un échec asynchrone finit en avertissement console, jamais en erreur", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    lancerSansAttendre(() => Promise.reject(new Error("réseau")), "écrans");
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("écrans");
    warn.mockRestore();
  });

  it("une exception synchrone est aussi avalée", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      lancerSansAttendre(() => {
        throw new Error("boum");
      }, "écrans"),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
