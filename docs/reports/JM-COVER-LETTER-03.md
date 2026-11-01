# JM-COVER-LETTER-03

**Art:** CV-Auswahl / bestehender Upload-Workflow / Sitzungskontext
**Status:** IMPLEMENTIERT / VERIFIZIERT (lokal)
**Deployment:** keines
**Datum:** 2026-11-01

## 1. Git-Baseline

| Prüfung | Ergebnis |
|---|---|
| Branch | `main` |
| HEAD bei Start | `a624109` |
| `origin/main` | synchron (`0 0`) |
| Working Tree | nur vorbestehende, unverwandte untracked Dateien |
| Bestehende Änderungen überschrieben | nein |

## 2. Bestehende CV-Datenquellen

Verwendet werden ausschließlich bestehende Sitzungsdaten:

- `CvDocument` in `cvState.documents`
- `CvDocument.file`, `name`, `size`, `selected`, `hash`
- neu: `CvDocument.processedAt` als eindeutiger Nachweis, dass die
  Profil-Erstellung für genau dieses Dokument abgeschlossen wurde
- `readCvProfileLists(doc.hash)` für session-only Such-/ATS-Profile
- bestehende CV-Repositories und Limits

Keine zweite CV-Verwaltung, kein neuer Upload-Parser, kein Redis-/RIS-Speicher.

## 3. uploaded / processed / selected

- **uploaded:** PDF ist in `cvState.documents` vorhanden.
- **processed:** `processedAt` ist gesetzt **und** ein Hash existiert.
  Ein `File` oder ein Hash allein reicht ausdrücklich nicht.
- **selected:** Der Benutzer hat im LetterModal explizit einen vorhandenen
  CV gewählt oder „Ohne Lebenslauf fortfahren“ gewählt.

Ein globales `cvState.suggestedProfile` wird nicht einem bestimmten Dokument
zugeordnet. Die Zuordnung erfolgt ausschließlich über `processedAt` + `hash`
des jeweiligen Dokuments.

## 4. CV-Auswahl im LetterModal

Neuer Abschnitt „Lebenslauf für dieses Anschreiben“:

- „Ohne Lebenslauf fortfahren“ ist der neutrale Ausgangszustand.
- Jedes vorhandene Dokument wird als eigene Radio-Auswahl angezeigt.
- Auch bei nur einem Dokument ist eine bewusste Auswahl erforderlich.
- Status je Dokument:
  - „Hochgeladen — noch nicht verarbeitet“
  - „Verarbeitet — Profilinformationen verfügbar“
  - „Verarbeitet — kein gespeichertes Suchprofil“
- Bei vorhandenen session-only Profilen werden die Zähler angezeigt:
  „X Suchprofile · Y ATS-Profile“.
- Ein Dokumentwechsel aktualisiert die Auswahl.
- Wird ein gewähltes Dokument entfernt oder sind alle CV-Daten gelöscht, fällt
  die Auswahl auf „Ohne Lebenslauf fortfahren“ zurück.

## 5. Neuen Lebenslauf hinzufügen

Der Button öffnet den bestehenden Workflow über einen versteckten Datei-Input
im LetterModal. Die Datei wird mit der bestehenden `validateCvFile`-Prüfung
validiert und anschließend an `handleCvUploadStart` übergeben.

Wiederverwendet werden unverändert:

- PDF-Prüfung und 10-MB-Grenze
- Consent-Workflow
- Anonymisierungswahl
- Modellwahl
- CV-Verarbeitung
- Session- und Identity-Reset
- bestehende CV-Liste

Der LetterModal wird vor dem CV-Overlay geschlossen. Es entstehen keine
verschachtelten Dialoge mit konkurrierenden Fokusfallen.

### Übergabekontext

`sitzungsgebundener` `pendingLetterContext` enthält:

- ausgewählten Job
- `prepare`-Text
- CL-02-Beschreibungseingabe
- CL-02-Review-Zustand
- CV-Auswahl und ausgewählte Dokument-ID

Nach Abschluss oder Abbruch des CV-Workflows öffnet
„Zurück zum Anschreiben“ den LetterModal mit genau diesem Kontext wieder.

## 6. Schutz von Job, Sitzung und Identität

- `LetterModal` wird pro Job über `key={job.slug}` neu gemountet.
- Ein Jobwechsel setzt Review, Beschreibungseingabe und CV-Auswahl zurück.
- Auth-Identitätswechsel setzt `letterJob` und `pendingLetterContext` zurück.
- „Alle CV-Daten löschen“ schließt LetterModal und verwirft den
  Übergabekontext.
- Ein gelöschter ausgewählter CV wird über den `cvDocuments`-Effect erkannt
  und die Auswahl auf „Ohne Lebenslauf“ zurückgesetzt.
- Verspätete CV-Ergebnisse werden weiterhin über `cvOperationRef` und
  Session-Epoch verworfen.

## 7. CL-02 bleibt erhalten

Unverändert:

- Vollständigkeitszustände `sufficient` / `limited` / `missing`
- Plausibilität `plausible` / `uncertain` / `mismatch`
- Originalbeschreibung
- bestätigte unklare Ergänzung als `user_supplied`
- Review-Auswahl und Fallback-Semantik

Die CV-Auswahl verändert den CL-02-Review nicht.

## 8. Vorläufige Generierung

Der Button „Vorläufiges Anschreiben erstellen“ bleibt funktionsfähig.

Klar gekennzeichnet:

- Die CV-Auswahl wird in CL-03 **nicht** an `/api/cover-letter` übertragen.
- Die vorläufige Generierung nutzt weiterhin nur die vorhandenen Stellen- und
  Suchprofildaten.
- Die CV-basierte Anschreibenerstellung folgt in CL-04.
- Kein zusätzlicher KI-Aufruf durch Öffnen, Auswahl, Review oder
  CV-Workflow-Rückkehr.

## 9. Datenschutz

- Kein CV-Caching in Redis.
- Keine neue serverseitige CV-Speicherung.
- Keine RIS-Schreibzugriffe.
- Keine neuen Cookies.
- Keine automatische Anschreiben-Speicherung.
- Keine CV-Übermittlung beim Öffnen/Auswählen.
- Auswahl und Übergabekontext bleiben ausschließlich in der laufenden Sitzung.
- Gastfunktion bleibt vollständig erhalten.

## 10. Tests

| Prüfung | Ergebnis |
|---|---|
| Gesamtsuite | PASS — 1076 passed, 5 skipped |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Browser-E2E Desktop 1440 | PASS |
| Browser-E2E Mobil 390 | PASS |
| `/api/jobs` im E2E | 1 — kein zusätzlicher Request |
| `/api/job-details` im E2E | 0 |
| `/api/profile` im E2E | 1 (CV-Workflow) |
| `/api/cover-letter` vor explizitem Start | 0 |
| `/api/cover-letter` nach explizitem Start | 1 |
| CV-Daten im Cover-Letter-Request | nicht enthalten |
| Console Errors im E2E | keine |

### Abgedeckte Fälle

1. Gast ohne CV → „Ohne Lebenslauf fortfahren“
2. Angemeldeter Benutzer nutzt dieselbe session-only Auswahl
3. Ein vorhandener CV → explizite Radio-Auswahl
4. Mehrere CVs → separate Auswahl
5. Hochgeladen, nicht verarbeitet → eigener Status
6. Verarbeitet mit Hash/`processedAt` → Profilinformationen sichtbar
7. CV ohne gespeichertes Suchprofil → eigener Status
8. Explizite Auswahl
9. „Ohne CV fortfahren“ setzt keine Referenz
10. CV-Wechsel aktualisiert die Auswahl
11. Gewählter CV gelöscht → Auswahl fällt zurück
12. Alle CV-Daten gelöscht → Modal/Kontext geschlossen
13. „Neuen Lebenslauf hinzufügen“ nutzt den bestehenden Workflow
14. Upload erfolgreich verarbeitet → Rückkehr mit Kontext
15. Upload abgebrochen → Rückkehr mit Kontext
16. Rückkehr zum richtigen Job
17. CL-02-Beschreibung/Review bleibt erhalten
18. Logout/Identitätswechsel setzt Letter-Kontext zurück
19. Späte Verarbeitung bleibt durch bestehende Operation-Guards wirkungslos
20. Kein zusätzlicher `/api/jobs`-Request
21. Kein automatischer `/api/cover-letter`-Request
22. Keine CV-Daten im Cover-Letter-Request
23. Desktop 1440
24. Mobil 390
25. CL-01-/CL-02-Regression

## 11. UI-Evidenz

`docs/reports/assets/JM-COVER-LETTER-03/`

- `desktop-1440-cards.png`
- `desktop-1440-letter-intro.png`
- `desktop-1440-letter-review.png`
- `desktop-1440-letter-cv-return.png`
- `desktop-1440-letter-cv-abort.png`
- `desktop-1440-letter-generated.png`
- `mobile-390-*` entsprechend

E2E arbeitet ausschließlich mit lokalen Mocks; keine echten Provider.

## 12. Offene Punkte für CL-04

1. Einbindung der ausgewählten CV-Inhalte in die Anschreiben-Prompt-Architektur.
2. Übergabe des `LetterPreparationContext` an die serverseitige
   Anschreibengenerierung.
3. Entscheidung, ob ein unverarbeiteter CV im späteren CL-04 blockiert oder
   nur warnend behandelt wird.
4. Echter Provider-/Production-Browser-Test.

## 13. Abgrenzung

Nicht implementiert:

- neue Prompt-Architektur
- CV-Inhalte im Anschreiben
- Bewerbungsverwaltung
- RIS-Persistenz
- neue Datenbank
- AWS-/Vercel-Deployment

## 14. Git

- Implementierung: `9fd2bc1`
- Dokumentations-Commit: `241bb11`
- Remote-Synchronität: nach Push geprüft.
- Kein Deployment, keine AWS-/RIS-/Cognito-Änderung, kein Release.
