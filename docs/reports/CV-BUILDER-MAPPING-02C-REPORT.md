# CV-BUILDER-MAPPING-02C — STRUCTURED CV DATA MAPPING

**Status:** `IN PROGRESS — STEPS A–E COMPLETE`
**Branch:** `feature/cv-builder-mapping-02c`
**Base:** `feature/cv-builder-parser-02b` @ `e74cef5`
**Zielstatus:** `CV-BUILDER-MAPPING-02C — IMPLEMENTED / VERIFIED LOCAL / FEATURE BRANCH PUSHED`

## Step-Matrix

| Step | Thema | Status | Commit |
|---|---|---|---|
| A | Mapping-Vertrag und Provenienz | **COMPLETE** | `f64f927` |
| B | Berufserfahrung und Freelance-Projekte | **COMPLETE** | `62eae60` |
| C | Projekte und Technologien | **COMPLETE** | `ef0e180` |
| D | Ausbildung und Qualifikationen | **COMPLETE** | `bd87c71` |
| E | Unklare Informationen und manuelle Zuordnung | **COMPLETE** | `pending` |
| F | Qualitätsmessung | OFFEN | — |
| G | Gesamtprüfung | OFFEN | — |

## STEP B — Berufserfahrung und Freelance-Projekte

Die Erfahrungsabschnitte werden jetzt itemgenau aus `section.timeline` gemappt:

- `employment` und `freelance` werden zu Builder-Erfahrungseinträgen.
- Projekte mit `parentId` einer Freelance-Phase werden in die Beschreibung des
  Parent-Eintrags übernommen; es entsteht kein zusätzlicher Arbeitgeber.
- `training`, `qualification` und nicht zugeordnete Projektitems bleiben
  erhalten und werden zur Prüfung angeboten.
- Unvollständige Items werden nicht erfunden; sie bleiben mit
  `incomplete-experience` in der manuellen Liste.
- Überlappende Zeiträume bleiben unverändert. Jahresangaben ohne Monat werden
  nicht in erfundene Monate umgewandelt; `mapping.timeline[].dateText` bewahrt
  den Originaltext.

Test: 16 fokussierte Parser-Tests PASS; Build PASS.

## STEP C — Projekte und Technologien

Projekte werden weiterhin einzeln aus datierten Projektstarts gebildet. Neu:

- Technologien werden case-insensitiv dedupliziert.
- Technologien müssen durch `isSkillCandidate` plausibel sein.
- Projekt-Repository-Links werden in `draft.links` gesammelt und nicht als
  Skill oder Projektbeschreibung dupliziert.
- Skill-Kategorien wie `Software & Architektur:`, `AWS & Infrastruktur:` und
  `Web & Daten:` werden entfernt; die dahinterliegenden Begriffe bleiben
  erhalten.
- Große ATS-Kandidatenlisten (>25 Skills) werden als
  `skill-candidates-review` markiert; es wird keine künstliche Obergrenze
  eingeführt und nichts unbelegt gelöscht.

Test: 17 fokussierte Parser-Tests PASS; Build PASS.

## STEP D — Ausbildung und Qualifikationen

- Gemischte Abschnitte werden weiterhin in Ausbildung und Sprachen getrennt.
- Weiterbildung/Training wird als unsicherer Bildungs-/Qualifikationseintrag
  übernommen, nicht als Berufserfahrung und nicht als bestandenes Zertifikat.
- Zertifizierungsziele und Zertifikatsstatus bleiben außerhalb von
  `draft.certificates`; sie werden mit `certification-goal` zur Prüfung
  angeboten.
- QA-Lab-/Kursinhalte werden nicht als AWS-Herstellerzertifikat interpretiert.
- No-date-Bildungsblöcke können eine nachfolgende Degree-Zeile übernehmen,
  ohne eine Institution zu erfinden.

Test: 17 fokussierte Parser-Tests PASS; Build PASS.

## STEP E — Unklare Informationen

Die manuelle Einzelzuordnung zeigt jetzt pro Zeile:

- Quellseite (falls verfügbar)
- Abschnittsüberschrift/Kategorie
- Grund der Unsicherheit
- vorgeschlagenes Ziel
- die bisherigen und neuen Zieloptionen

Neu manuell zuordenbar sind **Berufserfahrung** und **Ausbildung**. Die
Übernahme bleibt opt-in; der Vorschlag wird nur angezeigt, nicht automatisch
angewendet. Es gibt weiterhin keine pauschale Übernahme ins Kurzprofil und
keine stille Löschung. Die Anzeige ist DE/EN und bleibt auf Mobile lesbar.

Test: 17 Parser-Tests und 11 Dialog-Tests PASS; Build PASS.

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
