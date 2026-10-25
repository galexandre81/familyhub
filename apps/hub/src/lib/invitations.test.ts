import { describe, expect, it } from "vitest";
import {
  decisionResultat,
  estRefusDefinitif,
  lienInvitation,
  messageErreurInvitation,
  normaliserCodeInvitation,
} from "./invitations";

describe("lienInvitation", () => {
  it("construit l'adresse /rejoindre/{code} sur l'origine du site", () => {
    expect(lienInvitation("https://mon-foyer.web.app", "ABCDEFGHJK")).toBe(
      "https://mon-foyer.web.app/rejoindre/ABCDEFGHJK",
    );
  });
});

describe("normaliserCodeInvitation", () => {
  it("met en majuscules et retire les espaces", () => {
    expect(normaliserCodeInvitation(" abcdefghjk ")).toBe("ABCDEFGHJK");
  });
  it("refuse un code au mauvais format", () => {
    expect(normaliserCodeInvitation("ABC")).toBeNull();
    expect(normaliserCodeInvitation("ABCDEFGHJ0")).toBeNull();
    expect(normaliserCodeInvitation(undefined)).toBeNull();
  });
});

describe("messageErreurInvitation", () => {
  const avecRaison = (raison: string) => ({ code: "functions/not-found", details: { raison } });

  it("traduit chaque raison du serveur", () => {
    expect(messageErreurInvitation(avecRaison("expiree"))).toBe(
      "Cette invitation a expiré — demande un nouveau lien",
    );
    expect(messageErreurInvitation(avecRaison("deja-utilisee"))).toBe(
      "Cette invitation a déjà servi",
    );
    expect(messageErreurInvitation(avecRaison("deja-membre"))).toBe(
      "Tu fais déjà partie de ce foyer",
    );
    expect(messageErreurInvitation(avecRaison("introuvable"))).toBe("Invitation introuvable");
  });

  it("erreur inconnue (réseau…) → message générique", () => {
    expect(messageErreurInvitation(new Error("offline"))).toBe(
      "L'invitation n'a pas pu être acceptée — rouvre le lien pour réessayer",
    );
  });
});

describe("estRefusDefinitif", () => {
  it("vrai quand le serveur renvoie une raison (on peut oublier le code)", () => {
    expect(estRefusDefinitif({ code: "functions/deadline-exceeded", details: { raison: "expiree" } })).toBe(true);
    expect(estRefusDefinitif({ details: { raison: "introuvable" } })).toBe(true);
  });
  it("faux sur une panne réseau ou une erreur sans raison (on garde le code)", () => {
    expect(estRefusDefinitif({ code: "functions/unavailable" })).toBe(false);
    expect(estRefusDefinitif(new Error("network"))).toBe(false);
    expect(estRefusDefinitif({ details: { raison: "" } })).toBe(false);
    expect(estRefusDefinitif(null)).toBe(false);
  });
});

describe("decisionResultat", () => {
  const bienvenue = { ok: true, message: "Bienvenue dans le foyer Gates" };
  const dejaMembre = { ok: false, message: "Tu fais déjà partie de ce foyer" };
  const attente = { ok: false, message: "pas encore" };

  it("prend le nouveau résultat quand il n'y en a pas encore", () => {
    expect(decisionResultat(null, dejaMembre)).toBe(dejaMembre);
  });

  it("garde « Bienvenue » si un refus arrive après le succès", () => {
    expect(decisionResultat(bienvenue, dejaMembre)).toBe(bienvenue);
    expect(decisionResultat(bienvenue, attente)).toBe(bienvenue);
  });

  it("remplace un échec par un succès ou par un autre échec", () => {
    expect(decisionResultat(attente, bienvenue)).toBe(bienvenue);
    expect(decisionResultat(attente, dejaMembre)).toBe(dejaMembre);
  });
});
