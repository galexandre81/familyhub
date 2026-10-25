/**
 * Plein écran radio de l'iPad (apps/display/public/js/tiles/radio.js, ES5) :
 * le fichier livré est exécuté tel quel dans un contexte vm, comme dans
 * Safari (window). Seules les fonctions pures sont appelées ici.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  fileURLToPath(new URL("../../../apps/display/public/js/tiles/radio.js", import.meta.url)),
  "utf8",
);

interface Station {
  id: string;
  nom: string;
}
interface Etat {
  playing?: boolean;
  loading?: boolean;
  error?: string | null;
  currentStation?: Station | null;
}
interface ApiRadio {
  etatStation(state: Etat | null, station: Station | null): string | null;
  sousTitreRadio(state: Etat | null, nbStations: number): string;
  expand: unknown;
}

function charger(): ApiRadio {
  const window: { Tiles?: Record<string, unknown> } = {};
  runInNewContext(SOURCE, { window });
  return window.Tiles!.radio as ApiRadio;
}

const r = charger();
const fip: Station = { id: "s3", nom: "FIP" };
const inter: Station = { id: "s1", nom: "France Inter" };

describe("radio.js — chargement", () => {
  it("expose expand et les fonctions pures sur window.Tiles.radio", () => {
    expect(typeof r.expand).toBe("function");
    expect(typeof r.etatStation).toBe("function");
  });
});

describe("etatStation", () => {
  it("seule la station courante a un état", () => {
    const s: Etat = { playing: true, currentStation: fip };
    expect(r.etatStation(s, fip)).toBe("lecture");
    expect(r.etatStation(s, inter)).toBeNull();
  });
  it("erreur > chargement > lecture > pause", () => {
    expect(r.etatStation({ playing: true, loading: true, error: "Flux indisponible", currentStation: fip }, fip)).toBe("erreur");
    expect(r.etatStation({ playing: true, loading: true, currentStation: fip }, fip)).toBe("chargement");
    expect(r.etatStation({ playing: false, currentStation: fip }, fip)).toBe("pause");
  });
  it("rien en cours ou état absent : null", () => {
    expect(r.etatStation({ playing: false, currentStation: null }, fip)).toBeNull();
    expect(r.etatStation(null, fip)).toBeNull();
  });
});

describe("sousTitreRadio", () => {
  it("dit ce que fait la radio", () => {
    expect(r.sousTitreRadio({ playing: true, currentStation: fip }, 6)).toBe("En écoute : FIP");
    expect(r.sousTitreRadio({ playing: false, currentStation: fip }, 6)).toBe("FIP en pause");
    expect(r.sousTitreRadio({ loading: true, currentStation: inter }, 6)).toBe("Connexion à France Inter…");
    expect(r.sousTitreRadio({ error: "Flux indisponible", currentStation: fip }, 6)).toBe("FIP : Flux indisponible");
  });
  it("rien en cours : invite à toucher une station, ou signale qu'il n'y en a pas", () => {
    expect(r.sousTitreRadio({ playing: false, currentStation: null }, 6)).toBe("Touche une station pour l'écouter");
    expect(r.sousTitreRadio(null, 0)).toBe("Aucune station");
  });
});
