// One-shot : sync calendar via REST API Firestore avec gcloud token (pas besoin d'ADC).
// Usage : CALENDAR_ICAL_URL="https://..." GCLOUD_TOKEN=$(gcloud auth print-access-token) \
//         node scripts/calendar-sync-now.mjs

import ical from "node-ical";

const url = process.env.CALENDAR_ICAL_URL;
const token = process.env.GCLOUD_TOKEN;
const projectId = "family-hub-guillaume";

if (!url || !token) {
  console.error("CALENDAR_ICAL_URL et GCLOUD_TOKEN requis en env");
  process.exit(1);
}

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

function isAllDay(ev) { return ev?.datetype === "date"; }
function safeSummary(ev) {
  const s = ev?.summary;
  if (typeof s === "string") return s.trim() || "(sans titre)";
  if (s?.val) return String(s.val).trim() || "(sans titre)";
  return "(sans titre)";
}
function safeLocation(ev) {
  const l = ev?.location;
  return (typeof l === "string" && l.trim()) ? l.trim() : undefined;
}

function extractEvents(parsed, now, horizon, maxEvents) {
  const events = [];
  for (const key of Object.keys(parsed)) {
    const item = parsed[key];
    if (!item || item.type !== "VEVENT") continue;
    const summary = safeSummary(item);
    const location = safeLocation(item);
    const allDay = isAllDay(item);

    if (item.rrule) {
      const baseStart = item.start;
      const baseEnd = item.end || baseStart;
      const duration = baseEnd.getTime() - baseStart.getTime();
      const occurrences = item.rrule.between(now, horizon, true);
      const exdates = item.exdate || {};
      const recurrences = item.recurrences || {};
      for (const occStart of occurrences) {
        const occKey = occStart.toISOString().slice(0, 10);
        if (Object.values(exdates).some((d) => d.toISOString().slice(0, 10) === occKey)) continue;
        const override = Object.values(recurrences).find((r) => r.start.toISOString().slice(0, 10) === occKey);
        if (override) {
          const ovStart = override.start;
          const ovEnd = override.end || new Date(ovStart.getTime() + duration);
          if (ovStart >= now && ovStart <= horizon) {
            events.push({ id: item.uid + "-ov-" + ovStart.toISOString(), summary: safeSummary(override), startISO: ovStart.toISOString(), endISO: ovEnd.toISOString(), allDay: isAllDay(override), location: safeLocation(override) });
          }
          continue;
        }
        const occEnd = new Date(occStart.getTime() + duration);
        events.push({ id: item.uid + "-" + occStart.toISOString(), summary, startISO: occStart.toISOString(), endISO: occEnd.toISOString(), allDay, location });
      }
    } else {
      const start = item.start;
      const end = item.end || start;
      if (!start) continue;
      if (start > horizon) continue;
      if (end < now) continue;
      events.push({ id: (item.uid || String(start.getTime())) + "-" + start.toISOString(), summary, startISO: start.toISOString(), endISO: end.toISOString(), allDay, location });
    }
  }
  events.sort((a, b) => a.startISO.localeCompare(b.startISO));
  return events.slice(0, maxEvents);
}

// Convert JS value to Firestore REST Value
function toFsValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
  if (typeof v === "object") {
    const fields = {};
    for (const k of Object.keys(v)) {
      if (v[k] === undefined) continue;
      fields[k] = toFsValue(v[k]);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function fromFsValue(field) {
  if (!field) return undefined;
  if ("stringValue" in field) return field.stringValue;
  if ("integerValue" in field) return parseInt(field.integerValue, 10);
  if ("doubleValue" in field) return field.doubleValue;
  if ("booleanValue" in field) return field.booleanValue;
  if ("nullValue" in field) return null;
  if ("arrayValue" in field) return (field.arrayValue.values || []).map(fromFsValue);
  if ("mapValue" in field) {
    const out = {};
    for (const k of Object.keys(field.mapValue.fields || {})) out[k] = fromFsValue(field.mapValue.fields[k]);
    return out;
  }
  return undefined;
}

async function listCalendarTilesAllHouseholds() {
  // Pas de collectionGroup query (besoin index) — on liste les households puis filtre par type.
  const hRes = await fetch(`${FS_BASE}/households`, { headers });
  if (!hRes.ok) throw new Error(`list households ${hRes.status}`);
  const hJson = await hRes.json();
  const out = [];
  for (const hDoc of (hJson.documents || [])) {
    const householdId = hDoc.name.split("/").pop();
    const tRes = await fetch(`${FS_BASE}/households/${householdId}/tiles`, { headers });
    if (!tRes.ok) continue;
    const tJson = await tRes.json();
    for (const tDoc of (tJson.documents || [])) {
      const fields = tDoc.fields || {};
      const type = fromFsValue(fields.type);
      if (type !== "calendar") continue;
      const tileId = tDoc.name.split("/").pop();
      const config = fromFsValue(fields.config) || {};
      out.push({ householdId, tileId, config });
    }
  }
  return out;
}

async function listDisplays(householdId) {
  const res = await fetch(`${FS_BASE}/households/${householdId}/displays`, { headers });
  if (!res.ok) throw new Error(`list displays ${res.status}`);
  const json = await res.json();
  return (json.documents || []).map((d) => ({
    id: d.name.split("/").pop(),
    layout: fromFsValue(d.fields?.layout) || [],
  }));
}

async function patchSnapshot(householdId, displayId, tileId, data) {
  const body = {
    fields: {
      generatedAt: { timestampValue: new Date().toISOString() },
      ttlSeconds: { integerValue: "3600" },
      tiles: {
        mapValue: {
          fields: {
            [tileId]: {
              mapValue: {
                fields: {
                  data: toFsValue(data),
                  generatedAt: { timestampValue: new Date().toISOString() },
                },
              },
            },
          },
        },
      },
    },
  };
  const params = new URLSearchParams();
  params.append("updateMask.fieldPaths", "generatedAt");
  params.append("updateMask.fieldPaths", "ttlSeconds");
  params.append("updateMask.fieldPaths", `tiles.\`${tileId}\``);
  const url2 = `${FS_BASE}/households/${householdId}/displays/${displayId}/snapshot/current?${params}`;
  const res = await fetch(url2, { method: "PATCH", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`patch snapshot ${res.status}: ${await res.text()}`);
}

(async () => {
  console.log("Fetch iCal...");
  const parsed = await ical.async.fromURL(url);
  console.log(`Parsed ${Object.keys(parsed).length} ICS items`);

  const tiles = await listCalendarTilesAllHouseholds();
  console.log(`Found ${tiles.length} calendar tile(s)`);

  for (const t of tiles) {
    const daysAhead = t.config.daysAhead > 0 ? t.config.daysAhead : 14;
    const maxEvents = t.config.maxEvents > 0 ? t.config.maxEvents : 20;
    const now = new Date();
    const horizon = new Date(now.getTime() + daysAhead * 86400 * 1000);
    const events = extractEvents(parsed, now, horizon, maxEvents);
    const data = { events, fetchedAt: now.toISOString() };

    const displays = await listDisplays(t.householdId);
    let written = 0;
    for (const d of displays) {
      if (!d.layout.some((l) => l.tileId === t.tileId)) continue;
      await patchSnapshot(t.householdId, d.id, t.tileId, data);
      written++;
    }
    console.log(`Tile ${t.householdId}/${t.tileId} (daysAhead=${daysAhead}): ${events.length} events → ${written} display(s) updated`);
    if (events.length > 0) {
      console.log(`  First event: "${events[0].summary}" @ ${events[0].startISO}`);
      console.log(`  Last event: "${events[events.length - 1].summary}" @ ${events[events.length - 1].startISO}`);
    }
  }
  console.log("DONE");
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
