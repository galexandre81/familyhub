/**
 * Les Cloud Functions lisent une COPIE générée des fichiers purs du module
 * (scripts/copier-controle-parental-functions.mjs). Si ce test échoue : un
 * nom a changé ici sans que la copie suive. Relancer le script, puis
 * redéployer les fonctions.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = resolve(__dirname, "../../..");

describe("copie pour les Cloud Functions", () => {
  it.each(["schema.ts", "domaine.ts"])("%s est identique à l'original", (nom) => {
    const original = readFileSync(resolve(__dirname, nom), "utf8");
    const copie = readFileSync(resolve(RACINE, "functions/src/controleParental/genere", nom), "utf8");
    const sansEntete = copie.split("\n").slice(2).join("\n");
    expect(sansEntete).toBe(original);
  });
});
