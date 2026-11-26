import "server-only";
import { addMonths, todayBerlin } from "../../date";
import { detectKind } from "../match";
import type { ExternalItem, SourceResult } from "../engine";

// Kalender.digital stellt Termine über eine JSON-API bereit; die capabilityId aus dem
// Kalender-Link ist zugleich der Zugriffsschlüssel. Zeiten kommen als Berliner Wanduhrzeit.

const API = "https://api.kalender.digital";

type KdSub = { id: number; name: string; color: string };
type KdEvent = {
  id: string;
  start_date: string;
  end_date: string;
  title: string;
  text: string;
  who: string;
  where: string;
  subCalendars: number[];
  wholeDay: boolean;
};

async function kdFetch<T>(path: string): Promise<T> {
  // Die API drosselt parallele Zugriffe (503) – daher nacheinander und mit Wiederholung.
  let last = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${API}${path}`, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "de-DE,de;q=0.9",
        Origin: "https://kalender.digital",
        Referer: "https://kalender.digital/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
      },
      cache: "no-store",
    });
    if (res.ok) return (await res.json()) as T;
    last = res.status;
    if (res.status !== 503 && res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
  }
  throw new Error(`Kalender.digital antwortet ${last}`);
}

const toDT = (s: string) => s.slice(0, 16).replace(" ", "T");

export function kdConfigured(): boolean {
  return Boolean(process.env.KD_CAPABILITY_ID);
}

export async function fetchKalenderDigital(full = false): Promise<SourceResult> {
  const cap = process.env.KD_CAPABILITY_ID!;
  const info = await kdFetch<{ subCalendars: KdSub[]; title: string }>(`/calendar?capabilityId=${cap}`);
  const subs = new Map(info.subCalendars.map((s) => [s.id, s]));

  const today = todayBerlin();
  const windowStart = full ? "2020-01-01" : addMonths(today, -6).slice(0, 8) + "01";
  const windowEnd = addMonths(today, full ? 60 : 36);

  // In Jahres-Blöcken nacheinander laden
  const chunks: [string, string][] = [];
  for (let s = windowStart; s < windowEnd; s = addMonths(s, 12)) {
    const e = addMonths(s, 12) < windowEnd ? addMonths(s, 12) : windowEnd;
    chunks.push([s, e]);
  }
  const results: KdEvent[][] = [];
  for (const [s, e] of chunks) {
    results.push(
      await kdFetch<KdEvent[]>(
        `/event?timeZone=Europe/Berlin&startDate=${encodeURIComponent(s + " 00:00:00")}&endDate=${encodeURIComponent(e + " 00:00:00")}&capabilityId=${cap}`,
      ),
    );
  }

  const byId = new Map<string, KdEvent>();
  for (const list of results) for (const e of list) byId.set(`${e.id}|${e.start_date}`, e);

  const idCount = new Map<string, number>();
  for (const e of byId.values()) idCount.set(e.id, (idCount.get(e.id) ?? 0) + 1);

  const items: ExternalItem[] = [];
  for (const e of byId.values()) {
    const sub = subs.get(e.subCalendars[0]) ?? { id: 0, name: "Kalender.digital", color: "#6B7280" };
    const start = toDT(e.start_date);
    let end = toDT(e.end_date);
    if (end < start) end = start;
    items.push({
      // Serientermine hätten dieselbe id → Startzeit anhängen
      sourceId: (idCount.get(e.id) ?? 0) > 1 ? `${e.id}@${start}` : e.id,
      title: e.title?.trim() || "(ohne Titel)",
      notes: e.text ?? "",
      who: e.who ?? "",
      location: e.where ?? "",
      start,
      end,
      allDay: Boolean(e.wholeDay),
      status: "confirmed",
      kind: detectKind(`${e.title} ${e.who}`, sub.name),
      calendar: { name: sub.name, color: sub.color, sourceKey: `kd:${sub.id}` },
      url: `https://kalender.digital/${cap}`,
      payload: {
        label: `Kalender.digital · ${sub.name}`,
        title: e.title,
        start,
        end,
        allDay: Boolean(e.wholeDay),
      },
    });
  }
  return { items, complete: true, windowStart, windowEnd };
}
