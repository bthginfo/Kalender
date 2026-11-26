import "server-only";
import { db } from "../db";
import type { SyncSourceStatus } from "../types";
import { acquireLock, applySource, recordRun, releaseLock, type SourceResult, type SyncStats } from "./engine";
import { fetchKalenderDigital, kdConfigured } from "./sources/kalenderdigital";
import { dmConfigured, fetchDigitalMask } from "./sources/digitalmask";
import { fetchWebsite, mjConfigured } from "./sources/website";

type SourceDef = {
  key: string;
  label: string;
  configured: () => boolean;
  fetch: (full: boolean) => Promise<SourceResult>;
};

// Reihenfolge ist wichtig: Kalender.digital zuerst (Lenas eigene Einträge), danach werden
// die anderen Quellen dagegen auf Dubletten geprüft.
export const SOURCES: SourceDef[] = [
  { key: "kalenderdigital", label: "Kalender.digital", configured: kdConfigured, fetch: (full) => fetchKalenderDigital(full) },
  { key: "digitalmask", label: "DigitalMask (Theater)", configured: dmConfigured, fetch: () => fetchDigitalMask() },
  { key: "mj", label: "magdalenajohanna.com", configured: mjConfigured, fetch: () => fetchWebsite() },
];

export async function runSync(opts: { trigger: string; full?: boolean; only?: string } = { trigger: "manual" }) {
  const got = await acquireLock("sync");
  if (!got) return { ok: false, busy: true, results: [] as SyncStats[] };
  const results: SyncStats[] = [];
  try {
    for (const src of SOURCES) {
      if (opts.only && opts.only !== src.key) continue;
      if (!src.configured()) continue;
      const started = new Date();
      let stats: SyncStats;
      try {
        const data = await src.fetch(Boolean(opts.full));
        stats = await applySource(src.key, data, true);
      } catch (err) {
        console.error(`[sync] ${src.key} fehlgeschlagen`, err);
        stats = {
          source: src.key, fetched: 0, created: 0, updated: 0, matched: 0, review: 0, removed: 0,
          ok: false, message: err instanceof Error ? err.message.slice(0, 500) : String(err),
        };
      }
      results.push(stats);
      await recordRun(stats, opts.trigger, started);
    }
  } finally {
    await releaseLock("sync");
  }
  return { ok: results.every((r) => r.ok), busy: false, results };
}

export async function syncStatus(): Promise<SyncSourceStatus[]> {
  const rows = (await db().query(
    `select distinct on (source) source, started_at, finished_at, ok, fetched, created, updated, matched, review, removed, message
     from sync_runs order by source, started_at desc`,
  )) as Record<string, unknown>[];
  const bySource = new Map(rows.map((r) => [String(r.source), r]));
  return SOURCES.map((s) => {
    const r = bySource.get(s.key);
    return {
      source: s.key,
      label: s.label,
      configured: s.configured(),
      lastRun: r
        ? {
            startedAt: new Date(String(r.started_at)).toISOString(),
            finishedAt: r.finished_at ? new Date(String(r.finished_at)).toISOString() : null,
            ok: r.ok as boolean | null,
            fetched: Number(r.fetched), created: Number(r.created), updated: Number(r.updated),
            matched: Number(r.matched), review: Number(r.review), removed: Number(r.removed),
            message: (r.message as string) ?? null,
          }
        : null,
    };
  });
}
