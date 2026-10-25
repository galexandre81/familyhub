import { describe, expect, it } from "vitest";
import { parseOpenMeteoSun } from "./sunTimes";

describe("parseOpenMeteoSun", () => {
  it("extrait lever et coucher au format HH:MM", () => {
    expect(
      parseOpenMeteoSun({
        daily: { sunrise: ["2026-10-27T07:58"], sunset: ["2026-10-27T17:52"] },
      }),
    ).toEqual({ sunrise: "07:58", sunset: "17:52" });
  });

  it("renvoie null pour une entrée vide ou invalide", () => {
    expect(parseOpenMeteoSun({})).toBeNull();
    expect(parseOpenMeteoSun(null)).toBeNull();
    expect(parseOpenMeteoSun({ daily: { sunrise: [], sunset: [] } })).toBeNull();
    expect(parseOpenMeteoSun({ daily: { sunrise: ["n/a"], sunset: ["2026-10-27T17:52"] } })).toBeNull();
  });
});
