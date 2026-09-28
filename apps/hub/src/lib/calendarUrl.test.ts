import { describe, it, expect } from "vitest";
import { isValidIcalUrl } from "./calendarUrl";

describe("isValidIcalUrl", () => {
  it("accepte une adresse secrète Google en https", () => {
    expect(
      isValidIcalUrl(
        "https://calendar.google.com/calendar/ical/abc%40group.calendar.google.com/private-123/basic.ics",
      ),
    ).toBe(true);
  });

  it("tolère les espaces autour (copier-coller)", () => {
    expect(isValidIcalUrl("  https://example.com/a.ics \n")).toBe(true);
  });

  it("refuse http, webcal et le vide", () => {
    expect(isValidIcalUrl("http://example.com/a.ics")).toBe(false);
    expect(isValidIcalUrl("webcal://example.com/a.ics")).toBe(false);
    expect(isValidIcalUrl("")).toBe(false);
    expect(isValidIcalUrl("https://")).toBe(false);
  });
});
