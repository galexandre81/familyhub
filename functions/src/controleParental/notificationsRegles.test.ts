import { describe, expect, it } from "vitest";
import { CHAMP_ABONNE, CHAMP_CONFIG, CHAMP_DEMANDE, VALEUR } from "./genere/schema";
import {
  jetonsAPrevenir,
  notificationDe,
  phraseDemande,
  prevenirDeLaDemande,
  type Dependances,
  type Notification,
} from "./notificationsRegles";

const FOYER = { membres: ["p1", "p2", "enfant"], roles: { p1: "parent", p2: "parent", enfant: "enfant" } };
const CONFIG = { [CHAMP_CONFIG.foyer]: "f1", [CHAMP_CONFIG.nom]: "PC des enfants" };
const demande = (d: Record<string, unknown> = {}) => ({
  [CHAMP_DEMANDE.statut]: VALEUR.statutDemande.enAttente,
  [CHAMP_DEMANDE.type]: VALEUR.typeDemande.temps,
  [CHAMP_DEMANDE.dureeMinutes]: 30,
  [CHAMP_DEMANDE.message]: "",
  ...d,
});
const abonne = (uid: string, jetons: unknown) => ({ uid, donnees: { [CHAMP_ABONNE.jetons]: jetons } });

describe("phrase de la notification", () => {
  it.each([
    [{}, "Plus de temps : 30 min"],
    [{ [CHAMP_DEMANDE.dureeMinutes]: 90 }, "Plus de temps : 1h30"],
    [{ [CHAMP_DEMANDE.type]: VALEUR.typeDemande.mode, [CHAMP_DEMANDE.detail]: VALEUR.mode.libre }, "Temps libre pendant 30 min"],
    [{ [CHAMP_DEMANDE.type]: VALEUR.typeDemande.mode, [CHAMP_DEMANDE.detail]: "inconnu" }, "Un autre mode pendant 30 min"],
    [{ [CHAMP_DEMANDE.type]: VALEUR.typeDemande.site, [CHAMP_DEMANDE.detail]: "exemple.org" }, "Le site exemple.org"],
    [{ [CHAMP_DEMANDE.type]: VALEUR.typeDemande.appli, [CHAMP_DEMANDE.detail]: "krita" }, "L'appli krita"],
    [{ [CHAMP_DEMANDE.type]: VALEUR.typeDemande.autre }, "Un message"],
  ])("%o → %s", (d, attendu) => {
    expect(phraseDemande(demande(d))).toBe(attendu);
  });

  it("titre au nom du PC, message de l'enfant cité, toucher → écran du PC", () => {
    const n = notificationDe("d1", demande({ [CHAMP_DEMANDE.message]: "  encore un peu  " }), CONFIG);
    expect(n).toEqual({
      titre: "PC des enfants : une demande",
      corps: "Plus de temps : 30 min\n« encore un peu »",
      url: "/pc",
      tag: "demande-d1",
    });
  });

  it("sans nom de PC, et message trop long coupé", () => {
    const n = notificationDe("d1", demande({ [CHAMP_DEMANDE.message]: "x".repeat(500) }), { [CHAMP_CONFIG.foyer]: "f1" });
    expect(n.titre).toBe("PC des enfants : une demande");
    expect(n.corps.length).toBeLessThan(260);
    expect(n.corps.endsWith("… »")).toBe(true);
  });
});

describe("qui est prévenu", () => {
  it("les jetons des deux parents, sans doublon", () => {
    expect(jetonsAPrevenir([abonne("p1", ["a", "b"]), abonne("p2", ["c", "a"])], FOYER)).toEqual([
      { uid: "p1", jeton: "a" },
      { uid: "p1", jeton: "b" },
      { uid: "p2", jeton: "c" },
    ]);
  });

  it("ni l'enfant, ni un ancien membre, ni une liste abîmée", () => {
    expect(
      jetonsAPrevenir([abonne("enfant", ["e"]), abonne("parti", ["x"]), abonne("p1", "pas-une-liste"), abonne("p2", [3, ""])], FOYER),
    ).toEqual([]);
  });
});

function deps(o: Partial<Dependances> & { erreurs?: Record<string, string> } = {}) {
  const envois: Array<{ jetons: string[]; n: Notification }> = [];
  const retraits: Array<{ uid: string; jetons: string[] }> = [];
  const d: Dependances = {
    lireConfig: async () => CONFIG,
    lireFoyer: async () => FOYER,
    lireAbonnes: async () => [abonne("p1", ["tel-1", "pc-1"]), abonne("p2", ["tel-2"])],
    envoyer: async (jetons, n) => {
      envois.push({ jetons, n });
      return jetons.map((jeton) => ({ jeton, erreur: o.erreurs?.[jeton] }));
    },
    retirerJetons: async (_id, uid, jetons) => {
      retraits.push({ uid, jetons });
    },
    ...o,
  };
  return { d, envois, retraits };
}

describe("une demande arrive", () => {
  it("tous les appareils abonnés sonnent, en un envoi", async () => {
    const { d, envois, retraits } = deps();
    const bilan = await prevenirDeLaDemande("pc", "d1", demande(), d);
    expect(bilan).toEqual({ envoyes: 3, echecs: 0, retires: 0 });
    expect(envois).toHaveLength(1);
    expect(envois[0].jetons).toEqual(["tel-1", "pc-1", "tel-2"]);
    expect(retraits).toEqual([]);
  });

  it("un téléphone désinstallé est retiré de la liste de SON parent ; une panne passagère ne retire rien", async () => {
    const { d, retraits } = deps({
      erreurs: { "pc-1": "messaging/registration-token-not-registered", "tel-2": "messaging/internal-error" },
    });
    const bilan = await prevenirDeLaDemande("pc", "d1", demande(), d);
    expect(bilan).toEqual({ envoyes: 1, echecs: 2, retires: 1 });
    expect(retraits).toEqual([{ uid: "p1", jetons: ["pc-1"] }]);
  });

  it("rien n'est envoyé pour une demande déjà décidée, un PC sans foyer, ou sans abonné", async () => {
    const a = deps();
    await prevenirDeLaDemande("pc", "d1", demande({ [CHAMP_DEMANDE.statut]: VALEUR.statutDemande.acceptee }), a.d);
    const b = deps({ lireConfig: async () => ({}) });
    await prevenirDeLaDemande("pc", "d1", demande(), b.d);
    const c = deps({ lireAbonnes: async () => [] });
    expect((await prevenirDeLaDemande("pc", "d1", demande(), c.d)).raison).toBe("aucun abonné");
    expect([...a.envois, ...b.envois, ...c.envois]).toEqual([]);
  });
});
