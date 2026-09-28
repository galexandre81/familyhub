import { describe, it, expect } from "vitest";
import { icalUrlConfiguree } from "./calendar";

describe("icalUrlConfiguree", () => {
  it("accepte une URL iCal https", () => {
    const url = "https://calendar.google.com/calendar/ical/abc/private-xyz/basic.ics";
    expect(icalUrlConfiguree(url)).toBe(url);
  });

  it("retire les espaces autour de l'URL", () => {
    expect(icalUrlConfiguree("  https://exemple.org/a.ics\n")).toBe("https://exemple.org/a.ics");
  });

  it("traite la valeur bidon de l'installation comme non configurée", () => {
    expect(icalUrlConfiguree("aucun")).toBeNull();
  });

  it("traite l'absence de valeur comme non configurée", () => {
    expect(icalUrlConfiguree("")).toBeNull();
    expect(icalUrlConfiguree(undefined)).toBeNull();
  });
});
