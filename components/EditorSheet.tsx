"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, addMinutes, diffMinutes, fmtDayMedium, nowBerlin } from "@/lib/date";
import { parseQuick } from "@/lib/nlp";
import type { Calendar, CalEvent, EventInput, EventStatus } from "@/lib/types";
import Sheet from "./Sheet";
import { IconSparkle } from "./icons";
import { SOURCE_LABEL } from "./EventCard";

export type EditorInit = { ev?: CalEvent; day?: string; duplicate?: boolean };

type Props = {
  init: EditorInit;
  calendars: Calendar[];
  today: string;
  onSave: (input: EventInput, id?: string) => Promise<void>;
  onDelete?: (ev: CalEvent) => void;
  onClose: () => void;
};

const DURATIONS = [30, 60, 90, 120, 180, 240, 480];
const LAST_CAL = "mk_last_calendar";

function roundUpHour(dt: string) {
  const [d, t] = dt.split("T");
  const h = Number(t.slice(0, 2)) + 1;
  return h > 22 ? { day: addDays(d, 1), time: "09:00" } : { day: d, time: `${String(h).padStart(2, "0")}:00` };
}

export default function EditorSheet({ init, calendars, today, onSave, onDelete, onClose }: Props) {
  const ev = init.ev;
  const editing = Boolean(ev && !init.duplicate);
  const titleRef = useRef<HTMLInputElement>(null);

  const initial = useMemo(() => {
    const lastCal = typeof window !== "undefined" ? localStorage.getItem(LAST_CAL) : null;
    const calendarId = ev?.calendarId ?? (calendars.find((c) => c.id === lastCal && c.visible) ?? calendars.find((c) => c.visible) ?? calendars[0])?.id ?? "";
    const cal = calendars.find((c) => c.id === calendarId);
    if (ev) {
      const endDay = ev.allDay ? addDays(ev.end.slice(0, 10), -1) : ev.end.slice(0, 10);
      return {
        title: ev.title, calendarId, allDay: ev.allDay, status: ev.status,
        startDay: ev.start.slice(0, 10), startTime: ev.allDay ? "10:00" : ev.start.slice(11),
        endDay: endDay < ev.start.slice(0, 10) ? ev.start.slice(0, 10) : endDay, endTime: ev.allDay ? "11:00" : ev.end.slice(11),
        who: ev.who, location: ev.location, notes: ev.notes,
      };
    }
    const day = init.day ?? today;
    const slot = day === today ? roundUpHour(nowBerlin()) : { day, time: "10:00" };
    const minutes = cal?.defaultMinutes ?? 60;
    const end = addMinutes(`${slot.day}T${slot.time}`, minutes);
    return {
      title: "", calendarId, allDay: false, status: "confirmed" as EventStatus,
      startDay: slot.day, startTime: slot.time, endDay: end.slice(0, 10), endTime: end.slice(11),
      who: "", location: "", notes: "",
    };
  }, [ev, init.day, calendars, today]);

  const [f, setF] = useState(initial);
  const [manual, setManual] = useState<Set<string>>(() => new Set(ev ? ["date", "time", "calendar", "location", "allDay"] : []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setTimeout(() => titleRef.current?.focus(), 350);
  }, [editing]);

  const set = (patch: Partial<typeof f>, mark?: string[]) => {
    setF((prev) => ({ ...prev, ...patch }));
    if (mark) setManual((m) => new Set([...m, ...mark]));
  };

  const duration = f.allDay ? 0 : diffMinutes(`${f.startDay}T${f.startTime}`, `${f.endDay}T${f.endTime}`);

  // Natürliche Sprache: nur für neue Termine und nur für Felder, die noch nicht von Hand gesetzt wurden
  const parsed = useMemo(() => (editing ? null : parseQuick(f.title, today, calendars)), [editing, f.title, today, calendars]);
  useEffect(() => {
    if (!parsed || !parsed.hits.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Felder aus der Schnelleingabe ableiten
    setF((prev) => {
      const next = { ...prev };
      const keepDur = diffMinutes(`${prev.startDay}T${prev.startTime}`, `${prev.endDay}T${prev.endTime}`) || 60;
      if (parsed.date && !manual.has("date")) {
        next.startDay = parsed.date;
        next.endDay = parsed.date;
      }
      if (parsed.allDay && !manual.has("allDay")) next.allDay = true;
      if (parsed.startTime && !manual.has("time")) {
        next.allDay = false;
        next.startTime = parsed.startTime;
        const dur = parsed.endTime
          ? Math.max(15, diffMinutes(`2000-01-01T${parsed.startTime}`, `2000-01-01T${parsed.endTime}`))
          : parsed.durationMin ?? keepDur;
        const end = addMinutes(`${next.startDay}T${parsed.startTime}`, dur);
        next.endDay = end.slice(0, 10);
        next.endTime = end.slice(11);
      } else if (!manual.has("time") && parsed.date) {
        const end = addMinutes(`${next.startDay}T${next.startTime}`, keepDur);
        next.endDay = end.slice(0, 10);
        next.endTime = end.slice(11);
      }
      if (parsed.location && !manual.has("location")) next.location = parsed.location;
      if (parsed.calendarId && !manual.has("calendar")) next.calendarId = parsed.calendarId;
      return next;
    });
  }, [parsed, manual]);

  const setStartTime = (t: string) => {
    const dur = duration > 0 ? duration : 60;
    const end = addMinutes(`${f.startDay}T${t}`, dur);
    set({ startTime: t, endDay: end.slice(0, 10), endTime: end.slice(11) }, ["time"]);
  };
  const setStartDay = (d: string) => {
    if (!d) return;
    const span = f.allDay ? Math.max(0, Math.round((Date.parse(f.endDay) - Date.parse(f.startDay)) / 86400000)) : 0;
    if (f.allDay) {
      set({ startDay: d, endDay: addDays(d, span) }, ["date"]);
    } else {
      const end = addMinutes(`${d}T${f.startTime}`, duration > 0 ? duration : 60);
      set({ startDay: d, endDay: end.slice(0, 10), endTime: end.slice(11) }, ["date"]);
    }
  };
  const setDuration = (min: number) => {
    const end = addMinutes(`${f.startDay}T${f.startTime}`, min);
    set({ endDay: end.slice(0, 10), endTime: end.slice(11), allDay: false }, ["time", "allDay"]);
  };

  const save = async () => {
    setError(null);
    const title = (parsed && parsed.hits.length ? parsed.title : f.title).trim() || f.title.trim();
    if (!title) {
      setError("Bitte gib einen Titel ein");
      titleRef.current?.focus();
      return;
    }
    const input: EventInput = {
      calendarId: f.calendarId,
      title,
      who: f.who,
      location: f.location,
      notes: f.notes,
      allDay: f.allDay,
      status: f.status,
      start: f.allDay ? `${f.startDay}T00:00` : `${f.startDay}T${f.startTime}`,
      end: f.allDay ? `${addDays(f.endDay < f.startDay ? f.startDay : f.endDay, 1)}T00:00` : `${f.endDay}T${f.endTime}`,
    };
    if (!input.allDay && input.end <= input.start) {
      setError("Das Ende liegt vor dem Beginn");
      return;
    }
    setSaving(true);
    try {
      localStorage.setItem(LAST_CAL, f.calendarId);
      await onSave(input, editing ? ev!.id : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
      setSaving(false);
    }
  };

  const selectedCal = calendars.find((c) => c.id === f.calendarId);
  const sourceNames = [...new Set((ev?.sources ?? []).map((s) => SOURCE_LABEL[s.source] ?? s.source))];

  return (
    <Sheet
      onClose={onClose}
      title={editing ? "Termin bearbeiten" : init.duplicate ? "Termin duplizieren" : "Neuer Termin"}
      z={2}
      actions={
        <button className="btn btn-accent" style={{ height: 36, padding: "0 16px", fontSize: 14.5 }} onClick={save} disabled={saving}>
          {saving ? <span className="spinner" style={{ borderTopColor: "currentColor" }} /> : "Sichern"}
        </button>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="group">
          <div className="row">
            <input
              ref={titleRef}
              value={f.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder={editing ? "Titel" : "z. B. Probe Anna morgen 10 Uhr"}
              enterKeyHint="done"
              style={{ fontSize: 19, fontWeight: 650 }}
              aria-label="Titel"
            />
          </div>
        </div>
        {parsed && parsed.hits.length > 0 && (
          <div className="nlp-hint">
            <span><IconSparkle style={{ width: 12, height: 12, verticalAlign: "-1px" }} /> erkannt</span>
            {parsed.date && <span>{fmtDayMedium(parsed.date)}</span>}
            {parsed.startTime && <span>{parsed.startTime}{parsed.endTime ? `–${parsed.endTime}` : ""}</span>}
            {parsed.allDay && <span>ganztägig</span>}
            {parsed.location && <span>📍 {parsed.location}</span>}
            {parsed.calendarId && <span>● {calendars.find((c) => c.id === parsed.calendarId)?.name}</span>}
            {parsed.title && <span style={{ background: "var(--hair)", color: "var(--ink-2)" }}>„{parsed.title}“</span>}
          </div>
        )}

        <div className="section-title">Kalender</div>
        <div className="cal-chips hscroll">
          {calendars.map((c) => (
            <button
              type="button"
              key={c.id}
              className="cal-chip press"
              aria-pressed={c.id === f.calendarId}
              style={{ ["--c" as string]: c.color }}
              onClick={() => {
                const changes: Partial<typeof f> = { calendarId: c.id };
                if (!editing && !manual.has("time") && !f.allDay) {
                  const end = addMinutes(`${f.startDay}T${f.startTime}`, c.defaultMinutes || 60);
                  changes.endDay = end.slice(0, 10);
                  changes.endTime = end.slice(11);
                }
                set(changes, ["calendar"]);
              }}
            >
              <i style={{ background: c.color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }} />
              {c.name}
            </button>
          ))}
        </div>

        <div className="section-title">Wann</div>
        <div className="group">
          <div className="row">
            <span style={{ flex: 1 }}>Ganztägig</span>
            <label className="switch">
              <input type="checkbox" checked={f.allDay} onChange={(e) => set({ allDay: e.target.checked }, ["allDay"])} />
              <span />
            </label>
          </div>
          <div className="row">
            <span style={{ flex: 1 }}>Beginn</span>
            <input className="dt-field" type="date" value={f.startDay} onChange={(e) => setStartDay(e.target.value)} style={{ flex: "none" }} />
            {!f.allDay && <input className="dt-field" type="time" value={f.startTime} step={300} onChange={(e) => setStartTime(e.target.value)} style={{ flex: "none" }} />}
          </div>
          <div className="row">
            <span style={{ flex: 1 }}>Ende</span>
            <input className="dt-field" type="date" value={f.endDay} min={f.startDay} onChange={(e) => e.target.value && set({ endDay: e.target.value }, ["date"])} style={{ flex: "none" }} />
            {!f.allDay && <input className="dt-field" type="time" value={f.endTime} step={300} onChange={(e) => set({ endTime: e.target.value }, ["time"])} style={{ flex: "none" }} />}
          </div>
          {!f.allDay && (
            <div className="row" style={{ paddingTop: 10, paddingBottom: 12 }}>
              <div className="quick-chips">
                {DURATIONS.map((m) => (
                  <button type="button" key={m} aria-pressed={duration === m} onClick={() => setDuration(m)}>
                    {m < 60 ? `${m} Min` : m % 60 ? `${m / 60} Std`.replace(".", ",") : `${m / 60} Std`}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="row">
            <div className="seg" style={{ flex: 1 }}>
              {([["confirmed", "Fix"], ["tentative", "Vorläufig"], ["cancelled", "Abgesagt"]] as const).map(([k, l]) => (
                <button type="button" key={k} aria-pressed={f.status === k} onClick={() => set({ status: k })}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="section-title">Details</div>
        <div className="group">
          <div className="row"><span className="label">Wer</span><input value={f.who} onChange={(e) => set({ who: e.target.value })} placeholder="Kundin, Personen" /></div>
          <div className="row"><span className="label">Ort</span><input value={f.location} onChange={(e) => set({ location: e.target.value }, ["location"])} placeholder="Adresse oder Ort" /></div>
          <div className="row" style={{ alignItems: "flex-start" }}>
            <span className="label" style={{ paddingTop: 6 }}>Notizen</span>
            <textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Leistungen, Telefonnummer, Hinweise …" rows={3} />
          </div>
        </div>

        {editing && sourceNames.length > 0 && (
          <p className="tiny" style={{ margin: "10px 6px 0", lineHeight: 1.45 }}>
            Dieser Termin kommt aus {sourceNames.join(" & ")}. Deine Änderungen bleiben hier erhalten – spätere Änderungen in der Quelle
            werden dann für die Hauptfelder nicht mehr übernommen (die Quellen-Infos aktualisieren sich weiter).
          </p>
        )}
        {error && <p style={{ color: "var(--danger)", fontWeight: 600, margin: "12px 6px 0" }}>{error}</p>}

        <button className="btn btn-accent" type="submit" disabled={saving} style={{ width: "100%", marginTop: 18 }}>
          {editing ? "Änderungen sichern" : `In „${selectedCal?.name ?? "Kalender"}“ eintragen`}
        </button>
        {editing && onDelete && (
          <button type="button" className="btn btn-danger" style={{ width: "100%", marginTop: 10 }} onClick={() => onDelete(ev!)}>
            Termin löschen
          </button>
        )}
      </form>
    </Sheet>
  );
}
