/**
 * Tableau de cuisine de l'iPad (apps/display/public/js/tableau.js, ES5) : le
 * fichier livré est exécuté tel quel dans un contexte vm, après repas.js
 * (comme dans index.html), puis en CommonJS. Seules les fonctions pures sont
 * appelées ici ; le code DOM ne tourne jamais.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Repas = "petitDej" | "dej" | "diner";
interface Slot {
  date?: string;
  repas: Repas;
  recetteIds: string[];
  recetteNoms?: string[];
  profilsPresents?: string[];
  profilsCount?: number;
  invitesCount?: number;
  annule?: boolean;
}
interface Evt {
  summary?: string;
  startISO: string;
  endISO?: string;
  allDay?: boolean;
}
interface Pastille {
  initiale: string;
  nom: string;
  classe: string | null;
  couleur: string | null;
}
interface ApiTableau {
  libelleDate(now: Date): string;
  libelleHeure(now: Date): string;
  evenementsSemaine(events: Evt[] | undefined, now: Date, max?: number): Array<{ jour: string; heure: string | null; titre: string }>;
  libelleEnsuite(repas: Repas, dateISO: string, now: Date, heures?: unknown): string;
  pastillesPresents(slot: Slot, profils: unknown): Pastille[];
  pastillesAffichees(pastilles: Pastille[], invites: number, max?: number): { pastilles: Pastille[]; reste: number };
  formatPlat(plat: string): { long: boolean; deuxLignes: boolean };
  resumeRepas(data: unknown, now: Date): {
    prochain: null | {
      moment: string;
      dans: string;
      barre: number;
      plat: string;
      accompagnements: string;
      pastilles: Pastille[];
      reste: number;
      platLong: boolean;
      titre: string;
      presence: string;
      portions: number | undefined;
      recetteIds: string[];
      noms: Record<string, string>;
      cle: string;
    };
    ensuite: null | { libelle: string; plat: string; accompagnements: string };
  };
  meteoResume(data: unknown, config: unknown): null | { temp: string; ciel: string; ville: string };
  resumeBatch(data: unknown, now: Date): null | {
    titre: string;
    duree: string;
    noms: string;
    recetteIds: string[];
    nomsParId: Record<string, string>;
    fait: boolean;
    cle: string;
  };
}

const lire = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const REPAS = lire("../../../apps/display/public/js/repas.js");
const SOURCE = lire("../../../apps/display/public/js/tableau.js");

function chargerCommeSafari(): ApiTableau {
  const window: { FamilyHubTableau?: ApiTableau } = {};
  const ctx = { window };
  runInNewContext(REPAS, ctx);
  runInNewContext(SOURCE, ctx);
  if (!window.FamilyHubTableau) throw new Error("window.FamilyHubTableau absent");
  return window.FamilyHubTableau;
}

const t = chargerCommeSafari();
// 2026-10-26 = lundi ; 2026-10-27 = mardi.
const at = (iso: string) => new Date(iso);

describe("tableau.js (iPad) — chargement", () => {
  it("expose window.FamilyHubTableau (monter) et module.exports", () => {
    expect(typeof (t as unknown as { monter: unknown }).monter).toBe("function");
    const module: { exports: Partial<ApiTableau> } = { exports: {} };
    runInNewContext(SOURCE, { module });
    expect(typeof module.exports.evenementsSemaine).toBe("function");
  });
});

describe("libelleDate / libelleHeure", () => {
  it("« Mardi 27 octobre », « 1er » le premier du mois", () => {
    expect(t.libelleDate(at("2026-10-27T12:20:00"))).toBe("Mardi 27 octobre");
    expect(t.libelleDate(at("2026-11-01T08:00:00"))).toBe("Dimanche 1er novembre");
  });
  it("heure HH:MM", () => {
    expect(t.libelleHeure(at("2026-10-27T07:05:00"))).toBe("07:05");
    expect(t.libelleHeure(at("2026-10-27T23:59:59"))).toBe("23:59");
  });
});

describe("evenementsSemaine", () => {
  const now = at("2026-10-26T10:00:00"); // lundi
  const evs: Evt[] = [
    { summary: "Rendez-vous Léo", startISO: "2026-10-27T18:30:00", endISO: "2026-10-27T19:30:00" },
    { summary: "Vacances", startISO: "2026-10-28", endISO: "2026-10-29", allDay: true },
    { summary: "Passé", startISO: "2026-10-26T08:00:00", endISO: "2026-10-26T09:00:00" },
    { summary: "En cours", startISO: "2026-10-26T09:30:00", endISO: "2026-10-26T11:00:00" },
    { summary: "Trop loin", startISO: "2026-11-02T09:00:00", endISO: "2026-11-02T10:00:00" },
    { summary: "Dimanche", startISO: "2026-11-01T09:00:00", endISO: "2026-11-01T10:00:00" },
  ];
  it("prochains sur 7 jours (aujourd'hui → dimanche), triés, passés et lointains exclus", () => {
    const res = t.evenementsSemaine(evs, now, 10);
    expect(res.map((e) => e.titre)).toEqual(["En cours", "Rendez-vous Léo", "Vacances", "Dimanche"]);
  });
  it("format « mar. 27 », heure HH:MM, journée entière sans heure", () => {
    const res = t.evenementsSemaine(evs, now, 10);
    expect(res[1]).toEqual({ jour: "mar. 27", heure: "18:30", titre: "Rendez-vous Léo" });
    expect(res[2]).toEqual({ jour: "mer. 28", heure: null, titre: "Vacances" });
  });
  it("limite au maximum demandé (4 par défaut)", () => {
    expect(t.evenementsSemaine(evs, now, 2)).toHaveLength(2);
    expect(t.evenementsSemaine(evs, now)).toHaveLength(4);
  });
  it("journée entière : finie hier exclue ; plusieurs jours en cours = aujourd'hui", () => {
    const res = t.evenementsSemaine(
      [
        { summary: "Hier", startISO: "2026-10-25", endISO: "2026-10-26", allDay: true },
        { summary: "Stage", startISO: "2026-10-24", endISO: "2026-10-28", allDay: true },
      ],
      now,
    );
    expect(res).toEqual([{ jour: "lun. 26", heure: null, titre: "Stage" }]);
  });
  it("entrées invalides ignorées, sans titre → « Événement »", () => {
    const res = t.evenementsSemaine(
      [{ startISO: "n'importe quoi" }, { startISO: "2026-10-27T08:00:00" }] as Evt[],
      now,
    );
    expect(res).toEqual([{ jour: "mar. 27", heure: "08:00", titre: "Événement" }]);
    expect(t.evenementsSemaine(undefined, now)).toEqual([]);
  });
});

describe("libelleEnsuite", () => {
  const now = at("2026-10-26T10:00:00");
  it("aujourd'hui : Ce matin / Ce midi / Ce soir + heure", () => {
    expect(t.libelleEnsuite("dej", "2026-10-26", now)).toBe("Ce midi · 12:15");
    expect(t.libelleEnsuite("diner", "2026-10-26", now, { semaine: { diner: "19:15" } })).toBe("Ce soir · 19:15");
    expect(t.libelleEnsuite("petitDej", "2026-10-26", at("2026-10-26T05:00:00"))).toBe("Ce matin · 07:00");
  });
  it("demain et plus tard : comme libelleMoment", () => {
    expect(t.libelleEnsuite("petitDej", "2026-10-27", now)).toBe("Demain matin");
    expect(t.libelleEnsuite("diner", "2026-10-28", now)).toBe("Mercredi 28 · Dîner");
  });
});

describe("pastillesPresents", () => {
  const profils = {
    g: { initiale: "A", nom: "Alex", couleurPersonne: "sapin" },
    j: { initiale: "M", nom: "Marie", couleur: "#C8462B" },
    a: { nom: "léo" },
  };
  it("couleur de personne en classe, sinon hex, sinon rien ; initiale de repli", () => {
    const res = t.pastillesPresents({ date: "2026-10-26", repas: "dej", recetteIds: ["r"], profilsPresents: ["g", "j", "a", "inconnu"] }, profils);
    expect(res).toEqual([
      { initiale: "A", nom: "Alex", classe: "fh-p-sapin", couleur: null },
      { initiale: "M", nom: "Marie", classe: null, couleur: "#C8462B" },
      { initiale: "L", nom: "léo", classe: null, couleur: null },
    ]);
  });
  it("couleur de personne inconnue ou hex invalide ignorées ; ancien snapshot sans présents", () => {
    const res = t.pastillesPresents(
      { date: "x", repas: "dej", recetteIds: [], profilsPresents: ["z"] },
      { z: { initiale: "Z", nom: "Zoé", couleurPersonne: "rose\" onclick", couleur: "red;x" } },
    );
    expect(res).toEqual([{ initiale: "Z", nom: "Zoé", classe: null, couleur: null }]);
    expect(t.pastillesPresents({ date: "x", repas: "dej", recetteIds: [] }, profils)).toEqual([]);
  });
});

describe("pastillesAffichees (rangée « Commencer » sans débordement)", () => {
  const P = (i: string): Pastille => ({ initiale: i, nom: i, classe: null, couleur: null });
  it("5 profils + 2 invités : 3 pastilles puis « +4 » (4 × 70 + 10 + 180 = 470 ≤ 523 px)", () => {
    const r = t.pastillesAffichees(["A", "B", "C", "D", "E"].map(P), 2, 3);
    expect(r.pastilles.map((x) => x.initiale)).toEqual(["A", "B", "C"]);
    expect(r.reste).toBe(4);
    const pastillesVisibles = r.pastilles.length + (r.reste > 0 ? 1 : 0);
    expect(pastillesVisibles * 70 + 10 + 180).toBeLessThanOrEqual(523);
  });
  it("3 personnes sans invité : pas de « +N » ; invités seuls → « +N » ; max 3 par défaut", () => {
    expect(t.pastillesAffichees(["A", "B", "C"].map(P), 0).reste).toBe(0);
    expect(t.pastillesAffichees(["A", "B"].map(P), 1)).toEqual({ pastilles: ["A", "B"].map(P), reste: 1 });
    expect(t.pastillesAffichees(["A", "B", "C", "D"].map(P), 0)).toEqual({ pastilles: ["A", "B", "C"].map(P), reste: 1 });
    expect(t.pastillesAffichees([], -3).reste).toBe(0);
  });
});

describe("formatPlat (accompagnements masqués si le plat tient sur 2 lignes)", () => {
  it("seuils 18 / 22 caractères", () => {
    expect(t.formatPlat("Saumon au four")).toEqual({ long: false, deuxLignes: false });
    expect(t.formatPlat("x".repeat(18))).toEqual({ long: false, deuxLignes: false });
    expect(t.formatPlat("x".repeat(19))).toEqual({ long: true, deuxLignes: false });
    expect(t.formatPlat("x".repeat(22))).toEqual({ long: true, deuxLignes: false });
    expect(t.formatPlat("Salade de pâtes au thon et poivrons")).toEqual({ long: true, deuxLignes: true });
  });
  it("dans resumeRepas : plat long → accompagnements vides", () => {
    const r = t.resumeRepas(
      { semaine: [{ date: "2026-10-26", repas: "dej", recetteIds: ["a", "b"], recetteNoms: ["Salade de pâtes au thon et poivrons", "Pain"] }] },
      at("2026-10-26T10:00:00"),
    );
    expect(r.prochain!.platLong).toBe(true);
    expect(r.prochain!.accompagnements).toBe("");
  });
});

describe("resumeRepas", () => {
  const data = {
    profils: { g: { initiale: "A", nom: "Alex", couleurPersonne: "sapin" } },
    semaine: [
      { date: "2026-10-26", repas: "dej", recetteIds: ["p1", "a1", "a2"], recetteNoms: ["Salade de pâtes", "Poivrons", "Pain"], profilsPresents: ["g"], profilsCount: 1, invitesCount: 2 },
      { date: "2026-10-26", repas: "diner", recetteIds: ["p2"], recetteNoms: ["Saumon au four"], profilsCount: 3, invitesCount: 0 },
      { date: "2026-10-27", repas: "dej", recetteIds: ["p3"], recetteNoms: ["Frittata"], profilsCount: 0 },
    ],
  };
  it("prochain repas : moment, dans, barre, plat, accompagnements, présents, portions", () => {
    const r = t.resumeRepas(data, at("2026-10-26T10:45:00"));
    expect(r.prochain).not.toBeNull();
    const p = r.prochain!;
    expect(p.moment).toBe("Déjeuner · 12:15");
    expect(p.dans).toBe("dans 1 h 30");
    expect(p.barre).toBe(0.5);
    expect(p.plat).toBe("Salade de pâtes");
    expect(p.accompagnements).toBe("Poivrons · Pain");
    expect(p.pastilles.map((x) => x.initiale)).toEqual(["A"]);
    expect(p.reste).toBe(2);
    expect(p.presence).toBe("");
    expect(p.titre).toBe("Déjeuner · lundi 26 octobre");
    expect(p.portions).toBe(3);
    expect(p.recetteIds).toEqual(["p1", "a1", "a2"]);
    expect(p.noms).toEqual({ p1: "Salade de pâtes", a1: "Poivrons", a2: "Pain" });
  });
  it("« Ensuite » = le repas d'après : « Ce soir » le jour, « Demain » le soir", () => {
    expect(t.resumeRepas(data, at("2026-10-26T10:45:00")).ensuite).toEqual({
      libelle: "Ce soir · 19:00",
      plat: "Saumon au four",
      accompagnements: "",
    });
    const soir = t.resumeRepas(data, at("2026-10-26T18:00:00"));
    expect(soir.prochain!.plat).toBe("Saumon au four");
    expect(soir.prochain!.presence).toBe("3 personnes");
    expect(soir.ensuite!.libelle).toBe("Demain midi");
  });
  it("la clé ne change pas d'une minute à l'autre (pas de reconstruction)", () => {
    const a = t.resumeRepas(data, at("2026-10-26T10:45:00")).prochain!;
    const b = t.resumeRepas(data, at("2026-10-26T10:46:00")).prochain!;
    expect(a.cle).toBe(b.cle);
    expect(a.dans).not.toBe(b.dans);
  });
  it("rien à venir, données absentes ou anciennes", () => {
    expect(t.resumeRepas(data, at("2026-10-28T10:00:00"))).toEqual({ prochain: null, ensuite: null });
    expect(t.resumeRepas(null, at("2026-10-26T10:00:00"))).toEqual({ prochain: null, ensuite: null });
    const vieux = t.resumeRepas({ semaine: [{ date: "2026-10-26", repas: "dej", recetteIds: ["x"] }] }, at("2026-10-26T10:00:00"));
    expect(vieux.prochain!.plat).toBe("Repas prévu");
    expect(vieux.prochain!.portions).toBeUndefined();
    expect(vieux.prochain!.pastilles).toEqual([]);
  });
});

describe("meteoResume", () => {
  const config = {
    selectedLocationId: "b",
    locations: [
      { id: "a", ville: "Lyon" },
      { id: "b", ville: "Grenoble" },
    ],
  };
  const data = {
    byLocation: {
      a: { current: { tempC: 14.2, label: "Soleil" }, daily: {} },
      b: { current: { tempC: -0.6, label: "Neige" }, daily: {} },
    },
  };
  it("ville choisie, température arrondie, ciel", () => {
    expect(t.meteoResume(data, config)).toEqual({ temp: "-1°", ciel: "Neige", ville: "Grenoble" });
  });
  it("repli sur la première ville ; données manquantes → null", () => {
    expect(t.meteoResume(data, { locations: config.locations })).toEqual({ temp: "14°", ciel: "Soleil", ville: "Lyon" });
    expect(t.meteoResume({}, config)).toBeNull();
    expect(t.meteoResume(data, {})).toBeNull();
    expect(t.meteoResume(null, null)).toBeNull();
  });
});

describe("resumeBatch (carte batch cooking du tableau)", () => {
  const session = (date: string, extra: Record<string, unknown> = {}) => ({
    id: "b-" + date,
    date,
    dureeEstimeeMinutes: 150,
    recetteIds: ["r1", "r2"],
    recetteNoms: ["Chili", "Soupe"],
    done: false,
    ...extra,
  });
  // Dimanche 25 octobre 2026, 17:18.
  const now = new Date(2026, 9, 25, 17, 18);

  it("session du jour : titre, durée, recettes, ids et noms pour le mode recette", () => {
    const r = t.resumeBatch({ batchSessions: [session("2026-10-25")] }, now);
    expect(r).toMatchObject({
      titre: "Batch cooking aujourd'hui",
      duree: "2 h 30",
      noms: "Chili · Soupe",
      recetteIds: ["r1", "r2"],
      nomsParId: { r1: "Chili", r2: "Soupe" },
      fait: false,
    });
  });

  it("session de demain annoncée la veille ; une session du jour passe avant", () => {
    expect(t.resumeBatch({ batchSessions: [session("2026-10-26")] }, now)?.titre).toBe("Batch cooking demain");
    expect(
      t.resumeBatch({ batchSessions: [session("2026-10-26"), session("2026-10-25")] }, now)?.titre,
    ).toBe("Batch cooking aujourd'hui");
  });

  it("session du jour déjà faite : affichée comme faite ; celle de demain faite : masquée", () => {
    expect(t.resumeBatch({ batchSessions: [session("2026-10-25", { done: true })] }, now)?.fait).toBe(true);
    expect(t.resumeBatch({ batchSessions: [session("2026-10-26", { done: true })] }, now)).toBeNull();
  });

  it("rien à annoncer : passée, lointaine, ou pas de données", () => {
    expect(t.resumeBatch({ batchSessions: [session("2026-10-24"), session("2026-10-28")] }, now)).toBeNull();
    expect(t.resumeBatch({}, now)).toBeNull();
    expect(t.resumeBatch(null, now)).toBeNull();
  });

  it("durée inconnue : pas de durée ; plan lu dans data.plans si présent", () => {
    const r = t.resumeBatch({ plans: [{ batchSessions: [session("2026-10-25", { dureeEstimeeMinutes: 45 })] }] }, now);
    expect(r?.duree).toBe("45 min");
    expect(t.resumeBatch({ batchSessions: [session("2026-10-25", { dureeEstimeeMinutes: 0 })] }, now)?.duree).toBe("");
  });
});
