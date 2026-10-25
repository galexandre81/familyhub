import { describe, it, expect } from "vitest";
import { doitUtiliserRedirection } from "./authMode";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

describe("doitUtiliserRedirection", () => {
  it("redirige quand l'application est installée (écran d'accueil)", () => {
    expect(doitUtiliserRedirection(true, WINDOWS)).toBe(true);
    expect(doitUtiliserRedirection(true, ANDROID)).toBe(true);
  });

  it("redirige sur iPhone et iPad même dans Safari", () => {
    expect(doitUtiliserRedirection(false, IPHONE)).toBe(true);
    expect(doitUtiliserRedirection(false, IPAD)).toBe(true);
  });

  it("garde la fenêtre surgissante sur ordinateur et Android dans le navigateur", () => {
    expect(doitUtiliserRedirection(false, WINDOWS)).toBe(false);
    expect(doitUtiliserRedirection(false, ANDROID)).toBe(false);
  });
});
