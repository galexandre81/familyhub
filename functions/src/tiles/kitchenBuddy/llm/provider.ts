/**
 * LLM provider abstrait pour Kitchen Buddy.
 *
 * Décision Phase 3.0 : MVP = Gemini Flash uniquement (cf. discussion archi).
 * L'interface reste générique pour permettre un swap futur (Claude, GPT, ou
 * Qwen local via LM Studio) sans toucher au code appelant.
 */

import type { ChatRole, ChatToolCall, ChatToolName } from "../../../types";

/** Rôle d'un message envoyé au LLM. */
export interface LLMHistoryMessage {
  role: ChatRole;
  content: string;
  toolCalls?: ChatToolCall[];
}

/** Définition d'un tool exposé au LLM (function calling). */
export interface LLMToolDefinition {
  name: ChatToolName;
  description: string;
  /** JSONSchema-compatible — chaque provider le traduira dans son format. */
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** Comptes de tokens consommés sur un appel. */
export interface LLMTokenUsage {
  inputTokens: number;
  outputTokens: number;
  /** Tokens lus depuis le cache (Gemini implicit caching). */
  cachedInputTokens?: number;
}

/** Output de generateStructured : JSON typé + usage. */
export interface LLMStructuredResult<T> {
  data: T;
  usage: LLMTokenUsage;
  /** Modèle effectivement utilisé (utile pour logs/audit). */
  model: string;
}

/** Output de chat : texte + tool calls + usage. */
export interface LLMChatResult {
  assistantMessage: string;
  toolCalls: Array<{ name: ChatToolName; args: Record<string, unknown> }>;
  usage: LLMTokenUsage;
  model: string;
}

export interface LLMProvider {
  readonly name: string;

  /**
   * Génération avec output JSON structuré contraint par un schéma.
   * Utilisé pour `generateMealPlan` et `generateAdHocRecipe`.
   *
   * @param opts.schema — JSONSchema décrivant la forme attendue. Le SDK
   *   contraindra l'output (Gemini : `responseSchema`).
   */
  generateStructured<T>(opts: {
    systemPrompt: string;
    userPrompt: string;
    /** Schéma JSON d'output. Forme acceptée par Gemini responseSchema. */
    schema: Record<string, unknown>;
    maxOutputTokens?: number;
    /** Nom de modèle (ex: "gemini-2.0-flash"). Default = LLM_MODEL env. */
    model?: string;
  }): Promise<LLMStructuredResult<T>>;

  /**
   * Chat multi-tours avec function calling.
   * Utilisé pour `sendChatMessage` (édition conversationnelle d'un plan).
   *
   * Le LLM peut appeler les tools définis pour modifier l'état du plan ;
   * la validation et l'exécution des tool calls se fait côté backend.
   */
  chat(opts: {
    systemPrompt: string;
    history: LLMHistoryMessage[];
    userMessage: string;
    tools: LLMToolDefinition[];
    maxOutputTokens?: number;
    model?: string;
  }): Promise<LLMChatResult>;
}
