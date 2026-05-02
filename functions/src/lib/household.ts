import { HttpsError } from "firebase-functions/v2/https";
import { db } from "./admin";

export async function assertHouseholdMember(uid: string, householdId: string): Promise<void> {
  const snap = await db.doc(`households/${householdId}`).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", `Household ${householdId} introuvable`);
  }
  const membres = (snap.data()?.membres as string[] | undefined) ?? [];
  if (!membres.includes(uid)) {
    throw new HttpsError("permission-denied", "Vous n'êtes pas membre de ce foyer");
  }
}

export async function getHouseholdMembers(householdId: string): Promise<string[]> {
  const snap = await db.doc(`households/${householdId}`).get();
  return (snap.data()?.membres as string[] | undefined) ?? [];
}
