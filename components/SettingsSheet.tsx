"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtDayMedium, timeRangeLabel } from "@/lib/date";
import type { Calendar, CalEvent, DuplicatePair, SyncSourceStatus } from "@/lib/types";
import Sheet from "./Sheet";
import { api } from "./useData";
import { SOURCE_LABEL } from "./EventCard";
import { IconCheck, IconCopy, IconMerge, IconSync } from "./icons";

type Props = {
  calById: Map<string, Calendar>;
  openDuplicates: number;
  onChanged: () => Promise<void>;
  onEventTap: (ev: CalEvent) => void;
  onClose: () => void;
};

function ago(iso: string) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.round(h / 24)} Tagen`;
}

function MiniEvent({ ev, cal, onClick }: { ev: CalEvent; cal?: Calendar; onClick: () => void }) {
  return (
    <button onClick={onClick} className="press" style={{ flex: 1, minWidth: 0, textAlign: "left", border: 0, borderRadius: 14, padding: "9px 10px", background: "var(--cell-bg)", boxShadow: "inset 0 0 0 .5px var(--hair)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="dot" style={{ background: cal?.color }} />
        <span className="tiny" style={{ fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cal?.name}</span>
      </div>
      <div style={{ fontWeight: 650, fontSize: 14, marginTop: 4, overflowWrap: "anywhere" }}>{ev.title}</div>
      <div className="tiny" style={{ marginTop: 2 }}>{fmtDayMedium(ev.start.slice(0, 10))} · {timeRangeLabel(ev)}</div>
      <div className="tiny">{[...new Set(ev.sources.map((s) => SOURCE_LABEL[s.source] ?? s.source))].join(", ") || "Hier erstellt"}</div>
    </button>
  );
}

export default function SettingsSheet({ calById, openDuplicates, onChanged, onEventTap, onClose }: Props) {
  const [status, setStatus] = useState<SyncSourceStatus[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [dups, setDups] = useState<DuplicatePair[] | null>(null);
  const [icsUrl, setIcsUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadStatus = useCallback(async () => setStatus(await api<SyncSourceStatus[]>("/api/sync")), []);
  const loadDups = useCallback(async () => setDups(await api<DuplicatePair[]>("/api/duplicates")), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Daten beim Öffnen laden
    loadStatus().catch(() => {});
    api<{ icsUrl: string | null }>("/api/settings").then((s) => setIcsUrl(s.icsUrl)).catch(() => {});
    if (openDuplicates > 0) loadDups().catch(() => {});
  }, [loadStatus, loadDups, openDuplicates]);

  const runSync = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      const r = await api<{ busy: boolean; results: { source: string; created: number; updated: number; matched: number; ok: boolean }[]; status: SyncSourceStatus[] }>("/api/sync", { method: "POST", body: "{}" });
      if (r.busy) setMsg("Ein Abgleich läuft gerade schon – gleich nochmal versuchen.");
      else {
        const c = r.results.reduce((s, x) => s + x.created, 0);
        const u = r.results.reduce((s, x) => s + x.updated, 0);
        const m = r.results.reduce((s, x) => s + x.matched, 0);
        setMsg(c + u + m === 0 ? "Alles aktuell ✓" : `${c} neu · ${u} aktualisiert · ${m} zusammengeführt`);
        setStatus(r.status);
      }
      await onChanged();
      if (openDuplicates > 0) await loadDups();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Fehler beim Abgleich");
    } finally {
      setSyncing(false);
    }
  };

  const resolve = async (body: object) => {
    await api("/api/duplicates", { method: "POST", body: JSON.stringify(body) });
    await Promise.all([loadDups(), onChanged()]);
  };

  const isIOS = typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent);
  const standalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone);

  return (
    <Sheet onClose={onClose} title="Einstellungen">
      <div className="section-title" style={{ marginTop: 6 }}>Automatischer Abgleich</div>
      <div className="group">
        {(status ?? []).map((s) => (
          <div className="row" key={s.source} style={{ alignItems: "flex-start" }}>
            <span className="dot" style={{ marginTop: 6, background: !s.configured ? "var(--ink-3)" : s.lastRun?.ok === false ? "var(--danger)" : "#34c759" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 650 }}>{s.label}</div>
              <div className="tiny" style={{ lineHeight: 1.45 }}>
                {!s.configured
                  ? "nicht verbunden"
                  : s.lastRun
                    ? `${ago(s.lastRun.startedAt)} · ${s.lastRun.fetched} Einträge · ${s.lastRun.created} neu · ${s.lastRun.matched} zusammengeführt${s.lastRun.updated ? ` · ${s.lastRun.updated} aktualisiert` : ""}`
                    : "noch nicht gelaufen"}
                {s.lastRun?.message && <><br />{s.lastRun.message}</>}
              </div>
            </div>
          </div>
        ))}
        {!status && <div className="row"><span className="spinner" /></div>}
        <div className="row">
          <button className="btn btn-quiet" onClick={runSync} disabled={syncing} style={{ width: "100%", height: 40 }}>
            {syncing ? <span className="spinner" /> : <IconSync style={{ width: 18, height: 18 }} />}
            {syncing ? "Gleiche ab …" : "Jetzt abgleichen"}
          </button>
        </div>
      </div>
      {msg && <p className="tiny" style={{ margin: "8px 6px 0", fontWeight: 600 }}>{msg}</p>}
      <p className="tiny" style={{ margin: "8px 6px 0", lineHeight: 1.45 }}>
        Läuft automatisch alle 30 Minuten (6–23 Uhr). Termine, die es schon gibt, werden erkannt und zusammengeführt – auch wenn Titel
        oder Uhrzeit leicht abweichen.
      </p>

      <div className="section-title">Mögliche Dubletten {openDuplicates > 0 && `(${openDuplicates})`}</div>
      {openDuplicates === 0 ? (
        <div className="group"><div className="row"><IconCheck style={{ width: 18, height: 18, color: "#34c759" }} /><span className="muted">Nichts zu prüfen</span></div></div>
      ) : (
        (dups ?? []).map((p) => (
          <div key={`${p.a.id}-${p.b.id}`} className="group" style={{ padding: 10, marginBottom: 10 }}>
            <div className="tiny" style={{ margin: "0 4px 8px" }}>{p.reason}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <MiniEvent ev={p.a} cal={calById.get(p.a.calendarId)} onClick={() => onEventTap(p.a)} />
              <MiniEvent ev={p.b} cal={calById.get(p.b.calendarId)} onClick={() => onEventTap(p.b)} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-accent" style={{ flex: 1, height: 38, fontSize: 14 }} onClick={() => resolve({ action: "merge", keepId: p.a.id, dropId: p.b.id })}>
                <IconMerge style={{ width: 16, height: 16 }} /> Zusammenführen
              </button>
              <button className="btn btn-quiet" style={{ flex: 1, height: 38, fontSize: 14 }} onClick={() => resolve({ action: "dismiss", aId: p.a.id, bId: p.b.id })}>
                Beide behalten
              </button>
            </div>
          </div>
        ))
      )}

      <div className="section-title">Im iPhone-Kalender anzeigen</div>
      <div className="group">
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1, fontSize: 14, lineHeight: 1.45 }} className="muted">
            Abo-Link für Apple- oder Google-Kalender (z. B. für Widgets & Apple Watch). Aktualisiert sich automatisch, nur lesend.
          </div>
        </div>
        {icsUrl && (
          <div className="row" style={{ gap: 8 }}>
            <a className="btn btn-quiet" style={{ flex: 1, height: 40, fontSize: 14 }} href={icsUrl.replace(/^https?:/, "webcal:")}>Abonnieren</a>
            <button
              className="btn btn-quiet"
              style={{ height: 40, fontSize: 14 }}
              onClick={async () => { await navigator.clipboard.writeText(icsUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
            >
              {copied ? <IconCheck style={{ width: 16, height: 16 }} /> : <IconCopy style={{ width: 16, height: 16 }} />} {copied ? "Kopiert" : "Link"}
            </button>
          </div>
        )}
      </div>

      {!standalone && (
        <>
          <div className="section-title">Als App installieren</div>
          <div className="group">
            <div className="row muted" style={{ fontSize: 14, lineHeight: 1.45 }}>
              {isIOS
                ? "In Safari unten auf „Teilen“ tippen → „Zum Home-Bildschirm“. Dann startet der Kalender wie eine echte App – im Vollbild und offline."
                : "Im Browser-Menü „App installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen."}
            </div>
          </div>
        </>
      )}

      <button
        className="btn btn-danger"
        style={{ width: "100%", marginTop: 22 }}
        onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); localStorage.removeItem("mk_cache_v1"); location.href = "/login"; }}
      >
        Abmelden
      </button>
    </Sheet>
  );
}
