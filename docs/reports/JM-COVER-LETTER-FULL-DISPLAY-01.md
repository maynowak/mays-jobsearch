# JM-COVER-LETTER-FULL-DISPLAY-01

**Art:** Anschreiben-Generierung / vollständige Anzeige
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Deployment
**Datum:** 2026-11-03
**Branch:** `fix/cover-letter-full-display`
**Ausgangsstand:** UX-05B `604f018`
**Grenzen:** Keine API-/Provider-/Persistenzänderung, kein Deployment.

## 1. Befund

Die API lieferte einen vollständigen Anschreiben-Text. Im Browser wurde davon
nur der sichtbare Teil der fest hohen Textarea angezeigt; der Rest lag hinter
dem internen Scrollbereich. Es handelte sich damit nicht um einen
Server- oder Providerfehler und nicht um abgeschnittene Antwortdaten.

## 2. Fix

`src/components/LetterModal.tsx`

- Neue `editorRef` für die Anschreiben-Textarea.
- Nach erfolgreicher Generierung und bei jeder Textänderung im `done`-Status:
  - Höhe auf `auto` zurücksetzen,
  - Höhe auf den tatsächlichen `scrollHeight` setzen.
- Die Textarea wächst damit mit dem vollständigen Anschreiben; es bleibt keine
  verdeckte Restfläche hinter einem internen Scrollbalken.
- `maxLength` (20.000 Zeichen), Editing, Copy, Download, Revision und
  Repository-Übernahme bleiben unverändert.

## 3. Regressionstest

`tests/e2e/cover-letter-entry.mjs`

- Lokaler Mock liefert jetzt ein langes synthetisches Anschreiben mit einem
  eindeutigen Endmarker.
- Nach der Generierung wird geprüft:
  - der vollständige Endmarker ist im Editor enthalten,
  - `textarea.scrollHeight <= textarea.clientHeight + 2`.
- Der Test verwendet ausschließlich lokale Mocks.

## 4. Verifikation

| Prüfung | Ergebnis |
|---|---|
| Gesamtsuite (`npm test -- --run`) | **1222 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Cover-Letter-E2E Desktop 1440 | PASS |
| Cover-Letter-E2E Mobil 390 | PASS |
| Lange Anschreiben-Anzeige | PASS, kein Clipping |
| Console-Errors | keine |
| Echte Provider-/KI-Aufrufe | keine |

## 5. Git

- Fix: `a1b2588`
- Dokumentationscommit: dieser Commit
- Branch: `fix/cover-letter-full-display`
- Kein Push, Merge oder Deployment

## 6. Offene Punkte

- Live-Verifikation nach Deployment.
- Keine Änderung an Provider-Fallback oder Modellwahl.
