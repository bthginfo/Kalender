"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  addDays, daysInMonth, diffDays, eventDays, fmtTimeCompact, isMultiDay, isoWeek, MONTHS, startOfWeek, weekdayIndex,
  WEEKDAYS_SHORT,
} from "@/lib/date";
import { needsOutline, rgba, strong, textOn } from "@/lib/color";
import type { Calendar, CalEvent } from "@/lib/types";
import { useDark } from "./useDark";

type Props = {
  month: string;
  today: string;
  byDay: Map<string, CalEvent[]>;
  calById: Map<string, Calendar>;
  selected: string | null;
  direction: number;
  onDayTap: (day: string) => void;
  onDayLongPress: (day: string) => void;
  onEventTap: (ev: CalEvent) => void;
  onSwipe: (dir: 1 | -1) => void;
};

type Span = { ev: CalEvent; s: number; e: number; lane: number; contL: boolean; contR: boolean };

export function chipStyle(ev: CalEvent, cal: Calendar | undefined, filled: boolean, dark: boolean): CSSProperties {
  const color = cal?.color ?? "#888888";
  if (filled) {
    const tentative = ev.status === "tentative";
    return {
      background: tentative ? rgba(color, dark ? 0.45 : 0.55) : color,
      color: textOn(color),
      boxShadow: needsOutline(color) ? "inset 0 0 0 1px rgba(0,0,0,.14)" : undefined,
    };
  }
  return {
    background: rgba(color, dark ? 0.3 : 0.22),
    color: strong(color, dark),
  };
}

export default function MonthView(props: Props) {
  const { month, today, byDay, calById, selected, direction, onDayTap, onDayLongPress, onEventTap, onSwipe } = props;
  const dark = useDark();
  const gridRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 600 });

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const wide = size.w >= 680;
  const TOP = wide ? 32 : 27;
  const STEP = wide ? 21 : 18;
  const CHIP = wide ? 19 : 16;

  const weeks = useMemo(() => {
    const gridStart = startOfWeek(month);
    const last = addDays(month, daysInMonth(month) - 1);
    const n = Math.ceil((diffDays(gridStart, last) + 1) / 7);
    return Array.from({ length: n }, (_, i) => addDays(gridStart, i * 7));
  }, [month]);

  const rowH = size.h / weeks.length;
  const maxSlots = Math.max(1, Math.floor((rowH - TOP - 2) / STEP));

  // ---- Wischen & langes Drücken
  const touch = useRef<{ x: number; y: number; t: number; long: boolean; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const suppressClick = useRef(false);
  const startPress = (x: number, y: number, day: string) => {
    if (touch.current?.timer) clearTimeout(touch.current.timer);
    touch.current = {
      x, y, t: Date.now(), long: false,
      timer: setTimeout(() => {
        if (!touch.current) return;
        touch.current.long = true;
        suppressClick.current = true;
        navigator.vibrate?.(12);
        onDayLongPress(day);
      }, 480),
    };
  };
  const movePress = (x: number, y: number) => {
    const t = touch.current;
    if (!t) return;
    if (Math.abs(x - t.x) > 10 || Math.abs(y - t.y) > 10) clearTimeout(t.timer);
  };
  const endPress = (x: number, y: number) => {
    const t = touch.current;
    touch.current = null;
    if (!t) return;
    clearTimeout(t.timer);
    const dx = x - t.x;
    const dy = y - t.y;
    if (!t.long && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      suppressClick.current = true;
      onSwipe(dx < 0 ? 1 : -1);
    }
  };

  const monthIdx = Number(month.slice(5, 7));

  return (
    <div className="month-panel glass">
      <div className="weekdays">
        {WEEKDAYS_SHORT.map((d, i) => (
          <span key={d} className={i >= 5 ? "we" : ""}>{d}</span>
        ))}
      </div>
      <div
        ref={gridRef}
        style={{ flex: 1, minHeight: 0, position: "relative", touchAction: "pan-y" }}
        onTouchStart={(e) => {
          const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-day]");
          startPress(e.touches[0].clientX, e.touches[0].clientY, cell?.dataset.day ?? month);
        }}
        onTouchMove={(e) => movePress(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={(e) => endPress(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
        onTouchCancel={() => { if (touch.current?.timer) clearTimeout(touch.current.timer); touch.current = null; }}
      >
        <div
          key={month}
          className={`month-grid ${direction > 0 ? "slide-l" : direction < 0 ? "slide-r" : "fade-in"}`}
          style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)`, height: "100%" }}
        >
          {weeks.map((ws) => (
            <Week
              key={ws}
              ws={ws}
              monthIdx={monthIdx}
              today={today}
              selected={selected}
              byDay={byDay}
              calById={calById}
              maxSlots={maxSlots}
              TOP={TOP}
              STEP={STEP}
              CHIP={CHIP}
              wide={wide}
              dark={dark}
              onDayClick={(day) => {
                if (suppressClick.current) { suppressClick.current = false; return; }
                onDayTap(day);
              }}
              onEventTap={onEventTap}
              onContextMenu={(day) => onDayLongPress(day)}
            />
          ))}
        </div>
      </div>
      <span className="sr-only">{MONTHS[monthIdx - 1]}</span>
    </div>
  );
}

type WeekProps = {
  ws: string;
  monthIdx: number;
  today: string;
  selected: string | null;
  byDay: Map<string, CalEvent[]>;
  calById: Map<string, Calendar>;
  maxSlots: number;
  TOP: number;
  STEP: number;
  CHIP: number;
  wide: boolean;
  dark: boolean;
  onDayClick: (day: string) => void;
  onEventTap: (ev: CalEvent) => void;
  onContextMenu: (day: string) => void;
};

function Week({ ws, monthIdx, today, selected, byDay, calById, maxSlots, TOP, STEP, CHIP, wide, dark, onDayClick, onEventTap, onContextMenu }: WeekProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

  const layout = useMemo(() => {
    const spanMap = new Map<string, CalEvent>();
    const timed: CalEvent[][] = days.map(() => []);
    days.forEach((d, c) => {
      for (const ev of byDay.get(d) ?? []) {
        if (ev.allDay || isMultiDay(ev)) spanMap.set(ev.id, ev);
        else timed[c].push(ev);
      }
    });
    const spans: Span[] = [...spanMap.values()]
      .map((ev) => {
        const evDays = eventDays(ev);
        const s0 = diffDays(ws, evDays[0]);
        const e0 = diffDays(ws, evDays[evDays.length - 1]);
        return { ev, s: Math.max(0, s0), e: Math.min(6, e0), lane: 0, contL: s0 < 0, contR: e0 > 6 };
      })
      .sort((a, b) => a.s - b.s || b.e - b.s - (a.e - a.s) || a.ev.title.localeCompare(b.ev.title));
    const lanes: boolean[][] = [];
    for (const sp of spans) {
      let lane = 0;
      while (lanes[lane] && lanes[lane].slice(sp.s, sp.e + 1).some(Boolean)) lane++;
      lanes[lane] ??= Array(7).fill(false);
      for (let c = sp.s; c <= sp.e; c++) lanes[lane][c] = true;
      sp.lane = lane;
    }
    const spanCount = days.map((_, c) => spans.filter((sp) => sp.s <= c && c <= sp.e).length);
    const overflow = days.map((_, c) => spanCount[c] + timed[c].length > maxSlots);
    const visibleSpan = (sp: Span) =>
      sp.lane < maxSlots - 1 || (sp.lane === maxSlots - 1 && !overflow.slice(sp.s, sp.e + 1).some(Boolean));
    const shownSpans = spans.filter(visibleSpan);

    const placements: { ev: CalEvent; c: number; slot: number }[] = [];
    const more: { c: number; slot: number; n: number }[] = [];
    days.forEach((_, c) => {
      const occupied = new Set(shownSpans.filter((sp) => sp.s <= c && c <= sp.e).map((sp) => sp.lane));
      const hidden = spans.filter((sp) => sp.s <= c && c <= sp.e && !visibleSpan(sp)).length;
      const free: number[] = [];
      for (let s = 0; s < maxSlots; s++) if (!occupied.has(s)) free.push(s);
      const need = timed[c].length + hidden;
      if (need <= free.length) {
        timed[c].forEach((ev, i) => placements.push({ ev, c, slot: free[i] }));
      } else if (free.length > 0) {
        const room = free.length - 1;
        timed[c].slice(0, room).forEach((ev, i) => placements.push({ ev, c, slot: free[i] }));
        more.push({ c, slot: free[free.length - 1], n: need - Math.min(room, timed[c].length) });
      }
    });
    return { shownSpans, placements, more, counts: days.map((d) => (byDay.get(d) ?? []).length) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, byDay, maxSlots]);

  const colW = 100 / 7;
  const pos = (c: number, span: number, slot: number): CSSProperties => ({
    left: `calc(${c * colW}% + 2px)`,
    width: `calc(${span * colW}% - 4px)`,
    top: TOP + slot * STEP,
    height: CHIP,
    lineHeight: `${CHIP}px`,
  });

  return (
    <div className="week-row">
      {days.map((d, c) => {
        const inMonth = Number(d.slice(5, 7)) === monthIdx;
        const cls = [
          "day-cell",
          weekdayIndex(d) >= 5 ? "we" : "",
          inMonth ? "" : "out",
          d === today ? "today" : "",
          d === selected ? "selected" : "",
        ].join(" ");
        return (
          <button
            key={d}
            data-day={d}
            className={cls}
            aria-label={`${Number(d.slice(8))}. ${MONTHS[Number(d.slice(5, 7)) - 1]}, ${layout.counts[c] || "keine"} Termine`}
            onClick={() => onDayClick(d)}
            onContextMenu={(e) => { e.preventDefault(); onContextMenu(d); }}
          >
            <span className="day-num">{Number(d.slice(8))}</span>
            {c === 0 && <span className="kw">{wide ? `KW ${isoWeek(d)}` : isoWeek(d)}</span>}
          </button>
        );
      })}
      {layout.shownSpans.map((sp) => {
        const cal = calById.get(sp.ev.calendarId);
        const st = chipStyle(sp.ev, cal, true, dark);
        const showTime = !sp.ev.allDay && !sp.contL;
        return (
          <div
            key={`s-${sp.ev.id}`}
            className={`chip ${sp.ev.status === "tentative" ? "tentative" : ""} ${sp.ev.status === "cancelled" ? "cancelled" : ""}`}
            style={{
              ...pos(sp.s, sp.e - sp.s + 1, sp.lane),
              ...st,
              borderTopLeftRadius: sp.contL ? 0 : undefined,
              borderBottomLeftRadius: sp.contL ? 0 : undefined,
              borderTopRightRadius: sp.contR ? 0 : undefined,
              borderBottomRightRadius: sp.contR ? 0 : undefined,
              left: sp.contL ? `calc(${sp.s * colW}%)` : `calc(${sp.s * colW}% + 2px)`,
            }}
            onClick={(e) => { e.stopPropagation(); onEventTap(sp.ev); }}
            title={sp.ev.title}
          >
            {showTime && <span className="t">{fmtTimeCompact(sp.ev.start)}</span>}
            {sp.ev.title}
          </div>
        );
      })}
      {layout.placements.map(({ ev, c, slot }) => {
        const cal = calById.get(ev.calendarId);
        return (
          <div
            key={`t-${ev.id}-${c}`}
            className={`chip timed ${ev.status === "tentative" ? "tentative" : ""} ${ev.status === "cancelled" ? "cancelled" : ""}`}
            style={{ ...pos(c, 1, slot), ...chipStyle(ev, cal, false, dark) }}
            onClick={(e) => { e.stopPropagation(); onEventTap(ev); }}
            title={`${ev.start.slice(11)} ${ev.title}`}
          >
            <span className="t">{fmtTimeCompact(ev.start)}</span>
            {ev.title}
          </div>
        );
      })}
      {layout.more.map(({ c, slot, n }) => (
        <div key={`m-${c}`} className="more" style={{ ...pos(c, 1, slot) }}>+{n}</div>
      ))}
    </div>
  );
}
