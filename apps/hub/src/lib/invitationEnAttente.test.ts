import { afterEach, describe, expect, it, vi } from "vitest";
import {
  garderInvitationEnAttente,
  lireInvitationEnAttente,
  oublierInvitationEnAttente,
} from "./invitationEnAttente";

/** Stockage en mémoire, même surface que Web Storage. */
function memoire(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

/** Stockage qui refuse tout (navigation privée, données bloquées). */
function casse(): Storage {
  const boom = () => {
    throw new Error("SecurityError");
  };
  return {
    length: 0,
    clear: boom,
    getItem: boom,
    key: boom,
    removeItem: boom,
    setItem: boom,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("invitation en attente", () => {
  it("aller-retour : garder puis lire rend le code, oublier l'efface", () => {
    vi.stubGlobal("sessionStorage", memoire());
    vi.stubGlobal("localStorage", memoire());
    garderInvitationEnAttente("ABCDEFGHJK");
    expect(lireInvitationEnAttente()).toBe("ABCDEFGHJK");
    oublierInvitationEnAttente();
    expect(lireInvitationEnAttente()).toBeNull();
  });

  it("survit à la perte du sessionStorage (retour de connexion Google) via localStorage", () => {
    vi.stubGlobal("sessionStorage", memoire());
    const local = memoire();
    vi.stubGlobal("localStorage", local);
    garderInvitationEnAttente("ABCDEFGHJK");
    vi.stubGlobal("sessionStorage", memoire());
    expect(lireInvitationEnAttente()).toBe("ABCDEFGHJK");
  });

  it("rien en attente → null", () => {
    vi.stubGlobal("sessionStorage", memoire());
    vi.stubGlobal("localStorage", memoire());
    expect(lireInvitationEnAttente()).toBeNull();
  });

  it("stockage indisponible : aucune exception, lecture → null", () => {
    vi.stubGlobal("sessionStorage", casse());
    vi.stubGlobal("localStorage", casse());
    expect(() => garderInvitationEnAttente("ABCDEFGHJK")).not.toThrow();
    expect(lireInvitationEnAttente()).toBeNull();
    expect(() => oublierInvitationEnAttente()).not.toThrow();
  });

  it("stockage absent (pas de window) : aucune exception, lecture → null", () => {
    vi.stubGlobal("sessionStorage", undefined);
    vi.stubGlobal("localStorage", undefined);
    expect(() => garderInvitationEnAttente("ABCDEFGHJK")).not.toThrow();
    expect(lireInvitationEnAttente()).toBeNull();
  });
});
