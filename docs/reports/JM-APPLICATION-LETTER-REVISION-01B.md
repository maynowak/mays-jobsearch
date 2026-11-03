# JM-APPLICATION-LETTER-REVISION-01B

**Art:** Anschreiben-Verwaltung / KI-Verbesserung / temporäre Vorschau
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Deployment, keine echte KI-Anfrage
**Datum:** 2026-11-03
**Branch:** `feature/jm-application-letter-revision-01b`
**Ausgangsstand:** 01A `0fa6941`
**Grenzen:** Keine neue Persistenz, keine neue API, keine neuen Provider, keine RIS-/AWS-/Cognito-Änderung, kein Deployment.

## 1. API-Wiederverwendung

Es wird ausschließlich der vorhandene Client/Kontrakt verwendet:

```text
POST /api/cover-letter
operation: "revise"
revision: {
  draft_text: <anonymisiert>,
  draft_anonymized: true,
  feedback?: <anonymisiert>
}
```

- `generateCoverLetter` und `withModelFallback` aus `src/api.ts`.
- Ausgewähltes Modell wird als `options.model` übertragen.
- Bestehende Provider-/Fallback-Konfiguration bleibt unverändert.
- Keine neue Cover-Letter-API, keine neuen Credentials, keine neuen Provider.

## 2. Ausgangsfassung

Die Ausgangsfassung wird über die bestehende 01A-Auswahl bestimmt
(`Ausgangsversion`):

- aktueller Entwurf oder
- jede vorhandene gespeicherte Version.

Die ausgewählte Fassung wird nur gelesen. Bei Wechsel von Bewerbung oder
Ausgangsfassung wird ein vorhandener Vorschlag verworfen und die laufende
Zuordnung entwertet.

## 3. Datenübertragungsgrenzen

Gesendet werden:

- Stellenreferenz: Titel, Arbeitgeber, Ort, URL, Quelle
- leere Jobbeschreibung, da im Bewerbungsdatensatz keine vollständige
  Beschreibung gespeichert ist
- manueller Kandidatenkontext ohne erfundene Skills/Erfahrung
- die anonymisierte ausgewählte Anschreibenfassung
- der anonymisierte Verbesserungswunsch
- Sprache, Stil, Länge, leere Zielrollen und ausgewähltes Modell

Nicht gesendet:

- Kontakt-/Gehaltsdaten
- persönliche Bewerbungsnotizen
- CV-Datei oder CV-Text
- vollständige Jobbeschreibung ohne vorhandene Daten
- erfundene Kandidatenangaben

## 4. Anonymisierung und Einwilligung

- `anonymizeText()` wird auf Ausgangstext und Verbesserungswunsch angewendet.
- `draft_anonymized: true` wird erst nach dieser lokalen Transformation gesetzt.
- Eine erforderliche Checkbox-Einwilligung ist standardmäßig deaktiviert.
- Ohne Einwilligung ist die Aktion deaktiviert; es gibt keinen Request.
- Die UI weist darauf hin, dass die Anfrage an den konfigurierten KI-Anbieter
  geht und vollständige Anonymisierung nicht garantiert werden kann.
- Fallback-Provider bleiben unter derselben Transparenz-/Einwilligungsregel.

## 5. Vorschlagszustand

Der Vorschlag ist ausschließlich lokaler React-State:

- Ausgangsbewerbung
- Ausgangsversion
- Ausgangstext
- Vorschlagstext
- tatsächlich erfolgreiches Modell, sofern vorhanden
- Antwortzeit
- Fallback-Hinweis

Keine Änderung an `coverLetterDraft`, `coverLetterVersions`, Status, History
oder Repository. Keine Persistenz in localStorage/sessionStorage/IndexedDB.
„Vorschlag verwerfen“ entfernt nur den temporären Zustand.

## 6. Schutz gegen asynchrone Fehler

- `inFlightRef` + `improving` verhindert Doppelklick/parallele Anfragen.
- `requestSeqRef` entwertet verspätete Antworten.
- Bewerbungs-/Ausgangsfassungswechsel erhöht die Request-Sequenz und verwirft
  den Vorschlag.
- Unmount invalidiert die Sequenz.
- Fehler verändern den Originaltext nicht.
- Leere Antworten werden als Fehler behandelt.
- Zu lange Ausgangstexte werden vor dem Request abgewiesen.
- Keine automatische Wiederholung.

## 7. UI

Innerhalb des Dokumente-Tabs, nach dem 01A-Vergleich:

- „Anschreiben mit KI verbessern“
- Ausgangsfassung (aus 01A)
- KI-Modellauswahl
- Verbesserungswunsch
- Datenschutz-/Anonymisierungshinweis
- erforderliche Einwilligungs-Checkbox
- „Verbesserung vorschlagen“
- Vorschau: Ausgangsfassung und KI-Vorschlag vollständig nebeneinander
  (mobil untereinander)
- „Erneut verbessern“
- „Vorschlag verwerfen“

Keine automatische Anfrage beim Öffnen, Tab-Wechsel, Quellenwechsel oder
Modellwechsel.

## 8. Responsive / Accessibility

- Zwei Spalten Desktop; ≤900 px untereinander.
- Keine festen Höhen oder Textkürzungen in den Textbereichen.
- Native Selects/Checkbox/Buttons, sichtbare Fokuszustände.
- 1440/1024/768/390/320 px ohne horizontalen Overflow.
- Navbar-BBox bleibt ohne Überlagerung.
- Keine sichere HTML-Injektion; nur Text in `<pre>`.

## 9. Tests

| Prüfung | Ergebnis |
|---|---|
| ApplicationLetterImprovement | **6 passed** |
| ApplicationLetterComparison | **6 passed** |
| ApplicationsSection | **31 passed** |
| Gesamtsuite (`npm test -- --run`) | **1235 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Applications-E2E Desktop 1440 | PASS |
| Applications-E2E Mobil 390 | PASS |
| AI-Improvement responsive 1024 / 768 / 320 | PASS |
| Comparison responsive 1024 / 768 / 320 | PASS |
| Cover-Letter-E2E Desktop 1440 | PASS |
| Cover-Letter-E2E Mobil 390 | PASS |
| E2E Console-Errors | keine |
| Echte KI-/Provider-/Backend-Aufrufe | keine |

Abgedeckt:

- Ausgangsversion/Modell/Wunsch
- genau eine kontrollierte Anfrage
- Anonymisierung und `draft_anonymized`
- Vorschau und Verwerfen
- Fehler mit erhaltenem Original
- Doppelklick
- Bewerbungswechsel mit verspäteter Antwort
- keine automatische Versionierung / Repository-Mutation
- bestehende LetterModal- und 01A-Flows

## 10. Screenshots

- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01B/desktop-1440-improvement.png`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01B/desktop-1440-proposal.png`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01B/mobile-390-improvement.png`
- `docs/reports/assets/JM-APPLICATION-LETTER-REVISION-01B/mobile-390-proposal.png`

Synthetische Texte/Daten; keine echten KI-Aufrufe.

## 11. Git

- Implementierung: `b394e37`
- Responsive-E2E: `579b5b9`
- Dokumentationscommit: dieser Commit
- Branch: `feature/jm-application-letter-revision-01b`
- `main` bleibt `4364eab`
- Kein Push, Merge oder Deployment

## 12. Offene Punkte

- 01C Diff-/Änderungsansicht nicht implementiert.
- 01D Übernahme/Speicherung als neue Version nicht implementiert.
- Live-Provider-/E2E-Verifikation bleibt separat freizugeben.
- Die vorhandene Bewerbung enthält keine vollständige Jobbeschreibung/KandidatenCV;
  es werden bewusst keine Daten erfunden.
