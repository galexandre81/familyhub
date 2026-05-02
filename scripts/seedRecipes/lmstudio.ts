/**
 * Client LM Studio (API OpenAI-compatible).
 *
 * LM Studio expose par défaut sur http://localhost:1234/v1.
 * On utilise le SDK officiel OpenAI avec un baseURL custom + clé fictive.
 *
 * Modèles testés :
 * - Qwen2.5-9B-Instruct, Qwen3-8B, Qwen3-14B (recommandé pour FR + JSON)
 * - Llama-3.1-8B-Instruct (acceptable)
 *
 * Le mode `response_format: {type: "json_object"}` est supporté nativement
 * par LM Studio + Qwen depuis 2024.
 */

import OpenAI from "openai";

export interface LMStudioConfig {
  baseURL?: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  maxRetries?: number;
}

export class LMStudioClient {
  private client: OpenAI;
  private model: string;
  private temperature: number;

  constructor(config: LMStudioConfig) {
    this.client = new OpenAI({
      baseURL: config.baseURL ?? "http://localhost:1234/v1",
      apiKey: config.apiKey ?? "lm-studio", // ignoré par LM Studio mais requis par le SDK
      maxRetries: config.maxRetries ?? 2,
    });
    this.model = config.model;
    this.temperature = config.temperature ?? 0.8; // un peu de créativité
  }

  /**
   * Appel JSON structuré : retourne du JSON parsé.
   *
   * Note : on utilise response_format=text plutôt que json_object car certains
   * builds LM Studio (notamment avec Qwen) rejettent json_object. On compte
   * sur le prompt système pour exiger du JSON, et on extrait robustement le
   * JSON du texte (gère markdown ```json, texte parasite avant/après).
   */
  async generateJson<T = unknown>(opts: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
  }): Promise<{ data: T; rawText: string; usage: { prompt: number; completion: number } }> {
    const start = Date.now();
    // Qwen3 active le "thinking mode" par défaut : il génère du <think>...</think>
    // long avant la vraie réponse, ce qui multiplie le temps par 5-10. On le
    // désactive en ajoutant le tag /no_think que Qwen3 reconnaît.
    const userPromptNoThink = `/no_think\n${opts.userPrompt}`;
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: userPromptNoThink },
      ],
      temperature: this.temperature,
      max_tokens: opts.maxTokens ?? 8000,
      // Pas de response_format : Qwen via LM Studio rejette json_object,
      // et json_schema demanderait de fournir un schéma complet (lourd).
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("LM Studio a retourné une réponse vide");

    const extracted = extractJson(content);
    let data: T;
    try {
      data = JSON.parse(extracted) as T;
    } catch (err) {
      throw new Error(
        `JSON invalide retourné par le modèle : ${err instanceof Error ? err.message : "?"}\n` +
          `Premiers 300 chars (extracted) : ${extracted.slice(0, 300)}`,
      );
    }

    const usage = {
      prompt: response.usage?.prompt_tokens ?? 0,
      completion: response.usage?.completion_tokens ?? 0,
    };
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `   ⏱️  ${elapsed}s · ${usage.prompt}+${usage.completion} tokens · ${this.model}`,
    );

    return { data, rawText: content, usage };
  }

  /** Vérifie que le serveur répond et liste les modèles. */
  async ping(): Promise<string[]> {
    const list = await this.client.models.list();
    return list.data.map((m) => m.id);
  }
}

/**
 * Extrait le JSON d'une réponse LLM qui peut contenir :
 * - Du texte parasite avant/après
 * - Un bloc markdown ```json ... ```
 * - Un bloc <think>...</think> de Qwen3 si /no_think ignoré
 * - Le JSON brut directement
 *
 * Stratégie : strip thinking → on cherche d'abord un bloc ```json,
 * sinon on prend la 1ère accolade ouvrante et la dernière accolade fermante.
 */
export function extractJson(text: string): string {
  // 0. Strip Qwen3 thinking si présent
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // 1. Bloc markdown ```json ... ```
  const mdMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (mdMatch && mdMatch[1].trim()) {
    return mdMatch[1].trim();
  }

  // 2. Bloc { ... } équilibré
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  // 3. Bloc [ ... ]
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return text.slice(firstBracket, lastBracket + 1).trim();
  }

  // 4. Fallback : retourne le texte brut
  return text.trim();
}
