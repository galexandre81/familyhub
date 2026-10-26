/**
 * Écran « PC des enfants » : abonnements temps réel (l'état du PC change
 * sans qu'on recharge). Tout passe par @family-hub/controle-parental : aucun
 * chemin ni nom de champ ici.
 */
import { useEffect, useState } from "react";
import {
  ecouterAppareilsDuFoyer,
  ecouterDemandesEnAttente,
  ecouterEtat,
  ecouterUsage,
  jourLocal,
  type ConfigAppareil,
  type Demande,
  type EtatAppareil,
  type UsageJour,
} from "@family-hub/controle-parental";
import { db } from "../firebase";

export interface Abonnement<T> {
  donnees: T;
  chargement: boolean;
  erreur: Error | null;
}

function useAbonnement<T>(
  initial: T,
  cle: string | undefined,
  abonner: (ok: (v: T) => void, ko: (e: Error) => void) => () => void,
): Abonnement<T> {
  const [etat, setEtat] = useState<Abonnement<T>>({ donnees: initial, chargement: !!cle, erreur: null });
  useEffect(() => {
    if (!cle) {
      setEtat({ donnees: initial, chargement: false, erreur: null });
      return;
    }
    setEtat((e) => ({ ...e, chargement: true, erreur: null }));
    return abonner(
      (donnees) => setEtat({ donnees, chargement: false, erreur: null }),
      (erreur) => setEtat((e) => ({ ...e, chargement: false, erreur })),
    );
    // `abonner` change à chaque rendu ; la clé décrit ce qui est écouté.
  }, [cle]);
  return etat;
}

/** Le PC du foyer (le premier si, un jour, il y en a plusieurs). */
export function useAppareilDuFoyer(foyer: string | undefined): Abonnement<ConfigAppareil | null> {
  const r = useAbonnement<ConfigAppareil[]>([], foyer, (ok, ko) => ecouterAppareilsDuFoyer(db, foyer!, ok, ko));
  return { ...r, donnees: r.donnees[0] ?? null };
}

export function useEtatAppareil(appareilId: string | undefined) {
  return useAbonnement<EtatAppareil | null>(null, appareilId, (ok, ko) => ecouterEtat(db, appareilId!, ok, ko));
}

export function useUsageDuJour(appareilId: string | undefined, maintenant: Date) {
  const jour = jourLocal(maintenant);
  return useAbonnement<UsageJour | null>(null, appareilId && `${appareilId}|${jour}`, (ok, ko) =>
    ecouterUsage(db, appareilId!, jour, ok, ko),
  );
}

export function useDemandesEnAttente(appareilId: string | undefined) {
  return useAbonnement<Demande[]>([], appareilId, (ok, ko) => ecouterDemandesEnAttente(db, appareilId!, ok, ko));
}
