# JM-SEARCH-MATCH-RADAR-01

**Status:** `READY FOR CONTROLLED MERGE REVIEW`

**Branch:** `feature/jm-search-match-radar-01`

**Implementation commit:** `999ac04`

**Base:** `origin/main` `91f92a4`

## 1. Ziel

Eine schwebende Cyan-Glass-Navigationsschiene rechts neben den
Suchergebnissen. Der native Browser-Scrollbalken bleibt unverändert.

## 2. Umsetzung

### Radar-Schiene

Neue Komponente `src/components/MatchRadar.tsx`:

- erscheint nur innerhalb der bestehenden `Results`-Komponente, wenn Treffer
  vorhanden sind;
- 20 bzw. alle vorhandenen Treffer erhalten eine Markierung;
- Markierungen werden aus den tatsächlichen Kartenpositionen im
  `#matches`-Bereich berechnet (relative Dokumentposition, keine
  Gleichverteilung nach Index);
- `ResizeObserver`, `MutationObserver` und `resize` berechnen Positionen bei
  Layoutänderungen neu;
- aktiver Treffer wird beim Scrollen markiert;
- Klick auf Markierung oder Hover-Titel scrollt mit Navbar-Abstand zur Karte;
- Mausrad über der Schiene navigiert zum nächsten/vorherigen Treffer und
  verhindert nur dort das native Scrollen;
- außerhalb der Schiene bleibt das normale Scrollverhalten unverändert.

### Hover-Titel

- maximal fünf benachbarte Jobtitel;
- aktiver Titel und aktive Markierung mit stärkerem Cyan-Glow;
- Titel werden per Ellipsis gekürzt;
- Cyan-Lichtpunkte und Verbindungslinien zur Schiene;
- `layoutRadarLabels()` verhindert Label-Überschneidungen und hält Labels in
  der Schiene;
- Titel verschwinden beim Verlassen der Schiene.

### Eingeklappte und neue Treffer

- `MatchCard` und `RemainingCard` tragen stabile
  `data-radar-job-id`-/`data-radar-job-title`-Attribute;
- beim Aktivieren des Radars werden die vorhandenen Ergebnislisten erweitert,
  danach werden die echten DOM-Positionen gemessen;
- neue Suchergebnisse ersetzen die Radar-Einträge über einen Job-/Layout-Key;
- bewertete Treffer und „weitere gefundene Stellen“ bleiben getrennt.

### Mobile und Accessibility

- Desktop: Hover, Mausrad, Klick und Tastatur;
- Mobile ≤ 900 px: kompakte Schaltfläche „Trefferübersicht“ mit scrollbarer
  Ergebnisliste, keine Hover-Abhängigkeit;
- keine automatischen Fokuswechsel;
- Reduced Motion: keine neuen Übergänge und direktes Scrollen;
- native Buttons, `aria-label`, `aria-current` und sichtbare Fokusindikatoren.

### Design

Cyan Intelligence Glass: schlanke Glasfläche, leuchtende Cyan-Markierungen,
Lichtverbindungen, aktiver Glow. Keine dauerhaft blinkenden Elemente und keine
Änderung des nativen Scrollbalkens.

## 3. Browser-E2E mit 20 Jobs

`tests/e2e/jm-search-match-radar-01.mjs` mit 20 synthetischen Stellen:

| Prüfung | Ergebnis |
|---|---|
| 20 Radar-Markierungen / 20 Karten | PASS |
| Marker-Reihenfolge = DOM-Kartenreihenfolge | PASS |
| Marker-Position = tatsächliche relative Kartenposition | PASS |
| Klick springt zur richtigen Karte | PASS |
| Mausrad vorwärts/rückwärts | PASS |
| Hover: 1–5 Labels, keine Überschneidung | PASS |
| Eingeklappte Liste + Radar-Aktivierung | PASS, 20 wiederhergestellt |
| Neue Suche ersetzt Radar-Einträge | PASS, Beta-Jobs |
| Normales Scrollen außerhalb der Schiene | PASS |
| AI-/Profile-/ATS-Aufrufe | **0** |
| `/api/jobs` | genau 2 (zwei Suchläufe) |
| Mobiles Panel 390/768 | 20 Einträge, Scrollen PASS |
| Horizontaler Overflow | 0 |

Screenshots:

```text
docs/reports/assets/JM-SEARCH-MATCH-RADAR-01/
├── radar-1920.webp
├── radar-1440.webp
├── radar-768.webp
├── radar-390.webp
├── radar-hover-1440.webp
├── radar-panel-768.webp
└── radar-panel-390.webp
```

## 4. Accessibility-Korrektur

Nach dem Visual Review wurde die Kombination aus `aria-hidden="true"` und
klickbaren `<button>`-Labels entfernt:

- die fünf Hover-Titel sind jetzt rein dekorative, nicht fokussierbare
  `<span>`-Elemente innerhalb der `aria-hidden`-Schicht;
- Klick auf einen Titel bleibt für Mausnutzer erhalten;
- alle 20 Radar-Markierungen bleiben echte `<button>`-Elemente mit
  `aria-label` und sind vollständig per Tastatur und Screenreader bedienbar;
- keine automatische Fokussetzung beim Öffnen/Hover;
- mobiles Trefferpanel: Escape schließt es und setzt den Fokus auf den
  Auslöser zurück; auch ein Treffer-Klick führt den Fokus sinnvoll zurück;
- ein zusätzlicher Komponententest prüft Escape und Fokus-Rückkehr;
- Browser-E2E prüft `aria-hidden` ohne fokussierbare Labels, fokussierbare
  Marker und die Fokus-Rückkehr auf 390/768 px.

## 5. Tests und Build

| Prüfung | Ergebnis |
|---|---|
| MatchRadar-/MatchCard-/RemainingCard-/Results-Tests | **38 PASS** |
| Volle Vitest-Suite, seriell | **2041 PASS / 5 skipped** |
| Production build | PASS |
| `git diff --check` | PASS |
| Secret-Scan | PASS |

## 6. Grenzen

- Keine neuen Suchanfragen, keine KI-Bewertung, keine ATS-Aufrufe.
- Keine Änderung an Jobdaten, Matching, Cards, Modal-Logik oder nativen
  Scrollbalken.
- Keine RIS-/AWS-/Cognito-/Consent-/Storage-Änderung.
- Kein Main-Merge und kein Production-Deployment.

`READY FOR CONTROLLED MERGE REVIEW`
