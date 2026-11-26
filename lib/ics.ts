import type { CalEvent } from "./types";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Einzelner Termin als .ics (zum Teilen / in anderen Kalender übernehmen) */
export function eventToIcs(ev: CalEvent): string {
  const local = (dt: string) => dt.replace(/[-:]/g, "") + "00";
  const date = (dt: string) => dt.slice(0, 10).replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Magdalena Kalender//DE", "BEGIN:VEVENT",
    `UID:${ev.id}@magdalena-kalender`, `DTSTAMP:${stamp}`,
    ...(ev.allDay
      ? [`DTSTART;VALUE=DATE:${date(ev.start)}`, `DTEND;VALUE=DATE:${date(ev.end)}`]
      : [`DTSTART;TZID=Europe/Berlin:${local(ev.start)}`, `DTEND;TZID=Europe/Berlin:${local(ev.end)}`]),
    `SUMMARY:${esc(ev.title)}`,
    ...(ev.location ? [`LOCATION:${esc(ev.location)}`] : []),
    ...(ev.notes || ev.who ? [`DESCRIPTION:${esc([ev.who && `Wer: ${ev.who}`, ev.notes].filter(Boolean).join("\n"))}`] : []),
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}
