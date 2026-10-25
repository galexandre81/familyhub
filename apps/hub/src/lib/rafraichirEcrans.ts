import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { lancerSansAttendre } from "./sansAttente";

/**
 * Demande au serveur de recalculer les écrans du foyer (menu, recette du
 * jour, météo, agenda) sans attendre : appelé après un import de plan ou une
 * modification de créneau, pour que l'iPad suive sans le bouton manuel.
 * Un échec n'est qu'un avertissement console (le cron finit par rattraper).
 */
export function rafraichirEcransSansAttendre(householdId: string): void {
  lancerSansAttendre(
    () => httpsCallable<{ householdId: string }, unknown>(functions, "refreshHouseholdDisplays")({ householdId }),
    "rafraîchissement des écrans",
  );
}
