import { describe, it, expect } from "vitest";
import { pwaOptions } from "./pwaConfig";

function estExclue(chemin: string): boolean {
  const liste = pwaOptions.workbox?.navigateFallbackDenylist ?? [];
  return liste.some((motif) => motif.test(chemin));
}

describe("pwaOptions", () => {
  it("le service worker ne prend jamais la main sur l'écran de l'iPad ni sur la connexion", () => {
    expect(estExclue("/display/")).toBe(true);
    expect(estExclue("/display/index.html")).toBe(true);
    expect(estExclue("/display")).toBe(true);
    expect(estExclue("/d/ABC123")).toBe(true);
    expect(estExclue("/__/auth/handler")).toBe(true);
  });

  it("les pages du hub retombent sur l'application hors ligne", () => {
    expect(estExclue("/menu")).toBe(false);
    expect(estExclue("/displays")).toBe(false);
    expect(estExclue("/displays/abc")).toBe(false);
    expect(estExclue("/")).toBe(false);
    expect(pwaOptions.workbox?.navigateFallback).toBe("/index.html");
  });

  it("n'embarque pas l'app d'affichage dans le précache", () => {
    expect(pwaOptions.workbox?.globIgnores).toContain("display/**");
    expect(pwaOptions.workbox?.globPatterns).toEqual(["**/*.{js,css,html,woff,woff2,png,svg}"]);
  });

  it("décrit une application installable en français", () => {
    expect(pwaOptions.registerType).toBe("autoUpdate");
    const manifest = pwaOptions.manifest;
    if (!manifest) throw new Error("manifest absent");
    expect(manifest).toMatchObject({
      name: "Family Hub",
      short_name: "Family Hub",
      lang: "fr",
      start_url: "/",
      display: "standalone",
      background_color: "#0F1B2D",
      theme_color: "#EEF4EA",
    });
    const tailles = (manifest.icons ?? []).map((i) => i.sizes);
    expect(tailles).toEqual(["192x192", "512x512"]);
    expect(manifest.icons?.[1]?.purpose).toBe("any maskable");
  });
});
