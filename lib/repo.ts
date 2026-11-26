import "server-only";
import { db, newId } from "./db";
import type { Calendar, CalEvent, EventInput, EventStatus, DuplicatePair } from "./types";

type Row = Record<string, unknown>;

export const EVENT_COLUMNS = `
  e.id, e.calendar_id, e.title, e.notes, e.who, e.location,
  to_char(e.start_at, 'YYYY-MM-DD"T"HH24:MI') as start,
  to_char(e.end_at, 'YYYY-MM-DD"T"HH24:MI') as "end",
  e.all_day, e.status, e.origin, e.extra, e.updated_at,
  coalesce((
    select json_agg(json_build_object(
      'source', l.source, 'sourceId', l.source_id, 'url', l.url,
      'matchType', l.match_type, 'matchReason', l.match_reason, 'payload', l.payload
    ) order by l.created_at)
    from event_links l where l.event_id = e.id
  ), '[]'::json) as sources`;

export function rowToEvent(r: Row): CalEvent {
  return {
    id: String(r.id),
    calendarId: String(r.calendar_id),
    title: String(r.title ?? ""),
    notes: String(r.notes ?? ""),
    who: String(r.who ?? ""),
    location: String(r.location ?? ""),
    start: String(r.start),
    end: String(r.end),
    allDay: Boolean(r.all_day),
    status: (r.status as EventStatus) ?? "confirmed",
    origin: String(r.origin ?? "local"),
    extra: (r.extra as Record<string, unknown>) ?? {},
    sources: (r.sources as CalEvent["sources"]) ?? [],
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at ?? ""),
  };
}

function rowToCalendar(r: Row): Calendar {
  return {
    id: String(r.id),
    name: String(r.name),
    color: String(r.color),
    sortOrder: Number(r.sort_order ?? 0),
    defaultMinutes: Number(r.default_minutes ?? 60),
    sourceKey: (r.source_key as string) ?? null,
    visible: r.visible !== false,
  };
}

export async function listCalendars(): Promise<Calendar[]> {
  const rows = (await db().query(
    "select * from calendars order by sort_order, created_at",
  )) as Row[];
  return rows.map(rowToCalendar);
}

export async function listEvents(): Promise<CalEvent[]> {
  const rows = (await db().query(
    `select ${EVENT_COLUMNS} from events e where e.deleted_at is null order by e.start_at`,
  )) as Row[];
  return rows.map(rowToEvent);
}

export async function getEvent(id: string): Promise<CalEvent | null> {
  const rows = (await db().query(
    `select ${EVENT_COLUMNS} from events e where e.id = $1`,
    [id],
  )) as Row[];
  return rows[0] ? rowToEvent(rows[0]) : null;
}

const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function validateInput(body: unknown): EventInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const input: EventInput = {
    calendarId: str(b.calendarId, 100),
    title: str(b.title, 300),
    notes: str(b.notes, 10000),
    who: str(b.who, 500),
    location: str(b.location, 500),
    start: str(b.start, 16),
    end: str(b.end, 16),
    allDay: Boolean(b.allDay),
    status: ["confirmed", "tentative", "cancelled"].includes(String(b.status))
      ? (b.status as EventStatus)
      : "confirmed",
  };
  if (!input.calendarId) throw new Error("Bitte einen Kalender wählen");
  if (!input.title) throw new Error("Bitte einen Titel eingeben");
  if (!DT.test(input.start) || !DT.test(input.end)) throw new Error("Ungültige Zeitangabe");
  if (input.end < input.start) throw new Error("Ende liegt vor dem Beginn");
  if (input.allDay) {
    input.start = input.start.slice(0, 10) + "T00:00";
    input.end = input.end.slice(0, 10) + "T00:00";
    if (input.end <= input.start) {
      const d = new Date(input.start.slice(0, 10) + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + 1);
      input.end = d.toISOString().slice(0, 10) + "T00:00";
    }
  }
  return input;
}

export async function createEvent(input: EventInput): Promise<CalEvent> {
  const id = newId();
  await db().query(
    `insert into events (id, calendar_id, title, notes, who, location, start_at, end_at, all_day, status, origin)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'local')`,
    [id, input.calendarId, input.title, input.notes ?? "", input.who ?? "", input.location ?? "",
      input.start, input.end, input.allDay, input.status ?? "confirmed"],
  );
  return (await getEvent(id))!;
}

export async function updateEvent(id: string, input: EventInput): Promise<CalEvent | null> {
  await db().query(
    `update events set calendar_id=$2, title=$3, notes=$4, who=$5, location=$6, start_at=$7, end_at=$8,
       all_day=$9, status=$10, locally_modified = true, updated_at = now()
     where id = $1`,
    [id, input.calendarId, input.title, input.notes ?? "", input.who ?? "", input.location ?? "",
      input.start, input.end, input.allDay, input.status ?? "confirmed"],
  );
  return getEvent(id);
}

export async function deleteEvent(id: string): Promise<void> {
  await db().query("update events set deleted_at = now(), updated_at = now() where id = $1", [id]);
}

export async function restoreEvent(id: string): Promise<CalEvent | null> {
  await db().query("update events set deleted_at = null, updated_at = now() where id = $1", [id]);
  return getEvent(id);
}

// ---------- Kalender ----------

const PALETTE = ["#D9A282", "#FF9966", "#7F2E2C", "#76923C", "#8064A2", "#3D7EBF", "#2E9C8F", "#C2477A", "#E0B040", "#6B7280"];

export async function createCalendar(name: string, color?: string, sourceKey?: string | null): Promise<Calendar> {
  const id = newId();
  const [{ n }] = (await db().query("select coalesce(max(sort_order),0)+1 as n from calendars")) as Row[];
  const count = ((await db().query("select count(*)::int as c from calendars")) as Row[])[0].c as number;
  await db().query(
    "insert into calendars (id, name, color, sort_order, source_key) values ($1,$2,$3,$4,$5)",
    [id, name.trim().slice(0, 60), color || PALETTE[count % PALETTE.length], n, sourceKey ?? null],
  );
  const rows = (await db().query("select * from calendars where id=$1", [id])) as Row[];
  return rowToCalendar(rows[0]);
}

export async function updateCalendar(id: string, patch: { name?: string; color?: string; sortOrder?: number; defaultMinutes?: number; visible?: boolean }) {
  await db().query(
    `update calendars set
       name = coalesce($2, name), color = coalesce($3, color),
       sort_order = coalesce($4, sort_order), default_minutes = coalesce($5, default_minutes),
       visible = coalesce($6, visible),
       updated_at = now()
     where id = $1`,
    [id, patch.name?.trim().slice(0, 60) || null, patch.color || null, patch.sortOrder ?? null, patch.defaultMinutes ?? null, patch.visible ?? null],
  );
  const rows = (await db().query("select * from calendars where id=$1", [id])) as Row[];
  return rows[0] ? rowToCalendar(rows[0]) : null;
}

export async function deleteCalendar(id: string, moveTo: string | null) {
  if (moveTo) {
    await db().query("update events set calendar_id=$2, updated_at=now() where calendar_id=$1", [id, moveTo]);
  } else {
    const [{ c }] = (await db().query(
      "select count(*)::int as c from events where calendar_id=$1 and deleted_at is null", [id],
    )) as Row[];
    if (Number(c) > 0) throw new Error("Kalender enthält noch Termine – bitte Zielkalender wählen");
    await db().query("delete from events where calendar_id=$1", [id]);
  }
  await db().query("delete from calendars where id=$1", [id]);
}

// ---------- Dubletten ----------

export async function countOpenDuplicates(): Promise<number> {
  const rows = (await db().query(
    `select count(*)::int as c from duplicate_candidates d
     join events a on a.id = d.a_id and a.deleted_at is null
     join events b on b.id = d.b_id and b.deleted_at is null
     where d.status = 'open'`,
  )) as Row[];
  return Number(rows[0]?.c ?? 0);
}

export async function listDuplicates(): Promise<DuplicatePair[]> {
  const pairs = (await db().query(
    `select d.a_id, d.b_id, d.score, d.reason from duplicate_candidates d
     join events a on a.id = d.a_id and a.deleted_at is null
     join events b on b.id = d.b_id and b.deleted_at is null
     where d.status = 'open' order by a.start_at`,
  )) as Row[];
  if (!pairs.length) return [];
  const ids = [...new Set(pairs.flatMap((p) => [String(p.a_id), String(p.b_id)]))];
  const rows = (await db().query(
    `select ${EVENT_COLUMNS} from events e where e.id = any($1)`, [ids],
  )) as Row[];
  const byId = new Map(rows.map((r) => [String(r.id), rowToEvent(r)]));
  return pairs
    .filter((p) => byId.has(String(p.a_id)) && byId.has(String(p.b_id)))
    .map((p) => ({
      a: byId.get(String(p.a_id))!,
      b: byId.get(String(p.b_id))!,
      score: Number(p.score),
      reason: String(p.reason),
    }));
}

/** Verschmilzt b in a: Quellen-Links wandern zu a, leere Felder von a werden ergänzt, b wird gelöscht. */
export async function mergeEvents(keepId: string, dropId: string) {
  const sql = db();
  const [keep, drop] = await Promise.all([getEvent(keepId), getEvent(dropId)]);
  if (!keep || !drop) throw new Error("Termin nicht gefunden");
  const notes = [keep.notes, drop.notes && drop.notes !== keep.notes ? drop.notes : ""].filter(Boolean).join("\n\n");
  await sql.transaction([
    sql.query(
      `update events set who = case when who = '' then $2 else who end,
         location = case when location = '' then $3 else location end,
         notes = $4, updated_at = now() where id = $1`,
      [keepId, drop.who, drop.location, notes],
    ),
    sql.query(
      `update event_links set event_id = $1, match_type = 'manual', match_reason = 'Manuell zusammengeführt'
       where event_id = $2`,
      [keepId, dropId],
    ),
    sql.query("update events set deleted_at = now(), updated_at = now(), extra = extra || $2::jsonb where id = $1",
      [dropId, JSON.stringify({ mergedInto: keepId })]),
    sql.query(
      `update duplicate_candidates set status = 'merged'
       where (a_id = $1 and b_id = $2) or (a_id = $2 and b_id = $1)`,
      [keepId, dropId],
    ),
  ]);
}

export async function dismissDuplicate(aId: string, bId: string) {
  await db().query(
    `update duplicate_candidates set status = 'dismissed'
     where (a_id = $1 and b_id = $2) or (a_id = $2 and b_id = $1)`,
    [aId, bId],
  );
}

/** Löst eine automatische Zusammenführung: der Quell-Eintrag wird wieder ein eigener Termin. */
export async function splitLink(eventId: string, source: string, sourceId: string) {
  const sql = db();
  const rows = (await sql.query(
    "select * from event_links where event_id=$1 and source=$2 and source_id=$3", [eventId, source, sourceId],
  )) as Row[];
  const link = rows[0];
  const ev = await getEvent(eventId);
  if (!link || !ev) throw new Error("Verknüpfung nicht gefunden");
  const p = (link.payload ?? {}) as Record<string, unknown>;
  const id = newId();
  const start = typeof p.start === "string" ? p.start : ev.start;
  const end = typeof p.end === "string" ? p.end : ev.end;
  await sql.transaction([
    sql.query(
      `insert into events (id, calendar_id, title, notes, who, location, start_at, end_at, all_day, status, origin, extra)
       values ($1,$2,$3,'', '', '', $4,$5,$6,$7,$8,'{}'::jsonb)`,
      [id, ev.calendarId, String(p.title ?? ev.title), start, end, Boolean(p.allDay ?? ev.allDay), "confirmed", source],
    ),
    sql.query(
      "update event_links set event_id=$1, match_type='manual', match_reason='Manuell getrennt' where source=$2 and source_id=$3",
      [id, source, sourceId],
    ),
    sql.query(
      `insert into duplicate_candidates (a_id, b_id, score, reason, status) values ($1,$2,0,'Manuell getrennt','dismissed')
       on conflict (a_id,b_id) do update set status='dismissed'`,
      [eventId, id],
    ),
    // Hatte die getrennte Quelle Titel/Zeit vorgegeben, bekommt der ursprüngliche Termin seine eigenen Daten zurück
    sql.query(
      `update events e set
         title = coalesce(nullif(l.payload->>'title', ''), e.title),
         start_at = coalesce((l.payload->>'start')::timestamp, e.start_at),
         end_at = coalesce((l.payload->>'end')::timestamp, e.end_at),
         all_day = coalesce((l.payload->>'allDay')::boolean, e.all_day),
         updated_at = now()
       from event_links l
       where $3::boolean and e.id = $1 and l.event_id = e.id and l.match_type = 'created' and l.source <> $2`,
      [eventId, source, Boolean(link.authoritative)],
    ),
  ]);
  return getEvent(id);
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const rows = (await db().query("select value from settings where key=$1", [key])) as Row[];
  return rows[0] ? (rows[0].value as T) : null;
}

export async function setSetting(key: string, value: unknown) {
  await db().query(
    "insert into settings (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value",
    [key, JSON.stringify(value)],
  );
}
