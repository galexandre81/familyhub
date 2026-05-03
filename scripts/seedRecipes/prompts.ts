/**
 * Prompts pour la génération en masse de recettes (seed du livre).
 *
 * Stratégie : on génère par batch de 20-30 recettes par appel, en variant le
 * thème entre batches. Les recettes déjà générées sont passées en "à éviter"
 * pour pousser à la diversité.
 *
 * CONTRAINTES PROFILS : on injecte les aversions/régimes deux fois :
 *   1. dans le system prompt (consigne de comportement)
 *   2. dans le user prompt en bloc explicite "INGRÉDIENTS INTERDITS"
 * et un validateur post-génération (`constraints.ts`) rejette toute recette
 * qui contiendrait quand même un terme interdit.
 */

export interface ProfilForSeed {
  nom: string;
  regimes: string[];
  aversions: string[];
  objectifsNutrition: string[];
  prefsCuisson: string[];
  notes?: string;
}

export type RepasType =
  | "petit-dej-sale"
  | "petit-dej-sucre"
  | "dejeuner"
  | "diner"
  | "tout";

export interface SeedContext {
  profils: ProfilForSeed[];
  saisons: Array<"hiver" | "printemps" | "ete" | "automne">;
  /** Noms de recettes déjà générées dans la session, à ne pas répéter. */
  noms_a_eviter: string[];
  /** Bloc pré-formaté listant les ingrédients interdits. Vide si aucun. */
  bannedBlock: string;
}

export const SEED_SYSTEM_PROMPT = `Tu es un chef cuisinier expérimenté qui constitue un livre de recettes familial. Tu produis des recettes variées, savoureuses, réalistes et adaptées aux contraintes de cette famille.

🚫 CONTRAINTES NON NÉGOCIABLES :
1. INGRÉDIENTS INTERDITS : la liste fournie dans le user prompt sous "INGRÉDIENTS STRICTEMENT INTERDITS" est la règle ABSOLUE. Si UN SEUL terme de cette liste apparaît dans la liste d'ingrédients d'une recette (même en petite quantité, même en garniture, même optionnel), tu ne dois PAS produire cette recette. Cherche systématiquement une alternative : substituer la viande de porc par du poulet, le gluten par du riz/sarrasin/quinoa, le poisson par du tofu/œuf/légumineuses, etc.
2. RÉGIMES : si "végétarien" → AUCUNE viande, AUCUN poisson, AUCUN fruit de mer, AUCUNE charcuterie, AUCUN bouillon de viande/volaille. Si "vegan" → en plus, AUCUN produit laitier, AUCUN œuf, AUCUN miel.
3. RATIOS NUTRITIONNELS : si un profil veut "50% légumes, 35% protéines, 15% féculents", construis l'assiette ainsi (grosse moitié de légumes, portion modérée de protéine, accompagnement réduit de féculent). Mentionne ces proportions dans la description.
4. NOTES PERSONNELLES : les notes du profil contiennent des règles fines (ex: "ne mange pas de légumineuses entières — ballonnements ; OK houmous"). Respecte-les littéralement.
5. SAISON : privilégie les ingrédients de la saison demandée.

VARIÉTÉ MAXIMALE :
- Ne propose JAMAIS deux fois le même plat dans cette session.
- Varie les sources de protéines autorisées : viande blanche, viande rouge, poisson blanc, poisson gras, fruits de mer, œufs, légumineuses, tofu, fromage (selon ce que les régimes autorisent).
- Varie les styles culinaires : français traditionnel, méditerranéen, italien, espagnol, grec, marocain, libanais, turc, indien, thaï, vietnamien, japonais, coréen, mexicain, péruvien, nordique, etc.
- Varie les modes de cuisson : poêle, four, vapeur, bouilli, mijoté, grillade, cru, plancha, papillote, wok.
- Varie les textures : croustillant, fondant, frais, crémeux, gratiné.

QUALITÉ :
- Ingrédients réalistes et trouvables au supermarché.
- Quantités précises pour 4 personnes (sauf si batch cooking → 8 portions).
- Étapes claires, numérotées, avec dureeMinutes pour les étapes minutées (cuisson, repos).
- Tags pertinents (max 5 par recette).

BATCH COOKING :
- Si estBatch=true, la recette doit produire 8 portions (2× familial) et bien se conserver 3-5 jours.
- Idéal : soupes, currys, ragoûts, tajines, lasagnes, gratins, salades céréales, frittatas, granolas.

PETIT-DÉJEUNER SALÉ :
Quand le batch cible "petit-déjeuner salé", privilégie : œufs sous toutes formes (brouillés, omelette, mollet, poché, frittata, shakshuka, tamagoyaki), tartines salées (avocat, houmous, fromage frais, saumon fumé, sardines, anchoïade, tapenade), galettes de sarrasin, socca, pancakes salés, bowls salés (oat savoury, congee, miso porridge), petits-déjeuners du monde (full english adapté, mezze libanais, gohan japonais, congee chinois, ful medames égyptien, baleadas honduriennes, etc.). Évite les versions ultra-sucrées dans ce batch.

FORMAT DE SORTIE :
Tu réponds STRICTEMENT en JSON conforme au schéma fourni. Pas de markdown, pas de commentaires, pas de texte avant/après. Le JSON doit avoir une clé "recettes" qui est un tableau.`;

export interface SeedBatchRequest {
  count: number;
  /** Thème dominant pour ce batch (ex: "méditerranéen", "asiatique", "petit-déjeuner"). */
  theme: string;
  /** Type de repas dominant (ex: "déjeuner et dîner familiaux", "petit-déjeuner salé"). */
  repasType: string;
  /** Type de repas typé pour le tag Firestore (sert au meal planner). */
  repas: RepasType;
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
${ctx.bannedBlock}
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

VRAIMENT DIFFÉRENTES les unes des autres dans ce batch. Pas 5 plats de pâtes, pas 3 currys.
RAPPEL : aucun ingrédient de la liste INTERDITS ci-dessus, sous aucun prétexte.`;
}

/**
 * Plan de batches pour ~500 recettes printemps-été, avec petit-déjeuner
 * majoritairement salé (60 salé / 20 sucré).
 *
 * Répartition cible :
 *   - Petit-déjeuner salé : 60
 *   - Petit-déjeuner sucré : 20
 *   - Déjeuner            : 200 (light, salades, bowls, poissons, soupes froides)
 *   - Dîner               : 220 (familiaux, mijotés, ethnique varié, batch)
 *   = 500
 */
export const SEED_THEMES_PRINTEMPS_ETE: SeedBatchRequest[] = [
  // ─── PETIT-DÉJEUNER SALÉ (60) ──────────────────────────────────────────
  {
    count: 15,
    theme: "petits-déjeuners salés à base d'œufs (brouillés, omelettes, frittatas, shakshuka, tamagoyaki, œufs au plat)",
    repasType: "petit-déjeuner salé",
    repas: "petit-dej-sale",
    includeBatch: false,
  },
  {
    count: 15,
    theme: "petits-déjeuners salés tartines et pains (avocado toast, houmous-grenade, ricotta-radis, anchoïade, fromage frais-herbes, saumon fumé)",
    repasType: "petit-déjeuner salé",
    repas: "petit-dej-sale",
    includeBatch: false,
  },
  {
    count: 15,
    theme: "petits-déjeuners salés du monde (full english adapté, mezze libanais, gohan japonais, congee chinois, ful medames égyptien, galettes de sarrasin, socca, baleadas)",
    repasType: "petit-déjeuner salé",
    repas: "petit-dej-sale",
    includeBatch: false,
  },
  {
    count: 15,
    theme: "petits-déjeuners salés batch (frittata grand format, banana bread salé, cake salé courgette-feta, muffins salés, granola salé aux graines, oat savoury jar)",
    repasType: "petit-déjeuner salé",
    repas: "petit-dej-sale",
    includeBatch: true,
  },
  // ─── PETIT-DÉJEUNER SUCRÉ (20, minorité) ──────────────────────────────
  {
    count: 10,
    theme: "petits-déjeuners sucrés sains (porridge, overnight oats, smoothie bowls, chia pudding, granola maison, yaourt-fruits-graines)",
    repasType: "petit-déjeuner sucré",
    repas: "petit-dej-sucre",
    includeBatch: true,
  },
  {
    count: 10,
    theme: "petits-déjeuners sucrés gourmands (pancakes, gaufres légères, french toast, banana bread, muffins fruits, riz au lait revisité)",
    repasType: "petit-déjeuner sucré",
    repas: "petit-dej-sucre",
    includeBatch: false,
  },
  // ─── DÉJEUNER (200, light printemps-été) ──────────────────────────────
  {
    count: 25,
    theme: "salades composées et bowls printemps-été (céréales, légumes croquants, vinaigrettes inventives)",
    repasType: "déjeuner",
    repas: "dejeuner",
    includeBatch: false,
  },
  {
    count: 25,
    theme: "déjeuners méditerranéens légers (italien, espagnol, grec — antipasti, gazpacho garni, panzanella, horiatiki, focaccia)",
    repasType: "déjeuner",
    repas: "dejeuner",
    includeBatch: false,
  },
  {
    count: 25,
    theme: "déjeuners asiatiques légers (poke, sushi bowl, donburi léger, banh mi, ramen froid, soba, summer rolls)",
    repasType: "déjeuner",
    repas: "dejeuner",
    includeBatch: false,
  },
  {
    count: 25,
    theme: "soupes froides, gaspachos, vichyssoise, soupes thaïes piquantes-fraîches",
    repasType: "déjeuner d'été léger",
    repas: "dejeuner",
    includeBatch: false,
  },
  {
    count: 25,
    theme: "wraps, sandwichs élaborés, club, bagels garnis, pita farcies, quesadillas",
    repasType: "déjeuner sur le pouce",
    repas: "dejeuner",
    includeBatch: false,
  },
  {
    count: 25,
    theme: "salades céréales batch cooking (taboulé, freekeh, farro, lentilles, pois chiches — se conservent 3 jours)",
    repasType: "déjeuner batch",
    repas: "dejeuner",
    includeBatch: true,
  },
  {
    count: 25,
    theme: "déjeuners poissons rapides (tartare, ceviche, carpaccio, papillote, plancha — 20-30 min max)",
    repasType: "déjeuner",
    repas: "dejeuner",
    includeBatch: false,
  },
  {
    count: 25,
    theme: "déjeuners végétariens et végans créatifs (galettes de légumes, falafels maison, dahl frais, buddha bowls)",
    repasType: "déjeuner",
    repas: "dejeuner",
    includeBatch: true,
  },
  // ─── DÎNER (220, familiaux et mijotés) ────────────────────────────────
  {
    count: 25,
    theme: "dîners français traditionnels revisités (blanquette légère, navarin, fricassée de printemps, poulet basquaise)",
    repasType: "dîner",
    repas: "diner",
    includeBatch: false,
  },
  {
    count: 25,
    theme: "dîners méditerranéens (italien : pâtes, risottos, osso buco ; espagnol : paella, fideua ; grec : moussaka, souvlaki)",
    repasType: "dîner",
    repas: "diner",
    includeBatch: false,
  },
  {
    count: 25,
    theme: "dîners moyen-orientaux batch (libanais : kafta, kibbeh ; marocain : tajines, couscous ; turc : köfte, manti)",
    repasType: "dîner",
    repas: "diner",
    includeBatch: true,
  },
  {
    count: 25,
    theme: "dîners asiatiques (japonais : donburi, katsu ; coréen : bibimbap, bulgogi ; vietnamien : bo bun, pho ; thaï : currys, pad)",
    repasType: "dîner",
    repas: "diner",
    includeBatch: false,
  },
  {
    count: 25,
    theme: "dîners indiens et pakistanais batch (curry, dahl, biryani, korma, vindaloo, butter chicken)",
    repasType: "dîner",
    repas: "diner",
    includeBatch: true,
  },
  {
    count: 25,
    theme: "dîners grillades et plats au barbecue d'été (brochettes, grillades de viande/poisson, légumes grillés, marinades)",
    repasType: "dîner d'été",
    repas: "diner",
    includeBatch: false,
  },
  {
    count: 25,
    theme: "dîners poissons et fruits de mer (papillote, four, plancha, currys de poisson, paella aux fruits de mer)",
    repasType: "dîner",
    repas: "diner",
    includeBatch: false,
  },
  {
    count: 25,
    theme: "dîners du dimanche, mijotés conviviaux familiaux (rôtis, gratins, plats au four pour partager)",
    repasType: "dîner familial",
    repas: "diner",
    includeBatch: true,
  },
  {
    count: 20,
    theme: "dîners mexicains et sud-américains (tacos, enchiladas, fajitas, ceviches, ají de gallina)",
    repasType: "dîner",
    repas: "diner",
    includeBatch: false,
  },
];
