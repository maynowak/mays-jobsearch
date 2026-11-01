# JM-COVER-LETTER-01

**Art:** Anschreiben-Einstieg / Job-Card-Aktionen / Dialog-Polish
**Status:** IMPLEMENTIERT / VERIFIZIERT (lokal)
**Deployment:** keines
**Datum:** 2026-11-01

## 1. Git-Baseline

| Prüfung | Ergebnis |
|---|---|
| Branch | `main` |
| HEAD bei Start | `0ef8ee5` |
| `origin/main` | synchron (`0 0`) |
| Working Tree | nur vorbestehende, unverwandte untracked Dateien |
| Bestehende Änderungen überschrieben | nein |

## 2. Geänderte Komponenten

- `src/components/MatchCard.tsx`
- `src/components/RemainingCard.tsx`
- `src/components/Results.tsx`
- `src/components/LetterModal.tsx`
- `src/components/MatchCard.test.tsx`
- `src/components/RemainingCard.test.tsx`
- `src/components/Results.test.tsx`
- `src/components/LetterModal.test.tsx` (neu)
- `src/styles.css`
- `src/i18n.tsx`
- `tests/e2e/cover-letter-entry.mjs` (neu)
- `package.json` (`test:e2e:cover-letter`)

## 3. Vorher-/Nachher-Verhalten

### Vorher

- `MatchCard`: Originalanzeige, Anschreiben, ATS.
- `RemainingCard`: Originalanzeige, ATS, Detailanzeige — **kein Anschreiben**.
- ATS-Button war ein ungestalteter Standard-Button.
- `LetterModal` startete über `useEffect` beim Öffnen sofort einen KI-Aufruf.

### Nachher

- Beide Karten zeigen dieselben Aktionen:
  1. Originalanzeige
  2. Anschreiben erstellen
  3. Mit ATS bewerten
- Gemeinsame Aktionsleiste `.job-actions` mit einheitlichen Höhen, Abständen,
  Fokus-, Hover- und Disabled-Zuständen.
- ATS ist sekundär, Anschreiben primär; Originalanzeige bleibt Textlink.
- Responsive Umbruch ohne horizontales Overflow.
- `RemainingCard` nutzt die bestehende Callback-Kette:
  `RemainingCard → Results → App → LetterModal`.
- Bereits geladene Arbeitsagentur-Details werden für den ausgewählten Job
  verwendet, ohne einen neuen Detailrequest auszulösen.
- Titel, Arbeitgeber, Quelle und URL bleiben aus der ursprünglichen Karte
  erhalten.

## 4. LetterModal: expliziter Start

Beim Öffnen erscheint eine Vorbereitungsansicht mit:

- Stellenbezeichnung
- Arbeitgeber
- Arbeitsort
- Quelle
- Hinweis auf die spätere Stellen- und CV-Prüfung
- Klarstellung: keine KI-Anfrage bis zum ausdrücklichen Start
- Button „Vorläufiges Anschreiben erstellen“

Der bisherige Generierungsaufruf bleibt erhalten, wird aber **nur** durch den
Startbutton ausgelöst. Es gibt keinen `useEffect`, der beim Öffnen, Re-Render
oder Schließen eine KI-Anfrage startet.

Zusätzlich:

- Schutz gegen Doppelklick/parallele Requests über `inFlightRef`
- Request-Sequenz verhindert verspätete Ergebnisse nach Jobwechsel/Schließen
- Jobwechsel setzt den Dialog auf die Vorbereitungsansicht zurück
- Loading-, Error-, Fallback- und Retry-Zustände erhalten
- Copy/Download nach erfolgreicher Generierung erhalten
- Keine Persistenz, keine neuen Cookies

## 5. Barrierefreiheit

- `role="dialog"` und `aria-modal="true"`
- Dialogtitel über `aria-labelledby`
- Fokus beim Öffnen auf der Startaktion
- Fokus-Rückgabe zum auslösenden Button beim Schließen
- Escape schließt den Dialog
- Fokusfalle innerhalb des Dialogs
- Hintergrund-Scroll während des Dialogs gesperrt
- Sichtbare `:focus-visible`-Styles für Kartenaktionen
- Touchfreundliche Mindesthöhe von 40 px

## 6. Datenschutz

- Öffnen des Dialogs ist rein lokal.
- Kein KI-Aufruf beim Öffnen, Re-Rendern oder Schließen.
- Externer Modellaufruf nur nach sichtbarer Benutzeraktion.
- Keine Anschreiben-Persistenz.
- Keine neue Benutzeridentität, keine Cookies.
- Keine Änderung an Gastmodus, CV-Cache-Entfernung, ATS, Redis oder Budgets.
- Keine RIS-Übertragung.

## 7. Tests

| Prüfung | Ergebnis |
|---|---|
| `MatchCard.test.tsx` | PASS |
| `RemainingCard.test.tsx` | PASS |
| `Results.test.tsx` | PASS |
| `LetterModal.test.tsx` | PASS — 11 Tests |
| Gesamtsuite | PASS — 1049 passed, 5 skipped |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Browser-E2E Desktop 1440 | PASS |
| Browser-E2E Mobil 390 | PASS |
| Horizontal Overflow | nicht festgestellt |
| Console Errors im E2E | keine |

### Nachweis: Kein KI-Aufruf beim Öffnen

Der Browser-E2E zählt `/api/cover-letter`-Requests:

```text
desktop-1440: coverLetterCalls = 1  (erst nach Start)
mobile-390:   coverLetterCalls = 1  (erst nach Start)
```

Vor dem Klick auf „Vorläufiges Anschreiben erstellen“ bleibt der Zähler bei 0.
Auch das Schließen des Dialogs erhöht ihn nicht.

### UI-Evidenz

- `docs/reports/assets/JM-COVER-LETTER-01/desktop-1440-cards.png`
- `docs/reports/assets/JM-COVER-LETTER-01/desktop-1440-letter-intro.png`
- `docs/reports/assets/JM-COVER-LETTER-01/desktop-1440-letter-generated.png`
- `docs/reports/assets/JM-COVER-LETTER-01/mobile-390-cards.png`
- `docs/reports/assets/JM-COVER-LETTER-01/mobile-390-letter-intro.png`
- `docs/reports/assets/JM-COVER-LETTER-01/mobile-390-letter-generated.png`

Der E2E verwendet lokale, gemockte APIs; es werden keine echten Provider
kontaktiert.

## 8. Offene Fragen

1. Der vorläufige Generator nutzt weiterhin die bestehenden Stellen- und
   Suchprofildaten. Die vollständige Stellen-/CV-Prüfung folgt in CL-02 bis
   CL-04.
2. Die genaue mehrstufige Eingabemaske und Prompt-Architektur sind nicht Teil
   von CL-01.
3. Kein echter Provider-/Production-Browser-Test; nur lokaler E2E mit Mocks.

## 9. Abgrenzung CL-02 bis CL-05

Nicht implementiert:

- Prüfung eingefügter Stellenbeschreibungen — CL-02
- Neue Eingabemaske für vollständige Stellenanzeigen — CL-02
- CV-Auswahl — CL-03
- Neuer CV-Upload-Workflow — CL-03
- Neue Prompt-Architektur für vollständige Anschreiben — CL-04
- Bewerbungsverwaltung, RIS-Speicherung, DynamoDB, neue Authentifizierung
- AWS-/Vercel-Deployment

## 10. Git

- Implementierung: `2b43a6f`
- Dokumentations-Commit: nach diesem Bericht.
- Remote-Synchronität: nach Push geprüft.
- Kein Deployment, keine AWS-/RIS-/Cognito-Änderung, kein Release.
