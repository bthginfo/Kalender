export type Calendar = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  defaultMinutes: number;
  sourceKey: string | null;
  visible: boolean;
};

export type EventStatus = "confirmed" | "tentative" | "cancelled";

export type SourceRef = {
  source: string; // kalenderdigital | digitalmask | mj
  sourceId: string;
  url: string | null;
  matchType: "created" | "matched" | "manual";
  matchReason: string | null;
  payload: SourcePayload;
};

/** Was eine Quelle über einen Termin weiß – wird in der Detailansicht angezeigt. */
export type SourcePayload = {
  label?: string; // z. B. "Website · Buchung"
  title?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  status?: string;
  details?: { label: string; value: string; href?: string }[];
};

export type CalEvent = {
  id: string;
  calendarId: string;
  title: string;
  notes: string;
  who: string;
  location: string;
  /** Wanduhrzeit Europe/Berlin, Format YYYY-MM-DDTHH:mm. Ganztägig: end exklusiv (00:00 Folgetag). */
  start: string;
  end: string;
  allDay: boolean;
  status: EventStatus;
  origin: string;
  extra: Record<string, unknown>;
  sources: SourceRef[];
  updatedAt: string;
};

export type EventInput = {
  calendarId: string;
  title: string;
  notes?: string;
  who?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  status?: EventStatus;
};

export type SyncSourceStatus = {
  source: string;
  label: string;
  configured: boolean;
  lastRun: {
    startedAt: string;
    finishedAt: string | null;
    ok: boolean | null;
    fetched: number;
    created: number;
    updated: number;
    matched: number;
    review: number;
    removed: number;
    message: string | null;
  } | null;
};

export type DuplicatePair = {
  a: CalEvent;
  b: CalEvent;
  score: number;
  reason: string;
};

export type Bootstrap = {
  calendars: Calendar[];
  events: CalEvent[];
  serverTime: string;
  openDuplicates: number;
};
