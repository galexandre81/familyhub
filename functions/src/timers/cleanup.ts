/**
 * Nettoyage des minuteurs partagés `households/{hid}/timers/{id}` (plan 4).
 *
 * Toutes les 60 min : supprime les minuteurs terminés (`ended`) ou acquittés
 * (`acknowledged`) dont la fin date de plus d'1 h, et les minuteurs restés
 * `running` dont la fin date de plus de 24 h (oubliés : aucun écran ne les a
 * passés en `ended`). Les minuteurs en pause ne sont jamais supprimés.
 *
 * Choix de la requête : on parcourt les foyers puis leur sous-collection
 * `timers`, plutôt qu'un `collectionGroup("timers")` filtré (qui exigerait un
 * index de champ en portée COLLECTION_GROUP dans firestore.indexes.json et
 * attraperait toute autre collection nommée `timers`). Quelques foyers et une
 * poignée de minuteurs : le coût en lectures est négligeable.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { db } from "../lib/admin";

const UNE_HEURE_MS = 3_600_000;
const DELAI_TERMINE_MS = UNE_HEURE_MS;
const DELAI_OUBLIE_MS = 24 * UNE_HEURE_MS;

/** Millisecondes d'un horodatage Firestore (Timestamp, Date, forme brute, nombre). */
function versMs(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v instanceof Date) {
    const ms = v.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (v && typeof v === "object") {
    const o = v as {
      toMillis?: () => number;
      toDate?: () => Date;
      seconds?: unknown;
      nanoseconds?: unknown;
    };
    if (typeof o.toMillis === "function") return versMs(o.toMillis());
    if (typeof o.toDate === "function") return versMs(o.toDate());
    if (typeof o.seconds === "number") {
      const nanos = typeof o.nanoseconds === "number" ? o.nanoseconds : 0;
      return o.seconds * 1000 + Math.floor(nanos / 1e6);
    }
  }
  return null;
}

/**
 * Le minuteur doit-il être supprimé à `nowMs` ? Pur. Strict : un minuteur
 * terminé depuis exactement 1 h (ou en cours depuis exactement 24 h après sa
 * fin) est encore conservé. Fin absente ou illisible : conservé.
 */
export function minuteurASupprimer(
  t: { status?: unknown; endsAt?: unknown },
  nowMs: number,
): boolean {
  const fin = versMs(t.endsAt);
  if (fin === null) return false;
  if (t.status === "ended" || t.status === "acknowledged") {
    return fin < nowMs - DELAI_TERMINE_MS;
  }
  if (t.status === "running") return fin < nowMs - DELAI_OUBLIE_MS;
  return false;
}

export const scheduledTimersCleanup = onSchedule(
  {
    schedule: "every 60 minutes",
    region: "europe-west1",
    timeZone: "Europe/Paris",
  },
  async () => {
    const nowMs = Date.now();
    const foyers = await db.collection("households").select().get();
    let supprimes = 0;
    for (const foyer of foyers.docs) {
      try {
        const timers = await foyer.ref.collection("timers").get();
        const aSupprimer = timers.docs.filter((d) => minuteurASupprimer(d.data(), nowMs));
        // Lots de 450 (limite Firestore : 500 écritures par lot).
        for (let i = 0; i < aSupprimer.length; i += 450) {
          const batch = db.batch();
          aSupprimer.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
          await batch.commit();
          supprimes += Math.min(450, aSupprimer.length - i);
        }
      } catch (err) {
        logger.error(`[minuteurs] échec du nettoyage du foyer ${foyer.id}`, err);
      }
    }
    logger.info(`scheduledTimersCleanup : ${supprimes} minuteur(s) supprimé(s)`, {
      foyers: foyers.size,
    });
  },
);
