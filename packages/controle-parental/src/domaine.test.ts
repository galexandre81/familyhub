import { describe, expect, it } from "vitest";
import { ajouterDomaine, normaliserDomaine } from "./domaine.js";

describe("« le prof demande ce site »", () => {
  it.each([
    ["https://www.Pronote.net/eleve.html?id=3#x", "pronote.net"],
    ["  monlycee.fr/cours  ", "monlycee.fr"],
    ["http://0390000a.index-education.net/pronote/", "0390000a.index-education.net"],
    ["fr.khanacademy.org", "fr.khanacademy.org"],
    ["WWW.SCRATCH.MIT.EDU", "scratch.mit.edu"],
    ["https://exemple.ch:8443/page", "exemple.ch"],
    ["https://exemple.ch./", "exemple.ch"],
    ["https://éducation.fr", "xn--ducation-90a.fr"],
  ])("%s → %s", (saisie, domaine) => {
    expect(normaliserDomaine(saisie)).toBe(domaine);
  });

  it.each(["", "   ", "pronote", "deux mots.fr", "https://192.168.1.10/", "-mauvais.fr", "http://", "a..b"])(
    "refuse « %s »",
    (saisie) => {
      expect(normaliserDomaine(saisie)).toBeNull();
    },
  );

  it("ajout sans doublon", () => {
    expect(ajouterDomaine(["a.fr"], "b.fr")).toEqual(["a.fr", "b.fr"]);
    expect(ajouterDomaine(["a.fr", "b.fr"], "a.fr")).toEqual(["a.fr", "b.fr"]);
  });
});
