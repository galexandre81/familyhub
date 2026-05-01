import { onCall, HttpsError } from "firebase-functions/v2/https";
import { randomBytes } from "node:crypto";
import { admin, auth, db } from "../lib/admin";
import { assertHouseholdMember } from "../lib/household";

const SETUP_TOKEN_TTL_SECONDS = 30 * 60; // 30 min
const AUTH_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 jours

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Appelé depuis le hub : génère un token de setup à courte durée
 * que l'utilisateur saisit/scanne sur l'iPad pour échanger contre un token longue durée.
 */
export const createDisplayToken = onCall(
  { region: "europe-west1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");

    const { householdId, displayId } = req.data as { householdId: string; displayId: string };
    if (!householdId || !displayId) {
      throw new HttpsError("invalid-argument", "householdId et displayId requis");
    }

    await assertHouseholdMember(uid, householdId);

    const setupToken = generateToken();
    const setupTokenExpiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + SETUP_TOKEN_TTL_SECONDS * 1000,
    );

    await db.doc(`households/${householdId}/displays/${displayId}`).update({
      setupToken,
      setupTokenExpiresAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      setupToken,
      expiresAt: setupTokenExpiresAt.toMillis(),
      setupUrl: `/display/setup?token=${setupToken}&household=${householdId}&display=${displayId}`,
    };
  },
);

/**
 * Appelé depuis le display vanilla au boot avec ?token=xxx :
 * échange le setup token contre un Firebase custom auth token + un long-lived
 * authToken stocké en localStorage côté display (pour future ré-auth automatique).
 */
export const exchangeSetupToken = onCall(
  { region: "europe-west1" },
  async (req) => {
    const { householdId, displayId, setupToken } = req.data as {
      householdId: string;
      displayId: string;
      setupToken: string;
    };

    if (!householdId || !displayId || !setupToken) {
      throw new HttpsError("invalid-argument", "householdId, displayId, setupToken requis");
    }

    const displayRef = db.doc(`households/${householdId}/displays/${displayId}`);
    const displaySnap = await displayRef.get();
    if (!displaySnap.exists) {
      throw new HttpsError("not-found", "Display introuvable");
    }
    const data = displaySnap.data()!;

    if (data.setupToken !== setupToken) {
      throw new HttpsError("permission-denied", "Token de setup invalide");
    }
    const expiresAt = data.setupTokenExpiresAt as FirebaseFirestore.Timestamp | undefined;
    if (!expiresAt || expiresAt.toMillis() < Date.now()) {
      throw new HttpsError("deadline-exceeded", "Token de setup expiré");
    }

    // Crée un compte service pour ce display si pas déjà fait.
    const displayUid = `display:${displayId}`;
    try {
      await auth.getUser(displayUid);
    } catch {
      await auth.createUser({ uid: displayUid, displayName: `Display ${data.nom}` });
    }

    // Custom claims pour permettre aux règles Firestore (futures) de distinguer un display
    await auth.setCustomUserClaims(displayUid, {
      isDisplay: true,
      householdId,
      displayId,
    });

    const customToken = await auth.createCustomToken(displayUid, {
      isDisplay: true,
      householdId,
      displayId,
    });

    const authToken = generateToken();
    const authTokenExpiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + AUTH_TOKEN_TTL_SECONDS * 1000,
    );

    await displayRef.update({
      authToken,
      authTokenExpiresAt,
      setupToken: admin.firestore.FieldValue.delete(),
      setupTokenExpiresAt: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Note : le custom token Firebase Auth a une durée de 1h max imposée par Firebase.
    // Le display doit appeler `refreshDisplayToken` avant expiration en utilisant le authToken local.
    return {
      customToken,
      authToken,
      authTokenExpiresAt: authTokenExpiresAt.toMillis(),
      householdId,
      displayId,
    };
  },
);

/**
 * Appelé périodiquement par le display pour obtenir un nouveau custom token Firebase Auth
 * sans repasser par le flow setup. Authentifié par `authToken` local (vérifié contre Firestore).
 */
export const refreshDisplayToken = onCall(
  { region: "europe-west1" },
  async (req) => {
    const { householdId, displayId, authToken } = req.data as {
      householdId: string;
      displayId: string;
      authToken: string;
    };

    if (!householdId || !displayId || !authToken) {
      throw new HttpsError("invalid-argument", "Paramètres manquants");
    }

    const displaySnap = await db.doc(`households/${householdId}/displays/${displayId}`).get();
    if (!displaySnap.exists) {
      throw new HttpsError("not-found", "Display introuvable");
    }
    const data = displaySnap.data()!;

    if (data.authToken !== authToken) {
      throw new HttpsError("permission-denied", "Token invalide");
    }
    const expiresAt = data.authTokenExpiresAt as FirebaseFirestore.Timestamp | undefined;
    if (!expiresAt || expiresAt.toMillis() < Date.now()) {
      throw new HttpsError("deadline-exceeded", "Token expiré, reconfigurez le display");
    }

    const displayUid = `display:${displayId}`;
    const customToken = await auth.createCustomToken(displayUid, {
      isDisplay: true,
      householdId,
      displayId,
    });

    return { customToken };
  },
);
