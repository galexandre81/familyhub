/**
 * Garde : aucun fichier n'écrit un nom stocké du contrôle parental en dur,
 * hors `schema.ts`. Est visé tout fichier de ce paquet, et tout fichier du
 * dépôt qui importe `@family-hub/controle-parental` (hub, simulateur, tests
 * des règles). Les règles Firestore, elles, répètent forcément les noms :
 * un test de cohérence dédié les compare au schéma (phase 2).
 *
 * Seuls les noms DISTINCTIFS sont cherchés : "pc", "type" ou "status"
 * apparaissent partout dans le hub pour d'autres raisons.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as schema from "./schema.js";

const RACINE_DEPOT = resolve(__dirname, "../../..");
const ICI = resolve(__dirname);

function valeursChaines(o: unknown): string[] {
  if (typeof o === "string") return [o];
  if (Array.isArray(o)) return o.flatMap(valeursChaines);
  if (typeof o === "object" && o !== null) return Object.values(o).flatMap(valeursChaines);
  return [];
}

const NOMS_COURANTS = new Set(["pc", "internet", "type", "message", "status", "name", "label", "app", "at", "by", "until", "current", "other", "default", "time", "site"]);
const NOMS = [
  ...new Set(
    valeursChaines({ ...schema, chemin: undefined }).filter((n) => n.length >= 4 && !NOMS_COURANTS.has(n)),
  ),
];

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    if (["node_modules", "dist", "lib", ".git", "coverage"].includes(nom)) return [];
    const p = join(dossier, nom);
    if (statSync(p).isDirectory()) return fichiers(p);
    return /\.(ts|tsx|mjs|js)$/.test(nom) ? [p] : [];
  });
}

const DOSSIERS = ["apps/hub/src", "scripts", "firestore-tests", "functions/src", "packages"].map((d) =>
  join(RACINE_DEPOT, d),
);

const VISES = DOSSIERS.flatMap(fichiers).filter((f) => {
  if (f === join(ICI, "schema.ts") || f === join(ICI, "isolation.test.ts")) return false;
  if (f.startsWith(ICI)) return true;
  // Côté fonctions : la copie générée EST le schéma (copie-functions.test.ts la
  // compare à l'original) ; tout le reste du dossier est surveillé.
  const fonctions = join(RACINE_DEPOT, "functions/src/controleParental");
  if (f.startsWith(join(fonctions, "genere"))) return false;
  if (f.startsWith(fonctions)) return true;
  // Import par le nom du paquet (hub) ou par chemin relatif (tests des règles,
  // qui ont leur propre installation et ne lisent que les fichiers purs).
  const t = readFileSync(f, "utf8");
  return t.includes("@family-hub/controle-parental") || t.includes("controle-parental/src/");
});

describe("isolation du schéma", () => {
  it("le témoin : la garde voit bien un nom en dur", () => {
    const temoin = `const x = { "${schema.CHAMP_CONFIG.listeEcole}": [] };`;
    expect(NOMS.some((n) => temoin.includes(`"${n}"`))).toBe(true);
    expect(NOMS).toContain(schema.CHAMP_CONFIG.compteAppareil);
    expect(VISES.length).toBeGreaterThan(3);
  });

  it.each(VISES.map((f) => [relative(RACINE_DEPOT, f), f]))("%s n'écrit aucun nom stocké", (_r, f) => {
    const texte = readFileSync(f, "utf8");
    // Même guillemet des deux côtés : « d'usage" » dans une phrase n'est pas un nom.
    const trouves = NOMS.filter((n) => new RegExp(`(["'\`])${n}\\1`).test(texte));
    expect(trouves).toEqual([]);
  });
});
