# JM-APPLICATION-MANAGEMENT-UX-05B

**Art:** Bewerbungsverwaltung / kompakte Bewerbungskarten / Listennavigation
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Deployment
**Datum:** 2026-11-03
**Branch:** `feature/jm-application-management-ux-05b`
**Ausgangsstand:** UX-05A `bad2b93`
**main:** `b897259` (unverändert)
**Grenzen:** Keine neue Persistenz, keine Repository-/Backend-/RIS-/AWS-/Cognito-/KI-/Apify-Änderung, kein Deployment.

## 1. Komponenten

Neu:

- `src/components/ApplicationCard.tsx`
- `src/components/ApplicationCard.test.tsx`
- `src/lib/applications/followUp.ts`

`followUp.ts` konsolidiert die gemeinsame Kalender-/Fälligkeitslogik
(`localCalendarDate`, `daysFromToday`, `isValidCalendarDate`,
`getFollowUpViewState`, `followUpShortLabel`, `followUpSummaryLabel`).
`ApplicationsSection` und `ApplicationCard` verwenden dieselbe Ableitung.

Die Karte ist ein einzelner nativer `<button>`; es gibt keine verschachtelten
interaktiven Elemente.

## 2. Kartenstruktur

- Stellenbezeichnung (max. zwei visuelle Zeilen, vollständiger Titel über
  `title` und `aria-label` zugänglich)
- Arbeitgeber
- Arbeitsort, falls vorhanden
- Statuschip mit vorhandenem Statuswert
- Bewerbungsdatum, sonst eindeutig „Erstellt“
- optionale Wiedervorlage mit bestehender Kalender-/Fälligkeitslogik
- ausgewählte Karte: seitliche Markierung, dezenter Hintergrund, Haken und
  `aria-current="true"`

Keine Dummy-Werte für fehlende Ort-/Datums-/Follow-up-Daten.

## 3. Statusdarstellung

Alle vorhandenen Statuswerte verwenden ihre bestehenden Übersetzungen.
Statuschips sind textlich beschriftet und zusätzlich über Rand/Hintergrund
visuell unterscheidbar; die Bedeutung hängt nicht allein von Farbe ab.
Ein Klick auf den Statuschip löst keine Statusänderung aus.

## 4. Wiedervorlagen

Die Karte verwendet dieselbe UX-04D-/UX-05A-Semantik:

- keine Wiedervorlage → keine Anzeige
- geplant → Datum
- heute → „Heute nachfassen“
- überfällig → textliche Überfälligkeitsanzeige
- erledigt → „Wiedervorlage erledigt“, nicht als offene Aufgabe

Keine zweite Fälligkeitsberechnung.

## 5. Interaktion und Schutz

- Kartenauswahl öffnet die bestehende Detailansicht.
- Karten sind per Tastatur fokussierbar und mit Enter/Space auswählbar.
- `selected` und `focus-visible` sind getrennt sichtbar.
- Ungespeicherte Bearbeitung blockiert den Bewerbungswechsel weiterhin.
- Bestätigungen/Fehler werden beim Wechsel zurückgesetzt.
- Keine Repository-Mutation durch reine Kartenauswahl.
- UX-05A-Kennzahlen, Handlungsbedarf, Schnellfilter, Statusfilter und
  Follow-up-Sortierung bleiben erhalten.

## 6. Responsive UI

- Karten bleiben im bestehenden 30-%-Listenbereich.
- Kompakte Abstände und zweizeilige Titel-Clamp.
- Status/Fälligkeit bleiben lesbar.
- Mobile Karten bleiben vollständig auswählbar.
- E2E-Bounds bei 1440, 1024, 768, 390 und 320 px: kein horizontaler Overflow.
- Navbar-BBox bleibt ohne Überlagerung.

## 7. Tests

| Prüfung | Ergebnis |
|---|---|
| ApplicationCard | **6 passed** |
| ApplicationsSection | **30 passed** |
| Gesamtsuite (`npm test -- --run`) | **1222 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Applications-E2E Desktop 1440 | PASS |
| Applications-E2E Mobil 390 | PASS |
| Responsive 1024 / 768 / 320 | PASS |
| Navigation-BBox | PASS |
| Cover-Letter-E2E Desktop 1440 | PASS |
| Cover-Letter-E2E Mobil 390 | PASS |
| E2E Console-Errors | keine |
| Echte KI-/RIS-/Apify-Aufrufe | keine |

Getestet u. a.:

- vollständige und unvollständige Karten
- Statuschips
- langer Jobtitel
- ausgewählte Karte / `aria-current`
- Kartenauswahl
- Kalender-Fälligkeit heute/überfällig/erledigt
- Karten nach Status-/Follow-up-Änderungen
- Schnellfilter/Sortierung und Löschen

## 8. Screenshots

- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-05B/desktop-1440-cards.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-05B/desktop-1440-selected.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-05B/desktop-1440-overdue-filter.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-05B/mobile-390-cards.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-05B/mobile-390-selected.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-05B/mobile-390-overdue-filter.png`

Synthetische Daten; keine echten Bewerberdaten.

## 9. Git

- Implementierungscommit: `9643dd1`
- Dokumentationscommit: dieser Commit
- Branch: `feature/jm-application-management-ux-05b`
- `main` bleibt `b897259`
- Kein Push, Merge oder Deployment

## 10. Offene Punkte

- Live-Verifikation nach Deployment.
- UX-05C nicht vorweggenommen.
- RIS-/Backend-Persistenz und Live-Auth-Matrix bleiben außerhalb des Scopes.
