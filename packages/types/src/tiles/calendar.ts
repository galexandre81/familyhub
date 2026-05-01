/**
 * Tuile calendar (Google Calendar via flux iCal privé).
 *
 * L'URL ICS secrète n'apparaît jamais dans la config — elle est stockée
 * dans Firebase Secret Manager (secret `CALENDAR_ICAL_URL`) et lue
 * uniquement par la Cloud Function `syncCalendarTile`.
 */

export interface CalendarConfig {
  /** Horizon en jours pour les events à pré-charger (ex: 14). */
  daysAhead: number;
  /** Nombre max d'events à conserver dans le snapshot (ex: 20). */
  maxEvents: number;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  /** ISO 8601 — `new Date(startISO)` marche sur iOS 9. */
  startISO: string;
  endISO: string;
  /** True si "all-day" (DTSTART;VALUE=DATE). */
  allDay: boolean;
  location?: string;
}

export interface CalendarData {
  events: CalendarEvent[];
  /** ISO 8601 du dernier fetch réussi. */
  fetchedAt: string;
}

export const defaultCalendarConfig: CalendarConfig = {
  daysAhead: 21,
  maxEvents: 60,
};
