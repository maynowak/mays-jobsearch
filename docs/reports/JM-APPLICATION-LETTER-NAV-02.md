# JM-APPLICATION-LETTER-NAV-02

**Art:** Bewerbungsverwaltung / Anschreiben-Navigation nach Speicherung und Entwurfsübernahme
**Status:** READY für lokale Main-Integration — kein Push, Merge oder Deployment
**Datum:** 2026-11-04
**Branch:** `feature/jm-application-letter-nav-02`
**Baseline:** `feature/jm-application-letter-options-01` `8003af8`; lokaler `main` `09a6971`; `origin/main` `4364eab`

## 1. Git-Ausgangspunkt

- lokaler `main`: `09a6971`
- `origin/main`: `4364eab`
- Options-01-Branch: `8003af8`
- neuer Branch: `feature/jm-application-letter-nav-02`
- Arbeitsbaum vor Beginn: clean
- Basis: verifizierter Options-01-Stand

## 2. Navigationsfluss

Die bestehende Dokumenten-/Vergleichsansicht wurde um kontextbezogene
Erfolgsaktionen ergänzt.

### Nach erfolgreicher Versionsspeicherung

Anzeige:

**„Anschreiben-Version erfolgreich gespeichert.“**

Aktionen:

- **„Version vergleichen“** — setzt die neue Version als Vergleichsversion,
  scrollt zum Vergleichsbereich und fokussiert die Versionsauswahl.
- **„Zur Bewerbungsübersicht“** — wechselt zum bestehenden Tab „Übersicht“
  derselben ausgewählten Bewerbung und fokussiert die Bewerbungsüberschrift.
- **„Alle Bewerbungen anzeigen“** — scrollt zur vorhandenen Bewerbungsliste
  und fokussiert die aktuell ausgewählte Bewerbung.

### Nach erfolgreicher Entwurfsübernahme

Anzeige:

**„Aktueller Anschreibenentwurf wurde aktualisiert.“**

Aktionen:

- **„Entwurf öffnen“** — öffnet/scrollt zum vorhandenen Entwurfsblock im
  Dokumenten-Tab und fokussiert dessen Zusammenfassung.
- **„Zur Bewerbungsübersicht“** — wie oben.
- **„Alle Bewerbungen anzeigen“** — wie oben.

Es wurden keine neuen Routen eingeführt. Die bestehenden Tabs, die bestehende
Bewerbungsliste und die bestehende Detailansicht werden wiederverwendet.

## 3. Erfolgs- und Fehlerzustände

Erfolgsaktionen erscheinen ausschließlich nach bestätigter Speicherung bzw.
bestätigter Entwurfsübernahme.

Bei Fehlern oder Versionskonflikten:

- keine Erfolgsmeldung,
- keine Erfolgsnavigation,
- kein automatischer Tabwechsel,
- KI-Vorschlag bleibt erhalten,
- bestehende verständliche Fehlermeldung bleibt sichtbar,
- keine neue Version.

Die Erfolgszustände werden bei relevanten Kontextänderungen (Ausgangsversion,
Modell, Sprache, Stil, Länge, Bewerbungswechsel) zurückgesetzt.

## 4. Fokus und Scrollen

- Tabwechsel über die bestehende `selectTab`-Logik.
- Scrollen mit `scrollIntoView` und `prefers-reduced-motion`-Erkennung.
- Fokus nach Versionsvergleich auf der Vergleichsversions-Auswahl.
- Fokus nach Übersicht auf der Bewerbungsüberschrift.
- Fokus nach Entwurf öffnen auf der Entwurfs-Zusammenfassung.
- Fokus nach Bewerbungsliste auf der ausgewählten Bewerbung.
- Keine vollständige Seitenneuladung.
- Keine Repository-Mutation durch reine Navigation.
- Keine Änderung an Formular-/KI-Zuständen durch Scrollen oder Fokus.

## 5. Schutz ungespeicherter Änderungen

Die bestehenden Schutzmechanismen bleiben aktiv:

- `letterDirty` blockiert normale Tab-/Bewerbungswechsel.
- Der KI-Vorschlag bleibt bei fehlgeschlagener Navigation erhalten.
- Bewerbungswechsel/Reset invalidieren laufende Requests.
- `expectedVersion`, Session-Generation und Repository-Isolation bleiben
  unverändert.
- Verspätete Antworten können keine neue Vorschau setzen.
- Historische Versionen bleiben unveränderlich.
- Keine neue Persistenz, keine neuen Backend-Endpunkte, keine KI-Aufrufe.

## 6. Responsive und Accessibility

Geprüft bei 1440/1024/768/430/390/320 px:

- Erfolgsaktionen sichtbar und verständlich,
- 44-px-Touch-Höhe,
- keine horizontalen Überläufe,
- Fokusführung funktioniert,
- keine überlagernde Navbar,
- DE/EN-Texte vorhanden.

## 7. Tests

| Prüfung | Ergebnis |
|---|---|
| Gesamtsuite `npm test -- --run --maxWorkers=2` | **1328 passed, 5 skipped** |
| Testdateien | 123 passed, 3 skipped |
| ApplicationLetterImprovement | **23 passed** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| API-Syntax | PASS |
| Applications-E2E 1440/390 | PASS |
| Applications responsive 1024/768/430/320 | PASS |
| Cover-Letter-E2E 1440/390 | PASS |
| Console-Errors | keine |
| Echte Provider-/KI-/AWS-/RIS-/Apify-Aufrufe | keine |

Gezielt geprüft:

- Erfolgsaktionen nach Version gespeichert,
- „Version vergleichen“ wählt die neue Version,
- „Zur Bewerbungsübersicht“ aktiviert Übersicht und fokussiert die Überschrift,
- „Alle Bewerbungen anzeigen“ fokussiert die ausgewählte Bewerbung,
- „Entwurf öffnen“ öffnet/fokussiert den Entwurfsblock,
- Versionskonflikt zeigt keine Erfolgsaktion,
- Options-/Kontextwechsel setzt Erfolgszustand zurück,
- ungespeicherte Änderungen bleiben geschützt,
- Navigation erzeugt keine neue Version/Bewerbung.

## 8. Screenshots

Unter `docs/reports/assets/JM-APPLICATION-LETTER-NAV-02/`:

- `desktop-1440-saved-actions.png`
- `desktop-1440-adopted-actions.png`
- `mobile-390-saved-actions.png`
- `mobile-390-adopted-actions.png`

## 9. Offene Findings

- Keine neuen funktionalen Findings.
- Schreibstil/Länge bleiben weiterhin reine Anfrageoptionen ohne historische
  Metadaten (unverändert aus Options-01).
- Bestehende Applications-Navbar-Ausnahme aus NAV-SCROLL-UX-02 bleibt
  unverändert.
- Keine Änderung an RIS, AWS, Auth oder Persistenz.
- **PRODUCTION: weiterhin BLOCKED.**

## 10. Git

- Implementierung: `325d111` — `feat: add cover letter success navigation`
- Dokumentation/Evidenz: dieser Commit
- Branch: `feature/jm-application-letter-nav-02`
- Kein Push, Merge, Rebase, Stash, Reset oder Deployment

## 11. Abschlussentscheidung

**APPLICATION-LETTER-NAV-02: READY für lokale Main-Integration.**

Die Erfolgsaktionen führen ohne Datenmutation zum richtigen Vergleich, zur
richtigen Bewerbungsübersicht, zur Bewerbungsliste und zum Entwurf. Fehler-,
Consent-, Session- und Versionsschutz bleiben erhalten.

**PRODUCTION: weiterhin BLOCKED.**

**HARD STOP. Keine automatische Main-Integration, kein Push, kein Deployment.**
