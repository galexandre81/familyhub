import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderDisplayCss } from "./displayCss.js";

describe("displayCss", () => {
  it("ambiance.css de l'iPad à jour", () => {
    const fichier = resolve(__dirname, "../../../apps/display/public/css/ambiance.css");
    const lu = readFileSync(fichier, "utf8").replace(/\r\n/g, "\n");
    expect(lu).toBe(renderDisplayCss());
  });
  it("n'utilise ni var( ni gap ni grid (Safari 9)", () => {
    const css = renderDisplayCss();
    expect(css).not.toContain("var(");
    expect(css).not.toMatch(/\bgap\s*:/);
    expect(css).not.toMatch(/display\s*:\s*(inline-)?grid/);
  });
  it("définit les classes utilitaires pour jour et nuit", () => {
    const css = renderDisplayCss();
    for (const amb of ["amb-jour", "amb-nuit"]) {
      for (const c of [".fh-fond", ".fh-carte", ".fh-texte", ".fh-texte-doux", ".fh-action", ".fh-maintenant", ".fh-bordure", ".fh-p-sapin", ".fh-p-toleRouge", ".fh-p-lilas", ".fh-p-miel", ".fh-p-ardoise", ".fh-p-texte"]) {
        expect(css).toContain(`html.${amb} ${c} {`);
      }
    }
    expect(css).toContain("html.amb-jour .fh-action { background: #2D56C8; color: #FFFFFF; }");
    expect(css).toContain("html.amb-nuit .fh-action { background: #FFB547; color: #0F1B2D; }");
    expect(css).toContain("html.amb-jour .fh-maintenant { background: #F5C242; color: #1E2B22; }");
    expect(css).toContain('.fh-titre { font-family: "Bricolage Grotesque"');
    expect(css).toContain('.fh-corps { font-family: "Atkinson Hyperlegible"');
  });
});
