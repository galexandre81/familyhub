/**
 * Minuteurs de l'iPad (apps/display/public/js/minuteurs.js, ES5) : le fichier
 * livré est exécuté tel quel dans un contexte vm, une fois comme dans Safari
 * (window) et une fois en CommonJS, puis comparé à la logique du hub
 * (import relatif de apps/hub/src/lib/minuteurs.ts, sans dépendance navigateur).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { ajoutUneMinute, libelleParDefaut } from "../../../apps/hub/src/lib/minuteurs";

interface Patch {
  status?: "running";
  endsAtMs?: number;
  remainingSeconds?: number;
  durationSeconds: number;
}
interface ApiMinuteurs {
  libelleMinuteur(secondes: number): string;
  patchUneMinute(t: unknown, nowMs: number): Patch;
  versMs(ts: unknown): number | null;
}

const SOURCE = readFileSync(
  fileURLToPath(new URL("../../../apps/display/public/js/minuteurs.js", import.meta.url)),
  "utf8",
);

function chargerCommeSafari(): ApiMinuteurs {
  const window: { FamilyHubMinuteurs?: ApiMinuteurs } = {};
  runInNewContext(SOURCE, { window });
  if (!window.FamilyHubMinuteurs) throw new Error("window.FamilyHubMinuteurs absent");
  return window.FamilyHubMinuteurs;
}

function chargerCommeCommonJS(): ApiMinuteurs {
  const module: { exports: Partial<ApiMinuteurs> } = { exports: {} };
  runInNewContext(SOURCE, { module });
  return module.exports as ApiMinuteurs;
}

const m = chargerCommeSafari();
/** Copie « simple » d'un objet venu du contexte vm (prototypes différents). */
const plat = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe("minuteurs.js (iPad) — chargement", () => {
  it("expose window.FamilyHubMinuteurs et module.exports", () => {
    expect(typeof m.libelleMinuteur).toBe("function");
    expect(typeof chargerCommeCommonJS().patchUneMinute).toBe("function");
  });
});

describe("libelleMinuteur", () => {
  it("donne les libellés attendus", () => {
    expect(m.libelleMinuteur(300)).toBe("5 min");
    expect(m.libelleMinuteur(60)).toBe("1 min");
    expect(m.libelleMinuteur(90)).toBe("1 min 30");
    expect(m.libelleMinuteur(65)).toBe("1 min 05");
    expect(m.libelleMinuteur(3900)).toBe("1 h 05");
    expect(m.libelleMinuteur(3600)).toBe("1 h");
    expect(m.libelleMinuteur(45)).toBe("45 s");
  });

  it("même résultat que libelleParDefaut du hub", () => {
    for (const s of [0, 1, 30, 59, 60, 61, 90, 599, 600, 2700, 3599, 3600, 3660, 3900, 7200, 5430, 59.6, -5]) {
      expect(m.libelleMinuteur(s)).toBe(libelleParDefaut(s));
    }
  });
});

describe("patchUneMinute", () => {
  const now = 1_800_000_000_000;

  it("en cours : fin + 60 s, durée + 60, reste en cours", () => {
    const t = { status: "running", endsAt: new Date(now + 120_000), durationSeconds: 300 };
    expect(plat(m.patchUneMinute(t, now))).toEqual({
      status: "running",
      endsAtMs: now + 180_000,
      durationSeconds: 360,
    });
  });

  it("en pause : temps restant + 60, durée + 60, pas de fin", () => {
    const t = { status: "paused", endsAt: new Date(now), remainingSeconds: 42, durationSeconds: 300 };
    expect(plat(m.patchUneMinute(t, now))).toEqual({ remainingSeconds: 102, durationSeconds: 360 });
  });

  it("terminé : relancé pour une minute à partir de maintenant", () => {
    const t = { status: "ended", endsAt: { seconds: (now - 5000) / 1000, nanoseconds: 0 }, durationSeconds: 60 };
    expect(plat(m.patchUneMinute(t, now))).toEqual({
      status: "running",
      endsAtMs: now + 60_000,
      durationSeconds: 120,
    });
  });

  it("même résultat que ajoutUneMinute du hub", () => {
    const cas = [
      { status: "running", endsAt: new Date(now + 1000), durationSeconds: 60 },
      { status: "running", endsAt: { toMillis: () => now + 5000 }, durationSeconds: 90 },
      { status: "running", endsAt: null, durationSeconds: 60 },
      { status: "ended", endsAt: now - 1000 },
      { status: "paused", endsAt: new Date(now), remainingSeconds: 10, durationSeconds: 60 },
      { status: "paused", endsAt: new Date(now) },
    ] as const;
    for (const t of cas) {
      expect(plat(m.patchUneMinute(t, now))).toEqual(
        plat(ajoutUneMinute(t as Parameters<typeof ajoutUneMinute>[0], now)),
      );
    }
  });
});
