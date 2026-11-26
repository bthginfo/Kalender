"use client";

import { addDays, daysInMonth, MONTHS, startOfWeek, weekdayIndex, WEEKDAYS_SHORT } from "@/lib/date";
import type { Calendar, CalEvent } from "@/lib/types";

type Props = {
  year: number;
  today: string;
  byDay: Map<string, CalEvent[]>;
  calById: Map<string, Calendar>;
  onPickMonth: (month: string) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Jahresüberblick: jeder Tag mit Termin bekommt einen farbigen Punkt (Farbe des wichtigsten Termins) */
export default function YearView({ year, today, byDay, calById, onPickMonth }: Props) {
  return (
    <div className="scroll-area" style={{ paddingTop: 4 }}>
      <div className="year-grid">
        {Array.from({ length: 12 }, (_, m) => {
          const first = `${year}-${pad(m + 1)}-01`;
          const start = startOfWeek(first);
          const n = daysInMonth(first);
          const lead = weekdayIndex(first);
          const cells = Array.from({ length: Math.ceil((lead + n) / 7) * 7 }, (_, i) => addDays(start, i));
          const count = Array.from({ length: n }, (_, d) => (byDay.get(`${year}-${pad(m + 1)}-${pad(d + 1)}`) ?? []).length).reduce((a, b) => a + b, 0);
          return (
            <button
              key={m}
              className={`mini-month glass press ${today.slice(0, 7) === first.slice(0, 7) ? "current" : ""}`}
              onClick={() => onPickMonth(first)}
            >
              <h3>
                {MONTHS[m]} <span className="tiny" style={{ fontWeight: 600 }}>{count ? `· ${count}` : ""}</span>
              </h3>
              <div className="mini-days">
                {WEEKDAYS_SHORT.map((w) => (
                  <span key={w} style={{ fontSize: 9, color: "var(--ink-3)", height: 14 }}>{w.slice(0, 1)}</span>
                ))}
                {cells.map((d) => {
                  const inMonth = d.slice(0, 7) === first.slice(0, 7);
                  if (!inMonth) return <span key={d} />;
                  const evs = byDay.get(d) ?? [];
                  const top = evs.find((e) => e.status !== "cancelled") ?? evs[0];
                  return (
                    <span key={d} className={d === today ? "today" : ""}>
                      {Number(d.slice(8))}
                      {top && d !== today && <i style={{ background: calById.get(top.calendarId)?.color ?? "var(--accent)" }} />}
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
