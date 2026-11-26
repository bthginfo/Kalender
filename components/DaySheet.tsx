"use client";

import { addDays, fmtDayLong, relativeDayLabel } from "@/lib/date";
import type { Calendar, CalEvent } from "@/lib/types";
import EventCard from "./EventCard";
import Sheet from "./Sheet";
import { IconChevronL, IconChevronR, IconPlus } from "./icons";

type Props = {
  day: string;
  today: string;
  events: CalEvent[];
  calById: Map<string, Calendar>;
  dark: boolean;
  onChangeDay: (day: string) => void;
  onEventTap: (ev: CalEvent) => void;
  onAdd: (day: string) => void;
  onClose: () => void;
};

export default function DaySheet({ day, today, events, calById, dark, onChangeDay, onEventTap, onAdd, onClose }: Props) {
  const rel = relativeDayLabel(day, today);
  return (
    <Sheet
      onClose={onClose}
      title={
        <span style={{ display: "block" }}>
          {rel && <span style={{ display: "block", fontSize: 13, fontWeight: 650, color: "var(--accent)" }}>{rel}</span>}
          {fmtDayLong(day)}
        </span>
      }
      actions={
        <span style={{ display: "flex", gap: 6 }}>
          <button className="icon-btn glass" style={{ width: 36, height: 36 }} aria-label="Vorheriger Tag" onClick={() => onChangeDay(addDays(day, -1))}>
            <IconChevronL style={{ width: 17, height: 17 }} />
          </button>
          <button className="icon-btn glass" style={{ width: 36, height: 36 }} aria-label="Nächster Tag" onClick={() => onChangeDay(addDays(day, 1))}>
            <IconChevronR style={{ width: 17, height: 17 }} />
          </button>
        </span>
      }
    >
      <div key={day} className="fade-in">
        {events.length === 0 ? (
          <div className="empty">Noch nichts geplant ✨</div>
        ) : (
          events.map((ev, i) => (
            <EventCard key={ev.id} ev={ev} cal={calById.get(ev.calendarId)} day={day} dark={dark} onClick={() => onEventTap(ev)} delay={i} />
          ))
        )}
      </div>
      <button className="btn btn-accent" style={{ width: "100%", marginTop: 16 }} onClick={() => onAdd(day)}>
        <IconPlus style={{ width: 19, height: 19 }} /> Termin an diesem Tag
      </button>
    </Sheet>
  );
}
