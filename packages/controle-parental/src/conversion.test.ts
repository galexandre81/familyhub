import { describe, expect, it } from "vitest";
import {
  CHAMP_CONFIG,
  CHAMP_CRENEAU,
  CHAMP_DEMANDE,
  CHAMP_ETAT,
  CHAMP_REGLE,
  CHAMPS_DEMANDE_PARENT,
  VALEUR,
} from "./schema.js";
import {
  configDepuis,
  decisionVers,
  demandeDepuis,
  enDate,
  etatDepuis,
  etatVers,
  exceptionVers,
  nouvelleConfigVers,
  nouvelleDemandeVers,
  planningVers,
  usageDepuis,
  usageVers,
} from "./conversion.js";
import { DEFAUTS, PLANNING_DEFAUT } from "./regles.js";

const t = new Date(2026, 9, 26, 22, 0);

describe("config", () => {
  it("un document vide donne une config sûre : planning et valeurs par défaut, aucune exception", () => {
    const c = configDepuis("appareil-test", {});
    expect(c.planning).toEqual(PLANNING_DEFAUT);
    expect(c.defauts).toEqual(DEFAUTS);
    expect(c.exception).toBeNull();
    expect(c.listeEcole).toEqual([]);
    expect(c.compteAppareil).toBeNull();
  });

  it("aller-retour d'une config neuve", () => {
    const brut = nouvelleConfigVers({ foyer: "f1", compteAppareil: "uid-pc", nom: "PC test", par: "p", quand: t });
    const c = configDepuis("appareil-test", brut);
    expect(c.foyer).toBe("f1");
    expect(c.compteAppareil).toBe("uid-pc");
    expect(c.planning).toEqual(PLANNING_DEFAUT);
    expect(c.modifieLe).toEqual(t);
  });

  it("le planning : null = pas de verrou ce soir-là ; créneau illisible = celui du défaut", () => {
    const brut = planningVers({ ...PLANNING_DEFAUT, tue: null });
    (brut.wed as Record<string, unknown>)[CHAMP_CRENEAU.debut] = "25:99";
    const c = configDepuis("x", { [CHAMP_CONFIG.planning]: brut });
    expect(c.planning.tue).toBeNull();
    expect(c.planning.wed).toEqual(PLANNING_DEFAUT.wed);
    expect(c.planning.fri).toEqual(PLANNING_DEFAUT.fri);
  });

  it("une exception sans échéance lisible est ignorée (elle n'expirerait jamais)", () => {
    const c = configDepuis("x", {
      [CHAMP_CONFIG.exception]: { [CHAMP_REGLE.pc]: VALEUR.pc.autorise, [CHAMP_REGLE.jusqua]: "jamais" },
    });
    expect(c.exception).toBeNull();
  });

  it("aller-retour d'une exception, avec un Timestamp façon Firestore", () => {
    const brut = exceptionVers({ internet: VALEUR.internet.ecole, jusqua: t, par: "p" });
    expect(brut).not.toHaveProperty(CHAMP_REGLE.pc);
    const ts = { toDate: () => t };
    const c = configDepuis("x", { [CHAMP_CONFIG.exception]: { ...brut, [CHAMP_REGLE.jusqua]: ts } });
    expect(c.exception).toEqual({ internet: VALEUR.internet.ecole, pc: undefined, jusqua: t, par: "p" });
  });

  it("une exception doit porter sur au moins une dimension", () => {
    expect(() => exceptionVers({ jusqua: t, par: "p" })).toThrow();
  });

  it("appli à catégorie inconnue : rangée dans « autre » ; sans « autorisée » explicite : autorisée", () => {
    const c = configDepuis("x", { [CHAMP_CONFIG.applis]: { "org.kde.krita": { [CHAMP_CONFIG.nom]: "x" } } });
    expect(c.applis["org.kde.krita"]).toEqual({ autorisee: true, categorie: VALEUR.categorie.autre });
  });
});

describe("état, usage et demandes (écrits par l'appareil)", () => {
  it("état aller-retour ; état illisible → inconnu", () => {
    const e = { pc: VALEUR.pc.verrouille, internet: VALEUR.internet.complet, raison: VALEUR.raison.planning, vuLe: t, version: "0.1" };
    expect(etatDepuis(etatVers(e))).toEqual(e);
    expect(etatDepuis({ [CHAMP_ETAT.pc]: "peut-être" })).toBeNull();
    expect(etatDepuis(undefined)).toBeNull();
  });

  it("usage aller-retour ; minutes négatives ou absurdes → 0", () => {
    const u = {
      jour: "2026-10-26",
      minutesSession: 130,
      minutesParAppli: { krita: 45, chrome: 70 },
      lancementsRefuses: [{ appli: "jeu", quand: t }],
      codeParent: [{ quand: t }],
      majLe: t,
    };
    expect(usageDepuis(u.jour, usageVers(u))).toEqual(u);
    const brut = usageVers(u);
    brut[Object.keys(brut)[0]] = -5;
    expect(usageDepuis(u.jour, brut).minutesSession).toBe(0);
  });

  it("demande créée par l'appareil : en attente", () => {
    const d = demandeDepuis("d1", nouvelleDemandeVers({ type: VALEUR.typeDemande.site, message: "pour le cours", cible: "scratch.mit.edu", creeeLe: t }));
    expect(d?.statut).toBe(VALEUR.statutDemande.enAttente);
    expect(d?.cible).toBe("scratch.mit.edu");
    expect(demandeDepuis("d2", { [CHAMP_DEMANDE.type]: "autre chose" })).toBeNull();
  });

  it("une décision parent n'écrit QUE les champs autorisés aux parents", () => {
    const brut = decisionVers({ statut: VALEUR.statutDemande.refusee, par: "p", quand: t, accordeJusqua: null });
    expect(Object.keys(brut).sort()).toEqual([...CHAMPS_DEMANDE_PARENT].sort());
  });

  it("enDate accepte Date, Timestamp, nombre, texte ISO ; refuse le reste", () => {
    expect(enDate(t)).toEqual(t);
    expect(enDate({ toDate: () => t })).toEqual(t);
    expect(enDate(t.getTime())).toEqual(t);
    expect(enDate(t.toISOString())).toEqual(t);
    expect(enDate("n'importe quoi")).toBeNull();
    expect(enDate(null)).toBeNull();
  });
});
