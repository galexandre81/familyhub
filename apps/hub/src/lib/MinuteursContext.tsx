/**
 * Un seul abonnement aux minuteurs pour toute la page (cf. useMinuteurs.ts).
 * `MinuteursProvider` est monté dans le Layout (PC et téléphone) ; le veilleur
 * (fin + son + bandeau), le mode recette et le panneau lisent `useMinuteurs()`.
 */
import { createContext, useContext, type ReactNode } from "react";
import { useMinuteursAbonnement, type MinuteursApi } from "./useMinuteurs";

const SANS_FOYER: MinuteursApi = {
  minuteurs: [],
  nowMs: 0,
  lancer: () => false,
  ajouterUneMinute: async () => {},
  pause: async () => {},
  reprendre: async () => {},
  arreter: async () => {},
  acquitter: async () => {},
};

const MinuteursContext = createContext<MinuteursApi>(SANS_FOYER);

export function MinuteursProvider({
  householdId,
  children,
}: {
  householdId?: string;
  children: ReactNode;
}) {
  const api = useMinuteursAbonnement(householdId);
  return <MinuteursContext.Provider value={api}>{children}</MinuteursContext.Provider>;
}

/** Minuteurs du foyer courant (abonnement partagé du Layout). */
export function useMinuteurs(): MinuteursApi {
  return useContext(MinuteursContext);
}
