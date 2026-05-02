/**
 * Templates de prompts pour Kitchen Buddy.
 *
 * Conventions :
 * - System prompt : instructions stables (rôle, contraintes, format de sortie)
 *   → bénéficie du caching implicite Gemini
 * - User prompt : variables dynamiques (profils, slots, contexte)
 *
 * Les templates sont écrits en français car les sorties seront affichées
 * en français à l'utilisateur (pas de traduction). Demander en français
 * directement évite des allers-retours et économise des tokens.
 */

import type { ProfilSnapshot, Repas } from "../../../types";

const REPAS_NOMS: Record<Repas, string> = {
  petitDej: "petit-déjeuner",
  dej: "déjeuner",
  diner: "dîner",
};

const JOUR_NOMS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

export interface GenerateMealPlanContext {
  dateDebutISO: string;
  dateFinISO: string;
  saison: "hiver" | "printemps" | "ete" | "automne";
  profils: Array<ProfilSnapshot & { id: string; age?: number }>;
  /** Présence par slot, indexée par slotId (`${jour}-${repas}`). */
  presence: Array<{
    slotId: string;
    jour: number;
    repas: Repas;
    profilIds: string[];
  }>;
  contexte: {
    batchCookingOk: boolean;
    style: string;
    frigoTexte: string;
  };
}

export const GENERATE_MEAL_PLAN_SYSTEM_PROMPT = `Tu es un assistant culinaire familial. Tu produis des plans de repas cohérents pour une famille, en respectant strictement les contraintes individuelles de chaque profil et en variant les styles culinaires sur la semaine.

CONSIGNES DE GÉNÉRATION :
1. Pour CHAQUE slot où il y a au moins un profil présent, propose un plat principal + un accompagnement adapté (légume, féculent, ou salade selon ce qui équilibre).
2. Pour les slots où PERSONNE n'est présent, ne propose rien (laisse vide).
3. Adapte chaque recette aux contraintes croisées de tous les profils présents au slot. Une aversion individuelle invalide une recette pour TOUS si la personne est présente.
4. Utilise en priorité les ingrédients du frigo mentionnés ; ils n'iront PAS dans la liste de courses (fusionne mentalement).
5. Privilégie les ingrédients de saison.
6. Varie les styles culinaires sur la semaine (pas 3 plats de pâtes, pas 2 ratatouilles).
7. Si batch cooking activé : tu peux référencer une recette préparée le dimanche dans plusieurs slots ultérieurs. Marque-la avec estBatch=true.
8. Pour les petits-déjeuners : fais simple, sauf si batch cooking où tu peux proposer un granola/pancakes en réserve.
9. À la fin, produis une LISTE DE COURSES agrégée et fusionnée (pas de doublons, quantités cumulées), groupée par rayon, sans les ingrédients du frigo.

FORMAT DE SORTIE :
Tu réponds STRICTEMENT en JSON conforme au schéma fourni. Pas de markdown, pas de commentaires, pas de texte avant/après.`;

export function buildGenerateMealPlanUserPrompt(ctx: GenerateMealPlanContext): string {
  const profilsBlock = ctx.profils
    .map((p) => {
      const lines: string[] = [
        `- ${p.nom}${p.age != null ? ` (${p.age} ans)` : ""} :`,
      ];
      if (p.regimes.length) lines.push(`  - Régimes : ${p.regimes.join(", ")}`);
      if (p.aversions.length) lines.push(`  - Aversions : ${p.aversions.join(", ")}`);
      if (p.objectifsNutrition.length)
        lines.push(`  - Objectifs : ${p.objectifsNutrition.join(", ")}`);
      if (p.prefsCuisson.length) lines.push(`  - Cuisson : ${p.prefsCuisson.join(", ")}`);
      if (p.notes) lines.push(`  - Notes : ${p.notes}`);
      if (
        !p.regimes.length &&
        !p.aversions.length &&
        !p.objectifsNutrition.length &&
        !p.prefsCuisson.length &&
        !p.notes
      ) {
        lines.push("  - Aucune contrainte particulière");
      }
      return lines.join("\n");
    })
    .join("\n");

  const profilNomById = new Map(ctx.profils.map((p) => [p.id, p.nom]));
  const presenceBlock = ctx.presence
    .map((s) => {
      const noms = s.profilIds.map((id) => profilNomById.get(id) ?? id).join(", ");
      return `- ${JOUR_NOMS[s.jour]} ${REPAS_NOMS[s.repas]} (slotId="${s.slotId}") : ${
        s.profilIds.length ? noms : "PERSONNE"
      }`;
    })
    .join("\n");

  const batchLine = ctx.contexte.batchCookingOk
    ? "OUI — tu peux proposer une session batch le dimanche pour préparer des recettes consommées plus tard dans la semaine"
    : "NON — pas de batch cooking cette semaine";

  return `Plan demandé pour la semaine du ${ctx.dateDebutISO} au ${ctx.dateFinISO}.

PROFILS DE LA FAMILLE :
${profilsBlock}

GRILLE DE PRÉSENCE :
${presenceBlock}

CONTEXTE :
- Saison : ${ctx.saison}
- Batch cooking : ${batchLine}
- Style/envie : ${ctx.contexte.style || "aucun précisé"}
- À écouler du frigo : ${ctx.contexte.frigoTexte || "rien à signaler"}

Génère le plan complet en respectant strictement le schéma JSON imposé.`;
}

/* --- Chat avec function calling --- */

export const CHAT_WITH_PLAN_SYSTEM_PROMPT = `Tu es un assistant culinaire familial. Tu modifies un plan de repas existant en réponse aux demandes de l'utilisateur.

RÈGLES ABSOLUES :
- Tu DOIS utiliser les tools fournis pour appliquer les changements. Ne te contente pas de répondre en texte.
- Après avoir fait les changements via tools, utilise respondToUser() pour expliquer brièvement ce que tu as fait (1-2 phrases max).
- Si la demande est ambiguë, utilise UNIQUEMENT respondToUser() pour poser une question, sans rien modifier.
- Si tu modifies des slots qui changent les ingrédients nécessaires, mets à jour la liste de courses en conséquence (updateCourses).
- Respecte strictement les contraintes des profils (snapshot dans le contexte).
- Si l'utilisateur demande quelque chose d'impossible (ex: ajouter un ingrédient incompatible avec une aversion), refuse via respondToUser() en expliquant pourquoi.

TON :
- Tutoiement, naturel, concis. Pas de formules de politesse longues.
- Pas de markdown, pas de listes à puces sauf si vraiment nécessaire.`;

export function buildChatWithPlanContext(opts: {
  planSummary: PlanSummaryForChat;
}): string {
  return `PLAN ACTUEL (résumé) :
${JSON.stringify(opts.planSummary, null, 2)}

Réponds à la demande de l'utilisateur en utilisant les tools.`;
}

/**
 * Snapshot compact du plan envoyé au chat. Pas les recettes complètes
 * (économie tokens) — juste IDs + noms + présents par slot, plus la liste
 * compacte des recettes référencées.
 */
export interface PlanSummaryForChat {
  planId: string;
  dateDebutISO: string;
  profils: Array<{
    id: string;
    nom: string;
    aversions: string[];
    regimes: string[];
  }>;
  slots: Array<{
    slotId: string;
    jour: number;
    repas: Repas;
    profilsPresents: string[];
    recettes: Array<{ id: string; nom: string }>;
  }>;
  /** Ingrédients principaux par recette pour aider le LLM à raisonner courses. */
  recettesIngredients: Array<{
    id: string;
    nom: string;
    ingredientsResume: string[];
  }>;
}
