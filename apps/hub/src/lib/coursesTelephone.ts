/**
 * Onglet « Courses » du téléphone — logique pure : mode par défaut,
 * progression du magasin, texte à partager, libellés.
 */
import type { ArticleCourses, Profil } from "@family-hub/types";
import { profilDuCompte } from "./personnes";
import { grouperParRayon, vueMagasin, type ArticleAvecId } from "./listeCourses";

/** « Trier » à la maison, « Magasin » pour cocher. */
export type ModeCourses = "trier" | "magasin";

/** Clé `sessionStorage` du mode choisi. */
export const CLE_MODE_COURSES = "courses.mode";

/** « Trier » s'il reste des articles à trier, sinon « Magasin ». */
export function modeParDefaut(articles: Array<Pick<ArticleCourses, "destination">>): ModeCourses {
  return articles.some((a) => a.destination === "a-trier") ? "trier" : "magasin";
}

/** Mode relu dans le stockage ; toute autre valeur est ignorée. */
export function modeEnregistre(valeur: string | null | undefined): ModeCourses | undefined {
  return valeur === "trier" || valeur === "magasin" ? valeur : undefined;
}

/** Articles du magasin cochés / total du magasin (le drive et « on l'a » ne comptent pas). */
export function progressionMagasin(articles: ArticleAvecId[]): {
  coches: number;
  total: number;
  pourcentage: number;
} {
  const magasin = vueMagasin(articles);
  const coches = magasin.filter((a) => a.checked).length;
  const total = magasin.length;
  return { coches, total, pourcentage: total ? Math.round((coches / total) * 100) : 0 };
}

/** « 500 g », « 3 », « 1,5 kg » ; rien pour une seule pièce sans unité. */
export function libelleQuantite(a: Pick<ArticleCourses, "quantite" | "unite">): string {
  const unite = (a.unite ?? "").trim();
  if (!unite && a.quantite === 1) return "";
  const q = String(a.quantite).replace(".", ",");
  return unite ? `${q} ${unite}` : q;
}

/**
 * Texte de secours (« Partager la liste ») : articles du magasin non cochés,
 * par rayon dans l'ordre du magasin, avec le titre du rayon. Vide si rien.
 */
export function texteAPartager(articles: ArticleAvecId[]): string {
  const restants = vueMagasin(articles).filter((a) => !a.checked);
  if (restants.length === 0) return "";
  const lignes = ["Courses"];
  for (const g of grouperParRayon(restants)) {
    lignes.push("", g.libelle);
    for (const a of g.articles) {
      const q = libelleQuantite(a);
      lignes.push(q ? `- ${a.nom} (${q})` : `- ${a.nom}`);
    }
  }
  return lignes.join("\n");
}

const PASTILLES_COURTES: Record<string, string> = {
  "fruits-legumes": "Légumes",
};

/** Libellé court d'une pastille de rayon (« Légumes 9 »). */
export function libellePastille(rayon: string, libelle: string): string {
  return PASTILLES_COURTES[rayon] ?? libelle;
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** « Semaine du lundi 26 octobre » (date locale). */
export function titreSemaine(debut: Date): string {
  const n = debut.getDate();
  return `Semaine du ${JOURS[debut.getDay()]} ${n === 1 ? "1er" : n} ${MOIS[debut.getMonth()]}`;
}

/** Prénom (premier mot du nom) du profil relié au compte qui a coché ; « ? » sinon. */
export function prenomQuiACoche<T extends Profil & { id: string }>(
  profils: T[],
  uid: string | null | undefined,
): { prenom: string; profil?: T } {
  const profil = uid ? profilDuCompte(profils, uid) : undefined;
  const prenom = profil?.nom.trim().split(/\s+/)[0];
  return prenom ? { prenom, profil } : { prenom: "?" };
}
