# CV-BUILDER-IMPORT-UX-02D — REVIEW & MANUAL CORRECTION

**Status:** `IN PROGRESS — STEPS A–G COMPLETE`
**Branch:** `feature/cv-builder-import-ux-02d`
**Base:** `feature/cv-builder-pdf-export-fix-01` @ `166fec9`
**Zielstatus:** `CV-BUILDER-IMPORT-UX-02D — IMPLEMENTED / VERIFIED LOCAL / FEATURE BRANCH PUSHED`

## Step-Matrix

| Step | Thema | Status | Commit |
|---|---|---|---|
| A | Import-UX analysieren | **COMPLETE** | `pending` |
| B | Importübersicht | **COMPLETE** | `pending` |
| C | Prüfliste mit Filter/Pagination/Status | **COMPLETE** | `pending` |
| D | Korrektur und manuelle Zuordnung | **COMPLETE** | `pending` |
| E | Skills-Auswahl | **COMPLETE** | `pending` |
| F | Importabschluss und Kontrolle | **COMPLETE** | `pending` |
| G | UX, Barrierefreiheit, Responsive | **COMPLETE** | `pending` |
| H | Regression und Gesamtprüfung | OFFEN | — |

## STEP A — UX-Baseline

Ausgangszustand nach 02C:

- Die Vorschau zeigte alle erkannten Bereiche und eine lange, standardmäßig
  eingeklappte Liste aller unklaren Zeilen.
- 55 Prüfzeilen wurden alle gleichzeitig gerendert; keine Filter, keine
  Pagination, keine Statusentscheidung.
- 67 ATS-Skill-Kandidaten waren über die Abschnittsauswahl pauschal
  vorausgewählt; keine Einzelauswahl, Suche oder Zähler.
- Quellen/Seiten/Gründe waren vorhanden, aber nur als lange Meta-Zeile.
- Es gab keine Korrektur vor der Übernahme und keinen Abschlussüberblick.
- Nicht zugeordnete Zeilen wurden ohne explizite Entscheidung ausgelassen.
- Kein Statusmodell `pending` / `accepted` / `ignored`.

## STEP B — Importübersicht

Die Vorschau beginnt jetzt mit „Lebenslauf analysiert“:

- Dokumentseiten, Berufserfahrung, Projekte, Ausbildung, Skills und
  Prüfkandidaten aus dem tatsächlichen Importresultat
- Navigationsbuttons zu den jeweiligen Bereichen
- Details bleiben eingeklappt
- fehlende Bereiche bleiben als „nicht erkannt“ sichtbar, nicht als Fehler

## STEP C — Prüfliste

- Alle unklaren Angaben in einer eigenen Prüfliste
- Statusfilter: Alle / Noch nicht geprüft / Übernehmen / Nicht übernehmen
- zusätzliche Filter nach vorgeschlagenem Ziel und Unsicherheitsgrund
- Pagination mit 10 Einträgen pro Seite
- Entscheidungen bleiben bei Filter- und Seitenwechseln erhalten
- Status wird mit Text und nicht ausschließlich über Farbe angezeigt

## STEP D — Korrektur und Mapping

- Originaltext und bearbeiteter Text getrennt
- Korrektur bestätigen oder verwerfen
- Zielbereich auswählen
- Entscheidung rückgängig machen
- Quelle, Abschnitt, Grund und Vorschlag bleiben sichtbar
- bestehende Ziele plus Berufserfahrung/Ausbildung
- Domain-Funktion `selectCvBuilderImportDraft()` erweitert; keine zweite
  Mapping-Implementierung

## STEP E — Skills

- Einzelne Skills aus-/abwählbar
- Suche, Alle auswählen, Auswahl zurücksetzen, Zähler
- große ATS-Listen starten ohne pauschale Vorauswahl
- doppelte Einträge werden vermieden
- Abschnittsauswahl bleibt erhalten; die Skill-Auswahl wird zusätzlich an
  `selectCvBuilderImportDraft()` übergeben

## STEP F — Importabschluss

Vor der Übernahme zeigt die Zusammenfassung:

- Anzahl Berufserfahrung, Projekte, Ausbildung, ausgewählte Skills
- manuell übernommene, bewusst ausgeschlossene und ungeprüfte Angaben
- ausgewählte Bereiche
- explizite Bestätigung, offene Prüfpunkte vorerst auszulassen
- Aktionen: Zurück zur Prüfung, Auswahl übernehmen, Import abbrechen
- erst „Auswahl übernehmen“ öffnet den Builder; kein automatisches Speichern

## STEP G — UX, Barrierefreiheit, Responsive

Der neue Browser-E2E importiert ein synthetisches sechsseitiges PDF mit 55
Prüfzeilen und prüft auf 320/390/430/768/1024/1440 px:

- kompakte Übersicht und Abschnittsnavigation
- 10 Prüfzeilen pro Seite, „Seite 1 von 6“
- Statusfilter, Korrektur, Zielauswahl und Übernehmen
- Entscheidung bleibt nach Filter- und Seitenwechsel erhalten
- Abschlussübersicht, Pflichtbestätigung für offene Punkte und Übernahme
- keine horizontalen Überläufe
- keine API-/RIS-/Console-Fehler

Zusätzlich prüfen Komponententests: 67-Skill-Liste standardmäßig unausgewählt,
Suche, Alle auswählen, Zurücksetzen, Einzelauswahl; 55 Prüfzeilen paginiert;
Korrektur und Pending-Bestätigung.

Screenshots: `docs/reports/assets/CV-BUILDER-IMPORT-UX-02D/`
(`preview-{width}.png`, `summary-390.png`, `editor-390.png`, `results.json`).

## Tests

Fokussiert: 51 Tests PASS; Build PASS. Die Tests decken Übersicht, Filter,
Pagination, Korrektur, Statusentscheidungen, große Skill-Liste, Summary und
Domain-Übernahme ab.

## Recovery-Regel

Maßgeblich sind diese Datei und der letzte gepushte Commit auf
`origin/feature/cv-builder-import-ux-02d`. Kein Rebase, kein Force-Push, kein
Merge nach `main`.

## Grenzen

Kein Merge, kein Deployment, keine RIS-/AWS-/Cognito-/Terraform-Änderung,
keine neuen API-Endpunkte, keine KI-/Modellaufrufe, kein OCR, keine echten
CV-Daten.
