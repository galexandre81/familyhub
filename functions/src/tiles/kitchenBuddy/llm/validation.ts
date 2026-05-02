/**
 * Schémas Zod pour valider les outputs LLM.
 *
 * Pourquoi Zod en plus du JSONSchema envoyé à Gemini ?
 * - Le `responseSchema` Gemini contraint la GÉNÉRATION mais pas à 100%
 *   (parfois des champs inattendus, types décalés, ou le LLM hallucine).
 * - Zod nous donne une validation runtime stricte avec messages d'erreur
 *   exploitables, et un type TS dérivé.
 * - On bloque tout output non conforme avant write Firestore (defense in depth).
 */

import { z } from "zod";

const RAYON = z.enum([
  "frais-fruits-legumes",
  "frais-laitier",
  "frais-boucherie",
  "frais-poissonnerie",
  "sec-epicerie",
  "surgele",
  "boulangerie",
  "autre",
]);

const SAISON = z.enum(["hiver", "printemps", "ete", "automne", "toutes"]);

/* --- Schéma output `generateMealPlan` --- */

export const recetteGenereeSchema = z.object({
  /** ID temporaire utilisé dans `slots.recetteTempIds`, ex "r1". */
  tempId: z.string().min(1),
  nom: z.string().min(1),
  description: z.string().optional(),
  portions: z.number().int().min(1).max(20),
  tempsPrepMinutes: z.number().int().min(0).max(600),
  tempsCuissonMinutes: z.number().int().min(0).max(600),
  difficulte: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  ingredients: z
    .array(
      z.object({
        libelle: z.string().min(1),
        quantite: z.string().min(1),
        unite: z.string(),
        rayon: RAYON,
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
  tags: z.array(z.string()),
  saison: z.array(SAISON),
  estBatch: z.boolean(),
});

export const slotGenereSchema = z.object({
  /** ID convention "{jour}-{repas}" ex "0-dej". */
  slotId: z.string().regex(/^[0-6]-(petitDej|dej|diner)$/),
  /** IDs temporaires des recettes (référencent recettes[].tempId). */
  recetteTempIds: z.array(z.string().min(1)),
  /** Si ce slot consomme un batch, pointe vers le slot source. */
  batchSourceSlotId: z
    .string()
    .regex(/^[0-6]-(petitDej|dej|diner)$/)
    .nullable()
    .optional(),
});

export const courseItemGenereSchema = z.object({
  libelle: z.string().min(1),
  quantite: z.string().min(1),
  unite: z.string(),
  rayon: RAYON,
});

export const mealPlanLLMOutputSchema = z.object({
  recettes: z.array(recetteGenereeSchema).min(1),
  slots: z.array(slotGenereSchema),
  courses: z.array(courseItemGenereSchema),
});

export type MealPlanLLMOutput = z.infer<typeof mealPlanLLMOutputSchema>;
export type RecetteGeneree = z.infer<typeof recetteGenereeSchema>;
export type SlotGenere = z.infer<typeof slotGenereSchema>;
export type CourseItemGenere = z.infer<typeof courseItemGenereSchema>;

/* --- JSONSchema équivalent pour Gemini responseSchema ---
 * Gemini accepte un sous-ensemble OpenAPI 3.0 ; pas de `oneOf`/`union`
 * supporté à 100%. On évite Zod-to-JSONSchema lib pour garder le contrôle.
 */

export const mealPlanJSONSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    recettes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tempId: { type: "string" },
          nom: { type: "string" },
          description: { type: "string" },
          portions: { type: "integer" },
          tempsPrepMinutes: { type: "integer" },
          tempsCuissonMinutes: { type: "integer" },
          difficulte: { type: "integer" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                libelle: { type: "string" },
                quantite: { type: "string" },
                unite: { type: "string" },
                rayon: { type: "string" },
              },
              required: ["libelle", "quantite", "unite", "rayon"],
            },
          },
          etapes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                ordre: { type: "integer" },
                description: { type: "string" },
                dureeMinutes: { type: "integer" },
              },
              required: ["ordre", "description"],
            },
          },
          tags: { type: "array", items: { type: "string" } },
          saison: { type: "array", items: { type: "string" } },
          estBatch: { type: "boolean" },
        },
        required: [
          "tempId",
          "nom",
          "portions",
          "tempsPrepMinutes",
          "tempsCuissonMinutes",
          "difficulte",
          "ingredients",
          "etapes",
          "tags",
          "saison",
          "estBatch",
        ],
      },
    },
    slots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slotId: { type: "string" },
          recetteTempIds: { type: "array", items: { type: "string" } },
          batchSourceSlotId: { type: "string" },
        },
        required: ["slotId", "recetteTempIds"],
      },
    },
    courses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          libelle: { type: "string" },
          quantite: { type: "string" },
          unite: { type: "string" },
          rayon: { type: "string" },
        },
        required: ["libelle", "quantite", "unite", "rayon"],
      },
    },
  },
  required: ["recettes", "slots", "courses"],
};

/* --- Validation cross-fields --- */

/**
 * Vérifie l'intégrité référentielle entre slots et recettes :
 * - Chaque `slot.recetteTempIds[]` doit correspondre à un `recette.tempId`
 * - Chaque `slot.batchSourceSlotId` (si défini) doit pointer vers un autre slot existant
 * - Chaque `slot.slotId` doit être unique
 */
export function validateMealPlanReferences(output: MealPlanLLMOutput): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const recetteTempIds = new Set(output.recettes.map((r) => r.tempId));
  const slotIds = new Set<string>();

  for (const slot of output.slots) {
    if (slotIds.has(slot.slotId)) {
      errors.push(`Slot dupliqué : ${slot.slotId}`);
    }
    slotIds.add(slot.slotId);

    for (const tempId of slot.recetteTempIds) {
      if (!recetteTempIds.has(tempId)) {
        errors.push(`Slot ${slot.slotId} référence une recette inconnue : ${tempId}`);
      }
    }
  }

  for (const slot of output.slots) {
    if (slot.batchSourceSlotId && !slotIds.has(slot.batchSourceSlotId)) {
      errors.push(
        `Slot ${slot.slotId} pointe vers un batchSourceSlotId inconnu : ${slot.batchSourceSlotId}`,
      );
    }
  }

  // Détection tempId dupliqués
  const seenTempIds = new Set<string>();
  for (const r of output.recettes) {
    if (seenTempIds.has(r.tempId)) {
      errors.push(`tempId dupliqué : ${r.tempId}`);
    }
    seenTempIds.add(r.tempId);
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Parse + valide en un appel. Throw un Error explicite si invalide.
 */
export function parseMealPlanLLMOutput(raw: unknown): MealPlanLLMOutput {
  const parsed = mealPlanLLMOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(" ; ");
    throw new Error(`Output LLM invalide (Zod) : ${issues}`);
  }
  const refs = validateMealPlanReferences(parsed.data);
  if (!refs.ok) {
    throw new Error(`Output LLM incohérent : ${refs.errors.slice(0, 3).join(" ; ")}`);
  }
  return parsed.data;
}
