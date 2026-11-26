"use client";

import dynamic from "next/dynamic";

// Der Kalender hängt komplett von "heute" und lokalen Daten ab → nur im Browser rendern.
// Die statische Hülle (Hintergrund, Ladeanzeige) kommt sofort und ist offline verfügbar.
const CalendarApp = dynamic(() => import("./CalendarApp"), {
  ssr: false,
  loading: () => (
    <div className="app-shell">
      <div className="topbar" style={{ height: 64 }} />
      <div className="month-panel glass" style={{ display: "grid", placeItems: "center" }}>
        <span className="spinner" />
      </div>
    </div>
  ),
});

export default function ClientApp() {
  return <CalendarApp />;
}
