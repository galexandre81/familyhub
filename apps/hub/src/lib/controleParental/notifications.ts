/**
 * « Me prévenir des demandes » : abonne CE téléphone (ou ce navigateur) aux
 * notifications des demandes du PC. Le jeton du service de notification de
 * Firebase est rangé dans la liste du parent (module controle-parental) ;
 * la fonction serveur notifierDemandePc s'en sert à chaque demande.
 *
 * Il faut le service worker de l'appli installée (absent en développement) :
 * sans lui, l'écran dit « indisponible ».
 */
import { useCallback, useEffect, useState } from "react";
import { deleteToken, getMessaging, getToken, isSupported, type Messaging } from "firebase/messaging";
import { abonnerAuxDemandes, desabonnerDesDemandes, lireJetonsDuParent } from "@family-hub/controle-parental";
import { app, db } from "../firebase";

export type EtatNotifications = "verification" | "indisponible" | "bloquees" | "inactives" | "actives";

/** Mémoire locale : cet appareil a été abonné (pour se réabonner si son jeton change). */
const cleLocale = (appareilId: string, uid: string) => `fh:prevenir-demandes:${appareilId}:${uid}`;
function lireMemoire(cle: string): boolean {
  try {
    return localStorage.getItem(cle) === "1";
  } catch {
    return false;
  }
}
function ecrireMemoire(cle: string, oui: boolean) {
  try {
    if (oui) localStorage.setItem(cle, "1");
    else localStorage.removeItem(cle);
  } catch {
    /* navigation privée : sans mémoire, l'abonnement reste en base */
  }
}

async function preparer(): Promise<{ messaging: Messaging; sw: ServiceWorkerRegistration } | null> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return null;
  if (!(await isSupported().catch(() => false))) return null;
  const sw = await navigator.serviceWorker.getRegistration();
  return sw ? { messaging: getMessaging(app), sw } : null;
}

async function jeton(p: { messaging: Messaging; sw: ServiceWorkerRegistration }): Promise<string> {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;
  return getToken(p.messaging, { serviceWorkerRegistration: p.sw, vapidKey });
}

export function useNotificationsDemandes(appareilId: string, uid: string) {
  const [etat, setEtat] = useState<EtatNotifications>("verification");
  const [occupe, setOccupe] = useState(false);
  const cle = cleLocale(appareilId, uid);

  useEffect(() => {
    let fini = false;
    const poser = (e: EtatNotifications) => !fini && setEtat(e);
    (async () => {
      const p = await preparer();
      if (!p) return poser("indisponible");
      if (Notification.permission === "denied") return poser("bloquees");
      if (Notification.permission !== "granted") return poser("inactives");
      const j = await jeton(p);
      const jetons = await lireJetonsDuParent(db, appareilId, uid);
      if (jetons.includes(j)) return poser("actives");
      // Abonné jadis, mais le jeton a changé (renouvelé par le navigateur) : on le remplace.
      if (lireMemoire(cle)) {
        await abonnerAuxDemandes(db, appareilId, uid, j);
        return poser("actives");
      }
      poser("inactives");
    })().catch(() => poser("indisponible"));
    return () => {
      fini = true;
    };
  }, [appareilId, uid, cle]);

  const activer = useCallback(async () => {
    setOccupe(true);
    try {
      const p = await preparer();
      if (!p) return setEtat("indisponible");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setEtat(permission === "denied" ? "bloquees" : "inactives");
      await abonnerAuxDemandes(db, appareilId, uid, await jeton(p));
      ecrireMemoire(cle, true);
      setEtat("actives");
    } finally {
      setOccupe(false);
    }
  }, [appareilId, uid, cle]);

  const desactiver = useCallback(async () => {
    setOccupe(true);
    try {
      const p = await preparer();
      if (p) {
        await desabonnerDesDemandes(db, appareilId, uid, await jeton(p));
        await deleteToken(p.messaging).catch(() => undefined);
      }
      ecrireMemoire(cle, false);
      setEtat("inactives");
    } finally {
      setOccupe(false);
    }
  }, [appareilId, uid, cle]);

  return { etat, occupe, activer, desactiver };
}
