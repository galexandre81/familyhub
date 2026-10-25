import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { creerRafraichisseur, type PorteeRafraichissement } from "./rafraichissementGroupe";

/** Délai de regroupement des demandes (une rafale de clics = un appel). */
const DELAI_REGROUPEMENT_MS = 1500;

/**
 * Demande au serveur de recalculer les écrans du foyer, sans attendre et en
 * regroupant les rafales (1,5 s après la dernière demande, par foyer).
 * Modifications de créneaux : « menu » (menu + recette du jour) ; import de
 * plan : « tout » (+ météo et agenda). Un échec n'est qu'un avertissement
 * console : le cron finit par rattraper.
 */
export const rafraichirEcransSansAttendre: (
  householdId: string,
  portee: PorteeRafraichissement,
) => void = creerRafraichisseur(
  (householdId, portee) =>
    httpsCallable<{ householdId: string; portee: PorteeRafraichissement }, unknown>(
      functions,
      "refreshHouseholdDisplays",
    )({ householdId, portee }),
  DELAI_REGROUPEMENT_MS,
);
