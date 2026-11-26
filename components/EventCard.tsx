"use client";

import { fmtTime, eventDays, fmtDayMedium } from "@/lib/date";
import { strong } from "@/lib/color";
import type { Calendar, CalEvent } from "@/lib/types";

export const SOURCE_LABEL: Record<string, string> = {
  kalenderdigital: "Kalender.digital",
  digitalmask: "DigitalMask",
  mj: "Website",
  local: "Hier erstellt",
};

type Props = {
  ev: CalEvent;
  cal: Calendar | undefined;
  day?: string;
  dark: boolean;
  onClick: () => void;
  delay?: number;
};

export default function EventCard({ ev, cal, day, dark, onClick, delay = 0 }: Props) {
  const color = cal?.color ?? "#999";
  const days = eventDays(ev);
  const multi = days.length > 1;
  let timeTop = "";
  let timeBottom = "";
  if (ev.allDay) {
    timeTop = "ganzt.";
    if (multi) timeBottom = day ? `Tag ${days.indexOf(day) + 1}/${days.length}` : `${days.length} Tage`;
  } else if (multi && day && day !== days[0]) {
    timeTop = day === days[days.length - 1] ? "bis" : "ganzt.";
    timeBottom = day === days[days.length - 1] ? fmtTime(ev.end) : "";
  } else {
    timeTop = fmtTime(ev.start);
    timeBottom = multi ? fmtDayMedium(ev.end.slice(0, 10)) : fmtTime(ev.end);
  }
  const sub = [ev.who, ev.location].filter(Boolean).join(" · ");
  const sources = [...new Set(ev.sources.map((s) => s.source))];

  return (
    <button
      className={`ev-card press ${ev.status}`}
      onClick={onClick}
      style={{ animationDelay: `${Math.min(delay, 12) * 25}ms` }}
    >
      <span className="ev-bar" style={{ background: color, boxShadow: `0 0 12px -2px ${color}` }} />
      <span className="ev-time">
        {timeTop}
        {timeBottom && <small>{timeBottom}</small>}
      </span>
      <span className="ev-main">
        <span className="ev-title" style={{ display: "block" }}>{ev.title}</span>
        {sub && <span className="ev-sub">{sub}</span>}
        <span className="badges">
          <span className="badge" style={{ color: strong(color, dark), background: `color-mix(in srgb, ${color} 16%, transparent)` }}>
            {cal?.name ?? "Kalender"}
          </span>
          {sources.filter((s) => s !== "kalenderdigital").map((s) => (
            <span key={s} className="badge">{SOURCE_LABEL[s] ?? s}</span>
          ))}
        </span>
      </span>
    </button>
  );
}
