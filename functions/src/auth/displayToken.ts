import { onCall, HttpsError } from "firebase-functions/v2/https";
import { randomBytes } from "node:crypto";
import { admin, auth, db } from "../lib/admin";
import { assertHouseholdMember } from "../lib/household";

const SETUP_TOKEN_TTL_SECONDS = 30 * 60; // 30 min
const AUTH_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 jours

/** Alphabet sans caractères confusables (0/O, 1/I/L) — facilite la saisie sur iPad. */
const SHORT_ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const SHORT_ID_LENGTH = 6;

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

function generateShortId(): string {
  const bytes = randomBytes(SHORT_ID_LENGTH);
  let out = "";
  for (let i = 0; i < SHORT_ID_LENGTH; i++) {
    out += SHORT_ID_ALPHABET[bytes[i] % SHORT_ID_ALPHABET.length];
  }
  return out;
}

/** Trouve un shortId unique via lookup direct sur la collection racine `setupShortIds`. */
async function generateUniqueShortId(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = generateShortId();
    const existing = await db.doc(`setupShortIds/${id}`).get();
    if (!existing.exists) return id;
  }
  throw new HttpsError("internal", "Impossible de générer un code unique, réessayez");
}

/**
 * Appelé depuis le hub : génère un token de setup à courte durée
 * que l'utilisateur saisit/scanne sur l'iPad pour échanger contre un token longue durée.
 */
export const createDisplayToken = onCall(
  { region: "europe-west1", invoker: "public" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");

    const { householdId, displayId } = req.data as { householdId: string; displayId: string };
    if (!householdId || !displayId) {
      throw new HttpsError("invalid-argument", "householdId et displayId requis");
    }

    await assertHouseholdMember(uid, householdId);

    const displayRef = db.doc(`households/${householdId}/displays/${displayId}`);

    // Nettoyage : supprime l'ancien setupShortId pour ce display (sinon il s'accumule
    // et un vieux bookmark /d/{ancienShortId} pourrait revenir résoudre un token mort).
    const previousDisplaySnap = await displayRef.get().catch(() => null);
    const previousShortId = previousDisplaySnap?.exists
      ? (previousDisplaySnap.data()?.setupShortId as string | undefined)
      : undefined;

    const setupToken = generateToken();
    const setupShortId = await generateUniqueShortId();
    const setupTokenExpiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + SETUP_TOKEN_TTL_SECONDS * 1000,
    );

    // Lookup table racine pour résolution rapide depuis le display non authentifié.
    await db.doc(`setupShortIds/${setupShortId}`).set({
      householdId,
      displayId,
      setupToken,
      expiresAt: setupTokenExpiresAt,
    });

    if (previousShortId && previousShortId !== setupShortId) {
      await db.doc(`setupShortIds/${previousShortId}`).delete().catch(() => {/* noop */});
    }

    await displayRef.update({
      setupToken,
      setupShortId,
      setupTokenExpiresAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      setupToken,
      setupShortId,
      expiresAt: setupTokenExpiresAt.toMillis(),
      setupUrl: `/display/setup?token=${setupToken}&household=${householdId}&display=${displayId}`,
      shortUrl: `/d/${setupShortId}`,
    };
  },
);

/**
 * Résout un setupShortId court → renvoie SEULEMENT householdId/displayId (jamais
 * le setupToken : un endpoint public ne doit pas être un oracle à token).
 * L'échange réel se fait via `exchangeSetupToken({ shortId })` qui résout et
 * consomme le token côté serveur dans une transaction.
 */
export const resolveSetupShortId = onCall(
  { region: "europe-west1", invoker: "public" },
  async (req) => {
    const { shortId } = req.data as { shortId: string };
    if (!shortId) {
      throw new HttpsError("invalid-argument", "shortId requis");
    }

    const snap = await db.doc(`setupShortIds/${shortId.toUpperCase()}`).get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Code introuvable ou expiré");
    }

    const data = snap.data()!;
    const expiresAt = data.expiresAt as FirebaseFirestore.Timestamp | undefined;
    if (!expiresAt || expiresAt.toMillis() < Date.now()) {
      throw new HttpsError("deadline-exceeded", "Code expiré");
    }

    return {
      householdId: data.householdId as string,
      displayId: data.displayId as string,
    };
  },
);

/**
 * Appelé depuis le display vanilla au boot :
 *  - chemin court : `{ shortId }` → le token est résolu ET consommé côté serveur ;
 *  - chemin long  : `{ householdId, displayId, setupToken }` (URL/QR avec ?token=).
 * Échange le setup token contre un Firebase custom auth token + un long-lived
 * authToken stocké en localStorage côté display (pour ré-auth automatique).
 *
 * Sécurité : validation + suppression du setup token se font dans une SEULE
 * transaction Firestore (consume atomique → non rejouable). Le setupShortId est
 * supprimé dans la même transaction.
 */
export const exchangeSetupToken = onCall(
  { region: "europe-west1", invoker: "public" },
  async (req) => {
    const {
      householdId: bodyHouseholdId,
      displayId: bodyDisplayId,
      setupToken: bodySetupToken,
      shortId,
    } = req.data as {
      householdId?: string;
      displayId?: string;
      setupToken?: string;
      shortId?: string;
    };

    if (!shortId && (!bodyHouseholdId || !bodyDisplayId || !bodySetupToken)) {
      throw new HttpsError(
        "invalid-argument",
        "Fournir shortId, ou householdId+displayId+setupToken",
      );
    }

    const authToken = generateToken();
    const authTokenExpiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + AUTH_TOKEN_TTL_SECONDS * 1000,
    );

    // Consume atomique : tout (résolution shortId, validation token, écriture
    // authToken, suppression du setup) dans une transaction. Empêche le rejeu.
    const result = await db.runTransaction(async (tx) => {
      let householdId = bodyHouseholdId;
      let displayId = bodyDisplayId;
      let expectedToken = bodySetupToken;
      let shortIdRef: FirebaseFirestore.DocumentReference | null = null;

      // ----- Lectures (toutes avant les écritures, contrainte Firestore) -----
      if (shortId) {
        shortIdRef = db.doc(`setupShortIds/${String(shortId).toUpperCase()}`);
        const sidSnap = await tx.get(shortIdRef);
        if (!sidSnap.exists) {
          throw new HttpsError("not-found", "Code introuvable ou expiré");
        }
        const sid = sidSnap.data()!;
        const sidExp = sid.expiresAt as FirebaseFirestore.Timestamp | undefined;
        if (!sidExp || sidExp.toMillis() < Date.now()) {
          throw new HttpsError("deadline-exceeded", "Code expiré");
        }
        householdId = sid.householdId as string;
        displayId = sid.displayId as string;
        expectedToken = sid.setupToken as string;
      }

      if (!householdId || !displayId) {
        throw new HttpsError("invalid-argument", "Paramètres manquants");
      }

      const displayRef = db.doc(`households/${householdId}/displays/${displayId}`);
      const displaySnap = await tx.get(displayRef);
      if (!displaySnap.exists) {
        throw new HttpsError("not-found", "Display introuvable");
      }
      const data = displaySnap.data()!;

      if (data.revoked === true) {
        throw new HttpsError("permission-denied", "Cet écran a été révoqué");
      }
      if (!data.setupToken || data.setupToken !== expectedToken) {
        throw new HttpsError("permission-denied", "Token de setup invalide");
      }
      const exp = data.setupTokenExpiresAt as FirebaseFirestore.Timestamp | undefined;
      if (!exp || exp.toMillis() < Date.now()) {
        throw new HttpsError("deadline-exceeded", "Token de setup expiré");
      }

      const consumedShortId = data.setupShortId as string | undefined;

      // ----- Écritures -----
      tx.update(displayRef, {
        authToken,
        authTokenExpiresAt,
        setupToken: admin.firestore.FieldValue.delete(),
        setupTokenExpiresAt: admin.firestore.FieldValue.delete(),
        setupShortId: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // Supprime la lookup table (empêche un vieux bookmark /d/{shortId} de
      // relancer un échange).
      if (shortIdRef) {
        tx.delete(shortIdRef);
      } else if (consumedShortId) {
        tx.delete(db.doc(`setupShortIds/${consumedShortId}`));
      }

      return { householdId, displayId, nom: (data.nom as string) || "" };
    });

    // Hors transaction : provisionne le compte service + custom token.
    const displayUid = `display:${result.displayId}`;
    try {
      await auth.getUser(displayUid);
    } catch {
      await auth.createUser({ uid: displayUid, displayName: `Display ${result.nom}` });
    }
    await auth.setCustomUserClaims(displayUid, {
      isDisplay: true,
      householdId: result.householdId,
      displayId: result.displayId,
    });
    const customToken = await auth.createCustomToken(displayUid, {
      isDisplay: true,
      householdId: result.householdId,
      displayId: result.displayId,
    });

    // Note : le custom token Firebase Auth a une durée de 1h max imposée par Firebase.
    // Le display appelle `refreshDisplayToken` avant expiration via le authToken local.
    return {
      customToken,
      authToken,
      authTokenExpiresAt: authTokenExpiresAt.toMillis(),
      householdId: result.householdId,
      displayId: result.displayId,
    };
  },
);

/**
 * Appelé périodiquement par le display pour obtenir un nouveau custom token Firebase Auth
 * sans repasser par le flow setup. Authentifié par `authToken` local (vérifié contre Firestore).
 */
export const refreshDisplayToken = onCall(
  { region: "europe-west1", invoker: "public" },
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

    // Kill switch : un écran marqué `revoked` ne peut plus se ré-authentifier.
    if (data.revoked === true) {
      throw new HttpsError("permission-denied", "Cet écran a été révoqué");
    }
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
