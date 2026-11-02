# JM-APPLICATION-MANAGEMENT-UX-04C

**Art:** Bewerbungsverwaltung / strukturierte Detailansicht / Tab-Navigation
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Deployment
**Datum:** 2026-11-02
**Branch:** `feature/jm-application-management-ux-04c`
**Ausgangsstand:** `feature/jm-application-management-ux-04b` @ `7af3365`
**Grenzen:** Keine neue Persistenz, keine RIS-/AWS-/Cognito-/KI-/Apify-Aufrufe, kein Deployment.

## 1. Tab-Struktur

Die Detailansicht der ausgewählten Bewerbung hat vier Tabs:

### Übersicht

- Stellenbezeichnung, Arbeitgeber, Ort und Originalanzeige
- Bewerbungsweg, Bewerbungsdatum und Ansprechpartner
- Gehaltsvorstellung und Angebot
- Persönliche Notizen
- Bewerbungsstatus und Statusverwaltung inklusive ausdrücklicher
  Versandbestätigung
- „Bewerbungsdaten bearbeiten“ mit dem bestehenden UX-04A-Formular

### Kommunikation

- Rückmeldung erfassen und vorhandene Rückmeldungen anzeigen
- Vorstellungsgespräch erfassen und geplante Interviews anzeigen
- Keine neue Datenstruktur; Verwendung der vorhandenen `history`-Einträge
- Status wird durch Interview-/Feedback-Erfassung nicht verändert

### Dokumente

- CV-Referenz und Dokumentenstatus
- Aktueller Anschreibenentwurf
- Gespeicherte Anschreiben-Versionen inklusive Stellenzuordnung
- Aktion zum Speichern einer neuen Anschreiben-Version
- Lokaler Export

### Verlauf

- Chronologische Timeline aus StatusHistorie, Rückmeldungen, Interviews und
  Verlaufsnotizen
- Zeitstempel
- Bestehende Möglichkeit zum Erfassen einer Verlaufsnotiz
- Persönliche Notizen bleiben davon fachlich getrennt

## 2. Tab-Verhalten und State

- Beim Öffnen einer Bewerbung ist **Übersicht** aktiv.
- Ein Tab-Wechsel erzeugt keine Repository-Anfrage und lädt keine Daten neu.
- Ausgewählte Bewerbung und aktueller Tab bleiben konsistent.
- Beim Wechsel der Bewerbung wird wieder **Übersicht** aktiv.
- Offene Bestätigungsdialoge und Fehlermeldungen werden beim
  Bewerbungswechsel zurückgesetzt.
- Ein offenes Bearbeitungsformular blockiert Tab- und Bewerbungswechsel mit
  einer verständlichen Meldung. So werden ungespeicherte Änderungen nicht
  stillschweigend verworfen.
- Ein Statuswechsel ist weiterhin nur im Übersicht-Tab verfügbar; der
  Statusindikator bleibt im Kopfbereich bei allen Tabs sichtbar.
- Löschen bleibt außerhalb der Tabs erreichbar.

## 3. Accessibility

- `role="tablist"`, `role="tab"`, `role="tabpanel"`
- `aria-selected`, `aria-controls`, `aria-labelledby`
- Eindeutige IDs über React `useId`
- Pfeil links/rechts sowie Home/End wechseln den Tab und setzen den Fokus.
- `tabIndex=0` nur für den aktiven Tab, `-1` für die übrigen.
- Tastatur-Fokuszustände sind sichtbar; nicht ausschließlich farblich.
- Touch-Ziele haben mindestens 44 px Höhe.
- Auf schmalen Geräten umbrechen die Tabs; kein horizontaler Seitenüberlauf.

## 4. Repository-Schutz

Unverändert und weiterhin aktiv:

- `applicationRepository` als einzige Datenquelle
- `expectedVersion`, `AbortSignal`
- Session-Generation/`invalidate()`
- Schutz vor späten Operationen
- `busy`-/Doppelaktionsschutz
- Session-Reset bei Auth-Wechsel/Logout
- Keine direkten React-State-Mutationen als Ersatz für Repository-Operationen

## 5. Tests

| Prüfung | Ergebnis |
|---|---|
| ApplicationsSection | **23 passed** |
| Gesamtsuite (`npm test -- --run`) | **1206 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| E2E Applications Desktop 1440 | PASS |
| E2E Applications Tablet 768 | PASS |
| E2E Applications Mobil 390 | PASS |
| E2E Applications Mobil 320 | PASS |
| Navigation-BBox-Prüfung | PASS, keine Überlappung |
| E2E Console-Errors | keine |
| Echte KI-/RIS-/Apify-Aufrufe | keine |

Gezielte UI-Tests decken u. a. ab:

- Standard-Tab Übersicht
- Tab-Wechsel und sichtbarer Inhalt
- Pfeil-/Home-/End-Tastaturnavigation
- Bewerbungswechsel mit Rücksprung auf Übersicht
- Status sichtbar außerhalb Übersicht
- Bearbeitungsformular blockiert Tab-/Bewerbungswechsel
- bestehende Editier-, Feedback-, Interview-, Versions-, Export- und
  Löschabläufe nach der Tab-Struktur

## 6. Screenshots

- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04C/desktop-1440-overview.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04C/desktop-1440-communication.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04C/desktop-1440-documents.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04C/desktop-1440-history.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04C/mobile-390-overview.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04C/mobile-390-communication.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04C/mobile-390-documents.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04C/mobile-390-history.png`

Alle Daten sind synthetisch; es wurden keine echten personenbezogenen
Bewerbungsdaten verwendet.

## 7. Git

- Implementierungscommit: `aac997b`
- Dokumentationscommit: dieser Commit
- Branch: `feature/jm-application-management-ux-04c`
- `main` bleibt `b897259`
- UX-04A/04B/04C sind nicht in `main` gemerged
- Kein Push, kein Merge, kein Deployment

## 8. Offene Punkte

- Live-Verifikation nach Deployment.
- UX-04D nicht vorweggenommen.
- RIS-/Backend-Persistenz bleibt außerhalb des Scopes.
