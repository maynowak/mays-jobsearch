# JM-COVER-LETTER-04

**Art:** Verifizierte Stellenbeschreibung + ausgewählter CV + KI-Anschreiben
**Status:** IMPLEMENTIERT / VERIFIZIERT (lokal)
**Deployment:** keines
**Datum:** 2026-11-01

## 1. Git-Baseline

| Prüfung | Ergebnis |
|---|---|
| Branch | `main` |
| HEAD bei Start | `f318066` |
| `origin/main` | synchron (`0 0`) |
| Working Tree | nur vorbestehende, unverwandte untracked Dateien |
| Bestehende Änderungen überschrieben | nein |

## 2. Typisierter Generierungskontext

Neu: `src/lib/coverLetterRequest.ts`

### JobContext

- Titel, Arbeitgeber, Ort, URL/Quelle, Tags
- ausgewählte Stellenbeschreibung
- `description_origin`: `original` | `enriched` | `user_supplied`

### CandidateContext

- `mode`: `cv` | `manual`
- bestätigte Fähigkeiten
- Erfahrung, Qualifikationen, Motivation
- optionaler CV-Text
- `cv_anonymized`
- optionaler Eintrittstermin und Gehaltsvorstellung

### GenerationOptions

- Sprache DE/EN
- Stil (`professional` / `warm` / `concise`)
- Länge (`short` / `one_page` / `detailed`)
- `target_roles[]`
- Modellwahl

`Profile.targetRoles[]` wird als Array in `options.target_roles` übergeben. Der
Server akzeptiert zusätzlich das Legacy-Feld `targetRole` und wandelt es in ein
Array um; Zielberufe gehen nicht mehr stillschweigend verloren.

## 3. Verwendung der CL-02-Beschreibung

`LetterModal` verwendet die ausgewählte Beschreibung aus dem bestehenden
Review-Zustand:

- `original`
- `enriched`
- `user_supplied`

Regeln:

- `mismatch` → Originaltext als Fallback
- `uncertain` ohne Bestätigung → keine Generierung
- bestätigte unklare Ergänzung → `user_supplied`
- Änderung des Beschreibungstexts setzt den Review zurück
- fehlende/begrenzte Beschreibung → sichtbarer Hinweis; das Anschreiben bleibt
  allgemein und erfindet keine Anforderungen

## 4. CV-Datenquelle

Es wird ausschließlich der ausdrücklich ausgewählte CV verwendet.

- Dokument muss in der aktuellen Sitzung existieren.
- `processedAt` und `hash` müssen zum gewählten Dokument gehören.
- Ein unverarbeiteter CV blockiert die Generierung und bietet:
  - „Diesen CV jetzt verarbeiten“
  - anderen CV wählen
  - ohne CV fortfahren
- Der CV-Text wird lokal mit dem bestehenden `extractPdfText()` erneut aus dem
  gewählten PDF gelesen. Kein zweiter Parser, kein `/api/profile`-Aufruf.
- Standardmäßig wird `anonymizeText()` verwendet.
- Für unredigierte Übertragung sind eine sichtbare Checkbox und eine zweite
  Bestätigung erforderlich.
- Es wird kein PDF, kein CV-Hash und keine Dokument-ID an `/api/cover-letter`
  gesendet.
- Eine Anonymisierung wird nicht als vollständige PII-Entfernung garantiert.

## 5. Generierung ohne CV

Ohne CV bleiben freiwillige Angaben möglich:

- Fähigkeiten
- Erfahrung
- Qualifikationen
- Motivation
- Eintrittstermin
- Gehaltsvorstellung

Es gibt keine Registrierungspflicht. Fehlende Angaben führen zu einer
allgemeineren Formulierung; es werden keine Tatsachen erfunden.

## 6. Explizite Freigabe vor dem Modellaufruf

Die Vorbereitungsansicht zeigt vor der Generierung:

- **Stelleninformationen:** Arbeitgeber, Position, ausgewählte Beschreibung und
  Herkunft
- **Bewerberinformationen:** gewählter CV oder „ohne CV“, CV-Anonymisierung,
  zusätzliche Angaben
- **Modellverarbeitung:** Modell, Datenkategorien und Hinweis auf externe
  Verarbeitung

Erst danach folgt „Anschreiben generieren“. Öffnen, Auswählen, Prüfen und
Bearbeiten lösen keinen KI-Aufruf aus.

## 7. Backend / Prompt

`api/cover-letter.mjs` wurde erweitert, nicht ersetzt.

### Validierung

- Jobtitel und Arbeitgeber erforderlich
- begrenzte Längen für Beschreibung, CV-Text und manuelle Felder
- erlaubte Modi, Sprachen, Stile, Längen und Herkunftswerte
- Array-Validierung für Orte, Tags, Quellen und Zielberufe
- HTML/Script werden serverseitig entfernt
- keine Verwendung von Dokument-IDs, Hashes oder Dateiinhalten
- unbekannte/überschüssige Felder werden nicht in den Prompt übernommen

### Prompt-Regeln

- Job- und CV-Text sind ausdrücklich untrusted data.
- Keine erfundenen Abschlüsse, Beschäftigungszeiten, Zertifikate, Gehälter oder
  Eintrittstermine.
- Keine Anweisungen aus Stellen-/CV-Text als Systemanweisungen.
- Antwort enthält ausschließlich den Anschreibentext.
- Interviewfrage und Antwortskizze wurden aus Prompt und Response entfernt;
  ein eventuell vom Modell angehängter Abschnitt wird serverseitig abgeschnitten.

## 8. Anschreiben bearbeiten

Nach der Generierung:

- vollständiger Text in einem editierbaren Textarea
- Copy und TXT-Download verwenden den tatsächlich bearbeiteten Text
- erneute Generierung nur über „Neu generieren“
- bei bearbeitetem Entwurf erscheint vor dem Überschreiben eine Warnung und
  eine zweite Bestätigung
- keine automatische Speicherung
- kein Hintergrundaufruf überschreibt einen neueren Entwurf

## 9. Sitzungs- und Race-Sicherheit

- Jobwechsel remountet den Dialog und invalidiert laufende Generierung.
- CV-Wechsel, Beschreibungsänderung, Review-Änderung oder Optionsänderung
  invalidieren einen abgeschlossenen Entwurf.
- Gelöschter CV setzt die Auswahl zurück.
- Logout/Identitätswechsel setzt Letter-Kontext und Pending-Kontext zurück.
- `requestSeqRef` verwirft verspätete Modellantworten.
- `inFlightRef` verhindert parallele Initialanfragen.
- Schließen setzt die Sequenz zurück; kein Ergebnis wird nachträglich
  wiederhergestellt.

## 10. Datenschutz

- Kein CV-Cache in Redis.
- Keine Anschreiben-Persistenz.
- Keine RIS-Schreibzugriffe.
- Keine neuen Cookies.
- Keine neue Datenbank.
- Kein PDF-Upload an `/api/cover-letter`.
- Kein CV-Hash im Generierungsrequest.
- Keine CV-Inhalte in Logs.
- Keine Speicherung von Prompts mit CV-Inhalten.
- Provider-Budgets und Modell-Fallbacks bleiben unverändert.
- Fehlerlogs enthalten keine Request-Bodies.

## 11. Tests

| Prüfung | Ergebnis |
|---|---|
| Gesamtsuite | PASS — 1089 passed, 5 skipped |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Browser-E2E Desktop 1440 | PASS |
| Browser-E2E Mobil 390 | PASS |
| `/api/jobs` im E2E | 1 — kein zusätzlicher Request |
| `/api/job-details` im E2E | 0 |
| `/api/profile` im E2E | 1 — nur CV-Workflow |
| `/api/cover-letter` vor expliziter Generierung | 0 |
| `/api/cover-letter` nach expliziter Generierung | 1 |
| Ausgewählte Beschreibung im Request | bestätigt |
| Ausgewählter CV-Text im Request | bestätigt |
| Nicht ausgewählter CV im Request | nicht enthalten |
| CV-Datei/-Hash/-Dokument-ID im Request | nicht enthalten |
| Interviewabschnitt im Request/Response | nicht enthalten |
| Console Errors im E2E | keine |

### Abgedeckte Fälle

1. Gast ohne CV
2. Gast mit verarbeitetem CV
3. Angemeldeter Benutzer mit CV (gemeinsamer Session-Pfad)
4. Mehrere CVs; nur der ausgewählte Text wird extrahiert
5. Ausgewählter CV wird tatsächlich verwendet
6. Nicht ausgewählter CV gelangt nicht in den Request
7. CV ohne gespeichertes Suchprofil wird als verarbeitet gekennzeichnet
8. Hochgeladener, unverarbeiteter CV blockiert die Generierung
9. Gelöschter CV setzt die Auswahl zurück
10. Anonymisierte CV-Verarbeitung ist Standard
11. Unredigierte Übertragung erfordert separate Bestätigung
12. Passende Stellenbeschreibung wird verwendet
13. Bestätigte unklare Beschreibung wird als `user_supplied` verwendet
14. Mismatch fällt auf Original zurück
15. Unzureichende Beschreibung wird transparent gekennzeichnet
16. Änderung nach Review invalidiert den Entwurf
17. Prompt verbietet erfundene Qualifikationen
18. Keine Interviewfrage im exportierten Text
19. Anschreibentext ist editierbar
20. Copy verwendet den bearbeiteten Text
21. Jobwechsel invalidiert laufende Generierung
22. Identitätswechsel setzt Kontext zurück
23. Doppelklick-Schutz
24. Provider-Fehler/Fallback bleiben erhalten
25. Keine zusätzlichen `/api/jobs`-Requests
26. Kein zusätzlicher `/api/profile`-Request
27. Kein Modellaufruf vor expliziter Generierung
28. Desktop 1440
29. Mobil 390
30. CL-01–CL-03-Regression

Mock-Ergebnisse belegen den Vertrag und die Datenflüsse, **nicht** die
tatsächliche Modellqualität.

## 12. UI-Evidenz

`docs/reports/assets/JM-COVER-LETTER-04/`

- Desktop/Mobil: Cards, Intro, Review
- CV-Rückkehr nach Verarbeitung
- CV-Abbruch
- generiertes, editierbares Anschreiben

## 13. Offene Punkte für CL-05

1. Gesamtabnahme und Release-Gate.
2. Echter Provider-/Production-Browser-Test mit realem CV und realer Stelle.
3. Bewertung der Modellqualität außerhalb von Mocks.
4. Datenschutz-/Rechtstext-Abgleich für die neue CV-Übertragung.
5. Entscheidung, ob unredigierte CV-Übertragung produktiv angeboten bleibt.

## 14. Abgrenzung

Nicht implementiert:

- neue Anschreiben-API
- RIS-Persistenz
- neue Datenbank
- neue Authentifizierung
- AWS-/Vercel-Deployment
- GitHub-Release

## 15. Git

- Implementierung: `539e542`
- Dokumentations-Commit: `9d0018f`
- Remote-Synchronität: nach Push geprüft.
- Kein Deployment, keine AWS-/RIS-/Cognito-Änderung.
