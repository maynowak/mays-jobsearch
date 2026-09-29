# CV-SEARCH-SILENT-01 — Keine Antwort beim Job-Suche-Start aus CV-Upload

## Current status
FIXED — Stiller Abbruch im Saved-Profile-Start beseitigt (sichtbare Fehlermeldung statt Schweigen); Vergleichs-Helper gegen defekte Profile gehärtet.

## Audit date/time
2026-09-29 17:35:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: a23849b (before fix; fix uncommitted at log time)
- Working tree: `M src/App.tsx`, `M src/lib/cvProfileStore.ts`, `M src/lib/cvProfileStore.test.ts`, `M src/i18n.tsx`

## Audit scope
Befund: Nach CV-Upload (POST `/api/profile` → 200 mit 20 Skills, Senior, 3 Zielrollen, Michelstadt) passiert beim Klick auf "Job-Suche starten" im CV-Bereich nichts — kein `/api/jobs`-Request, kein Spinner, keine Meldung. Geprüft: kompletter Flow ab `profile-ready` (Confirm → Goal → Skill-Select → Search-Start-Pfade). Fix auf gemeldeten Pfad + Härtung; keine Änderung an Suchlogik, Profil-Speicherung, API.

## Completed audit sections
1. **Flow getraced** (`App.tsx`): `profile-ready` → `onConfirm` → `goal-selection` (`handleGoalExecute`) → `skill-selection` (`handleSkillSelectionConfirm` → `runAiSearchWithProfile`) sowie `document-selected` → Saved-Profile-Box → `startSearchWithSavedProfile` → `handleSubmit` → `runSearch`.
2. **Stille Pfade inventarisiert**: `startSearchWithSavedProfile` mit fehlendem Eintrag (`if (!entry) return` — keine Meldung, kein Spinner, kein Request); `handleSearchWithSelectedCvs` ohne Docs (Button-seitig gegated); `busyRef`-Blockade und hängendes `isProcessing` per Code-Review ausgeschlossen (alle Resets in `finally`/allen Pfaden vorhanden).
3. **Sync-Throw-Kandidat gefunden**: `profilesEqual` → `arraysEqual` wirft bei `undefined`-Arrays (`a.length`) — Event-Handler-Throw = keine Reaktion der UI. Betrifft `startSearchWithSavedProfile`/`handleSubmit` bei defektem gespeicherten Profil.
4. **Fix umgesetzt + Tests**: sichtbarer Fehler statt Schweigen, Helper extrahiert + getestet, `arraysEqual` null-sicher.
5. **Verifiziert**: volle Suite, Build, Diff-Check.

## Actual findings
- **Hauptbefund**: `startSearchWithSavedProfile` (`App.tsx:558-565`) brach bei nicht gefundenem Eintrag lautlos ab. Jeder Klick auf "Job-Suche starten" muss jetzt entweder suchen (Spinner + Request) oder eine sichtbare Fehlermeldung zeigen.
- **Nebenbefund**: `arraysEqual`/`profilesEqual` (`App.tsx:37,162-168`) stürzten bei fehlenden Arrays ab — jetzt `?? []`, verhaltensgleich für valide Daten.
- **Ausgeschlossen**: `busyRef`-Blockade (alle Pfade resetten in `finally`), hängendes `isProcessing` (alle Pfade in `runAiSearchWithProfile`/`handleSkillSelectionConfirm` setzen es zurück), fehlende Spinner-States (vorhanden, sobald Suche startet).
- **Hinweis zur Einordnung**: Der gemeldete Request (`POST /api/profile` 200) ist nur die Profil-Extraktion — der Job-Search-Button danach ist der hier gefixte Pfad.

## Evidence / file references
- `src/App.tsx` — `startSearchWithSavedProfile` (Fehler-Status statt `return`), `arraysEqual`/`profilesEqual`-Härtung, `findSavedSearchProfile`-Import
- `src/lib/cvProfileStore.ts` — neu `findSavedSearchProfile(lists, id)` (null-safe Lookup)
- `src/lib/cvProfileStore.test.ts` — 2 neue Helper-Tests (Fund/Fehlfälle)
- `src/i18n.tsx` — neu `cv.startSearchMissing` (DE: "Gespeichertes Profil nicht gefunden. Bitte erneut auswählen.", EN: "Saved profile not found. Please select it again.")
- Bestehende Happy-Path-Tests (CV-UPLOAD-UX-08/10: Auswahl + Start → `fetchJobs`-Call) unverändert grün
- Run: 50 passed / 1 skipped Files, 624 passed / 2 skipped Tests; Build OK; Diff clean

## Classification
**GREEN** — Stille Abbrüche im gemeldeten Pfad beseitigt bzw. gehärtet; volle Suite grün.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- 4× modified + 1× neu (Report), alle zu diesem Task gehörig (siehe Files changed).

## Files changed
- `src/App.tsx` — Feedback bei fehlendem Profil, Helper-Nutzung, `arraysEqual`-Härtung
- `src/lib/cvProfileStore.ts` — neu `findSavedSearchProfile`
- `src/lib/cvProfileStore.test.ts` — 2 Helper-Tests
- `src/i18n.tsx` — `cv.startSearchMissing` (DE/EN)
- `docs/reports/CV-SEARCH-SILENT-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — Dateien geändert wie oben gelistet; keine anderen Dateien angefasst.

## Open questions
1. Bitte nach Deploy erneut testen (CV hochladen → Profil speichern → "Job-Suche starten"): Erwartet ist jetzt entweder Spinner + Ergebnisse oder eine lesbare Fehlermeldung — nie wieder Schweigen. Falls die Fehlermeldung erscheint, bitte Wortlaut melden (dann ist es der Missing-Entry-Pfad und wir suchen die Ursache der veralteten Auswahl).

## Risks
Minimal, verifiziert:
- Nur der bisher stille Zweig zeigt jetzt eine Meldung; Happy Path unverändert (Tests grün).
- `arraysEqual`-Härtung ändert nichts für valide Profile (alle Vergleichstests grün).
- Neue i18n-Keys in beiden Sprachen vorhanden (kein fehlender Key).

## Recommended next actions
1. Diesen Task committen + pushen (+ Deploy).
2. Manueller Retest laut Frage 1; Rückmeldung mit ggf. erscheinender Meldung.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: UI-Feedback- und Robustheits-Fix im CV-Suchstart (Fehlermeldung, null-sichere Helfer). Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Verifiziert. Nächster Schritt: committen + pushen.
