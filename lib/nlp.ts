// Schnelleingabe in natürlicher Sprache:
// "Probetermin Anna morgen 10 Uhr in Ingolstadt" → Titel, Datum, Uhrzeit, Ort, Kalender.

import { addDays, addMinutes, weekdayIndex } from "./date";
import type { Calendar } from "./types";

export type Parsed = {
  title: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  durationMin?: number;
  allDay?: boolean;
  location?: string;
  calendarId?: string;
  /** Markierte Fundstellen (für die Vorschau) */
  hits: string[];
};

const WEEKDAYS: [RegExp, number][] = [
  [/^mo(ntag)?$/, 0], [/^di(enstag|e)?$/, 1], [/^mi(ttwoch)?$/, 2], [/^do(nnerstag)?$/, 3],
  [/^fr(eitag)?$/, 4], [/^sa(mstag)?$/, 5], [/^so(nntag)?$/, 6],
];
const MONTHS: Record<string, number> = {
  jan: 1, januar: 1, feb: 2, februar: 2, mar: 3, marz: 3, märz: 3, apr: 4, april: 4, mai: 5, jun: 6, juni: 6,
  jul: 7, juli: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, nov: 11, november: 11,
  dez: 12, dezember: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");
const hm = (h: number, m = 0) => `${pad(Math.min(23, h))}:${pad(Math.min(59, m))}`;

function resolveDayMonth(d: number, m: number, y: number | undefined, today: string): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  let year = y ?? Number(today.slice(0, 4));
  if (y !== undefined && y < 100) year = 2000 + y;
  let date = `${year}-${pad(m)}-${pad(d)}`;
  if (y === undefined && date < addDays(today, -1)) date = `${year + 1}-${pad(m)}-${pad(d)}`;
  return date;
}

export function parseQuick(input: string, today: string, calendars: Calendar[]): Parsed {
  let text = ` ${input} `;
  const hits: string[] = [];
  const out: Parsed = { title: input.trim(), hits };

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
    const m = text.match(re);
    if (!m) return false;
    if (fn(m) === false) return false;
    hits.push(m[0].trim());
    text = text.replace(m[0], " ");
    return true;
  };

  // Ganztägig
  take(/\s(ganzt[äa]gig|ganztags|den ganzen tag)\s/i, () => { out.allDay = true; });

  // Relative Tage
  take(/\s(?:in|nach)\s+(\d{1,3})\s*(tag(?:en)?|woche(?:n)?)\s/i, (m) => {
    const n = Number(m[1]) * (/woche/i.test(m[2]) ? 7 : 1);
    out.date = addDays(today, n);
  });
  if (!out.date) take(/\s(heute|übermorgen|uebermorgen|morgen)\s/i, (m) => {
    const w = m[1].toLowerCase();
    out.date = addDays(today, w === "heute" ? 0 : w === "morgen" ? 1 : 2);
  });

  // 12.3. / 12.03.2027 / 12.3.27
  if (!out.date) take(/\s(?:am\s+)?(\d{1,2})\.(\d{1,2})\.(\d{2,4})?(?=\s)/, (m) => {
    const d = resolveDayMonth(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : undefined, today);
    if (!d) return false;
    out.date = d;
  });
  // 12. März (2027)
  if (!out.date) take(/\s(?:am\s+)?(\d{1,2})\.?\s+([a-zäö]{3,9})\.?(?:\s+(\d{4}))?(?=\s)/i, (m) => {
    const month = MONTHS[m[2].toLowerCase()];
    if (!month) return false;
    const d = resolveDayMonth(Number(m[1]), month, m[3] ? Number(m[3]) : undefined, today);
    if (!d) return false;
    out.date = d;
  });
  // (nächsten) Freitag
  if (!out.date) take(/\s(?:(?:am|nächsten|nächste|naechsten|kommenden|diesen)\s+)?([a-zA-Z]{2,10})\s/i, (m) => {
    const w = WEEKDAYS.find(([re]) => re.test(m[1].toLowerCase()));
    if (!w) return false;
    // "So" nur als Wochentag deuten, wenn es nicht am Satzanfang steht
    if (/^(so|mi|do|di|sa)$/i.test(m[1]) && m[1] !== m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()) return false;
    let diff = (w[1] - weekdayIndex(today) + 7) % 7;
    if (diff === 0 || /nächst|naechst|kommend/i.test(m[0])) diff = diff === 0 ? 7 : diff;
    out.date = addDays(today, diff);
  });

  // Zeitspanne: 10-12 Uhr, 10:00–11:30, von 10 bis 12
  take(/\s(?:von\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(?:-|–|bis)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr)?(?=\s)/i, (m) => {
    const h1 = Number(m[1]), h2 = Number(m[3]);
    if (h1 > 23 || h2 > 24 || (!m[2] && !m[4] && !/uhr|von|bis/i.test(m[0]))) return false;
    out.startTime = hm(h1, Number(m[2] ?? 0));
    out.endTime = hm(h2 === 24 ? 23 : h2, h2 === 24 ? 59 : Number(m[4] ?? 0));
  });
  // Einzelne Uhrzeit: 10 Uhr, 10:30, um 10, ab 18 Uhr
  if (!out.startTime) take(/\s(?:um|ab|gegen)?\s*(\d{1,2})(?:[:.](\d{2}))?\s*(uhr|h\b)?(?=\s)/i, (m) => {
    const hasMarker = Boolean(m[3]) || /um|ab|gegen/i.test(m[0]) || Boolean(m[2] && m[0].includes(":"));
    if (!hasMarker || Number(m[1]) > 23) return false;
    out.startTime = hm(Number(m[1]), Number(m[2] ?? 0));
  });

  // Dauer: 2h, 1,5 Std, 90 Min, für 2 Stunden
  take(/\s(?:für\s+)?(\d+(?:[,.]\d+)?)\s*(h|std\.?|stunden?|min\.?|minuten)(?=\s)/i, (m) => {
    const n = Number(m[1].replace(",", "."));
    out.durationMin = Math.round(/^m/i.test(m[2]) ? n : n * 60);
  });

  // Ort: "@Ingolstadt" oder "in München" (Großschreibung) am Ende
  take(/\s@([^\s][^@#]*?)(?=\s*$|\s#)/, (m) => { out.location = m[1].trim(); });
  if (!out.location) take(/\s(?:in|im|bei)\s+([A-ZÄÖÜ][\wäöüß.-]*(?:\s+[A-ZÄÖÜ0-9][\wäöüß.-]*)*)\s*$/, (m) => {
    out.location = m[1].trim();
  });

  // Kalender per #Hashtag oder Stichwort
  const byName = (q: string) =>
    calendars.find((c) => c.name.toLowerCase().startsWith(q.toLowerCase())) ??
    calendars.find((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  take(/\s#([\wäöüß-]+)/i, (m) => {
    const c = byName(m[1]);
    if (!c) return false;
    out.calendarId = c.id;
  });
  if (!out.calendarId) {
    const t = text.toLowerCase();
    const rules: [RegExp, string][] = [
      [/probe/, "probe"], [/hochzeit|braut|trauung/, "hochzeit"], [/theater|dienst|vorstellung|maske/, "theater"],
      [/academy|workshop|kurs/, "academy"], [/firma|firmen/, "firmen"],
    ];
    for (const [re, name] of rules) {
      if (re.test(t)) {
        const c = byName(name);
        if (c) { out.calendarId = c.id; break; }
      }
    }
  }

  if (out.startTime && !out.endTime && out.durationMin) {
    out.endTime = addMinutes(`2000-01-01T${out.startTime}`, out.durationMin).slice(11);
  }

  out.title = text
    .replace(/\s+(am|um|ab|von|bis|für|den|der)\s*$/i, " ")
    .replace(/^\s*(am|um|ab)\s+/i, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/[,;–-]\s*$/, "")
    .trim();
  if (out.title) out.title = out.title.charAt(0).toUpperCase() + out.title.slice(1);
  return out;
}
