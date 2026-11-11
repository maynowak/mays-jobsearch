# CV-BUILDER-MAPPING-02C — STRUCTURED CV DATA MAPPING

**Status:** `IN PROGRESS — STEP A COMPLETE`
**Branch:** `feature/cv-builder-mapping-02c`
**Base:** `feature/cv-builder-parser-02b` @ `e74cef5`
**Zielstatus:** `CV-BUILDER-MAPPING-02C — IMPLEMENTED / VERIFIED LOCAL / FEATURE BRANCH PUSHED`

## Step-Matrix

| Step | Thema | Status | Commit |
|---|---|---|---|
| A | Mapping-Vertrag und Provenienz | **COMPLETE** | `pending` |
| B | Berufserfahrung und Freelance-Projekte | OFFEN | — |
| C | Projekte und Technologien | OFFEN | — |
| D | Ausbildung und Qualifikationen | OFFEN | — |
| E | Unklare Informationen und manuelle Zuordnung | OFFEN | — |
| F | Qualitätsmessung | OFFEN | — |
| G | Gesamtprüfung | OFFEN | — |

## Recovery-Regel

Maßgeblich sind diese Datei und der letzte gepushte Commit auf
`origin/feature/cv-builder-mapping-02c`. Kein Rebase, kein Force-Push, kein
Merge nach `main`.

## STEP A — Mapping-Vertrag

Der persistente Vertrag `CvBuilderDraftV1` bleibt unverändert. Das
Import-Ergebnis enthält zusätzlich:

- `mapping.sections` mit Quellabschnitt, Kategorie, Überschrift,
  `pageStart`/`pageEnd`, Zielbereichen, Konfidenz und Item-Anzahl
- `mapping.timeline` als vorbereitete Timeline-Referenz
- `unrecognizedDetails` mit Quellzeile, Seite, Abschnitt, Kategorie,
  vorgeschlagenem Ziel und Grund
- bestehendes `unrecognized: string[]` bleibt für die aktuelle manuelle
  Zuordnung und Rückwärtskompatibilität erhalten

Die Zuordnung unterscheidet `confirmed`, `partial` und `uncertain`.
Gemischte Abschnitte werden als `education` + `languages` markiert;
Training, Zielpositionen, Dokumenthinweise und unbekannte Abschnitte werden
nicht still einem Builder-Feld zugeschlagen.

Test: 15 fokussierte Parser-Tests PASS; Build PASS.
