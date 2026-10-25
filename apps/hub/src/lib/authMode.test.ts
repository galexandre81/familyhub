import { describe, it, expect } from "vitest";
import { doitUtiliserRedirection } from "./authMode";

const SITE = "<PROJECT_ID>.web.app";
const FIREBASEAPP = "<PROJECT_ID>.firebaseapp.com";

describe("doitUtiliserRedirection", () => {
  it("redirige quand l'app est installée et que l'authentification passe par le domaine du site", () => {
    expect(doitUtiliserRedirection(true, SITE, SITE)).toBe(true);
  });

  it("garde la fenêtre surgissante tant que authDomain est un autre domaine (firebaseapp.com)", () => {
    expect(doitUtiliserRedirection(true, FIREBASEAPP, SITE)).toBe(false);
    expect(doitUtiliserRedirection(true, "", SITE)).toBe(false);
  });

  it("garde la fenêtre surgissante dans le navigateur, quel que soit l'appareil", () => {
    expect(doitUtiliserRedirection(false, SITE, SITE)).toBe(false);
    expect(doitUtiliserRedirection(false, FIREBASEAPP, SITE)).toBe(false);
  });

  it("ignore la casse du domaine", () => {
    expect(doitUtiliserRedirection(true, "<PROJECT_ID>.web.app", SITE)).toBe(true);
  });
});
