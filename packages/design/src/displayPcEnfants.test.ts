/**
 * « PC des enfants » sur l'iPad (apps/display/public/js/pc-enfants.js, ES5) :
 * les fichiers livrés sont exécutés tels quels dans un contexte vm (schéma
 * généré, puis le module), comme dans index.html. Seules les fonctions pures
 * sont appelées ; les documents sont construits par le module de schéma,
 * aucun nom stocké n'est écrit ici.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  CHAMP_CONFIG,
  CHAMP_ETAT,
  CHAMP_EXCEPTION_ACTIVE,
  CHAMP_RAPPORT,
  CHAMP_SITE,
  JUSQUA_NOUVEL_ORDRE_MS,
  PREFIXE_AUTRE_APPLI,
  VALEUR,
} from "../../controle-parental/src/schema";
import { decisionVers, etatVers, nouvelleDemandeVers, usageVers } from "../../controle-parental/src/conversion";

type Brut = Record<string, unknown>;
interface Carte {
  titre: string;
  rouge: boolean;
  detail: string;
  enLigne: boolean;
  ligne: string;
  demandes: number;
}
interface ApiPc {
  lireEtat(b: unknown): unknown;
  resumeCarte(etat: unknown, attente: number, maintenant: number): Carte;
  applisDuJour(usage: unknown, etat: unknown): Array<{ nom: string; duree: string; part: number }>;
  journee(usage: unknown, demandes: unknown[], config: unknown, etat: unknown, maintenant: number): Array<{ heure: string; texte: string }>;
  internetDuJour(r: unknown, maintenant: number): { visites: Array<{ site: string; n: number }>; bloques: unknown[]; note: string };
  rapport(d: Brut, maintenant: number): {
    titre: string;
    temps: string;
    enLigne: boolean;
    vu: string;
    attente: Array<{ texte: string; message: string | null; heure: string }>;
  };
  html(r: unknown): string;
  carte(maintenant?: number): Carte | null;
}

const lire = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const SCHEMA = lire("../../../apps/display/public/js/genere/schema-controle-parental.js");
const SOURCE = lire("../../../apps/display/public/js/pc-enfants.js");

function chargerCommeSafari(): { pc: ApiPc; window: Brut } {
  const window: Brut = {};
  runInNewContext(SCHEMA, { window });
  runInNewContext(SOURCE, { window, setInterval, clearInterval, setTimeout });
  if (!window.FamilyHubPc) throw new Error("window.FamilyHubPc absent");
  return { pc: window.FamilyHubPc as ApiPc, window };
}

const { pc, window } = chargerCommeSafari();

// Heures LOCALES : le test ne dépend pas du fuseau de la machine.
const le = (h: number, m = 0, jour = 27) => new Date(2026, 9, jour, h, m);
const MAINTENANT = le(17, 42).getTime();

function statut(o: {
  pc?: string;
  internet?: string;
  mode?: string;
  sourceMode?: string;
  sourcePc?: string;
  jusquaMode?: Date | null;
  jusquaPc?: Date | null;
  par?: string;
  vuLe?: Date;
}): Brut {
  const b = etatVers({
    pc: (o.pc ?? VALEUR.pc.autorise) as never,
    internet: (o.internet ?? VALEUR.internet.complet) as never,
    mode: (o.mode ?? VALEUR.mode.devoirs) as never,
    raisons: {},
    sources: { mode: (o.sourceMode ?? VALEUR.source.defaut) as never, pc: (o.sourcePc ?? VALEUR.source.defaut) as never },
    jusqua: { mode: o.jusquaMode ?? null, pc: o.jusquaPc ?? null },
    libelleMode: "",
    reseau: VALEUR.reseau.ecole,
    resume: "",
    minutesDuJour: 0,
    sessionOuverte: true,
    applisRefusees: {},
    vuLe: o.vuLe ?? le(17, 41),
    version: "test",
  });
  if (o.par) {
    b[CHAMP_ETAT.exceptionsActives] = {
      [o.sourcePc === VALEUR.source.exception ? "pc" : "mode"]: { [CHAMP_EXCEPTION_ACTIVE.par]: o.par },
    };
  }
  return b;
}

const usage = (o: Partial<Parameters<typeof usageVers>[0]> = {}) =>
  usageVers({
    jour: "2026-10-27",
    secondesSession: 7500,
    secondesActives: 7000,
    secondesParAppli: { pronote: 2700, krita: 2280, minuscule: 30, [`${PREFIXE_AUTRE_APPLI}jeu`]: 600 },
    nomsApplis: { pronote: "Pronote", krita: "Krita" },
    secondesParCategorie: {},
    lancementsRefuses: [{ quand: le(16, 20), appli: "roblox" }],
    codeParent: [{ quand: le(17, 5), reussi: true }],
    executablesInconnus: [],
    vpnBloques: [],
    limitesAtteintes: {},
    majLe: le(17, 40),
    ...o,
  });

const demande = (id: string, quand: Date, o: Partial<Parameters<typeof nouvelleDemandeVers>[0]> = {}) =>
  nouvelleDemandeVers({
    id,
    de: "enfant",
    type: VALEUR.typeDemande.temps,
    detail: "",
    message: "",
    dureeMinutes: 30,
    creeeLe: quand,
    ...o,
  });
const decidee = (d: Brut, statut: string, par: string) => ({
  ...d,
  ...decisionVers({ statut: statut as never, par, traiteLe: le(17, 0) }),
});
const CONFIG = { [CHAMP_CONFIG.foyer]: "f1", [CHAMP_CONFIG.nomsParents]: { p1: "Papa", p2: "Maman" } };

describe("chargement (comme Safari 9)", () => {
  it("expose FamilyHubPc et pose la vue plein écran sur Tiles['pc-enfants']", () => {
    const tiles = window.Tiles as Record<string, { expand: unknown; collapse: unknown }>;
    expect(typeof tiles["pc-enfants"].expand).toBe("function");
    expect(typeof tiles["pc-enfants"].collapse).toBe("function");
    expect(pc.carte()).toBeNull(); // aucun PC relié tant que rien n'est écouté
  });
});

describe("carte du tableau", () => {
  it("mode choisi par un parent, avec son échéance", () => {
    const e = pc.lireEtat(
      statut({ sourceMode: VALEUR.source.exception, jusquaMode: le(18, 30), par: "Papa" }),
    );
    expect(pc.resumeCarte(e, 1, MAINTENANT)).toEqual({
      titre: "Devoirs",
      rouge: false,
      detail: "Choisi par Papa jusqu'à 18:30",
      enLigne: true,
      ligne: "En ligne",
      demandes: 1,
    });
  });

  it("verrouillé jusqu'à nouvel ordre : en rouge", () => {
    const e = pc.lireEtat(
      statut({
        pc: VALEUR.pc.verrouille,
        sourcePc: VALEUR.source.exception,
        jusquaPc: new Date(JUSQUA_NOUVEL_ORDRE_MS),
        par: "Maman",
      }),
    );
    const c = pc.resumeCarte(e, 0, MAINTENANT);
    expect(c.titre).toBe("PC verrouillé");
    expect(c.rouge).toBe(true);
    expect(c.detail).toBe("Choisi par Maman jusqu'à nouvel ordre");
  });

  it("planning, internet coupé ; code parent tapé sur le PC", () => {
    const planning = pc.lireEtat({
      ...statut({ mode: VALEUR.mode.libre, sourceMode: VALEUR.source.planning, jusquaMode: le(19) }),
      [CHAMP_ETAT.internet]: VALEUR.internet.coupe,
    });
    expect(pc.resumeCarte(planning, 0, MAINTENANT).detail).toBe("Selon le planning jusqu'à 19:00 · internet coupé");
    const code = pc.lireEtat(statut({ sourceMode: VALEUR.source.codeParent, jusquaMode: le(10, 0, 28) }));
    expect(pc.resumeCarte(code, 0, MAINTENANT).detail).toBe("Code parent tapé sur le PC jusqu'à demain 10:00");
  });

  it("hors ligne au-delà de 10 minutes ; jamais connecté ; état illisible", () => {
    const vieux = pc.lireEtat(statut({ vuLe: le(16, 5) }));
    expect(pc.resumeCarte(vieux, 0, MAINTENANT)).toMatchObject({ enLigne: false, ligne: "Hors ligne depuis 16:05" });
    const hier = pc.lireEtat(statut({ vuLe: le(21, 10, 26) }));
    expect(pc.resumeCarte(hier, 0, MAINTENANT).ligne).toBe("Hors ligne depuis hier 21:10");
    expect(pc.lireEtat({ n: 1 })).toBeNull();
    expect(pc.resumeCarte(null, 0, MAINTENANT)).toMatchObject({ titre: "Pas encore de nouvelles", ligne: "Jamais connecté" });
  });
});

describe("rapport plein écran", () => {
  it("applis : de la plus longue à la plus courte, moins d'une minute cachée, noms lisibles", () => {
    const a = pc.applisDuJour(usage(), null);
    expect(a.map((x) => [x.nom, x.duree])).toEqual([
      ["Pronote", "45 min"],
      ["Krita", "38 min"],
      ["Autre (jeu)", "10 min"],
    ]);
    expect(a[0].part).toBe(100);
  });

  it("la journée : demandes et réponses (nom montré à l'enfant), refus, code parent, dans l'ordre ; hier exclu", () => {
    const demandes = [
      demande("d-hier", le(20, 0, 26)),
      decidee(demande("d1", le(16, 21), { type: VALEUR.typeDemande.appli, detail: "roblox" }), VALEUR.statutDemande.refusee, "p1"),
      decidee(demande("d2", le(16, 52), { type: VALEUR.typeDemande.site, detail: "lumni.fr" }), VALEUR.statutDemande.acceptee, "p2"),
      demande("d3", le(17, 38), { message: "je finis mon exposé" }),
    ];
    expect(pc.journee(usage(), demandes, CONFIG, null, MAINTENANT)).toEqual([
      { heure: "16:20", texte: "roblox refusé" },
      { heure: "16:21", texte: "L'appli roblox demandé → refusé (Papa)" },
      { heure: "16:52", texte: "Le site lumni.fr demandé → accepté (Maman)" },
      { heure: "17:05", texte: "Code parent tapé sur le PC" },
      { heure: "17:38", texte: "Plus de temps : 30 min demandé → en attente" },
    ]);
  });

  it("internet : relevé du jour, ou une phrase quand il n'y en a pas", () => {
    const r = (jour: string) => ({
      [CHAMP_RAPPORT.jour]: jour,
      [CHAMP_RAPPORT.visites]: [{ [CHAMP_SITE.domaine]: "lumni.fr", [CHAMP_SITE.requetes]: 96 }],
      [CHAMP_RAPPORT.bloques]: [{ [CHAMP_SITE.domaine]: "roblox.com", [CHAMP_SITE.requetes]: 7 }],
    });
    expect(pc.internetDuJour(r("2026-10-27"), MAINTENANT)).toEqual({
      visites: [{ site: "lumni.fr", n: 96 }],
      bloques: [{ site: "roblox.com", n: 7 }],
      note: "",
    });
    expect(pc.internetDuJour(r("2026-10-26"), MAINTENANT).note).toBe("Pas encore de relevé aujourd'hui.");
    expect(pc.internetDuJour(null, MAINTENANT).note).toBe("Le filtre internet n'est pas encore relié.");
  });

  it("bandeau et demande en attente ; le texte venu du PC est échappé", () => {
    const d = {
      config: CONFIG,
      statut: statut({}),
      usage: usage({ nomsApplis: { pronote: "<script>x</script>" } }),
      demandes: [demande("d3", le(17, 38), { message: "je finis mon exposé" })],
      rapport: null,
    };
    const r = pc.rapport(d, MAINTENANT);
    expect(r).toMatchObject({ titre: "Devoirs", temps: "2h05", enLigne: true, vu: "vu il y a 1 min" });
    expect(r.attente).toEqual([{ texte: "Plus de temps : 30 min", message: "je finis mon exposé", heure: "17:38" }]);
    const html = pc.html(r);
    expect(html).toContain("À valider sur un téléphone");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    // Aucun bouton d'action dans le rapport : l'iPad ne décide rien.
    expect(html).not.toMatch(/<button|onclick/i);
  });
});
