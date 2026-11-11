# CV-BUILDER-PARSER-02B — DOCUMENT STRUCTURE RECOGNITION

**Status:** `IN PROGRESS — STEP B COMPLETE`  
**Branch:** `feature/cv-builder-parser-02b`  
**Base:** `origin/main` `cef41cc`  
**Zielstatus:** `CV-BUILDER-PARSER-02B — IMPLEMENTED / VERIFIED LOCAL / FEATURE BRANCH PUSHED`

## Step-Matrix

| Step | Thema | Status | Commit |
|---|---|---|---|
| A | Strukturierte PDF-Extraktion mit Seiten-/Blockzuordnung | **COMPLETE** | `b5d3420` |
| B | Dokumentnormalisierung: Kopf-/Fußzeilen, Seitenzahlen, Fortsetzungen | **COMPLETE** | `51d0dbc` |
| C | Abschnittserkennung und Abschnittsgrenzen | OFFEN | — |
| D | Fortsetzungen und lange Timelines | OFFEN | — |
| E | Strukturierte Zwischendarstellung | OFFEN | — |
| F | Qualitätsprüfung mit Referenzdokument | OFFEN | — |
| G | Regression und Gesamtprüfung | OFFEN | — |

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

## Sicherheitsgrenzen

- Kein Merge nach `main`, kein Deployment.
- Keine RIS-/AWS-/Terraform-/Cognito-Änderung.
- Keine KI, kein OCR, keine neuen Backend-Endpunkte.
- Keine echten Benutzerdaten in Repository-Fixtures.
- Private Referenz-PDF bleibt außerhalb des Repositories.
- Kein Force-Push, kein History-Rewrite.
