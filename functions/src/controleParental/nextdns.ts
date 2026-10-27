import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { db } from "../lib/admin";
import { FONCTION_NEXTDNS, chemin } from "./genere/schema";
import { BASE_NEXTDNS, RefusNextdns, traiter, type Fetch } from "./nextdnsRegles";

/**
 * Clé de l'API NextDNS (secret Firebase). Elle ouvre tout le compte : elle ne
 * quitte jamais le serveur, et nextdnsRegles n'en fait qu'un usage borné.
 *   firebase functions:secrets:set NEXTDNS_API_KEY
 */
const NEXTDNS_API_KEY = defineSecret("NEXTDNS_API_KEY");

/** Émulateur seulement : un faux NextDNS local (jamais en production). */
function base(): string {
  const local = process.env.NEXTDNS_BASE_EMULATEUR;
  return process.env.FUNCTIONS_EMULATOR === "true" && local ? local : BASE_NEXTDNS;
}

const CODE: Record<RefusNextdns["raison"], ConstructorParameters<typeof HttpsError>[0]> = {
  "non-connecte": "unauthenticated",
  "pas-parent": "permission-denied",
  "appareil-inconnu": "not-found",
  "pas-relie": "failed-precondition",
  "demande-invalide": "invalid-argument",
  "refus-nextdns": "unavailable",
};

const lire = async (p: string) => (await db.doc(p).get()).data() ?? null;

export const nextdnsAppareil = onCall({ secrets: [NEXTDNS_API_KEY] }, async (req) => {
  if (req.auth?.token?.isDisplay === true) throw new HttpsError("permission-denied", "Réservé aux parents");
  try {
    return await traiter(req.auth?.uid, req.data ?? {}, {
      lireConfig: (id) => lire(chemin.config(id)),
      lireFoyer: (id) => lire(`households/${id}`),
      lirePrive: (id) => lire(chemin.priveNextdns(id)),
      lireRapport: (id) => lire(chemin.rapportNextdns(id)),
      ecrireRapport: async (id, rapport) => {
        await db.doc(chemin.rapportNextdns(id)).set(rapport);
      },
      fetch: fetch as unknown as Fetch,
      cle: NEXTDNS_API_KEY.value(),
      base: base(),
      maintenant: () => new Date(),
    });
  } catch (e) {
    if (e instanceof RefusNextdns) {
      logger.warn(`${FONCTION_NEXTDNS} refusé`, { raison: e.raison, message: e.message, uid: req.auth?.uid });
      throw new HttpsError(CODE[e.raison], e.message, { raison: e.raison });
    }
    logger.error(`${FONCTION_NEXTDNS} en échec`, e);
    throw new HttpsError("internal", "Erreur inattendue");
  }
});
