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
        // Quantité tolérante : "" ou null acceptés et normalisés en "qsp"
        // (quantité suffisante pour) — convention culinaire pour sel,
        // poivre, herbes "à goûter".
        quantite: z
          .union([z.string(), z.null(), z.undefined()])
          .transform((v) => {
            const s = (v ?? "").toString().trim();
            return s.length === 0 ? "qsp" : s;
          }),
        unite: z
          .union([z.string(), z.null(), z.undefined()])
          .transform((v) => (v ?? "").toString()),
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
  /**
   * Type de repas. Renseigné par le seed à partir du batch (le LLM n'a pas
   * besoin de le produire), mais on l'accepte aussi en entrée si présent.
   */
  repas: z
    .enum(["petit-dej-sale", "petit-dej-sucre", "dejeuner", "diner", "tout"])
    .optional(),
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
  let recettesArray: unknown[] | null = null;
  if (Array.isArray(raw)) {
    recettesArray = raw;
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.recettes)) {
      recettesArray = obj.recettes;
    } else {
      // Cherche la 1ère clé qui est un array
      for (const key of Object.keys(obj)) {
        if (Array.isArray(obj[key])) {
          recettesArray = obj[key] as unknown[];
          break;
        }
      }
    }
  }

  if (!recettesArray) {
    return {
      ok: false,
      data: null,
      errors: ["JSON ne contient pas d'array de recettes (ni à la racine ni sous une clé)"],
    };
  }

  // Validation recette par recette : une recette cassée n'invalide pas tout
  // le batch, on l'écarte juste avec son erreur dans le rapport.
  const validRecettes: RecetteGeneree[] = [];
  const errors: string[] = [];
  for (let i = 0; i < recettesArray.length; i++) {
    const result = recetteGenereeSchema.safeParse(recettesArray[i]);
    if (!result.success) {
      const issues = result.error.issues
        .slice(0, 3)
        .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
        .join(" ; ");
      const nom =
        recettesArray[i] && typeof recettesArray[i] === "object"
          ? String((recettesArray[i] as Record<string, unknown>).nom ?? `index ${i}`)
          : `index ${i}`;
      errors.push(`"${nom}" : ${issues}`);
      continue;
    }
    if (!result.data.nom.trim()) {
      errors.push(`recette ${i} : nom vide, écartée`);
      continue;
    }
    validRecettes.push(result.data);
  }

  return {
    ok: validRecettes.length > 0,
    data: { recettes: validRecettes },
    errors,
  };
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
