import "server-only";
import { externalDb } from "../../db";
import { addDays, addMinutes, instantToBerlin, todayBerlin } from "../../date";
import type { SourcePayload } from "../../types";
import type { ExternalItem, SourceResult } from "../engine";
import type { Kind } from "../match";

// magdalenajohanna.com – Lenas Business-Backoffice (Bräute, Probetermine, Kundinnen, Academy,
// Anfragen, Angebote, Rechnungen). Es gibt zwei Projekte mit identischem Schema und identischen
// IDs: die aktuelle Vite-Website und die Next.js-Neuauflage. Gelesen wird immer genau die
// Datenbank des Projekts, das gerade unter magdalenajohanna.com läuft. Quellen-IDs sind
// "<tabelle>:<uuid>[:<art>]" – damit entstehen bei einem Umzug keine Dubletten.

const SITE = "https://www.magdalenajohanna.com";

const CAL = {
  wedding: { name: "Hochzeiten", color: "#D9A282" },
  trial: { name: "Probetermine", color: "#FF9966" },
  corporate: { name: "Firmenkunden", color: "#7F2E2C" },
  private: { name: "Privatkunden", color: "#76923C" },
  academy: { name: "Academy & Workshops", color: "#2E9C8F" },
  deadlines: { name: "Fristen & Zahlungen", color: "#6B7280" },
  personal: { name: "Private Termine", color: "#F2F2E4" },
  availability: { name: "Website: Verfügbarkeit", color: "#9CA3AF", hidden: true },
};

const TYPE_LABEL: Record<string, string> = {
  bride: "Braut", corporate: "Firmenkunde", private: "Privatkundin", hair: "Friseurtermin",
  jga: "JGA", workshop: "Workshop", academy: "Academy",
};

type Row = Record<string, unknown>;
type Detail = NonNullable<SourcePayload["details"]>[number];

export type MjDatabase = { key: "website" | "next"; label: string; url: string };

export function mjDatabases(): MjDatabase[] {
  const out: MjDatabase[] = [];
  if (process.env.MJ_WEBSITE_DATABASE_URL) out.push({ key: "website", label: "magdalenajohanna-website", url: process.env.MJ_WEBSITE_DATABASE_URL });
  if (process.env.MJ_NEXT_DATABASE_URL) out.push({ key: "next", label: "magdalenajohanna-next", url: process.env.MJ_NEXT_DATABASE_URL });
  return out;
}

export function mjConfigured(): boolean {
  return mjDatabases().length > 0;
}

/** Ermittelt, welches Projekt gerade live ist: Next.js liefert /_next/-Assets, die Vite-Seite /assets/. */
export async function detectActiveMj(): Promise<{ db: MjDatabase; reason: string }> {
  const dbs = mjDatabases();
  const forced = process.env.MJ_ACTIVE;
  if (forced === "website" || forced === "next") {
    const db = dbs.find((d) => d.key === forced);
    if (db) return { db, reason: `fest eingestellt (MJ_ACTIVE=${forced})` };
  }
  try {
    const res = await fetch(`${SITE}/`, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0 (Kalender-Sync)" }, signal: AbortSignal.timeout(8000) });
    const html = await res.text();
    const isNext = html.includes("/_next/") || /next\.js/i.test(res.headers.get("x-powered-by") ?? "");
    const want = isNext ? "next" : "website";
    const db = dbs.find((d) => d.key === want) ?? dbs[0];
    return { db, reason: `live erkannt: ${isNext ? "Next.js-Projekt" : "Vite-Website"}` };
  } catch {
    return { db: dbs[0], reason: "Live-Erkennung fehlgeschlagen – Standard-Datenbank" };
  }
}

function stripHtml(html: unknown): string {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const euro = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n.toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : "";
};
const deDate = (d: string) => d.slice(0, 10).split("-").reverse().join(".");

function contactDetails(r: Row): Detail[] {
  const out: Detail[] = [];
  if (r.phone) out.push({ label: "Telefon", value: String(r.phone), href: `tel:${String(r.phone).replace(/[^\d+]/g, "")}` });
  if (r.email) out.push({ label: "E-Mail", value: String(r.email), href: `mailto:${r.email}` });
  return out;
}

function serviceList(v: unknown): string {
  if (!Array.isArray(v)) return "";
  return v
    .map((s) => (s && typeof s === "object" ? String((s as Row).title ?? (s as Row).name ?? "") : String(s)))
    .filter(Boolean)
    .join(", ");
}

function schedule(v: unknown): { first: string | null; last: string | null; text: string } {
  if (!Array.isArray(v)) return { first: null, last: null, text: "" };
  const rows = v
    .map((z) => ({ time: String((z as Row)?.time ?? ""), text: stripHtml((z as Row)?.text) }))
    .filter((z) => z.time || z.text);
  const times = rows.map((z) => z.time).filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)).sort();
  return {
    first: times[0] ?? null,
    last: times[times.length - 1] ?? null,
    text: rows.map((z) => `${z.time ? z.time + "  " : ""}${z.text}`).join("\n"),
  };
}

function timed(day: string, time: string | null, minutes: number) {
  if (!time) return { start: `${day}T00:00`, end: `${addDays(day, 1)}T00:00`, allDay: true };
  const start = `${day}T${time}`;
  return { start, end: addMinutes(start, minutes), allDay: false };
}

export async function fetchWebsite(): Promise<SourceResult> {
  const { db: active, reason } = await detectActiveMj();
  const sql = externalDb(active.url);
  const today = todayBerlin();
  const windowStart = addDays(today, -400);
  const windowEnd = addDays(today, 1500);

  const [brides, ownEvents, academy, inquiries, offers, invoices, blocked] = await Promise.all([
    sql.query(
      `SELECT b.id::text, b.customer_type, b.status, b.full_name, b.first_name, b.last_name, b.email, b.phone,
              b.company_name, b.contact_person, b.booking_type, b.event_type, b.participant_count, b.duration,
              b.notizen, b.project_details, b.booked_services, b.custom_services, b.total_price, b.deposit_amount,
              b.deposit_due_date::text AS deposit_due, b.payments, b.zeitplan, b.zeitplan2,
              b.wedding_date::text AS wedding_date, b.second_wedding_date::text AS wedding2_date,
              b.event_date::text AS event_date, b.probetermin_date::text AS probe_date, nullif(b.probetermin_time,'') AS probe_time,
              nullif(b.probetermin_ort,'') AS probe_ort, nullif(b.probetermin_ort_wunsch,'') AS probe_ort_wunsch,
              nullif(concat_ws(', ', nullif(b.strasse_trauung,''), nullif(b.stadt_trauung,'')),'') AS venue,
              nullif(b.service_location,'') AS service_location, b.portal_enabled
       FROM brides b`,
    ) as Promise<Row[]>,
    sql.query(
      `SELECT e.id::text, e.date::text AS date, e.start_time, e.end_time, e.title, e.customer_name, e.location, e.note,
              c.name AS category_name, c.color AS category_color
       FROM lena_calendar_events e LEFT JOIN lena_calendar_categories c ON c.id = e.category_id
       WHERE e.academy_booking_id IS NULL`,
    ) as Promise<Row[]>,
    sql.query(
      `SELECT b.id::text, b.status, b.format, b.participants, b.location, b.note, b.duration_minutes,
              to_char(COALESCE(b.confirmed_start,b.requested_start) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_utc,
              b.confirmed_start IS NOT NULL AS confirmed, p.title AS program_title,
              c.id::text AS customer_id, c.full_name, c.email, c.phone
       FROM academy_bookings b JOIN academy_programs p ON p.id=b.program_id JOIN brides c ON c.id=b.customer_id
       WHERE COALESCE(b.confirmed_start,b.requested_start) IS NOT NULL AND b.status IN ('requested','accepted','completed')`,
    ) as Promise<Row[]>,
    sql.query(
      `SELECT i.id::text, i.status, i.variant, COALESCE(o.event_date, i.wedding_date)::text AS date,
              i.name, i.first_name, i.last_name, i.email, i.phone, i.subject, i.summary, i.message, i.expected_location,
              o.id::text AS offer_id, o.offer_number, o.valid_until::text AS offer_valid_until
       FROM bride_inquiries i
       LEFT JOIN LATERAL (SELECT id, offer_number, event_date, valid_until FROM offers
                          WHERE inquiry_id=i.id ORDER BY created_at DESC LIMIT 1) o ON true
       WHERE i.status IN ('new','answered')`,
    ) as Promise<Row[]>,
    sql.query(
      `SELECT o.id::text, o.offer_number, o.status, o.customer_type, o.recipient_name, o.recipient_email,
              o.event_date::text AS event_date, o.valid_until::text AS valid_until, o.total_price, o.inquiry_id::text,
              (SELECT status FROM bride_inquiries WHERE id = o.inquiry_id) AS inquiry_status
       FROM offers o WHERE o.status IN ('pending','changes_requested')`,
    ) as Promise<Row[]>,
    sql.query(
      `SELECT i.id::text, i.invoice_number, i.invoice_kind, i.status, i.recipient_name, i.amount_due, i.bride_id::text,
              CASE WHEN i.payment_due_date ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN i.payment_due_date
                   WHEN i.payment_due_date ~ '^\\d{2}\\.\\d{2}\\.\\d{4}$' THEN to_char(to_date(i.payment_due_date,'DD.MM.YYYY'),'YYYY-MM-DD') END AS due
       FROM invoices i
       WHERE i.status IN ('sent','reminded','overdue') AND NOT i.is_test AND i.original_invoice_id IS NULL AND i.amount_due > 0`,
    ) as Promise<Row[]>,
    sql.query(
      `SELECT d.date::text AS date, d.type, d.label,
              EXISTS (SELECT 1 FROM brides b WHERE d.date IN (b.wedding_date, b.second_wedding_date, b.event_date, b.probetermin_date)) AS covered
       FROM blocked_dates d`,
    ) as Promise<Row[]>,
  ]);

  const items: ExternalItem[] = [];
  const push = (it: ExternalItem) => {
    if (it.start.slice(0, 10) > windowEnd || it.end.slice(0, 10) < windowStart) return;
    items.push(it);
  };

  // --- Kundinnen: Hochzeit (Tag 1/2), Event, Probetermin, Anzahlung
  for (const b of brides) {
    const id = String(b.id);
    const type = String(b.customer_type || "bride");
    const isBride = type === "bride";
    const name = String(b.full_name ?? "").trim();
    const company = String(b.company_name ?? "").trim();
    const display = type === "corporate" && company ? company : name;
    const status = String(b.status ?? "");
    const tentative = status === "unverbindlich";
    const url = `${SITE}/lena/brides/${id}`;
    const names = [name, b.first_name, b.last_name, company, b.contact_person].map((x) => String(x ?? "")).filter(Boolean);
    const services = serviceList(b.booked_services) || serviceList(b.custom_services);
    const notes = stripHtml(b.notizen);
    const common: Detail[] = [
      { label: "Kundin", value: [name, company && company !== name ? company : ""].filter(Boolean).join(" · ") },
      { label: "Status", value: status || "neu" },
      ...(b.booking_type ? [{ label: "Buchung", value: String(b.booking_type) }] : []),
      ...(b.event_type ? [{ label: "Anlass", value: String(b.event_type) }] : []),
      ...(services ? [{ label: "Leistungen", value: services }] : []),
      ...(b.participant_count ? [{ label: "Personen", value: String(b.participant_count) }] : []),
      ...(euro(b.total_price) ? [{ label: "Preis", value: euro(b.total_price) }] : []),
      ...(euro(b.deposit_amount) ? [{ label: "Anzahlung", value: euro(b.deposit_amount) + (b.deposit_due ? ` bis ${deDate(String(b.deposit_due))}` : "") }] : []),
      ...contactDetails(b),
    ];
    const typeLabel = TYPE_LABEL[type] ?? "Termin";
    const mainCal = isBride ? CAL.wedding : type === "corporate" ? CAL.corporate : type === "workshop" || type === "academy" ? CAL.academy : CAL.private;
    const mainKind: Kind = isBride ? "wedding" : type === "corporate" ? "corporate" : type === "workshop" || type === "academy" ? "course" : "private";

    const days: { kind: "wedding" | "wedding2"; day: string; plan: unknown }[] = [];
    const mainDay = isBride ? (b.wedding_date as string | null) : ((b.event_date as string | null) ?? (b.wedding_date as string | null));
    if (mainDay) days.push({ kind: "wedding", day: mainDay, plan: b.zeitplan });
    if (b.wedding2_date) days.push({ kind: "wedding2", day: String(b.wedding2_date), plan: b.zeitplan2 });

    for (const d of days) {
      const plan = schedule(d.plan);
      const minutes = isBride ? 8 * 60 : 4 * 60;
      const t = timed(d.day, plan.first, minutes);
      if (!t.allDay && plan.last && plan.last > plan.first!) t.end = addMinutes(`${d.day}T${plan.last}`, 60);
      const title = isBride
        ? `${d.kind === "wedding2" ? "Hochzeit Tag 2" : "Hochzeit"} ${name}`.trim()
        : `${b.event_type ? String(b.event_type) : typeLabel} ${display}`.trim();
      const location = String(b.venue ?? b.service_location ?? "");
      push({
        sourceId: `brides:${id}:${d.kind}`,
        authoritative: true,
        title,
        notes: [plan.text ? `Zeitplan:\n${plan.text}` : "", notes].filter(Boolean).join("\n\n"),
        who: name,
        location,
        ...t,
        status: tentative ? "tentative" : "confirmed",
        kind: mainKind,
        names,
        calendar: mainCal,
        url,
        payload: {
          label: `Website · ${isBride ? (d.kind === "wedding2" ? "Hochzeit Tag 2" : "Hochzeit") : typeLabel}`,
          title, start: t.start, end: t.end, allDay: t.allDay, status,
          details: [...common, ...(location ? [{ label: "Ort", value: location }] : []), ...(plan.text ? [{ label: "Zeitplan", value: plan.text }] : [])],
        },
      });
    }

    if (b.probe_date) {
      const day = String(b.probe_date);
      const time = b.probe_time && /^\d{2}:\d{2}/.test(String(b.probe_time)) ? String(b.probe_time).slice(0, 5) : null;
      const t = timed(day, time, 3 * 60);
      const location = String(b.probe_ort ?? b.probe_ort_wunsch ?? "");
      const title = `Probetermin ${name}`.trim();
      push({
        sourceId: `brides:${id}:probe`,
        authoritative: true,
        title,
        notes: "",
        who: name,
        location,
        ...t,
        status: tentative ? "tentative" : "confirmed",
        kind: "trial",
        names,
        calendar: CAL.trial,
        url,
        payload: {
          label: "Website · Probetermin",
          title, start: t.start, end: t.end, allDay: t.allDay, status,
          details: [
            ...common,
            ...(b.probe_ort ? [{ label: "Ort", value: String(b.probe_ort) }] : []),
            ...(b.probe_ort_wunsch && b.probe_ort_wunsch !== b.probe_ort ? [{ label: "Wunschort der Braut", value: String(b.probe_ort_wunsch) }] : []),
            ...(mainDay ? [{ label: "Hochzeit am", value: deDate(mainDay) }] : []),
          ],
        },
      });
    }

    // Anzahlung offen?
    if (b.deposit_due && Number(b.deposit_amount) > 0) {
      const paid = Array.isArray(b.payments)
        ? (b.payments as Row[]).reduce((s, p) => s + (Number(p?.amount) || 0), 0)
        : 0;
      if (paid < Number(b.deposit_amount)) {
        const day = String(b.deposit_due);
        const title = `Anzahlung fällig: ${display}`;
        push({
          sourceId: `brides:${id}:deposit`,
          title, notes: "", who: name, location: "",
          start: `${day}T00:00`, end: `${addDays(day, 1)}T00:00`, allDay: true,
          status: "tentative", kind: "task", names, calendar: CAL.deadlines, url,
          payload: {
            label: "Website · Anzahlung", title, start: `${day}T00:00`, end: `${addDays(day, 1)}T00:00`, allDay: true,
            details: [{ label: "Betrag", value: euro(b.deposit_amount) }, { label: "Bereits gezahlt", value: euro(paid) || "0 €" }, ...contactDetails(b)],
          },
        });
      }
    }
  }

  // --- Lenas eigene Website-Kalendereinträge (inkl. archivierter Hochzeiten)
  for (const e of ownEvents) {
    const day = String(e.date);
    const cat = String(e.category_name ?? "");
    const start = `${day}T${String(e.start_time || "09:00").slice(0, 5)}`;
    let end = `${day}T${String(e.end_time || "10:00").slice(0, 5)}`;
    if (end <= start) end = addMinutes(start, 60);
    const calendar = /Hochzeit/.test(cat) ? CAL.wedding
      : /Probetermin/.test(cat) ? CAL.trial
      : /Friseur|JGA|Privat|Haar|Styling/i.test(cat) ? CAL.private
      : /Firm/i.test(cat) ? CAL.corporate
      : /Academy|Workshop|Kurs/i.test(cat) ? CAL.academy
      : CAL.personal;
    const kind: Kind = /Hochzeit/.test(cat) ? "wedding" : /Probe/.test(cat) ? "trial" : "other";
    const customer = String(e.customer_name ?? "");
    const title = String(e.title || cat || "Termin");
    push({
      sourceId: `lena_calendar_events:${e.id}`,
      authoritative: true,
      title, notes: String(e.note ?? ""), who: customer, location: String(e.location ?? ""),
      start, end, allDay: false, status: "confirmed", kind, names: [customer].filter(Boolean),
      calendar, url: `${SITE}/lena/brides?view=kalender`,
      payload: { label: `Website · ${cat || "Termin"}`, title, start, end, allDay: false, details: cat ? [{ label: "Kategorie", value: cat }] : [] },
    });
  }

  // --- Academy
  for (const a of academy) {
    const start = instantToBerlin(String(a.start_utc));
    const end = addMinutes(start, Number(a.duration_minutes) || 120);
    const status = String(a.status);
    const title = `${String(a.program_title ?? "Academy")} – ${String(a.full_name ?? "")}`.trim();
    push({
      sourceId: `academy_bookings:${a.id}`,
      authoritative: true,
      title, notes: String(a.note ?? ""), who: String(a.full_name ?? ""), location: String(a.location ?? ""),
      start, end, allDay: false, status: status === "requested" ? "tentative" : "confirmed",
      kind: "course", names: [String(a.full_name ?? "")], calendar: CAL.academy,
      url: `${SITE}/lena/academy?booking=${a.id}`,
      payload: {
        label: "Website · Academy", title, start, end, allDay: false, status,
        details: [
          { label: "Status", value: status === "requested" ? "angefragt" : status === "accepted" ? "bestätigt" : "durchgeführt" },
          ...(a.format ? [{ label: "Format", value: String(a.format) }] : []),
          ...(a.participants ? [{ label: "Teilnehmende", value: String(a.participants) }] : []),
          ...contactDetails(a),
        ],
      },
    });
  }

  // --- Offene Anfragen (unverbindlich)
  const inquiryWithOffer = new Set<string>();
  for (const i of inquiries) {
    if (!i.date) continue;
    const day = String(i.date);
    const name = String(i.name || [i.first_name, i.last_name].filter(Boolean).join(" ") || "Anfrage");
    const variant = String(i.variant ?? "wedding");
    if (i.offer_id) inquiryWithOffer.add(String(i.offer_id));
    const title = `Anfrage: ${name}`;
    const cal = variant === "wedding" ? CAL.wedding : variant === "corporate" ? CAL.corporate : variant === "workshop" ? CAL.academy : CAL.private;
    push({
      sourceId: `bride_inquiries:${i.id}`,
      title, notes: String(i.summary || i.message || ""), who: name, location: String(i.expected_location ?? ""),
      start: `${day}T00:00`, end: `${addDays(day, 1)}T00:00`, allDay: true, status: "tentative",
      kind: variant === "wedding" ? "wedding" : variant === "corporate" ? "corporate" : "other",
      names: [name, String(i.first_name ?? ""), String(i.last_name ?? "")].filter(Boolean),
      calendar: cal, url: `${SITE}/lena/inquiries`,
      payload: {
        label: "Website · Anfrage", title, start: `${day}T00:00`, end: `${addDays(day, 1)}T00:00`, allDay: true,
        status: String(i.status),
        details: [
          { label: "Status", value: i.status === "new" ? "neu" : "beantwortet" },
          { label: "Art", value: variant },
          ...(i.subject ? [{ label: "Betreff", value: String(i.subject) }] : []),
          ...(i.offer_number ? [{ label: "Angebot", value: `${i.offer_number}${i.offer_valid_until ? ` (gültig bis ${deDate(String(i.offer_valid_until))})` : ""}` }] : []),
          ...contactDetails(i),
        ],
      },
    });
  }

  // --- Offene Angebote: Termin (falls keine offene Anfrage ihn schon zeigt) + Ablauf-Frist
  for (const o of offers) {
    const name = String(o.recipient_name ?? "");
    const url = `${SITE}/lena/offers?offer=${o.id}`;
    const coveredByInquiry = inquiryWithOffer.has(String(o.id)) || ["new", "answered"].includes(String(o.inquiry_status ?? ""));
    if (o.event_date && !coveredByInquiry) {
      const day = String(o.event_date);
      const title = `Angebot offen: ${name}`;
      const type = String(o.customer_type ?? "bride");
      push({
        sourceId: `offers:${o.id}:event`,
        title, notes: "", who: name, location: "",
        start: `${day}T00:00`, end: `${addDays(day, 1)}T00:00`, allDay: true, status: "tentative",
        kind: type === "bride" ? "wedding" : type === "corporate" ? "corporate" : "other", names: [name],
        calendar: type === "bride" ? CAL.wedding : type === "corporate" ? CAL.corporate : CAL.private, url,
        payload: {
          label: "Website · Angebot", title, start: `${day}T00:00`, end: `${addDays(day, 1)}T00:00`, allDay: true,
          details: [
            { label: "Angebot", value: String(o.offer_number ?? "") },
            ...(euro(o.total_price) ? [{ label: "Summe", value: euro(o.total_price) }] : []),
            ...(o.valid_until ? [{ label: "Gültig bis", value: deDate(String(o.valid_until)) }] : []),
            ...(o.recipient_email ? [{ label: "E-Mail", value: String(o.recipient_email), href: `mailto:${o.recipient_email}` }] : []),
          ],
        },
      });
    }
    if (o.valid_until && String(o.valid_until) >= today) {
      const day = String(o.valid_until);
      const title = `Angebot läuft ab: ${name}`;
      push({
        sourceId: `offers:${o.id}:deadline`,
        title, notes: "", who: name, location: "",
        start: `${day}T00:00`, end: `${addDays(day, 1)}T00:00`, allDay: true, status: "tentative",
        kind: "task", names: [name], calendar: CAL.deadlines, url,
        payload: {
          label: "Website · Angebotsfrist", title, start: `${day}T00:00`, end: `${addDays(day, 1)}T00:00`, allDay: true,
          details: [{ label: "Angebot", value: String(o.offer_number ?? "") }, ...(o.event_date ? [{ label: "Für Termin am", value: deDate(String(o.event_date)) }] : [])],
        },
      });
    }
  }

  // --- Offene Rechnungen
  for (const inv of invoices) {
    if (!inv.due) continue;
    const day = String(inv.due);
    const name = String(inv.recipient_name ?? "");
    const title = `Zahlung fällig: ${name} (${euro(inv.amount_due)})`;
    push({
      sourceId: `invoices:${inv.id}`,
      title, notes: "", who: name, location: "",
      start: `${day}T00:00`, end: `${addDays(day, 1)}T00:00`, allDay: true, status: "tentative",
      kind: "task", names: [name], calendar: CAL.deadlines, url: `${SITE}/lena/invoices`,
      payload: {
        label: "Website · Rechnung", title, start: `${day}T00:00`, end: `${addDays(day, 1)}T00:00`, allDay: true,
        details: [
          { label: "Rechnung", value: String(inv.invoice_number ?? "") },
          { label: "Offen", value: euro(inv.amount_due) },
          { label: "Status", value: String(inv.status) },
        ],
      },
    });
  }

  // --- Geblockte Tage ohne Kundentermin + auf der Website angebotene Workshop-/JGA-Termine
  for (const d of blocked) {
    const day = String(d.date);
    const type = String(d.type);
    if (type === "blocked" && d.covered) continue;
    const label = String(d.label ?? "").trim();
    const title = type === "blocked" ? (label ? `Geblockt: ${label}` : "Geblockt") : `${type === "jga" ? "JGA" : "Workshop"}-Termin frei (Website)`;
    push({
      sourceId: `blocked_dates:${day}:${type}`,
      title, notes: "", who: "", location: "",
      start: `${day}T00:00`, end: `${addDays(day, 1)}T00:00`, allDay: true,
      status: type === "blocked" ? "confirmed" : "tentative",
      kind: "other", names: label ? [label] : [],
      calendar: CAL.availability, url: `${SITE}/lena/termine`,
      payload: { label: type === "blocked" ? "Website · geblockter Tag" : "Website · angebotener Termin", title, start: `${day}T00:00`, end: `${addDays(day, 1)}T00:00`, allDay: true },
    });
  }

  return { items, complete: true, windowStart, windowEnd, note: `Quelle: ${active.label} (${reason})` };
}
