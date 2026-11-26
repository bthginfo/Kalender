"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { addDays, daysInMonth, MONTHS, startOfWeek, weekdayIndex, WEEKDAYS_SHORT } from "@/lib/date";
import type { Calendar, CalEvent } from "@/lib/types";

type Props = {
  /** Jahr, zu dem gescrollt werden soll (nonce erzwingt erneutes Scrollen) */
  focus: { year: number; nonce: number };
  today: string;
  byDay: Map<string, CalEvent[]>;
  calById: Map<string, Calendar>;
  onPickMonth: (month: string) => void;
  onVisibleYear: (year: number) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Fortlaufende Jahresübersicht: einfach weiter nach unten scrollen → nächstes Jahr */
export default function YearView({ focus, today, byDay, calById, onPickMonth, onVisibleYear }: Props) {
  const thisYear = Number(today.slice(0, 4));
  const [first, setFirst] = useState(() => Math.min(focus.year, thisYear) - 1);
  const [last, setLast] = useState(() => Math.max(focus.year, thisYear) + 3);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sections = useRef(new Map<number, HTMLElement>());
  const bottomRef = useRef<HTMLDivElement>(null);
  const keepPosition = useRef<number | null>(null);
  const didInit = useRef(false);
  const lastReported = useRef<number | null>(null);

  // Zum gewünschten Jahr scrollen (beim Öffnen sofort, danach weich)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fehlende Jahre nachladen, dann scrollen
    if (focus.year < first) { setFirst(focus.year - 1); return; }
    if (focus.year > last) { setLast(focus.year + 2); return; }
    const box = scrollRef.current;
    const el = sections.current.get(focus.year);
    if (!box || !el) return;
    box.scrollTo({ top: el.offsetTop - 2, behavior: didInit.current ? "smooth" : "instant" });
    didInit.current = true;
  }, [focus, first, last]);

  // Beim Voranstellen früherer Jahre die Position halten
  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (box && keepPosition.current !== null) {
      box.scrollTop += box.scrollHeight - keepPosition.current;
      keepPosition.current = null;
    }
  }, [first]);

  // Unten angekommen → weitere Jahre laden
  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setLast((l) => l + 3);
    }, { root: scrollRef.current, rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onScroll = () => {
    const box = scrollRef.current;
    if (!box) return;
    // Kurz vor dem Ende weitere Jahre anhängen
    if (box.scrollTop + box.clientHeight > box.scrollHeight - 1200) setLast((l) => Math.max(l, years[years.length - 1] + 3));
    let current = first;
    for (const [y, el] of sections.current) {
      if (el.offsetTop - 60 <= box.scrollTop && y > current) current = y;
    }
    if (current !== lastReported.current) {
      lastReported.current = current;
      onVisibleYear(current);
    }
  };

  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i);

  return (
    <div ref={scrollRef} className="scroll-area" style={{ position: "relative", paddingTop: 0 }} onScroll={onScroll}>
      <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 4px" }}>
        <button
          className="btn btn-quiet"
          style={{ height: 32, fontSize: 13 }}
          onClick={() => {
            keepPosition.current = scrollRef.current?.scrollHeight ?? null;
            setFirst((f) => f - 2);
          }}
        >
          Frühere Jahre
        </button>
      </div>
      {years.map((y) => (
        <section
          key={y}
          className="year-block"
          ref={(el) => {
            if (el) sections.current.set(y, el);
            else sections.current.delete(y);
          }}
        >
          <YearBlock year={y} today={today} byDay={byDay} calById={calById} onPickMonth={onPickMonth} />
        </section>
      ))}
      <div ref={bottomRef} style={{ height: 1 }} />
    </div>
  );
}

const YearBlock = memo(function YearBlock({
  year, today, byDay, calById, onPickMonth,
}: { year: number; today: string; byDay: Map<string, CalEvent[]>; calById: Map<string, Calendar>; onPickMonth: (m: string) => void }) {
  let total = 0;
  for (let m = 1; m <= 12; m++) {
    const n = daysInMonth(`${year}-${pad(m)}-01`);
    for (let d = 1; d <= n; d++) total += (byDay.get(`${year}-${pad(m)}-${pad(d)}`) ?? []).length;
  }
  return (
    <>
      <div className={`year-head ${Number(today.slice(0, 4)) === year ? "current" : ""}`}>
        <b>{year}</b>
        <span>{total ? `${total} Termine` : "noch keine Termine"}</span>
      </div>
      <div className="year-grid">
        {Array.from({ length: 12 }, (_, m) => (
          <MiniMonth key={m} year={year} m={m} today={today} byDay={byDay} calById={calById} onPickMonth={onPickMonth} />
        ))}
      </div>
    </>
  );
});

function MiniMonth({
  year, m, today, byDay, calById, onPickMonth,
}: { year: number; m: number; today: string; byDay: Map<string, CalEvent[]>; calById: Map<string, Calendar>; onPickMonth: (m: string) => void }) {
  const first = `${year}-${pad(m + 1)}-01`;
  const start = startOfWeek(first);
  const n = daysInMonth(first);
  const lead = weekdayIndex(first);
  const cells = Array.from({ length: Math.ceil((lead + n) / 7) * 7 }, (_, i) => addDays(start, i));
  let count = 0;
  for (let d = 1; d <= n; d++) count += (byDay.get(`${year}-${pad(m + 1)}-${pad(d)}`) ?? []).length;
  return (
    <button
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
          if (d.slice(0, 7) !== first.slice(0, 7)) return <span key={d} />;
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
}
