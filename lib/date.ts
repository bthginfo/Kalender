// Datums-Hilfen auf Basis von Wanduhrzeit-Strings (YYYY-MM-DD / YYYY-MM-DDTHH:mm).
// Alle Rechnungen laufen über "UTC-Dates" als neutrale Kalenderarithmetik – so gibt es
// keine Sommerzeit-Sprünge und Server (UTC) und Handy (Berlin) rechnen identisch.

export const TZ = "Europe/Berlin";

export const WEEKDAYS_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
export const WEEKDAYS_LONG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
export const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
export const MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD -> UTC-Date (Mitternacht) */
export function parseDay(day: string): Date {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function fmtDay(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** YYYY-MM-DDTHH:mm -> UTC-Date mit Wanduhrzeit */
export function parseDT(dt: string): Date {
  const [day, time = "00:00"] = dt.split("T");
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0));
}

export function fmtDT(d: Date): string {
  return `${fmtDay(d)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtDay(d);
}

export function addMinutes(dt: string, n: number): string {
  return fmtDT(new Date(parseDT(dt).getTime() + n * 60000));
}

export function addMonths(day: string, n: number): string {
  const d = parseDay(day);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last));
  return fmtDay(target);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000);
}

export function diffMinutes(a: string, b: string): number {
  return Math.round((parseDT(b).getTime() - parseDT(a).getTime()) / 60000);
}

/** 0 = Montag … 6 = Sonntag */
export function weekdayIndex(day: string): number {
  return (parseDay(day).getUTCDay() + 6) % 7;
}

export function startOfWeek(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

export function startOfMonth(day: string): string {
  return day.slice(0, 8) + "01";
}

export function daysInMonth(day: string): number {
  const d = parseDay(day);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** ISO-Kalenderwoche */
export function isoWeek(day: string): number {
  const d = parseDay(day);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
}

/** Heutiges Datum/Uhrzeit in Europe/Berlin */
export function nowBerlin(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function todayBerlin(): string {
  return nowBerlin().slice(0, 10);
}

/** UTC-Instant (ISO oder Date) -> Berliner Wanduhrzeit YYYY-MM-DDTHH:mm */
export function instantToBerlin(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Berliner Wanduhrzeit -> UTC-Instant (für ICS-Export mit Z-Zeiten) */
export function berlinToInstant(dt: string): Date {
  const guess = parseDT(dt);
  // Offset iterativ bestimmen (funktioniert auch an DST-Grenzen)
  for (let i = 0; i < 2; i++) {
    const asBerlin = parseDT(instantToBerlin(guess));
    const diff = asBerlin.getTime() - parseDT(dt).getTime();
    guess.setTime(guess.getTime() - diff);
  }
  return guess;
}

export function fmtTime(dt: string): string {
  return dt.slice(11, 16);
}

/** Kompakte Uhrzeit für Monatsansicht: "10" statt "10:00", sonst "10:30" */
export function fmtTimeCompact(dt: string): string {
  const t = dt.slice(11, 16);
  return t.endsWith(":00") ? String(Number(t.slice(0, 2))) : t.replace(/^0/, "");
}

export function fmtDayLong(day: string): string {
  const d = parseDay(day);
  return `${WEEKDAYS_LONG[weekdayIndex(day)]}, ${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtDayMedium(day: string): string {
  const d = parseDay(day);
  return `${WEEKDAYS_SHORT[weekdayIndex(day)]}, ${d.getUTCDate()}. ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
}

/** Tage (YYYY-MM-DD), die ein Termin belegt */
export function eventDays(ev: { start: string; end: string; allDay: boolean }): string[] {
  const first = ev.start.slice(0, 10);
  let last = ev.end.slice(0, 10);
  if (ev.allDay || ev.end.slice(11, 16) === "00:00") last = addDays(last, -1);
  if (last < first) last = first;
  const out: string[] = [];
  for (let d = first; d <= last && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isMultiDay(ev: { start: string; end: string; allDay: boolean }): boolean {
  return eventDays(ev).length > 1;
}

export function relativeDayLabel(day: string, today: string): string {
  const n = diffDays(today, day);
  if (n === 0) return "Heute";
  if (n === 1) return "Morgen";
  if (n === 2) return "Übermorgen";
  if (n === -1) return "Gestern";
  if (n > 2 && n < 7) return `In ${n} Tagen`;
  return "";
}

export function timeRangeLabel(ev: { start: string; end: string; allDay: boolean }): string {
  if (ev.allDay) {
    const days = eventDays(ev);
    return days.length > 1 ? `Ganztägig · ${days.length} Tage` : "Ganztägig";
  }
  const sameDay = ev.start.slice(0, 10) === ev.end.slice(0, 10);
  if (sameDay) return `${fmtTime(ev.start)} – ${fmtTime(ev.end)}`;
  return `${fmtTime(ev.start)} – ${fmtDayMedium(ev.end.slice(0, 10))} ${fmtTime(ev.end)}`;
}
