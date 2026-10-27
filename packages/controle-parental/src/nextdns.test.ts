import { describe, expect, it } from "vitest";
import { CHAMP_RAPPORT, CHAMP_SITE, QUOTA_GRATUIT_NEXTDNS, SEUIL_ALERTE_QUOTA } from "./schema.js";
import { rapportNextdnsDepuis } from "./conversion.js";
import { alerteQuota, partDuQuota } from "./regles.js";

describe("rapport NextDNS", () => {
  it("lecture tolérante : sites sans nom écartés, limite par défaut = offre gratuite", () => {
    const r = rapportNextdnsDepuis({
      [CHAMP_RAPPORT.jour]: "2026-10-26",
      [CHAMP_RAPPORT.visites]: [{ [CHAMP_SITE.domaine]: "pronote.net", [CHAMP_SITE.requetes]: 40 }, { autre: 1 }],
      [CHAMP_RAPPORT.toujoursAutorises]: ["scratch.mit.edu", 3],
      [CHAMP_RAPPORT.requetesDuMois]: 1500,
    });
    expect(r?.visites).toEqual([{ domaine: "pronote.net", requetes: 40 }]);
    expect(r?.toujoursAutorises).toEqual(["scratch.mit.edu"]);
    expect(r?.limiteDuMois).toBe(QUOTA_GRATUIT_NEXTDNS);
    expect(rapportNextdnsDepuis(undefined)).toBeNull();
  });

  it("alerte du quota au seuil, pas avant", () => {
    const limite = QUOTA_GRATUIT_NEXTDNS;
    const seuil = Math.ceil(limite * SEUIL_ALERTE_QUOTA);
    expect(alerteQuota({ requetesDuMois: seuil - 1, limiteDuMois: limite })).toBe(false);
    expect(alerteQuota({ requetesDuMois: seuil, limiteDuMois: limite })).toBe(true);
    expect(alerteQuota(null)).toBe(false);
    expect(partDuQuota({ requetesDuMois: 150_000, limiteDuMois: limite })).toBe(0.5);
  });
});
