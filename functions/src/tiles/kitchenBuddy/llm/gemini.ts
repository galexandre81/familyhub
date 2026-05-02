/**
 * Implémentation Gemini Flash du LLMProvider.
 *
 * SDK : @google/genai (officiel actuel, pas l'ancien @google/generative-ai).
 *
 * Caching implicite : Gemini cache automatiquement les préfixes communs entre
 * requêtes successives (system prompt + snapshot profils figés). Pas besoin
 * de gérer le cache explicitement — il est facturé moins cher (10% du tarif).
 * cf. https://ai.google.dev/gemini-api/docs/caching
 */

import { GoogleGenAI, Type, type FunctionDeclaration } from "@google/genai";
import { logger } from "firebase-functions";
import type {
  LLMChatResult,
  LLMHistoryMessage,
  LLMProvider,
  LLMStructuredResult,
  LLMToolDefinition,
  LLMTokenUsage,
} from "./provider";
import type { ChatToolName } from "../../../types";

const DEFAULT_MODEL = process.env.LLM_MODEL || "gemini-2.0-flash";

let cachedClient: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY env var manquante (Secret Manager: GEMINI_API_KEY)");
  }
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

function extractUsage(usageMetadata: {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  cachedContentTokenCount?: number;
} | undefined): LLMTokenUsage {
  return {
    inputTokens: usageMetadata?.promptTokenCount ?? 0,
    outputTokens: usageMetadata?.candidatesTokenCount ?? 0,
    cachedInputTokens: usageMetadata?.cachedContentTokenCount,
  };
}

/**
 * Convertit notre LLMToolDefinition (JSONSchema-style) en FunctionDeclaration Gemini.
 * Gemini accepte un sous-ensemble OpenAPI : on traduit `type: "string" | "number" | etc.`
 * vers Type.STRING / Type.NUMBER.
 */
function toGeminiFunctionDeclaration(tool: LLMToolDefinition): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parameters: convertSchemaToGemini(tool.parameters) as FunctionDeclaration["parameters"],
  };
}

const TYPE_MAP: Record<string, Type> = {
  string: Type.STRING,
  number: Type.NUMBER,
  integer: Type.INTEGER,
  boolean: Type.BOOLEAN,
  array: Type.ARRAY,
  object: Type.OBJECT,
};

function convertSchemaToGemini(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return schema;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "type" && typeof v === "string") {
      out.type = TYPE_MAP[v] ?? v;
    } else if (k === "properties" && v && typeof v === "object") {
      const props: Record<string, unknown> = {};
      for (const [pk, pv] of Object.entries(v as Record<string, unknown>)) {
        props[pk] = convertSchemaToGemini(pv as Record<string, unknown>);
      }
      out.properties = props;
    } else if (k === "items" && v && typeof v === "object") {
      out.items = convertSchemaToGemini(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export const geminiProvider: LLMProvider = {
  name: "gemini",

  async generateStructured<T>(opts: {
    systemPrompt: string;
    userPrompt: string;
    schema: Record<string, unknown>;
    maxOutputTokens?: number;
    model?: string;
  }): Promise<LLMStructuredResult<T>> {
    const client = getClient();
    const model = opts.model ?? DEFAULT_MODEL;
    const response = await client.models.generateContent({
      model,
      contents: opts.userPrompt,
      config: {
        systemInstruction: opts.systemPrompt,
        responseMimeType: "application/json",
        responseSchema: convertSchemaToGemini(opts.schema) as never,
        maxOutputTokens: opts.maxOutputTokens ?? 8000,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini a retourné une réponse vide");
    }

    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch (err) {
      logger.error("Gemini JSON parse failed", { text: text.slice(0, 500), err });
      throw new Error(
        `Gemini a retourné du JSON invalide : ${err instanceof Error ? err.message : "?"}`,
      );
    }

    return {
      data,
      usage: extractUsage(response.usageMetadata),
      model,
    };
  },

  async chat(opts: {
    systemPrompt: string;
    history: LLMHistoryMessage[];
    userMessage: string;
    tools: LLMToolDefinition[];
    maxOutputTokens?: number;
    model?: string;
  }): Promise<LLMChatResult> {
    const client = getClient();
    const model = opts.model ?? DEFAULT_MODEL;

    // Gemini "contents" = liste alternée user/model. On transpose history + userMessage.
    const contents = [
      ...opts.history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: [{ text: opts.userMessage }] },
    ];

    const response = await client.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: opts.systemPrompt,
        tools: [
          {
            functionDeclarations: opts.tools.map(toGeminiFunctionDeclaration),
          },
        ],
        maxOutputTokens: opts.maxOutputTokens ?? 2000,
      },
    });

    // Extraction des tool calls + texte
    const toolCalls: Array<{ name: ChatToolName; args: Record<string, unknown> }> = [];
    let assistantMessage = "";
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    for (const part of parts) {
      if (part.functionCall) {
        toolCalls.push({
          name: part.functionCall.name as ChatToolName,
          args: (part.functionCall.args ?? {}) as Record<string, unknown>,
        });
      } else if (part.text) {
        assistantMessage += part.text;
      }
    }

    return {
      assistantMessage: assistantMessage.trim(),
      toolCalls,
      usage: extractUsage(response.usageMetadata),
      model,
    };
  },
};
