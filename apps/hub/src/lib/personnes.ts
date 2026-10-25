import type { Household, Profil } from "@family-hub/types";

/** Couleur CSS d'un profil : variable du design system, ou ancien hex en repli. */
export function couleurDuProfil(p: Pick<Profil, "couleurPersonne" | "couleur">): string {
  return p.couleurPersonne ? `rgb(var(--c-p-${p.couleurPersonne}))` : p.couleur;
}

/** Profil relié au compte `uid` (« C'est moi »). */
export function profilDuCompte<T extends Profil & { id: string }>(
  profils: T[],
  uid: string,
): T | undefined {
  return profils.find((p) => p.uid === uid);
}

/** Parent si rôle explicite ; foyers anciens sans `roles` : tout membre est parent. */
export function estParent(household: Household, uid: string): boolean {
  if (household.roles) return household.roles[uid] === "parent";
  return household.membres.includes(uid);
}
