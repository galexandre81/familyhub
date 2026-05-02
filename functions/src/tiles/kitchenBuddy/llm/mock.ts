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

/**
 * Plan factice cohérent : 21 slots remplis avec 7 recettes simples qui tournent.
 * Respecte le schéma Zod et l'intégrité référentielle.
 */
export function buildMockMealPlanOutput(): MealPlanLLMOutput {
  const recettes: MealPlanLLMOutput["recettes"] = [
    {
      tempId: "r-pancakes",
      nom: "Pancakes maison",
      portions: 4,
      tempsPrepMinutes: 10,
      tempsCuissonMinutes: 15,
      difficulte: 1,
      ingredients: [
        { libelle: "Farine", quantite: "250", unite: "g", rayon: "sec-epicerie" },
        { libelle: "Œufs", quantite: "2", unite: "pièce", rayon: "frais-laitier" },
        { libelle: "Lait", quantite: "300", unite: "ml", rayon: "frais-laitier" },
      ],
      etapes: [
        { ordre: 1, description: "Mélanger les ingrédients secs.", dureeMinutes: 0 },
        { ordre: 2, description: "Ajouter les œufs et le lait, fouetter.", dureeMinutes: 0 },
        { ordre: 3, description: "Cuire en poêle 2 min de chaque côté.", dureeMinutes: 4 },
      ],
      tags: ["petit-dej", "rapide"],
      saison: ["toutes"],
      estBatch: false,
    },
    {
      tempId: "r-tartines",
      nom: "Tartines beurre confiture",
      portions: 4,
      tempsPrepMinutes: 5,
      tempsCuissonMinutes: 0,
      difficulte: 1,
      ingredients: [
        { libelle: "Pain", quantite: "8", unite: "tranche", rayon: "boulangerie" },
        { libelle: "Beurre", quantite: "50", unite: "g", rayon: "frais-laitier" },
        { libelle: "Confiture", quantite: "1", unite: "pot", rayon: "sec-epicerie" },
      ],
      etapes: [{ ordre: 1, description: "Tartiner.", dureeMinutes: 0 }],
      tags: ["petit-dej"],
      saison: ["toutes"],
      estBatch: false,
    },
    {
      tempId: "r-salade-poulet",
      nom: "Salade de poulet grillé",
      portions: 4,
      tempsPrepMinutes: 15,
      tempsCuissonMinutes: 15,
      difficulte: 1,
      ingredients: [
        { libelle: "Blanc de poulet", quantite: "400", unite: "g", rayon: "frais-boucherie" },
        { libelle: "Salade verte", quantite: "1", unite: "pièce", rayon: "frais-fruits-legumes" },
        { libelle: "Tomates cerises", quantite: "200", unite: "g", rayon: "frais-fruits-legumes" },
      ],
      etapes: [
        { ordre: 1, description: "Griller le poulet.", dureeMinutes: 12 },
        { ordre: 2, description: "Composer la salade.", dureeMinutes: 0 },
      ],
      tags: ["déjeuner", "rapide"],
      saison: ["toutes"],
      estBatch: false,
    },
    {
      tempId: "r-risotto-champignons",
      nom: "Risotto aux champignons",
      portions: 4,
      tempsPrepMinutes: 10,
      tempsCuissonMinutes: 25,
      difficulte: 2,
      ingredients: [
        { libelle: "Riz arborio", quantite: "300", unite: "g", rayon: "sec-epicerie" },
        { libelle: "Champignons de Paris", quantite: "400", unite: "g", rayon: "frais-fruits-legumes" },
        { libelle: "Bouillon de légumes", quantite: "1", unite: "L", rayon: "sec-epicerie" },
        { libelle: "Parmesan", quantite: "80", unite: "g", rayon: "frais-laitier" },
      ],
      etapes: [
        { ordre: 1, description: "Faire revenir les champignons.", dureeMinutes: 8 },
        { ordre: 2, description: "Ajouter le riz et le bouillon louche par louche.", dureeMinutes: 18 },
      ],
      tags: ["dîner", "végétarien"],
      saison: ["toutes"],
      estBatch: false,
    },
    {
      tempId: "r-saumon-legumes",
      nom: "Pavé de saumon, légumes vapeur",
      portions: 4,
      tempsPrepMinutes: 5,
      tempsCuissonMinutes: 15,
      difficulte: 1,
      ingredients: [
        { libelle: "Pavé de saumon", quantite: "4", unite: "pièce", rayon: "frais-poissonnerie" },
        { libelle: "Brocoli", quantite: "1", unite: "pièce", rayon: "frais-fruits-legumes" },
        { libelle: "Carottes", quantite: "4", unite: "pièce", rayon: "frais-fruits-legumes" },
      ],
      etapes: [
        { ordre: 1, description: "Cuire les légumes vapeur.", dureeMinutes: 10 },
        { ordre: 2, description: "Snacker le saumon 4 min de chaque côté.", dureeMinutes: 8 },
      ],
      tags: ["dîner"],
      saison: ["toutes"],
      estBatch: false,
    },
    {
      tempId: "r-pates-bolo",
      nom: "Pâtes bolognaise maison",
      portions: 4,
      tempsPrepMinutes: 15,
      tempsCuissonMinutes: 30,
      difficulte: 1,
      ingredients: [
        { libelle: "Pâtes", quantite: "400", unite: "g", rayon: "sec-epicerie" },
        { libelle: "Viande hachée", quantite: "500", unite: "g", rayon: "frais-boucherie" },
        { libelle: "Sauce tomate", quantite: "1", unite: "boîte", rayon: "sec-epicerie" },
      ],
      etapes: [
        { ordre: 1, description: "Faire revenir la viande.", dureeMinutes: 8 },
        { ordre: 2, description: "Ajouter la sauce, mijoter.", dureeMinutes: 20 },
        { ordre: 3, description: "Cuire les pâtes.", dureeMinutes: 10 },
      ],
      tags: ["dîner", "italien"],
      saison: ["toutes"],
      estBatch: false,
    },
    {
      tempId: "r-quiche-legumes",
      nom: "Quiche aux légumes",
      portions: 6,
      tempsPrepMinutes: 20,
      tempsCuissonMinutes: 35,
      difficulte: 2,
      ingredients: [
        { libelle: "Pâte brisée", quantite: "1", unite: "pièce", rayon: "frais-laitier" },
        { libelle: "Œufs", quantite: "4", unite: "pièce", rayon: "frais-laitier" },
        { libelle: "Crème fraîche", quantite: "200", unite: "ml", rayon: "frais-laitier" },
        { libelle: "Légumes au choix", quantite: "400", unite: "g", rayon: "frais-fruits-legumes" },
      ],
      etapes: [
        { ordre: 1, description: "Foncer le moule.", dureeMinutes: 0 },
        { ordre: 2, description: "Mélanger œufs + crème, ajouter les légumes.", dureeMinutes: 0 },
        { ordre: 3, description: "Cuire au four 35 min à 180°C.", dureeMinutes: 35 },
      ],
      tags: ["dîner", "végétarien"],
      saison: ["toutes"],
      estBatch: false,
    },
  ];

  const REPAS_LIST: Repas[] = ["petitDej", "dej", "diner"];
  const dejRecettes = ["r-salade-poulet", "r-quiche-legumes"];
  const dinerRecettes = ["r-risotto-champignons", "r-saumon-legumes", "r-pates-bolo", "r-quiche-legumes"];
  const slots: MealPlanLLMOutput["slots"] = [];
  for (let jour = 0; jour < 7; jour++) {
    for (const repas of REPAS_LIST) {
      const slotId = `${jour}-${repas}`;
      let recetteTempIds: string[];
      if (repas === "petitDej") {
        recetteTempIds = [jour % 2 === 0 ? "r-pancakes" : "r-tartines"];
      } else if (repas === "dej") {
        recetteTempIds = [dejRecettes[jour % dejRecettes.length]];
      } else {
        recetteTempIds = [dinerRecettes[jour % dinerRecettes.length]];
      }
      slots.push({ slotId, recetteTempIds });
    }
  }

  // Liste de courses simple : agrégation des ingrédients (sans dédup parfaite, le mock est volontairement basique).
  const courses: MealPlanLLMOutput["courses"] = [
    { libelle: "Farine", quantite: "1", unite: "kg", rayon: "sec-epicerie" },
    { libelle: "Œufs", quantite: "12", unite: "pièce", rayon: "frais-laitier" },
    { libelle: "Lait", quantite: "1", unite: "L", rayon: "frais-laitier" },
    { libelle: "Pain", quantite: "2", unite: "baguette", rayon: "boulangerie" },
    { libelle: "Beurre", quantite: "250", unite: "g", rayon: "frais-laitier" },
    { libelle: "Blanc de poulet", quantite: "400", unite: "g", rayon: "frais-boucherie" },
    { libelle: "Salade verte", quantite: "2", unite: "pièce", rayon: "frais-fruits-legumes" },
    { libelle: "Tomates cerises", quantite: "400", unite: "g", rayon: "frais-fruits-legumes" },
    { libelle: "Riz arborio", quantite: "300", unite: "g", rayon: "sec-epicerie" },
    { libelle: "Champignons de Paris", quantite: "400", unite: "g", rayon: "frais-fruits-legumes" },
    { libelle: "Pavé de saumon", quantite: "4", unite: "pièce", rayon: "frais-poissonnerie" },
    { libelle: "Brocoli", quantite: "1", unite: "pièce", rayon: "frais-fruits-legumes" },
    { libelle: "Carottes", quantite: "8", unite: "pièce", rayon: "frais-fruits-legumes" },
    { libelle: "Pâtes", quantite: "400", unite: "g", rayon: "sec-epicerie" },
    { libelle: "Viande hachée", quantite: "500", unite: "g", rayon: "frais-boucherie" },
    { libelle: "Pâte brisée", quantite: "1", unite: "pièce", rayon: "frais-laitier" },
    { libelle: "Crème fraîche", quantite: "200", unite: "ml", rayon: "frais-laitier" },
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
