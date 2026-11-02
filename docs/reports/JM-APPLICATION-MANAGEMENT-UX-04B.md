# JM-APPLICATION-MANAGEMENT-UX-04B

**Art:** Bewerbungsverwaltung / responsives Layout / Navigation Fix
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Deployment
**Datum:** 2026-11-02
**Branch:** `feature/jm-application-management-ux-04b`
**Ausgangsstand:** `feature/jm-application-management-ux-04a` @ `b4da5dd` (UX-04A)
**Grenzen:** Keine neue Persistenz, keine Repository-Architekturänderung, keine RIS-/AWS-/Cognito-/KI-/Apify-Aufrufe, kein Deployment.

## 1. Layoutmodernisierung

- Der Dashboard-Root erhält bei aktiver Bewerbungsverwaltung die Klasse
  `dashboard-v2--applications`.
- Nur dieser Bereich nutzt eine breitere Inhaltsfläche
  (`min(1600px, 98vw)`); andere Dashboard-Sektionen bleiben unverändert.
- Die Dashboard-Navigation wird im Bewerbungsmodus schmaler gewichtet.
- Die Bewerbungsliste und Detailansicht stehen auf Desktop im Verhältnis
  ungefähr **30 % / 70 %**.
- Detailansicht und Liste haben `min-width: 0`, damit lange Inhalte nicht
  ausbrechen.
- Lange Jobtitel und URL-/Textinhalte werden umgebrochen.
- Listeneinträge haben größere Touch-Flächen und klarere Abstände.

### Responsive Breakpoints

| Breite | Verhalten |
|---|---|
| 1440 px | breite zweispaltige Ansicht, Liste ca. 30 %, Details ca. 70 % |
| 1024 px | zweispaltige Ansicht, angepasste Dashboard-Navigation |
| 768 px | Dashboard-Navigation oben; Bewerbungsliste und Details einspaltig |
| 390 px | einspaltig, Formularfelder untereinander |
| 320 px | kein horizontaler Seitenüberlauf, einspaltige Felder |

Zusätzliche Breakpoints:

- `980px`: Dashboard-Navigation und Hauptbereich werden einspaltig.
- `860px`: Bewerbungsliste und Detailansicht werden einspaltig.
- `700px`: Formular-Kontakt-/Gehaltszeilen und Anwendung werden mobil.

## 2. Navigation-Overlay — Ursache und Fix

**Ursache:** Die globale Navbar war `position: sticky` mit `z-index: 40`.
Beim Scrollen blieb sie über dem Dokumentfluss und konnte interaktive Elemente
der Bewerbungsverwaltung überdecken.

**Fix:** Im aktiven Bewerbungs-Dashboard wird die Navbar gezielt aus dem
Sticky-Overlay genommen:

```css
body:has(.dashboard-v2--applications) .navbar,
body:has(.dashboard-v2--applications) .navbar.scrolled,
body:has(.dashboard-v2--applications) .navbar-glass.scrolled {
  position: relative;
  top: auto;
}
```

Damit bleibt die Navigation vollständig erhalten, überlagert aber keine
Eingabefelder, Buttons oder Filter mehr. Andere Seiten und Dashboard-Bereiche
behalten ihr bisheriges Navbar-Verhalten.

## 3. Formular

- Bewerbungsweg und Bewerbungsdatum bleiben im Formular.
- Ansprechpartner: Name über volle Breite; E-Mail und Telefon auf Desktop
  nebeneinander, mobil untereinander.
- Gehaltsvorstellung und Angebot bleiben getrennte Gruppen mit Betrag,
  Währung und Zeitraum.
- Persönliche Notizen nutzen die volle Detailbreite.
- Speichern-/Abbrechen-Aktionen bleiben sichtbar und tastaturbedienbar.
- Keine Validierungs-, Speicher- oder Repository-Logik wurde verändert.

## 4. Funktionsschutz

Erhalten:

- Bearbeiten, Speichern, Abbrechen
- Bewerbungsweg, Datum, Kontakt, Gehalt, Notizen
- Session-Repository, `expectedVersion`, `AbortSignal`, `invalidate()`
- Versionskonflikt- und Session-Ende-Behandlung
- Doppelaktionsschutz
- Status, Submit-Bestätigung, Anschreiben-Versionierung, CV-Referenzen,
  Verlauf, Rückmeldungen, Interviews, Export und Löschen

## 5. Tests

| Prüfung | Ergebnis |
|---|---|
| ApplicationsSection | **18 passed** |
| Session-Repository | **14 passed** |
| Gesamtsuite (`npm test -- --run`) | **1201 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| E2E Applications Desktop 1440 | PASS |
| E2E Applications Mobil 390 | PASS |
| Responsive Bounds 1024 / 768 / 320 | PASS, kein horizontaler Überlauf |
| Navigation-BBox-Prüfung | PASS, keine Überlappung |
| E2E Console-Errors | keine |
| Echte KI-/RIS-/Apify-Aufrufe | keine |

Die E2E-Prüfung vergleicht echte Bounding-Rectangles von Navigation und
interaktiven Elementen der Bewerbungsverwaltung, auch an mehreren
Scrollpositionen. DOM-Präsenz allein wird nicht als Nachweis verwendet.

## 6. Screenshots

- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04B/desktop-1440-overview.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04B/desktop-1440-details.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04B/desktop-1440-edit.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04B/mobile-390-overview.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04B/mobile-390-details.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04B/mobile-390-edit.png`

## 7. Git

- Implementierungscommit: `f5dd90a`
- Dokumentationscommit: dieser Commit
- Branch: `feature/jm-application-management-ux-04b`
- `main` bleibt `b897259`; UX-04A/04B sind nicht in `main` gemerged.
- Kein Push, kein Merge, kein Deployment.

## 8. Offene Punkte

- Live-Verifikation nach Deployment.
- UX-04C (Tabs/weitere Detailstruktur) nicht vorweggenommen.
- RIS-/Backend-Persistenz bleibt außerhalb des Scopes.
