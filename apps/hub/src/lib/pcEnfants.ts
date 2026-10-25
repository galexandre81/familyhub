/**
 * Carte « PC des enfants » : nom affiché, réglable dans Paramètres
 * (`parametres.nomPcEnfants` du foyer). Même règle sur l'iPad
 * (apps/display/public/js/tableau.js, titrePc).
 */
export const NOM_PC_DEFAUT = "PC des enfants";
export const NOM_PC_MAX = 30;

export function titrePcEnfants(parametres?: { nomPcEnfants?: string } | null): string {
  const nom = parametres?.nomPcEnfants?.trim();
  return nom ? nom.slice(0, NOM_PC_MAX) : NOM_PC_DEFAUT;
}
