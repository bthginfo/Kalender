"use client";

import { useState } from "react";
import { diffDays, eventDays, fmtDayLong, fmtDayMedium, fmtDuration, diffMinutes, timeRangeLabel } from "@/lib/date";
import { strong } from "@/lib/color";
import { eventToIcs } from "@/lib/ics";
import type { Calendar, CalEvent, SourceRef } from "@/lib/types";
import Sheet from "./Sheet";
import { SOURCE_LABEL } from "./EventCard";
import { IconClock, IconCopy, IconEdit, IconLink, IconNote, IconPerson, IconPin, IconShare, IconTrash, IconMerge } from "./icons";

type Props = {
  ev: CalEvent;
  cal: Calendar | undefined;
  today: string;
  dark: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSplit: (src: SourceRef) => Promise<void>;
  onClose: () => void;
};

function mapsUrl(q: string) {
  const apple = typeof navigator !== "undefined" && /iPhone|iPad|Macintosh/.test(navigator.userAgent);
  return apple ? `https://maps.apple.com/?q=${encodeURIComponent(q)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function relative(day: string, today: string) {
  const n = diffDays(today, day);
  if (n === 0) return "heute";
  if (n === 1) return "morgen";
  if (n === -1) return "gestern";
  if (n > 0) return n < 14 ? `in ${n} Tagen` : n < 60 ? `in ${Math.round(n / 7)} Wochen` : `in ${Math.round(n / 30)} Monaten`;
  return -n < 14 ? `vor ${-n} Tagen` : -n < 60 ? `vor ${Math.round(-n / 7)} Wochen` : `vor ${Math.round(-n / 30)} Monaten`;
}

/** Telefonnummern, Mails und Links im Freitext klickbar machen */
function Linkify({ text }: { text: string }) {
  const parts = text.split(/((?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s/()-]{7,}\d)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (/^(https?:\/\/|www\.)/.test(p)) return <a key={i} href={p.startsWith("www.") ? `https://${p}` : p} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{p}</a>;
        if (/@/.test(p) && /^[\w.+-]+@/.test(p)) return <a key={i} href={`mailto:${p}`} style={{ color: "var(--accent)" }}>{p}</a>;
        if (/^\+?\d[\d\s/()-]{7,}\d$/.test(p)) return <a key={i} href={`tel:${p.replace(/[^\d+]/g, "")}`} style={{ color: "var(--accent)" }}>{p}</a>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

export default function EventSheet({ ev, cal, today, dark, onEdit, onDuplicate, onDelete, onSplit, onClose }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const color = cal?.color ?? "#999";
  const days = eventDays(ev);
  const first = days[0];
  const last = days[days.length - 1];
  const dateLine = days.length > 1 ? `${fmtDayMedium(first)} – ${fmtDayMedium(last)}` : fmtDayLong(first);
  const duration = !ev.allDay ? diffMinutes(ev.start, ev.end) : 0;

  const share = async () => {
    const ics = eventToIcs(ev);
    const file = new File([ics], `${ev.title.replace(/[^\wäöüÄÖÜß -]/g, "").slice(0, 40) || "termin"}.ics`, { type: "text/calendar" });
    const text = `${ev.title}\n${dateLine}, ${timeRangeLabel(ev)}${ev.location ? `\n${ev.location}` : ""}`;
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: ev.title, text });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: ev.title, text });
        return;
      }
    } catch {
      return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet onClose={onClose} title=" " z={1}>
      <div style={{ padding: "0 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="badge" style={{ color: strong(color, dark), background: `color-mix(in srgb, ${color} 18%, transparent)`, fontSize: 12, padding: "4px 10px" }}>
            <span className="dot" style={{ background: color, width: 8, height: 8 }} /> {cal?.name}
          </span>
          {ev.status === "tentative" && <span className="badge" style={{ fontSize: 12, padding: "4px 10px" }}>vorläufig</span>}
          {ev.status === "cancelled" && <span className="badge" style={{ fontSize: 12, padding: "4px 10px", color: "var(--danger)" }}>abgesagt</span>}
        </div>
        <h1 style={{ fontSize: 26, lineHeight: 1.18, fontWeight: 760, letterSpacing: "-0.025em", margin: "12px 0 6px", textDecoration: ev.status === "cancelled" ? "line-through" : undefined, overflowWrap: "anywhere" }}>
          {ev.title}
        </h1>
        <div style={{ fontSize: 15.5, fontWeight: 600 }}>{dateLine}</div>
        <div className="muted" style={{ fontSize: 15, marginTop: 2 }}>
          {timeRangeLabel(ev)}
          {duration > 0 && ` · ${fmtDuration(duration)}`}
          <span style={{ color: "var(--accent)", fontWeight: 600 }}> · {relative(first, today)}</span>
        </div>
      </div>

      {(ev.who || ev.location || ev.notes) && (
        <div className="group" style={{ marginTop: 18 }}>
          {ev.who && (
            <div className="row" style={{ alignItems: "flex-start" }}>
              <IconPerson style={{ width: 20, height: 20, color: "var(--ink-3)", marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}><Linkify text={ev.who} /></div>
            </div>
          )}
          {ev.location && (
            <a className="row link-row" href={mapsUrl(ev.location)} target="_blank" rel="noreferrer">
              <IconPin style={{ width: 20, height: 20, color: "var(--ink-3)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>{ev.location}</div>
              <span className="tiny" style={{ color: "var(--accent)", fontWeight: 650 }}>Karte</span>
            </a>
          )}
          {ev.notes && (
            <div className="row" style={{ alignItems: "flex-start" }}>
              <IconNote style={{ width: 20, height: 20, color: "var(--ink-3)", marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, whiteSpace: "pre-wrap", lineHeight: 1.45, fontSize: 14.5 }}><Linkify text={ev.notes} /></div>
            </div>
          )}
        </div>
      )}

      {ev.sources.length > 0 && (
        <>
          <div className="section-title">Infos aus den Quellen</div>
          {ev.sources.map((s) => {
            const p = s.payload ?? {};
            const differentTime = p.start && (p.start !== ev.start || (p.end && p.end !== ev.end));
            return (
              <div key={`${s.source}:${s.sourceId}`} className="group" style={{ marginBottom: 10 }}>
                <div className="row" style={{ minHeight: 44 }}>
                  <IconLink style={{ width: 18, height: 18, color: "var(--ink-3)", flexShrink: 0 }} />
                  <div style={{ flex: 1, fontWeight: 650, fontSize: 14.5 }}>{p.label ?? SOURCE_LABEL[s.source] ?? s.source}</div>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noreferrer" className="btn btn-quiet" style={{ height: 30, padding: "0 12px", fontSize: 13 }}>
                      Öffnen
                    </a>
                  )}
                </div>
                {p.title && p.title !== ev.title && (
                  <div className="row"><span className="label">Titel</span><span style={{ flex: 1, fontSize: 14.5 }}>{p.title}</span></div>
                )}
                {differentTime && p.start && (
                  <div className="row">
                    <IconClock style={{ width: 18, height: 18, color: "var(--ink-3)", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14.5 }}>
                      Laut Quelle: {p.allDay ? "ganztägig" : `${fmtDayMedium(p.start.slice(0, 10))}, ${p.start.slice(11)}${p.end ? `–${p.end.slice(11)}` : ""}`}
                    </span>
                  </div>
                )}
                {(p.details ?? []).map((d, i) => (
                  <div key={i} className="row" style={{ alignItems: "flex-start" }}>
                    <span className="label" style={{ paddingTop: 1 }}>{d.label}</span>
                    <span style={{ flex: 1, fontSize: 14.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                      {d.href ? <a href={d.href} style={{ color: "var(--accent)", fontWeight: 600 }}>{d.value}</a> : d.value}
                    </span>
                  </div>
                ))}
                {s.matchType === "matched" && (
                  <div className="row" style={{ alignItems: "center" }}>
                    <IconMerge style={{ width: 18, height: 18, color: "var(--ink-3)", flexShrink: 0 }} />
                    <span className="tiny" style={{ flex: 1 }}>Automatisch zusammengeführt ({s.matchReason})</span>
                    <button
                      className="btn btn-quiet"
                      style={{ height: 30, padding: "0 12px", fontSize: 13 }}
                      disabled={busy === s.sourceId}
                      onClick={async () => { setBusy(s.sourceId); await onSplit(s); setBusy(null); }}
                    >
                      Trennen
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
        <button className="btn btn-accent" onClick={onEdit} style={{ gridColumn: "1 / -1" }}>
          <IconEdit style={{ width: 18, height: 18 }} /> Bearbeiten
        </button>
        <button className="btn btn-quiet" onClick={onDuplicate}>
          <IconCopy style={{ width: 18, height: 18 }} /> Duplizieren
        </button>
        <button className="btn btn-quiet" onClick={share}>
          <IconShare style={{ width: 18, height: 18 }} /> Teilen
        </button>
        <button className="btn btn-danger" onClick={onDelete} style={{ gridColumn: "1 / -1" }}>
          <IconTrash style={{ width: 18, height: 18 }} /> Löschen
        </button>
      </div>
    </Sheet>
  );
}
