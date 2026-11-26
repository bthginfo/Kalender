"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { fmtDayLong } from "@/lib/date";
import type { Calendar, CalEvent } from "@/lib/types";
import EventCard from "./EventCard";
import Sheet from "./Sheet";
import { IconSearch } from "./icons";

type Props = {
  events: CalEvent[];
  calById: Map<string, Calendar>;
  today: string;
  dark: boolean;
  onEventTap: (ev: CalEvent) => void;
  onClose: () => void;
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");

export default function SearchSheet({ events, calById, today, dark, onEventTap, onClose }: Props) {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 300); }, []);

  const results = useMemo(() => {
    const terms = norm(dq).split(/\s+/).filter(Boolean);
    if (!terms.length) return { upcoming: [], past: [] };
    const hits = events.filter((ev) => {
      const hay = norm(`${ev.title} ${ev.who} ${ev.location} ${ev.notes} ${calById.get(ev.calendarId)?.name ?? ""} ${ev.sources.map((s) => `${s.payload?.title ?? ""} ${(s.payload?.details ?? []).map((d) => d.value).join(" ")}`).join(" ")}`);
      return terms.every((t) => hay.includes(t));
    });
    const upcoming = hits.filter((e) => e.end.slice(0, 10) >= today).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 80);
    const past = hits.filter((e) => e.end.slice(0, 10) < today).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 80);
    return { upcoming, past };
  }, [dq, events, calById, today]);

  const section = (title: string, list: CalEvent[]) =>
    list.length > 0 && (
      <>
        <div className="section-title">{title}</div>
        {list.map((ev, i) => (
          <div key={ev.id}>
            <div className="tiny" style={{ margin: "8px 6px 4px", fontWeight: 650 }}>{fmtDayLong(ev.start.slice(0, 10))}</div>
            <EventCard ev={ev} cal={calById.get(ev.calendarId)} dark={dark} onClick={() => onEventTap(ev)} delay={i} />
          </div>
        ))}
      </>
    );

  return (
    <Sheet onClose={onClose} title="Suchen" size="full">
      <div className="search-field glass" style={{ marginBottom: 6 }}>
        <IconSearch style={{ width: 18, height: 18, color: "var(--ink-3)" }} />
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, Ort, Notiz, Telefonnummer …" enterKeyHint="search" type="search" />
      </div>
      {q && !results.upcoming.length && !results.past.length && <div className="empty">Keine Treffer für „{q}“</div>}
      {!q && <div className="empty">Suche über alle Termine, Kundinnen, Orte und Notizen – auch in den Infos von Website & DigitalMask.</div>}
      {section("Anstehend", results.upcoming)}
      {section("Vergangen", results.past)}
    </Sheet>
  );
}
