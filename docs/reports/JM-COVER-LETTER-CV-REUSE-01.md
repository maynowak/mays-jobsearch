# JM-COVER-LETTER-CV-REUSE-01

**Art:** Anschreiben-Generierung / bereits verarbeiteter CV / Session-Text-Wiederverwendung
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Live-Provider-Test, kein Deployment
**Datum:** 2026-11-02
**Branch:** `fix/cover-letter-model-fallback`
**Baseline:** `origin/main` @ `e1f0347`, darauf der Fallback-Fix `5a31955`
**Grenzen:** Keine echten KI-/Apify-/Provider-Aufrufe, keine Persistenz, kein Deployment.

## 1. Befund

Bei einem bereits verarbeiteten CV wurde im Anschreiben-Assistenten beim Start
der Generierung erneut die PDF-Datei gelesen:

```text
LetterModal
  → extractPdfText(selectedCv.file)
  → anonymizeText(...)
  → /api/cover-letter
```

Das ist unnötig und fehleranfällig:

- Der CV wurde bereits erfolgreich verarbeitet; das erneute PDF-Lesen kann
  unabhängig davon fehlschlagen (z. B. nicht mehr verfügbare Datei-Referenz,
  Browser-/Worker-Zustand, PDF-Verarbeitungsfehler).
- Die Generierung scheitert dann vor dem KI-Aufruf, obwohl ein gültiger,
  verarbeiteter CV ausgewählt ist.
- Der bereits erzeugte, anonymisierte CV-Text war nicht für die
  Anschreiben-Generierung verfügbar.

## 2. Änderung

### Session-Datenmodell

`src/types.ts`

- `CvDocument` erhält optional `letterText?: string`.
- Der Wert ist ausschließlich der bereits anonymisierte CV-Text für die
  laufende Browser-Sitzung. Er wird nicht persistiert.

### CV-Verarbeitung

`src/App.tsx`

- Beim erfolgreichen Verarbeiten wird der für das Anschreiben benötigte
  anonymisierte Text einmalig erzeugt und am Dokument gespeichert.
- Bei Anonymisierungsmodus `anonymized` wird der bereits anonymisierte
  `processedText` verwendet.
- Bei einem anderen Verarbeitungsmodus wird für die Anschreiben-Wiederverwendung
  separat `anonymizeText(text)` erzeugt.
- Es wird kein unredigierter CV-Text für die Anschreiben-Wiederverwendung
  gespeichert.

### Anschreiben-Assistent

`src/components/LetterModal.tsx`

- Ein verarbeiteter CV mit `letterText` wird ohne erneutes `extractPdfText`
  verwendet.
- Nur bei älteren/nicht migrierten Dokumenten ohne `letterText` bleibt der
  bisherige PDF-Fallback erhalten.
- Längen- und Leertextprüfung bleiben bestehen.
- Der Request sendet weiterhin nur anonymisierten CV-Text und
  `cv_anonymized: true`.

## 3. Tests

- Neuer LetterModal-Test: verarbeiteter CV mit gespeichertem
  `letterText`; `extractPdfText` wird nicht aufgerufen; Request enthält den
  gespeicherten Text.
- Bestehende Tests für ausgewählte CVs, unverarbeitete CVs, zu lange CVs und
  Anonymisierung bleiben erhalten.

| Prüfung | Ergebnis |
|---|---|
| LetterModal | **46 passed** |
| Gesamtsuite | **1177 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| E2E Cover Letter Desktop 1440 | PASS |
| E2E Cover Letter Mobil 390 | PASS |
| E2E Console-Errors | keine |
| Live-Provider-Aufruf | nicht ausgeführt |

Die E2E-Tests verwenden lokale Mocks; es wurden keine echten Provider-,
Apify- oder KI-Aufrufe ausgelöst.

## 4. Datenschutz

- `letterText` enthält ausschließlich anonymisierten Text.
- Der Wert lebt nur im React-Session-State; keine localStorage-/sessionStorage-/
  IndexedDB-/Backend-Speicherung.
- Kein PDF, keine Datei und kein Hash werden an `/api/cover-letter` gesendet.
- Keine Änderung an Consent-/Anonymisierungsregeln.

## 5. Statusabgrenzung

**IMPLEMENTED**

- Einmalige Erzeugung und Wiederverwendung des anonymisierten CV-Textes
- Kein erneutes PDF-Lesen bei bereits verarbeiteten CVs
- Fallback für ältere Dokumente ohne `letterText`

**VERIFIED**

- LetterModal-Tests, Gesamtsuite, TypeScript, Build, `git diff --check`
- Desktop-/Mobil-E2E mit lokalen Mocks

**OPEN**

- Live-Verifikation nach Deployment mit einem echten, bereits verarbeiteten CV
- Prüfung weiterer Browser-/PDF-Reader-Konstellationen

**NOT DEPLOYED**

- Kein Deployment.
