import "server-only";
import { createHash } from "node:crypto";
import { db, newId } from "../db";
import { addDays } from "../date";
import type { EventStatus, SourcePayload } from "../types";
import { AUTO_MERGE, REVIEW, detectKind, scoreMatch, type Kind, type Matchable } from "./match";

export type ExternalItem = {
  sourceId: string;
  title: string;
  notes: string;
  who: string;
  location: string;
  start: string; // YYYY-MM-DDTHH:mm (Berlin)
  end: string;
  allDay: boolean;
  status: EventStatus;
  kind: Kind;
  /** Kundinnen-/Personennamen für die Dublettenprüfung */
  names?: string[];
  /** Zielkalender, falls ein neuer Termin angelegt wird */
  calendar: { name: string; color: string; sourceKey?: string; hidden?: boolean };
  url: string | null;
  payload: SourcePayload;
};

export type SourceResult = {
  items: ExternalItem[];
  /** true, wenn das Fenster vollständig geladen wurde (dann dürfen verschwundene Einträge entfernt werden) */
  complete: boolean;
  windowStart: string; // YYYY-MM-DD
  windowEnd: string;
  note?: string;
};

export type SyncStats = {
  source: string;
  fetched: number;
  created: number;
  updated: number;
  matched: number;
  review: number;
  removed: number;
  ok: boolean;
  message?: string;
};

type Row = Record<string, unknown>;
type Q = import("@neondatabase/serverless").NeonQueryPromise<false, false, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const multiLink = (item: ExternalItem) => item.kind === "theater" || Boolean(item.calendar.hidden);

const hashOf = (v: unknown) => createHash("sha1").update(JSON.stringify(v)).digest("hex");

type WindowEvent = Matchable & { id: string; sources: Set<string> };

export async function applySource(source: string, result: SourceResult, dedupe = true): Promise<SyncStats> {
  const sql = db();
  const stats: SyncStats = { source, fetched: result.items.length, created: 0, updated: 0, matched: 0, review: 0, removed: 0, ok: true, message: result.note };
  const items = [...result.items].sort((a, b) => a.start.localeCompare(b.start));

  // --- bestehende Verknüpfungen dieser Quelle
  const linkRows = (await sql.query(
    `select l.source_id, l.event_id, l.hash, l.match_type, e.locally_modified, e.deleted_at,
            to_char(e.start_at, 'YYYY-MM-DD') as day
     from event_links l join events e on e.id = l.event_id where l.source = $1`,
    [source],
  )) as Row[];
  const links = new Map(linkRows.map((r) => [String(r.source_id), r]));

  // --- Kalender
  const calRows = (await sql.query("select id, name, color, source_key from calendars")) as Row[];
  const calByKey = new Map(calRows.filter((c) => c.source_key).map((c) => [String(c.source_key), String(c.id)]));
  const calByName = new Map(calRows.map((c) => [String(c.name).toLowerCase(), String(c.id)]));
  const calName = new Map(calRows.map((c) => [String(c.id), String(c.name)]));
  let sortBase = calRows.length;

  const writes: Q[] = [];

  function calendarFor(item: ExternalItem): string {
    const { name, color, sourceKey, hidden } = item.calendar;
    if (sourceKey && calByKey.has(sourceKey)) {
      const id = calByKey.get(sourceKey)!;
      return id;
    }
    const byName = calByName.get(name.toLowerCase());
    if (byName) {
      if (sourceKey) {
        calByKey.set(sourceKey, byName);
        writes.push(sql.query("update calendars set source_key=$2 where id=$1 and source_key is null", [byName, sourceKey]));
      }
      return byName;
    }
    const id = newId();
    sortBase += 1;
    writes.push(sql.query(
      "insert into calendars (id, name, color, sort_order, source_key, visible) values ($1,$2,$3,$4,$5,$6) on conflict do nothing",
      [id, name, color, sortBase, sourceKey ?? null, !hidden],
    ));
    calByName.set(name.toLowerCase(), id);
    calName.set(id, name);
    if (sourceKey) calByKey.set(sourceKey, id);
    return id;
  }

  // --- Kandidaten im Zeitfenster
  let windowEvents: WindowEvent[] = [];
  if (dedupe && items.length) {
    const from = addDays(items[0].start.slice(0, 10), -2);
    const to = addDays(items.reduce((m, i) => (i.end > m ? i.end : m), items[0].end).slice(0, 10), 2);
    const rows = (await sql.query(
      `select e.id, e.title, e.who, e.location, e.all_day, e.calendar_id,
              to_char(e.start_at, 'YYYY-MM-DD"T"HH24:MI') as start, to_char(e.end_at, 'YYYY-MM-DD"T"HH24:MI') as "end",
              coalesce((select array_agg(l.source) from event_links l where l.event_id = e.id), '{}') as sources
       from events e
       where e.deleted_at is null and e.start_at < $2::date and e.end_at >= $1::date`,
      [from, to],
    )) as Row[];
    windowEvents = rows.map((r) => {
      const cn = calName.get(String(r.calendar_id)) ?? "";
      return {
        id: String(r.id),
        title: String(r.title),
        who: String(r.who ?? ""),
        location: String(r.location ?? ""),
        start: String(r.start),
        end: String(r.end),
        allDay: Boolean(r.all_day),
        calendarName: cn,
        kind: detectKind(`${r.title} ${r.who}`, cn),
        sources: new Set((r.sources as string[]) ?? []),
      };
    });
  }

  const seen = new Set<string>();
  const fresh: { item: ExternalItem; hash: string }[] = [];

  for (const item of items) {
    if (seen.has(item.sourceId)) continue;
    seen.add(item.sourceId);
    const hash = hashOf([item.title, item.notes, item.who, item.location, item.start, item.end, item.allDay, item.status, item.payload, item.url]);
    const link = links.get(item.sourceId);

    if (link) {
      if (link.hash === hash) {
        writes.push(sql.query("update event_links set last_seen_at = now() where source=$1 and source_id=$2", [source, item.sourceId]));
        continue;
      }
      writes.push(sql.query(
        "update event_links set hash=$3, url=$4, payload=$5::jsonb, last_seen_at=now() where source=$1 and source_id=$2",
        [source, item.sourceId, hash, item.url, JSON.stringify(item.payload)],
      ));
      if (!link.deleted_at && link.match_type === "created" && !link.locally_modified) {
        writes.push(sql.query(
          `update events set title=$2, notes=$3, who=$4, location=$5, start_at=$6, end_at=$7, all_day=$8, status=$9, updated_at=now()
           where id=$1`,
          [link.event_id, item.title, item.notes, item.who, item.location, item.start, item.end, item.allDay, item.status],
        ));
      } else if (!link.deleted_at) {
        writes.push(sql.query("update events set updated_at=now() where id=$1", [link.event_id]));
      }
      stats.updated++;
      continue;
    }

    fresh.push({ item, hash });
  }

  // --- Neue Einträge: alle Kandidaten-Paare bewerten und global nach Punktzahl zuordnen
  // (sonst "stiehlt" ein früher Eintrag wie "Tagesdienst" den Termin, der eigentlich zur Vorstellung gehört)
  type Pair = { i: number; ev: WindowEvent; score: number; reason: string };
  const pairs: Pair[] = [];
  if (dedupe) {
    fresh.forEach(({ item }, i) => {
      for (const ev of windowEvents) {
        // pro Termin nur ein Eintrag je Quelle – außer bei Theaterdiensten (Tagesdienst + Vorstellung = ein Eintrag bei Lena) und Verfügbarkeits-Markern
        if (ev.sources.has(source) && !multiLink(item)) continue;
        const m = scoreMatch(item, ev);
        if (m.score >= REVIEW) pairs.push({ i, ev, score: m.score, reason: m.reason });
      }
    });
    pairs.sort((a, b) => b.score - a.score);
  }
  const assigned = new Map<number, Pair>();
  for (const p of pairs) {
    if (p.score < AUTO_MERGE || assigned.has(p.i) || (p.ev.sources.has(source) && !multiLink(fresh[p.i].item))) continue;
    assigned.set(p.i, p);
    p.ev.sources.add(source);
  }
  const reviewPair = new Map<number, Pair>();
  for (const p of pairs) if (!assigned.has(p.i) && !reviewPair.has(p.i)) reviewPair.set(p.i, p);

  fresh.forEach(({ item, hash }, i) => {
    const match = assigned.get(i);
    if (match) {
      writes.push(sql.query(
        `insert into event_links (source, source_id, event_id, hash, url, match_type, match_score, match_reason, payload)
         values ($1,$2,$3,$4,$5,'matched',$6,$7,$8::jsonb) on conflict (source, source_id) do nothing`,
        [source, item.sourceId, match.ev.id, hash, item.url, match.score, match.reason, JSON.stringify(item.payload)],
      ));
      // Leere Felder ergänzen – nichts überschreiben, was Lena selbst eingetragen hat
      writes.push(sql.query(
        `update events set who = case when who = '' then $2 else who end,
           location = case when location = '' then $3 else location end,
           title = case when title in ('', '(ohne Titel)') then $4 else title end, updated_at = now() where id = $1`,
        [match.ev.id, item.who, item.location, item.title],
      ));
      stats.matched++;
      return;
    }

    const id = newId();
    const calendarId = calendarFor(item);
    writes.push(sql.query(
      `insert into events (id, calendar_id, title, notes, who, location, start_at, end_at, all_day, status, origin)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, calendarId, item.title, item.notes, item.who, item.location, item.start, item.end, item.allDay, item.status, source],
    ));
    writes.push(sql.query(
      `insert into event_links (source, source_id, event_id, hash, url, match_type, payload)
       values ($1,$2,$3,$4,$5,'created',$6::jsonb)`,
      [source, item.sourceId, id, hash, item.url, JSON.stringify(item.payload)],
    ));
    const review = reviewPair.get(i);
    if (review) {
      writes.push(sql.query(
        `insert into duplicate_candidates (a_id, b_id, score, reason) values ($1,$2,$3,$4) on conflict do nothing`,
        [review.ev.id, id, review.score, review.reason],
      ));
      stats.review++;
    }
    stats.created++;
  });

  // --- In der Quelle verschwundene Einträge
  if (result.complete) {
    for (const [sourceId, link] of links) {
      if (seen.has(sourceId)) continue;
      const day = String(link.day);
      if (day < result.windowStart || day > result.windowEnd) continue;
      if (link.match_type === "created" && !link.locally_modified && !link.deleted_at) {
        writes.push(sql.query(
          `update events set deleted_at = now(), updated_at = now(), extra = extra || '{"removedBySource": true}'::jsonb where id = $1`,
          [link.event_id],
        ));
      }
      writes.push(sql.query("delete from event_links where source=$1 and source_id=$2", [source, sourceId]));
      stats.removed++;
    }
  }

  for (let i = 0; i < writes.length; i += 80) {
    await sql.transaction(writes.slice(i, i + 80));
  }
  return stats;
}

// ---------- Sperre gegen parallele Läufe ----------

export async function acquireLock(name: string, seconds = 240): Promise<boolean> {
  const sql = db();
  const rows = (await sql.query(
    `insert into settings (key, value) values ($1, jsonb_build_object('until', now() + make_interval(secs => $2)))
     on conflict (key) do update set value = excluded.value
       where (settings.value->>'until')::timestamptz < now()
     returning key`,
    [`lock:${name}`, seconds],
  )) as Row[];
  return rows.length > 0;
}

export async function releaseLock(name: string) {
  await db().query("delete from settings where key = $1", [`lock:${name}`]);
}

export async function recordRun(stats: SyncStats, trigger: string, startedAt: Date) {
  await db().query(
    `insert into sync_runs (source, trigger, started_at, finished_at, ok, fetched, created, updated, matched, review, removed, message)
     values ($1,$2,$3,now(),$4,$5,$6,$7,$8,$9,$10,$11)`,
    [stats.source, trigger, startedAt.toISOString(), stats.ok, stats.fetched, stats.created, stats.updated,
      stats.matched, stats.review, stats.removed, stats.message ?? null],
  );
  // Verlauf schlank halten
  await db().query(
    `delete from sync_runs where source = $1 and id not in (select id from sync_runs where source = $1 order by started_at desc limit 200)`,
    [stats.source],
  );
}
