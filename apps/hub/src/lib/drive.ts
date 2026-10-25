/**
 * Courses sur l'ordinateur — logique pure : lien de recherche du drive
 * (Intermarché par défaut), texte de la liste drive, fichier HTML du magasin.
 * Aucun remplissage automatique du panier : on ouvre la recherche, la
 * personne ajoute elle-même au panier.
 */
import type { ArticleCourses } from "@family-hub/types";
import { grouperParRayon, vueDrive, vueMagasin, type ArticleAvecId } from "./listeCourses";
import { libelleQuantite } from "./coursesTelephone";

/**
 * Recherche Intermarché. L'adresse exacte n'a pas pu être vérifiée (le site
 * bloque les robots) : elle se change dans Paramètres
 * (`parametres.modeleRechercheDrive`).
 */
export const RECHERCHE_DRIVE_DEFAUT = "https://www.intermarche.com/recherche/{terme}";

const TERME = "{terme}";

/** Adresse web (http/https, sans espace) qui contient `{terme}`. */
export function modeleDriveValide(modele: string | undefined | null): boolean {
  const m = (modele ?? "").trim();
  return /^https?:\/\/\S+$/i.test(m) && m.includes(TERME);
}

/**
 * Lien de recherche d'un produit sur le drive : chaque `{terme}` du modèle
 * est remplacé par le nom encodé (le nom d'un article ne porte pas la
 * quantité, elle est à part). Apostrophe typographique ramenée à « ' », puis
 * encodée (`%27`). Modèle vide ou invalide → recherche Intermarché.
 */
export function lienRechercheDrive(nom: string, modele: string = RECHERCHE_DRIVE_DEFAUT): string {
  const gabarit = modeleDriveValide(modele) ? modele.trim() : RECHERCHE_DRIVE_DEFAUT;
  const terme = encodeURIComponent(nom.trim().replace(/[’‘]/g, "'")).replace(/'/g, "%27");
  return gabarit.split(TERME).join(terme);
}

function ligneArticle(a: Pick<ArticleCourses, "nom" | "quantite" | "unite">): string {
  const q = libelleQuantite(a);
  return q ? `${a.nom} (${q})` : a.nom;
}

/** « Copier la liste drive » : un article du drive pas encore au panier par ligne. Vide si rien. */
export function texteListeDrive(articles: ArticleAvecId[]): string {
  return vueDrive(articles)
    .filter((a) => !a.checked)
    .map(ligneArticle)
    .join("\n");
}

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Fichier HTML autonome (mail, AirDrop) : articles du magasin non cochés,
 * par rayon dans l'ordre du magasin, cases à cocher cliquables. Vide si rien.
 */
export function htmlListeMagasin(articles: ArticleAvecId[], date: Date = new Date()): string {
  const restants = vueMagasin(articles).filter((a) => !a.checked);
  if (restants.length === 0) return "";
  const jour = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const sections = grouperParRayon(restants)
    .map((g) => {
      const lignes = g.articles
        .map((a) => {
          const q = libelleQuantite(a);
          return `<li><label><input type="checkbox"> <span class="n">${echapper(a.nom)}</span>${q ? `<span class="q"> — ${echapper(q)}</span>` : ""}</label></li>`;
        })
        .join("\n");
      return `<section><h2>${echapper(g.libelle)}</h2><ul>${lignes}</ul></section>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Courses — ${echapper(jour)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         max-width: 640px; margin: 0 auto; padding: 20px 16px 80px;
         background: #FAFAF7; color: #1F1A14; line-height: 1.4; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .date { font-size: 13px; color: #6B5A47; margin-bottom: 24px; font-style: italic; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.15em;
       color: #B26E38; border-bottom: 1px solid #D4C7AC; padding-bottom: 4px;
       margin: 24px 0 10px; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.05); }
  label { display: flex; align-items: baseline; gap: 10px; cursor: pointer; font-size: 16px; }
  input[type="checkbox"] { width: 20px; height: 20px; flex-shrink: 0; accent-color: #B26E38; cursor: pointer; }
  input[type="checkbox"]:checked + .n { text-decoration: line-through; color: #9C8A6E; }
  .q { color: #6B5A47; font-size: 14px; }
  @media print { body { background: white; } }
</style>
</head>
<body>
<h1>Courses au magasin</h1>
<div class="date">${echapper(jour)}</div>
${sections}
</body>
</html>`;
}
