/**
 * Filtre internet (NextDNS) du PC des enfants, vu du hub. La clé NextDNS ne
 * passe jamais par ici : le hub appelle la fonction serveur, qui vérifie que
 * l'appelant est parent et écrit le rapport que l'écran lit en temps réel.
 */
import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import {
  ACTION_NEXTDNS,
  FONCTION_NEXTDNS,
  ecouterRapportNextdns,
  type RapportNextdns,
} from "@family-hub/controle-parental";
import { db, functions } from "../firebase";
import { toast } from "../../components/Toast";

type Action = (typeof ACTION_NEXTDNS)[keyof typeof ACTION_NEXTDNS];

const appel = httpsCallable<{ appareilId: string; action: Action; domaine?: string }, { fait: true }>(
  functions,
  FONCTION_NEXTDNS,
);

/** Code renvoyé quand le profil NextDNS de l'appareil n'est pas encore posé. */
const PAS_RELIE = "functions/failed-precondition";

export function appelerNextdns(appareilId: string, action: Action, domaine?: string) {
  return appel({ appareilId, action, ...(domaine ? { domaine } : {}) });
}

/**
 * Bloquer ou autoriser un site : contrairement au reste de l'écran, il faut le
 * réseau (NextDNS est appelé tout de suite), donc on confirme APRÈS sa réponse.
 */
export function changerSite(appareilId: string, action: Action, domaine: string, confirmation: string): Promise<boolean> {
  return appelerNextdns(appareilId, action, domaine).then(
    () => {
      toast(confirmation, { type: "success" });
      return true;
    },
    (e: { code?: string }) => {
      toast(
        e.code === PAS_RELIE
          ? "Le filtre internet n'est pas encore relié à Family Hub."
          : "Le filtre internet n'a pas pu être changé. Réessaie dans un instant.",
        { type: "error", duration: 6000 },
      );
      return false;
    },
  );
}

/**
 * Rapport NextDNS en temps réel, et une demande de mise à jour à l'ouverture
 * (le serveur ne rappelle NextDNS que si le rapport a plus de 5 minutes).
 * Un filtre pas encore relié n'est pas une erreur : le rapport reste vide.
 */
export function useRapportNextdns(appareilId: string | undefined): RapportNextdns | null {
  const [rapport, setRapport] = useState<RapportNextdns | null>(null);
  useEffect(() => {
    if (!appareilId) return;
    appelerNextdns(appareilId, ACTION_NEXTDNS.rapport).catch(() => undefined);
    return ecouterRapportNextdns(db, appareilId, setRapport, () => setRapport(null));
  }, [appareilId]);
  return rapport;
}
