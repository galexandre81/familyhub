// FICHIER GÉNÉRÉ — ne pas modifier. Copie de packages/controle-parental/src/domaine.ts
// (node scripts/copier-controle-parental-functions.mjs).
/**
 * « Le prof demande ce site » : une adresse collée (avec ou sans https://,
 * chemin, paramètres, majuscules, espaces) devient le domaine que la liste
 * blanche école retient. Seul « www. » est retiré : un sous-domaine porte
 * souvent l'établissement (0390000a.index-education.net pour Pronote).
 */
const ETIQUETTE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export function normaliserDomaine(saisie: string): string | null {
  const brut = saisie.trim();
  if (!brut || /\s/.test(brut)) return null;
  let hote: string;
  try {
    hote = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(brut) ? brut : `https://${brut}`).hostname;
  } catch {
    return null;
  }
  hote = hote.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  const etiquettes = hote.split(".");
  if (etiquettes.length < 2 || hote.length > 253) return null;
  if (!etiquettes.every((e) => ETIQUETTE.test(e))) return null;
  // Une adresse IP n'est pas un site qu'un professeur fait ouvrir.
  if (/^\d+$/.test(etiquettes[etiquettes.length - 1])) return null;
  return hote;
}

/** Ajout sans doublon, ordre conservé. */
export function ajouterDomaine(liste: readonly string[], domaine: string): string[] {
  return liste.includes(domaine) ? [...liste] : [...liste, domaine];
}
