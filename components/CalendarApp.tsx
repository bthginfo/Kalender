"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addMonths, MONTHS, startOfMonth, todayBerlin } from "@/lib/date";
import type { CalEvent, EventInput, SourceRef } from "@/lib/types";
import { useData, api } from "./useData";
import { useDark } from "./useDark";
import MonthView from "./MonthView";
import AgendaView from "./AgendaView";
import YearView from "./YearView";
import DaySheet from "./DaySheet";
import EventSheet from "./EventSheet";
import EditorSheet, { type EditorInit } from "./EditorSheet";
import SearchSheet from "./SearchSheet";
import CalendarsSheet from "./CalendarsSheet";
import SettingsSheet from "./SettingsSheet";
import {
  IconCalendarToday, IconChevronL, IconChevronR, IconGear, IconLayers, IconList, IconMonth, IconPlus, IconSearch, IconYear,
} from "./icons";

type View = "month" | "agenda" | "year";
type Toast = { text: string; action?: { label: string; run: () => void } } | null;

export default function CalendarApp() {
  const data = useData();
  const dark = useDark();
  const [today, setToday] = useState(() => todayBerlin());
  const [view, setView] = useState<View>("month");
  const [month, setMonth] = useState(() => startOfMonth(todayBerlin()));
  const [direction, setDirection] = useState(0);
  const [day, setDay] = useState<string | null>(null);
  const [openEvent, setOpenEvent] = useState<CalEvent | null>(null);
  const [editor, setEditor] = useState<EditorInit | null>(null);
  const [panel, setPanel] = useState<"search" | "calendars" | "settings" | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  // Ansicht merken & Datum am Tageswechsel aktualisieren
  useEffect(() => {
    const v = localStorage.getItem("mk_view") as View | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- gespeicherte Ansicht wiederherstellen
    if (v === "month" || v === "agenda" || v === "year") setView(v);
    // App-Shortcuts aus dem Manifest (?new=1, ?view=agenda)
    const params = new URLSearchParams(location.search);
    const pv = params.get("view");
    if (pv === "month" || pv === "agenda" || pv === "year") setView(pv);
    if (params.get("new")) setEditor({ day: todayBerlin() });
    if (params.size) history.replaceState(null, "", "/");
    const t = setInterval(() => setToday(todayBerlin()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { localStorage.setItem("mk_view", view); }, [view]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.action ? 6000 : 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const go = useCallback((delta: number) => {
    setDirection(delta);
    setMonth((m) => addMonths(m, view === "year" ? delta * 12 : delta));
  }, [view]);
  const goToday = useCallback(() => {
    const target = startOfMonth(today);
    setDirection(target > month ? 1 : target < month ? -1 : 0);
    setMonth(target);
    if (view === "month") setDay(null);
  }, [today, month, view]);

  // Aktuelles Event frisch halten (nach Sync/Änderungen)
  const liveOpenEvent = useMemo(() => {
    if (!openEvent) return null;
    return data.data?.events.find((e) => e.id === openEvent.id) ?? openEvent;
  }, [openEvent, data.data]);

  // Tastaturkürzel (Desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [role=dialog]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "t") goToday();
      else if (e.key === "n") setEditor({ day: day ?? today });
      else if (e.key === "/" || e.key === "f") { e.preventDefault(); setPanel("search"); }
      else if (e.key === "m") setView("month");
      else if (e.key === "l") setView("agenda");
      else if (e.key === "j") setView("year");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, goToday, day, today]);

  const saveEvent = async (input: EventInput, id?: string) => {
    if (id) {
      const ev = await data.updateEvent(id, input);
      setOpenEvent(ev);
      setToast({ text: "Gespeichert" });
    } else {
      const ev = await data.createEvent(input);
      setToast({ text: `„${ev.title}“ eingetragen`, action: { label: "Ansehen", run: () => setOpenEvent(ev) } });
      if (view === "month") {
        const target = startOfMonth(ev.start.slice(0, 10));
        if (target !== month) { setDirection(target > month ? 1 : -1); setMonth(target); }
      }
    }
    setEditor(null);
  };

  const deleteEvent = async (ev: CalEvent) => {
    setEditor(null);
    setOpenEvent(null);
    try {
      await data.deleteEvent(ev.id);
      setToast({ text: "Termin gelöscht", action: { label: "Rückgängig", run: () => data.restoreEvent(ev.id) } });
    } catch {
      setToast({ text: "Löschen fehlgeschlagen" });
      data.reload();
    }
  };

  const split = async (src: SourceRef) => {
    if (!liveOpenEvent) return;
    await api("/api/duplicates", { method: "POST", body: JSON.stringify({ action: "split", eventId: liveOpenEvent.id, source: src.source, sourceId: src.sourceId }) });
    await data.reload();
    setToast({ text: "Getrennt – der Eintrag ist jetzt ein eigener Termin" });
  };

  const monthIdx = Number(month.slice(5, 7)) - 1;
  const year = Number(month.slice(0, 4));
  const isCurrentMonth = startOfMonth(today) === month;
  const openDuplicates = data.data?.openDuplicates ?? 0;
  const dayEvents = day ? data.byDay.get(day) ?? [] : [];

  const header = (
    <header className="topbar">
      <button
        className="press"
        onClick={() => setView(view === "year" ? "month" : "year")}
        style={{ border: 0, background: "transparent", padding: 0, textAlign: "left", minWidth: 0 }}
        aria-label="Jahresübersicht"
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.01em", marginBottom: 3 }}>
          {view === "year" ? "Jahresübersicht" : view === "agenda" ? "Alle Termine" : year}
          {data.offline && <span className="badge" style={{ marginLeft: 8 }}>offline</span>}
        </div>
        <div className="month-title">{view === "year" ? year : view === "agenda" ? "Termine" : MONTHS[monthIdx]}</div>
      </button>
      <div style={{ flex: 1 }} />
      <div className="glass pill" style={{ display: "flex", padding: 3, gap: 1 }}>
        {view !== "agenda" && (
          <>
            <button className="icon-btn hide-narrow" aria-label="Zurück" onClick={() => go(-1)} style={{ background: "transparent" }}><IconChevronL /></button>
            <button className="icon-btn hide-narrow" aria-label="Weiter" onClick={() => go(1)} style={{ background: "transparent" }}><IconChevronR /></button>
          </>
        )}
        <button className="icon-btn" aria-label="Suchen" onClick={() => setPanel("search")} style={{ background: "transparent" }}><IconSearch /></button>
        <button className="icon-btn" aria-label="Kalender wählen" onClick={() => setPanel("calendars")} style={{ background: "transparent" }}><IconLayers /></button>
        <button
          className="icon-btn"
          aria-label="Heute"
          onClick={goToday}
          style={{ background: !isCurrentMonth && view !== "agenda" ? "var(--accent-soft)" : "transparent", color: !isCurrentMonth && view !== "agenda" ? "var(--accent)" : undefined }}
        >
          <IconCalendarToday day={Number(today.slice(8))} />
        </button>
        <button className="icon-btn" aria-label="Einstellungen" onClick={() => setPanel("settings")} style={{ background: "transparent", position: "relative" }}>
          <IconGear />
          {openDuplicates > 0 && (
            <span style={{ position: "absolute", top: 5, right: 5, minWidth: 16, height: 16, borderRadius: 99, background: "var(--accent)", color: "var(--accent-ink)", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", padding: "0 4px" }}>
              {openDuplicates}
            </span>
          )}
        </button>
      </div>
    </header>
  );

  return (
    <div className="app-shell">
      {header}

      {!data.data && data.loading ? (
        <div className="month-panel glass" style={{ display: "grid", placeItems: "center" }}><span className="spinner" /></div>
      ) : view === "month" ? (
        <MonthView
          month={month}
          today={today}
          byDay={data.byDay}
          calById={data.calById}
          selected={day}
          direction={direction}
          onDayTap={(d) => setDay(d)}
          onDayLongPress={(d) => setEditor({ day: d })}
          onEventTap={(ev) => setOpenEvent(ev)}
          onSwipe={(dir) => go(dir)}
        />
      ) : view === "agenda" ? (
        <AgendaView today={today} events={data.visibleEvents} calById={data.calById} dark={dark} onEventTap={setOpenEvent} onAdd={(d) => setEditor({ day: d })} />
      ) : (
        <YearView
          year={year}
          today={today}
          byDay={data.byDay}
          calById={data.calById}
          onPickMonth={(m) => { setDirection(0); setMonth(m); setView("month"); }}
        />
      )}

      <nav className="tabbar-wrap">
        <div className="tabbar glass" role="tablist">
          <button className="tab" role="tab" aria-selected={view === "month"} onClick={() => setView("month")}><IconMonth />Monat</button>
          <button className="tab" role="tab" aria-selected={view === "agenda"} onClick={() => setView("agenda")}><IconList />Liste</button>
          <button className="tab" role="tab" aria-selected={view === "year"} onClick={() => setView("year")}><IconYear />Jahr</button>
        </div>
        <button className="fab" aria-label="Neuer Termin" onClick={() => setEditor({ day: day ?? (isCurrentMonth || view !== "month" ? today : month) })}>
          <IconPlus />
        </button>
      </nav>

      {day && (
        <DaySheet
          day={day}
          today={today}
          events={dayEvents}
          calById={data.calById}
          dark={dark}
          onChangeDay={(d) => {
            setDay(d);
            const m = startOfMonth(d);
            if (m !== month) { setDirection(m > month ? 1 : -1); setMonth(m); }
          }}
          onEventTap={setOpenEvent}
          onAdd={(d) => setEditor({ day: d })}
          onClose={() => setDay(null)}
        />
      )}

      {panel === "search" && (
        <SearchSheet events={data.data?.events ?? []} calById={data.calById} today={today} dark={dark} onEventTap={setOpenEvent} onClose={() => setPanel(null)} />
      )}
      {panel === "calendars" && (
        <CalendarsSheet
          calendars={data.calendars}
          events={data.data?.events ?? []}
          onUpdate={data.updateCalendar}
          onCreate={data.createCalendar}
          onDelete={data.deleteCalendar}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === "settings" && (
        <SettingsSheet calById={data.calById} openDuplicates={openDuplicates} onChanged={data.reload} onEventTap={setOpenEvent} onClose={() => setPanel(null)} />
      )}

      {liveOpenEvent && (
        <EventSheet
          ev={liveOpenEvent}
          cal={data.calById.get(liveOpenEvent.calendarId)}
          today={today}
          dark={dark}
          onEdit={() => setEditor({ ev: liveOpenEvent })}
          onDuplicate={() => setEditor({ ev: liveOpenEvent, duplicate: true })}
          onDelete={() => deleteEvent(liveOpenEvent)}
          onSplit={split}
          onClose={() => setOpenEvent(null)}
        />
      )}

      {editor && (
        <EditorSheet
          init={editor}
          calendars={data.calendars}
          today={today}
          onSave={saveEvent}
          onDelete={deleteEvent}
          onClose={() => setEditor(null)}
        />
      )}

      {toast && (
        <div className="toast glass" role="status">
          <span>{toast.text}</span>
          {toast.action && (
            <button onClick={() => { toast.action!.run(); setToast(null); }}>{toast.action.label}</button>
          )}
        </div>
      )}
    </div>
  );
}
