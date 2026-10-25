import { describe, it, expect } from "vitest";
import {
  peutInviter,
  rolesApresArrivee,
  utilisateurApresArrivee,
  validerInvitation,
  type InvitationDoc,
} from "./invitationRules";

const NOW = 1_800_000_000_000;

function invitation(partiel: Partial<InvitationDoc> = {}): InvitationDoc {
  return {
    householdId: "h1",
    createdBy: "parentA",
    role: "parent",
    expiresAt: { toMillis: () => NOW + 60_000 },
    ...partiel,
  };
}

describe("validerInvitation", () => {
  it("accepte une invitation valide, non utilisée, pour une non-membre", () => {
    expect(validerInvitation(invitation(), "parentB", ["parentA"], NOW)).toEqual({ ok: true });
  });

  it("refuse une invitation absente → introuvable", () => {
    expect(validerInvitation(undefined, "parentB", ["parentA"], NOW)).toEqual({
      ok: false,
      raison: "introuvable",
    });
  });

  it("refuse une invitation expirée", () => {
    const inv = invitation({ expiresAt: { toMillis: () => NOW - 1 } });
    expect(validerInvitation(inv, "parentB", ["parentA"], NOW)).toEqual({
      ok: false,
      raison: "expiree",
    });
  });

  it("expiresAt exactement égal à maintenant = expirée", () => {
    const inv = invitation({ expiresAt: { toMillis: () => NOW } });
    expect(validerInvitation(inv, "parentB", ["parentA"], NOW)).toEqual({
      ok: false,
      raison: "expiree",
    });
  });

  it("refuse une invitation déjà utilisée par quelqu'un d'autre", () => {
    const inv = invitation({ usedBy: "quelquun" });
    expect(validerInvitation(inv, "parentB", ["parentA", "quelquun"], NOW)).toEqual({
      ok: false,
      raison: "deja-utilisee",
    });
  });

  it("refuse une personne déjà membre du foyer", () => {
    expect(validerInvitation(invitation(), "parentA", ["parentA"], NOW)).toEqual({
      ok: false,
      raison: "deja-membre",
    });
  });

  it("déjà membre l'emporte sur déjà utilisée (le parent B rouvre son propre lien)", () => {
    const inv = invitation({ usedBy: "parentB" });
    expect(validerInvitation(inv, "parentB", ["parentA", "parentB"], NOW)).toEqual({
      ok: false,
      raison: "deja-membre",
    });
  });
});

describe("rolesApresArrivee", () => {
  it("foyer ancien sans roles : les membres existants deviennent parents, puis l'arrivante", () => {
    expect(rolesApresArrivee(undefined, ["parentA"], "parentB", "parent")).toEqual({
      parentA: "parent",
      parentB: "parent",
    });
  });

  it("roles qui n'est pas un objet (null, tableau) : traité comme absent", () => {
    expect(rolesApresArrivee(null as never, ["parentA"], "parentB", "parent")).toEqual({
      parentA: "parent",
      parentB: "parent",
    });
    expect(rolesApresArrivee([] as never, ["parentA"], "enfant", "enfant")).toEqual({
      parentA: "parent",
      enfant: "enfant",
    });
  });

  it("roles existants conservés, l'arrivante ajoutée", () => {
    const avant = { parentA: "parent" as const, leo: "enfant" as const };
    expect(rolesApresArrivee(avant, ["parentA", "leo"], "parentB", "parent")).toEqual({
      parentA: "parent",
      leo: "enfant",
      parentB: "parent",
    });
    expect(avant).toEqual({ parentA: "parent", leo: "enfant" });
  });
});

describe("peutInviter", () => {
  it("un parent peut inviter", () => {
    expect(peutInviter({ membres: ["g", "a"], roles: { g: "parent", a: "enfant" } }, "g")).toBe(true);
  });
  it("un enfant ne peut pas inviter", () => {
    expect(peutInviter({ membres: ["g", "a"], roles: { g: "parent", a: "enfant" } }, "a")).toBe(false);
  });
  it("avec une carte roles, un membre sans rôle ne peut pas inviter", () => {
    expect(peutInviter({ membres: ["g", "x"], roles: { g: "parent" } }, "x")).toBe(false);
  });
  it("foyer ancien sans roles : tout membre est parent", () => {
    expect(peutInviter({ membres: ["g"] }, "g")).toBe(true);
    expect(peutInviter({ membres: ["g"], roles: null }, "g")).toBe(true);
  });
  it("non-membre ou foyer absent : refusé", () => {
    expect(peutInviter({ membres: ["g"] }, "parentB")).toBe(false);
    expect(peutInviter(undefined, "g")).toBe(false);
    expect(peutInviter({}, "g")).toBe(false);
  });
});

describe("utilisateurApresArrivee", () => {
  it("le foyer rejoint devient le foyer par défaut", () => {
    expect(utilisateurApresArrivee("h2")).toEqual({ defaultHouseholdId: "h2" });
  });
});
