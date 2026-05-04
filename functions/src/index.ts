/**
 * Cloud Functions entry point.
 *
 * Convention : un fichier par famille (tiles/<type>.ts, auth/<flow>.ts) ;
 * cet index ré-exporte uniquement les Functions à déployer.
 */
import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

// Tuiles
export { refreshWeatherTile, scheduledWeatherRefresh } from "./tiles/weather";
export { syncCalendarTile, scheduledCalendarRefresh } from "./tiles/calendar";

// Kitchen Buddy (Phase 3)
export {
  createMealPlan,
  validateMealPlan,
  deleteMealPlan,
} from "./tiles/kitchenBuddy/plans";
export {
  acceptSlot,
  refuseSlot,
  updateSlotPresence,
} from "./tiles/kitchenBuddy/slots";

// Auth display
export {
  createDisplayToken,
  exchangeSetupToken,
  refreshDisplayToken,
  resolveSetupShortId,
} from "./auth/displayToken";
