/**
 * L'iPad (ES5, sans module) lit une COPIE générée des valeurs du schéma :
 * apps/display/public/js/genere/schema-controle-parental.js
 * (scripts/copier-controle-parental-functions.mjs). Si ce test échoue : un
 * nom a changé ici sans que la copie suive. Relancer le script, puis
 * redéployer l'hébergement.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import * as schema from "./schema.js";

const RACINE = resolve(__dirname, "../../..");

describe("copie pour l'iPad", () => {
  it("porte exactement les valeurs du schéma (sans les fonctions)", () => {
    const texte = readFileSync(resolve(RACINE, "apps/display/public/js/genere/schema-controle-parental.js"), "utf8");
    const window: { FamilyHubSchemaPc?: unknown } = {};
    runInNewContext(texte, { window });
    const attendu = JSON.parse(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(schema).filter(
            ([, v]) => typeof v !== "function" && !(typeof v === "object" && v && Object.values(v).some((x) => typeof x === "function")),
          ),
        ),
      ),
    );
    expect(window.FamilyHubSchemaPc).toEqual(attendu);
  });
});
