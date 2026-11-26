import "server-only";
import { externalDb } from "../../db";
import { addDays, diffDays, instantToBerlin, todayBerlin } from "../../date";
import type { ExternalItem, SourceResult } from "../engine";

// DigitalMask = Arbeitsplattform der Maske am Stadttheater Ingolstadt.
// Relevant für Lena: Kalendereinträge (kind='events'), bei denen sie in participantIds steht
// (dieselbe Regel nutzt DigitalMask für "Mein Kalender"), ihre offenen Aufgaben mit Fälligkeit
// und ihre noch offenen Freiwünsche. Es wird ausschließlich gelesen.

const BASE = "https://digitalmask.vercel.app";
const THEATER = { name: "Theater", color: "#8064A2" };
// Freie Tage (Ruhetag, Feiertag, Urlaub …) in einen eigenen, helleren Kalender, damit sie die Ansicht nicht dominieren
const THEATER_FREE = { name: "Theater · frei", color: "#C9B8E3" };
const FREE_NAMES = /^(ruhetag|feiertag|urlaub|hft|abf|absent|frei|freier tag|halber freier tag)$/i;
// Diese Kategorien will Lena nicht im Kalender (überschreibbar per Env, kommagetrennt).
// Bereits importierte Einträge entfernt der nächste Abgleich automatisch.
const SKIP_CATEGORIES = new Set(
  (process.env.DIGITALMASK_SKIP_CATEGORIES ?? "Ruhetag,ABF,HFT").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
);

type Row = Record<string, unknown>;

export function dmConfigured(): boolean {
  return Boolean(process.env.DIGITALMASK_DATABASE_URL && process.env.DIGITALMASK_USER_ID);
}

export async function fetchDigitalMask(): Promise<SourceResult> {
  const sql = externalDb(process.env.DIGITALMASK_DATABASE_URL!);
  const uid = process.env.DIGITALMASK_USER_ID!;
  const dept = process.env.DIGITALMASK_DEPARTMENT_ID || "maske";
  const today = todayBerlin();
  const windowStart = addDays(today, -60);
  const windowEnd = addDays(today, 400);

  const [events, tasks, leaves] = await Promise.all([
    sql.query(
      `WITH cats AS (
         SELECT CASE WHEN data->>'key'='sick' THEN 'absent' ELSE data->>'key' END AS key,
                data->>'name' AS name, coalesce((data->>'allDay')::boolean,false) AS all_day
         FROM records WHERE department_id=$2 AND kind='calendarCategories')
       SELECT e.id,
         to_char(e.start_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_utc,
         to_char(e.end_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end_utc,
         coalesce((e.data->>'allDay')::boolean,false) OR coalesce(c.all_day,false) AS all_day,
         nullif(trim(e.data->>'title'),'') AS own_title,
         coalesce(c.name, e.data->>'category') AS category_name,
         coalesce(c.key, e.data->>'category') AS category_key,
         e.data->>'location' AS location,
         coalesce(e.data->>'recurrence','none') AS recurrence,
         nullif(e.data->>'until','') AS until_day,
         coalesce(e.data->'exceptions','[]'::jsonb) AS exception_days,
         (SELECT string_agg(u.name, ', ' ORDER BY u.name) FROM jsonb_array_elements_text(e.data->'participantIds') x(pid)
            JOIN app_user u ON u.id = x.pid WHERE x.pid <> $1) AS others,
         nullif(trim(p.data->>'title'),'') AS production_title,
         nullif(e.data->>'leaveId','') AS leave_id,
         e.production_id
       FROM records e
       LEFT JOIN cats c ON c.key = CASE WHEN e.data->>'category'='sick' THEN 'absent' ELSE e.data->>'category' END
       LEFT JOIN records p ON p.id = e.production_id AND p.kind='productions' AND p.department_id = e.department_id
       WHERE e.department_id=$2 AND e.kind='events'
         AND e.data->'participantIds' @> jsonb_build_array($1::text)
         AND e.start_at < $4::date + 1
         AND (e.end_at >= $3::date
              OR (e.data->>'recurrence' IN ('daily','weekly')
                  AND (coalesce(e.data->>'until','')='' OR e.data->>'until' >= $3::text)))`,
      [uid, dept, windowStart, windowEnd],
    ) as Promise<Row[]>,
    sql.query(
      `SELECT t.id, t.data->>'title' AS title, t.data->>'description' AS description, left(t.data->>'due',10) AS due_day,
              t.data->>'status' AS status, t.data->>'priority' AS priority, t.production_id,
              nullif(trim(p.data->>'title'),'') AS production_title
       FROM records t LEFT JOIN records p ON p.id=t.production_id AND p.kind='productions'
       WHERE t.department_id=$2 AND t.kind='tasks'
         AND t.data->'assigneeIds' @> jsonb_build_array($1::text)
         AND t.data->>'due' ~ '^\\d{4}-\\d{2}-\\d{2}'
         AND coalesce(t.data->>'status','') <> 'done'
         AND left(t.data->>'due',10) BETWEEN $3 AND $4`,
      [uid, dept, windowStart, windowEnd],
    ) as Promise<Row[]>,
    sql.query(
      `SELECT id, data->>'start' AS first_day, data->>'end' AS last_day, data->>'reason' AS reason
       FROM records WHERE department_id=$2 AND kind='leave' AND owner_id=$1 AND data->>'status'='pending'
         AND data->>'end' >= $3`,
      [uid, dept, windowStart],
    ) as Promise<Row[]>,
  ]);

  const items: ExternalItem[] = [];

  for (const r of events) {
    const id = String(r.id);
    const category = String(r.category_name ?? "Termin");
    if (SKIP_CATEGORIES.has(category.trim().toLowerCase())) continue;
    // Kategorie-Schlüssel wurden in DigitalMask teils umbenannt (z. B. absence = "HP2") → nach Namen entscheiden
    const free = FREE_NAMES.test(category.trim());
    const production = r.production_title ? String(r.production_title) : "";
    const own = r.own_title ? String(r.own_title) : "";
    let title = production ? `${production} – ${category}` : own || category;
    if (production && own && own !== production && own !== title) title += ` · ${own}`;
    const allDay = Boolean(r.all_day);
    const start = instantToBerlin(String(r.start_utc));
    const end = instantToBerlin(String(r.end_utc));
    const others = r.others ? String(r.others) : "";
    const location = r.location ? String(r.location) : "";
    const leaveId = r.leave_id ? String(r.leave_id) : "";

    const details = [
      { label: "Kategorie", value: category },
      ...(production ? [{ label: "Produktion", value: production }] : []),
      ...(others ? [{ label: "Mit", value: others }] : []),
      ...(location ? [{ label: "Ort", value: location }] : []),
    ];

    const base = {
      title,
      notes: "",
      who: others,
      location,
      allDay,
      status: "confirmed" as const,
      kind: leaveId || free ? ("leave" as const) : ("theater" as const),
      // Theaterdienste: DigitalMask hat die korrekten Zeiten und gewinnt gegenüber Kalender.digital
      authoritative: !leaveId && !free,
      names: [production, own].filter(Boolean),
      calendar: free ? THEATER_FREE : THEATER,
    };

    const recurrence = String(r.recurrence);
    if (recurrence === "daily" || recurrence === "weekly") {
      const step = recurrence === "daily" ? 1 : 7;
      const startDay = start.slice(0, 10);
      const spanDays = diffDays(startDay, end.slice(0, 10));
      const until = r.until_day ? String(r.until_day) : windowEnd;
      const last = until < windowEnd ? until : windowEnd;
      const exceptions = new Set((r.exception_days as string[]) ?? []);
      let n = 0;
      for (let d = startDay; d <= last && n < 800; d = addDays(d, step), n++) {
        if (exceptions.has(d) || d < windowStart) continue;
        const occStart = `${d}T${start.slice(11)}`;
        const occEnd = `${addDays(d, spanDays)}T${end.slice(11)}`;
        items.push({
          ...base,
          sourceId: `ev:${id}:${d}`,
          start: occStart,
          end: occEnd,
          url: `${BASE}/?module=calendar&record=${id}&view=day&date=${d}`,
          payload: { label: `DigitalMask · ${category}`, title, start: occStart, end: occEnd, allDay, details: [...details, { label: "Serie", value: recurrence === "daily" ? "täglich" : "wöchentlich" }] },
        });
      }
    } else {
      items.push({
        ...base,
        sourceId: `ev:${id}`,
        start,
        end,
        url: `${BASE}/?module=calendar&record=${id}&view=day&date=${start.slice(0, 10)}`,
        payload: { label: `DigitalMask · ${category}`, title, start, end, allDay, details },
      });
    }
  }

  for (const t of tasks) {
    const day = String(t.due_day);
    const production = t.production_title ? String(t.production_title) : "";
    const title = `Aufgabe: ${String(t.title ?? "").trim() || "ohne Titel"}`;
    const url = t.production_id
      ? `${BASE}/?module=productions&productionId=${t.production_id}&tab=tasks&record=${t.id}`
      : `${BASE}/?module=tasks&record=${t.id}`;
    items.push({
      sourceId: `task:${t.id}`,
      title,
      notes: String(t.description ?? ""),
      who: "",
      location: "",
      start: `${day}T00:00`,
      end: `${addDays(day, 1)}T00:00`,
      allDay: true,
      status: "tentative",
      kind: "task",
      names: [String(t.title ?? "")],
      calendar: THEATER,
      url,
      payload: {
        label: "DigitalMask · Aufgabe",
        title,
        start: `${day}T00:00`,
        end: `${addDays(day, 1)}T00:00`,
        allDay: true,
        status: String(t.status ?? ""),
        details: [
          { label: "Fällig", value: day.split("-").reverse().join(".") },
          { label: "Status", value: String(t.status ?? "") },
          ...(t.priority ? [{ label: "Priorität", value: String(t.priority) }] : []),
          ...(production ? [{ label: "Produktion", value: production }] : []),
        ],
      },
    });
  }

  for (const l of leaves) {
    const first = String(l.first_day).slice(0, 10);
    const last = String(l.last_day).slice(0, 10);
    const title = "Freiwunsch (noch offen)";
    items.push({
      sourceId: `leave:${l.id}`,
      title,
      notes: String(l.reason ?? ""),
      who: "",
      location: "",
      start: `${first}T00:00`,
      end: `${addDays(last, 1)}T00:00`,
      allDay: true,
      status: "tentative",
      kind: "leave",
      names: [],
      calendar: THEATER,
      url: `${BASE}/?module=calendar&leaveId=${l.id}`,
      payload: {
        label: "DigitalMask · Freiwunsch",
        title,
        start: `${first}T00:00`,
        end: `${addDays(last, 1)}T00:00`,
        allDay: true,
        status: "pending",
        details: l.reason ? [{ label: "Grund", value: String(l.reason) }] : [],
      },
    });
  }

  return { items, complete: true, windowStart, windowEnd };
}
