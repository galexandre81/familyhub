import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { admin, db } from "../lib/admin";
import { CHAMP_ABONNE, COLLECTION_APPAREILS, SOUS_COLLECTION, chemin } from "./genere/schema";
import { prevenirDeLaDemande } from "./notificationsRegles";

const lire = async (p: string) => (await db.doc(p).get()).data() ?? null;

/**
 * Le PC crée une demande : chaque téléphone ou navigateur abonné par un
 * parent sonne. Message de données seulement : c'est le service worker du
 * hub (public/notifications-sw.js) qui affiche la notification.
 */
export const notifierDemandePc = onDocumentCreated(
  `${COLLECTION_APPAREILS}/{appareilId}/${SOUS_COLLECTION.demandes}/{demandeId}`,
  async (event) => {
    const { appareilId, demandeId } = event.params;
    try {
      const bilan = await prevenirDeLaDemande(appareilId, demandeId, event.data?.data() ?? null, {
        lireConfig: (id) => lire(chemin.config(id)),
        lireFoyer: (id) => lire(`households/${id}`),
        lireAbonnes: async (id) =>
          (await db.collection(chemin.abonnes(id)).get()).docs.map((d) => ({ uid: d.id, donnees: d.data() })),
        envoyer: async (jetons, n) => {
          const r = await admin.messaging().sendEachForMulticast({
            tokens: jetons,
            data: { titre: n.titre, corps: n.corps, url: n.url, tag: n.tag },
            webpush: { headers: { Urgency: "high", TTL: String(6 * 3600) } },
            android: { priority: "high" },
          });
          return r.responses.map((x, i) => ({ jeton: jetons[i], erreur: x.error?.code }));
        },
        retirerJetons: async (id, uid, jetons) => {
          await db.doc(chemin.abonne(id, uid)).update({
            [CHAMP_ABONNE.jetons]: admin.firestore.FieldValue.arrayRemove(...jetons),
          });
        },
      });
      logger.info("notifierDemandePc", { appareilId, demandeId, ...bilan });
    } catch (e) {
      logger.error("notifierDemandePc en échec", { appareilId, demandeId, erreur: String(e) });
    }
  },
);
