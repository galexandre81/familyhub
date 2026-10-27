import { describe, expect, it } from "vitest";
import {
  CHAMP_CONFIG,
  CHAMP_DEMANDE,
  CHAMP_EVENEMENT,
  CHAMP_PLAGE,
  CHAMP_REGLE,
  CHAMP_USAGE,
  CHAMPS_DEMANDE_PARENT,
  LISTE_ECOLE_INITIALE,
  PREFIXE_INTERNE,
  SUFFIXE_ETAT,
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

const t = new Date(Date.UTC(2026, 9, 26, 21, 0));

describe("config", () => {
  it("un document vide donne une config sûre : planning et défauts du contrat, aucune exception", () => {
    const c = configDepuis("appareil-test", {});
    expect(c.planning).toEqual(PLANNING_DEFAUT);
    expect(c.defauts).toEqual(DEFAUTS);
    expect(c.exception).toBeNull();
    expect(c.executablesInconnus).toBe(VALEUR.executablesInconnus.signaler);
  });

  it("une config neuve porte la liste école du PC et la version du schéma", () => {
    const brut = nouvelleConfigVers({ foyer: "f1", compteAppareil: "u", nom: "PC", nomsParents: { p1: "Papa" }, par: "p1", quand: t });
    const c = configDepuis("x", brut);
    expect(c.listeEcole).toEqual([...LISTE_ECOLE_INITIALE]);
    expect(c.nomsParents).toEqual({ p1: "Papa" });
    expect(brut[CHAMP_CONFIG.versionSchema]).toBe(1);
  });

  it("planning aller-retour ; plage invalide (même heure, sans dimension, heure fausse) écartée", () => {
    const brut = planningVers({ ...PLANNING_DEFAUT, wed: [{ debut: "16:30", fin: "18:00", mode: VALEUR.mode.libre }] });
    expect(configDepuis("x", { [CHAMP_CONFIG.planning]: brut }).planning.wed).toEqual([
      { debut: "16:30", fin: "18:00", mode: VALEUR.mode.libre },
    ]);
    const mauvais = {
      ...brut,
      thu: [
        { [CHAMP_PLAGE.debut]: "10:00", [CHAMP_PLAGE.fin]: "10:00", [CHAMP_REGLE.pc]: VALEUR.pc.verrouille },
        { [CHAMP_PLAGE.debut]: "10:00", [CHAMP_PLAGE.fin]: "11:00" },
        { [CHAMP_PLAGE.debut]: "25:00", [CHAMP_PLAGE.fin]: "11:00", [CHAMP_REGLE.pc]: VALEUR.pc.verrouille },
      ],
    };
    expect(configDepuis("x", { [CHAMP_CONFIG.planning]: mauvais }).planning.thu).toEqual([]);
  });

  it("une exception sans échéance lisible est ignorée (comme le fait le PC)", () => {
    const c = configDepuis("x", { [CHAMP_CONFIG.exception]: { [CHAMP_REGLE.mode]: VALEUR.mode.libre } });
    expect(c.exception).toBeNull();
  });

  it("exception aller-retour : nom montré à l'enfant, setAt passé par l'appelant, échéance en chaîne ISO lue", () => {
    const brut = exceptionVers({ mode: VALEUR.mode.libre, jusqua: t, par: "Maman", poseLe: null }, "SENTINELLE");
    expect(brut[CHAMP_REGLE.poseLe]).toBe("SENTINELLE");
    const c = configDepuis("x", { [CHAMP_CONFIG.exception]: { ...brut, [CHAMP_REGLE.jusqua]: t.toISOString(), [CHAMP_REGLE.poseLe]: null } });
    expect(c.exception).toEqual({ mode: VALEUR.mode.libre, jusqua: t, par: "Maman", poseLe: null });
  });

  it("le nom montré à l'enfant est coupé à 60 caractères", () => {
    const brut = exceptionVers({ pc: VALEUR.pc.verrouille, jusqua: t, par: "x".repeat(80), poseLe: null }, null);
    expect((brut[CHAMP_REGLE.par] as string).length).toBe(60);
  });

  it("limites : { catégorie: minutes }, valeurs absurdes écartées", () => {
    const c = configDepuis("x", { [CHAMP_CONFIG.limites]: { jeu: 60, creation: -5, inconnue: 10 } });
    expect(c.limites).toEqual({ jeu: 60 });
  });
});

describe("état (écrit par le PC)", () => {
  it("aller-retour avec raisons, sources et échéances par dimension", () => {
    const brut = etatVers({
      pc: VALEUR.pc.autorise,
      internet: VALEUR.internet.complet,
      mode: VALEUR.mode.libre,
      raisons: { pc: "réglage par défaut", mode: "exception (Maman) jusqu'à 18h00" },
      sources: { pc: VALEUR.source.defaut, mode: VALEUR.source.exception },
      jusqua: { mode: t },
      libelleMode: "Temps libre",
      reseau: VALEUR.reseau.ecole,
      resume: "Mode Temps libre. PC disponible.",
      minutesDuJour: 42,
      sessionOuverte: true,
      applisRefusees: {},
      vuLe: t,
      version: "1.0.0",
    });
    const e = etatDepuis(brut)!;
    expect(e.mode).toEqual({ valeur: VALEUR.mode.libre, raison: "exception (Maman) jusqu'à 18h00", source: VALEUR.source.exception, jusqua: t });
    expect(e.pc.source).toBe(VALEUR.source.defaut);
    expect(e.vuLe).toEqual(t);
    expect(e.libelleMode).toBe("Temps libre");
  });

  it("état illisible → inconnu ; mode absent (ancien agent) → Devoirs", () => {
    expect(etatDepuis({ pc: "peut-être" })).toBeNull();
    expect(etatDepuis(undefined)).toBeNull();
    const sansMode = etatDepuis({ pc: VALEUR.pc.autorise, internet: VALEUR.internet.complet });
    expect(sansMode?.mode.valeur).toBe(VALEUR.mode.devoirs);
  });

  it("les noms des champs par dimension suivent le contrat (pcReason, modeSource, internetUntil)", () => {
    expect("pc" + SUFFIXE_ETAT.raison).toBe("pcReason");
    expect("mode" + SUFFIXE_ETAT.source).toBe("modeSource");
    expect("internet" + SUFFIXE_ETAT.jusqua).toBe("internetUntil");
  });
});

describe("usage (écrit par le PC)", () => {
  it("aller-retour en secondes ; champs internes « _ » ignorés ; code parent réussi ou raté", () => {
    const u = {
      jour: "2026-10-26",
      secondesSession: 9300,
      secondesActives: 7200,
      secondesParAppli: { krita: 2700, "autre:bureau": 60 },
      nomsApplis: { krita: "Krita" },
      secondesParCategorie: { creation: 2700 },
      lancementsRefuses: [{ quand: t, appli: "krita" }],
      codeParent: [{ quand: t, reussi: true }],
      executablesInconnus: [],
      vpnBloques: [],
      limitesAtteintes: {},
      majLe: t,
    };
    const brut = usageVers(u);
    (brut[CHAMP_USAGE.secondesParAppli] as Record<string, number>)[`${PREFIXE_INTERNE}cache`] = 1;
    expect(usageDepuis(u.jour, brut)).toEqual(u);
    const rate = { ...brut, [CHAMP_USAGE.codeParent]: [{ [CHAMP_EVENEMENT.quand]: t.toISOString(), [CHAMP_EVENEMENT.resultat]: VALEUR.resultatCode.echec }] };
    expect(usageDepuis(u.jour, rate).codeParent[0].reussi).toBe(false);
  });
});

describe("demandes", () => {
  it("créée par le PC : en attente, avec détail et durée", () => {
    const brut = nouvelleDemandeVers({ id: "d", de: "enfant", type: VALEUR.typeDemande.mode, detail: VALEUR.mode.libre, message: "", dureeMinutes: 45, creeeLe: t });
    const d = demandeDepuis("d", brut)!;
    expect(d).toMatchObject({ type: VALEUR.typeDemande.mode, detail: VALEUR.mode.libre, dureeMinutes: 45, statut: VALEUR.statutDemande.enAttente });
    expect(demandeDepuis("d2", { [CHAMP_DEMANDE.type]: "autre chose" })).toBeNull();
  });

  it("une décision parent n'écrit QUE les champs autorisés aux parents", () => {
    const brut = decisionVers({ statut: VALEUR.statutDemande.refusee, par: "p", traiteLe: t });
    expect(Object.keys(brut).sort()).toEqual([...CHAMPS_DEMANDE_PARENT].sort());
  });

  it("enDate accepte Date, Timestamp, nombre, texte ISO ; refuse le reste", () => {
    expect(enDate(t)).toEqual(t);
    expect(enDate({ toDate: () => t })).toEqual(t);
    expect(enDate(t.toISOString())).toEqual(t);
    expect(enDate("n'importe quoi")).toBeNull();
  });
});
