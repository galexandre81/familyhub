/**
 * Mode recette — logique pure : assemblage du repas (plat principal puis
 * accompagnements), quantités ajustées aux portions, libellés.
 */
import type { MealPlanSlot, Recette, RecetteEtape, Repas } from "@family-hub/types";

export interface RepasAssemble {
  presentes: Array<{ id: string; recette: Recette }>;
  manquantes: string[];
}

/** Recettes du repas dans l'ordre du slot (plat principal d'abord), doublons ignorés. */
export function assemblerRepas(
  recetteIds: string[],
  recettes: Record<string, Recette | undefined>,
): RepasAssemble {
  const vus = new Set<string>();
  const presentes: RepasAssemble["presentes"] = [];
  const manquantes: string[] = [];
  for (const id of recetteIds) {
    if (vus.has(id)) continue;
    vus.add(id);
    const recette = recettes[id];
    if (recette) presentes.push({ id, recette });
    else manquantes.push(id);
  }
  return { presentes, manquantes };
}

function formatFr(n: number): string {
  const arrondi = Math.round(n * 10 + 1e-9) / 10;
  return String(arrondi).replace(".", ",");
}

/**
 * Quantité recalculée pour `portions` personnes (recette prévue pour
 * `portionsBase`). Comprend « 200 », « 1,5 », « 0.5 », « 1/2 », suivis
 * éventuellement d'un texte (« 2 gousses ») ; le reste est rendu tel quel.
 * Arrondi à 1 décimale, virgule française.
 */
export function quantiteAjustee(
  brute: string | number | null | undefined,
  portionsBase: number,
  portions: number,
): string {
  // Les recettes importées peuvent porter un nombre (ou rien) au lieu d'un texte.
  const quantite = String(brute ?? "");
  if (!(portionsBase > 0) || !(portions > 0)) return quantite;
  const texte = quantite.trim();
  if (!texte) return quantite;
  const ratio = portions / portionsBase;

  const frac = texte.match(/^(\d+)\s*\/\s*(\d+)(.*)$/);
  if (frac) {
    const den = parseInt(frac[2], 10);
    if (den === 0) return quantite;
    return formatFr((parseInt(frac[1], 10) / den) * ratio) + frac[3];
  }
  const dec = texte.match(/^(\d+(?:[.,]\d+)?)(.*)$/);
  if (dec) {
    const n = parseFloat(dec[1].replace(",", "."));
    if (Number.isFinite(n)) return formatFr(n * ratio) + dec[2];
  }
  return quantite;
}

/** Portions par défaut : présents du slot (invités compris), sinon portions de la recette, sinon 4. */
export function portionsParDefaut(
  slot: Pick<MealPlanSlot, "profilsPresents" | "invitesNoms"> | undefined,
  portionsRecette: number | undefined,
): number {
  const presents = (slot?.profilsPresents?.length ?? 0) + (slot?.invitesNoms?.length ?? 0);
  if (presents > 0) return presents;
  if (portionsRecette && portionsRecette > 0) return portionsRecette;
  return 4;
}

const LONGUEUR_LIBELLE = 30;

/** Nom du minuteur lancé depuis une étape : son début, 30 caractères au plus. */
export function libelleEtape(description: string): string {
  const propre = description.replace(/\s+/g, " ").trim();
  if (propre.length <= LONGUEUR_LIBELLE) return propre;
  return propre.slice(0, LONGUEUR_LIBELLE - 1).trimEnd() + "…";
}

export function etapesTriees(etapes: RecetteEtape[] | undefined): RecetteEtape[] {
  return [...(etapes ?? [])].sort((a, b) => a.ordre - b.ordre);
}

const NOMS_REPAS: Record<Repas, string> = {
  petitDej: "Petit-déjeuner",
  dej: "Déjeuner",
  diner: "Dîner",
};

/** « Dîner du mardi 27 octobre » (date ISO AAAA-MM-JJ), ou le repas seul. */
export function titreRepas(repas: Repas, date: string | undefined): string {
  const nom = NOMS_REPAS[repas] ?? "Repas";
  const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return nom;
  const jour = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const texte = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(jour);
  return `${nom} du ${texte}`;
}
