/**
 * Sélection du LLMProvider selon l'env.
 *
 * - `MOCK_LLM=true` → mock (dev local, tests, pas de quota cramé)
 * - sinon → Gemini Flash (MVP)
 *
 * Décision Phase 3.0 : un seul provider réel (Gemini) en MVP. Si on veut
 * plus tard ajouter Claude/Qwen, on étend ici sans toucher aux callers.
 */

import { geminiProvider } from "./gemini";
import { createMockProvider } from "./mock";
import type { LLMProvider } from "./provider";

let cachedMock: LLMProvider | null = null;

export function getProvider(): LLMProvider {
  if (process.env.MOCK_LLM === "true") {
    if (!cachedMock) cachedMock = createMockProvider();
    return cachedMock;
  }
  return geminiProvider;
}

export * from "./provider";
export * from "./prompts";
export * from "./validation";
export { createMockProvider, buildMockMealPlanOutput } from "./mock";
