#!/usr/bin/env node
/**
 * Les Cloud Functions ne peuvent pas dépendre d'un paquet du dépôt à
 * l'exécution : Firebase n'envoie que le dossier `functions/` (voir
 * functions/src/types.ts). Plutôt qu'une copie tenue à la main, ce script
 * RECOPIE les fichiers purs du module de contrôle parental (sans import) dans
 * functions/src/controleParental/genere/. Un test (copie-functions.test.ts)
 * échoue si la copie diffère de l'original : relancer ce script.
 *
 *   node scripts/copier-controle-parental-functions.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(RACINE, "packages/controle-parental/src");
const CIBLE = join(RACINE, "functions/src/controleParental/genere");
export const FICHIERS = ["schema.ts", "domaine.ts"];
export const ENTETE = (nom) =>
  `// FICHIER GÉNÉRÉ — ne pas modifier. Copie de packages/controle-parental/src/${nom}\n` +
  `// (node scripts/copier-controle-parental-functions.mjs).\n`;

mkdirSync(CIBLE, { recursive: true });
for (const nom of FICHIERS) {
  const texte = readFileSync(join(SOURCE, nom), "utf8");
  if (/^\s*import\s/m.test(texte)) throw new Error(`${nom} importe un autre fichier : il ne peut pas être copié seul.`);
  writeFileSync(join(CIBLE, nom), ENTETE(nom) + texte);
  console.log(`copié : ${nom}`);
}
