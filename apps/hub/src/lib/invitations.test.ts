import { describe, expect, it } from "vitest";
import { lienInvitation, messageErreurInvitation, normaliserCodeInvitation } from "./invitations";

describe("lienInvitation", () => {
  it("construit l'adresse /rejoindre/{code} sur l'origine du site", () => {
    expect(lienInvitation("https://<PROJECT_ID>.web.app", "ABCDEFGHJK")).toBe(
      "https://<PROJECT_ID>.web.app/rejoindre/ABCDEFGHJK",
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
