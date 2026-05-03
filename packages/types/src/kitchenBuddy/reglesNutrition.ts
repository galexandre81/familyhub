import type { Timestamp } from "../common";

/**
 * Règles structurelles de nutrition au niveau **foyer** (pas par profil).
 *
 * Ces règles dictent :
 *   - les ratios cibles d'une assiette (légumes / protéines / féculents)
 *   - les ingrédients privilégiés / limités
 *   - la règle "max N féculents par repas"
 *   - une obligation de protéine ou non
 *
 * Stockées dans `households/{hid}/reglesNutrition/active` (un seul doc).
 *
 * Le seed et le meal planner les lisent pour :
 *   - injecter ces règles en haut du prompt LLM
 *   - rejeter (validateur) les recettes qui les violent
 *   - scorer les recettes selon leur compatibilité au preset actif
 */

/**
 * Identifiant d'un preset prédéfini, ou "custom" si le foyer a tout réécrit.
 * Les presets sont définis en dur dans `NUTRITION_PRESETS` (pas en base) :
 * ajouter un preset = ajouter une entrée dans la lib + push de code.
 */
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
  /** Nom court affiché dans l'UI (ex: "Équilibre Guillaume"). */
  nomAffiche: string;
  /** Ratios cibles d'une assiette ; somme attendue = 100. */
  ratios: {
    legumes: number;
    proteines: number;
    feculents: number;
  };
  /**
   * Légumes prioritaires : peu caloriques, riches en fibres.
   * Si une recette met l'accent sur ceux-ci, +bonus côté scoring.
   */
  legumesPriorises: string[];
  /**
   * Légumes autorisés mais à limiter (ex: carottes, betteraves) — naturellement
   * sucrés. Le validateur peut warn s'ils sont majoritaires en grammage.
   */
  legumesLimites: string[];
  /**
   * Nombre maximum de sources distinctes de féculents par repas.
   * Ex: 1 → on veut riz OU pain OU pâtes, mais pas deux à la fois.
   */
  maxFeculentsParRepas: number;
  /**
   * Protéine obligatoire à chaque repas principal (déjeuner / dîner) ?
   * Pour "perte-poids" et "proteine" : true. Petit-déj exempté quoi qu'il arrive.
   */
  proteineObligatoire: boolean;
  /**
   * Liste d'ingrédients ou de catégories à éviter en plus des contraintes profils.
   * Ex: pour "sans-sel-strict" → "charcuterie", "sauce soja", "fromages affinés".
   */
  ingredientsAEviter: string[];
  /**
   * Note libre additionnelle, injectée verbatim dans le prompt LLM après les
   * règles structurelles. Permet d'ajouter des nuances qui ne rentrent pas
   * dans les champs structurés.
   */
  notesLibres: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Library des presets prédéfinis. Le foyer peut en choisir un, ou passer en
 * "custom" pour réécrire chaque champ.
 *
 * Le preset par défaut est "equilibre" (= note Guillaume).
 */
export const NUTRITION_PRESETS: Record<
  Exclude<PresetNutritionId, "custom">,
  Omit<ReglesNutrition, "createdAt" | "updatedAt" | "presetId">
> = {
  equilibre: {
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
  },
  "perte-poids": {
    nomAffiche: "Perte de poids",
    ratios: { legumes: 65, proteines: 25, feculents: 10 },
    legumesPriorises: [
      "brocoli", "courgette", "épinards", "haricots verts", "poivrons",
      "choux", "salades vertes", "endives", "asperges", "champignons",
      "concombre", "céleri", "fenouil",
    ],
    legumesLimites: ["carottes", "betteraves", "patate douce", "potiron"],
    maxFeculentsParRepas: 1,
    proteineObligatoire: true,
    ingredientsAEviter: [
      "sucre", "sirop", "miel ajouté", "huile en grande quantité",
      "fromage gras", "crème", "charcuterie",
    ],
    notesLibres:
      "Repas hypocaloriques mais rassasiants. Féculents complets uniquement (riz complet, " +
      "quinoa, sarrasin, lentilles). Pas de sucre ajouté, pas de plats panés/frits. " +
      "Cuisson vapeur, four, plancha privilégiée. Protéine maigre à chaque repas.",
  },
  proteine: {
    nomAffiche: "Régime protéiné",
    ratios: { legumes: 40, proteines: 40, feculents: 20 },
    legumesPriorises: [
      "brocoli", "épinards", "haricots verts", "poivrons", "courgette",
      "champignons", "asperges", "choux",
    ],
    legumesLimites: [],
    maxFeculentsParRepas: 1,
    proteineObligatoire: true,
    ingredientsAEviter: [],
    notesLibres:
      "Au moins 30g de protéine animale (viande, poisson, œufs, fromage maigre) " +
      "ou 25g de protéine végétale (légumineuses + céréale complémentaire) par repas. " +
      "Idéal sport / prise de masse / récup. Glucides ciblés autour de l'effort.",
  },
  mediterraneen: {
    nomAffiche: "Méditerranéen",
    ratios: { legumes: 55, proteines: 20, feculents: 25 },
    legumesPriorises: [
      "tomates", "courgette", "aubergine", "poivrons", "épinards",
      "salades vertes", "fenouil", "artichaut", "concombre", "olives",
    ],
    legumesLimites: [],
    maxFeculentsParRepas: 1,
    proteineObligatoire: false,
    ingredientsAEviter: ["beurre", "saindoux", "crème"],
    notesLibres:
      "Huile d'olive comme matière grasse principale. Poisson 2-3 fois par semaine. " +
      "Légumineuses régulières (pois chiches, lentilles). Peu de viande rouge. " +
      "Céréales complètes (boulgour, semoule complète, pain complet). Herbes fraîches généreuses.",
  },
  "vegetarien-equilibre": {
    nomAffiche: "Végétarien équilibré",
    ratios: { legumes: 55, proteines: 25, feculents: 20 },
    legumesPriorises: [
      "brocoli", "épinards", "courgette", "poivrons", "champignons",
      "haricots verts", "choux", "salades vertes", "tomates",
    ],
    legumesLimites: [],
    maxFeculentsParRepas: 1,
    proteineObligatoire: true,
    ingredientsAEviter: [],
    notesLibres:
      "Protéines végétales en priorité : légumineuses (lentilles, pois chiches, haricots) + " +
      "céréales complémentaires pour acides aminés complets. Œufs et laitiers OK. " +
      "Tofu et tempeh régulièrement. Fer et B12 via œufs / fromage / levure maltée.",
  },
  "sans-sel-strict": {
    nomAffiche: "Sans sel strict",
    ratios: { legumes: 60, proteines: 22, feculents: 18 },
    legumesPriorises: [
      "brocoli", "courgette", "épinards", "haricots verts", "poivrons",
      "choux", "salades vertes", "asperges", "champignons",
    ],
    legumesLimites: ["carottes", "betteraves"],
    maxFeculentsParRepas: 1,
    proteineObligatoire: true,
    ingredientsAEviter: [
      "sel", "sel fin", "sel de mer", "fleur de sel", "gros sel",
      "sauce soja", "sauce nuoc-mâm", "bouillon cube", "bouillon en poudre",
      "charcuterie", "jambon", "lardons", "saucisse", "saucisson", "chorizo",
      "fromage affiné", "feta", "parmesan", "roquefort", "olives en saumure",
      "câpres", "anchois", "sardines en boîte", "thon en boîte",
      "moutarde forte", "ketchup", "sauce barbecue",
      "pain industriel", "biscuits salés",
    ],
    notesLibres:
      "AUCUN sel ajouté, AUCUN produit transformé salé. Assaisonnement avec : herbes " +
      "fraîches, épices non salées, citron, vinaigre, ail, oignon, échalote. " +
      "Bouillons maison non salés uniquement. Lire les étiquettes — la plupart des " +
      "conserves contiennent du sel ajouté.",
  },
};

/**
 * Construit l'objet ReglesNutrition complet pour un preset donné.
 */
export function buildReglesFromPreset(presetId: Exclude<PresetNutritionId, "custom">): ReglesNutrition {
  return {
    presetId,
    ...NUTRITION_PRESETS[presetId],
  };
}

/**
 * Preset par défaut quand aucune règle nutrition n'est configurée pour le foyer.
 * Choix : "equilibre" (= note Guillaume), c'est le plus consensuel.
 */
export const DEFAULT_PRESET_ID: Exclude<PresetNutritionId, "custom"> = "equilibre";

export const DEFAULT_REGLES_NUTRITION: ReglesNutrition = buildReglesFromPreset(DEFAULT_PRESET_ID);
