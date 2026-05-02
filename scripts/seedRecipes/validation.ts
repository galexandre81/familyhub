/**
 * Validation Zod des recettes générées par le LLM local.
 * Plus permissif que côté Cloud Functions (le LLM local peut écarter
 * légèrement le format) — on coerce/normalise plutôt que rejeter dur.
 */

import { z } from "zod";

const RAYONS = [
  "frais-fruits-legumes",
  "frais-laitier",
  "frais-boucherie",
  "frais-poissonnerie",
  "sec-epicerie",
  "surgele",
  "boulangerie",
  "autre",
] as const;

const SAISONS = ["hiver", "printemps", "ete", "automne", "toutes"] as const;

export const recetteGenereeSchema = z.object({
  nom: z.string().min(2).max(120),
  description: z.string().optional().default(""),
  portions: z.number().int().min(1).max(20).default(4),
  tempsPrepMinutes: z.number().int().min(0).max(600).default(15),
  tempsCuissonMinutes: z.number().int().min(0).max(600).default(20),
  difficulte: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  ingredients: z
    .array(
      z.object({
        libelle: z.string().min(1),
        quantite: z.string().min(1),
        unite: z.string().default(""),
        rayon: z.enum(RAYONS).catch("autre"),
      }),
    )
    .min(1),
  etapes: z
    .array(
      z.object({
        ordre: z.number().int().min(1),
        description: z.string().min(1),
        dureeMinutes: z.number().int().min(0).optional(),
      }),
    )
    .min(1),
  tags: z.array(z.string()).max(8).default([]),
  saison: z.array(z.enum(SAISONS)).default(["toutes"]),
  estBatch: z.boolean().default(false),
  styleCulinaire: z.string().optional(),
  proteinePrincipale: z
    .enum([
      "viande-blanche",
      "viande-rouge",
      "poisson",
      "oeufs",
      "legumineuses",
      "tofu",
      "fromage",
      "aucune",
    ])
    .optional(),
  modeCuissonPrincipal: z
    .enum([
      "poele",
      "four",
      "vapeur",
      "mijote",
      "grillade",
      "cru",
      "wok",
      "papillote",
    ])
    .optional(),
  tempsTotal: z.enum(["<15min", "15-30min", "30-60min", ">60min"]).optional(),
});

export type RecetteGeneree = z.infer<typeof recetteGenereeSchema>;

export const seedBatchOutputSchema = z.object({
  recettes: z.array(recetteGenereeSchema),
});

export type SeedBatchOutput = z.infer<typeof seedBatchOutputSchema>;

/** Parse + valide. Retourne `{ ok, data, errors }` au lieu de throw pour tolérance batch. */
export function parseSeedOutput(raw: unknown): {
  ok: boolean;
  data: SeedBatchOutput | null;
  errors: string[];
} {
  // Le modèle peut retourner un tableau direct au lieu de {recettes: [...]}.
  // On normalise.
  let normalized = raw;
  if (Array.isArray(raw)) {
    normalized = { recettes: raw };
  } else if (raw && typeof raw === "object" && !("recettes" in raw)) {
    // Cherche une clé qui est un array
    const obj = raw as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) {
        normalized = { recettes: obj[key] };
        break;
      }
    }
  }

  const result = seedBatchOutputSchema.safeParse(normalized);
  if (!result.success) {
    const errors = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`);
    return { ok: false, data: null, errors };
  }

  // Filtre les recettes individuelles invalides plutôt que tout rejeter
  const validRecettes: RecetteGeneree[] = [];
  const errors: string[] = [];
  for (let i = 0; i < result.data.recettes.length; i++) {
    const r = result.data.recettes[i];
    if (!r.nom.trim()) {
      errors.push(`recette ${i} : nom vide, écartée`);
      continue;
    }
    validRecettes.push(r);
  }

  return { ok: validRecettes.length > 0, data: { recettes: validRecettes }, errors };
}

/**
 * Normalise un nom de recette pour comparaison de doublons.
 * Lowercase + retire ponctuation + retire accents.
 */
export function normalizeNom(nom: string): string {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
