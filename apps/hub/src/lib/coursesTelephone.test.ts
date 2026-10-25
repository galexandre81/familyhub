import { describe, expect, it } from "vitest";
import type { Profil } from "@family-hub/types";
import type { ArticleAvecId } from "./listeCourses";
import {
  libellePastille,
  libelleQuantite,
  modeEnregistre,
  modeParDefaut,
  prenomQuiACoche,
  progressionMagasin,
  texteAPartager,
  titreSemaine,
} from "./coursesTelephone";

const art = (id: string, extra: Partial<ArticleAvecId> = {}): ArticleAvecId => ({
  id,
  nom: `article ${id}`,
  quantite: 1,
  unite: "",
  rayon: "epicerie",
  recetteIds: [],
  ajoutManuel: false,
  destination: "magasin",
  placard: false,
  checked: false,
  checkedAt: null,
  checkedBy: null,
  ordre: Number(id) || 0,
  ...extra,
});

describe("modeParDefaut", () => {
  it("« trier » s'il reste un article à trier", () => {
    expect(modeParDefaut([art("1"), art("2", { destination: "a-trier" })])).toBe("trier");
  });
  it("« magasin » sinon (et liste vide)", () => {
    expect(modeParDefaut([art("1"), art("2", { destination: "drive" })])).toBe("magasin");
    expect(modeParDefaut([])).toBe("magasin");
  });
});

describe("modeEnregistre", () => {
  it("reconnaît les deux modes", () => {
    expect(modeEnregistre("trier")).toBe("trier");
    expect(modeEnregistre("magasin")).toBe("magasin");
  });
  it("ignore le reste", () => {
    expect(modeEnregistre(null)).toBeUndefined();
    expect(modeEnregistre("drive")).toBeUndefined();
  });
});

describe("progressionMagasin", () => {
  it("compte les articles du magasin (magasin + à trier), hors drive et « on l'a »", () => {
    const p = progressionMagasin([
      art("1", { checked: true }),
      art("2"),
      art("3", { destination: "a-trier" }),
      art("4", { destination: "drive", checked: true }),
      art("5", { destination: "deja" }),
    ]);
    expect(p).toEqual({ coches: 1, total: 3, pourcentage: 33 });
  });
  it("liste vide : 0 / 0, 0 %", () => {
    expect(progressionMagasin([])).toEqual({ coches: 0, total: 0, pourcentage: 0 });
  });
});

describe("libelleQuantite", () => {
  it("rien pour 1 sans unité", () => {
    expect(libelleQuantite({ quantite: 1, unite: "" })).toBe("");
  });
  it("quantité seule ou avec unité, virgule décimale", () => {
    expect(libelleQuantite({ quantite: 3, unite: "" })).toBe("3");
    expect(libelleQuantite({ quantite: 500, unite: "g" })).toBe("500 g");
    expect(libelleQuantite({ quantite: 1.5, unite: "kg" })).toBe("1,5 kg");
    expect(libelleQuantite({ quantite: 1, unite: " botte " })).toBe("1 botte");
  });
});

describe("texteAPartager", () => {
  it("articles du magasin non cochés, par rayon dans l'ordre du magasin, avec titres", () => {
    const texte = texteAPartager([
      art("1", { nom: "Pâtes", rayon: "epicerie", quantite: 500, unite: "g" }),
      art("2", { nom: "Tomates", rayon: "fruits-legumes", quantite: 6 }),
      art("3", { nom: "Riz", rayon: "epicerie", checked: true }),
      art("4", { nom: "Lessive", destination: "drive" }),
      art("5", { nom: "Sel", destination: "deja" }),
      art("6", { nom: "Courgettes", rayon: "fruits-legumes", destination: "a-trier" }),
    ]);
    expect(texte).toBe(
      [
        "Courses",
        "",
        "Fruits et légumes",
        "- Tomates (6)",
        "- Courgettes",
        "",
        "Épicerie",
        "- Pâtes (500 g)",
      ].join("\n"),
    );
  });
  it("vide quand tout est coché", () => {
    expect(texteAPartager([art("1", { checked: true })])).toBe("");
  });
});

describe("libellePastille", () => {
  it("raccourcit « Fruits et légumes »", () => {
    expect(libellePastille("fruits-legumes", "Fruits et légumes")).toBe("Légumes");
    expect(libellePastille("epicerie", "Épicerie")).toBe("Épicerie");
  });
});

describe("titreSemaine", () => {
  it("« Semaine du lundi 26 octobre »", () => {
    expect(titreSemaine(new Date(2026, 9, 26, 12))).toBe("Semaine du lundi 26 octobre");
  });
  it("1er du mois", () => {
    expect(titreSemaine(new Date(2026, 5, 1, 12))).toBe("Semaine du lundi 1er juin");
  });
});

describe("prenomQuiACoche", () => {
  const profils = [
    { id: "p1", nom: "Marie Martin", uid: "u-marie" },
    { id: "p2", nom: "Alex", uid: "u-alex" },
  ] as Array<Profil & { id: string }>;
  it("prénom du profil relié au compte", () => {
    expect(prenomQuiACoche(profils, "u-marie")?.prenom).toBe("Marie");
    expect(prenomQuiACoche(profils, "u-alex")?.profil?.id).toBe("p2");
  });
  it("« ? » si personne n'est relié", () => {
    expect(prenomQuiACoche(profils, "u-inconnu")).toEqual({ prenom: "?" });
    expect(prenomQuiACoche(profils, null)).toEqual({ prenom: "?" });
  });
});
