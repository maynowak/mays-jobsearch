# CV-BUILDER-PDF-EXPORT-FIX-01

**Status:** `IN PROGRESS — STEPS A–C COMPLETE`
**Branch:** `feature/cv-builder-pdf-export-fix-01`
**Base:** `feature/cv-builder-mapping-02c` @ `1ed3312`
**Zielstatus:** `CV-BUILDER-PDF-EXPORT-FIX-01 — IMPLEMENTED / VERIFIED LOCAL / FEATURE BRANCH PUSHED`

## Step-Matrix

| Step | Thema | Status | Commit |
|---|---|---|---|
| A | Fehler reproduzieren und Ursache bestimmen | **COMPLETE** | `f57a57d` |
| B | Gezielter Bugfix | **COMPLETE** | `fd9ef8a` |
| C | Tatsächlichen PDF-Download prüfen | **COMPLETE** | `pending` |
| D | Gesamtverifikation | OFFEN | — |

## STEP A — Reproduktion

Synthetischer 02C-Import im Browser (390 px):

- Editor: `10 Einträge · 6 Validierungshinweise`
- Export-Button: **disabled**
- Nutzerfeedback beim Klick: keines, weil der Button deaktiviert ist
- Sichtbare Alerts: allgemeine Zusammenfassung plus „Dieses Feld ist erforderlich.“
- Kein Export-spezifischer Alert

Validierungspfade aus dem Referenzimport:

- `experience.0.startMonth`
- `experience.1.startMonth`
- `education.0.degree`
- `education.0.startMonth`
- `education.1.startMonth`
- zusätzlich beim manuellen Test: eine neu zugeordnete Education-Zeile ohne Degree/Monat

Die Einträge sind fachlich vollständig genug für den PDF-Renderer:
Arbeitgeber/Position bzw. Institution sind vorhanden; der Monat ist im
Quelldokument nur als Jahr vorhanden oder fehlt; die Weiterbildung besitzt
keinen Degree. `validation.ts` verlangt diese optionalen Angaben jedoch als
Pflichtfelder. Deshalb blockiert die Validierung den Export, obwohl
`pdfExport.ts` fehlende Monate und Degrees bereits korrekt auslassen kann.

Nicht ursächlich:

- Font-Laden (Domain-Tests mit DejaVu PASS),
- PDF-Erzeugung (Domain-Tests PASS),
- Browser-Download (bestehender Download-Smoke PASS),
- Import/Mapping selbst.

## STEP B — Bugfix

Änderungen ausschließlich am Export-/Validierungspfad:

- `experience.startMonth` ist kein Pflichtfeld mehr; Arbeitgeber und Position
  bleiben Pflicht. Unbekannte Monate werden nicht erfunden.
- `education.degree` und `education.startMonth` sind keine Pflichtfelder mehr;
  die Bildungseinrichtung bleibt Pflicht. Weiterbildungen ohne Degree bleiben
  exportierbar.
- Der PDF-Renderer verwendet bei fehlendem Degree die Institution als
  Bildungstitel und lässt den Monat weg.
- Arbeitgeber/Position/Institution, ungültige Monate, verdrehte Zeiträume,
  ungültige E-Mails/URLs, Duplikate und Limits bleiben validiert.
- Keine Einträge werden gelöscht, keine Erfolgsmeldung wird vor dem Download
  gesetzt, der bestehende Export-Guard bleibt.

Tests: 32 fokussierte Validierungs-/PDF-/Editor-Tests PASS; Build PASS.

## STEP C — Tatsächlicher Download

Neuer Browser-E2E `tests/e2e/cv-builder-pdf-export-fix-01.mjs`:

- importiert ein synthetisches vierseitiges CV-PDF mit unbekannten Monaten,
  Weiterbildung ohne Degree, Umlaut und mehreren Projekten,
- klickt den Export-Button tatsächlich,
- wartet auf ein echtes Download-Event,
- prüft `%PDF`-Signatur, `pdfinfo`-Seitenzahl und `pdftotext`-Inhalt,
- prüft Dateiname `Lebenslauf-Zoe-Beispiel.pdf`,
- prüft Umlaute, Abschnitte, Projekte, Freelance-Eintrag und Bildung,
- prüft Classic/Modern/Kompakt,
- prüft 320/390/430/768/1024/1440 px ohne Overflow,
- prüft 0 Validierungshinweise, 0 unerwartete API-Aufrufe und 0 Console-Fehler.

Ergebnis:

| Breite | Seiten | Datei |
|---|---:|---|
| 320 | 2 | `Lebenslauf-Zoe-Beispiel.pdf` |
| 390 | 2 | `Lebenslauf-Zoe-Beispiel.pdf` |
| 430 | 2 | `Lebenslauf-Zoe-Beispiel.pdf` |
| 768 | 2 | `Lebenslauf-Zoe-Beispiel.pdf` |
| 1024 | 2 | `Lebenslauf-Zoe-Beispiel.pdf` |
| 1440 | 2 | `Lebenslauf-Zoe-Beispiel.pdf` |
| Classic | 2 | `Lebenslauf-Zoe-Beispiel.pdf` |
| Modern | 2 | `Lebenslauf-Zoe-Beispiel.pdf` |
| Kompakt | 1 | `Lebenslauf-Zoe-Beispiel.pdf` |

Die PDFs enthalten auswählbaren Text; die Marker für Name, Berufserfahrung,
Ausbildung, Fähigkeiten, Projekte, AWS-QA-Lab, Projekt A, Freelance und
Deutsch sind über die Seiten hinweg vorhanden. Kein Ersatzzeichen
`U+FFFD`. Die Kompakt-Variante passt den Inhalt auf eine Seite, ohne Inhalte
zu verlieren; die anderen Varianten sind mehrseitig.

Evidenz: `docs/reports/assets/CV-BUILDER-PDF-EXPORT-FIX-01/`.

## Recovery-Regel

Maßgeblich sind diese Datei und der letzte gepushte Commit auf
`origin/feature/cv-builder-pdf-export-fix-01`. Kein Rebase, kein Force-Push,
kein Merge nach `main`.

## Grenzen

Kein Merge, kein Deployment, keine RIS-/AWS-/Cognito-/Terraform-Änderung,
keine echten CV-Daten.
