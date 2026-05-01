import { logger } from "firebase-functions";
import type { TileType } from "../types";
import { admin, db } from "../lib/admin";

const SNAPSHOT_TTL_SECONDS = 60 * 60; // 1h

/**
 * Met à jour les snapshots de tous les displays du foyer qui contiennent cette tuile.
 * Appelé après chaque refresh de données (weather, calendar, ...).
 */
export async function rebuildSnapshotForTile(
  householdId: string,
  tileId: string,
  _tileType: TileType,
  data: unknown,
): Promise<void> {
  const displaysRef = db.collection(`households/${householdId}/displays`);
  const displaysSnap = await displaysRef.get();

  const writes: Promise<unknown>[] = [];

  for (const displayDoc of displaysSnap.docs) {
    const layout = (displayDoc.data().layout as Array<{ tileId: string }> | undefined) ?? [];
    const containsTile = layout.some((l) => l.tileId === tileId);
    if (!containsTile) continue;

    const snapshotRef = displayDoc.ref.collection("snapshot").doc("current");
    const update = {
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ttlSeconds: SNAPSHOT_TTL_SECONDS,
      [`tiles.${tileId}`]: {
        data,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    };
    writes.push(snapshotRef.set(update, { merge: true }));
  }

  await Promise.all(writes);
  logger.info(`Snapshot mis à jour pour tile ${tileId} dans ${writes.length} display(s) du foyer ${householdId}`);
}

/**
 * Reconstruit le snapshot complet d'un display.
 * Appelé après modification du layout, ou pré-calcul nocturne.
 */
export async function rebuildSnapshotForDisplay(householdId: string, displayId: string): Promise<void> {
  const displayRef = db.doc(`households/${householdId}/displays/${displayId}`);
  const displaySnap = await displayRef.get();
  if (!displaySnap.exists) return;

  const layout = (displaySnap.data()?.layout as Array<{ tileId: string }> | undefined) ?? [];
  const tileIds = layout.map((l) => l.tileId);

  const tiles: Record<string, { data: unknown; generatedAt: FirebaseFirestore.FieldValue }> = {};
  for (const tileId of tileIds) {
    const tileSnap = await db.doc(`households/${householdId}/tiles/${tileId}`).get();
    if (!tileSnap.exists) continue;
    // Pour l'instant on récupère depuis le snapshot courant si présent ; sinon laissé vide.
    // Les tuiles sans pré-calcul (ex: clock, radio) n'ont pas de data ici — calcul côté display.
    tiles[tileId] = {
      data: {},
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
  }

  await displayRef.collection("snapshot").doc("current").set(
    {
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ttlSeconds: SNAPSHOT_TTL_SECONDS,
      tiles,
    },
    { merge: true },
  );
}
