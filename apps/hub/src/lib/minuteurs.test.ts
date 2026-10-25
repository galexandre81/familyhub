import { describe, expect, it } from "vitest";
import {
  ajoutUneMinute,
  estEnAlarme,
  estTermine,
  formatMinuteur,
  libelleParDefaut,
  lireMinutesSaisies,
  sonneIci,
  tempsRestantMs,
  versMs,
} from "./minuteurs";

const T0 = 1_800_000_000_000;

describe("versMs", () => {
  it("accepte Date, Timestamp (toMillis), { seconds } et nombre", () => {
    expect(versMs(new Date(T0))).toBe(T0);
    expect(versMs({ toMillis: () => T0 })).toBe(T0);
    expect(versMs({ seconds: T0 / 1000, nanoseconds: 500_000_000 })).toBe(T0 + 500);
    expect(versMs(T0)).toBe(T0);
  });
  it("renvoie null sinon", () => {
    expect(versMs(undefined)).toBeNull();
    expect(versMs(null)).toBeNull();
    expect(versMs("x")).toBeNull();
  });
});

describe("tempsRestantMs", () => {
  it("en cours : fin moins maintenant", () => {
    const t = { status: "running" as const, endsAt: new Date(T0 + 90_000) };
    expect(tempsRestantMs(t, T0)).toBe(90_000);
  });
  it("jamais négatif", () => {
    const t = { status: "running" as const, endsAt: { seconds: T0 / 1000 } };
    expect(tempsRestantMs(t, T0 + 5000)).toBe(0);
  });
  it("en pause : remainingSeconds, quelle que soit l'heure", () => {
    const t = { status: "paused" as const, endsAt: new Date(T0), remainingSeconds: 42 };
    expect(tempsRestantMs(t, T0 + 999_999)).toBe(42_000);
  });
  it("terminé ou fin illisible : 0", () => {
    expect(tempsRestantMs({ status: "ended", endsAt: new Date(T0 + 9000) }, T0)).toBe(0);
    expect(tempsRestantMs({ status: "running", endsAt: undefined }, T0)).toBe(0);
  });
});

describe("estTermine", () => {
  const t = { status: "running" as const, endsAt: new Date(T0) };
  it("pas encore une milliseconde avant", () => {
    expect(estTermine(t, T0 - 1)).toBe(false);
  });
  it("oui pile à l'heure de fin et après", () => {
    expect(estTermine(t, T0)).toBe(true);
    expect(estTermine(t, T0 + 1000)).toBe(true);
  });
  it("jamais en pause, même si l'ancienne fin est passée", () => {
    expect(estTermine({ status: "paused", endsAt: new Date(T0), remainingSeconds: 10 }, T0 + 1)).toBe(false);
  });
  it("seulement les minuteurs en cours (ended/acknowledged : déjà traités)", () => {
    expect(estTermine({ status: "ended", endsAt: new Date(T0) }, T0 + 1)).toBe(false);
    expect(estTermine({ status: "acknowledged", endsAt: new Date(T0) }, T0 + 1)).toBe(false);
  });
});

describe("formatMinuteur", () => {
  it("mm:ss sous une heure", () => {
    expect(formatMinuteur(9 * 60_000)).toBe("09:00");
    expect(formatMinuteur(65_000)).toBe("01:05");
    expect(formatMinuteur(0)).toBe("00:00");
  });
  it("arrondit à la seconde supérieure (un compte à rebours n'affiche pas 00:00 avant la fin)", () => {
    expect(formatMinuteur(500)).toBe("00:01");
    expect(formatMinuteur(8 * 60_000 + 59_001)).toBe("09:00");
  });
  it("h:mm:ss au-delà d'une heure", () => {
    expect(formatMinuteur(65 * 60_000)).toBe("1:05:00");
    expect(formatMinuteur(3_600_000)).toBe("1:00:00");
    expect(formatMinuteur(10 * 3_600_000 + 1000)).toBe("10:00:01");
  });
  it("négatif = 00:00", () => {
    expect(formatMinuteur(-5000)).toBe("00:00");
  });
});

describe("libelleParDefaut", () => {
  it("minutes rondes", () => {
    expect(libelleParDefaut(300)).toBe("5 min");
    expect(libelleParDefaut(60)).toBe("1 min");
  });
  it("minutes et secondes", () => {
    expect(libelleParDefaut(90)).toBe("1 min 30");
    expect(libelleParDefaut(65)).toBe("1 min 05");
  });
  it("moins d'une minute", () => {
    expect(libelleParDefaut(45)).toBe("45 s");
  });
  it("une heure et plus", () => {
    expect(libelleParDefaut(3600)).toBe("1 h");
    expect(libelleParDefaut(5400)).toBe("1 h 30");
    expect(libelleParDefaut(3900)).toBe("1 h 05");
  });
});

describe("lireMinutesSaisies", () => {
  it("accepte entiers et décimales (virgule ou point)", () => {
    expect(lireMinutesSaisies("7")).toBe(420);
    expect(lireMinutesSaisies(" 2,5 ")).toBe(150);
    expect(lireMinutesSaisies("0.5")).toBe(30);
  });
  it("refuse vide, zéro, négatif, texte et plus de 24 h", () => {
    expect(lireMinutesSaisies("")).toBeNull();
    expect(lireMinutesSaisies("0")).toBeNull();
    expect(lireMinutesSaisies("-3")).toBeNull();
    expect(lireMinutesSaisies("abc")).toBeNull();
    expect(lireMinutesSaisies("1441")).toBeNull();
  });
  it("refuse une durée qui arrondit à 0 seconde", () => {
    expect(lireMinutesSaisies("0,001")).toBeNull();
  });
});

describe("ajoutUneMinute", () => {
  it("en cours : repousse la fin, allonge la durée et réécrit « en cours » (course avec l'iPad)", () => {
    const p = ajoutUneMinute({ status: "running", endsAt: new Date(T0 + 30_000), durationSeconds: 300 }, T0);
    expect(p).toEqual({ status: "running", endsAtMs: T0 + 90_000, durationSeconds: 360 });
  });
  it("en pause : ajoute 60 s au reste", () => {
    const p = ajoutUneMinute({ status: "paused", endsAt: new Date(T0), durationSeconds: 300, remainingSeconds: 20 }, T0);
    expect(p).toEqual({ remainingSeconds: 80, durationSeconds: 360 });
  });
  it("terminé : relance une minute à partir de maintenant", () => {
    const p = ajoutUneMinute({ status: "ended", endsAt: new Date(T0 - 5000), durationSeconds: 300 }, T0);
    expect(p).toEqual({ status: "running", endsAtMs: T0 + 60_000, durationSeconds: 360 });
  });
  it("en cours mais déjà dépassé : repart de maintenant", () => {
    const p = ajoutUneMinute({ status: "running", endsAt: new Date(T0 - 5000), durationSeconds: 300 }, T0);
    expect(p).toEqual({ status: "running", endsAtMs: T0 + 60_000, durationSeconds: 360 });
  });
});

describe("estEnAlarme", () => {
  it("terminé (écrit par n'importe quel appareil) : sonne", () => {
    expect(estEnAlarme({ status: "ended", endsAt: new Date(T0) }, T0 - 10_000)).toBe(true);
  });
  it("encore « en cours » dans le document mais arrivé à zéro ici (hors ligne) : sonne", () => {
    expect(estEnAlarme({ status: "running", endsAt: new Date(T0) }, T0)).toBe(true);
    expect(estEnAlarme({ status: "running", endsAt: new Date(T0) }, T0 - 1)).toBe(false);
  });
  it("en pause ou acquitté : silence", () => {
    expect(estEnAlarme({ status: "paused", endsAt: new Date(T0), remainingSeconds: 5 }, T0 + 1)).toBe(false);
    expect(estEnAlarme({ status: "acknowledged", endsAt: new Date(T0) }, T0 + 1)).toBe(false);
  });
});

describe("sonneIci (seul l'appareil qui a lancé le minuteur sonne)", () => {
  const fini = { status: "ended" as const, endsAt: new Date(T0) };
  it("lancé ici : sonne", () => {
    expect(sonneIci({ ...fini, appareil: "tel-a" }, T0, "tel-a")).toBe(true);
  });
  it("lancé sur un autre appareil : silence", () => {
    expect(sonneIci({ ...fini, appareil: "ipad" }, T0, "tel-a")).toBe(false);
  });
  it("ancien minuteur sans appareil : sonne partout, comme avant", () => {
    expect(sonneIci(fini, T0, "tel-a")).toBe(true);
  });
  it("pas encore fini : silence, même ici", () => {
    expect(sonneIci({ status: "running", endsAt: new Date(T0), appareil: "tel-a" }, T0 - 1, "tel-a")).toBe(false);
  });
});
