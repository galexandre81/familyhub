/**
 * Code d'invitation ouvert avant la connexion (`/rejoindre/:code`), gardé le
 * temps de passer par Google puis traité dans l'arbre connecté.
 *
 * Double stockage : sessionStorage (onglet courant) + localStorage (la
 * connexion par redirection, dans l'app installée, peut rouvrir un contexte
 * neuf). Chaque accès est protégé : navigation privée ou données bloquées →
 * on perd l'invitation, jamais d'exception.
 */
const CLE = "familyHub.invitationEnAttente";

function stockages(): Storage[] {
  const out: Storage[] = [];
  for (const lire of [() => globalThis.sessionStorage, () => globalThis.localStorage]) {
    try {
      const s = lire();
      if (s) out.push(s);
    } catch {
      /* accès refusé */
    }
  }
  return out;
}

export function garderInvitationEnAttente(code: string): void {
  for (const s of stockages()) {
    try {
      s.setItem(CLE, code);
    } catch {
      /* stockage plein ou bloqué */
    }
  }
}

export function lireInvitationEnAttente(): string | null {
  for (const s of stockages()) {
    try {
      const v = s.getItem(CLE);
      if (v) return v;
    } catch {
      /* stockage bloqué */
    }
  }
  return null;
}

export function oublierInvitationEnAttente(): void {
  for (const s of stockages()) {
    try {
      s.removeItem(CLE);
    } catch {
      /* stockage bloqué */
    }
  }
}
