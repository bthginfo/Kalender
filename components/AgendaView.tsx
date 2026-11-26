"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, eventDays, fmtDayLong, relativeDayLabel } from "@/lib/date";
import type { Calendar, CalEvent } from "@/lib/types";
import EventCard from "./EventCard";

type Props = {
  today: string;
  events: CalEvent[];
  calById: Map<string, Calendar>;
  dark: boolean;
  onEventTap: (ev: CalEvent) => void;
  onAdd: (day: string) => void;
};

/** Chronologische Liste ab heute – mehrtägige Termine erscheinen an ihrem ersten Tag */
export default function AgendaView({ today, events, calById, dark, onEventTap, onAdd }: Props) {
  const [pastDays, setPastDays] = useState(0);
  const [futureDays, setFutureDays] = useState(120);
  const todayRef = useRef<HTMLDivElement>(null);
  const from = addDays(today, -pastDays);
  const to = addDays(today, futureDays);

  const groups = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const days = eventDays(ev);
      const last = days[days.length - 1];
      if (last < from || days[0] > to) continue;
      const anchor = days[0] < from ? from : days[0];
      // Laufende mehrtägige Termine auch "heute" zeigen
      const key = days[0] < today && last >= today ? today : anchor;
      const list = m.get(key);
      if (list) list.push(ev);
      else m.set(key, [ev]);
    }
    if (!m.has(today)) m.set(today, []);
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, list]) => [day, list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start))] as const);
  }, [events, from, to, today]);

  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: "start" });
  }, []);

  let i = 0;
  return (
    <div className="scroll-area" style={{ paddingTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 6px" }}>
        <button className="btn btn-quiet" style={{ height: 34, fontSize: 13.5 }} onClick={() => setPastDays((d) => d + 60)}>
          Frühere Termine anzeigen
        </button>
      </div>
      {groups.map(([day, list]) => {
        const rel = relativeDayLabel(day, today);
        return (
          <div key={day} ref={day === today ? todayRef : undefined} style={{ scrollMarginTop: 0 }}>
            <div className={`agenda-day ${day === today ? "is-today" : ""}`}>
              <b>{rel || fmtDayLong(day).split(",")[0]}</b>
              <span>{rel ? fmtDayLong(day) : fmtDayLong(day).split(", ")[1]}</span>
            </div>
            {list.length === 0 && day === today ? (
              <button className="ev-card press" onClick={() => onAdd(today)} style={{ justifyContent: "center", color: "var(--ink-3)" }}>
                Heute steht nichts an – Termin hinzufügen?
              </button>
            ) : (
              list.map((ev) => (
                <EventCard key={`${day}-${ev.id}`} ev={ev} cal={calById.get(ev.calendarId)} day={day} dark={dark} onClick={() => onEventTap(ev)} delay={i++} />
              ))
            )}
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "center", margin: "18px 0" }}>
        <button className="btn btn-quiet" style={{ height: 34, fontSize: 13.5 }} onClick={() => setFutureDays((d) => d + 180)}>
          Weitere Termine laden
        </button>
      </div>
    </div>
  );
}
