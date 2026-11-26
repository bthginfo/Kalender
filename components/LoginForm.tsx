"use client";

import { useState } from "react";

export default function LoginForm() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      const next = new URLSearchParams(location.search).get("next");
      location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return;
    }
    const data = await res.json().catch(() => ({}));
    setErr(data.error ?? "Anmeldung fehlgeschlagen");
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="login-card glass">
      <img src="/icons/icon.svg" alt="" width={72} height={72} style={{ display: "block", margin: "0 auto 14px", borderRadius: 18, boxShadow: "0 14px 30px -12px rgba(150,60,40,.55)" }} />
      <h1 style={{ textAlign: "center", fontSize: 26, fontWeight: 760, letterSpacing: "-0.025em", margin: "0 0 4px" }}>Lenas Kalender</h1>
      <p className="muted" style={{ textAlign: "center", margin: "0 0 22px", fontSize: 14.5 }}>Hochzeiten, Probetermine, Theater & Privates</p>
      <div className="group">
        <div className="row">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Passwort"
            autoComplete="current-password"
            autoFocus
            aria-label="Passwort"
          />
        </div>
      </div>
      {err && <p style={{ color: "var(--danger)", fontWeight: 600, fontSize: 14, margin: "10px 4px 0" }}>{err}</p>}
      <button className="btn btn-accent" type="submit" disabled={busy || !pw} style={{ width: "100%", marginTop: 16 }}>
        {busy ? <span className="spinner" style={{ borderTopColor: "currentColor" }} /> : "Öffnen"}
      </button>
      <p className="tiny" style={{ textAlign: "center", marginTop: 14 }}>Du bleibst auf diesem Gerät angemeldet.</p>
    </form>
  );
}
