# CV-BUILDER-PDF-EXPORT-FIX-01

**Status:** `IN PROGRESS — STEP A COMPLETE`
**Branch:** `feature/cv-builder-pdf-export-fix-01`
**Base:** `feature/cv-builder-mapping-02c` @ `1ed3312`
**Zielstatus:** `CV-BUILDER-PDF-EXPORT-FIX-01 — IMPLEMENTED / VERIFIED LOCAL / FEATURE BRANCH PUSHED`

## Step-Matrix

| Step | Thema | Status | Commit |
|---|---|---|---|
| A | Fehler reproduzieren und Ursache bestimmen | **COMPLETE** | `pending` |
| B | Gezielter Bugfix | OFFEN | — |
| C | Tatsächlichen PDF-Download prüfen | OFFEN | — |
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

## Recovery-Regel

Maßgeblich sind diese Datei und der letzte gepushte Commit auf
`origin/feature/cv-builder-pdf-export-fix-01`. Kein Rebase, kein Force-Push,
kein Merge nach `main`.

## Grenzen

Kein Merge, kein Deployment, keine RIS-/AWS-/Cognito-/Terraform-Änderung,
keine echten CV-Daten.
