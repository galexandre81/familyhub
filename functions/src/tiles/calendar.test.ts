import { describe, it, expect } from "vitest";
import * as ical from "node-ical";
import { extractEvents, icalUrlConfiguree } from "./calendar";

// Les Functions tournent en UTC. Hors UTC, rrule (via node-ical) décale les
// occurrences du décalage local : on épingle donc le fuseau de production.
// Node relit TZ à chaque affectation, avant tout calcul de date des tests.
process.env.TZ = "UTC";

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

  it("refuse ce qui n'est pas du https (URL saisie par un utilisateur)", () => {
    expect(icalUrlConfiguree("http://exemple.org/a.ics")).toBeNull();
    expect(icalUrlConfiguree("webcal://exemple.org/a.ics")).toBeNull();
    expect(icalUrlConfiguree("file:///etc/passwd")).toBeNull();
  });
});

/** Enveloppe des VEVENT dans un VCALENDAR minimal (CRLF, comme un vrai flux). */
function ics(...vevents: string[][]): ical.CalendarResponse {
  const lignes = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//FR"];
  for (const v of vevents) lignes.push("BEGIN:VEVENT", ...v, "END:VEVENT");
  lignes.push("END:VCALENDAR");
  return ical.sync.parseICS(lignes.join("\r\n"));
}

const JOUR = 86_400_000;

describe("extractEvents — récurrences", () => {
  it("garde l'all-day récurrent du jour l'après-midi", () => {
    const parsed = ics([
      "UID:anniv@test",
      "SUMMARY:Poubelles",
      "DTSTART;VALUE=DATE:20260907",
      "DTEND;VALUE=DATE:20260908",
      "RRULE:FREQ=WEEKLY;BYDAY=MO",
    ]);
    // Lundi 28.09.2026, 15:00 heure locale du process.
    const now = new Date(2026, 8, 28, 15, 0, 0);
    const events = extractEvents(parsed, now, new Date(now.getTime() + 14 * JOUR), 60);

    const aujourdhui = events.filter((e) => new Date(e.startISO).getTime() <= now.getTime());
    expect(aujourdhui).toHaveLength(1);
    expect(aujourdhui[0].summary).toBe("Poubelles");
    expect(aujourdhui[0].allDay).toBe(true);
    expect(new Date(aujourdhui[0].endISO).getTime()).toBeGreaterThan(now.getTime());
  });

  it("garde une occurrence récurrente en cours", () => {
    const parsed = ics([
      "UID:cours@test",
      "SUMMARY:Cours",
      "DTSTART:20260901T120000Z",
      "DTEND:20260901T150000Z",
      "RRULE:FREQ=DAILY",
    ]);
    const now = new Date("2026-09-28T13:00:00Z");
    const events = extractEvents(parsed, now, new Date(now.getTime() + 2 * JOUR), 60);

    expect(events[0].startISO).toBe("2026-09-28T12:00:00.000Z");
    expect(events[0].endISO).toBe("2026-09-28T15:00:00.000Z");
    // L'occurrence d'hier, terminée, n'est pas là.
    expect(events.some((e) => e.startISO.startsWith("2026-09-27"))).toBe(false);
  });

  it("montre une occurrence déplacée à sa nouvelle date, pas à l'ancienne", () => {
    const parsed = ics(
      [
        "UID:reunion@test",
        "SUMMARY:Réunion",
        "DTSTART:20260907T100000Z",
        "DTEND:20260907T110000Z",
        "RRULE:FREQ=WEEKLY",
      ],
      [
        "UID:reunion@test",
        "RECURRENCE-ID:20260928T100000Z",
        "SUMMARY:Réunion déplacée",
        "DTSTART:20260930T150000Z",
        "DTEND:20260930T160000Z",
      ],
    );
    const now = new Date("2026-09-27T08:00:00Z");
    const events = extractEvents(parsed, now, new Date(now.getTime() + 14 * JOUR), 60);

    expect(events.some((e) => e.startISO === "2026-09-28T10:00:00.000Z")).toBe(false);
    const deplacees = events.filter((e) => e.summary === "Réunion déplacée");
    expect(deplacees).toHaveLength(1);
    expect(deplacees[0].startISO).toBe("2026-09-30T15:00:00.000Z");
    // Les autres semaines restent là.
    expect(events.some((e) => e.startISO === "2026-10-05T10:00:00.000Z")).toBe(true);
  });

  it("montre une occurrence déplacée dans la fenêtre depuis une date d'origine passée, une seule fois", () => {
    const parsed = ics(
      [
        "UID:reunion@test",
        "SUMMARY:Réunion",
        "DTSTART:20260907T100000Z",
        "DTEND:20260907T110000Z",
        "RRULE:FREQ=WEEKLY",
      ],
      [
        "UID:reunion@test",
        "RECURRENCE-ID:20260921T100000Z",
        "SUMMARY:Réunion reportée",
        "DTSTART:20260929T090000Z",
        "DTEND:20260929T100000Z",
      ],
    );
    const now = new Date("2026-09-27T08:00:00Z");
    const events = extractEvents(parsed, now, new Date(now.getTime() + 14 * JOUR), 60);

    const reportees = events.filter((e) => e.summary === "Réunion reportée");
    expect(reportees).toHaveLength(1);
    expect(reportees[0].startISO).toBe("2026-09-29T09:00:00.000Z");
  });

  it("rattache une occurrence déplacée proche de minuit heure de Paris (jour UTC ≠ jour local)", () => {
    // 00:30 à Paris = 22:30Z la veille : le jour UTC et le jour local diffèrent.
    const parsed = ics(
      [
        "UID:minuit@test",
        "SUMMARY:Garde de nuit",
        "DTSTART;TZID=Europe/Paris:20260907T003000",
        "DTEND;TZID=Europe/Paris:20260907T013000",
        "RRULE:FREQ=WEEKLY",
      ],
      [
        "UID:minuit@test",
        "RECURRENCE-ID;TZID=Europe/Paris:20260928T003000",
        "SUMMARY:Garde de nuit (décalée)",
        "DTSTART;TZID=Europe/Paris:20260929T003000",
        "DTEND;TZID=Europe/Paris:20260929T013000",
      ],
    );
    const now = new Date("2026-09-26T08:00:00Z");
    const events = extractEvents(parsed, now, new Date(now.getTime() + 14 * JOUR), 60);

    // L'occurrence d'origine (28.09 00:30 Paris = 27.09 22:30Z) a disparu…
    expect(events.some((e) => e.startISO === "2026-09-27T22:30:00.000Z")).toBe(false);
    // …remplacée une seule fois par la version déplacée.
    const decalees = events.filter((e) => e.summary === "Garde de nuit (décalée)");
    expect(decalees).toHaveLength(1);
    expect(decalees[0].startISO).toBe("2026-09-28T22:30:00.000Z");
  });

  it("saute les occurrences exclues par EXDATE", () => {
    const parsed = ics([
      "UID:sport@test",
      "SUMMARY:Sport",
      "DTSTART:20260907T100000Z",
      "DTEND:20260907T110000Z",
      "RRULE:FREQ=WEEKLY",
      "EXDATE:20261005T100000Z",
    ]);
    const now = new Date("2026-09-27T08:00:00Z");
    const events = extractEvents(parsed, now, new Date(now.getTime() + 14 * JOUR), 60);

    // Fenêtre : 28.09 et 05.10 ; le 05.10 est exclu.
    expect(events.map((e) => e.startISO)).toEqual(["2026-09-28T10:00:00.000Z"]);
  });
});
