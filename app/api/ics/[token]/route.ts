import { listCalendars, listEvents } from "@/lib/repo";
import { addDays, todayBerlin } from "@/lib/date";

// Abo-Feed (webcal) für Apple-/Google-Kalender. Schutz über ein geheimes Token in der URL.

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

const local = (dt: string) => dt.replace(/[-:]/g, "") + "00"; // 2026-11-26T10:00 -> 20261126T100000
const dateOnly = (dt: string) => dt.slice(0, 10).replace(/-/g, "");

const VTIMEZONE = [
  "BEGIN:VTIMEZONE", "TZID:Europe/Berlin",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
  "END:VTIMEZONE",
];

export async function GET(request: Request, ctx: RouteContext<"/api/ics/[token]">) {
  const { token } = await ctx.params;
  const expected = process.env.ICS_TOKEN;
  if (!expected || token.replace(/\.ics$/, "") !== expected) return new Response("Not found", { status: 404 });

  const only = new URL(request.url).searchParams.get("calendars")?.split(",").filter(Boolean);
  const [events, calendars] = await Promise.all([listEvents(), listCalendars()]);
  const calName = new Map(calendars.map((c) => [c.id, c.name]));
  const from = addDays(todayBerlin(), -120);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Magdalena Kalender//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Lenas Kalender", "X-WR-TIMEZONE:Europe/Berlin", "REFRESH-INTERVAL;VALUE=DURATION:PT30M", "X-PUBLISHED-TTL:PT30M",
    ...VTIMEZONE,
  ];
  for (const ev of events) {
    if (ev.end.slice(0, 10) < from || ev.status === "cancelled") continue;
    if (only && !only.includes(ev.calendarId)) continue;
    const desc = [ev.who && `Wer: ${ev.who}`, ev.notes].filter(Boolean).join("\n");
    lines.push("BEGIN:VEVENT", `UID:${ev.id}@magdalena-kalender`, `DTSTAMP:${stamp}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(ev.start)}`, `DTEND;VALUE=DATE:${dateOnly(ev.end)}`);
    } else {
      lines.push(`DTSTART;TZID=Europe/Berlin:${local(ev.start)}`, `DTEND;TZID=Europe/Berlin:${local(ev.end)}`);
    }
    lines.push(fold(`SUMMARY:${esc(ev.title)}`));
    if (ev.location) lines.push(fold(`LOCATION:${esc(ev.location)}`));
    if (desc) lines.push(fold(`DESCRIPTION:${esc(desc)}`));
    const cat = calName.get(ev.calendarId);
    if (cat) lines.push(fold(`CATEGORIES:${esc(cat)}`));
    if (ev.status === "tentative") lines.push("STATUS:TENTATIVE");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="lenas-kalender.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
