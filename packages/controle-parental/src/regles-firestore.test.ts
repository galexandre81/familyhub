/**
 * Les règles Firestore répètent forcément des noms du schéma (leur langage
 * n'importe rien). Ce test lit firestore.rules et vérifie que chaque nom dont
 * dépend la sécurité y figure bien : renommer un champ dans schema.ts sans
 * toucher aux règles le fait échouer, au lieu d'ouvrir ou de fermer une porte
 * en silence.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHAMP_CONFIG,
  CHAMP_DEMANDE,
  CHAMP_REGLE,
  CHAMPS_DEMANDE_PARENT,
  COLLECTION_APPAREILS,
  DOC_ETAT_COURANT,
  SOUS_COLLECTION,
  VALEUR,
} from "./schema";

const regles = readFileSync(resolve(__dirname, "../../../firestore.rules"), "utf8");
const bloc = regles.slice(regles.indexOf(`match /${COLLECTION_APPAREILS}/`));

describe("firestore.rules concorde avec le schéma", () => {
  it("le bloc des appareils existe", () => {
    expect(bloc.length).toBeGreaterThan(100);
  });

  it.each([
    `/${SOUS_COLLECTION.etat}/`,
    `/${SOUS_COLLECTION.usage}/`,
    `/${SOUS_COLLECTION.demandes}/`,
  ])("sous-collection %s", (s) => {
    expect(bloc).toContain(`match ${s}`);
  });

  it("noms de champs et valeurs cités entre apostrophes", () => {
    const attendus = [
      DOC_ETAT_COURANT,
      CHAMP_CONFIG.foyer,
      CHAMP_CONFIG.compteAppareil,
      CHAMP_CONFIG.modifiePar,
      CHAMP_CONFIG.exception,
      CHAMP_CONFIG.listeEcole,
      CHAMP_DEMANDE.statut,
      VALEUR.statutDemande.enAttente,
      VALEUR.statutDemande.acceptee,
      VALEUR.statutDemande.refusee,
      ...CHAMPS_DEMANDE_PARENT,
    ];
    const manquants = attendus.filter((n) => !bloc.includes(`'${n}'`));
    expect(manquants).toEqual([]);
  });

  it("la liste des champs autorisés de la config est exactement celle du schéma", () => {
    const m = /hasOnly\(\[([^\]]*)\]\)/.exec(bloc);
    const dansRegles = (m?.[1].match(/'([^']+)'/g) ?? []).map((s) => s.slice(1, -1)).sort();
    expect(dansRegles).toEqual(Object.values(CHAMP_CONFIG).sort());
  });

  it("l'échéance d'une exception est exigée sous son nom", () => {
    expect(bloc).toContain(`.${CHAMP_CONFIG.exception}.${CHAMP_REGLE.jusqua} is timestamp`);
  });
});
