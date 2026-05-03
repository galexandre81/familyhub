/**
 * Règles nutrition côté seed : chargement depuis Firestore, fallback preset
 * "equilibre" par défaut, formatage pour le prompt LLM, et validation
 * post-génération (max féculents par repas + ingrédients à éviter).
 *
 * Note : le seed ne dépend pas de @family-hub/types (script isolé hors
 * workspaces). On duplique le minimum nécessaire ici, et on garde la même
 * forme que packages/types/src/kitchenBuddy/reglesNutrition.ts. Si la struct
 * évolue, mettre à jour les deux fichiers.
 */

import type { Firestore } from "firebase-admin/firestore";
import { normalizeTerm } from "./constraints.ts";
import type { RecetteGeneree } from "./validation.ts";

export type PresetNutritionId =
  | "equilibre"
  | "perte-poids"
  | "proteine"
  | "mediterraneen"
  | "vegetarien-equilibre"
  | "sans-sel-strict"
  | "custom";

export interface ReglesNutrition {
  presetId: PresetNutritionId;
  nomAffiche: string;
  ratios: { legumes: number; proteines: number; feculents: number };
  legumesPriorises: string[];
  legumesLimites: string[];
  maxFeculentsParRepas: number;
  proteineObligatoire: boolean;
  ingredientsAEviter: string[];
  notesLibres: string;
}

/**
 * Preset par défaut = note Guillaume. Doit rester aligné avec le preset
 * "equilibre" dans packages/types/src/kitchenBuddy/reglesNutrition.ts.
 */
export const DEFAULT_REGLES_NUTRITION: ReglesNutrition = {
  presetId: "equilibre",
  nomAffiche: "Équilibre Guillaume",
  ratios: { legumes: 60, proteines: 22, feculents: 18 },
  legumesPriorises: [
    "brocoli", "courgette", "épinards", "haricots verts",
    "poivrons", "choux", "chou-fleur", "choux de Bruxelles",
    "salades vertes", "endives", "asperges", "champignons",
    "aubergine", "fenouil", "céleri", "concombre",
  ],
  legumesLimites: ["carottes", "betteraves", "potiron", "patate douce"],
  maxFeculentsParRepas: 1,
  proteineObligatoire: true,
  ingredientsAEviter: [],
  notesLibres:
    "Les légumes sont l'élément principal de chaque repas (60%). " +
    "Limiter les légumes naturellement sucrés (carottes, betteraves) à moins de 50% des légumes. " +
    "Une SEULE source de féculents par repas (riz OU pâtes OU pain OU pommes de terre).",
};

export async function loadReglesNutrition(
  db: Firestore,
  householdId: string,
): Promise<ReglesNutrition> {
  const snap = await db
    .doc(`households/${householdId}/reglesNutrition/active`)
    .get();
  if (!snap.exists) return DEFAULT_REGLES_NUTRITION;
  const data = snap.data() as Partial<ReglesNutrition>;
  // Merge prudent avec les defaults pour tolérer un doc partiel.
  return {
    presetId: (data.presetId as PresetNutritionId) ?? DEFAULT_REGLES_NUTRITION.presetId,
    nomAffiche: data.nomAffiche ?? DEFAULT_REGLES_NUTRITION.nomAffiche,
    ratios: data.ratios ?? DEFAULT_REGLES_NUTRITION.ratios,
    legumesPriorises: data.legumesPriorises ?? DEFAULT_REGLES_NUTRITION.legumesPriorises,
    legumesLimites: data.legumesLimites ?? DEFAULT_REGLES_NUTRITION.legumesLimites,
    maxFeculentsParRepas:
      typeof data.maxFeculentsParRepas === "number"
        ? data.maxFeculentsParRepas
        : DEFAULT_REGLES_NUTRITION.maxFeculentsParRepas,
    proteineObligatoire:
      typeof data.proteineObligatoire === "boolean"
        ? data.proteineObligatoire
        : DEFAULT_REGLES_NUTRITION.proteineObligatoire,
    ingredientsAEviter: data.ingredientsAEviter ?? [],
    notesLibres: data.notesLibres ?? "",
  };
}

/**
 * Liste des familles de féculents reconnues. Chaque entrée est un groupe :
 * un repas peut contenir des termes du même groupe sans être considéré comme
 * "deux féculents" (ex: "spaghetti" + "pâtes" = un seul groupe pâtes).
 */
const FECULENT_GROUPS: Record<string, string[]> = {
  riz: [
    "riz", "riz basmati", "riz thaï", "riz arborio", "riz complet",
    "riz rond", "riz long", "riz à sushi", "riz noir",
  ],
  pates: [
    "pâtes", "pates", "spaghetti", "tagliatelle", "tagliatelles",
    "linguine", "fusilli", "penne", "rigatoni", "macaroni",
    "lasagne", "lasagnes", "raviolis", "ravioli", "tortellini",
    "gnocchi", "orzo", "vermicelles",
  ],
  "pommes-de-terre": [
    "pomme de terre", "pommes de terre", "patate", "patates",
    "purée de pommes de terre", "frites", "pommes vapeur", "pommes rissolées",
  ],
  pain: [
    "pain", "pain de mie", "baguette", "tortilla", "tortillas",
    "wrap", "wraps", "pita", "pitas", "naan", "ciabatta", "focaccia",
    "bagel", "bagels", "brioche",
  ],
  semoule: [
    "semoule", "couscous", "boulgour", "polenta",
  ],
  quinoa: ["quinoa", "amarante"],
  sarrasin: ["sarrasin", "kasha"],
  cereales: [
    "avoine", "flocons d'avoine", "muesli", "granola", "épeautre", "orge",
    "millet", "freekeh", "farro",
  ],
  legumineuses: [
    // Souvent considérées comme féculents partiels en diet — on les compte ici
    // pour l'application de la règle "max 1 féculent". Si on a des lentilles
    // ET du riz, c'est 2 sources dans la même assiette.
    "lentilles", "lentille corail", "haricots blancs", "haricots rouges",
    "haricots noirs", "pois chiches", "fèves", "flageolets",
  ],
};

/**
 * Détecte les groupes de féculents présents dans la liste d'ingrédients.
 * Retourne la liste des groupes uniques trouvés.
 */
export function detectFeculentGroups(recette: RecetteGeneree): string[] {
  const found = new Set<string>();
  for (const ing of recette.ingredients) {
    const norm = normalizeTerm(ing.libelle);
    for (const [group, terms] of Object.entries(FECULENT_GROUPS)) {
      for (const t of terms) {
        const tn = normalizeTerm(t);
        // match si le terme est exactement le libellé ou apparaît comme mot
        if (norm === tn || norm.split(" ").includes(tn) || norm.includes(tn)) {
          found.add(group);
          break;
        }
      }
    }
  }
  return Array.from(found);
}

export interface RatiosCheckResult {
  ok: boolean;
  violations: string[];
}

/**
 * Validateur ratios + max féculents.
 *
 * - Compte les groupes de féculents distincts → fail si > maxFeculentsParRepas.
 * - Vérifie que la recette comporte au moins un ingrédient du rayon
 *   "frais-fruits-legumes" si proteineObligatoire (heuristique : sans légume,
 *   ratios impossibles à respecter).
 * - Vérifie la présence de protéine (proteinePrincipale ≠ "aucune") si
 *   proteineObligatoire.
 *
 * On EXEMPTE les recettes de petit-déj (sucré ou salé) : les règles de
 * structure 60/22/18 ne s'appliquent pas pareil à un porridge ou des œufs
 * brouillés.
 */
export function checkReglesNutrition(
  recette: RecetteGeneree,
  regles: ReglesNutrition,
  repas: "petit-dej-sale" | "petit-dej-sucre" | "dejeuner" | "diner" | "tout",
): RatiosCheckResult {
  const violations: string[] = [];

  // Petit-déj exempté de la règle des ratios stricts.
  const isPetitDej = repas === "petit-dej-sale" || repas === "petit-dej-sucre";

  if (!isPetitDej) {
    // Max féculents
    const groups = detectFeculentGroups(recette);
    if (groups.length > regles.maxFeculentsParRepas) {
      violations.push(
        `${groups.length} sources de féculents (${groups.join(", ")}) > max ${regles.maxFeculentsParRepas}`,
      );
    }

    // Présence légumes
    const hasLegumes = recette.ingredients.some(
      (i) => i.rayon === "frais-fruits-legumes",
    );
    if (!hasLegumes) {
      violations.push("aucun légume détecté (rayon frais-fruits-legumes manquant)");
    }

    // Protéine obligatoire
    if (regles.proteineObligatoire && recette.proteinePrincipale === "aucune") {
      violations.push("protéine obligatoire mais proteinePrincipale='aucune'");
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Bloc à coller en haut du user prompt pour rappeler les règles famille.
 */
export function formatReglesBlockForPrompt(regles: ReglesNutrition): string {
  const lines: string[] = [];
  lines.push("⚖️ STRUCTURE DU REPAS — RÈGLES FAMILLE (priorité absolue, avant tout) :");
  lines.push(
    `- Ratios cibles d'une assiette : ${regles.ratios.legumes}% légumes / ${regles.ratios.proteines}% protéines / ${regles.ratios.feculents}% féculents.`,
  );
  if (regles.legumesPriorises.length) {
    lines.push(
      `- Légumes prioritaires (peu caloriques, riches en fibres) : ${regles.legumesPriorises.join(", ")}.`,
    );
  }
  if (regles.legumesLimites.length) {
    lines.push(
      `- Légumes à limiter (autorisés mais jamais majoritaires) : ${regles.legumesLimites.join(", ")}.`,
    );
  }
  lines.push(
    `- ${regles.maxFeculentsParRepas === 1 ? "UNE SEULE" : `Maximum ${regles.maxFeculentsParRepas}`} source de féculents par repas (riz OU pâtes OU pain OU pommes de terre OU semoule…), pas deux.`,
  );
  if (regles.proteineObligatoire) {
    lines.push(
      "- Protéine obligatoire à chaque déjeuner et dîner (viande, poisson, œufs, tofu, légumineuses).",
    );
  }
  if (regles.ingredientsAEviter.length) {
    lines.push(
      `- Ingrédients à éviter en plus des contraintes profils : ${regles.ingredientsAEviter.join(", ")}.`,
    );
  }
  if (regles.notesLibres.trim()) {
    lines.push("");
    lines.push(`📝 Notes additionnelles famille : ${regles.notesLibres.trim()}`);
  }
  lines.push("");
  lines.push(
    "Ces règles s'appliquent surtout aux DÉJEUNERS et DÎNERS. Les petits-déjeuners ont une structure plus libre (œufs, tartines, porridge, etc.).",
  );
  return lines.join("\n");
}
