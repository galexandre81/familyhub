import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { randomBytes } from "node:crypto";
import { admin, db } from "../lib/admin";
import { assertHouseholdMember } from "../lib/household";
import { requireId } from "../lib/validate";
import { SHORT_ID_ALPHABET } from "../auth/displayToken";
import {
  DUREE_INVITATION_MS,
  validerInvitation,
  type InvitationDoc,
  type RaisonRefusInvitation,
} from "./invitationRules";

const CODE_LENGTH = 10;

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += SHORT_ID_ALPHABET[bytes[i] % SHORT_ID_ALPHABET.length];
  }
  return out;
}

/** Code saisi ou lu dans l'adresse, en majuscules ; `null` si le format ne colle pas. */
function lireCode(value: unknown): string | null {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  const valide =
    code.length === CODE_LENGTH &&
    Array.from(code).every((c) => SHORT_ID_ALPHABET.includes(c));
  return valide ? code : null;
}

const CODE_ERREUR: Record<RaisonRefusInvitation, ConstructorParameters<typeof HttpsError>[0]> = {
  "introuvable": "not-found",
  "expiree": "deadline-exceeded",
  "deja-utilisee": "failed-precondition",
  "deja-membre": "already-exists",
};

function refus(raison: RaisonRefusInvitation): HttpsError {
  return new HttpsError(CODE_ERREUR[raison], `Invitation refusée : ${raison}`, { raison });
}

/** Un vrai compte connecté, jamais un écran (custom token `isDisplay`). */
function exigerPersonne(req: CallableRequest): string {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Auth requise");
  if (req.auth?.token?.isDisplay === true) {
    throw new HttpsError("permission-denied", "Action réservée aux membres du foyer");
  }
  return uid;
}

/**
 * Appelé depuis le hub (Paramètres) par un membre : crée un lien d'invitation
 * à usage unique, valable 7 jours, qui fait entrer la personne comme parent.
 */
export const createInvitation = onCall(
  { region: "europe-west1", invoker: "public" },
  async (req) => {
    const uid = exigerPersonne(req);
    const input = (req.data ?? {}) as { householdId?: unknown };
    const householdId = requireId(input.householdId, "householdId");

    await assertHouseholdMember(uid, householdId);

    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + DUREE_INVITATION_MS);
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateCode();
      try {
        // `create` échoue si le code existe déjà : jamais d'écrasement.
        await db.doc(`invitations/${code}`).create({
          householdId,
          createdBy: uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt,
          role: "parent",
        });
        logger.info("Invitation créée", { householdId });
        return { code, expiresAt: expiresAt.toMillis() };
      } catch (err) {
        // 6 = ALREADY_EXISTS (gRPC) : on retente avec un autre code.
        if ((err as { code?: number }).code !== 6) throw err;
      }
    }
    throw new HttpsError("internal", "Impossible de générer un code unique, réessaie");
  },
);

/**
 * Appelé par la personne invitée, connectée avec son propre compte Google :
 * l'ajoute au foyer (membres + rôle), au doc users/{uid}, et consomme
 * l'invitation — tout dans une transaction (usage unique, non rejouable).
 */
export const acceptInvitation = onCall(
  { region: "europe-west1", invoker: "public" },
  async (req) => {
    const uid = exigerPersonne(req);
    const input = (req.data ?? {}) as { code?: unknown };
    const code = lireCode(input.code);
    if (!code) throw refus("introuvable");

    const resultat = await db.runTransaction(async (tx) => {
      // ----- Lectures -----
      const invRef = db.doc(`invitations/${code}`);
      const invSnap = await tx.get(invRef);
      const inv = invSnap.exists ? (invSnap.data() as InvitationDoc) : undefined;
      if (!inv) throw refus("introuvable");

      const householdId = requireId(inv.householdId, "householdId");
      const householdRef = db.doc(`households/${householdId}`);
      const householdSnap = await tx.get(householdRef);
      if (!householdSnap.exists) throw refus("introuvable");
      const household = householdSnap.data()!;
      const membres = (household.membres as string[] | undefined) ?? [];

      const userRef = db.doc(`users/${uid}`);
      const userSnap = await tx.get(userRef);

      const verdict = validerInvitation(inv, uid, membres, Date.now());
      if (!verdict.ok) throw refus(verdict.raison);

      // ----- Écritures -----
      tx.update(
        householdRef,
        "membres", admin.firestore.FieldValue.arrayUnion(uid),
        new admin.firestore.FieldPath("roles", uid), inv.role,
        "updatedAt", admin.firestore.FieldValue.serverTimestamp(),
      );
      tx.set(
        userRef,
        {
          householdsIds: admin.firestore.FieldValue.arrayUnion(householdId),
          ...(userSnap.data()?.defaultHouseholdId ? {} : { defaultHouseholdId: householdId }),
        },
        { merge: true },
      );
      tx.update(invRef, {
        usedBy: uid,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { householdId, nom: (household.nom as string | undefined) ?? "" };
    });

    logger.info("Invitation acceptée", { householdId: resultat.householdId });
    return resultat;
  },
);
