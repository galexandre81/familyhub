import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import colors from "tailwindcss/colors";

/**
 * Garde-fou : une classe `bg-…` / `text-…` / `border-…` dont le nom de couleur
 * n'existe pas dans Tailwind est silencieusement ignorée (fond transparent,
 * texte par défaut…). Ce test échoue sur ces classes fantômes.
 */

const SRC = path.resolve(__dirname, "..");

// Import dynamique par chemin : tailwind.config.ts est hors du projet tsc de src/.
const configPath = path.resolve(__dirname, "../../tailwind.config.ts");
const config = (await import(/* @vite-ignore */ configPath)).default as {
  theme?: { extend?: { colors?: Record<string, unknown> } };
};

// Couleurs personnalisées, lues depuis tailwind.config.ts (pas de liste en dur).
function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") {
      const sub = k === "DEFAULT" ? prefix : prefix ? `${prefix}-${k}` : k;
      if ((v as Record<string, unknown>).DEFAULT !== undefined && k !== "DEFAULT") out.push(sub);
      out.push(...flatten(v as Record<string, unknown>, sub));
    } else {
      out.push(k === "DEFAULT" ? prefix : prefix ? `${prefix}-${k}` : k);
    }
  }
  return out;
}

const custom = flatten(
  (config.theme?.extend?.colors ?? {}) as Record<string, unknown>,
);
const KNOWN = new Set<string>([
  ...custom,
  "white",
  "black",
  "transparent",
  "current",
  "inherit",
]);
for (const [name, shades] of Object.entries(colors)) {
  if (shades && typeof shades === "object") {
    for (const s of Object.keys(shades)) KNOWN.add(`${name}-${s}`);
  }
}

// Suffixes qui partagent le préfixe mais ne sont pas des couleurs.
const NON_COLOR =
  /^(?:\[.*\]|\d+(?:\.\d+)?|px|auto|none|full|screen|min|max|fit|xs|sm|base|lg|xl|\d*xl|left|right|center|justify|start|end|top|bottom|eyebrow|wrap|nowrap|balance|pretty|ellipsis|clip|cover|contain|fixed|local|scroll|repeat(?:-.*)?|no-repeat|origin-.*|blend-.*|gradient-.*|opacity-.*|solid|dashed|dotted|double|hidden|collapse|separate|spacing-.*|[trblxyse](?:-(?:\[.*\]|\d+|px))?|(?:left|right|top|bottom)-.*|(?:t|r|b|l|x|y|s|e)-[a-z]+.*)$/;

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function isColorOk(rest: string): boolean {
  const name = rest.replace(/\/[\w.[\]%]+$/, ""); // opacité
  if (KNOWN.has(name)) return true;
  // border-t-ebony-ridge, border-x-… : retire le côté
  const side = name.match(/^[trblxyse]-(.+)$/);
  if (side && KNOWN.has(side[1])) return true;
  return NON_COLOR.test(name);
}

describe("classes Tailwind de couleur", () => {
  it("la liste de couleurs personnalisées est lue depuis la config", () => {
    expect(KNOWN.has("ebony")).toBe(true);
    expect(KNOWN.has("ebony-panel")).toBe(true);
    expect(KNOWN.has("fond-principal")).toBe(false);
  });

  it("aucun fichier .tsx n'utilise une couleur bg-/text-/border- inexistante", () => {
    const bad: string[] = [];
    const re = /(?:^|[\s"'`{])((?:[a-z0-9-]+:)*)(bg|text|border)-([^\s"'`}]+)/g;
    for (const file of listFiles(SRC)) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(re)) {
        if (/[:;]$/.test(m[3])) continue; // propriété CSS (text-transform:, border-box;)
        if (!isColorOk(m[3])) {
          bad.push(`${path.relative(SRC, file)}: ${m[2]}-${m[3]}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
