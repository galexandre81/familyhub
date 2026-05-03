/**
 * Client Claude (Anthropic) pour le seed.
 *
 * Utilisation : provider "claude" en alternative à gemini / lmstudio.
 *
 * Modèles supportés (tarifs par 1M tokens, USD — voir CLAUDE_PRICING_USD
 * dans seed.ts pour le calcul de coût détaillé) :
 *   - claude-opus-4-7    : $5  in / $25 out — le plus capable
 *   - claude-sonnet-4-6  : $3  in / $15 out — successeur de Sonnet 4.5
 *   - claude-sonnet-4-5  : $3  in / $15 out — défaut (legacy mais actif)
 *   - claude-haiku-4-5   : $1  in / $5  out — le moins cher, qualité OK
 *
 * Prompt caching :
 *   Le system prompt (consignes générales + structure JSON attendue) ne
 *   change pas entre batches dans la même session. On le marque avec
 *   cache_control: ephemeral. Économie : -90% sur le coût input à partir
 *   du 2e batch (cache read coûte 10% du tarif normal vs cache write 125%).
 *
 *   Pour 23 batches × 500 tokens system prompt = ~11K tokens cachés :
 *   sans cache : 11K × $3/M = $0.033
 *   avec cache : 500 × $3.75/M (write) + 22 × 500 × $0.30/M (read) = $0.005
 *
 *   L'économie absolue est faible parce que le system prompt est court,
 *   mais le bénéfice augmenterait sur des system prompts plus gros.
 *
 * Streaming :
 *   On stream et on récupère le message final via .finalMessage(). Évite
 *   les timeouts SDK sur de gros max_tokens (notre budget peut atteindre
 *   ~67K tokens output pour des batches de 25 recettes).
 *
 * Clé API : env ANTHROPIC_API_KEY (à mettre dans .env). À récupérer sur
 * https://console.anthropic.com/settings/keys
 */

import Anthropic from "@anthropic-ai/sdk";
import { extractJson } from "./lmstudio.ts";

export interface ClaudeConfig {
  apiKey?: string;
  model: string;
  maxRetries?: number;
}

export class ClaudeSeedClient {
  private client: Anthropic;
  private model: string;

  constructor(config: ClaudeConfig) {
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY manquante. Ajoute-la dans scripts/seedRecipes/.env",
      );
    }
    this.client = new Anthropic({
      apiKey,
      maxRetries: config.maxRetries ?? 2,
    });
    this.model = config.model;
  }

  async generateJson<T = unknown>(opts: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
  }): Promise<{
    data: T;
    rawText: string;
    usage: {
      prompt: number;
      completion: number;
      cacheCreation?: number;
      cacheRead?: number;
    };
  }> {
    const start = Date.now();
    const maxTokens = opts.maxTokens ?? 16000;

    // Stream pour éviter les timeouts SDK sur de gros max_tokens.
    // System prompt avec cache_control pour économiser ~90% sur les
    // batches suivants (le system prompt ne change jamais d'un batch à l'autre).
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: maxTokens,
      system: [
        {
          type: "text",
          text: opts.systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: opts.userPrompt }],
    });

    const message = await stream.finalMessage();

    // Concaténation du texte (un seul bloc text en pratique).
    let content = "";
    for (const block of message.content) {
      if (block.type === "text") {
        content += block.text;
      }
    }

    if (!content) {
      throw new Error(
        `Claude a retourné une réponse vide (stop_reason=${message.stop_reason ?? "?"})`,
      );
    }
    if (message.stop_reason === "max_tokens") {
      throw new Error(
        `Claude a tronqué la réponse (max_tokens=${maxTokens} atteint, output=${message.usage.output_tokens} tokens). ` +
          "Augmente maxTokens dans seed.ts (Math.max budget × count) ou réduis count par batch.",
      );
    }
    if (message.stop_reason === "refusal") {
      throw new Error(
        `Claude a refusé de répondre (contenu jugé sensible). ` +
          `Premiers 300 chars : ${content.slice(0, 300)}`,
      );
    }

    const extracted = extractJson(content);
    let data: T;
    try {
      data = JSON.parse(extracted) as T;
    } catch (err) {
      throw new Error(
        `JSON invalide retourné par Claude (stop_reason=${message.stop_reason ?? "?"}) : ${err instanceof Error ? err.message : "?"}\n` +
          `Premiers 300 chars : ${extracted.slice(0, 300)}`,
      );
    }

    const usage = {
      prompt: message.usage.input_tokens,
      completion: message.usage.output_tokens,
      cacheCreation: message.usage.cache_creation_input_tokens ?? 0,
      cacheRead: message.usage.cache_read_input_tokens ?? 0,
    };
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const cacheBits: string[] = [];
    if (usage.cacheRead) cacheBits.push(`${usage.cacheRead.toLocaleString("fr-FR")}r`);
    if (usage.cacheCreation) cacheBits.push(`${usage.cacheCreation.toLocaleString("fr-FR")}w`);
    const cacheInfo = cacheBits.length ? ` · cache ${cacheBits.join("/")}` : "";
    console.log(
      `   ⏱️  ${elapsed}s · ${usage.prompt}+${usage.completion} tokens${cacheInfo} · ${this.model}`,
    );

    return { data, rawText: content, usage };
  }

  /**
   * Pas de vrai endpoint /v1/models côté Anthropic listant tous les modèles
   * pour vérification, on retourne juste le modèle configuré.
   */
  async ping(): Promise<string[]> {
    return [this.model];
  }
}
