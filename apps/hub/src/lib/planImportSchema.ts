/**
 * Schéma Zod du JSON renvoyé par Claude.ai pour un import de plan.
 * Cf. brief §6 (kitchen-buddy-phase3-brief.md).
 *
 * Validations en plus du schéma de structure (résolues dans `planImporter.ts`) :
 * - tempId uniques dans recettes et batchSessions
 * - recetteTempIds référencent un tempId existant
 * - batchSessionTempId référence un batchSession.tempId existant
 * - dates dans la fenêtre du plan
 */

import { z } from "zod";

/**
 * Vérifie qu'une string `YYYY-MM-DD` est une vraie date calendaire.
 * Le regex seul laisse passer "2026-02-31" : on reconstruit la date en local
 * et on vérifie que chaque composante "round-trip" (pas de débordement de mois).
 */
function isRealCalendarDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === mo - 1 &&
    dt.getDate() === d
  );
}

const RAYON_VALUES = [
  "fruits-legumes",
  "boucherie",
  "poissonnerie",
  "cremerie",
  "epicerie",
  "surgeles",
  "boulangerie",
  "boissons",
  "autres",
] as const;

export const RayonImportSchema = z.enum(RAYON_VALUES);
export const RepasImportSchema = z.enum(["petit-dej", "dejeuner", "diner"]);
export const SourceImportSchema = z.enum(["fresh", "batch"]);
export const DifficulteImportSchema = z.enum(["facile", "moyen", "avance"]);
export const SaisonImportSchema = z.enum([
  "printemps",
  "ete",
  "automne",
  "hiver",
]);

export const IngredientImportSchema = z.object({
  nom: z.string().min(1),
  quantite: z.number().nonnegative(),
  unite: z.string().min(1),
  rayon: RayonImportSchema,
  optionnel: z.boolean().optional(),
  noteFrigo: z.boolean().optional(),
});

export const EtapeImportSchema = z.object({
  ordre: z.number().int().nonnegative(),
  texte: z.string().min(1),
  dureeMinutes: z.number().nonnegative().optional(),
});

export const RecetteImportSchema = z.object({
  tempId: z.string().min(1),
  titre: z.string().min(1),
  description: z.string().optional(),
  portions: z.number().int().positive(),
  dureePreparation: z.number().nonnegative(),
  dureeCuisson: z.number().nonnegative(),
  difficulte: DifficulteImportSchema,
  tags: z.array(z.string()).default([]),
  saison: z.array(SaisonImportSchema).optional(),
  ingredients: z.array(IngredientImportSchema).min(1),
  etapes: z.array(EtapeImportSchema).min(1),
});

export const BatchSessionImportSchema = z.object({
  tempId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date doit être au format YYYY-MM-DD"),
  dureeEstimeeMinutes: z.number().int().positive(),
  recetteTempIds: z.array(z.string()).min(1),
  notes: z.string().optional(),
});

export const SlotImportSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isRealCalendarDate, {
      message: "date impossible (jour/mois inexistant dans le calendrier)",
    }),
  repas: RepasImportSchema,
  profilsPresentsNoms: z.array(z.string()).default([]),
  invitesNoms: z.array(z.string()).default([]).optional(),
  source: SourceImportSchema.default("fresh"),
  batchSessionTempId: z.string().nullable().optional(),
  recetteTempIds: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const ShoppingItemImportSchema = z.object({
  nom: z.string().min(1),
  quantite: z.number().nonnegative(),
  unite: z.string().min(1),
  rayon: RayonImportSchema,
  recetteTempIds: z.array(z.string()).default([]),
});

export const ShoppingListImportSchema = z.object({
  items: z.array(ShoppingItemImportSchema),
});

export const PlanImportSchema = z.object({
  recettes: z.array(RecetteImportSchema).min(1),
  batchSessions: z.array(BatchSessionImportSchema).default([]),
  slots: z.array(SlotImportSchema).min(1),
  shoppingList: ShoppingListImportSchema,
  commentaireGeneral: z.string().optional(),
});

export type PlanImport = z.infer<typeof PlanImportSchema>;
export type RecetteImport = z.infer<typeof RecetteImportSchema>;
export type BatchSessionImport = z.infer<typeof BatchSessionImportSchema>;
export type SlotImport = z.infer<typeof SlotImportSchema>;
export type ShoppingItemImport = z.infer<typeof ShoppingItemImportSchema>;
export type RayonImport = z.infer<typeof RayonImportSchema>;
export type RepasImport = z.infer<typeof RepasImportSchema>;

/**
 * Parse + validation du JSON brut. Lance avec un message lisible en cas
 * d'erreur de structure ; lève également si les références croisées
 * tempId sont incohérentes.
 */
export function parsePlanImport(raw: string): {
  ok: true;
  data: PlanImport;
} | {
  ok: false;
  errors: string[];
} {
  const trimmed = raw.trim();
  // Tolère un fence ```json autour
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return {
      ok: false,
      errors: [
        `JSON invalide : ${e instanceof Error ? e.message : String(e)}`,
        "Vérifie qu'il n'y a pas de virgule en trop, de guillemets non fermés, ou de caractère inattendu.",
      ],
    };
  }

  const result = PlanImportSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((iss) => {
        const path = iss.path.join(".");
        return `${path || "(racine)"} : ${iss.message}`;
      }),
    };
  }

  // Vérifs croisées tempId
  const errors: string[] = [];
  const recetteIds = new Set(result.data.recettes.map((r) => r.tempId));
  const batchIds = new Set(result.data.batchSessions.map((b) => b.tempId));

  if (recetteIds.size !== result.data.recettes.length) {
    errors.push("recettes : `tempId` doivent être uniques.");
  }
  if (batchIds.size !== result.data.batchSessions.length) {
    errors.push("batchSessions : `tempId` doivent être uniques.");
  }

  for (const [i, b] of result.data.batchSessions.entries()) {
    for (const rid of b.recetteTempIds) {
      if (!recetteIds.has(rid)) {
        errors.push(
          `batchSessions[${i}].recetteTempIds référence un recette.tempId inconnu : "${rid}"`,
        );
      }
    }
  }

  // Unicité (date, repas) : deux slots identiques partageraient le doc ID
  // `${date}_${repas}` et s'écraseraient silencieusement à l'import.
  const seenSlotKeys = new Set<string>();
  for (const s of result.data.slots) {
    const key = `${s.date}_${s.repas}`;
    if (seenSlotKeys.has(key)) {
      errors.push(
        `slots : deux créneaux partagent la même date et le même repas (${s.date} / ${s.repas}). Chaque (date, repas) doit être unique.`,
      );
    }
    seenSlotKeys.add(key);
  }

  // Fenêtre du plan : refuse un span > 31 jours (probable date aberrante).
  const slotDatesSorted = result.data.slots
    .map((s) => s.date)
    .sort();
  if (slotDatesSorted.length > 0) {
    const toLocal = (iso: string) => {
      const [y, mo, d] = iso.split("-").map(Number);
      return new Date(y, mo - 1, d);
    };
    const minDt = toLocal(slotDatesSorted[0]);
    const maxDt = toLocal(slotDatesSorted[slotDatesSorted.length - 1]);
    const spanDays =
      Math.round((maxDt.getTime() - minDt.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (spanDays > 31) {
      errors.push(
        `slots : la fenêtre du plan s'étend sur ${spanDays} jours (max 31). Vérifie les dates des créneaux.`,
      );
    }
  }

  for (const [i, s] of result.data.slots.entries()) {
    for (const rid of s.recetteTempIds) {
      if (!recetteIds.has(rid)) {
        errors.push(
          `slots[${i}].recetteTempIds référence un recette.tempId inconnu : "${rid}"`,
        );
      }
    }
    if (s.source === "batch") {
      if (!s.batchSessionTempId) {
        errors.push(
          `slots[${i}] : source = "batch" requiert batchSessionTempId.`,
        );
      } else if (!batchIds.has(s.batchSessionTempId)) {
        errors.push(
          `slots[${i}] : batchSessionTempId "${s.batchSessionTempId}" inconnu.`,
        );
      }
    }
  }

  for (const [i, it] of result.data.shoppingList.items.entries()) {
    for (const rid of it.recetteTempIds) {
      if (!recetteIds.has(rid)) {
        errors.push(
          `shoppingList.items[${i}].recetteTempIds référence un recette.tempId inconnu : "${rid}"`,
        );
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: result.data };
}
