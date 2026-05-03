/**
 * Validation post-génération des contraintes des profils familiaux.
 *
 * Le LLM peut ignorer 1-5% des contraintes même quand elles sont en system prompt.
 * Sur 500 recettes ça fait 5-25 hors-cadre — inacceptable pour un livre familial où
 * on fait CONFIANCE à la liste.
 *
 * Ce module :
 *  - convertit les "régimes" en texte libre (ex: "sans porc", "végétarien") en
 *    listes d'ingrédients interdits, via un mapping connu ;
 *  - agrège ces interdits avec les "aversions" en texte libre des profils ;
 *  - vérifie chaque recette générée et rejette celles qui mentionnent un terme
 *    interdit dans leurs ingrédients (matching tolérant : sans accents,
 *    minuscules, pluriels basiques).
 */

import type { ProfilForSeed } from "./prompts.ts";
import type { RecetteGeneree } from "./validation.ts";

/**
 * Mapping régime → liste de termes ingrédient interdits.
 * Les clés sont normalisées (lowercase, sans accents, espaces simples).
 * Plusieurs formulations courantes sont mappées vers la même liste via
 * `REGIME_ALIASES` ci-dessous.
 */
const REGIME_INTERDITS: Record<string, string[]> = {
  "sans porc": [
    "porc", "jambon", "lardons", "lardon", "bacon", "saucisse", "saucisses",
    "chorizo", "boudin", "andouille", "andouillette", "pancetta", "speck",
    "pata negra", "saucisson", "rillettes", "rillette", "pieds de porc",
    "echine", "echines", "travers de porc", "filet mignon de porc",
    "coppa", "guanciale", "lard", "couenne", "saindoux",
  ],
  "sans gluten": [
    "ble", "farine de ble", "pates", "pate", "couscous", "boulgour",
    "semoule", "pain", "pain de mie", "biscuits", "biscuit", "chapelure",
    "seigle", "orge", "epeautre", "kamut", "triticale", "spaghetti",
    "tagliatelle", "lasagne", "lasagnes", "pizza", "tortilla de ble",
    "wrap", "naan", "pita", "pitas", "brioche", "baguette",
  ],
  "vegetarien": [
    // Viandes
    "porc", "boeuf", "veau", "agneau", "poulet", "dinde", "canard", "lapin",
    "pintade", "caille", "pigeon", "cheval", "gibier", "sanglier", "chevreuil",
    "viande", "viande hachee", "steak", "steak hache", "rosbif", "roti",
    "escalope", "cotelette", "cuisse de poulet", "filet de boeuf",
    "filet de poulet", "blanc de poulet", "blanc de dinde", "magret",
    // Charcuterie
    "jambon", "lardons", "lardon", "bacon", "saucisse", "saucisses", "merguez",
    "chorizo", "boudin", "andouille", "pate en croute", "pate", "rillettes",
    "saucisson", "salami", "mortadelle", "speck", "pancetta", "coppa",
    // Poissons et fruits de mer
    "saumon", "thon", "cabillaud", "merlu", "lieu", "lieu jaune", "lieu noir",
    "anchois", "sardine", "sardines", "hareng", "maquereau", "truite", "bar",
    "dorade", "sole", "limande", "raie", "lotte", "rouget", "mulet", "espadon",
    "poisson", "poissons", "filet de poisson",
    "crevette", "crevettes", "moule", "moules", "huitre", "huitres",
    "calamar", "calamars", "encornet", "poulpe", "seiche", "langouste",
    "homard", "ecrevisse", "coquille saint jacques", "coquilles saint jacques",
    "saint jacques", "praire", "palourde", "bulot", "bigorneau",
    "fruits de mer", "surimi", "tarama",
    // Bouillons / fonds non veg
    "bouillon de boeuf", "bouillon de poulet", "fond de veau",
  ],
  "vegan": [
    // Inclut tout du végétarien
    "porc", "boeuf", "veau", "agneau", "poulet", "dinde", "canard", "lapin",
    "viande", "jambon", "lardons", "bacon", "saucisse", "merguez", "chorizo",
    "boudin", "saucisson", "saumon", "thon", "cabillaud", "anchois", "sardine",
    "hareng", "maquereau", "truite", "poisson", "crevette", "crevettes",
    "moule", "moules", "huitre", "calamar", "fruits de mer",
    // Produits laitiers
    "lait", "lait de vache", "beurre", "fromage", "fromages", "yaourt",
    "yaourts", "creme", "creme fraiche", "creme liquide", "mascarpone",
    "ricotta", "mozzarella", "parmesan", "comte", "gruyere", "emmental",
    "feta", "chevre", "brebis", "camembert", "brie", "roquefort", "bleu",
    "raclette", "fromage blanc", "petit suisse", "lait concentre",
    // Œufs
    "oeuf", "oeufs", "blanc d'oeuf", "jaune d'oeuf", "jaunes d'oeufs",
    // Autres
    "miel", "gelatine", "gelatine de porc", "ghee",
  ],
  "sans poisson": [
    "saumon", "thon", "cabillaud", "merlu", "lieu", "anchois", "sardine",
    "sardines", "hareng", "maquereau", "truite", "bar", "dorade", "sole",
    "limande", "raie", "lotte", "rouget", "mulet", "espadon", "poisson",
    "poissons", "filet de poisson", "tarama",
  ],
  "sans fruits de mer": [
    "crevette", "crevettes", "moule", "moules", "huitre", "huitres",
    "calamar", "calamars", "encornet", "poulpe", "seiche", "langouste",
    "homard", "ecrevisse", "coquille saint jacques", "saint jacques",
    "praire", "palourde", "bulot", "bigorneau", "fruits de mer", "surimi",
  ],
  "sans lactose": [
    "lait", "beurre", "fromage", "fromages", "yaourt", "yaourts", "creme",
    "creme fraiche", "creme liquide", "mascarpone", "ricotta", "mozzarella",
    "parmesan", "comte", "gruyere", "emmental", "feta", "chevre", "brebis",
    "camembert", "brie", "roquefort", "bleu", "fromage blanc",
  ],
  "sans oeuf": [
    "oeuf", "oeufs", "blanc d'oeuf", "jaune d'oeuf", "jaunes d'oeufs",
    "mayonnaise", "meringue",
  ],
  "sans noix": [
    "noix", "noisette", "noisettes", "amande", "amandes", "pistache",
    "pistaches", "noix de cajou", "noix du bresil", "noix de pecan",
    "noix de macadamia", "praline", "praliné", "pralin",
  ],
  "sans arachide": [
    "arachide", "arachides", "cacahuete", "cacahuetes", "beurre de cacahuete",
    "huile d'arachide",
  ],
  "halal": [
    "porc", "jambon", "lardons", "bacon", "saucisson", "chorizo", "pancetta",
    "speck", "coppa", "rillettes", "boudin", "vin", "vin blanc", "vin rouge",
    "biere", "alcool", "rhum", "cognac", "kirsch",
  ],
  "casher": [
    "porc", "jambon", "lardons", "bacon", "saucisson", "chorizo", "lapin",
    "cheval", "crevette", "moule", "huitre", "calamar", "homard", "langouste",
    "fruits de mer",
  ],
};

/**
 * Aliases : permet d'écrire le régime sous plusieurs formes côté profil et de
 * remonter à la même liste d'interdits.
 */
const REGIME_ALIASES: Record<string, string> = {
  "sans porc": "sans porc",
  "no pork": "sans porc",
  "pas de porc": "sans porc",
  "sans gluten": "sans gluten",
  "gluten free": "sans gluten",
  "no gluten": "sans gluten",
  "vegetarien": "vegetarien",
  "vegetarienne": "vegetarien",
  "veggie": "vegetarien",
  "vegetarian": "vegetarien",
  "vegan": "vegan",
  "vegane": "vegan",
  "vegetalien": "vegan",
  "vegetalienne": "vegan",
  "sans poisson": "sans poisson",
  "sans fruits de mer": "sans fruits de mer",
  "sans crustaces": "sans fruits de mer",
  "sans lactose": "sans lactose",
  "lactose free": "sans lactose",
  "sans produits laitiers": "sans lactose",
  "sans laitier": "sans lactose",
  "sans oeuf": "sans oeuf",
  "sans oeufs": "sans oeuf",
  "sans noix": "sans noix",
  "sans fruits a coque": "sans noix",
  "sans arachide": "sans arachide",
  "sans cacahuetes": "sans arachide",
  "halal": "halal",
  "casher": "casher",
  "kasher": "casher",
  "kosher": "casher",
};

/**
 * Normalise un terme ingrédient ou régime pour le matching :
 * lowercase, sans accents, espaces simples, sans ponctuation.
 */
export function normalizeTerm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pluriel basique : retire un "s" ou "x" final pour aider le matching
 * "tomates" / "tomate", "choux" / "chou".
 */
function singularize(s: string): string {
  if (s.length > 3 && (s.endsWith("s") || s.endsWith("x"))) {
    return s.slice(0, -1);
  }
  return s;
}

/**
 * Calcule l'ensemble agrégé des termes interdits pour un foyer, à partir
 * de tous ses profils. Un terme interdit pour UN profil est interdit pour
 * toute la famille (la recette est partagée).
 *
 * Retourne aussi une trace pour debug : qui a apporté quoi.
 */
export interface BannedTermsResult {
  /** Set de termes normalisés interdits (pour matching). */
  banned: Set<string>;
  /** Détail par origine pour log/debug. */
  sources: Array<{
    profil: string;
    type: "aversion" | "regime";
    raw: string;
    expandsTo: string[];
  }>;
}

export function buildBannedTerms(profils: ProfilForSeed[]): BannedTermsResult {
  const banned = new Set<string>();
  const sources: BannedTermsResult["sources"] = [];

  for (const p of profils) {
    // Aversions : terme exact saisi par l'utilisateur (texte libre).
    for (const a of p.aversions) {
      const norm = singularize(normalizeTerm(a));
      if (!norm) continue;
      banned.add(norm);
      sources.push({
        profil: p.nom,
        type: "aversion",
        raw: a,
        expandsTo: [norm],
      });
    }
    // Régimes : on tente le mapping, sinon on ignore (le LLM gérera).
    for (const r of p.regimes) {
      const key = normalizeTerm(r);
      const aliasKey = REGIME_ALIASES[key];
      if (!aliasKey) continue; // régime libre non mappé, on laisse au LLM
      const list = REGIME_INTERDITS[aliasKey] ?? [];
      for (const t of list) {
        const n = singularize(normalizeTerm(t));
        if (n) banned.add(n);
      }
      sources.push({
        profil: p.nom,
        type: "regime",
        raw: r,
        expandsTo: list,
      });
    }
  }

  return { banned, sources };
}

/**
 * Vérifie qu'une recette ne contient AUCUN terme interdit dans ses ingrédients.
 * Matching word-boundary (token) après normalisation et singularisation.
 */
export interface ConstraintCheckResult {
  ok: boolean;
  /** Liste des termes interdits trouvés, et dans quel ingrédient. */
  violations: Array<{ term: string; ingredient: string }>;
}

export function checkRecetteConstraints(
  recette: RecetteGeneree,
  banned: Set<string>,
): ConstraintCheckResult {
  if (banned.size === 0) return { ok: true, violations: [] };

  const violations: ConstraintCheckResult["violations"] = [];

  for (const ing of recette.ingredients) {
    const normLib = normalizeTerm(ing.libelle);
    // tokenize en mots (préserve les apostrophes type "d'oeuf")
    const tokens = normLib.split(" ").filter(Boolean);
    // Construit aussi les bigrammes (pour matcher "fruits de mer", "noix de cajou", etc.)
    const candidates = new Set<string>();
    for (const t of tokens) {
      candidates.add(t);
      candidates.add(singularize(t));
    }
    for (let i = 0; i < tokens.length - 1; i++) {
      candidates.add(`${tokens[i]} ${tokens[i + 1]}`);
      candidates.add(`${tokens[i]} ${singularize(tokens[i + 1])}`);
    }
    for (let i = 0; i < tokens.length - 2; i++) {
      candidates.add(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
    }
    for (const c of candidates) {
      if (banned.has(c)) {
        violations.push({ term: c, ingredient: ing.libelle });
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Construit le bloc "INGRÉDIENTS STRICTEMENT INTERDITS" à coller dans le
 * user prompt. Plus c'est explicite et numéroté, plus le LLM y prête attention.
 */
export function formatBannedBlockForPrompt(
  result: BannedTermsResult,
): string {
  if (result.banned.size === 0) return "";
  const list = Array.from(result.banned).sort();
  const lines = list.map((t, i) => `  ${i + 1}. ${t}`);
  const sourcesByProfil = new Map<string, string[]>();
  for (const s of result.sources) {
    const arr = sourcesByProfil.get(s.profil) ?? [];
    arr.push(`${s.type === "aversion" ? "aversion" : "régime"} « ${s.raw} »`);
    sourcesByProfil.set(s.profil, arr);
  }
  const sourceLines: string[] = [];
  for (const [profil, items] of sourcesByProfil) {
    sourceLines.push(`  - ${profil} : ${items.join(", ")}`);
  }
  return `\n⛔ INGRÉDIENTS STRICTEMENT INTERDITS (raisons à la fin)
Si UN SEUL de ces termes apparaît dans la liste d'ingrédients d'une recette, tu ne dois PAS produire cette recette. Cherche une alternative.
${lines.join("\n")}

Origines de ces interdits :
${sourceLines.join("\n")}
`;
}
