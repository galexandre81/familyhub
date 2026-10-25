import { describe, it, expect } from "vitest";
import { validerInvitation, type InvitationDoc } from "./invitationRules";

const NOW = 1_800_000_000_000;

function invitation(partiel: Partial<InvitationDoc> = {}): InvitationDoc {
  return {
    householdId: "h1",
    createdBy: "alex",
    role: "parent",
    expiresAt: { toMillis: () => NOW + 60_000 },
    ...partiel,
  };
}

describe("validerInvitation", () => {
  it("accepte une invitation valide, non utilisée, pour une non-membre", () => {
    expect(validerInvitation(invitation(), "marie", ["alex"], NOW)).toEqual({ ok: true });
  });

  it("refuse une invitation absente → introuvable", () => {
    expect(validerInvitation(undefined, "marie", ["alex"], NOW)).toEqual({
      ok: false,
      raison: "introuvable",
    });
  });

  it("refuse une invitation expirée", () => {
    const inv = invitation({ expiresAt: { toMillis: () => NOW - 1 } });
    expect(validerInvitation(inv, "marie", ["alex"], NOW)).toEqual({
      ok: false,
      raison: "expiree",
    });
  });

  it("expiresAt exactement égal à maintenant = expirée", () => {
    const inv = invitation({ expiresAt: { toMillis: () => NOW } });
    expect(validerInvitation(inv, "marie", ["alex"], NOW)).toEqual({
      ok: false,
      raison: "expiree",
    });
  });

  it("refuse une invitation déjà utilisée par quelqu'un d'autre", () => {
    const inv = invitation({ usedBy: "quelquun" });
    expect(validerInvitation(inv, "marie", ["alex", "quelquun"], NOW)).toEqual({
      ok: false,
      raison: "deja-utilisee",
    });
  });

  it("refuse une personne déjà membre du foyer", () => {
    expect(validerInvitation(invitation(), "alex", ["alex"], NOW)).toEqual({
      ok: false,
      raison: "deja-membre",
    });
  });

  it("déjà membre l'emporte sur déjà utilisée (Marie rouvre son propre lien)", () => {
    const inv = invitation({ usedBy: "marie" });
    expect(validerInvitation(inv, "marie", ["alex", "marie"], NOW)).toEqual({
      ok: false,
      raison: "deja-membre",
    });
  });
});
