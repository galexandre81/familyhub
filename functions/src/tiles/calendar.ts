import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import * as ical from "node-ical";
import type { CalendarConfig, CalendarData, CalendarEvent } from "../types";
import { db } from "../lib/admin";
import { assertHouseholdMember } from "../lib/household";
import { rebuildSnapshotForTile } from "../snapshot/builder";

/**
 * URL iCal privée du calendrier Google familial.
 * Stockée dans Google Secret Manager. Set via :
 *   firebase functions:secrets:set CALENDAR_ICAL_URL
 */
const CALENDAR_ICAL_URL = defineSecret("CALENDAR_ICAL_URL");

function normalizeCalendarConfig(raw: Record<string, unknown>): CalendarConfig {
  const cfg = raw as Partial<CalendarConfig>;
  return {
    daysAhead: typeof cfg.daysAhead === "number" && cfg.daysAhead > 0 ? cfg.daysAhead : 21,
    maxEvents: typeof cfg.maxEvents === "number" && cfg.maxEvents > 0 ? cfg.maxEvents : 60,
  };
}

/**
 * Détecte si un VEVENT est all-day. node-ical expose `datetype === 'date'`
 * sur les valeurs DATE (sans heure), sinon DATE-TIME.
 */
function isAllDay(event: ical.VEvent): boolean {
  const dt = (event as unknown as { datetype?: string }).datetype;
  return dt === "date";
}

function safeSummary(event: ical.VEvent): string {
  const s = event.summary;
  if (typeof s === "string") return s.trim() || "(sans titre)";
  if (s && typeof (s as { val?: string }).val === "string") {
    return ((s as { val: string }).val || "").trim() || "(sans titre)";
  }
  return "(sans titre)";
}

function safeLocation(event: ical.VEvent): string | undefined {
  const l = event.location;
  if (typeof l === "string" && l.trim()) return l.trim();
  return undefined;
}

function pushEvent(
  events: CalendarEvent[],
  uid: string,
  summary: string,
  start: Date,
  end: Date,
  allDay: boolean,
  location: string | undefined,
): void {
  events.push({
    id: `${uid}-${start.toISOString()}`,
    summary,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    allDay,
    location,
  });
}

/**
 * Parse les events du flux ICS, expand les récurrences dans la fenêtre [now, now+daysAhead],
 * applique les exceptions (RECURRENCE-ID), et trie par date de début.
 */
function extractEvents(
  parsed: Record<string, ical.CalendarComponent>,
  now: Date,
  horizon: Date,
  maxEvents: number,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const key of Object.keys(parsed)) {
    const item = parsed[key];
    if (!item || item.type !== "VEVENT") continue;
    const event = item as ical.VEvent;

    const summary = safeSummary(event);
    const location = safeLocation(event);
    const allDay = isAllDay(event);

    if (event.rrule) {
      const baseStart = event.start as Date;
      const baseEnd = (event.end as Date) || baseStart;
      const duration = baseEnd.getTime() - baseStart.getTime();

      // .between() retourne les dates d'occurrences dans la fenêtre.
      const occurrences = event.rrule.between(now, horizon, true);
      const exdates = (event.exdate || {}) as Record<string, Date>;
      const recurrences = (event.recurrences || {}) as Record<string, ical.VEvent>;

      for (const occStart of occurrences) {
        const occKey = occStart.toISOString().slice(0, 10); // YYYY-MM-DD
        // Skip si exdate
        if (
          Object.values(exdates).some(
            (d) => (d as Date).toISOString().slice(0, 10) === occKey,
          )
        ) {
          continue;
        }
        // Override si recurrence-id existe
        const override = Object.values(recurrences).find(
          (r) => (r.start as Date).toISOString().slice(0, 10) === occKey,
        );
        if (override) {
          const ovStart = override.start as Date;
          const ovEnd = (override.end as Date) || new Date(ovStart.getTime() + duration);
          if (ovStart >= now && ovStart <= horizon) {
            pushEvent(
              events,
              event.uid + "-ov",
              safeSummary(override),
              ovStart,
              ovEnd,
              isAllDay(override),
              safeLocation(override),
            );
          }
          continue;
        }
        const occEnd = new Date(occStart.getTime() + duration);
        pushEvent(events, event.uid, summary, occStart, occEnd, allDay, location);
      }
    } else {
      const start = event.start as Date;
      const end = (event.end as Date) || start;
      if (!start) continue;
      if (start > horizon) continue;
      // On garde aussi les events en cours (start dans le passé mais end dans le futur)
      if (end < now) continue;
      pushEvent(events, event.uid || `${start.getTime()}`, summary, start, end, allDay, location);
    }
  }

  events.sort((a, b) => a.startISO.localeCompare(b.startISO));
  return events.slice(0, maxEvents);
}

async function buildCalendarData(
  config: CalendarConfig,
  icalUrl: string,
): Promise<CalendarData> {
  const parsed = await ical.async.fromURL(icalUrl);
  const now = new Date();
  const horizon = new Date(now.getTime() + config.daysAhead * 86400 * 1000);
  const events = extractEvents(parsed, now, horizon, config.maxEvents);
  return { events, fetchedAt: now.toISOString() };
}

export const syncCalendarTile = onCall(
  {
    region: "europe-west1",
    invoker: "public",
    secrets: [CALENDAR_ICAL_URL],
  },
  async (req) => {
    logger.info("syncCalendarTile START", { auth: req.auth?.uid, data: req.data });
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");

    const { householdId, tileId } = req.data as { householdId: string; tileId: string };
    if (!householdId || !tileId) {
      throw new HttpsError("invalid-argument", "householdId et tileId requis");
    }

    await assertHouseholdMember(uid, householdId);

    const tileSnap = await db.doc(`households/${householdId}/tiles/${tileId}`).get();
    if (!tileSnap.exists) {
      throw new HttpsError("not-found", `Tile ${tileId} introuvable`);
    }
    const tile = tileSnap.data();
    if (tile?.type !== "calendar") {
      throw new HttpsError("failed-precondition", `Tile ${tileId} n'est pas de type calendar (got ${tile?.type})`);
    }

    const config = normalizeCalendarConfig(tile.config as Record<string, unknown>);
    const url = CALENDAR_ICAL_URL.value();
    if (!url) {
      throw new HttpsError("failed-precondition", "Secret CALENDAR_ICAL_URL non configuré");
    }

    const data = await buildCalendarData(config, url);
    await rebuildSnapshotForTile(householdId, tileId, "calendar", data);
    logger.info("syncCalendarTile DONE", { eventsCount: data.events.length });

    return { success: true, eventsCount: data.events.length };
  },
);

export const scheduledCalendarRefresh = onSchedule(
  {
    schedule: "every 15 minutes",
    region: "europe-west1",
    timeZone: "Europe/Paris",
    secrets: [CALENDAR_ICAL_URL],
  },
  async () => {
    const tilesSnap = await db.collectionGroup("tiles").where("type", "==", "calendar").get();
    logger.info(`scheduledCalendarRefresh: ${tilesSnap.size} tile(s)`);

    const url = CALENDAR_ICAL_URL.value();
    if (!url) {
      logger.error("CALENDAR_ICAL_URL non configuré, skip refresh");
      return;
    }

    for (const doc of tilesSnap.docs) {
      try {
        const tileId = doc.id;
        const householdId = doc.ref.parent.parent?.id;
        if (!householdId) continue;
        const config = normalizeCalendarConfig(doc.data().config as Record<string, unknown>);
        const data = await buildCalendarData(config, url);
        await rebuildSnapshotForTile(householdId, tileId, "calendar", data);
      } catch (err) {
        logger.error(`Échec refresh calendar tile ${doc.ref.path}`, err);
      }
    }
  },
);
