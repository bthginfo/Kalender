// Dubletten-Erkennung: Termine aus verschiedenen Quellen beschreiben oft dasselbe,
// aber mit abweichenden Titeln ("Hochzeit" vs. "Brautstyling Anna Müller"), Spitznamen
// ("Susi" vs. "Susanne"), Tippfehlern oder Uhrzeiten (ganztägig vs. 08:30).
// Deshalb ein Punktesystem statt exaktem Vergleich.

import { eventDays, diffMinutes } from "../date";

export type Kind =
  | "wedding" | "trial" | "theater" | "course" | "corporate" | "private" | "task" | "leave" | "other";

export type Matchable = {
  title: string;
  who: string;
  notes?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  kind: Kind;
  /** Name des Kalenders, in dem der Termin liegt (für bestehende Termine) */
  calendarName?: string;
  /** Personen-/Kundennamen, die eindeutig zum Eintrag gehören */
  names?: string[];
};

const STOP = new Set([
  // Termin-Begriffe
  "hochzeit", "hochzeiten", "trauung", "braut", "styling", "makeup", "make", "frisur", "haare", "haarstyling",
  "termin", "termine", "vorgesprach", "beratung", "videocall", "call", "telefonat", "online", "kunde", "kundin",
  "privat", "private", "firma", "firmenkunde", "firmenkunden", "privatkunde", "privatkunden", "shooting",
  "fotoshooting", "event", "theater", "dienst", "tagesdienst", "vorstellung", "vorbereitung", "anfrage", "buchung",
  "gebucht", "bestatigt", "reserviert", "geblockt", "blockiert", "academy", "kurs", "workshop", "seminar", "gaste",
  "gast", "trauzeugin", "mutter", "schwester", "standesamt", "kirche", "kirchlich", "freie", "frei", "urlaub",
  "ruhetag", "weekday", "wedding", "deluxe", "premium", "standard", "standart", "basic", "feier", "aufgabe",
  "ohne", "titel", "sonstiges", "unbetreut", "angebot", "offen", "zahlung", "fallig", "anzahlung", "tag",
  // Füllwörter
  "und", "mit", "bei", "fur", "von", "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "am", "im",
  "in", "an", "auf", "zu", "zum", "zur", "uhr", "ca", "frau", "herr", "inkl", "plus", "nach", "vor", "abends",
  "morgens", "mittags", "treffen",
]);
const STOP_PREFIX = /^(probe|braut|brraut|hochzeit|styling|termin|makeup|vorstell)/;

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bedeutungstragende Wörter – meist Namen von Kundinnen. */
export function nameTokens(...parts: (string | undefined)[]): string[] {
  const out = new Set<string>();
  for (const p of parts) {
    if (!p) continue;
    for (const w of normalize(p).split(" ")) {
      if (w.length < 3 || STOP.has(w) || STOP_PREFIX.test(w) || /^\d/.test(w)) continue;
      out.add(w);
    }
  }
  return [...out];
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** "stark": gleich, Präfix (Kathi/Katharina) oder Tippfehler */
function strongMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  if (min >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  if (min >= 5 && lev(a, b) <= 1) return true;
  if (min >= 6 && lev(a, b) <= 2) return true;
  return false;
}

/** "schwach": Spitzname oder Wortverwandtschaft (Susi/Susanne, Abschiedsparty/Abschiedsdinner) */
function weakMatch(a: string, b: string): boolean {
  const p = commonPrefix(a, b);
  const min = Math.min(a.length, b.length);
  return p >= 4 || (p >= 3 && min <= 5) || (min >= 5 && lev(a, b) <= 2);
}

function kindOf(t: string): Kind {
  if (!t) return "other";
  if (/\b(theater|tagesdienst|dienst|vorstellung|maske|premiere|abf|repertoire|hp\d|gp|wa)\b/.test(t)) return "theater";
  if (/\bprobe\w*|\b(trial|vorgesprach|beratung|videocall)\b/.test(t)) return "trial";
  if (/\b(hochzeit\w*|trauung|braut\w*|brraut\w*|wedding|standesamt)/.test(t)) return "wedding";
  if (/\b(academy|kurs\w*|workshop\w*|seminar\w*|schulung\w*)\b/.test(t)) return "course";
  if (/\b(firmenkunde\w*|firma|corporate)\b/.test(t)) return "corporate";
  if (/\bprivatkunde\w*/.test(t)) return "private";
  return "other";
}

/** Art eines Termins – der Kalender (z. B. "Probetermine") hat Vorrang vor dem Titel. */
export function detectKind(text: string, calendarName = ""): Kind {
  const byCal = kindOf(normalize(calendarName));
  if (byCal !== "other") return byCal;
  return kindOf(normalize(text));
}

export type MatchResult = { score: number; reason: string };

const PERSONAL_WORK = new Set<Kind>(["wedding", "trial", "course", "corporate", "private"]);

/**
 * Bewertet, ob `item` (aus einer Quelle) dasselbe ist wie `ev` (bereits im Kalender).
 * Voraussetzung: mindestens ein gemeinsamer Tag – sonst 0.
 */
export function scoreMatch(item: Matchable, ev: Matchable): MatchResult {
  const itemDays = new Set(eventDays(item));
  const sharedDay = eventDays(ev).some((d) => itemDays.has(d));
  if (!sharedDay) return { score: 0, reason: "anderer Tag" };

  let score = 0;
  const reasons: string[] = ["gleicher Tag"];

  // 1) Namen (stärkstes Signal)
  const a = item.names ? nameTokens(...item.names) : nameTokens(item.title, item.who);
  const b = nameTokens(ev.title, ev.who);
  const strong = a.filter((x) => b.some((y) => strongMatch(x, y)));
  if (strong.length) {
    score += strong.length >= 2 ? 0.75 : 0.6;
    reasons.push(`Name „${strong.join(" ")}“`);
  } else {
    const weak = a.filter((x) => b.some((y) => weakMatch(x, y)));
    if (weak.length) {
      score += 0.3;
      reasons.push(`ähnlicher Name „${weak.join(" ")}“`);
    } else if (a.length && b.length) {
      score -= 0.2;
      reasons.push("unterschiedliche Namen");
    }
  }

  // 2) Art des Termins
  const kindA = item.kind;
  const kindB = ev.kind !== "other" ? ev.kind : detectKind(`${ev.title} ${ev.who}`, ev.calendarName);
  const sameKind = kindA === kindB && kindA !== "other";
  if (sameKind) {
    score += 0.3;
    reasons.push("gleiche Art");
    // Allgemeiner Titel wie "Hochzeit", "Theater" oder "15:00 Uhr" → sehr wahrscheinlich derselbe Termin
    if (!a.length || !b.length) {
      score += 0.15;
      reasons.push("allgemeiner Titel");
    }
  } else if (kindA !== "other" && kindB !== "other") {
    score -= 0.2;
    reasons.push("andere Art");
  }

  // 3) Uhrzeit
  if (item.allDay || ev.allDay) {
    score += 0.1;
    reasons.push("ganztägig");
  } else {
    const delta = Math.abs(diffMinutes(item.start, ev.start));
    const overlap = item.start < ev.end && ev.start < item.end;
    if (delta <= 30) {
      score += 0.3;
      reasons.push(delta === 0 ? "gleiche Uhrzeit" : `±${delta} Min.`);
    } else if (overlap) {
      score += 0.2;
      reasons.push("Zeiten überlappen");
    } else if (delta <= 180) {
      score += 0.1;
      reasons.push(`${Math.round(delta / 6) / 10} Std. Abstand`);
    }
    // Lena kann nicht zur selben Zeit zwei Bräute stylen
    if (sameKind && PERSONAL_WORK.has(kindA) && delta <= 60) {
      score += 0.15;
      reasons.push("zur selben Zeit");
    }
  }

  // 4) Ort
  if (item.location && ev.location) {
    const la = nameTokens(item.location);
    const lb = nameTokens(ev.location);
    if (la.some((x) => lb.some((y) => strongMatch(x, y)))) {
      score += 0.1;
      reasons.push("gleicher Ort");
    }
  }

  return { score: Math.max(0, Math.min(1, score)), reason: reasons.join(", ") };
}

/** Ab diesem Wert wird automatisch zusammengeführt */
export const AUTO_MERGE = 0.5;
/** Ab diesem Wert landet das Paar in der Prüfliste */
export const REVIEW = 0.35;
