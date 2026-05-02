/**
 * Client Gemini Flash pour le seed (alternative à LM Studio si Qwen local
 * est trop lent ou indisponible).
 *
 * Coût indicatif Gemini 2.0 Flash : ~0.10€/M input + 0.40€/M output.
 * Pour 300 recettes ≈ 0.15€, durée ~5 min.
 *
 * Clé API : lue depuis env GEMINI_API_KEY (à mettre dans .env).
 */

import { GoogleGenAI } from "@google/genai";
import { extractJson } from "./lmstudio.ts";

export interface GeminiConfig {
  apiKey?: string;
  model: string;
  temperature?: number;
}

export class GeminiSeedClient {
  private client: GoogleGenAI;
  private model: string;
  private temperature: number;

  constructor(config: GeminiConfig) {
    const apiKey = config.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY manquante. Ajoute-la dans scripts/seedRecipes/.env",
      );
    }
    this.client = new GoogleGenAI({ apiKey });
    this.model = config.model;
    this.temperature = config.temperature ?? 0.85;
  }

  async generateJson<T = unknown>(opts: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
  }): Promise<{ data: T; rawText: string; usage: { prompt: number; completion: number } }> {
    const start = Date.now();
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: opts.userPrompt,
      config: {
        systemInstruction: opts.systemPrompt,
        responseMimeType: "application/json",
        maxOutputTokens: opts.maxTokens ?? 8000,
        temperature: this.temperature,
      },
    });

    const content = response.text;
    if (!content) throw new Error("Gemini a retourné une réponse vide");

    const extracted = extractJson(content);
    let data: T;
    try {
      data = JSON.parse(extracted) as T;
    } catch (err) {
      throw new Error(
        `JSON invalide retourné par Gemini : ${err instanceof Error ? err.message : "?"}\n` +
          `Premiers 300 chars : ${extracted.slice(0, 300)}`,
      );
    }

    const usage = {
      prompt: response.usageMetadata?.promptTokenCount ?? 0,
      completion: response.usageMetadata?.candidatesTokenCount ?? 0,
    };
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `   ⏱️  ${elapsed}s · ${usage.prompt}+${usage.completion} tokens · ${this.model}`,
    );

    return { data, rawText: content, usage };
  }

  async ping(): Promise<string[]> {
    // Gemini API ne liste pas tous les modèles via le SDK trivialement.
    // On retourne juste le modèle configuré (assume qu'il existe).
    return [this.model];
  }
}
