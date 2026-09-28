import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as ical from "node-ical";
import type { CalendarConfig, CalendarData, CalendarEvent } from "../types";
import { db } from "../lib/admin";
import { assertHouseholdMember } from "../lib/household";
import { requireId } from "../lib/validate";
import { rebuildSnapshotForTile } from "../snapshot/builder";

/** Délai réseau maximal pour récupérer un flux ICS. */
const ICS_FETCH_TIMEOUT_MS = 10_000;
/** Taille maximale acceptée pour un flux ICS (10 Mo). */
const ICS_MAX_OCTETS = 10 * 1024 * 1024;

/**
 * Normalise la valeur `icalUrl` lue dans `households/{hid}/private/calendar`.
 *
 * L'URL iCal privée est propre à CHAQUE foyer (écrite par ses membres depuis
 * le hub, illisible par les displays) : il n'y a plus de secret global, qui
 * servait le calendrier du propriétaire à n'importe quel foyer.
 *
 * Seul le https est accepté : l'URL est désormais saisie par un utilisateur
 * et c'est la Function qui la télécharge. Toute autre valeur (vide, « aucun »,
 * http, webcal…) vaut « calendrier non configuré ».
 */
export function icalUrlConfiguree(valeur: string | undefined): string | null {
  const url = (valeur ?? "").trim();
  return /^https:\/\//i.test(url) ? url : null;
}

/** Lit l'URL iCal du foyer (Admin SDK). `null` si absente ou invalide. */
async function lireIcalUrlFoyer(householdId: string): Promise<string | null> {
  const snap = await db.doc(`households/${householdId}/private/calendar`).get();
  const valeur = snap.data()?.icalUrl;
  return icalUrlConfiguree(typeof valeur === "string" ? valeur : undefined);
}

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

/** Clé de jour utilisée par node-ical pour `exdate` et `recurrences` (date UTC YYYY-MM-DD). */
function cleJour(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Parse les events du flux ICS, expand les récurrences dans la fenêtre [now, horizon],
 * applique les exceptions (EXDATE, RECURRENCE-ID), et trie par date de début.
 *
 * Un event (récurrent ou non) est gardé tant qu'il n'est pas terminé : un
 * all-day du jour reste visible l'après-midi, un rendez-vous en cours aussi.
 */
export function extractEvents(
  parsed: ical.CalendarResponse,
  now: Date,
  horizon: Date,
  maxEvents: number,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const pasTermine = (start: Date, end: Date) =>
    end.getTime() > now.getTime() && start.getTime() <= horizon.getTime();

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

      // La fenêtre démarre `duration` avant now : une occurrence commencée
      // (all-day du jour dès 02:00 Paris, event en cours) doit rester visible.
      const occurrences = event.rrule.between(new Date(now.getTime() - duration), horizon, true);
      const exdates = Object.values((event.exdate || {}) as Record<string, Date>).filter(
        (d) => d instanceof Date,
      );
      const exdateTemps = new Set(exdates.map((d) => d.getTime()));
      const exdateJours = new Set(exdates.map(cleJour));
      const estExclue = (d: Date) => exdateTemps.has(d.getTime()) || exdateJours.has(cleJour(d));

      // Les occurrences déplacées se rattachent à leur date D'ORIGINE
      // (RECURRENCE-ID), pas à leur nouvelle date. On ne dépend pas du format
      // des clés de `event.recurrences`, qui a changé entre versions de
      // node-ical (0.27 range chaque override sous DEUX clés, jour local du
      // fuseau et ISO) : on indexe nous-mêmes par l'instant exact de
      // RECURRENCE-ID, avec le jour UTC en repli.
      const overrides = Array.from(
        new Set(Object.values((event.recurrences || {}) as Record<string, ical.VEvent>)),
      ).filter((o) => o?.start instanceof Date);
      const overrideParTemps = new Map<number, ical.VEvent>();
      const overrideParJour = new Map<string, ical.VEvent>();
      for (const o of overrides) {
        const rid = (o as unknown as { recurrenceid?: Date }).recurrenceid;
        if (!(rid instanceof Date)) continue;
        overrideParTemps.set(rid.getTime(), o);
        overrideParJour.set(cleJour(rid), o);
      }
      const overridesTraites = new Set<ical.VEvent>();

      const pushOverride = (override: ical.VEvent) => {
        const ovStart = override.start as Date;
        const ovEnd = (override.end as Date) || new Date(ovStart.getTime() + duration);
        if (pasTermine(ovStart, ovEnd)) {
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
      };

      for (const occStart of occurrences) {
        if (estExclue(occStart)) continue;
        const override =
          overrideParTemps.get(occStart.getTime()) ?? overrideParJour.get(cleJour(occStart));
        if (override) {
          if (!overridesTraites.has(override)) {
            overridesTraites.add(override);
            pushOverride(override);
          }
          continue;
        }
        const occEnd = new Date(occStart.getTime() + duration);
        if (occEnd.getTime() <= now.getTime()) continue;
        pushEvent(events, event.uid, summary, occStart, occEnd, allDay, location);
      }

      // Occurrences déplacées DANS la fenêtre depuis une date d'origine hors
      // fenêtre (ex. réunion de la semaine dernière reportée à demain).
      for (const override of overrides) {
        if (overridesTraites.has(override)) continue;
        const rid = (override as unknown as { recurrenceid?: Date }).recurrenceid;
        if (rid instanceof Date && estExclue(rid)) continue;
        overridesTraites.add(override);
        pushOverride(override);
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
  // fetch + parse plutôt que `ical.async.fromURL`, qui n'a pas de délai :
  // un serveur ICS muet bloquait la Function jusqu'à son timeout.
  const res = await fetch(icalUrl, { signal: AbortSignal.timeout(ICS_FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`Flux ICS : HTTP ${res.status}`);
  }
  // Garde-fou mémoire : un agenda familial pèse quelques centaines de Ko.
  const longueur = Number(res.headers.get("content-length") ?? 0);
  if (longueur > ICS_MAX_OCTETS) {
    throw new Error(`Flux ICS trop gros (${longueur} octets)`);
  }
  const texte = await res.text();
  if (texte.length > ICS_MAX_OCTETS) {
    throw new Error(`Flux ICS trop gros (${texte.length} caractères)`);
  }
  const parsed = ical.sync.parseICS(texte);
  const now = new Date();
  const horizon = new Date(now.getTime() + config.daysAhead * 86400 * 1000);
  const events = extractEvents(parsed, now, horizon, config.maxEvents);
  return { events, fetchedAt: now.toISOString() };
}

export const syncCalendarTile = onCall(
  {
    region: "europe-west1",
    invoker: "public",
  },
  async (req) => {
    logger.info("syncCalendarTile START", { auth: req.auth?.uid, data: req.data });
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Auth requise");

    const input = (req.data ?? {}) as { householdId?: unknown; tileId?: unknown };
    const householdId = requireId(input.householdId, "householdId");
    const tileId = requireId(input.tileId, "tileId");

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
    const url = await lireIcalUrlFoyer(householdId);
    if (!url) {
      throw new HttpsError("failed-precondition", "URL iCal non configurée pour ce foyer");
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
  },
  async () => {
    const tilesSnap = await db.collectionGroup("tiles").where("type", "==", "calendar").get();
    logger.info(`scheduledCalendarRefresh: ${tilesSnap.size} tile(s)`);

    // Groupé par foyer : l'URL iCal est lue une seule fois par foyer.
    const byHousehold = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    for (const doc of tilesSnap.docs) {
      const householdId = doc.ref.parent.parent?.id;
      if (!householdId) continue;
      const list = byHousehold.get(householdId) ?? [];
      list.push(doc);
      byHousehold.set(householdId, list);
    }

    for (const [householdId, docs] of byHousehold) {
      let url: string | null;
      try {
        url = await lireIcalUrlFoyer(householdId);
      } catch (err) {
        logger.error(`Lecture URL iCal impossible pour le foyer ${householdId}`, err);
        continue;
      }
      if (!url) {
        logger.info(`Foyer ${householdId} : URL iCal non configurée, skip`);
        continue;
      }
      for (const doc of docs) {
        try {
          const config = normalizeCalendarConfig(doc.data().config as Record<string, unknown>);
          const data = await buildCalendarData(config, url);
          await rebuildSnapshotForTile(householdId, doc.id, "calendar", data);
        } catch (err) {
          logger.error(`Échec refresh calendar tile ${doc.ref.path}`, err);
        }
      }
    }
  },
);
