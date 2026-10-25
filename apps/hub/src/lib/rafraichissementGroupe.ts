import { lancerSansAttendre } from "./sansAttente";

/**
 * Portée du recalcul des écrans demandé au serveur :
 * - « menu » : menu de la semaine + recette du jour (modifications de créneaux) ;
 * - « tout » : en plus météo et agenda (import de plan, bouton du Menu).
 */
export type PorteeRafraichissement = "menu" | "tout";

/**
 * Vrai si un patch du foyer touche les heures des repas (clé pointée
 * « parametres.heuresRepas[.x] » ou objet « parametres: { heuresRepas } ») :
 * l'iPad affiche le prochain repas d'après ces heures, il faut recalculer.
 */
export function patchToucheHeuresRepas(patch: Record<string, unknown> | null | undefined): boolean {
  if (!patch) return false;
  for (const cle of Object.keys(patch)) {
    if (cle === "parametres.heuresRepas" || cle.startsWith("parametres.heuresRepas.")) return true;
    if (cle === "parametres") {
      const p = patch[cle];
      if (p && typeof p === "object" && "heuresRepas" in p) return true;
    }
  }
  return false;
}

/**
 * Regroupe les demandes de rafraîchissement par foyer : l'appel part
 * `delaiMs` après la DERNIÈRE demande (une rafale de clics = un seul appel,
 * qui lit l'état final). Dans une rafale, « tout » l'emporte sur « menu ».
 * Un échec n'est qu'un avertissement console.
 */
export function creerRafraichisseur(
  appeler: (householdId: string, portee: PorteeRafraichissement) => Promise<unknown>,
  delaiMs: number,
): (householdId: string, portee: PorteeRafraichissement) => void {
  const enAttente = new Map<
    string,
    { minuterie: ReturnType<typeof setTimeout>; portee: PorteeRafraichissement }
  >();
  return (householdId, portee) => {
    const avant = enAttente.get(householdId);
    if (avant) clearTimeout(avant.minuterie);
    const porteeFinale: PorteeRafraichissement =
      avant?.portee === "tout" || portee === "tout" ? "tout" : "menu";
    const minuterie = setTimeout(() => {
      enAttente.delete(householdId);
      lancerSansAttendre(() => appeler(householdId, porteeFinale), "rafraîchissement des écrans");
    }, delaiMs);
    enAttente.set(householdId, { minuterie, portee: porteeFinale });
  };
}

/** Message affiché après le bouton « Mettre à jour les écrans ». */
export function messageEcransMisAJour(res: {
  weeklyMenuTiles: number;
  recipeTodayTiles: number;
  weatherTiles?: number;
  calendarTiles?: number;
}): string {
  const parties: string[] = [];
  if (res.weeklyMenuTiles > 0) parties.push("menu");
  if (res.recipeTodayTiles > 0) parties.push("recette du jour");
  if ((res.weatherTiles ?? 0) > 0) parties.push("météo");
  if ((res.calendarTiles ?? 0) > 0) parties.push("agenda");
  return parties.length === 0
    ? "Écrans mis à jour (aucune tuile à rafraîchir)."
    : `Écrans mis à jour : ${parties.join(", ")}.`;
}
