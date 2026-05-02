/**
 * Script de seed du livre de recettes via LLM local (LM Studio + Qwen 9B).
 *
 * Usage :
 *   npm run seed -- --household HID [--count N] [--dry-run] [--theme THEME]
 *
 * Défaut : génère ~290 recettes (12 batches × ~25 recettes) couvrant un large
 * spectre printemps-été, avec dédoublonnage par similitude de nom.
 *
 * Authentification Firestore :
 * - Soit via GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
 * - Soit via Application Default Credentials (gcloud auth application-default login)
 *
 * Prérequis :
 * 1. LM Studio démarré, modèle Qwen chargé, serveur sur :1234
 * 2. .env créé avec GOOGLE_APPLICATION_CREDENTIALS et FIREBASE_PROJECT_ID
 */

import "dotenv/config";
import { Command } from "commander";
import * as admin from "firebase-admin";
import { LMStudioClient } from "./lmstudio.ts";
import {
  buildSeedUserPrompt,
  SEED_SYSTEM_PROMPT,
  SEED_THEMES_PRINTEMPS_ETE,
  type ProfilForSeed,
  type SeedBatchRequest,
  type SeedContext,
} from "./prompts.ts";
import { normalizeNom, parseSeedOutput, type RecetteGeneree } from "./validation.ts";

interface CliOptions {
  household: string;
  count?: number;
  theme?: string;
  dryRun: boolean;
  model: string;
  baseUrl: string;
  saison: string;
}

function parseCli(): CliOptions {
  const program = new Command()
    .option("--household <hid>", "ID du foyer Firestore (households/{hid})")
    .option("--count <n>", "Nombre cible de recettes (sinon total des thèmes)", (v) => parseInt(v, 10))
    .option("--theme <slug>", "Thème unique (sinon rotation entre tous les thèmes)")
    .option("--dry-run", "N'écrit pas dans Firestore, juste affiche", false)
    .option("--model <name>", "ID du modèle LM Studio", "qwen/qwen3.5-9b")
    .option("--base-url <url>", "Base URL LM Studio", "http://localhost:1234/v1")
    .option("--saison <s>", "Saisons à cibler (printemps-ete | hiver | toutes)", "printemps-ete")
    .parse(process.argv);
  const opts = program.opts<CliOptions>();
  if (!opts.household) {
    console.error("❌ --household est requis (ex: --household abc123)");
    process.exit(1);
  }
  return opts;
}

async function loadProfils(
  db: admin.firestore.Firestore,
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

async function loadExistingRecetteNames(
  db: admin.firestore.Firestore,
  householdId: string,
): Promise<Set<string>> {
  const snap = await db.collection(`households/${householdId}/recettes`).get();
  const out = new Set<string>();
  for (const doc of snap.docs) {
    const nom = doc.data().nom;
    if (typeof nom === "string") out.add(normalizeNom(nom));
  }
  return out;
}

interface BatchStats {
  generated: number;
  written: number;
  skippedDuplicates: number;
  errors: number;
  totalTokensInput: number;
  totalTokensOutput: number;
}

async function runBatch(
  llm: LMStudioClient,
  ctx: SeedContext,
  req: SeedBatchRequest,
  existingNames: Set<string>,
  recentNomsAEviter: string[],
  writer: ((r: RecetteGeneree) => Promise<void>) | null,
  stats: BatchStats,
): Promise<RecetteGeneree[]> {
  console.log(`\n▶ Batch : ${req.theme} (${req.count} recettes demandées)`);
  const userPrompt = buildSeedUserPrompt(
    { ...ctx, noms_a_eviter: recentNomsAEviter.slice(-50) }, // cap 50 pour ne pas exploser le prompt
    req,
  );

  let raw: unknown;
  try {
    const result = await llm.generateJson<unknown>({
      systemPrompt: SEED_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: Math.max(4000, req.count * 350),
    });
    raw = result.data;
    stats.totalTokensInput += result.usage.prompt;
    stats.totalTokensOutput += result.usage.completion;
  } catch (err) {
    console.error(`   ❌ LLM error : ${err instanceof Error ? err.message : err}`);
    stats.errors += 1;
    return [];
  }

  const parsed = parseSeedOutput(raw);
  if (!parsed.ok || !parsed.data) {
    console.error(`   ❌ JSON invalide : ${parsed.errors.join(" ; ")}`);
    stats.errors += 1;
    return [];
  }
  if (parsed.errors.length) {
    console.warn(`   ⚠️  ${parsed.errors.length} recette(s) écartée(s) : ${parsed.errors.join(" ; ")}`);
  }

  const accepted: RecetteGeneree[] = [];
  for (const r of parsed.data.recettes) {
    stats.generated += 1;
    const norm = normalizeNom(r.nom);
    if (existingNames.has(norm)) {
      stats.skippedDuplicates += 1;
      console.log(`   ⏭️  doublon : "${r.nom}"`);
      continue;
    }
    existingNames.add(norm);
    accepted.push(r);
    if (writer) {
      try {
        await writer(r);
        stats.written += 1;
      } catch (err) {
        console.error(`   ❌ Firestore write : ${err instanceof Error ? err.message : err}`);
        stats.errors += 1;
      }
    }
    console.log(
      `   ✓ "${r.nom}" — ${r.tempsPrepMinutes + r.tempsCuissonMinutes}min, ${r.estBatch ? "BATCH " : ""}${r.styleCulinaire ?? "?"} / ${r.proteinePrincipale ?? "?"}`,
    );
  }
  return accepted;
}

async function main() {
  const opts = parseCli();

  console.log("🍳 Family Hub — Seed du livre de recettes");
  console.log(`   Foyer  : ${opts.household}`);
  console.log(`   Modèle : ${opts.model} @ ${opts.baseUrl}`);
  console.log(`   Mode   : ${opts.dryRun ? "DRY-RUN (pas d'écriture Firestore)" : "ÉCRITURE Firestore"}`);

  // 1. Init Firebase Admin
  if (!opts.dryRun) {
    if (!admin.apps.length) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      try {
        admin.initializeApp(
          projectId ? { projectId, credential: admin.credential.applicationDefault() } : undefined,
        );
      } catch (err) {
        console.error(
          `❌ Init Firebase : ${err instanceof Error ? err.message : err}\n` +
            "   Vérifie GOOGLE_APPLICATION_CREDENTIALS dans .env (chemin vers service-account.json)\n" +
            "   ou exécute : gcloud auth application-default login",
        );
        process.exit(1);
      }
    }
  }
  const db = opts.dryRun
    ? (null as unknown as admin.firestore.Firestore)
    : admin.firestore();

  // 2. Charge profils + recettes existantes (pour dédup)
  let profils: ProfilForSeed[];
  let existingNames: Set<string>;
  if (opts.dryRun) {
    console.log("   ⚠️  DRY-RUN : profils et recettes existantes non chargées (utilise des stubs).");
    profils = [
      {
        nom: "Famille (stub)",
        regimes: [],
        aversions: [],
        objectifsNutrition: ["50% légumes, 35% protéines, 15% féculents"],
        prefsCuisson: [],
      },
    ];
    existingNames = new Set();
  } else {
    profils = await loadProfils(db, opts.household);
    existingNames = await loadExistingRecetteNames(db, opts.household);
    console.log(`   Profils chargés : ${profils.map((p) => p.nom).join(", ")}`);
    console.log(`   Recettes déjà en base : ${existingNames.size}`);
  }

  // 3. Déduit saisons
  const saisons = (opts.saison === "printemps-ete"
    ? ["printemps", "ete"]
    : opts.saison === "hiver"
      ? ["hiver", "automne"]
      : ["printemps", "ete", "automne", "hiver"]) as Array<
    "hiver" | "printemps" | "ete" | "automne"
  >;

  // 4. Sélectionne les batches
  let batches: SeedBatchRequest[];
  if (opts.theme) {
    batches = [
      {
        count: opts.count ?? 25,
        theme: opts.theme,
        repasType: "déjeuner et dîner",
        includeBatch: true,
      },
    ];
  } else {
    batches = SEED_THEMES_PRINTEMPS_ETE;
    if (opts.count) {
      // Réduit proportionnellement pour atteindre le count cible
      const total = batches.reduce((s, b) => s + b.count, 0);
      const ratio = opts.count / total;
      batches = batches.map((b) => ({ ...b, count: Math.max(5, Math.round(b.count * ratio)) }));
    }
  }
  const totalDemande = batches.reduce((s, b) => s + b.count, 0);
  console.log(`   ${batches.length} batches → ${totalDemande} recettes ciblées\n`);

  // 5. Init LM Studio
  const llm = new LMStudioClient({
    baseURL: opts.baseUrl,
    model: opts.model,
    temperature: 0.85,
  });

  try {
    const models = await llm.ping();
    if (!models.includes(opts.model)) {
      console.warn(
        `⚠️  Modèle "${opts.model}" pas listé par LM Studio. Disponibles : ${models.join(", ")}`,
      );
    } else {
      console.log(`✅ LM Studio joignable, modèle "${opts.model}" chargé.\n`);
    }
  } catch (err) {
    console.error(
      `❌ LM Studio injoignable sur ${opts.baseUrl} : ${err instanceof Error ? err.message : err}\n` +
        "   Démarre le serveur dans LM Studio (Local Server → Start Server).",
    );
    process.exit(1);
  }

  // 6. Writer Firestore
  const writer: ((r: RecetteGeneree) => Promise<void>) | null = opts.dryRun
    ? null
    : async (r) => {
        await db
          .collection(`households/${opts.household}/recettes`)
          .add(buildFirestoreRecette(r, opts.model, saisons));
      };

  // 7. Loop batches
  const stats: BatchStats = {
    generated: 0,
    written: 0,
    skippedDuplicates: 0,
    errors: 0,
    totalTokensInput: 0,
    totalTokensOutput: 0,
  };
  const recentNoms: string[] = [];
  const ctxBase: SeedContext = { profils, saisons, noms_a_eviter: [] };

  const startTime = Date.now();
  for (let i = 0; i < batches.length; i++) {
    const accepted = await runBatch(
      llm,
      ctxBase,
      batches[i],
      existingNames,
      recentNoms,
      writer,
      stats,
    );
    for (const r of accepted) recentNoms.push(r.nom);
  }

  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);

  // 8. Résumé
  console.log("\n──────────── Résumé ────────────");
  console.log(`Recettes générées par le LLM : ${stats.generated}`);
  console.log(`Recettes écrites dans Firestore : ${stats.written}`);
  console.log(`Doublons écartés : ${stats.skippedDuplicates}`);
  console.log(`Erreurs : ${stats.errors}`);
  console.log(`Tokens : ${stats.totalTokensInput} in + ${stats.totalTokensOutput} out`);
  console.log(`Temps total : ${elapsedMin} min`);
  console.log(`Coût LM Studio (local) : 0€`);
  console.log("─────────────────────────────────");

  process.exit(0);
}

function buildFirestoreRecette(
  r: RecetteGeneree,
  llmModel: string,
  saisonsContexte: Array<"hiver" | "printemps" | "ete" | "automne">,
): admin.firestore.DocumentData {
  const FieldValue = admin.firestore.FieldValue;
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
    saison: r.saison.length ? r.saison : saisonsContexte.length ? saisonsContexte : ["toutes"],
    estBatch: r.estBatch,
    statut: "accepted",
    excluded: false,
    seedTags: {
      styleCulinaire: r.styleCulinaire,
      proteinePrincipale: r.proteinePrincipale,
      modeCuissonPrincipal: r.modeCuissonPrincipal,
      tempsTotal: r.tempsTotal,
    },
    origine: {
      genereePar: "seed",
      llmModel,
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
