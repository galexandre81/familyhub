import { describe, expect, it } from "vitest";
import {
  DEFAUTS,
  JUSQUA_NOUVEL_ORDRE_MS,
  PLANNING_DEFAUT,
  VALEUR,
  type ConfigAppareil,
  type Exception,
} from "@family-hub/controle-parental";
import {
  choixEcheances,
  dureeTexte,
  echeanceDepuisHeure,
  exceptionEnCours,
  fraicheur,
  ilYA,
  phraseEtat,
  phraseQuota,
  quandTexte,
  titreDemande,
} from "./phrases";

// Lundi 26.10.2026, heure locale.
const le = (jour: number, h: number, m = 0) => new Date(2026, 9, jour, h, m);
const config = (exception: Exception | null = null): ConfigAppareil => ({
  id: "x",
  foyer: "f",
  compteAppareil: "u",
  nom: null,
  planning: PLANNING_DEFAUT,
  defauts: DEFAUTS,
  exception,
  listeEcole: [],
  applis: {},
  limites: {},
  modifieLe: null,
  modifiePar: null,
});

describe("l'état en une phrase", () => {
  it("l'après-midi, sans rien de spécial", () => {
    expect(phraseEtat(config(), le(26, 15, 0))).toBe("PC autorisé, internet complet, verrouillage à 21h30");
  });

  it("le vendredi, verrouillage plus tard", () => {
    expect(phraseEtat(config(), le(30, 15, 0))).toBe("PC autorisé, internet complet, verrouillage à 22h30");
  });

  it("la nuit", () => {
    expect(phraseEtat(config(), le(26, 22, 0))).toBe("PC verrouillé pour la nuit, jusqu'à demain 7h00, internet complet");
    expect(phraseEtat(config(), le(27, 6, 0))).toBe("PC verrouillé pour la nuit, jusqu'à 7h00, internet complet");
  });

  it("débloqué un soir", () => {
    const ex = { pc: VALEUR.pc.autorise, jusqua: le(26, 23, 0), par: "p" };
    expect(phraseEtat(config(ex), le(26, 22, 0))).toBe("PC débloqué jusqu'à 23h00, internet complet");
  });

  it("verrouillé maintenant", () => {
    const ex = { pc: VALEUR.pc.verrouille, jusqua: le(26, 18, 0), par: "p" };
    expect(phraseEtat(config(ex), le(26, 15, 0))).toBe("PC verrouillé jusqu'à 18h00, internet complet");
  });

  it("mode école l'après-midi", () => {
    const ex = { internet: VALEUR.internet.ecole, jusqua: le(26, 17, 0), par: "p" };
    expect(phraseEtat(config(ex), le(26, 14, 0))).toBe("PC autorisé, mode école jusqu'à 17h00, verrouillage à 21h30");
  });

  it("aucun mot technique, quel que soit l'état", () => {
    const etats = [
      config(),
      config({ pc: VALEUR.pc.autorise, jusqua: le(26, 23, 0), par: "p" }),
      config({ pc: VALEUR.pc.verrouille, internet: VALEUR.internet.ecole, jusqua: le(27, 7, 0), par: "p" }),
    ];
    for (const c of etats) {
      for (const h of [8, 15, 22]) {
        expect(phraseEtat(c, le(26, h))).not.toMatch(/dns|override|exception|filtered|school|locked|allowed/i);
      }
    }
  });
});

describe("verrouillé jusqu'à ce qu'un parent le déverrouille", () => {
  const sansFin = new Date(JUSQUA_NOUVEL_ORDRE_MS);
  it("proposé en premier quand on verrouille, et seulement là", () => {
    expect(choixEcheances(le(26, 15), "verrouiller")[0]).toEqual({ libelle: "Jusqu'à ce que je le déverrouille", jusqua: sansFin });
    expect(choixEcheances(le(26, 15), "debloquer").some((c) => c.jusqua.getTime() === sansFin.getTime())).toBe(false);
    expect(choixEcheances(le(26, 15), "ecole").some((c) => c.jusqua.getTime() === sansFin.getTime())).toBe(false);
  });
  it("la phrase ne donne pas de date, et le verrou tient toute la nuit et le lendemain", () => {
    const c = config({ pc: VALEUR.pc.verrouille, jusqua: sansFin, par: "p" });
    for (const t of [le(26, 15), le(27, 10), le(30, 12)]) {
      expect(phraseEtat(c, t)).toBe("PC verrouillé jusqu'à ce qu'un parent le déverrouille, internet complet");
    }
    expect(exceptionEnCours(c, le(26, 15))).toBe("verrouillé jusqu'à ce qu'un parent le déverrouille");
  });
});

describe("fraîcheur", () => {
  const etat = (vuLe: Date | null) => ({
    pc: VALEUR.pc.autorise,
    internet: VALEUR.internet.complet,
    raison: null,
    vuLe,
    version: null,
  });
  it("en ligne", () => {
    expect(fraicheur(etat(le(26, 15, 0)), le(26, 15, 0))).toEqual({ enLigne: true, texte: "En ligne · vu à l'instant" });
    expect(fraicheur(etat(le(26, 15, 0)), le(26, 15, 3)).texte).toBe("En ligne · vu il y a 3 min");
  });
  it("hors ligne", () => {
    expect(fraicheur(etat(le(26, 12, 10)), le(26, 15, 0))).toEqual({ enLigne: false, texte: "Hors ligne depuis 12h10" });
    expect(fraicheur(etat(le(25, 21, 10)), le(26, 15, 0)).texte).toBe("Hors ligne depuis hier 21h10");
    expect(fraicheur(etat(le(20, 21, 10)), le(26, 15, 0)).texte).toBe("Hors ligne depuis le 20 octobre");
  });
  it("jamais connecté", () => {
    expect(fraicheur(null, le(26, 15)).texte).toBe("Le PC ne s'est encore jamais connecté");
    expect(fraicheur(etat(null), le(26, 15)).enLigne).toBe(false);
  });
});

describe("jusqu'à quand", () => {
  it("toutes les propositions sont dans le futur, triées", () => {
    for (const sorte of ["debloquer", "verrouiller", "ecole"] as const) {
      for (const h of [7, 14, 21, 23]) {
        const maintenant = le(26, h, 17);
        const choix = choixEcheances(maintenant, sorte);
        expect(choix.length).toBeGreaterThanOrEqual(3);
        for (const c of choix) expect(c.jusqua.getTime()).toBeGreaterThan(maintenant.getTime());
      }
    }
  });
  it("verrouiller : proposé jusqu'à demain matin", () => {
    expect(choixEcheances(le(26, 15), "verrouiller").map((c) => c.libelle)).toContain("Demain 7h00");
  });
  it("heure libre : aujourd'hui si à venir, sinon demain", () => {
    expect(echeanceDepuisHeure("23:00", le(26, 22, 0))).toEqual(le(26, 23, 0));
    expect(echeanceDepuisHeure("07:00", le(26, 22, 0))).toEqual(le(27, 7, 0));
    expect(echeanceDepuisHeure("25:00", le(26, 22, 0))).toBeNull();
  });
  it("ce qu'un nouveau choix remplacerait", () => {
    const ex = { pc: VALEUR.pc.autorise, jusqua: le(26, 23, 0), par: "p" };
    expect(exceptionEnCours(config(ex), le(26, 22, 0))).toBe("débloqué jusqu'à 23h00");
    expect(exceptionEnCours(config(ex), le(26, 23, 30))).toBeNull();
  });
});

describe("quota du filtre internet", () => {
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
});

describe("petits textes", () => {
  it("durées", () => {
    expect(dureeTexte(0)).toBe("0 min");
    expect(dureeTexte(45)).toBe("45 min");
    expect(dureeTexte(155)).toBe("2h35");
  });
  it("quand", () => {
    expect(quandTexte(le(26, 21, 30), le(26, 15))).toBe("21h30");
    expect(quandTexte(le(27, 7, 0), le(26, 15))).toBe("demain 7h00");
  });
  it("il y a", () => {
    expect(ilYA(le(26, 14, 55), le(26, 15, 0))).toBe("il y a 5 min");
    expect(ilYA(le(26, 9, 5), le(26, 15, 0))).toBe("à 9h05");
    expect(ilYA(le(25, 20, 47), le(26, 15, 0))).toBe("hier à 20h47");
  });
  it("demandes", () => {
    const d = (type: (typeof VALEUR.typeDemande)[keyof typeof VALEUR.typeDemande], cible: string | null) => ({
      id: "d",
      type,
      message: "",
      cible,
      creeeLe: null,
      statut: VALEUR.statutDemande.enAttente,
      decidePar: null,
      decideLe: null,
      accordeJusqua: null,
    });
    const nom = (id: string) => (id === "jeu.x" ? "Le Jeu" : id);
    expect(titreDemande(d(VALEUR.typeDemande.temps, null), nom)).toBe("Plus de temps");
    expect(titreDemande(d(VALEUR.typeDemande.site, "scratch.mit.edu"), nom)).toBe("Le site scratch.mit.edu");
    expect(titreDemande(d(VALEUR.typeDemande.appli, "jeu.x"), nom)).toBe("L'appli Le Jeu");
  });
});
