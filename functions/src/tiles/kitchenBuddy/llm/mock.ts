/**
 * Mock LLMProvider pour le dev et les tests.
 *
 * Activé via env `MOCK_LLM=true` (cf. provider/getProvider). Permet :
 * - Dev local sans cramer du quota Gemini
 * - Tests unitaires reproductibles
 * - Tests d'intégration du chat avec scénarios scriptés
 *
 * Le mock retourne des fixtures déterministes mais non triviales :
 * un plan complet 21 slots avec recettes plausibles.
 */

import type {
  LLMChatResult,
  LLMHistoryMessage,
  LLMProvider,
  LLMStructuredResult,
  LLMToolDefinition,
} from "./provider";
import type { ChatToolName, Repas } from "../../../types";
import type { MealPlanLLMOutput } from "./validation";

const MOCK_USAGE = { inputTokens: 1500, outputTokens: 4200, cachedInputTokens: 0 };

let mockInvocationCounter = 0;

/**
 * Pool étendu pour donner de la variété au mock entre invocations.
 * À chaque appel `generateStructured`, on décale la sélection (rotation circulaire)
 * pour simuler une régénération différente — utile pour valider les flows
 * "régénérer ce slot" sans cramer du quota Gemini.
 */
function petitDejPool(): MealPlanLLMOutput["recettes"] {
  return [
    { tempId: "r-pancakes", nom: "Pancakes maison", portions: 4, tempsPrepMinutes: 10, tempsCuissonMinutes: 15, difficulte: 1, ingredients: [{ libelle: "Farine", quantite: "250", unite: "g", rayon: "sec-epicerie" }, { libelle: "Œufs", quantite: "2", unite: "pièce", rayon: "frais-laitier" }, { libelle: "Lait", quantite: "300", unite: "ml", rayon: "frais-laitier" }], etapes: [{ ordre: 1, description: "Mélanger les ingrédients secs.", dureeMinutes: 0 }, { ordre: 2, description: "Ajouter les œufs et le lait, fouetter.", dureeMinutes: 0 }, { ordre: 3, description: "Cuire en poêle 2 min de chaque côté.", dureeMinutes: 4 }], tags: ["petit-dej", "rapide"], saison: ["toutes"], estBatch: false },
    { tempId: "r-tartines", nom: "Tartines beurre confiture", portions: 4, tempsPrepMinutes: 5, tempsCuissonMinutes: 0, difficulte: 1, ingredients: [{ libelle: "Pain", quantite: "8", unite: "tranche", rayon: "boulangerie" }, { libelle: "Beurre", quantite: "50", unite: "g", rayon: "frais-laitier" }, { libelle: "Confiture", quantite: "1", unite: "pot", rayon: "sec-epicerie" }], etapes: [{ ordre: 1, description: "Tartiner.", dureeMinutes: 0 }], tags: ["petit-dej"], saison: ["toutes"], estBatch: false },
    { tempId: "r-granola", nom: "Granola maison + yaourt + fruits", portions: 4, tempsPrepMinutes: 5, tempsCuissonMinutes: 0, difficulte: 1, ingredients: [{ libelle: "Granola", quantite: "200", unite: "g", rayon: "sec-epicerie" }, { libelle: "Yaourt nature", quantite: "4", unite: "pot", rayon: "frais-laitier" }, { libelle: "Fruits frais", quantite: "300", unite: "g", rayon: "frais-fruits-legumes" }], etapes: [{ ordre: 1, description: "Servir le yaourt avec granola et fruits par-dessus.", dureeMinutes: 0 }], tags: ["petit-dej", "sain"], saison: ["toutes"], estBatch: false },
    { tempId: "r-oeufs-brouilles", nom: "Œufs brouillés au pain grillé", portions: 4, tempsPrepMinutes: 3, tempsCuissonMinutes: 5, difficulte: 1, ingredients: [{ libelle: "Œufs", quantite: "8", unite: "pièce", rayon: "frais-laitier" }, { libelle: "Pain", quantite: "4", unite: "tranche", rayon: "boulangerie" }, { libelle: "Beurre", quantite: "30", unite: "g", rayon: "frais-laitier" }], etapes: [{ ordre: 1, description: "Battre les œufs avec sel et poivre.", dureeMinutes: 0 }, { ordre: 2, description: "Cuire à feu doux en remuant.", dureeMinutes: 4 }], tags: ["petit-dej", "protéiné"], saison: ["toutes"], estBatch: false },
  ];
}
function dejPool(): MealPlanLLMOutput["recettes"] {
  return [
    { tempId: "r-salade-poulet", nom: "Salade de poulet grillé", portions: 4, tempsPrepMinutes: 15, tempsCuissonMinutes: 15, difficulte: 1, ingredients: [{ libelle: "Blanc de poulet", quantite: "400", unite: "g", rayon: "frais-boucherie" }, { libelle: "Salade verte", quantite: "1", unite: "pièce", rayon: "frais-fruits-legumes" }, { libelle: "Tomates cerises", quantite: "200", unite: "g", rayon: "frais-fruits-legumes" }], etapes: [{ ordre: 1, description: "Griller le poulet.", dureeMinutes: 12 }, { ordre: 2, description: "Composer la salade.", dureeMinutes: 0 }], tags: ["déjeuner", "rapide"], saison: ["toutes"], estBatch: false },
    { tempId: "r-quiche-legumes", nom: "Quiche aux légumes", portions: 6, tempsPrepMinutes: 20, tempsCuissonMinutes: 35, difficulte: 2, ingredients: [{ libelle: "Pâte brisée", quantite: "1", unite: "pièce", rayon: "frais-laitier" }, { libelle: "Œufs", quantite: "4", unite: "pièce", rayon: "frais-laitier" }, { libelle: "Crème fraîche", quantite: "200", unite: "ml", rayon: "frais-laitier" }, { libelle: "Légumes", quantite: "400", unite: "g", rayon: "frais-fruits-legumes" }], etapes: [{ ordre: 1, description: "Foncer le moule.", dureeMinutes: 0 }, { ordre: 2, description: "Cuire au four 35 min à 180°C.", dureeMinutes: 35 }], tags: ["dîner", "végétarien"], saison: ["toutes"], estBatch: false },
    { tempId: "r-buddha-bowl", nom: "Buddha bowl quinoa-tofu", portions: 4, tempsPrepMinutes: 15, tempsCuissonMinutes: 20, difficulte: 1, ingredients: [{ libelle: "Quinoa", quantite: "200", unite: "g", rayon: "sec-epicerie" }, { libelle: "Tofu fumé", quantite: "300", unite: "g", rayon: "frais-laitier" }, { libelle: "Légumes variés", quantite: "500", unite: "g", rayon: "frais-fruits-legumes" }, { libelle: "Avocat", quantite: "2", unite: "pièce", rayon: "frais-fruits-legumes" }], etapes: [{ ordre: 1, description: "Cuire le quinoa.", dureeMinutes: 15 }, { ordre: 2, description: "Saisir le tofu.", dureeMinutes: 8 }, { ordre: 3, description: "Composer le bowl.", dureeMinutes: 0 }], tags: ["déjeuner", "végétarien", "sain"], saison: ["toutes"], estBatch: false },
    { tempId: "r-wrap-thon", nom: "Wrap thon-crudités", portions: 4, tempsPrepMinutes: 12, tempsCuissonMinutes: 0, difficulte: 1, ingredients: [{ libelle: "Tortillas", quantite: "4", unite: "pièce", rayon: "boulangerie" }, { libelle: "Thon en boîte", quantite: "200", unite: "g", rayon: "sec-epicerie" }, { libelle: "Crudités", quantite: "300", unite: "g", rayon: "frais-fruits-legumes" }], etapes: [{ ordre: 1, description: "Garnir et rouler.", dureeMinutes: 0 }], tags: ["déjeuner", "rapide"], saison: ["toutes"], estBatch: false },
  ];
}
function dinerPool(): MealPlanLLMOutput["recettes"] {
  return [
    { tempId: "r-risotto-champignons", nom: "Risotto aux champignons", portions: 4, tempsPrepMinutes: 10, tempsCuissonMinutes: 25, difficulte: 2, ingredients: [{ libelle: "Riz arborio", quantite: "300", unite: "g", rayon: "sec-epicerie" }, { libelle: "Champignons", quantite: "400", unite: "g", rayon: "frais-fruits-legumes" }, { libelle: "Bouillon", quantite: "1", unite: "L", rayon: "sec-epicerie" }, { libelle: "Parmesan", quantite: "80", unite: "g", rayon: "frais-laitier" }], etapes: [{ ordre: 1, description: "Faire revenir les champignons.", dureeMinutes: 8 }, { ordre: 2, description: "Ajouter le riz et le bouillon louche par louche.", dureeMinutes: 18 }], tags: ["dîner", "végétarien"], saison: ["toutes"], estBatch: false },
    { tempId: "r-saumon-legumes", nom: "Pavé de saumon, légumes vapeur", portions: 4, tempsPrepMinutes: 5, tempsCuissonMinutes: 15, difficulte: 1, ingredients: [{ libelle: "Saumon", quantite: "4", unite: "pièce", rayon: "frais-poissonnerie" }, { libelle: "Brocoli", quantite: "1", unite: "pièce", rayon: "frais-fruits-legumes" }, { libelle: "Carottes", quantite: "4", unite: "pièce", rayon: "frais-fruits-legumes" }], etapes: [{ ordre: 1, description: "Cuire les légumes vapeur.", dureeMinutes: 10 }, { ordre: 2, description: "Snacker le saumon.", dureeMinutes: 8 }], tags: ["dîner"], saison: ["toutes"], estBatch: false },
    { tempId: "r-pates-bolo", nom: "Pâtes bolognaise maison", portions: 4, tempsPrepMinutes: 15, tempsCuissonMinutes: 30, difficulte: 1, ingredients: [{ libelle: "Pâtes", quantite: "400", unite: "g", rayon: "sec-epicerie" }, { libelle: "Viande hachée", quantite: "500", unite: "g", rayon: "frais-boucherie" }, { libelle: "Sauce tomate", quantite: "1", unite: "boîte", rayon: "sec-epicerie" }], etapes: [{ ordre: 1, description: "Faire revenir la viande.", dureeMinutes: 8 }, { ordre: 2, description: "Mijoter avec la sauce.", dureeMinutes: 20 }], tags: ["dîner", "italien"], saison: ["toutes"], estBatch: false },
    { tempId: "r-curry-legumes", nom: "Curry de légumes au lait de coco", portions: 4, tempsPrepMinutes: 15, tempsCuissonMinutes: 25, difficulte: 2, ingredients: [{ libelle: "Légumes variés", quantite: "800", unite: "g", rayon: "frais-fruits-legumes" }, { libelle: "Lait de coco", quantite: "400", unite: "ml", rayon: "sec-epicerie" }, { libelle: "Pâte de curry", quantite: "2", unite: "cs", rayon: "sec-epicerie" }, { libelle: "Riz basmati", quantite: "300", unite: "g", rayon: "sec-epicerie" }], etapes: [{ ordre: 1, description: "Faire revenir les légumes.", dureeMinutes: 8 }, { ordre: 2, description: "Ajouter le lait de coco et mijoter.", dureeMinutes: 15 }], tags: ["dîner", "asiatique", "végétarien"], saison: ["toutes"], estBatch: false },
    { tempId: "r-omelette", nom: "Omelette fines herbes + salade", portions: 4, tempsPrepMinutes: 5, tempsCuissonMinutes: 8, difficulte: 1, ingredients: [{ libelle: "Œufs", quantite: "8", unite: "pièce", rayon: "frais-laitier" }, { libelle: "Herbes fraîches", quantite: "1", unite: "bouquet", rayon: "frais-fruits-legumes" }, { libelle: "Salade", quantite: "1", unite: "pièce", rayon: "frais-fruits-legumes" }], etapes: [{ ordre: 1, description: "Battre les œufs.", dureeMinutes: 0 }, { ordre: 2, description: "Cuire en omelette baveuse.", dureeMinutes: 5 }], tags: ["dîner", "rapide"], saison: ["toutes"], estBatch: false },
    { tempId: "r-poke-bowl", nom: "Poke bowl saumon-avocat", portions: 4, tempsPrepMinutes: 20, tempsCuissonMinutes: 12, difficulte: 1, ingredients: [{ libelle: "Riz à sushi", quantite: "300", unite: "g", rayon: "sec-epicerie" }, { libelle: "Saumon frais", quantite: "400", unite: "g", rayon: "frais-poissonnerie" }, { libelle: "Avocat", quantite: "2", unite: "pièce", rayon: "frais-fruits-legumes" }, { libelle: "Edamame", quantite: "200", unite: "g", rayon: "surgele" }], etapes: [{ ordre: 1, description: "Cuire le riz et l'assaisonner.", dureeMinutes: 12 }, { ordre: 2, description: "Détailler le saumon en cubes, dresser.", dureeMinutes: 8 }], tags: ["dîner", "asiatique"], saison: ["toutes"], estBatch: false },
  ];
}

/**
 * Plan factice cohérent : 21 slots remplis avec un pool varié.
 * Le `seed` (par défaut = compteur d'invocations global) décale la sélection
 * pour produire des plans différents entre appels.
 */
export function buildMockMealPlanOutput(seed = mockInvocationCounter): MealPlanLLMOutput {
  const pdejs = petitDejPool();
  const dejs = dejPool();
  const dinners = dinerPool();
  const recettes: MealPlanLLMOutput["recettes"] = [...pdejs, ...dejs, ...dinners];

  const REPAS_LIST: Repas[] = ["petitDej", "dej", "diner"];
  const slots: MealPlanLLMOutput["slots"] = [];
  for (let jour = 0; jour < 7; jour++) {
    for (const repas of REPAS_LIST) {
      const slotId = `${jour}-${repas}`;
      let pool: MealPlanLLMOutput["recettes"];
      if (repas === "petitDej") pool = pdejs;
      else if (repas === "dej") pool = dejs;
      else pool = dinners;
      // Rotation : chaque jour décale dans le pool, et le seed shifte le tout
      const idx = (jour + seed) % pool.length;
      slots.push({ slotId, recetteTempIds: [pool[idx].tempId] });
    }
  }

  const courses: MealPlanLLMOutput["courses"] = [
    { libelle: "Farine", quantite: "1", unite: "kg", rayon: "sec-epicerie" },
    { libelle: "Œufs", quantite: "18", unite: "pièce", rayon: "frais-laitier" },
    { libelle: "Lait", quantite: "1", unite: "L", rayon: "frais-laitier" },
    { libelle: "Yaourt nature", quantite: "8", unite: "pot", rayon: "frais-laitier" },
    { libelle: "Pain", quantite: "2", unite: "baguette", rayon: "boulangerie" },
    { libelle: "Beurre", quantite: "250", unite: "g", rayon: "frais-laitier" },
    { libelle: "Légumes variés", quantite: "2", unite: "kg", rayon: "frais-fruits-legumes" },
    { libelle: "Salade verte", quantite: "2", unite: "pièce", rayon: "frais-fruits-legumes" },
    { libelle: "Avocat", quantite: "4", unite: "pièce", rayon: "frais-fruits-legumes" },
    { libelle: "Blanc de poulet", quantite: "400", unite: "g", rayon: "frais-boucherie" },
    { libelle: "Saumon frais", quantite: "800", unite: "g", rayon: "frais-poissonnerie" },
    { libelle: "Viande hachée", quantite: "500", unite: "g", rayon: "frais-boucherie" },
    { libelle: "Tofu fumé", quantite: "300", unite: "g", rayon: "frais-laitier" },
    { libelle: "Riz", quantite: "1", unite: "kg", rayon: "sec-epicerie" },
    { libelle: "Pâtes", quantite: "400", unite: "g", rayon: "sec-epicerie" },
    { libelle: "Quinoa", quantite: "200", unite: "g", rayon: "sec-epicerie" },
    { libelle: "Lait de coco", quantite: "400", unite: "ml", rayon: "sec-epicerie" },
  ];

  return { recettes, slots, courses };

}

export interface MockChatScript {
  /** Réponse texte du LLM. */
  assistantMessage: string;
  /** Tool calls que le LLM va "appeler" en réponse au prochain message user. */
  toolCalls: Array<{ name: ChatToolName; args: Record<string, unknown> }>;
}

/**
 * Mock provider pour les tests. Optionnellement scriptable :
 * - `chatScript` consommé séquentiellement à chaque appel chat()
 * - `structuredOverride` remplace l'output meal plan par défaut
 */
export function createMockProvider(opts?: {
  chatScript?: MockChatScript[];
  structuredOverride?: unknown;
}): LLMProvider {
  let chatIdx = 0;
  return {
    name: "mock",

    async generateStructured<T>(): Promise<LLMStructuredResult<T>> {
      // Incrémente le compteur global pour que les régénérations successives
      // retournent des plans différents (rotation dans les pools de recettes).
      mockInvocationCounter += 1;
      const data = (opts?.structuredOverride ?? buildMockMealPlanOutput()) as T;
      return { data, usage: MOCK_USAGE, model: "mock-flash" };
    },

    async chat(args: {
      systemPrompt: string;
      history: LLMHistoryMessage[];
      userMessage: string;
      tools: LLMToolDefinition[];
    }): Promise<LLMChatResult> {
      void args;
      const script = opts?.chatScript?.[chatIdx];
      chatIdx++;
      if (script) {
        return {
          assistantMessage: script.assistantMessage,
          toolCalls: script.toolCalls,
          usage: { inputTokens: 800, outputTokens: 200 },
          model: "mock-flash",
        };
      }
      return {
        assistantMessage: "Mock par défaut : aucune action.",
        toolCalls: [
          {
            name: "respondToUser",
            args: { message: "Mock par défaut : aucune action." },
          },
        ],
        usage: { inputTokens: 800, outputTokens: 100 },
        model: "mock-flash",
      };
    },
  };
}
