import { PERSONNES } from "@family-hub/design";
import type { CouleurPersonne, Household, Profil } from "@family-hub/types";

/** Couleur CSS d'un profil : variable du design system, ou ancien hex en repli. */
export function couleurDuProfil(p: Pick<Profil, "couleurPersonne" | "couleur">): string {
  return p.couleurPersonne ? `rgb(var(--c-p-${p.couleurPersonne}))` : p.couleur;
}

function versRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/**
 * Teinte de la palette (jour ou nuit) la plus proche d'un ancien hex libre.
 * Sert à présélectionner une couleur dans le formulaire d'un ancien profil ;
 * hex illisible → « sapin ».
 */
export function teinteLaPlusProche(hex: string | null | undefined): CouleurPersonne {
  const rgb = versRgb(hex ?? "");
  if (!rgb) return "sapin";
  let meilleure: CouleurPersonne = "sapin";
  let distance = Infinity;
  for (const [cle, teintes] of Object.entries(PERSONNES) as Array<[CouleurPersonne, { jour: string; nuit: string }]>) {
    for (const t of [teintes.jour, teintes.nuit]) {
      const c = versRgb(t)!;
      const d = (c[0] - rgb[0]) ** 2 + (c[1] - rgb[1]) ** 2 + (c[2] - rgb[2]) ** 2;
      if (d < distance) {
        distance = d;
        meilleure = cle;
      }
    }
  }
  return meilleure;
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

/**
 * Liste des profils après « C'est moi » : `uid` posé sur `profilId` et retiré
 * des autres profils qui le portaient (mise à jour optimiste du cache).
 */
export function lierProfilLocalement<T extends Pick<Profil, "uid"> & { id: string }>(
  profils: T[],
  profilId: string,
  uid: string,
): T[] {
  return profils.map((p) => {
    if (p.id === profilId) return { ...p, uid };
    if (p.uid === uid) {
      const { uid: _retire, ...reste } = p;
      void _retire;
      return reste as T;
    }
    return p;
  });
}
