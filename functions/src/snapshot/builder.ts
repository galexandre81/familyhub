import { logger } from "firebase-functions";
import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import type { TileType } from "../types";
import { db } from "../lib/admin";

const SNAPSHOT_TTL_SECONDS = 60 * 60; // 1h

/** Codes gRPC renvoyés par Firestore. */
const NOT_FOUND = 5;
const ALREADY_EXISTS = 6;

function codeErreur(err: unknown): unknown {
  return (err as { code?: unknown } | null)?.code;
}

/**
 * Écrit `tiles.<tileId>` dans le snapshot d'un display en REMPLAÇANT l'entrée
 * en bloc : un `set(..., { merge: true })` fusionnait `data` en profondeur, si
 * bien qu'une clé absente de la nouvelle data (isFallbackToNext, notes, une
 * ville météo retirée…) survivait indéfiniment.
 *
 * `update` sur le chemin `tiles.<tileId>` remplace la valeur du champ sans
 * fusion. Au passage on purge les tuiles qui ne sont plus dans le layout.
 */
async function ecrireTuile(
  snapshotRef: FirebaseFirestore.DocumentReference,
  tileId: string,
  data: unknown,
  now: Timestamp,
  tuilesDuLayout: Set<string>,
): Promise<void> {
  const entree = { data, generatedAt: now };

  // Deux essais : le doc peut être créé (ou supprimé) entre la lecture et l'écriture.
  for (let essai = 0; essai < 2; essai++) {
    const snap = await snapshotRef.get();

    if (!snap.exists) {
      try {
        // `create` et non `set` : ne jamais écraser un snapshot apparu entre-temps.
        await snapshotRef.create({
          generatedAt: now,
          ttlSeconds: SNAPSHOT_TTL_SECONDS,
          tiles: { [tileId]: entree },
        });
        return;
      } catch (err) {
        if (codeErreur(err) === ALREADY_EXISTS) continue;
        throw err;
      }
    }

    // FieldPath plutôt que "tiles." + id : un id ne doit jamais être interprété
    // comme un chemin à points.
    const champs: unknown[] = [
      "generatedAt", now,
      "ttlSeconds", SNAPSHOT_TTL_SECONDS,
      new FieldPath("tiles", tileId), entree,
    ];
    const existantes = Object.keys((snap.data()?.tiles as Record<string, unknown> | undefined) ?? {});
    for (const id of existantes) {
      if (id !== tileId && !tuilesDuLayout.has(id)) {
        champs.push(new FieldPath("tiles", id), FieldValue.delete());
      }
    }

    try {
      await snapshotRef.update("generatedAt", now, ...champs.slice(2));
      return;
    } catch (err) {
      if (codeErreur(err) === NOT_FOUND) continue;
      throw err;
    }
  }
  throw new Error(`Snapshot ${snapshotRef.path} : écriture impossible (création/suppression concurrente)`);
}

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

  // Un seul timestamp calculé une fois, réutilisé au niveau doc et par-tuile,
  // pour garantir que generatedAt (doc) === tiles[tileId].generatedAt.
  const now = Timestamp.now();

  for (const displayDoc of displaysSnap.docs) {
    // Un écran révoqué (suppression en cours) ne reçoit plus rien.
    if (displayDoc.data().revoked === true) continue;
    const layout = (displayDoc.data().layout as Array<{ tileId: string }> | undefined) ?? [];
    const tuilesDuLayout = new Set(layout.map((l) => l.tileId));
    if (!tuilesDuLayout.has(tileId)) continue;

    const snapshotRef = displayDoc.ref.collection("snapshot").doc("current");
    writes.push(ecrireTuile(snapshotRef, tileId, data, now, tuilesDuLayout));
  }

  await Promise.all(writes);
  logger.info(`Snapshot mis à jour pour tile ${tileId} dans ${writes.length} display(s) du foyer ${householdId}`);
}
