# CV-BUILDER-PARSER-02B — DOCUMENT STRUCTURE RECOGNITION

**Status:** `CV-BUILDER-PARSER-02B — IMPLEMENTED / VERIFIED LOCAL / FEATURE BRANCH PUSHED`
**Branch:** `feature/cv-builder-parser-02b`
**Base:** `origin/main` `cef41cc`
**Zielstatus:** `CV-BUILDER-PARSER-02B — IMPLEMENTED / VERIFIED LOCAL / FEATURE BRANCH PUSHED`

## Step-Matrix

| Step | Thema | Status | Commit |
|---|---|---|---|
| A | Strukturierte PDF-Extraktion mit Seiten-/Blockzuordnung | **COMPLETE** | `b5d3420` |
| B | Dokumentnormalisierung: Kopf-/Fußzeilen, Seitenzahlen, Fortsetzungen | **COMPLETE** | `51d0dbc` |
| C | Abschnittserkennung und Abschnittsgrenzen | **COMPLETE** | `7f7a9a2` |
| D | Fortsetzungen und lange Timelines | **COMPLETE** | `6c1550b`, `2620685` |
| E | Strukturierte Zwischendarstellung | **COMPLETE** | `ab7da56` |
| F | Qualitätsprüfung mit Referenzdokument | **COMPLETE** | `2bf6d79` |
| G | Regression und Gesamtprüfung | **COMPLETE** | `a6ae146`, `ef111ae` |

## Recovery-Regel

Maßgeblich ist diese Datei plus der letzte gepushte Commit auf
`origin/feature/cv-builder-parser-02b`. Nach einem Abbruch zuerst
`git status`, `HEAD`, `origin/feature/cv-builder-parser-02b` und diese Matrix
prüfen. Kein Rebase, kein Force-Push, kein Merge nach `main`.

## STEP A — Strukturierte PDF-Extraktion

`src/lib/pdf.ts` bietet zusätzlich `extractPdfDocument(file)`. Die bestehende
`extractPdfText(file)`-Schnittstelle bleibt unverändert und liefert weiterhin
denselben Text.

Neu in `documentStructure.ts`:

- `PdfTextBlock` mit `page`, `order`, `text`, `lines`, optional `fontSize`
- `PdfDocumentPage` und `PdfDocumentStructure`
- `buildPdfDocument()` ordnet jeden Textblock seiner PDF-Seite und der
  ursprünglichen Reihenfolge zu.

Test: 3 Tests PASS, darunter Seitenzuordnung, Reihenfolge und leerer Text.

## STEP B — Dokumentnormalisierung

`normalizePdfDocument()` entfernt deterministisch:

- reine Seitenzahlen (`Seite 3`, `Page 2 of 4`, `3/4`)
- laufende Kopfzeilen mit Seitenzahl-Suffix
- wiederholte obere/untere Randzeilen über mindestens zwei Seiten

Nicht entfernt werden:

- erkannte Abschnittsüberschriften, auch wenn sie wiederholt vorkommen
- Fortsetzungsüberschriften wie `BERUFLICHER WERDEGANG – FORTSETZUNG`
- normale Inhaltszeilen, auch wenn sie mehrfach vorkommen

Jedes ignorierte Element bleibt in `ignored` mit Grund (`page-number`,
`page-header`, `page-footer`) und Originalblock nachvollziehbar. Es werden keine
rohen personenbezogenen Texte geloggt.

Test: 6 Tests PASS mit einem synthetischen vierseitigen Dokument:
Kopfzeilen werden nicht zu Arbeitgebern, Seitenzahlen nicht zu Daten,
Fortsetzungen bleiben erhalten, und jeder Quellblock ist entweder Inhalt oder
begründet ignoriert.

## STEP C — Abschnittserkennung

Die Erkennung unterstützt jetzt:

- zusammengesetzte Überschriften wie `AUSBILDUNG, SPRACHEN & WEITERE QUALIFIKATIONEN`
- `KERNKOMPETENZEN – ATS-SUCHBEGRIFFE` als Skills
- `AKTUELLE ARCHITEKTUR- UND SOFTWAREPROJEKTE` als Projekte
- `AWS QA LABS – PRAXISORIENTIERTE CLOUD-QUALIFIZIERUNG` als Training/Praxis
- `WEITERBILDUNG & ZERTIFIKATSSTATUS` als Zertifikatsstatus
- `BERUFLICHER WERDEGANG – LANGE TIMELINE` als Erfahrung
- `ATS- UND VERÖFFENTLICHUNGSHINWEISE` als Dokumenthinweise

Unbekannte Überschriften eröffnen einen eigenen `unknown`-Abschnitt und werden
nicht an die vorherige Kategorie gehängt. Datums- und Projektzeilen werden nicht
als Überschrift missinterpretiert.

Commit: `7f7a9a2`. Tests: 9 strukturelle Tests PASS, Build PASS.

## STEP D — Fortsetzungen und lange Timelines

`PROFESSIONAL EXPERIENCE (CONTINUED)` und
`BERUFLICHER WERDEGANG – FORTSETZUNG` werden als Fortsetzung desselben
Abschnitts erkannt und niemals als Position/Arbeitgeber übernommen.

`detectTimelineItems()` unterscheidet strukturell:

- `employment`
- `freelance`
- `project`
- `training`
- `qualification`
- `unclear`

Freelance-Projekte erhalten eine Parent-ID. Überlappende Zeiträume bleiben
unverändert; fehlende Monate werden nicht erfunden. Ein fehlgeschlagener
Build-Checkpoint wurde mit `2620685` korrigiert; danach Build und 11 Tests PASS.

## STEP E — Strukturierte Zwischendarstellung

`CvBuilderImportResult.structure` enthält jetzt:

- `pageCount`
- `sections` mit `pageStart`, `pageEnd`, `blocks`, `uncertain`, `continued`
- `ignored` mit Grund
- `sourceBlocks`, `unknownBlocks`, `unusedBlocks`
- `uncertainSections`

Der Parser akzeptiert weiterhin `parseCvBuilderImportText(raw)` und optional
`parseCvBuilderImportText(raw, document)`. Der Importdialog nutzt die
strukturierte Extraktion, fällt bei älteren Mocks aber auf `extractPdfText()`
zurück.

Commit: `ab7da56`. Tests: Parser/Dialog/Struktur **24 PASS** (danach 34 PASS
inklusive Dialog), Build PASS.

## STEP F — Qualitätsprüfung mit Referenzdokument

Private vierseitige Referenz-PDF, lokal ausgewertet. Keine Rohinhalte im Repo.
Messbasis: 143 extrahierte Textblöcke.

| Messpunkt | Vorher (`cef41cc`) | Nachher |
|---|---:|---:|
| Erkannte Abschnittsüberschriften | 3 Builder-Abschnitte | 9 Dokumentüberschriften / 10 Sections |
| Falsche bzw. nicht erkannte Abschnittszuordnungen | 6 fehlend | 0 |
| Verlorene Textblöcke (`unusedBlocks`) | keine Strukturzuordnung | 0 |
| Erkannte Seitenwechsel | 0 | 4 Seiten, 3 seitenübergreifende Sections |
| Wiederholte Kopfzeilen als Daten | 1 | 0 |
| Unklare Inhalte erhalten | 0 | 66 unassigned lines + 27 unknown blocks |
| Builder-Erfahrungseinträge | 0 | 5 vollständige Einträge |
| Strukturelle Timeline | nicht vorhanden | 9 `employment`, 4 `project` |
| Projekte | 0 | 4 |
| Zertifikate | 0 | 0 (Zertifizierungsziele nicht als Zertifikat) |
| Sprachen | 0 | 1 |
| Ausbildung | 0 | 1 |

Die vier unvollständigen Timeline-Items bleiben für die manuelle Zuordnung
erhalten; die vollständige Builder-Übertragung ist Aufgabe von 02C.

Commit: `2bf6d79`. Tests: Parser **14 PASS**, inklusive vier datierter Projekte
und Zertifizierungsziel-Abgrenzung; Build PASS.

## STEP G — Regression und Gesamtprüfung

| Prüfung | Ergebnis |
|---|---|
| Fokussierte Parser-/Struktur-/Dialogtests | **35 PASS** |
| Serielle Gesamtsuite | **1734 PASS / 5 skipped** |
| Production-Build | **PASS** |
| Bestehender Import-E2E (lokal + RIS, 6 Breiten) | **PASS** |
| Workflow-02A-E2E (6 Breiten + unsaved) | **PASS** |
| Neuer vierseitiger 02B-E2E (6 Breiten) | **PASS** |
| Horizontales Overflow | **0** |
| Kopfzeilen-Leaks im Preview | **0** |
| Unerwartete API-/RIS-Schreibzugriffe | **0** |

Der neue 02B-E2E erzeugt synthetische vierseitige PDFs mit wiederholten
Kopf-/Fußzeilen, Seitenzahlen, vier datierten Projekten, Fortsetzung,
Training, Zertifizierungsziel, gemischtem Ausbildungs-/Sprachabschnitt und
Dokumenthinweisen. Geprüft wurden 320, 390, 430, 768, 1024 und 1440 px.

Screenshots: `docs/reports/assets/CV-BUILDER-PARSER-02B/`
(`preview-{width}.png`, `editor-{width}.png`, `results.json`).

Regressionen bestätigt: PDF vom Gerät, RIS-CV-Import, Importvorschau,
manuelle Einzelzuordnung, Builder-Vorbelegung, Speichern/Schließen,
PDF-Export und Session-Isolation.

Commit: `a6ae146`; letzter Normalisierungs-Fix `ef111ae`. Build und
Gesamtsuite danach erneut PASS.

## Commit-Historie

- `b5d3420` — strukturierte PDF-Seiten/Blöcke
- `51d0dbc` — Kopf-/Fußzeilen- und Seitenzahl-Normalisierung
- `6c4e0f6` — Dokumentation A/B
- `7f7a9a2` — zusammengesetzte Abschnittserkennung
- `6c1550b` — Timeline-Klassifikation
- `2620685` — Build-Fix (unbenutzter Parameter)
- `ab7da56` — strukturierte Parser-Integration
- `2bf6d79` — Timeline-/Projekt-/Zertifikatsziel-Abgrenzung
- `7a731fd` — Qualitätsdokumentation
- `a6ae146` — vierseitiger Responsive-E2E
- `ef111ae` — wiederholte unbekannte Überschriften erhalten

**Gepusht:** `origin/feature/cv-builder-parser-02b`

## Offene Punkte

- 02B trennt die Struktur; die vollständige Übertragung komplexer
  Timeline-/Qualifikationsdetails in alle Builder-Felder bleibt Aufgabe von 02C.
- Vier Timeline-Einträge der Referenz sind ohne vollständige Arbeitgeber-/Rollen-
  angabe und bleiben bewusst der manuellen Prüfung vorbehalten.
- Die Referenz liefert 67 ATS-nahe Skill-Kandidaten; eine fachliche Reduktion
  ist Mapping-/Curating-Aufgabe, keine stille Parser-Löschung.
- Zwei-Spalten-PDFs bleiben durch die PDF.js-Lesereihenfolge begrenzt; keine
  Layout- oder OCR-Erfindung.
- Kein Merge nach `main`, kein Production-Deployment, keine RIS-/AWS-/
  Terraform-/Cognito-Änderung, keine echten Benutzerdaten.

## Empfehlung

**GO für Review und den nachfolgenden Mapping-Schritt 02C.**
**NO-GO für Merge/Production ohne gesonderte Freigabe.**

## Sicherheitsgrenzen

- Kein Merge nach `main`, kein Deployment.
- Keine RIS-/AWS-/Terraform-/Cognito-Änderung.
- Keine KI, kein OCR, keine neuen Backend-Endpunkte.
- Keine echten Benutzerdaten in Repository-Fixtures.
- Private Referenz-PDF bleibt außerhalb des Repositories.
- Kein Force-Push, kein History-Rewrite.
