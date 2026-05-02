/**
 * Prompts pour la génération en masse de recettes (seed du livre).
 *
 * Stratégie : on génère par batch de 20-30 recettes par appel, en variant le
 * thème entre batches. Les recettes déjà générées sont passées en "à éviter"
 * pour pousser à la diversité.
 */

export interface ProfilForSeed {
  nom: string;
  regimes: string[];
  aversions: string[];
  objectifsNutrition: string[];
  prefsCuisson: string[];
  notes?: string;
}

export interface SeedContext {
  profils: ProfilForSeed[];
  saisons: Array<"hiver" | "printemps" | "ete" | "automne">;
  /** Noms de recettes déjà générées dans la session, à ne pas répéter. */
  noms_a_eviter: string[];
}

export const SEED_SYSTEM_PROMPT = `Tu es un chef cuisinier expérimenté qui constitue un livre de recettes familial. Tu produis des recettes variées, savoureuses, réalistes et adaptées aux contraintes de cette famille.

CONTRAINTES STRICTES :
- Respecte les aversions de chaque profil (jamais cet ingrédient dans une recette destinée à toute la famille).
- Respecte les régimes (sans porc = jamais de porc/jambon/lardons, etc.).
- Respecte les ratios nutritionnels demandés. Si un profil veut "50% légumes, 35% protéines, 15% féculents", construis l'assiette ainsi : grosse moitié de légumes, portion modérée de protéine, accompagnement réduit de féculent. Mentionne ces proportions dans la description (ex: "saumon (~120g) avec ratatouille généreuse, riz basmati en accompagnement modéré").
- Privilégie les ingrédients de saison.

VARIÉTÉ MAXIMALE :
- Ne propose JAMAIS deux fois le même plat dans cette session.
- Varie les sources de protéines : viande blanche, viande rouge, poisson blanc, poisson gras, fruits de mer, œufs, légumineuses, tofu, fromage.
- Varie les styles culinaires : français traditionnel, méditerranéen, italien, espagnol, grec, marocain, libanais, turc, indien, thaï, vietnamien, japonais, coréen, mexicain, péruvien, nordique, etc.
- Varie les modes de cuisson : poêle, four, vapeur, bouilli, mijoté, grillade, cru, plancha, papillote, wok.
- Varie les textures : croustillant, fondant, frais, crémeux, gratiné.

QUALITÉ :
- Ingrédients réalistes et trouvables au supermarché.
- Quantités précises pour 4 personnes (sauf si batch cooking).
- Étapes claires, numérotées, avec dureeMinutes pour les étapes minutées (cuisson, repos).
- Tags pertinents (max 5 par recette).

BATCH COOKING :
- Si estBatch=true, la recette doit produire 8 portions (2× familial) et bien se conserver 3-5 jours.
- Idéal : soupes, currys, ragoûts, tajines, lasagnes, gratins, salades céréales.

FORMAT DE SORTIE :
Tu réponds STRICTEMENT en JSON conforme au schéma fourni. Pas de markdown, pas de commentaires, pas de texte avant/après. Le JSON doit avoir une clé "recettes" qui est un tableau.`;

export interface SeedBatchRequest {
  count: number;
  /** Thème dominant pour ce batch (ex: "méditerranéen", "asiatique", "petit-déjeuner"). */
  theme: string;
  /** Type de repas dominant (ex: "déjeuner et dîner familiaux", "petit-déjeuner"). */
  repasType: string;
  /** Doit inclure des recettes batch (préparation pour plusieurs jours) ? */
  includeBatch?: boolean;
}

export function buildSeedUserPrompt(
  ctx: SeedContext,
  req: SeedBatchRequest,
): string {
  const profilsBlock = ctx.profils
    .map((p) => {
      const parts: string[] = [`- ${p.nom} :`];
      if (p.regimes.length) parts.push(`  · Régimes : ${p.regimes.join(", ")}`);
      if (p.aversions.length) parts.push(`  · Aversions : ${p.aversions.join(", ")}`);
      if (p.objectifsNutrition.length)
        parts.push(`  · Objectifs nutrition : ${p.objectifsNutrition.join(", ")}`);
      if (p.prefsCuisson.length)
        parts.push(`  · Cuisson : ${p.prefsCuisson.join(", ")}`);
      if (p.notes) parts.push(`  · Notes : ${p.notes}`);
      if (
        !p.regimes.length &&
        !p.aversions.length &&
        !p.objectifsNutrition.length &&
        !p.prefsCuisson.length &&
        !p.notes
      ) {
        parts.push("  · Aucune contrainte particulière");
      }
      return parts.join("\n");
    })
    .join("\n");

  const saisonsLabel = ctx.saisons.join(" et ");
  const aEviter = ctx.noms_a_eviter.length
    ? `\nDÉJÀ DANS LE LIVRE (ne propose AUCUN plat dont le nom est similaire) :\n${ctx.noms_a_eviter.map((n) => `- ${n}`).join("\n")}`
    : "";

  return `Génère ${req.count} recettes pour ce livre familial.

PROFILS DE LA FAMILLE :
${profilsBlock}

ORIENTATION DE CE BATCH :
- Thème : ${req.theme}
- Type de repas : ${req.repasType}
- Saisons : ${saisonsLabel} (privilégie les ingrédients de cette période)
${req.includeBatch ? "- INCLUS au moins 30% de recettes en batch cooking (estBatch=true, 8 portions, conservation 3-5j)" : "- Recettes individuelles (estBatch=false), 4 portions"}
${aEviter}

Retourne un JSON de la forme :
{
  "recettes": [
    {
      "nom": "string court et évocateur (ex: 'Tajine d'agneau aux abricots')",
      "description": "1-2 phrases d'intro + mention des ratios si pertinent",
      "portions": 4 (ou 8 si batch),
      "tempsPrepMinutes": int,
      "tempsCuissonMinutes": int,
      "difficulte": 1 | 2 | 3,
      "ingredients": [
        { "libelle": "string", "quantite": "string", "unite": "g|ml|pièce|cs|cc|botte|...", "rayon": "frais-fruits-legumes|frais-laitier|frais-boucherie|frais-poissonnerie|sec-epicerie|surgele|boulangerie|autre" }
      ],
      "etapes": [
        { "ordre": 1, "description": "string complète et claire", "dureeMinutes": int (0 si pas minuté) }
      ],
      "tags": ["string", ...] (max 5 : style culinaire + caractéristique principale, ex: ["méditerranéen", "végétarien", "rapide"]),
      "saison": ["printemps"|"ete"|"automne"|"hiver"|"toutes"],
      "estBatch": boolean,
      "styleCulinaire": "string" (ex: "français", "italien", "thaï"),
      "proteinePrincipale": "viande-blanche|viande-rouge|poisson|oeufs|legumineuses|tofu|fromage|aucune",
      "modeCuissonPrincipal": "poele|four|vapeur|mijote|grillade|cru|wok|papillote",
      "tempsTotal": "<15min" | "15-30min" | "30-60min" | ">60min"
    }
  ]
}

VRAIMENT DIFFÉRENTES les unes des autres dans ce batch. Pas 5 plats de pâtes, pas 3 currys.`;
}

/**
 * Liste de thèmes pour rotation des batches.
 * Permet de couvrir un large spectre culinaire en 10-15 batches.
 */
export const SEED_THEMES_PRINTEMPS_ETE: SeedBatchRequest[] = [
  { count: 25, theme: "français traditionnel revisité", repasType: "déjeuner et dîner", includeBatch: false },
  { count: 25, theme: "méditerranéen (italien, espagnol, grec)", repasType: "déjeuner et dîner", includeBatch: false },
  { count: 25, theme: "moyen-oriental (libanais, marocain, turc)", repasType: "déjeuner et dîner", includeBatch: true },
  { count: 25, theme: "asiatique varié (japonais, coréen, vietnamien, thaï)", repasType: "déjeuner et dîner", includeBatch: false },
  { count: 25, theme: "indien et pakistanais", repasType: "dîner", includeBatch: true },
  { count: 25, theme: "salades composées et bowls printemps-été", repasType: "déjeuner", includeBatch: false },
  { count: 25, theme: "grillades et plats au barbecue", repasType: "dîner d'été", includeBatch: false },
  { count: 25, theme: "soupes froides, gaspachos, smoothies bowls", repasType: "déjeuner d'été léger", includeBatch: false },
  { count: 20, theme: "petits-déjeuners variés (sucré et salé)", repasType: "petit-déjeuner", includeBatch: true },
  { count: 25, theme: "végétariens et végans créatifs", repasType: "déjeuner et dîner", includeBatch: true },
  { count: 25, theme: "poissons et fruits de mer", repasType: "dîner", includeBatch: false },
  { count: 25, theme: "plats du dimanche, mijotés conviviaux", repasType: "déjeuner familial", includeBatch: true },
];
