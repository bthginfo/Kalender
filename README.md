# Lenas Kalender

Moderne Kalender-Web-App für Magdalena (Lena) – Nachfolger von Kalender.digital.
Läuft im Browser, ist als PWA auf dem iPhone installierbar („Teilen → Zum Home-Bildschirm“) und
führt automatisch alle relevanten Termine aus **DigitalMask** (Theater) und **magdalenajohanna.com**
(Hochzeiten, Probetermine, Kundinnen, Academy, Fristen) zusammen – ohne Dubletten.

- Produktion: https://magdalena-kalender.vercel.app
- Vercel-Projekt: `magdalena-kalender` (Team juliusvingelheim-2692s-projects, Region fra1)
- Datenbank: Neon Postgres (Free, Frankfurt), über den Vercel Marketplace verbunden

## Funktionen

- **Monatsansicht wie Kalender.digital**, nur moderner: jede Zelle zeigt die Termine mit Uhrzeit
  („10 Probe Anna“), mehrtägige/ganztägige Termine als durchgehende Balken, „+N“ bei Überlauf,
  Kalenderwochen, Wischen zum Monatswechsel, langes Drücken auf einen Tag → neuer Termin.
- **Liquid-Glass-Design** im iOS-Stil, heller & dunkler Modus automatisch, Safe-Areas fürs iPhone.
- **Schnelleingabe in natürlicher Sprache**: „Probe Anna morgen 10:30 in Ingolstadt“ →
  Datum, Uhrzeit, Ort und Kalender werden automatisch erkannt (auch „Fr 14-16 Uhr“, „12.3.“,
  „in 2 Wochen“, „ganztägig“, „#Hochzeiten“, „90 min“).
- **Unterkalender mit Farben** (aus Kalender.digital übernommen): ein-/ausblenden, umbenennen,
  Farbe, Standarddauer, neue anlegen, löschen (mit Verschieben der Termine).
- **Liste** (ab heute, mit „Heute/Morgen/In 3 Tagen“), **Jahresübersicht** mit Farbpunkten,
  **Suche** über Titel, Personen, Orte, Notizen und alle Quellen-Infos (z. B. Telefonnummer).
- **Termin-Details** mit allen Infos aus den Quellen (Kontakt mit Anruf/Mail-Links, Zeitplan,
  Leistungen, Preis, Anzahlung, Produktion, Kolleginnen …) und Direktlink in DigitalMask bzw. das
  Website-Backoffice; Ort öffnet Apple/Google Maps.
- Duplizieren, Teilen als .ics, Löschen mit **Rückgängig**, Status fix/vorläufig/abgesagt.
- **Abo-Link (webcal)** für Apple-/Google-Kalender → Termine auch in Widgets & auf der Watch.
- **Offline-fähig** (Service Worker + lokaler Cache), Tastaturkürzel am Desktop
  (←/→ Monat, t heute, n neu, / suchen, m/l/j Ansicht).
- Login mit Passwort (Env `APP_PASSWORD`), Sitzung bleibt 400 Tage auf dem Gerät.

## Datenquellen & Abgleich

Der Abgleich läuft als privater Vercel-Schedule (`vercel.json` → `sync-sources`, alle 30 Minuten
von 6–23 Uhr Berliner Zeit) und kann in den Einstellungen manuell gestartet werden.
Alle Quellen werden **nur gelesen**.

| Quelle | Was wird übernommen |
| --- | --- |
| Kalender.digital (`KD_CAPABILITY_ID`) | alle Termine aller Unterkalender inkl. Notizen, Wer, Ort. Erstimport komplett, danach laufend (−6 bis +36 Monate), damit nichts verloren geht, solange Lena noch beide nutzt. |
| DigitalMask (`DIGITALMASK_DATABASE_URL`, `DIGITALMASK_USER_ID`) | Einträge, bei denen Lena (Magdalena Bauer) Teilnehmerin ist – inkl. Serien, Produktion, Kolleginnen, Ort; ihre offenen Aufgaben mit Fälligkeit; offene Freiwünsche. Freie Tage (Ruhetag, Feiertag, HFT, ABF, Urlaub) landen im Kalender „Theater · frei“. |
| magdalenajohanna.com (`MJ_WEBSITE_DATABASE_URL`, `MJ_NEXT_DATABASE_URL`) | Hochzeiten (Tag 1 & 2 mit Zeitplan), Probetermine, Events von Firmen-/Privatkundinnen, Lenas Website-Termine, Academy-Buchungen, offene Anfragen & Angebote (vorläufig), Angebotsfristen, Anzahlungen, offene Rechnungen, geblockte Tage (Kalender „Website: Verfügbarkeit“, standardmäßig ausgeblendet). |

**Umzug der Website auf `magdalenajohanna-next`:** Der Sync prüft bei jedem Lauf, welches Projekt
unter www.magdalenajohanna.com live ist (Next.js- vs. Vite-Assets) und liest dessen Datenbank.
Weil beide Projekte dieselben IDs verwenden (`<tabelle>:<uuid>`), entstehen beim Wechsel keine
Dubletten. Falls das Next-Projekt später eine andere Datenbank bekommt, nur `MJ_NEXT_DATABASE_URL`
aktualisieren. Mit `MJ_ACTIVE=website|next` lässt sich die Quelle fest einstellen.

### Dubletten-Erkennung

Termine aus verschiedenen Quellen werden per Punktesystem abgeglichen (`lib/sync/match.ts`):
gleicher Tag ist Pflicht, dazu Namen (inkl. Spitznamen „Susi/Susanne“, Tippfehler
„Pheoung/Phuong“), Art des Termins (Hochzeit/Probe/Theater …), Uhrzeit-Nähe, Ort und
„allgemeine Titel“ wie „Hochzeit“ oder „Theater“. Ab 0,5 Punkten wird automatisch
zusammengeführt (der Termin bekommt die Infos der Quelle dazu, Lenas Titel/Zeit bleiben),
zwischen 0,35 und 0,5 landet das Paar in **Einstellungen → Mögliche Dubletten**. Jede automatische
Zusammenführung kann im Termin per „Trennen“ rückgängig gemacht werden. Theaterdienste dürfen
mehrere DigitalMask-Einträge pro Tag auf einen Kalender.digital-Eintrag abbilden
(„Tagesdienst“ + „Vorstellung“ = Lenas Eintrag „Gym“).

Lokale Änderungen an importierten Terminen bleiben erhalten (die Quelle überschreibt sie nicht
mehr); gelöschte Termine kommen nicht zurück.

## Entwicklung

```bash
vercel env pull .env.local   # Zugangsdaten holen
npm install
npm run db:migrate           # Schema anlegen/aktualisieren (idempotent)
npm run dev
```

Struktur: `app/api/*` (Route Handler), `lib/sync/*` (Quellen, Engine, Dubletten), `components/*`
(UI), `db/schema.sql`, `public/sw.js` (Service Worker), `scripts/` (Migration, Icons).

### Umgebungsvariablen

`DATABASE_URL` (Neon, automatisch), `APP_PASSWORD`, `SESSION_SECRET`, `ICS_TOKEN`,
`KD_CAPABILITY_ID`, `DIGITALMASK_DATABASE_URL`, `DIGITALMASK_USER_ID`,
`MJ_WEBSITE_DATABASE_URL`, `MJ_NEXT_DATABASE_URL`, `MJ_ACTIVE` (auto|website|next).
