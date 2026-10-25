import { describe, it, expect } from "vitest";
import { minuteurASupprimer } from "./cleanup";

const NOW = Date.UTC(2026, 9, 26, 12, 0, 0);
const H = 3_600_000;

describe("minuteurASupprimer", () => {
  it("terminé ou acquitté : supprimé au-delà d'1 h après la fin, pas avant", () => {
    for (const status of ["ended", "acknowledged"]) {
      expect(minuteurASupprimer({ status, endsAt: new Date(NOW - H - 1) }, NOW)).toBe(true);
      expect(minuteurASupprimer({ status, endsAt: new Date(NOW - H) }, NOW)).toBe(false);
      expect(minuteurASupprimer({ status, endsAt: new Date(NOW - 10_000) }, NOW)).toBe(false);
    }
  });

  it("en cours : supprimé seulement 24 h après la fin (oublié)", () => {
    expect(minuteurASupprimer({ status: "running", endsAt: new Date(NOW - 24 * H - 1) }, NOW)).toBe(true);
    expect(minuteurASupprimer({ status: "running", endsAt: new Date(NOW - 24 * H) }, NOW)).toBe(false);
    expect(minuteurASupprimer({ status: "running", endsAt: new Date(NOW - 2 * H) }, NOW)).toBe(false);
  });

  it("en pause : jamais supprimé", () => {
    expect(minuteurASupprimer({ status: "paused", endsAt: new Date(NOW - 48 * H) }, NOW)).toBe(false);
  });

  it("accepte un Timestamp Firestore (toMillis / toDate / seconds) ou des millisecondes", () => {
    const ms = NOW - 2 * H;
    expect(minuteurASupprimer({ status: "ended", endsAt: { toMillis: () => ms } }, NOW)).toBe(true);
    expect(minuteurASupprimer({ status: "ended", endsAt: { toDate: () => new Date(ms) } }, NOW)).toBe(true);
    expect(minuteurASupprimer({ status: "ended", endsAt: { seconds: ms / 1000, nanoseconds: 0 } }, NOW)).toBe(true);
    expect(minuteurASupprimer({ status: "ended", endsAt: ms }, NOW)).toBe(true);
  });

  it("fin absente ou illisible : conservé", () => {
    expect(minuteurASupprimer({ status: "ended" }, NOW)).toBe(false);
    expect(minuteurASupprimer({ status: "ended", endsAt: "hier" }, NOW)).toBe(false);
    expect(minuteurASupprimer({ status: "ended", endsAt: new Date("x") }, NOW)).toBe(false);
  });
});
