/**
 * Génère le `.md` de contexte plan envoyé à Claude.ai pour générer
 * un meal plan, ainsi que le prompt template à coller juste avant.
 *
 * Format conforme au brief §5.1 et §5.2 (kitchen-buddy-phase3-brief.md).
 */

import type { Profil } from "@family-hub/types";

export type PresenceMap = Record<string, string[]>; // key = `${jour}-${repas}`, value = profilIds

const JOUR_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const SAISONS_INGREDIENTS: Record<string, string> = {
  printemps:
    "asperges, radis, fraises, petits pois, fèves, épinards, artichauts, oseille, oignons nouveaux",
  ete: "tomates, courgettes, aubergines, poivrons, melon, pêches, abricots, basilic, maïs, haricots verts",
  automne:
    "potiron, courge butternut, champignons, raisin, figues, pommes, poires, châtaignes, choux",
  hiver:
    "endives, poireaux, choux (kale, vert, rouge), pommes de terre, panais, topinambours, oranges, mandarines",
};

export interface BuildPlanMdInput {
  householdNom: string;
  /** ISO YYYY-MM-DD du lundi. */
  dateDebutISO: string;
  profils: Array<Profil & { id: string }>;
  presence: PresenceMap;
  contexte: { batchCookingOk: boolean; style: string; frigoTexte: string };
  /** Recettes des plans récents pour éviter de resservir. */
  historiqueRecettes: string[];
}

export function buildPlanMd(input: BuildPlanMdInput): string {
  const { householdNom, dateDebutISO, profils, presence, contexte, historiqueRecettes } = input;
  const dateDebut = new Date(dateDebutISO);
  const dateFin = addDays(dateDebut, 6);
  const saison = deduceSaison(dateDebut);

  const lines: string[] = [];

  lines.push(`# Plan de repas — Famille ${householdNom}`);
  lines.push(
    `Semaine du ${formatDateLong(dateDebut)} au ${formatDateLong(dateFin)}`,
  );
  lines.push("");

  // Profils
  lines.push("## Profils");
  lines.push("");
  for (const p of profils) {
    const age = computeAge(p.dateNaissance);
    lines.push(`### ${p.nom}${age != null ? ` (${age} ans)` : ""}`);
    lines.push(`- Régimes : ${listOrAucun(p.regimes)}`);
    lines.push(`- Aversions : ${listOrAucun(p.aversions)}`);
    lines.push(`- Objectifs nutrition : ${listOrAucun(p.objectifsNutrition)}`);
    lines.push(`- Préférences cuisson : ${listOrAucun(p.prefsCuisson)}`);
    if (p.notes && p.notes.trim()) lines.push(`- Notes : ${p.notes.trim()}`);
    lines.push("");
  }

  // Présence
  lines.push("## Présence aux repas");
  lines.push("");
  lines.push("| Jour | Petit-déj | Déjeuner | Dîner |");
  lines.push("|---|---|---|---|");
  for (let jour = 0; jour < 7; jour++) {
    const date = addDays(dateDebut, jour);
    const dateLabel = `${JOUR_LABELS[jour]} ${date.getDate()}`;
    const cells = (["petitDej", "dej", "diner"] as const).map((repas) => {
      const profilIds = presence[`${jour}-${repas}`] ?? [];
      if (profilIds.length === 0) return "personne";
      return profilIds
        .map((id) => profils.find((p) => p.id === id)?.nom ?? id)
        .join(", ");
    });
    lines.push(`| ${dateLabel} | ${cells[0]} | ${cells[1]} | ${cells[2]} |`);
  }
  lines.push("");

  // Contexte
  lines.push("## Contexte de la semaine");
  lines.push("");
  lines.push(
    `- **Batch cooking** : ${
      contexte.batchCookingOk
        ? "OK, peux proposer une session le dimanche après-midi pour préparer en avance"
        : "non — pas de batch cooking cette semaine"
    }`,
  );
  lines.push(`- **Style/envie** : ${contexte.style.trim() || "rien de particulier"}`);
  lines.push("- **À écouler du frigo** :");
  if (contexte.frigoTexte.trim()) {
    for (const ligne of contexte.frigoTexte.split("\n")) {
      const t = ligne.trim();
      if (t) lines.push(`  - ${t}`);
    }
  } else {
    lines.push("  - rien à écouler");
  }
  lines.push("");

  // Historique
  lines.push("## Historique récent (à éviter de resservir)");
  lines.push("");
  if (historiqueRecettes.length > 0) {
    lines.push("Recettes proposées récemment :");
    for (const r of historiqueRecettes) lines.push(`- ${r}`);
  } else {
    lines.push("Aucun historique disponible (premier plan).");
  }
  lines.push("");

  // Saison
  lines.push(`## Saison actuelle : ${saison}`);
  lines.push("");
  lines.push(`Ingrédients de saison à privilégier : ${SAISONS_INGREDIENTS[saison]}.`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Prompt template à coller dans Claude.ai juste AVANT le `.md`.
 * Workflow en DEUX ÉTAPES :
 *   1. Claude propose le menu en markdown, demande validation/modifs.
 *   2. Sur ordre de l'utilisateur ("OK génère le JSON"), Claude renvoie
 *      le JSON dans un Artifact (téléchargeable).
 */
export const PLAN_PROMPT_TEMPLATE = `Tu es un assistant culinaire familial. On procède en DEUX ÉTAPES distinctes.

═══════════════════════════════════════════════════════════
ÉTAPE 1 — PROPOSITION DU MENU (ce que tu fais maintenant)
═══════════════════════════════════════════════════════════

Lis attentivement le contexte du plan plus bas (profils, présence, frigo, saison, historique récent), puis propose un menu hebdomadaire EN MARKDOWN LISIBLE — PAS DE JSON pour l'instant.

Format de la proposition :
- Un tableau ou une liste structurée par jour (lundi → dimanche), chaque ligne = un slot petit-déj/déjeuner/dîner.
- Pour chaque slot avec mangeurs : **titre du plat principal** + accompagnement (1 ligne de description suffit).
- Pour les slots "personne" : note "—" ou "personne mange ici".
- Si batch cooking OK : section "Batch cooking" en bas avec 1-2 sessions proposées (date + durée estimée + liste des recettes à préparer).
- Section "Frigo : utilisation prévue" qui liste les ingrédients du frigo et où tu les places.
- Termine OBLIGATOIREMENT par : **"Tu veux modifier quelque chose ? Sinon réponds *OK génère le JSON* pour passer à l'étape 2."**

CONSIGNES MENU :
1. Pour CHAQUE slot où il y a au moins un mangeur, propose un plat principal + un accompagnement (légume, féculent, ou salade selon ce qui équilibre).
2. Adapte aux contraintes croisées des profils présents (régimes, aversions, objectifs nutrition).
3. Utilise EN PRIORITÉ les ingrédients du frigo mentionnés.
4. Privilégie les ingrédients de saison.
5. Évite les recettes listées dans "Historique récent".
6. Varie les styles culinaires (pas 3 pâtes, pas 2 ratatouilles).

L'utilisateur peut ensuite te demander des modifs ("remplace mardi soir", "moins de viande", "ajoute une tarte samedi"). Tu adaptes et tu re-poses la même question.

═══════════════════════════════════════════════════════════
ÉTAPE 2 — GÉNÉRATION DU JSON (UNIQUEMENT quand l'utilisateur dit "OK")
═══════════════════════════════════════════════════════════

Quand l'utilisateur valide explicitement (par "OK", "génère", "go", "valide", "le JSON" ou équivalent), tu produis le JSON final.

CONSIGNES JSON :
1. Place le JSON dans un **Artifact** (de type "Code" / extension \`.json\`) pour que l'utilisateur puisse le télécharger en 1 clic. Si Artifacts indispo, mets-le dans un bloc de code unique.
2. PAS DE PRÉAMBULE TEXTE avant le JSON. Pas de "Voici le JSON :" — l'Artifact ou le bloc code se suffit.
3. Pour les slots "personne", \`recetteTempIds: []\`.
4. Pour les ingrédients déjà au frigo : \`noteFrigo: true\` dans la recette → ils N'IRONT PAS dans la liste de courses.
5. Génère la liste de courses agrégée, groupée par rayon, en sommant les ingrédients communs entre recettes ET en EXCLUANT ceux marqués \`noteFrigo: true\`.
6. Si batch cooking : les slots qui consomment ce batch ont \`source: "batch"\` et \`batchSessionTempId\` correspondant.
7. \`profilsPresentsNoms\` : copie EXACTEMENT les noms du tableau de présence (case + accents importants).

SCHÉMA JSON DE SORTIE ATTENDU :
\`\`\`
{
  "recettes": [
    {
      "tempId": "r1",                                 // identifiant temporaire unique dans ce JSON
      "titre": "string",
      "description": "string (1-2 phrases)",
      "portions": number,                             // pour combien de personnes la recette est calibrée
      "dureePreparation": number,                     // minutes
      "dureeCuisson": number,                         // minutes
      "difficulte": "facile" | "moyen" | "avance",
      "tags": ["string"],
      "saison": ["printemps" | "ete" | "automne" | "hiver"],   // optionnel
      "ingredients": [
        {
          "nom": "string",
          "quantite": number,                         // pour la quantité de portions ci-dessus
          "unite": "g" | "ml" | "u" | "cs" | "cc" | "pincee" | ...,
          "rayon": "fruits-legumes" | "boucherie" | "poissonnerie" | "cremerie" | "epicerie" | "surgeles" | "boulangerie" | "boissons" | "autres",
          "optionnel": boolean,                       // optionnel
          "noteFrigo": boolean                        // true = issu du frigo, n'ira PAS en courses
        }
      ],
      "etapes": [
        { "ordre": number, "texte": "string", "dureeMinutes": number }   // dureeMinutes optionnel : si présent, bouton timer en mode cuisine
      ]
    }
  ],
  "batchSessions": [
    {
      "tempId": "b1",
      "date": "YYYY-MM-DD",                           // dans la fenêtre du plan
      "dureeEstimeeMinutes": number,
      "recetteTempIds": ["r3", "r5"],                 // recettes à préparer dans cette session
      "notes": "string"                               // optionnel
    }
  ],
  "slots": [
    {
      "date": "YYYY-MM-DD",
      "repas": "petit-dej" | "dejeuner" | "diner",
      "profilsPresentsNoms": ["Julie", "Adèle"],      // copier les noms exacts du tableau de présence
      "invitesNoms": ["Marc"],                        // optionnel
      "source": "fresh" | "batch",
      "batchSessionTempId": "b1" | null,              // requis si source = "batch"
      "recetteTempIds": ["r1", "r2"],                 // 1 plat + accompagnement, ou [] si "personne"
      "notes": "string"                               // optionnel
    }
  ],
  "shoppingList": {
    "items": [
      {
        "nom": "string",
        "quantite": number,
        "unite": "string",
        "rayon": "string",                            // mêmes valeurs que ingredient.rayon
        "recetteTempIds": ["r1", "r2"]                // de quelles recettes vient cet item
      }
    ]
  },
  "commentaireGeneral": "string"                      // optionnel — résumé/commentaire libre du plan
}
\`\`\`

DONNÉES DU PLAN :

`;

// ---- helpers ----

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function listOrAucun(arr: string[] | undefined): string {
  return arr && arr.length > 0 ? arr.join(", ") : "aucun";
}

function computeAge(dateNaissance: unknown): number | null {
  if (!dateNaissance) return null;
  let d: Date | null = null;
  if (dateNaissance instanceof Date) d = dateNaissance;
  else if (typeof dateNaissance === "string") d = new Date(dateNaissance);
  else if (typeof dateNaissance === "object" && dateNaissance && "seconds" in dateNaissance) {
    d = new Date((dateNaissance as { seconds: number }).seconds * 1000);
  }
  if (!d || isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function deduceSaison(d: Date): "printemps" | "ete" | "automne" | "hiver" {
  const m = d.getMonth();
  if (m === 11 || m <= 1) return "hiver";
  if (m <= 4) return "printemps";
  if (m <= 7) return "ete";
  return "automne";
}
