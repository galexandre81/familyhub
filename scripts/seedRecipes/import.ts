/**
 * Import de recettes depuis un fichier JSON externe (sans appel LLM).
 *
 * Cas d'usage : tu utilises Claude.ai (interface web, abonnement Pro/Max)
 * pour générer un gros JSON de recettes, et tu veux les ingérer dans le
 * livre du foyer sans repasser par l'API payante.
 *
 * Le script applique TOUTES les validations du seed :
 *   - Schéma Zod (forme du JSON)
 *   - Validateur de contraintes profils (aversions + régimes)
 *   - Validateur de règles nutrition famille (max féculents, etc.)
 *   - Dédoublonnage par nom normalisé contre les recettes déjà en base
 *
 * Usage :
 *   npm run import -- --household HID --file path/to/recettes.json
 *                     [--repas dejeuner|diner|dessert|technique|petit-dej-sale|petit-dej-sucre|tout]
 *                     [--maj-source "<source d'un import précédent>"]
 *                     [--no-strict-constraints]
 *                     [--source "Claude.ai web — pull du 2026-05-03"]
 *
 * Format JSON accepté (chacun marche, le script normalise) :
 *   1. { "recettes": [ { nom, description, portions, ... }, ... ] }
 *   2. [ { nom, ... }, { nom, ... }, ... ]
 *   3. { "any_key": [ { nom, ... }, ... ] }   // 1ère clé qui est un array
 *
 * Champs obligatoires par recette : nom, ingredients, etapes
 * Champs avec valeurs par défaut (cf validation.ts) : portions=4, difficulte=2,
 * tempsPrepMinutes=15, tempsCuissonMinutes=20, tags=[], saison=["toutes"], estBatch=false
 *
 * Pour générer le JSON via Claude.ai, voir le prompt template dans
 * `scripts/seedRecipes/PROMPT_FOR_CLAUDE_WEB.md`.
 */

import "dotenv/config";
import * as fs from "fs";
import { Command } from "commander";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  type DocumentData,
  type Firestore,
} from "firebase-admin/firestore";
import {
  buildBannedTerms,
  checkRecetteConstraints,
} from "./constraints.ts";
import type { ProfilForSeed } from "./prompts.ts";
import {
  checkReglesNutrition,
  loadReglesNutrition,
  type ReglesNutrition,
} from "./reglesNutrition.ts";
import { normalizeNom, parseSeedOutput, type RecetteGeneree } from "./validation.ts";

type RepasType =
  | "petit-dej-sale"
  | "petit-dej-sucre"
  | "dejeuner"
  | "diner"
  | "dessert"
  | "technique"
  | "tout";

interface CliOptions {
  household: string;
  file: string;
  repas: RepasType;
  source?: string;
  majSource?: string;
  strictConstraints: boolean;
}

function parseCli(): CliOptions {
  const program = new Command()
    .option("--household <hid>", "ID du foyer Firestore (households/{hid})")
    .option("--file <path>", "Chemin du fichier JSON à importer")
    .option(
      "--repas <r>",
      "Type de repas par défaut si pas dans le JSON (petit-dej-sale | petit-dej-sucre | dejeuner | diner | dessert | technique | tout)",
      "tout",
    )
    .option(
      "--source <s>",
      'Origine pour l\'attribut origine.llmModel (ex: "Claude.ai web — Sonnet 4.5")',
    )
    .option(
      "--maj-source <s>",
      "Doublon dont origine.llmModel vaut exactement <s> (import précédent du même lot) : " +
        "fusionne tags et techniques au lieu de l'écarter. Les recettes saisies à la main ne sont jamais touchées.",
    )
    .option(
      "--no-strict-constraints",
      "Ne rejette PAS les recettes qui violent une contrainte (juste warn)",
    )
    .parse(process.argv);
  const opts = program.opts<CliOptions>();
  if (!opts.household) {
    console.error("❌ --household est requis");
    process.exit(1);
  }
  if (!opts.file) {
    console.error("❌ --file est requis (chemin vers JSON)");
    process.exit(1);
  }
  const validRepas: RepasType[] = [
    "petit-dej-sale",
    "petit-dej-sucre",
    "dejeuner",
    "diner",
    "dessert",
    "technique",
    "tout",
  ];
  if (!validRepas.includes(opts.repas)) {
    console.error(`❌ --repas invalide : "${opts.repas}". Valides : ${validRepas.join(", ")}`);
    process.exit(1);
  }
  return opts;
}

async function loadProfils(
  db: Firestore,
  householdId: string,
): Promise<ProfilForSeed[]> {
  const snap = await db.collection(`households/${householdId}/profils`).get();
  const out: ProfilForSeed[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    out.push({
      nom: String(d.nom ?? ""),
      regimes: Array.isArray(d.regimes) ? d.regimes : [],
      aversions: Array.isArray(d.aversions) ? d.aversions : [],
      objectifsNutrition: Array.isArray(d.objectifsNutrition) ? d.objectifsNutrition : [],
      prefsCuisson: Array.isArray(d.prefsCuisson) ? d.prefsCuisson : [],
      notes: typeof d.notes === "string" ? d.notes : undefined,
    });
  }
  if (!out.length) {
    throw new Error(
      `Aucun profil dans households/${householdId}/profils. Crée d'abord les profils via le hub.`,
    );
  }
  return out;
}

interface RecetteExistante {
  id: string;
  llmModel?: string;
  tags: string[];
  techniques: string[];
}

/** Recettes déjà en base, par nom normalisé (la première trouvée l'emporte). */
async function loadExistingRecettes(
  db: Firestore,
  householdId: string,
): Promise<Map<string, RecetteExistante>> {
  const snap = await db.collection(`households/${householdId}/recettes`).get();
  const out = new Map<string, RecetteExistante>();
  for (const doc of snap.docs) {
    const d = doc.data();
    if (typeof d.nom !== "string") continue;
    const norm = normalizeNom(d.nom);
    if (out.has(norm)) continue;
    out.set(norm, {
      id: doc.id,
      llmModel: typeof d.origine?.llmModel === "string" ? d.origine.llmModel : undefined,
      tags: Array.isArray(d.tags) ? d.tags : [],
      techniques: Array.isArray(d.techniques) ? d.techniques : [],
    });
  }
  return out;
}

/** Union qui garde l'ordre : d'abord l'existant, puis les nouveautés. */
function union(a: string[], b: string[]): string[] {
  const out = a.slice();
  for (const x of b) if (!out.includes(x)) out.push(x);
  return out;
}

interface ImportStats {
  totalInFile: number;
  written: number;
  skippedDuplicates: number;
  updated: number;
  skippedConstraints: number;
  skippedRegles: number;
  skippedSchema: number;
  errors: number;
}

async function main() {
  const opts = parseCli();

  console.log("🍳 Family Hub — Import de recettes depuis JSON");
  console.log(`   Foyer  : ${opts.household}`);
  console.log(`   Fichier: ${opts.file}`);
  console.log(`   Repas  : ${opts.repas} (par défaut, écrasé si présent dans le JSON)`);
  console.log(`   Source : ${opts.source ?? "(non précisée)"}`);
  console.log(`   Strict : ${opts.strictConstraints ? "OUI (rejets)" : "non (warning)"}`);
  if (opts.majSource) console.log(`   Mise à jour des doublons venant de : ${opts.majSource}`);

  // 1. Lecture + parse JSON
  if (!fs.existsSync(opts.file)) {
    console.error(`❌ Fichier introuvable : ${opts.file}`);
    process.exit(1);
  }
  const rawText = fs.readFileSync(opts.file, "utf-8");
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch (err) {
    console.error(
      `❌ JSON invalide dans ${opts.file} : ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }

  const parsed = parseSeedOutput(raw);
  if (!parsed.ok || !parsed.data) {
    console.error(`❌ Schéma invalide : ${parsed.errors.join(" ; ")}`);
    process.exit(1);
  }
  if (parsed.errors.length) {
    const preview = parsed.errors.slice(0, 5).join("\n      • ");
    const more =
      parsed.errors.length > 5 ? `\n      … (+${parsed.errors.length - 5} autres)` : "";
    console.warn(
      `⚠️  ${parsed.errors.length} recette(s) écartée(s) au parsing :\n      • ${preview}${more}`,
    );
  }
  console.log(`✅ ${parsed.data.recettes.length} recettes parsées depuis le fichier.`);

  // 2. Init Firebase Admin
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    try {
      initializeApp(
        projectId ? { projectId, credential: applicationDefault() } : undefined,
      );
    } catch (err) {
      console.error(
        `❌ Init Firebase : ${err instanceof Error ? err.message : err}\n` +
          "   Vérifie GOOGLE_APPLICATION_CREDENTIALS dans .env",
      );
      process.exit(1);
    }
  }
  const db = getFirestore();

  // 3. Charge profils + recettes existantes + règles nutrition
  const profils = await loadProfils(db, opts.household);
  const existing = await loadExistingRecettes(db, opts.household);
  const existingNames = new Set(existing.keys());
  const regles = await loadReglesNutrition(db, opts.household);
  console.log(`   Profils chargés : ${profils.map((p) => p.nom).join(", ")}`);
  console.log(`   Recettes déjà en base : ${existingNames.size}`);
  console.log(
    `   ⚖️  Règles nutrition : ${regles.nomAffiche} (max ${regles.maxFeculentsParRepas} féculent(s)/repas)`,
  );

  // 4. Construit la liste agrégée d'ingrédients interdits
  const bannedResult = buildBannedTerms(profils);
  if (bannedResult.banned.size === 0) {
    console.log("   ℹ️  Aucune contrainte alimentaire détectée.");
  } else {
    const preview = Array.from(bannedResult.banned).sort().slice(0, 10);
    const more = bannedResult.banned.size - preview.length;
    console.log(
      `   🛡️  ${bannedResult.banned.size} termes interdits agrégés : ${preview.join(", ")}${more > 0 ? `, … (+${more})` : ""}`,
    );
  }

  // 5. Loop sur les recettes
  const stats: ImportStats = {
    totalInFile: parsed.data.recettes.length,
    written: 0,
    skippedDuplicates: 0,
    updated: 0,
    skippedConstraints: 0,
    skippedRegles: 0,
    skippedSchema: parsed.errors.length,
    errors: 0,
  };

  console.log(""); // saut de ligne avant le détail
  for (const r of parsed.data.recettes) {
    const norm = normalizeNom(r.nom);
    if (existingNames.has(norm)) {
      const ex = existing.get(norm);
      if (opts.majSource && ex && ex.llmModel === opts.majSource) {
        const tags = union(ex.tags, r.tags).slice(0, 8);
        const techniques = union(ex.techniques, r.techniques);
        try {
          await db
            .doc(`households/${opts.household}/recettes/${ex.id}`)
            .update({ tags, techniques, updatedAt: FieldValue.serverTimestamp() });
          stats.updated += 1;
          console.log(`   ↻ mise à jour : "${r.nom}" (tags + gestes)`);
        } catch (err) {
          stats.errors += 1;
          console.error(`   ❌ Firestore update : ${err instanceof Error ? err.message : err}`);
        }
        continue;
      }
      stats.skippedDuplicates += 1;
      console.log(`   ⏭️  doublon : "${r.nom}"`);
      continue;
    }

    // Validation contraintes profils
    const check = checkRecetteConstraints(r, bannedResult.banned);
    if (!check.ok) {
      const detail = check.violations.map((v) => `"${v.term}" dans "${v.ingredient}"`).join(", ");
      if (opts.strictConstraints) {
        stats.skippedConstraints += 1;
        console.log(`   🚫 contrainte profil violée → "${r.nom}" rejetée (${detail})`);
        continue;
      } else {
        console.warn(`   ⚠️  contrainte profil violée → "${r.nom}" écrite quand même (${detail})`);
      }
    }

    // Validation règles nutrition (utilise --repas comme contexte)
    const repasForCheck = (r.repas ?? opts.repas) as RepasType;
    const reglesCheck = checkReglesNutrition(r, regles, repasForCheck);
    if (!reglesCheck.ok) {
      const detail = reglesCheck.violations.join(" ; ");
      if (opts.strictConstraints) {
        stats.skippedRegles += 1;
        console.log(`   ⚖️  règles famille violées → "${r.nom}" rejetée (${detail})`);
        continue;
      } else {
        console.warn(`   ⚠️  règles famille violées → "${r.nom}" écrite quand même (${detail})`);
      }
    }

    existingNames.add(norm);
    try {
      await db
        .collection(`households/${opts.household}/recettes`)
        .add(buildFirestoreRecette(r, opts.source ?? "json-import", repasForCheck, regles));
      stats.written += 1;
      console.log(
        `   ✓ "${r.nom}" — ${r.tempsPrepMinutes + r.tempsCuissonMinutes}min, ${r.estBatch ? "BATCH " : ""}${r.styleCulinaire ?? "?"} / ${r.proteinePrincipale ?? "?"} [${repasForCheck}]`,
      );
    } catch (err) {
      stats.errors += 1;
      console.error(`   ❌ Firestore write : ${err instanceof Error ? err.message : err}`);
    }
  }

  // 6. Résumé
  console.log("\n──────────── Résumé ────────────");
  console.log(`Recettes dans le fichier        : ${stats.totalInFile}`);
  console.log(`Recettes écrites dans Firestore : ${stats.written}`);
  console.log(`Recettes existantes enrichies   : ${stats.updated}`);
  console.log(`Doublons écartés                : ${stats.skippedDuplicates}`);
  console.log(`Contraintes profils rejetées    : ${stats.skippedConstraints}`);
  console.log(`Règles famille rejetées         : ${stats.skippedRegles}`);
  console.log(`Schéma invalide écartées        : ${stats.skippedSchema}`);
  console.log(`Erreurs Firestore               : ${stats.errors}`);
  console.log("Coût                            : 0€ (pas d'appel LLM)");
  console.log("─────────────────────────────────");

  process.exit(0);
}

function buildFirestoreRecette(
  r: RecetteGeneree,
  source: string,
  repas: RepasType,
  regles: ReglesNutrition,
): DocumentData {
  const convientAuxPresets =
    regles.presetId !== "custom" ? [regles.presetId] : undefined;
  return {
    nom: r.nom,
    description: r.description || undefined,
    portions: r.portions,
    tempsPrepMinutes: r.tempsPrepMinutes,
    tempsCuissonMinutes: r.tempsCuissonMinutes,
    difficulte: r.difficulte,
    ingredients: r.ingredients,
    etapes: r.etapes,
    tags: r.tags,
    saison: r.saison.length ? r.saison : ["toutes"],
    estBatch: r.estBatch,
    ...(r.techniques.length ? { techniques: r.techniques } : {}),
    statut: "accepted",
    excluded: false,
    seedTags: {
      styleCulinaire: r.styleCulinaire,
      proteinePrincipale: r.proteinePrincipale,
      modeCuissonPrincipal: r.modeCuissonPrincipal,
      tempsTotal: r.tempsTotal,
      repas,
      ...(convientAuxPresets ? { convientAuxPresets } : {}),
    },
    origine: {
      genereePar: "import",
      llmModel: source,
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
