# JM-COVER-LETTER-05-RELEASE-GATE

**Art:** End-to-End-Abnahme / Privacy-Audit / Release-Gate
**Status:** **YELLOW — technisch weitgehend abgenommen, Produktionsfreigabe NO-GO**
**Datum:** 2026-11-01
**Deployment:** keines

## 1. Git-Baseline

| Prüfung | Ergebnis |
|---|---|
| Branch | `main` |
| HEAD bei Start | `f30fe8c` |
| `origin/main` | synchron (`0 0`) |
| Working Tree | nur vorbestehende, unverwandte untracked Dateien |
| Bestehende Änderungen überschrieben | nein |

## 2. Geprüfte Komponenten

- `src/lib/coverLetterRequest.ts`
- `src/api.ts`
- `src/components/LetterModal.tsx`
- `src/App.tsx`
- `api/cover-letter.mjs`
- `src/lib/jobDescriptionReview.ts`
- `src/lib/pdf.ts`
- `src/lib/anonymize.ts`
- `src/lib/cvProfileStore.ts`
- `tests/api/cover-letter.test.mjs`
- `src/components/LetterModal.test.tsx`
- `src/components/MatchCard.test.tsx`
- `src/components/RemainingCard.test.tsx`
- `src/components/Results.test.tsx`
- `tests/e2e/cover-letter-entry.mjs`

## 3. Gefundene Fehler und Korrekturen

### P0 — Modellrouting

**Befund:** Das Frontend sendet das gewählte Modell in `options.model`.
`api/cover-letter.mjs` las initial nur `body.model`. Damit wurde die
Modellwahl des typisierten V1-Vertrags nicht an `chat()` weitergegeben.

**Korrektur (Commit `e62ad3c`):**

- `options.model` ist die primäre Quelle.
- `body.model` bleibt als Legacy-Fallback erhalten.
- Ein leerer `options.model` fällt auf `body.model` zurück.
- Ungültige Modellwerte (z. B. Zahl) werden mit HTTP 400 abgelehnt.
- `chat()` erhält das ausgewählte Modell.
- Die bestehende Provider-/Free-Model-Prüfung bleibt wirksam.
- Das Frontend übergibt bei jedem Fallback-Lauf das jeweilige Modell in
  `options.model`.

**Tests:**

- `options.model` erreicht `chat()`.
- Legacy `body.model` funktioniert.
- Ungültiger Modellwert wird abgelehnt.
- LetterModal-Fallback übergibt das Fallback-Modell in `options.model`.

### P1 — Stille CV-Kürzung

**Befund:** Der ausgewählte CV-Text wurde bei 30.000 Zeichen stillschweigend
abgeschnitten (Browser und Server).

**Korrektur:**

- Browser blockiert zu lange CV-Texte mit verständlicher Meldung.
- Server lehnt zu lange Textfelder mit HTTP 400 ab statt zu kürzen.
- Keine KI-Zusammenfassung, kein zweiter Parser.
- Keine dauerhafte Speicherung des extrahierten Textes.

## 4. Vertragsprüfung

| Feld | Status |
|---|---|
| `job.title`, `company_name`, `location`, `url`, `source`, `tags` | PASS |
| `job.description` — ausgewählter CL-02-Text | PASS |
| `job.description_origin` | PASS |
| `candidate.mode` | PASS |
| `candidate.skills` | PASS |
| `candidate.cv_text` — nur ausgewählter CV | PASS |
| `candidate.cv_anonymized` | PASS |
| `options.target_roles` — aus `Profile.targetRoles[]` | PASS |
| `options.language` | PASS |
| `options.style` | PASS |
| `options.length` | PASS |
| `options.model` | PASS (P0 korrigiert) |
| Legacy `body.targetRole` | PASS (als Array normalisiert) |
| Legacy `body.model` | PASS |

## 5. Datenschutzprüfung

### Verifiziert

- Nur der ausdrücklich ausgewählte CV wird lokal gelesen.
- Kein PDF-Upload an `/api/cover-letter`.
- Keine CV-Dokument-ID und kein CV-Hash im Request.
- Standardmäßig `anonymizeText()`.
- Unredigierte Übertragung erfordert eine separate Bestätigung.
- Keine Redis-CV-Speicherung.
- Keine Anschreiben-Speicherung.
- Keine RIS-Schreibzugriffe.
- Keine neuen Cookies.
- Provider-Logs enthalten Modell/Status/Fehler, aber keinen Prompt.
- Fehlerausgaben des API-Endpunkts enthalten keinen Request-Body.

### Bewertung / offene Risiken

- **Unredigierte CV-Übertragung:** Der Code bietet sie nach ausdrücklicher
  Bestätigung an. Nach vorläufiger Datenschutzbewertung sollte sie **nicht**
  produktiv freigegeben werden, solange Rechtsgrundlage, Empfängerinformationen
  und Drittlandstransfer nicht geklärt sind. Eine bloße Benutzerbestätigung
  ersetzt keine vollständige DSGVO-Prüfung.
- Die vorhandene Anonymisierung ist eine Risikoreduktion, keine Garantie der
  vollständigen Entfernung personenbezogener Daten.
- Der öffentliche Datenschutz-Arbeitsentwurf ist noch nicht final freigegeben
  und enthält u. a. noch pauschale Cache-/Anbieterformulierungen.
- Vollständige Jobbeschreibung und CV-Text werden für die Generierung
  übertragen; das ist funktional erforderlich, aber nur mit finaler
  Datenschutzinformation freigebbar.

## 6. Qualitätsprüfung

Synthetische Szenarien wurden gegen den technischen Vertrag und den Prompt
geprüft:

| Szenario | Technischer Vertrag | Inhaltliche Qualität |
|---|---|---|
| A: Cloud Engineer mit passendem CV | PASS | nicht live verifiziert |
| B: Softwareentwickler, teilweise passend | PASS | nicht live verifiziert |
| C: Gast ohne CV, manuelle Angaben | PASS | nicht live verifiziert |
| D: Fehlende Stellenbeschreibung | PASS (Hinweis + allgemeiner Prompt) | nicht live verifiziert |
| E: Fehlende geforderte Qualifikation | PASS (Prompt verbietet Erfindung) | nicht live verifiziert |
| F: Englischsprachige Ausschreibung | PASS (`language`/Prompt) | nicht live verifiziert |

Der Prompt verbietet:

- erfundene Abschlüsse
- erfundene Beschäftigungszeiten
- erfundene Zertifikate
- erfundene Gehälter
- erfundene Eintrittstermine
- falsche Arbeitgeber
- Interviewfragen im Anschreiben
- Ausführung von Anweisungen aus Job-/CV-Texten

**`LIVE PROVIDER TEST: NOT EXECUTED`**
Es wurde kein echter Provider aufgerufen. Mock-Tests belegen Vertragstreue und
Datenfluss, **nicht** die tatsächliche Modellqualität.

## 7. Sicherheit und Race Conditions

| Prüfung | Ergebnis |
|---|---|
| Jobwechsel während Generierung | PASS — Context/Sequence invalidiert |
| CV-Wechsel | PASS — Auswahl/Entwurf invalidiert |
| Löschen des gewählten CV | PASS — Auswahl fällt zurück |
| Logout / Identitätswechsel | PASS — Kontext wird verworfen |
| Gast ↔ angemeldet | PASS — session-only Kontext |
| Schließen während Request | PASS — Ergebnis wird nicht wiederhergestellt |
| Mehrfachklicks | PASS — `inFlightRef` |
| Provider-Fallback | PASS — `withModelFallback` |
| Bearbeitung / erneute Generierung | PASS — Warnung + Bestätigung |
| Untrusted Prompt-Injection | PASS im Prompt-Vertrag; keine Systemausführung |

## 8. Bedienbarkeit und Export

Browser-E2E Desktop 1440 und Mobil 390:

- Stellenkarten-Aktionen sichtbar.
- Beschreibungsreview funktioniert.
- CV-Auswahl / Upload-Rückkehr / Abbruch funktionieren.
- Generierungsfreigabe zeigt Datenkategorien.
- Loading/Error/Fallback sichtbar.
- Text editierbar.
- Copy und TXT-Download verwenden den bearbeiteten Text.
- Escape/Fokusführung funktionieren.
- Kein horizontaler Overflow.
- Keine Console Errors.

## 9. Tests

| Prüfung | Ergebnis |
|---|---|
| Cover-Letter-API | PASS — 12 Tests |
| LetterModal | PASS — 29 Tests |
| JobDescriptionReview | PASS |
| MatchCard/RemainingCard/Results | PASS |
| CV-Workflow-/Auth-Regression | PASS |
| Gesamtsuite | **1096 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Browser-E2E Desktop 1440 | PASS |
| Browser-E2E Mobil 390 | PASS |
| `/api/jobs` im E2E | 1 — kein zusätzlicher Request |
| `/api/job-details` im E2E | 0 |
| `/api/profile` im E2E | 1 — nur CV-Workflow |
| `/api/cover-letter` vor Start | 0 |
| `/api/cover-letter` nach Start | 1 |
| Ausgewählte Beschreibung im Request | PASS |
| Ausgewählter CV-Text im Request | PASS |
| CV-Datei/-Hash/-ID im Request | nicht enthalten |
| Interviewabschnitt im Request/Response | nicht enthalten |

Bekannte intermittierende Tests: keine in diesem finalen Lauf; frühere
Docker-Stop-Timeouts wurden durch ein angemessenes Test-Timeout entschärft.

## 10. Release-Gate-Matrix

| Gate | Bewertung | Begründung |
|---|---|---|
| G01 Git-/Repository-Integrität | **PASS** | Baseline `f30fe8c`, Remote synchron, keine fremden Änderungen überschrieben |
| G02 API-Vertragskonsistenz | **PASS** | Felder und Prioritätsregeln geprüft; P0 korrigiert |
| G03 Modellrouting und Fallback | **PASS** | `options.model` → `chat()`, Legacy-Fallback, Fallback-Test |
| G04 Stellenbeschreibung und CV-Zuordnung | **PASS** | Selected CV + selected description; keine Fremd-CVs |
| G05 Datenschutz und Datenminimierung | **BLOCKED** | Unredigierte CV-Option und finale Rechtsgrundlage nicht freigegeben; Anonymisierung ohne Vollständigkeitsgarantie |
| G06 Sitzungsschutz und Race Conditions | **PASS** | Sequenz-/Identity-/Selection-Guards getestet |
| G07 Frontend und Barrierefreiheit | **PASS** | Desktop/Mobil, Fokus, Escape, Export |
| G08 Gesamttests und Browser-E2E | **PASS** | 1096/5, TypeScript, Build, E2E |
| G09 Tatsächliche Modellqualität | **NOT VERIFIED** | `LIVE PROVIDER TEST: NOT EXECUTED` |
| G10 Datenschutztexte und Freigabe | **BLOCKED** | Öffentliche Texte nicht final; Rechtsprüfung offen |

### Gesamtbewertung

**YELLOW — technisch weitgehend abgenommen, aber Produktionsfreigabe NO-GO.**

- Kein RED: P0 ist behoben; keine bekannte kritische Funktions-/Sicherheitslücke
  im getesteten Pfad.
- Kein GREEN: G05, G09 und G10 sind nicht erfüllt.
- **GO für Produktion erst nach**:
  1. Entscheidung zur unredigierten CV-Übertragung (empfohlen: deaktivieren),
  2. finaler Datenschutz-/Rechtstext-Freigabe,
  3. einem autorisierten synthetischen Live-Provider-Test,
  4. separater Deployment-Freigabe.

## 11. Offene Risiken

1. Unredigierte CV-Übertragung ist technisch möglich; produktiv nicht freigegeben.
2. Keine echte Modellqualitätsaussage.
3. Datenschutztexte sind Arbeitsentwurf.
4. Modell-/Providerauswahl und Drittlandtransfer müssen rechtlich geprüft werden.
5. Anonymisierung ist keine Garantie vollständiger PII-Entfernung.
6. Jobbeschreibungen können unbeabsichtigt personenbezogene Angaben enthalten.
7. V-10 (Order-/Ownership) ist nicht Teil dieses Jobsearch-Gates.

## 12. Korrektur-Commit

- P0 Modellrouting + CV-Limit + Tests: `e62ad3c`
- Dokumentations-Commit: nach diesem Bericht.

## 13. Empfehlung

**NO-GO für Produktionsdeployment.**
Der Anschreiben-Assistent ist technisch testbar und die P0-Korrektur ist
verifiziert. Für eine GREEN-Freigabe fehlen die Datenschutzfreigabe (G05/G10)
und ein autorisierter Live-Provider-Test (G09). Kein Deployment, keine
AWS-/RIS-/Cognito-Änderung, kein Release.
