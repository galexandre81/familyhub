import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderHubCss } from "./hubCss.js";

describe("hubCss", () => {
  it("ambiance.css à jour", () => {
    const fichier = resolve(__dirname, "../../../apps/hub/src/styles/ambiance.css");
    expect(readFileSync(fichier, "utf8")).toBe(renderHubCss());
  });
  it("définit les variables existantes et personnes pour jour et nuit", () => {
    const css = renderHubCss();
    expect(css).toContain("html.amb-jour {");
    expect(css).toContain("html.amb-nuit {");
    expect(css).toContain("--c-ebony: 15 27 45;");
    expect(css).toContain("--c-p-toleRouge: 242 131 106;");
    expect(css).toContain("--c-p-sapin: 43 122 75;");
  });
});
