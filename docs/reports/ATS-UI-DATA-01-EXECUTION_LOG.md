# ATS-UI-DATA-01 — Keyword Coverage 5000 % + doppelte Requirements

## Current status
FIXED + VERIFIED — Display-Fix (`* 100` raus, Schutz-Clamp 0..100) + quellenübergreifende Dedup-Norm. Test-Mocks auf Produktions-Einheit (75/25) umgestellt; Test B (kodierte Duplikate) korrigiert. Suite 689/5, Build OK, Diff sauber.

## Audit date/time
2026-10-02 19:00:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 2d43980 (AI-MATCH-PULSE-01, gepusht)

## Audit scope
Production-Fehler: Score 50/100 mit Keyword Coverage 5000 %; doppelte Requirements ("devops"/"DevOps"). Datenfluss Job → Extraction → Normalisierung → Matching → Coverage → Result → UI vollständig getraced. Keine Änderung vor Root-Cause-Doku (eingehalten).

## Completed audit sections
1. **Datenfluss getraced**: `extractRequirementsFromJob` → Matching (`matches`) → `keywordCoverage`/`score` → `api/ats-analysis.mjs` (`overall`) → `ATSDetails`/`AtsOverlay`/`App`-Comparison.
2. **Einheit geklärt**: intern 0..100 (Prozent, gerundet) ab `ats.mjs:495`; `overall` übernimmt den Wert 1:1 (`ats-analysis.mjs:135`).
3. **Tests gesichtet**: `AtsOverlay.test.tsx` mockt `overall: 0.75/0.25` (Ratio-Annahme — genau so überlebte der Bug); Extraktions-Tests unter `tests/api/ats-extraction.test.js`.
4. **Fix + Tests umgesetzt**: Display ohne Doppel-Prozent (mit 0..100-Clamp als Grenzschutz), Dedup-Filter, Mocks auf 75/25, Test B korrigiert (kodierte Duplikate: matched 3→2), 8 neue Tests (0/50/100/150%-Anzeige, DevOps-Dedup, Distinct-Erhalt). TEST 2 (0.5→50) entfällt sachlich: interne Einheit ist 0..100, nicht 0..1 (laut Task-Anpassungsklausel); Doppel-Umrechnung wird durch TEST 3 (50→50 %, nie 5000 %) abgedeckt.
5. **Verifiziert**: Suite 689 passed / 5 skipped (TEST 8), Build OK, Diff-Check sauber. Browser-Ebene: jsdom-Komponententests rendern „50 %" ohne „5000 %" (kontrollierter Repro-Fall: Analyse mit coverage 50/score 50 — exakt die Produktions-Zahlen). Echter Live-Browser mit KI nicht möglich (kein OPENROUTER-Key in Dev-Env); UI-Änderung ist reine Darstellung ohne Datenfluss.

## Actual findings
- **ROOT CAUSE A (5000 %) — doppelte Prozent-Umrechnung im Frontend**: `ATSDetails.tsx:45` und `AtsOverlay.tsx:236` rechnen `Math.round(overall * 100)`. `overall` ist bereits Prozent (0..100). 50 → 5000 %. Gegenprobe: `App.tsx:1996` rendert `.overall%` direkt (korrekt) — die Einheit ist eindeutig Prozent.
- **ROOT CAUSE B (Duplikate) — fehlende quellenübergreifende Dedup**: `extractRequirementsFromJob` (`ats.mjs:167`) sammelt aus Titel + Tags + Description ohne Dedup; nur Description-intern wird deduped (`extractSkillsFromText`, lokale `seen`-Menge). „DevOps" (Titel) + „devops" (Tags/Description) → zwei Requirement-Objekte mit identischem `normalized` („devops"), UI listet beide.
- Backend-Formel selbst kann 100 nie überschreiten (`covered ≤ total`, `total=0 → 0`) — kein Backend-Coverage-Fix nötig.

## Evidence / file references
- `api/_lib/ats.mjs:493-496` (0..100, gerundet), `:167-215` (Extraktion ohne Cross-Source-Dedup), `:52-57` (nur Description-intern)
- `api/ats-analysis.mjs:135` (`overall = scores.keywordMatch`, 1:1)
- `src/components/ATSDetails.tsx:45`, `src/components/AtsOverlay.tsx:236` (`* 100`)
- `src/App.tsx:1996` (korrekte Verwendung als Beleg der Einheit)
- `src/components/AtsOverlay.test.tsx:53,147` (Ratio-Mocks als Bug-Überlebensgrund)

## Classification
**GREEN** — Fix verifiziert, Invarianten per Tests abgesichert. Kein AI-Datenfluss betroffen.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- 5× modified + 1× neu (dieser Log), alle zu diesem Task gehörig. Ungepusht.

## Files changed, if any
- `src/components/ATSDetails.tsx` — `* 100` entfernt, 0..100-Clamp
- `src/components/AtsOverlay.tsx` — `* 100` entfernt, 0..100-Clamp
- `api/_lib/ats.mjs` — quellenübergreifende Dedup-Norm in `extractRequirementsFromJob`
- `src/components/AtsOverlay.test.tsx` — Mocks auf Prozent-Einheit (75/25), 4 neue Display-Tests
- `tests/api/ats-extraction.test.js` — Test B korrigiert (kodierte Duplikate), TEST 6/7 neu
- `docs/reports/ATS-UI-DATA-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — dieser Log ist neu; Code-Änderungen folgen.

## Open questions
Keine — beide Root Causes belegt.

## Risks
- Minimal: 2× Display-Zeile (mit Schutz-Clamp), 1× Dedup-Filter am Extraktionsende, Test-Mocks auf Produktions-Einheit (75/25) umgestellt.

## Recommended next actions
1. Fix + 8 Regressionstests, Suite + Build + Browser.
2. Commit `fix: ATS-UI-DATA-01 coverage and requirement integrity`, Working Tree clean.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Darstellungs-Fix (Prozent einmal statt doppelt) + deterministische Requirement-Dedup; keine Matching-/Scoring-/Provider-Logik geändert. `docs/AI_AUDITLOG.md` ist Template-/Prozess-Datei; geführt wird dieser Report-Log.

## Current resume point
Nächster Schritt: Fix + Tests.
