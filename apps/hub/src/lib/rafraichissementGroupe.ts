import { lancerSansAttendre } from "./sansAttente";

/**
 * Portée du recalcul des écrans demandé au serveur :
 * - « menu » : menu de la semaine + recette du jour (modifications de créneaux) ;
 * - « tout » : en plus météo et agenda (import de plan, bouton du Menu).
 */
export type PorteeRafraichissement = "menu" | "tout";

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
