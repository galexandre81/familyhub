/**
 * iPad (iOS 9) : les boutons ont un span intérieur (pas de flex sur
 * <button>). Un écouteur posé sur ce span ne répond qu'au centre du bouton :
 * vérifie qu'aucun fichier n'attache un écouteur à un élément « *-dedans ».
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const JS = resolve(__dirname, "../../../apps/display/public/js");

function fichiers(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? fichiers(join(dir, d.name)) : d.name.endsWith(".js") ? [join(dir, d.name)] : [],
  );
}

describe("écouteurs sur les <button>, pas sur le span intérieur", () => {
  it.each(fichiers(JS).map((f) => [f.slice(JS.length + 1), f]))("%s", (_nom, f) => {
    const src = readFileSync(f, "utf8");
    const vars = [...src.matchAll(/var\s+(\w+)\s*=\s*[\w.]*querySelector\(\s*'[^']*dedans[^']*'\s*\)/g)].map(
      (m) => m[1],
    );
    for (const v of vars) {
      expect(src, `${v} (span *-dedans) reçoit un écouteur`).not.toContain(
        `${v}.addEventListener(`,
      );
    }
  });
});
