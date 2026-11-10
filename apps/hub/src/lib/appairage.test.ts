import { describe, expect, it } from "vitest";
import { phrasesAppairage } from "./appairage";

describe("phrasesAppairage", () => {
  it("iPad : Safari, QR code proposé, avertissement sur l'iPad", () => {
    const p = phrasesAppairage("ipad");
    expect(p.navigateur).toBe("Safari");
    expect(p.qr).toBe(true);
    expect(p.avertissement).toContain("uniquement sur l'iPad");
  });

  it("ordinateur : Chrome, pas de QR code, jamais Safari, AirDrop ni iPad", () => {
    const p = phrasesAppairage("ordinateur");
    expect(p.navigateur).toBe("Chrome");
    expect(p.qr).toBe(false);
    for (const t of Object.values(p)) {
      if (typeof t === "string") expect(t).not.toMatch(/Safari|AirDrop|iPad/);
    }
    expect(p.avertissement).toContain("uniquement sur l'ordinateur des enfants");
  });
});
