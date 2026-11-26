"use client";

import { useMemo, useState } from "react";
import { PALETTE } from "@/lib/color";
import type { Calendar, CalEvent } from "@/lib/types";
import Sheet from "./Sheet";
import { IconPlus, IconTrash } from "./icons";

type Props = {
  calendars: Calendar[];
  events: CalEvent[];
  onUpdate: (id: string, patch: Partial<Pick<Calendar, "name" | "color" | "visible" | "defaultMinutes">>) => Promise<unknown>;
  onCreate: (name: string, color?: string) => Promise<unknown>;
  onDelete: (id: string, moveTo: string | null) => Promise<unknown>;
  onClose: () => void;
};

export default function CalendarsSheet({ calendars, events, onUpdate, onCreate, onDelete, onClose }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[7]);
  const [moveTo, setMoveTo] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) m.set(e.calendarId, (m.get(e.calendarId) ?? 0) + 1);
    return m;
  }, [events]);
  const allVisible = calendars.every((c) => c.visible);

  return (
    <Sheet
      onClose={onClose}
      title="Kalender"
      actions={
        <button
          className="btn btn-quiet"
          style={{ height: 34, padding: "0 12px", fontSize: 13 }}
          onClick={() => calendars.forEach((c) => c.visible === allVisible && onUpdate(c.id, { visible: !allVisible }))}
        >
          {allVisible ? "Alle aus" : "Alle an"}
        </button>
      }
    >
      <div className="group">
        {calendars.map((c) => (
          <div key={c.id}>
            <div className="row">
              <button
                aria-label="Farbe & Einstellungen"
                onClick={() => { setOpen(open === c.id ? null : c.id); setMoveTo(""); setErr(null); }}
                style={{ width: 28, height: 28, borderRadius: 99, border: 0, background: c.color, flexShrink: 0, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12), 0 4px 10px -4px " + c.color }}
              />
              <button onClick={() => { setOpen(open === c.id ? null : c.id); setMoveTo(""); setErr(null); }} style={{ flex: 1, border: 0, background: "transparent", textAlign: "left", padding: 0 }}>
                <div style={{ fontWeight: 600, opacity: c.visible ? 1 : 0.5 }}>{c.name}</div>
                <div className="tiny">{counts.get(c.id) ?? 0} Termine{c.visible ? "" : " · ausgeblendet"}</div>
              </button>
              <label className="switch" aria-label={`${c.name} anzeigen`}>
                <input type="checkbox" checked={c.visible} onChange={(e) => onUpdate(c.id, { visible: e.target.checked })} />
                <span />
              </label>
            </div>
            {open === c.id && (
              <div style={{ padding: "4px 14px 14px", animation: "rise .25s ease both" }}>
                <input
                  defaultValue={c.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && onUpdate(c.id, { name: e.target.value })}
                  className="dt-field"
                  style={{ width: "100%", textAlign: "left", color: "var(--ink)", background: "var(--hair)" }}
                  aria-label="Name"
                />
                <div className="swatches">
                  {PALETTE.map((p) => (
                    <button key={p} aria-label={p} aria-pressed={p.toLowerCase() === c.color.toLowerCase()} style={{ background: p, color: p }} onClick={() => onUpdate(c.id, { color: p })} />
                  ))}
                </div>
                <div className="row" style={{ padding: "6px 0" }}>
                  <span className="muted" style={{ flex: 1, fontSize: 14 }}>Standarddauer</span>
                  <select
                    value={c.defaultMinutes}
                    onChange={(e) => onUpdate(c.id, { defaultMinutes: Number(e.target.value) })}
                    className="dt-field"
                    style={{ flex: "none" }}
                  >
                    {[30, 45, 60, 90, 120, 180, 240, 480].map((m) => (
                      <option key={m} value={m}>{m < 60 ? `${m} Min.` : `${m / 60} Std.`.replace(".5", ",5")}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                  {(counts.get(c.id) ?? 0) > 0 && (
                    <select className="dt-field" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} style={{ flex: 1, textAlign: "left" }}>
                      <option value="">Termine verschieben nach …</option>
                      {calendars.filter((x) => x.id !== c.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  )}
                  <button
                    className="btn btn-danger"
                    style={{ height: 36, padding: "0 14px", fontSize: 13.5 }}
                    onClick={async () => {
                      setErr(null);
                      if ((counts.get(c.id) ?? 0) > 0 && !moveTo) { setErr("Bitte zuerst einen Zielkalender wählen"); return; }
                      if (!confirm(`Kalender „${c.name}“ löschen?`)) return;
                      try { await onDelete(c.id, moveTo || null); setOpen(null); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
                    }}
                  >
                    <IconTrash style={{ width: 16, height: 16 }} /> Löschen
                  </button>
                </div>
                {err && <p style={{ color: "var(--danger)", fontSize: 13, margin: "8px 0 0" }}>{err}</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="section-title">Neuer Unterkalender</div>
      <div className="group">
        <div className="row">
          <span style={{ width: 22, height: 22, borderRadius: 99, background: newColor, flexShrink: 0 }} />
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="z. B. Shootings, Academy, Urlaub" />
          <button
            className="icon-btn"
            style={{ background: "var(--accent)", color: "var(--accent-ink)", width: 34, height: 34 }}
            disabled={!newName.trim()}
            aria-label="Kalender anlegen"
            onClick={async () => { await onCreate(newName.trim(), newColor); setNewName(""); }}
          >
            <IconPlus style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <div className="swatches" style={{ padding: "0 14px 12px" }}>
          {PALETTE.map((p) => (
            <button key={p} aria-label={p} aria-pressed={p === newColor} style={{ background: p, color: p }} onClick={() => setNewColor(p)} />
          ))}
        </div>
      </div>
      <p className="tiny" style={{ margin: "12px 6px 0", lineHeight: 1.45 }}>
        Ausgeblendete Kalender verschwinden aus allen Ansichten, bleiben aber erhalten. „Website: Verfügbarkeit“ zeigt die auf der
        Website geblockten Tage – standardmäßig aus.
      </p>
    </Sheet>
  );
}
