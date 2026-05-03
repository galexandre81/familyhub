/**
 * Script de seed du livre de recettes via LLM (Gemini Flash par défaut, ou
 * LM Studio local pour zéro coût).
 *
 * Usage :
 *   npm run seed -- --household HID [--provider gemini|lmstudio] [--count N]
 *                   [--dry-run] [--theme THEME] [--saison ...] [--model NAME]
 *
 * Défaut : ~500 recettes (24 batches couvrant petit-déj salé majoritaire,
 * déjeuner light, dîner familial / ethnique varié) pour le printemps-été,
 * avec dédoublonnage par similitude de nom et VALIDATION POST-GÉNÉRATION
 * des contraintes des profils familiaux (aversions + régimes mappés).
 *
 * Authentification Firestore :
 * - Soit via GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
 * - Soit via Application Default Credentials (gcloud auth application-default login)
 *
 * Prérequis :
 * - Provider gemini : GEMINI_API_KEY dans .env
 * - Provider lmstudio : serveur LM Studio démarré sur :1234, modèle Qwen chargé
 */

import "dotenv/config";
import { Command } from "commander";
import * as admin from "firebase-admin";
import { LMStudioClient } from "./lmstudio.ts";
import { GeminiSeedClient } from "./gemini.ts";
import {
  buildBannedTerms,
  checkRecetteConstraints,
  formatBannedBlockForPrompt,
} from "./constraints.ts";
import {
  buildSeedUserPrompt,
  SEED_SYSTEM_PROMPT,
  SEED_THEMES_PRINTEMPS_ETE,
  type ProfilForSeed,
  type SeedBatchRequest,
  type SeedContext,
} from "./prompts.ts";
import {
  checkReglesNutrition,
  formatReglesBlockForPrompt,
  loadReglesNutrition,
  DEFAULT_REGLES_NUTRITION,
  type ReglesNutrition,
} from "./reglesNutrition.ts";
import { normalizeNom, parseSeedOutput, type RecetteGeneree } from "./validation.ts";

type Provider = "gemini" | "lmstudio";

interface CliOptions {
  household: string;
  count?: number;
  theme?: string;
  dryRun: boolean;
  provider: Provider;
  model?: string;
  baseUrl: string;
  saison: string;
  strictConstraints: boolean;
}

/**
 * Tarif Gemini (USD/1M tokens) — à ajuster si Google met à jour les prix.
 * Sources Google AI Studio (avril 2025) — purely indicatif.
 */
const GEMINI_PRICING_USD: Record<string, { input: number; output: number }> = {
  "gemini-2.0-flash":       { input: 0.10, output: 0.40 },
  "gemini-2.0-flash-001":   { input: 0.10, output: 0.40 },
  "gemini-2.0-flash-lite":  { input: 0.075, output: 0.30 },
  "gemini-2.5-flash":       { input: 0.30, output: 2.50 },
  "gemini-2.5-flash-lite":  { input: 0.10, output: 0.40 },
};
const USD_TO_EUR = 0.92; // approx, juste pour donner un ordre de grandeur

function parseCli(): CliOptions {
  const program = new Command()
    .option("--household <hid>", "ID du foyer Firestore (households/{hid})")
    .option("--count <n>", "Nombre cible de recettes (sinon total des thèmes ≈ 500)", (v) => parseInt(v, 10))
    .option("--theme <slug>", "Thème unique (sinon rotation entre tous les thèmes)")
    .option("--dry-run", "N'écrit pas dans Firestore, juste affiche", false)
    .option("--provider <p>", "Fournisseur LLM : gemini | lmstudio", (process.env.LLM_PROVIDER as Provider) ?? "gemini")
    .option("--model <name>", "Override du modèle (défaut : gemini-2.5-flash ou qwen/qwen3.5-9b)")
    .option("--base-url <url>", "Base URL LM Studio", "http://localhost:1234/v1")
    .option("--saison <s>", "Saisons à cibler (printemps-ete | hiver | toutes)", "printemps-ete")
    .option("--no-strict-constraints", "Ne rejette PAS les recettes qui violent une contrainte (juste warn)")
    .parse(process.argv);
  const opts = program.opts<CliOptions>();
  if (!opts.household) {
    console.error("❌ --household est requis (ex: --household abc123)");
    process.exit(1);
  }
  if (opts.provider !== "gemini" && opts.provider !== "lmstudio") {
    console.error(`❌ --provider invalide : "${opts.provider}" (attendu : gemini | lmstudio)`);
    process.exit(1);
  }
  return opts;
}

/** Interface commune pour basculer entre LM Studio et Gemini. */
interface LLMClient {
  generateJson<T = unknown>(opts: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
  }): Promise<{ data: T; rawText: string; usage: { prompt: number; completion: number } }>;
  ping(): Promise<string[]>;
}

function buildLLMClient(opts: CliOptions): { client: LLMClient; model: string } {
  if (opts.provider === "gemini") {
    const model = opts.model ?? "gemini-2.5-flash";
    return {
      client: new GeminiSeedClient({ model, temperature: 0.85 }),
      model,
    };
  }
  const model = opts.model ?? "qwen/qwen3.5-9b";
  return {
    client: new LMStudioClient({ baseURL: opts.baseUrl, model, temperature: 0.85 }),
    model,
  };
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
  skippedConstraints: number;
  skippedRegles: number;
  errors: number;
  totalTokensInput: number;
  totalTokensOutput: number;
}

async function runBatch(
  llm: LLMClient,
  ctx: SeedContext,
  req: SeedBatchRequest,
  bannedTerms: Set<string>,
  regles: ReglesNutrition,
  strict: boolean,
  existingNames: Set<string>,
  recentNomsAEviter: string[],
  writer: ((r: RecetteGeneree, repas: SeedBatchRequest["repas"]) => Promise<void>) | null,
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

    // Validation des contraintes profils (aversions + régimes mappés).
    const check = checkRecetteConstraints(r, bannedTerms);
    if (!check.ok) {
      const detail = check.violations
        .map((v) => `"${v.term}" dans "${v.ingredient}"`)
        .join(", ");
      if (strict) {
        stats.skippedConstraints += 1;
        console.log(`   🚫 contrainte violée → "${r.nom}" rejetée (${detail})`);
        continue;
      } else {
        console.warn(`   ⚠️  contrainte violée → "${r.nom}" écrite quand même (${detail})`);
      }
    }

    // Validation des règles nutrition famille (ratios, max féculents).
    const reglesCheck = checkReglesNutrition(r, regles, req.repas);
    if (!reglesCheck.ok) {
      const detail = reglesCheck.violations.join(" ; ");
      if (strict) {
        stats.skippedRegles += 1;
        console.log(`   ⚖️  règles famille violées → "${r.nom}" rejetée (${detail})`);
        continue;
      } else {
        console.warn(`   ⚠️  règles famille violées → "${r.nom}" écrite quand même (${detail})`);
      }
    }

    existingNames.add(norm);
    accepted.push(r);
    if (writer) {
      try {
        await writer(r, req.repas);
        stats.written += 1;
      } catch (err) {
        console.error(`   ❌ Firestore write : ${err instanceof Error ? err.message : err}`);
        stats.errors += 1;
      }
    }
    console.log(
      `   ✓ "${r.nom}" — ${r.tempsPrepMinutes + r.tempsCuissonMinutes}min, ${r.estBatch ? "BATCH " : ""}${r.styleCulinaire ?? "?"} / ${r.proteinePrincipale ?? "?"} [${req.repas}]`,
    );
  }
  return accepted;
}

async function main() {
  const opts = parseCli();

  console.log("🍳 Family Hub — Seed du livre de recettes");
  console.log(`   Foyer    : ${opts.household}`);
  console.log(`   Provider : ${opts.provider}`);
  console.log(`   Mode     : ${opts.dryRun ? "DRY-RUN (pas d'écriture Firestore)" : "ÉCRITURE Firestore"}`);
  console.log(`   Strict   : ${opts.strictConstraints ? "OUI (recettes hors contraintes rejetées)" : "non (warning seulement)"}`);

  // 1. Init Firebase Admin
  if (!opts.dryRun) {
    // firebase-admin v12 : admin.apps peut être undefined avant initialisation
    if (!admin.apps || admin.apps.length === 0) {
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

  // 2. Charge profils + recettes existantes (pour dédup) + règles nutrition
  let profils: ProfilForSeed[];
  let existingNames: Set<string>;
  let regles: ReglesNutrition;
  if (opts.dryRun) {
    console.log("   ⚠️  DRY-RUN : profils et recettes existantes non chargées (utilise des stubs).");
    profils = [
      {
        nom: "Famille (stub)",
        regimes: [],
        aversions: [],
        objectifsNutrition: [],
        prefsCuisson: [],
      },
    ];
    existingNames = new Set();
    regles = DEFAULT_REGLES_NUTRITION;
  } else {
    profils = await loadProfils(db, opts.household);
    existingNames = await loadExistingRecetteNames(db, opts.household);
    regles = await loadReglesNutrition(db, opts.household);
    console.log(`   Profils chargés : ${profils.map((p) => p.nom).join(", ")}`);
    console.log(`   Recettes déjà en base : ${existingNames.size}`);
  }
  console.log(
    `   ⚖️  Règles nutrition : ${regles.nomAffiche} (preset=${regles.presetId}) → ${regles.ratios.legumes}/${regles.ratios.proteines}/${regles.ratios.feculents}, max ${regles.maxFeculentsParRepas} féculent(s)/repas`,
  );

  // 3. Construit la liste agrégée d'ingrédients interdits + bloc prompt
  const bannedResult = buildBannedTerms(profils);
  const bannedBlock = formatBannedBlockForPrompt(bannedResult);
  if (bannedResult.banned.size === 0) {
    console.log("   ℹ️  Aucune contrainte alimentaire détectée (aversions + régimes vides).");
  } else {
    console.log(`   🛡️  ${bannedResult.banned.size} termes interdits agrégés depuis ${bannedResult.sources.length} contrainte(s) profil.`);
    if (bannedResult.banned.size <= 20) {
      console.log(`       → ${Array.from(bannedResult.banned).sort().join(", ")}`);
    } else {
      const preview = Array.from(bannedResult.banned).sort().slice(0, 20);
      console.log(`       → ${preview.join(", ")}, … (+${bannedResult.banned.size - 20} autres)`);
    }
  }

  // 4. Déduit saisons
  const saisons = (opts.saison === "printemps-ete"
    ? ["printemps", "ete"]
    : opts.saison === "hiver"
      ? ["hiver", "automne"]
      : ["printemps", "ete", "automne", "hiver"]) as Array<
    "hiver" | "printemps" | "ete" | "automne"
  >;

  // 5. Sélectionne les batches
  let batches: SeedBatchRequest[];
  if (opts.theme) {
    batches = [
      {
        count: opts.count ?? 25,
        theme: opts.theme,
        repasType: "déjeuner et dîner",
        repas: "tout",
        includeBatch: true,
      },
    ];
  } else {
    batches = SEED_THEMES_PRINTEMPS_ETE;
    if (opts.count) {
      // Réduit/augmente proportionnellement pour atteindre le count cible
      const total = batches.reduce((s, b) => s + b.count, 0);
      const ratio = opts.count / total;
      batches = batches.map((b) => ({ ...b, count: Math.max(5, Math.round(b.count * ratio)) }));
    }
  }
  const totalDemande = batches.reduce((s, b) => s + b.count, 0);
  console.log(`   ${batches.length} batches → ${totalDemande} recettes ciblées\n`);

  // 6. Init LLM client
  const { client: llm, model } = buildLLMClient(opts);
  console.log(`   Modèle   : ${model}`);

  try {
    const models = await llm.ping();
    if (opts.provider === "lmstudio" && !models.includes(model)) {
      console.warn(
        `⚠️  Modèle "${model}" pas listé par LM Studio. Disponibles : ${models.join(", ")}`,
      );
    } else {
      console.log(`✅ ${opts.provider} joignable, modèle "${model}".\n`);
    }
  } catch (err) {
    console.error(
      `❌ ${opts.provider} injoignable : ${err instanceof Error ? err.message : err}` +
        (opts.provider === "lmstudio"
          ? "\n   Démarre le serveur dans LM Studio (Local Server → Start Server)."
          : "\n   Vérifie GEMINI_API_KEY dans scripts/seedRecipes/.env."),
    );
    process.exit(1);
  }

  // 7. Writer Firestore
  const writer: ((r: RecetteGeneree, repas: SeedBatchRequest["repas"]) => Promise<void>) | null = opts.dryRun
    ? null
    : async (r, repas) => {
        await db
          .collection(`households/${opts.household}/recettes`)
          .add(buildFirestoreRecette(r, model, saisons, repas, regles));
      };

  // 8. Loop batches
  const stats: BatchStats = {
    generated: 0,
    written: 0,
    skippedDuplicates: 0,
    skippedConstraints: 0,
    skippedRegles: 0,
    errors: 0,
    totalTokensInput: 0,
    totalTokensOutput: 0,
  };
  const recentNoms: string[] = [];
  const reglesBlock = formatReglesBlockForPrompt(regles);
  const ctxBase: SeedContext = {
    profils,
    saisons,
    noms_a_eviter: [],
    bannedBlock,
    reglesBlock,
  };

  const startTime = Date.now();
  for (let i = 0; i < batches.length; i++) {
    const accepted = await runBatch(
      llm,
      ctxBase,
      batches[i],
      bannedResult.banned,
      regles,
      opts.strictConstraints,
      existingNames,
      recentNoms,
      writer,
      stats,
    );
    for (const r of accepted) recentNoms.push(r.nom);
  }

  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);

  // 9. Résumé + coût
  const cost = computeCost(opts.provider, model, stats.totalTokensInput, stats.totalTokensOutput);
  console.log("\n──────────── Résumé ────────────");
  console.log(`Recettes générées par le LLM    : ${stats.generated}`);
  console.log(`Recettes écrites dans Firestore : ${stats.written}`);
  console.log(`Doublons écartés                : ${stats.skippedDuplicates}`);
  console.log(`Contraintes profils rejetées    : ${stats.skippedConstraints}`);
  console.log(`Règles famille rejetées         : ${stats.skippedRegles}`);
  console.log(`Erreurs                         : ${stats.errors}`);
  console.log(`Tokens                          : ${stats.totalTokensInput.toLocaleString("fr-FR")} in + ${stats.totalTokensOutput.toLocaleString("fr-FR")} out`);
  if (cost) {
    console.log(`Coût estimé (${opts.provider}/${model}) : $${cost.usd.toFixed(4)} ≈ €${cost.eur.toFixed(4)}`);
    console.log(`  → input  : $${cost.inputUsd.toFixed(4)} (${(stats.totalTokensInput / 1_000_000).toFixed(3)}M × $${cost.pricing.input}/M)`);
    console.log(`  → output : $${cost.outputUsd.toFixed(4)} (${(stats.totalTokensOutput / 1_000_000).toFixed(3)}M × $${cost.pricing.output}/M)`);
  } else {
    console.log(`Coût                            : 0€ (provider local)`);
  }
  console.log(`Temps total                     : ${elapsedMin} min`);
  console.log("─────────────────────────────────");

  process.exit(0);
}

interface CostBreakdown {
  inputUsd: number;
  outputUsd: number;
  usd: number;
  eur: number;
  pricing: { input: number; output: number };
}

function computeCost(
  provider: Provider,
  model: string,
  inputTokens: number,
  outputTokens: number,
): CostBreakdown | null {
  if (provider !== "gemini") return null;
  const pricing = GEMINI_PRICING_USD[model];
  if (!pricing) {
    console.warn(`⚠️  Tarif inconnu pour ${model}, coût non calculé. Mets à jour GEMINI_PRICING_USD.`);
    return null;
  }
  const inputUsd = (inputTokens / 1_000_000) * pricing.input;
  const outputUsd = (outputTokens / 1_000_000) * pricing.output;
  const usd = inputUsd + outputUsd;
  return { inputUsd, outputUsd, usd, eur: usd * USD_TO_EUR, pricing };
}

function buildFirestoreRecette(
  r: RecetteGeneree,
  llmModel: string,
  saisonsContexte: Array<"hiver" | "printemps" | "ete" | "automne">,
  repas: SeedBatchRequest["repas"],
  regles: ReglesNutrition,
): admin.firestore.DocumentData {
  const FieldValue = admin.firestore.FieldValue;
  // On tague la recette comme convenant au preset actif au moment du seed.
  // Si le preset est "custom", on n'ajoute pas de tag preset (rien de comparable).
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
    saison: r.saison.length ? r.saison : saisonsContexte.length ? saisonsContexte : ["toutes"],
    estBatch: r.estBatch,
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
