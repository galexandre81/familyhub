import { describe, expect, it } from "vitest";
import {
  DEFAUTS,
  JUSQUA_NOUVEL_ORDRE_MS,
  LISTE_ECOLE_INITIALE,
  PLANNING_DEFAUT,
  PREFIXE_AUTRE_APPLI,
  VALEUR,
  type ConfigAppareil,
  type Demande,
  type EtatAppareil,
  type Exception,
  type Source,
  type TypeDemande,
  type UsageJour,
} from "@family-hub/controle-parental";
import {
  alertesPc,
  applisDuJour,
  boutonOui,
  carteMode,
  choixEcheances,
  dureeSecondesTexte,
  dureeTexte,
  ecartAvecLePc,
  echeanceDepuisHeure,
  evenementsDuJour,
  exceptionEnCours,
  fraicheur,
  ilYA,
  nomMontre,
  noteApres,
  phraseQuota,
  quandTexte,
  resumeCarte,
  resumeInternet,
  resumeMode,
  titreDemande,
} from "./phrases";

// Lundi 26.10.2026, heure locale.
const le = (jour: number, h: number, m = 0) => new Date(2026, 9, jour, h, m);
const SANS_FIN = new Date(JUSQUA_NOUVEL_ORDRE_MS);

const config = (exception: Omit<Exception, "poseLe"> | null = null, modifieLe: Date | null = null): ConfigAppareil => ({
  id: "x",
  foyer: "f",
  compteAppareil: "u",
  nom: null,
  planning: PLANNING_DEFAUT,
  defauts: DEFAUTS,
  exception: exception && { ...exception, poseLe: null },
  reinitialiserLocalAvant: null,
  listeEcole: [...LISTE_ECOLE_INITIALE],
  applis: {},
  limites: {},
  executablesInconnus: VALEUR.executablesInconnus.signaler,
  nomsParents: { a: "Papa" },
  modifieLe,
  modifiePar: null,
});

const dim = <V,>(valeur: V, source: Source | null = null, jusqua: Date | null = null) => ({
  valeur,
  raison: null,
  source,
  jusqua,
});

const etat = (o: Partial<EtatAppareil> = {}): EtatAppareil => ({
  pc: dim(VALEUR.pc.autorise, VALEUR.source.defaut),
  internet: dim(VALEUR.internet.complet, VALEUR.source.defaut),
  mode: dim(VALEUR.mode.devoirs, VALEUR.source.defaut),
  libelleMode: null,
  reseau: null,
  resume: null,
  prochainChangement: {},
  sessionOuverte: true,
  fermetureA: null,
  minutesDuJour: 0,
  applisRefusees: {},
  vuLe: null,
  heurePc: null,
  version: null,
  erreursConfig: [],
  sauvegarde: null,
  catalogue: {},
  ...o,
});

const libre = (jusqua: Date, par = "Papa") => ({ mode: VALEUR.mode.libre, jusqua, par });

describe("la carte « Mode en cours »", () => {
  it("l'après-midi, rien de spécial : Devoirs, et le verrouillage du soir", () => {
    expect(carteMode(config(), le(26, 15))).toEqual({
      mode: VALEUR.mode.devoirs,
      libelle: "Devoirs",
      description: "Les applis d'école, et seulement les sites de l'école.",
      origine: "Mode habituel",
      pc: "PC autorisé · se verrouille à 21h30",
      verrouille: false,
      internet: null,
      ensuite: null,
    });
  });

  it("le vendredi, le verrouillage est plus tard", () => {
    expect(carteMode(config(), le(30, 15)).pc).toBe("PC autorisé · se verrouille à 22h30");
  });

  it("la nuit : verrouillé jusqu'au matin", () => {
    const c = carteMode(config(), le(26, 22));
    expect(c.verrouille).toBe(true);
    expect(c.pc).toBe("PC verrouillé jusqu'à demain 7h00");
    expect(carteMode(config(), le(27, 6)).pc).toBe("PC verrouillé jusqu'à 7h00");
  });

  it("le PC annonce la fermeture de la session", () => {
    const e = etat({ fermetureA: le(26, 21, 35) });
    expect(carteMode(config(), le(26, 21, 31), e).pc).toBe("PC verrouillé jusqu'à demain 7h00 · fermeture à 21h35");
    expect(carteMode(config(), le(26, 21, 40), e).pc).toBe("PC verrouillé jusqu'à demain 7h00");
  });

  it("un mode choisi : qui, jusqu'à quand, puis le retour", () => {
    const c = carteMode(config(libre(le(26, 18))), le(26, 15));
    expect(c.libelle).toBe("Temps libre");
    expect(c.origine).toBe("Choisi par Papa jusqu'à 18h00");
    expect(c.ensuite).toBe("Puis retour en Devoirs à 18h00");
    expect(c.pc).toBe("PC autorisé · se verrouille à 21h30");
    expect(c.description).toBe("Toutes les applis autorisées, et seulement les sites de l'école.");
  });

  it("un mode « jusqu'à ce que je change » : pas de retour annoncé", () => {
    const c = carteMode(config(libre(SANS_FIN)), le(26, 15));
    expect(c.origine).toBe("Choisi par Papa jusqu'à nouvel ordre");
    expect(c.ensuite).toBeNull();
  });

  it("verrouillé jusqu'à nouvel ordre : tient la nuit et le lendemain", () => {
    const c = config({ pc: VALEUR.pc.verrouille, jusqua: SANS_FIN, par: "Maman" });
    for (const t of [le(26, 15), le(27, 10), le(30, 12)]) {
      expect(carteMode(c, t).pc).toBe("PC verrouillé jusqu'à nouvel ordre");
    }
  });

  it("internet coupé l'emporte sur le mode", () => {
    const c = carteMode(
      config({ internet: VALEUR.internet.coupe, jusqua: le(26, 17), par: "Papa" }),
      le(26, 15),
    );
    expect(c.internet).toBe("Internet coupé jusqu'à 17h00");
    expect(c.description).toBe("Les applis d'école, et pas d'internet.");
  });

  it("un mode « + Internet » ouvre tout internet filtré", () => {
    const c = carteMode(config({ mode: VALEUR.mode.libreInternet, jusqua: le(26, 18), par: "Papa" }), le(26, 15));
    expect(c.description).toBe("Toutes les applis autorisées, et tout internet, filtré.");
  });

  it("aucun mot technique, quel que soit l'état", () => {
    const etats = [
      config(),
      config(libre(le(26, 23))),
      config({ pc: VALEUR.pc.verrouille, internet: VALEUR.internet.coupe, jusqua: le(27, 7), par: "Papa" }),
      config({ mode: VALEUR.mode.devoirsInternet, jusqua: SANS_FIN, par: "Papa" }),
    ];
    for (const c of etats) {
      for (const h of [8, 15, 22]) {
        const texte = JSON.stringify({ ...carteMode(c, le(26, h)), mode: null }) + resumeCarte(c, le(26, h));
        expect(texte).not.toMatch(/dns|override|exception|filtered|school|locked|allowed|_internet/i);
      }
    }
  });
});

describe("la carte d'Aujourd'hui", () => {
  it("le mode et le prochain verrouillage", () => {
    expect(resumeCarte(config(), le(26, 15))).toBe("Devoirs · se verrouille à 21h30");
    expect(resumeCarte(config(libre(le(26, 18))), le(26, 15))).toBe("Temps libre · se verrouille à 21h30");
  });
  it("la nuit, seulement le verrou", () => {
    expect(resumeCarte(config(), le(26, 22))).toBe("PC verrouillé jusqu'à demain 7h00");
  });
});

describe("les tuiles de modes (maquette A)", () => {
  it("ce que chaque mode permet, en court", () => {
    expect(resumeMode(VALEUR.mode.devoirs)).toBe("École seulement");
    expect(resumeMode(VALEUR.mode.devoirsInternet)).toBe("Applis d'école, tout internet filtré");
    expect(resumeMode(VALEUR.mode.libre)).toBe("Toutes les applis, sites de l'école");
    expect(resumeMode(VALEUR.mode.libreInternet)).toBe("Tout, internet filtré");
  });
});

describe("une seule décision à la fois", () => {
  it("ce qu'une nouvelle décision remplace", () => {
    expect(exceptionEnCours(config(libre(le(26, 18))), le(26, 15))).toBe("Temps libre jusqu'à 18h00, choisi par Papa");
    expect(exceptionEnCours(config(libre(le(26, 18))), le(26, 18, 30))).toBeNull();
    expect(
      exceptionEnCours(config({ pc: VALEUR.pc.verrouille, jusqua: SANS_FIN, par: "Maman" }), le(26, 15)),
    ).toBe("PC verrouillé jusqu'à nouvel ordre, choisi par Maman");
  });

  it("ce qui revient ensuite, et le verrou du soir qui reste", () => {
    expect(noteApres(config(libre(le(26, 18))), { mode: VALEUR.mode.libre }, le(26, 15))).toBe(
      "Ensuite, le PC revient tout seul en Devoirs. Le verrouillage de 21h30 reste en place.",
    );
    expect(noteApres(config(), { pc: VALEUR.pc.verrouille }, le(26, 15))).toBe(
      "Ensuite, le PC se déverrouille tout seul, sauf la nuit.",
    );
    expect(noteApres(config(), { internet: VALEUR.internet.coupe }, le(26, 15))).toBe(
      "Ensuite, internet revient tout seul. Le verrouillage de 21h30 reste en place.",
    );
  });
});

describe("jusqu'à quand", () => {
  it("« Jusqu'à ce que je change » en tête, pour toutes les décisions", () => {
    for (const sorte of ["mode", "verrouiller", "debloquer", "couper"] as const) {
      expect(choixEcheances(le(26, 15), sorte)[0]).toEqual({
        libelle: "Jusqu'à ce que je change",
        jusqua: SANS_FIN,
        principal: true,
      });
    }
  });
  it("toutes les propositions sont dans le futur", () => {
    for (const sorte of ["mode", "verrouiller", "debloquer", "couper"] as const) {
      for (const h of [7, 14, 21, 23]) {
        const maintenant = le(26, h, 17);
        for (const c of choixEcheances(maintenant, sorte)) expect(c.jusqua.getTime()).toBeGreaterThan(maintenant.getTime());
      }
    }
  });
  it("le dîner, aux heures du foyer, tant qu'il est à plus d'une demi-heure", () => {
    expect(choixEcheances(le(26, 15), "mode").map((c) => c.libelle)).toContain("Jusqu'au dîner (19h00)");
    const tard = { semaine: { petitDej: "07:00", dej: "12:15", diner: "19:30" }, weekend: { petitDej: "08:00", dej: "12:15", diner: "19:30" } };
    expect(choixEcheances(le(26, 15), "mode", tard).map((c) => c.libelle)).toContain("Jusqu'au dîner (19h30)");
    expect(choixEcheances(le(26, 18, 45), "mode").some((c) => c.libelle.includes("dîner"))).toBe(false);
  });
  it("demain matin : pour verrouiller ou couper internet seulement", () => {
    expect(choixEcheances(le(26, 15), "verrouiller").map((c) => c.libelle)).toContain("Jusqu'à demain matin (7h00)");
    expect(choixEcheances(le(26, 15), "couper").map((c) => c.libelle)).toContain("Jusqu'à demain matin (7h00)");
    expect(choixEcheances(le(26, 15), "mode").map((c) => c.libelle)).not.toContain("Jusqu'à demain matin (7h00)");
  });
  it("heure libre : aujourd'hui si à venir, sinon demain", () => {
    expect(echeanceDepuisHeure("23:00", le(26, 22))).toEqual(le(26, 23));
    expect(echeanceDepuisHeure("07:00", le(26, 22))).toEqual(le(27, 7));
    expect(echeanceDepuisHeure("25:00", le(26, 22))).toBeNull();
  });
});

describe("fraîcheur", () => {
  it("en ligne", () => {
    expect(fraicheur(etat({ vuLe: le(26, 15) }), le(26, 15))).toEqual({ enLigne: true, texte: "En ligne · à l'instant" });
    expect(fraicheur(etat({ vuLe: le(26, 15) }), le(26, 15, 1)).texte).toBe("En ligne · il y a 1 min");
  });
  it("hors ligne au-delà de 10 minutes", () => {
    expect(fraicheur(etat({ vuLe: le(26, 14, 49) }), le(26, 15)).enLigne).toBe(false);
    expect(fraicheur(etat({ vuLe: le(26, 12, 10) }), le(26, 15))).toEqual({ enLigne: false, texte: "Hors ligne depuis 12h10" });
    expect(fraicheur(etat({ vuLe: le(25, 21, 10) }), le(26, 15)).texte).toBe("Hors ligne depuis hier 21h10");
    expect(fraicheur(etat({ vuLe: le(20, 21, 10) }), le(26, 15)).texte).toBe("Hors ligne depuis le 20 octobre");
  });
  it("jamais connecté", () => {
    expect(fraicheur(null, le(26, 15)).texte).toBe("Le PC ne s'est encore jamais connecté");
  });
});

describe("le PC face à la config", () => {
  const enLigne = (o: Partial<EtatAppareil>) => etat({ vuLe: le(26, 21, 59), ...o });

  it("d'accord : rien à dire", () => {
    expect(ecartAvecLePc(config(), enLigne({}), le(26, 15))).toEqual([]);
  });
  it("code parent tapé sur le PC", () => {
    const e = enLigne({ pc: dim(VALEUR.pc.autorise, VALEUR.source.codeParent, le(26, 23)) });
    expect(ecartAvecLePc(config(), e, le(26, 22))).toEqual(["PC débloqué avec le code parent, sur le PC jusqu'à 23h00"]);
  });
  it("un changement tout juste décidé, puis qui tarde", () => {
    const e = enLigne({});
    expect(ecartAvecLePc(config(libre(le(26, 23)), le(26, 21, 59)), e, le(26, 22))).toEqual([
      "En cours d'application sur le PC…",
    ]);
    expect(ecartAvecLePc(config(libre(le(26, 23)), le(26, 21, 40)), e, le(26, 22))).toEqual([
      "Le PC n'a pas encore pris le dernier changement.",
    ]);
  });
  it("hors ligne : la fraîcheur le dit déjà", () => {
    const e = etat({ vuLe: le(26, 12), pc: dim(VALEUR.pc.autorise, VALEUR.source.codeParent, le(26, 23)) });
    expect(ecartAvecLePc(config(), e, le(26, 22))).toEqual([]);
  });
});

describe("alertes du PC", () => {
  it("réglage illisible, sauvegarde ratée ou ancienne, horloge fausse", () => {
    expect(alertesPc(etat(), le(26, 15))).toEqual([]);
    const e = etat({
      erreursConfig: ["plage du lundi"],
      sauvegarde: { date: le(23, 3), resultat: VALEUR.resultatSauvegarde.echec },
      vuLe: le(26, 15),
      heurePc: le(26, 15, 20),
    });
    expect(alertesPc(e, le(26, 15))).toEqual([
      "Le PC ne comprend pas un réglage : plage du lundi",
      "La dernière sauvegarde du PC a échoué.",
      "Pas de sauvegarde depuis le 23 octobre.",
      "L'heure du PC est fausse : il risque de se verrouiller à la mauvaise heure.",
    ]);
  });
  it("une sauvegarde réussie et récente ne dit rien", () => {
    const e = etat({ sauvegarde: { date: le(26, 3), resultat: VALEUR.resultatSauvegarde.ok } });
    expect(alertesPc(e, le(26, 15))).toEqual([]);
  });
});

describe("demandes", () => {
  const d = (type: TypeDemande, detail = "", dureeMinutes: number | null = null): Demande => ({
    id: "d",
    type,
    detail,
    message: "",
    dureeMinutes,
    creeeLe: null,
    statut: VALEUR.statutDemande.enAttente,
    reponse: null,
    traitePar: null,
    traiteLe: null,
  });
  const nom = (id: string) => (id === "org.kde.krita" ? "Krita" : id);

  it("ce que demande l'enfant, et le bouton oui", () => {
    expect(titreDemande(d(VALEUR.typeDemande.temps, "", 45), nom)).toBe("Plus de temps : 45 min");
    expect(boutonOui(d(VALEUR.typeDemande.temps, "", 45))).toBe("Oui, 45 min");
    expect(titreDemande(d(VALEUR.typeDemande.temps), nom)).toBe("Plus de temps");
    expect(boutonOui(d(VALEUR.typeDemande.temps))).toBe("Oui, 30 min");
    expect(titreDemande(d(VALEUR.typeDemande.mode, VALEUR.mode.libre, 45), nom)).toBe("Temps libre pendant 45 min");
    expect(boutonOui(d(VALEUR.typeDemande.mode, VALEUR.mode.libre, 45))).toBe("Oui, 45 min");
    expect(titreDemande(d(VALEUR.typeDemande.mode, "inconnu"), nom)).toBe("Un autre mode");
    expect(titreDemande(d(VALEUR.typeDemande.site, "scratch.mit.edu"), nom)).toBe("Le site scratch.mit.edu");
    expect(boutonOui(d(VALEUR.typeDemande.site, "scratch.mit.edu"))).toBe("Oui");
    expect(titreDemande(d(VALEUR.typeDemande.appli, "org.kde.krita"), nom)).toBe("L'appli Krita");
    expect(titreDemande(d(VALEUR.typeDemande.autre), nom)).toBe("Un message");
    expect(boutonOui(d(VALEUR.typeDemande.autre))).toBe("Vu");
  });

  it("nom montré à l'enfant, « Un parent » par défaut", () => {
    expect(nomMontre(config(), "a")).toBe("Papa");
    expect(nomMontre(config(), "b")).toBe("Un parent");
  });
});

describe("la journée", () => {
  const usage: UsageJour = {
    jour: "2026-10-26",
    secondesSession: 9_300,
    secondesActives: 8_000,
    secondesParAppli: { "google-chrome": 3_720, "org.kde.krita": 2_460, [`${PREFIXE_AUTRE_APPLI}steam`]: 600, bref: 30 },
    nomsApplis: { "google-chrome": "Google Chrome" },
    secondesParCategorie: {},
    lancementsRefuses: [{ quand: le(26, 16, 12), appli: "org.kde.krita" }],
    codeParent: [{ quand: le(26, 21, 38), reussi: false }],
    executablesInconnus: [{ quand: le(26, 14, 2), detail: "/media/cle/jeu.AppImage" }],
    vpnBloques: [],
    limitesAtteintes: { [VALEUR.categorie.jeu]: "17h40" },
    majLe: null,
  };
  const e = etat({ catalogue: { "org.kde.krita": { nom: "Krita", categorie: null, categorieParDefaut: null, autorisee: true, raison: null } }, applisRefusees: { "org.kde.krita": "pas en mode Devoirs" } });

  it("temps par appli, en clair, du plus long au plus court", () => {
    expect(dureeSecondesTexte(usage.secondesSession)).toBe("2h35");
    expect(applisDuJour(usage, e).map((a) => [a.nom, dureeSecondesTexte(a.secondes)])).toEqual([
      ["Google Chrome", "1h02"],
      ["Krita", "41 min"],
      ["Autre (steam)", "10 min"],
    ]);
  });

  it("ce qui s'est passé, dans l'ordre", () => {
    expect(evenementsDuJour(usage, e)).toEqual([
      "Programme inconnu « jeu.AppImage » lancé à 14h02",
      "Krita refusé à 16h12 (pas en mode Devoirs)",
      "Code parent erroné à 21h38",
      "Limite « Jeu » atteinte à 17h40",
    ]);
  });
});

describe("filtre internet", () => {
  it("sous le seuil : un chiffre", () => {
    expect(phraseQuota({ requetesDuMois: 48_000, limiteDuMois: 300_000 })).toEqual({
      alerte: false,
      texte: "Filtre internet : 48 000 requêtes ce mois-ci sur 300 000 gratuites (16 %)",
    });
  });
  it("au seuil : une alerte qui dit la conséquence et quoi faire, sans jargon", () => {
    const q = phraseQuota({ requetesDuMois: 246_000, limiteDuMois: 300_000 });
    expect(q.alerte).toBe(true);
    expect(q.texte).toContain("82 %");
    expect(q.texte).toContain("ne bloque plus rien");
    expect(q.texte).not.toMatch(/dns\b|quota|api/i);
  });
  it("le résumé de la ligne repliée", () => {
    const r = {
      jour: "2026-10-26",
      visites: [],
      bloques: [
        { domaine: "a.com", requetes: 3 },
        { domaine: "b.com", requetes: 1 },
      ],
      toujoursAutorises: [],
      toujoursBloques: [],
      requetesDuMois: 48_000,
      limiteDuMois: 300_000,
      majLe: null,
    };
    expect(resumeInternet(r, le(26, 15))).toBe("2 sites bloqués · le filtre a utilisé 16 % du mois");
    expect(resumeInternet(r, le(27, 9))).toBe("Aucun site bloqué · le filtre a utilisé 16 % du mois");
    expect(resumeInternet(null, le(26, 15))).toBe("Le filtre n'est pas encore relié");
  });
});

describe("petits textes", () => {
  it("durées", () => {
    expect(dureeTexte(0)).toBe("0 min");
    expect(dureeTexte(45)).toBe("45 min");
    expect(dureeTexte(155)).toBe("2h35");
  });
  it("quand", () => {
    expect(quandTexte(le(26, 21, 30), le(26, 15))).toBe("21h30");
    expect(quandTexte(le(27, 7), le(26, 15))).toBe("demain 7h00");
  });
  it("il y a", () => {
    expect(ilYA(le(26, 14, 55), le(26, 15))).toBe("il y a 5 min");
    expect(ilYA(le(26, 9, 5), le(26, 15))).toBe("à 9h05");
    expect(ilYA(le(25, 20, 47), le(26, 15))).toBe("hier à 20h47");
  });
});
