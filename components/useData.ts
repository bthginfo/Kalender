"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { eventDays } from "@/lib/date";
import type { Bootstrap, Calendar, CalEvent, EventInput } from "@/lib/types";

const CACHE_KEY = "mk_cache_v1";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Nicht angemeldet");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Fehler ${res.status}`);
  return data as T;
}

export function useData() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const inflight = useRef<Promise<void> | null>(null);

  const persist = useCallback((d: Bootstrap) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(d));
    } catch {
      /* Speicher voll – egal */
    }
  }, []);

  const reload = useCallback(async () => {
    if (inflight.current) return inflight.current;
    const p = (async () => {
      try {
        const d = await api<Bootstrap>("/api/bootstrap");
        setData(d);
        persist(d);
        setOffline(false);
      } catch (e) {
        if (!navigator.onLine || (e instanceof TypeError)) setOffline(true);
      } finally {
        setLoading(false);
        inflight.current = null;
      }
    })();
    inflight.current = p;
    return p;
  }, [persist]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Offline-Cache sofort anzeigen
        setData(JSON.parse(cached));
        setLoading(false);
      }
    } catch {
      /* ignore */
    }
    reload();
    const onVis = () => document.visibilityState === "visible" && reload();
    const onOnline = () => reload();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    const t = setInterval(reload, 5 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      clearInterval(t);
    };
  }, [reload]);

  const mutate = useCallback((fn: (d: Bootstrap) => Bootstrap) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, [persist]);

  const upsertLocal = useCallback((ev: CalEvent) => {
    mutate((d) => ({ ...d, events: [...d.events.filter((e) => e.id !== ev.id), ev].sort((a, b) => a.start.localeCompare(b.start)) }));
  }, [mutate]);

  const actions = useMemo(() => ({
    reload,
    async createEvent(input: EventInput) {
      const ev = await api<CalEvent>("/api/events", { method: "POST", body: JSON.stringify(input) });
      upsertLocal(ev);
      return ev;
    },
    async updateEvent(id: string, input: EventInput) {
      const ev = await api<CalEvent>(`/api/events/${id}`, { method: "PUT", body: JSON.stringify(input) });
      upsertLocal(ev);
      return ev;
    },
    async deleteEvent(id: string) {
      mutate((d) => ({ ...d, events: d.events.filter((e) => e.id !== id) }));
      await api(`/api/events/${id}`, { method: "DELETE" });
    },
    async restoreEvent(id: string) {
      const ev = await api<CalEvent>(`/api/events/${id}`, { method: "POST", body: JSON.stringify({ action: "restore" }) });
      upsertLocal(ev);
      return ev;
    },
    async createCalendar(name: string, color?: string) {
      const cal = await api<Calendar>("/api/calendars", { method: "POST", body: JSON.stringify({ name, color }) });
      mutate((d) => ({ ...d, calendars: [...d.calendars, cal] }));
      return cal;
    },
    async updateCalendar(id: string, patch: Partial<Pick<Calendar, "name" | "color" | "visible" | "sortOrder" | "defaultMinutes">>) {
      mutate((d) => ({ ...d, calendars: d.calendars.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
      const cal = await api<Calendar>(`/api/calendars/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      mutate((d) => ({ ...d, calendars: d.calendars.map((c) => (c.id === id ? cal : c)) }));
      return cal;
    },
    async deleteCalendar(id: string, moveTo: string | null) {
      await api(`/api/calendars/${id}${moveTo ? `?moveTo=${moveTo}` : ""}`, { method: "DELETE" });
      await reload();
    },
  }), [reload, mutate, upsertLocal]);

  const calendars = useMemo(() => [...(data?.calendars ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [data]);
  const calById = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);
  const visibleEvents = useMemo(
    () => (data?.events ?? []).filter((e) => calById.get(e.calendarId)?.visible !== false),
    [data, calById],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const ev of visibleEvents) {
      for (const d of eventDays(ev)) {
        const list = m.get(d);
        if (list) list.push(ev);
        else m.set(d, [ev]);
      }
    }
    for (const list of m.values()) {
      list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
    }
    return m;
  }, [visibleEvents]);

  return { data, loading, offline, calendars, calById, visibleEvents, byDay, ...actions, api };
}

export type DataApi = ReturnType<typeof useData>;
export { api };
