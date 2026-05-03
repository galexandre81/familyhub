import type { Timestamp } from "../common";

export type ChatRole = "user" | "assistant" | "system";
export type ToolCallResult = "applied" | "rejected" | "error";

/**
 * Tools que le LLM peut appeler pour modifier un plan en chat.
 * Cf. spec §6.3 et §7.3. La validation contre l'état du plan se fait
 * côté Cloud Function avant write Firestore.
 */
export type ChatToolName =
  | "updateSlot"
  | "swapSlots"
  | "updatePresence"
  | "replaceRecette"
  | "updateCourses"
  | "respondToUser";

export interface ChatToolCall {
  name: ChatToolName;
  args: Record<string, unknown>;
  /** Résultat de l'exécution côté backend. Absent = pas encore exécuté. */
  result?: ToolCallResult;
  /** Message d'erreur si result === "error" ou "rejected". */
  resultDetail?: string;
}

/**
 * Message de chat sur un plan.
 *
 * Stocké en sous-collection `mealPlans/{planId}/chatMessages/` (pas dans le
 * doc parent, limité à 1 Mo). Cap à 100 docs par plan (validé côté CF).
 */
export interface ChatMessage {
  role: ChatRole;
  /** Texte affiché à l'utilisateur. Vide si l'assistant n'a fait que des tool calls. */
  content: string;
  toolCalls?: ChatToolCall[];
  /** Tokens consommés par ce tour (input + output cumulés). */
  tokensUsed?: number;
  createdAt: Timestamp;
  /** uid si role === "user". */
  createdBy?: string;
}
