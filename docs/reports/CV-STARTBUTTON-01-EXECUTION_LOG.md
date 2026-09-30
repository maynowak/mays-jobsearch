# CV-STARTBUTTON-01 — "Jobs Finden"-Button mit Anfragerunner + Model-Lock während Suche

## Current status
COMPLETED — Start-Button umbenannt, zeigt Spinner und sperrt während Suche/Matching; alle drei Model-Comboboxen sind während laufender Suche/Matching gesperrt.

## Audit date/time
2026-09-29 17:00:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 160ac42 (before change; change uncommitted at log time)
- Working tree: `M src/App.tsx`, `M src/App.test.tsx`, `M src/i18n.tsx`

## Audit scope
User-Vorgaben: (1) Button "Job-Suche starten" mit Anfragerunner (Spinner) versehen; (2) währenddessen keine Änderung an der Model-Combobox-Auswahl erlauben; (3) Button umbenennen in "Jobs Finden" (DE/EN). Betrifft Start-Button (Saved-Profile-Box) und alle drei `ModelSelector`-Instanzen (Suchkarte, CV-Overlay Modellwahl, ATS-Recovery). Keine Änderung an Suchlogik, Profilen, API.

## Completed audit sections
1. **Bestand geprüft**: Start-Button hatte weder Spinner noch Busy-Lock (nur `isProcessing`/Auswahl-Gates); Suchkarten-Selektor war bereits via `isSearching || isMatching` gesperrt, die zwei Overlay-Selektoren nur via `cvState.isProcessing` (App-Suche lief daneben weiter bedienbar — `handleModelChange` ignorierte sie nur still per `busyRef`-Guard).
2. **Umbenennung**: `cv.startSearch` DE `"Job-Suche starten"` → `"Jobs Finden"`, EN `"Start job search"` → `"Find Jobs"`.
3. **Anfragerunner**: Start-Button zeigt während Suche `search.searching`-Label + Spinner und ist während Suche/Matching disabled (zuvor stiller No-Op via `busyRef`-Guard bei Doppelklick).
4. **Model-Lock**: beide Overlay-Selektoren zusätzlich mit `isSearching || isMatching` gesperrt (ATS-Recovery unberührt: dort ist die App idle, Zweck bleibt Modellwechsel).
5. **Tests**: 3 Referenzen umbenannt, neuer Spinner/Lock-Test (deferred `fetchJobs`, Button disabled + Spinner + Such-Label während pending).
6. **Verifiziert**: volle Suite, Build (echter Exit-Code), Diff-Check.

## Actual findings
- Der Start-Button war der einzige Such-Trigger ohne Runner/Lock-Feedback — Lücke geschlossen; Muster (`btn-label` + `.spinner`, wie andere Buttons) wiederverwendet, kein neues CSS nötig.
- Overlay-Selektoren verließen sich auf stilles Ignorieren (`busyRef`-Guard in `handleModelChange`); jetzt sichtbar gesperrt, konsistent mit Suchkarte.

## Evidence / file references
- `src/App.tsx` — Start-Button (Label/Spinner/disabled), 2× Overlay-`disabled`
- `src/i18n.tsx` — `cv.startSearch` DE/EN
- `src/App.test.tsx` — 3× Referenz-Update + neuer Runner-Test
- Run: 51 Dateien passed / 1 skipped, 660 Tests passed / 2 skipped (Live-Opt-in), 0 failed; Build Exit 0; Diff clean

## Classification
**GREEN** — Alle drei Vorgaben umgesetzt und verifiziert.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- 3× modified, 1× neu (Report) — alle zu diesem Task gehörig (siehe Files changed).

## Files changed
- `src/App.tsx` — Button-Runner/Lock, 2× Model-Lock
- `src/i18n.tsx` — Umbenennung DE/EN
- `src/App.test.tsx` — Referenzen + Runner-Test
- `docs/reports/CV-STARTBUTTON-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — Dateien geändert wie oben gelistet; keine anderen Dateien angefasst.

## Open questions
Keine.

## Risks
Minimal, verifiziert:
- ATS-Recovery-Zweck (Modellwechsel nach Modellfehler) erhalten — dort ist die App idle, Lock greift nicht.
- Umbenennung nur Label-Text; alle Button-Referenzen in Tests nachgezogen (volle Suite grün).

## Recommended next actions
1. Diesen Task committen + pushen (+ Deploy).
2. Manuell prüfen: Start-Klick → Spinner + gesperrter Button + gesperrte Comboboxen bis Ergebnisse da sind.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: UI-Button-Feedback (Spinner/Labels/Locks) ohne Logikänderung an Suche, Profilen oder Matching. Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Verifiziert. Nächster Schritt: committen + pushen.
