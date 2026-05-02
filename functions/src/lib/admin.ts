import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
// Permet d'écrire des objets contenant des `field: undefined` (ex: event.location absent)
// sans avoir à les filtrer un par un avant chaque set/update.
db.settings({ ignoreUndefinedProperties: true });
export const auth = admin.auth();
export { admin };
