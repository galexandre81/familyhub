import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTION_NEXTDNS,
  CHAMP_CONFIG,
  CHAMP_PRIVE_NEXTDNS,
  CHAMP_RAPPORT,
  CHAMP_SITE,
  FONCTION_NEXTDNS,
  QUOTA_GRATUIT_NEXTDNS,
} from "./genere/schema";
import { appelNextdns, debutsZurich, RefusNextdns, traiter, type Dependances, type Fetch } from "./nextdnsRegles";

const BASE = "https://nextdns.test";
type Appel = { methode: string; url: string; corps?: unknown };

/** Faux NextDNS : répond par route, et note chaque appel. */
function fauxNextdns(options: { erreurSur?: RegExp } = {}) {
  const appels: Appel[] = [];
  const f: Fetch = async (url, init) => {
    appels.push({ methode: init.method, url, corps: init.body ? JSON.parse(init.body) : undefined });
    const chemin = new URL(url).pathname;
    const repondre = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
    if (options.erreurSur?.test(chemin)) return repondre({ errors: [{ code: "invalid" }] });
    if (init.method === "DELETE") return repondre({}, 204);
    if (init.method === "POST") return repondre({ data: {} });
    if (chemin === "/profiles") return repondre({ data: [{ id: "pcAdo" }, { id: "autreProfil" }] });
    if (chemin.endsWith("/analytics/status")) {
      const n = chemin.includes("pcAdo") ? 1000 : 500;
      return repondre({ data: [{ status: "default", queries: n }, { status: "blocked", queries: 20 }] });
    }
    if (chemin.endsWith("/analytics/domains")) {
      return new URL(url).searchParams.get("status") === "blocked"
        ? repondre({ data: [{ domain: "jeu-en-ligne.example", queries: 4 }] })
        : repondre({ data: [{ domain: "pronote.net", queries: 40 }, { domain: "youtube.com", queries: 12 }] });
    }
    if (chemin.endsWith("/allowlist")) return repondre({ data: [{ id: "scratch.mit.edu", active: true }] });
    if (chemin.endsWith("/denylist")) return repondre({ data: [] });
    return repondre({ errors: [{ code: "notFound" }] }, 404);
  };
  return { f, appels };
}

const maintenant = new Date("2026-10-26T14:00:00Z"); // 15h00 à Zurich

function deps(over: Partial<Dependances> = {}, ecrits: Array<Record<string, unknown>> = []) {
  const nx = fauxNextdns();
  const d: Dependances = {
    lireConfig: async (id) => (id === "pc" ? { [CHAMP_CONFIG.foyer]: "f1" } : null),
    lireFoyer: async () => ({ membres: ["parent", "enfant"], roles: { parent: "parent", enfant: "enfant" } }),
    lirePrive: async () => ({ [CHAMP_PRIVE_NEXTDNS.profil]: "pcAdo" }),
    lireRapport: async () => null,
    ecrireRapport: async (_id, r) => {
      ecrits.push(r);
    },
    fetch: nx.f,
    cle: "cle-secrete",
    base: BASE,
    maintenant: () => maintenant,
    ...over,
  };
  return { d, appels: nx.appels, ecrits };
}

const raison = async (p: Promise<unknown>) => {
  try {
    await p;
    return "accepté";
  } catch (e) {
    return e instanceof RefusNextdns ? e.raison : `autre : ${(e as Error).message}`;
  }
};

describe("qui passe", () => {
  it("personne de connecté, un enfant, un parent d'un autre foyer : refusés, sans appel NextDNS", async () => {
    const { d, appels } = deps();
    expect(await raison(traiter(undefined, { appareilId: "pc", action: ACTION_NEXTDNS.rapport }, d))).toBe("non-connecte");
    expect(await raison(traiter("enfant", { appareilId: "pc", action: ACTION_NEXTDNS.rapport }, d))).toBe("pas-parent");
    expect(await raison(traiter("inconnu", { appareilId: "pc", action: ACTION_NEXTDNS.rapport }, d))).toBe("pas-parent");
    expect(appels).toEqual([]);
  });

  it("foyer ancien sans rôles : tout membre est parent", async () => {
    const { d } = deps({ lireFoyer: async () => ({ membres: ["parent"] }) });
    expect(await raison(traiter("parent", { appareilId: "pc", action: ACTION_NEXTDNS.rapport }, d))).toBe("accepté");
  });

  it("appareil inconnu, NextDNS pas relié, demande invalide", async () => {
    const { d } = deps({ lirePrive: async () => null });
    expect(await raison(traiter("parent", { appareilId: "inconnu", action: ACTION_NEXTDNS.rapport }, d))).toBe("appareil-inconnu");
    expect(await raison(traiter("parent", { appareilId: "pc", action: ACTION_NEXTDNS.rapport }, d))).toBe("pas-relie");
    expect(await raison(traiter("parent", { appareilId: "pc", action: "deleteProfile" }, d))).toBe("demande-invalide");
    expect(await raison(traiter("parent", { appareilId: "../x", action: ACTION_NEXTDNS.rapport }, d))).toBe("demande-invalide");
  });
});

describe("rapport", () => {
  it("sites du jour, listes, et quota du COMPTE (tous les profils additionnés)", async () => {
    const { d, appels, ecrits } = deps();
    await traiter("parent", { appareilId: "pc", action: ACTION_NEXTDNS.rapport }, d);
    const r = ecrits[0];
    expect(r[CHAMP_RAPPORT.jour]).toBe("2026-10-26");
    expect(r[CHAMP_RAPPORT.visites]).toEqual([
      { [CHAMP_SITE.domaine]: "pronote.net", [CHAMP_SITE.requetes]: 40 },
      { [CHAMP_SITE.domaine]: "youtube.com", [CHAMP_SITE.requetes]: 12 },
    ]);
    expect(r[CHAMP_RAPPORT.bloques]).toEqual([{ [CHAMP_SITE.domaine]: "jeu-en-ligne.example", [CHAMP_SITE.requetes]: 4 }]);
    expect(r[CHAMP_RAPPORT.toujoursAutorises]).toEqual(["scratch.mit.edu"]);
    expect(r[CHAMP_RAPPORT.requetesDuMois]).toBe(1020 + 520);
    expect(r[CHAMP_RAPPORT.limiteDuMois]).toBe(QUOTA_GRATUIT_NEXTDNS);
    // Les sites du jour partent de minuit à Zurich (23h00 UTC la veille, en heure d'hiver).
    const domaines = appels.find((a) => a.url.includes("analytics/domains"))!;
    expect(new URL(domaines.url).searchParams.get("from")).toBe("2026-10-25T23:00:00.000Z");
    expect(appels.every((a) => a.methode === "GET")).toBe(true);
  });

  it("un rapport de moins de 5 minutes, du même jour, est servi sans rappeler NextDNS", async () => {
    const recent = { [CHAMP_RAPPORT.jour]: "2026-10-26", [CHAMP_RAPPORT.majLe]: new Date(maintenant.getTime() - 4 * 60_000) };
    const { d, appels } = deps({ lireRapport: async () => recent });
    await traiter("parent", { appareilId: "pc", action: ACTION_NEXTDNS.rapport }, d);
    expect(appels).toEqual([]);
  });

  it("vieux de 6 minutes, ou d'hier : refait", async () => {
    for (const ancien of [
      { [CHAMP_RAPPORT.jour]: "2026-10-26", [CHAMP_RAPPORT.majLe]: { toDate: () => new Date(maintenant.getTime() - 6 * 60_000) } },
      { [CHAMP_RAPPORT.jour]: "2026-10-25", [CHAMP_RAPPORT.majLe]: new Date(maintenant.getTime() - 60_000) },
    ]) {
      const { d, appels } = deps({ lireRapport: async () => ancien });
      await traiter("parent", { appareilId: "pc", action: ACTION_NEXTDNS.rapport }, d);
      expect(appels.length).toBeGreaterThan(0);
    }
  });
});

describe("bloquer, débloquer", () => {
  it("débloquer : l'adresse collée devient le nom du site, retiré des bloqués puis autorisé", async () => {
    const { d, appels } = deps();
    await traiter("parent", { appareilId: "pc", action: ACTION_NEXTDNS.debloquer, domaine: "https://www.Scratch.mit.edu/projets" }, d);
    expect(appels.slice(0, 2)).toEqual([
      { methode: "DELETE", url: `${BASE}/profiles/pcAdo/denylist/scratch.mit.edu`, corps: undefined },
      { methode: "POST", url: `${BASE}/profiles/pcAdo/allowlist`, corps: { id: "scratch.mit.edu", active: true } },
    ]);
  });

  it("bloquer : l'inverse ; retirer : des deux listes", async () => {
    const b = deps();
    await traiter("parent", { appareilId: "pc", action: ACTION_NEXTDNS.bloquer, domaine: "jeu.example" }, b.d);
    expect(b.appels.slice(0, 2).map((a) => `${a.methode} ${new URL(a.url).pathname}`)).toEqual([
      "DELETE /profiles/pcAdo/allowlist/jeu.example",
      "POST /profiles/pcAdo/denylist",
    ]);
    const r = deps();
    await traiter("parent", { appareilId: "pc", action: ACTION_NEXTDNS.retirer, domaine: "jeu.example" }, r.d);
    expect(r.appels.slice(0, 2).map((a) => a.methode)).toEqual(["DELETE", "DELETE"]);
  });

  it("adresse illisible : refusée sans appel", async () => {
    const { d, appels } = deps();
    expect(await raison(traiter("parent", { appareilId: "pc", action: ACTION_NEXTDNS.bloquer, domaine: "pas un site" }, d))).toBe(
      "demande-invalide",
    );
    expect(appels).toEqual([]);
  });

  it("NextDNS répond 200 avec des erreurs : c'est un échec", async () => {
    const nx = fauxNextdns({ erreurSur: /allowlist$/ });
    const { d } = deps({ fetch: nx.f });
    expect(await raison(traiter("parent", { appareilId: "pc", action: ACTION_NEXTDNS.debloquer, domaine: "a.fr" }, d))).toBe("refus-nextdns");
  });
});

describe("la clé ne sert qu'aux routes prévues", () => {
  it.each([
    ["PATCH", "/profiles/pcAdo"],
    ["DELETE", "/profiles/pcAdo"],
    ["DELETE", "/profiles/pcAdo/logs"],
    ["GET", "/profiles/pcAdo/logs/download"],
    ["POST", "/profiles"],
    ["GET", "/profiles/pcAdo/analytics/domains/../../settings"],
  ])("%s %s : refusé avant tout envoi", async (methode, chemin) => {
    const nx = fauxNextdns();
    expect(await raison(appelNextdns(nx.f, "cle", BASE, methode as "GET", chemin))).toBe("demande-invalide");
    expect(nx.appels).toEqual([]);
  });

  it("la clé part dans l'en-tête, jamais dans l'adresse", async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    const f: Fetch = async (url, init) => {
      seen.push({ url, headers: init.headers });
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    };
    await appelNextdns(f, "cle-secrete", BASE, "GET", "/profiles");
    expect(seen[0].headers["X-Api-Key"]).toBe("cle-secrete");
    expect(seen[0].url).not.toContain("cle-secrete");
  });

  it("retirer un site absent (404) n'est pas une erreur", async () => {
    const f: Fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    expect(await appelNextdns(f, "c", BASE, "DELETE", "/profiles/pcAdo/denylist/a.fr")).toBeNull();
  });
});

describe("heure de Zurich", () => {
  it("hiver et été", () => {
    expect(debutsZurich(new Date("2026-01-15T10:00:00Z"))).toEqual({
      jour: "2026-01-15",
      debutJour: new Date("2026-01-14T23:00:00Z"),
      debutMois: new Date("2025-12-31T23:00:00Z"),
    });
    expect(debutsZurich(new Date("2026-07-15T23:30:00Z")).jour).toBe("2026-07-16");
    expect(debutsZurich(new Date("2026-07-15T23:30:00Z")).debutJour).toEqual(new Date("2026-07-15T22:00:00Z"));
  });
});

it("la fonction est exportée sous le nom que le hub appelle", () => {
  const index = readFileSync(resolve(__dirname, "../index.ts"), "utf8");
  expect(index).toContain(`export { ${FONCTION_NEXTDNS} } from "./controleParental/nextdns"`);
});
