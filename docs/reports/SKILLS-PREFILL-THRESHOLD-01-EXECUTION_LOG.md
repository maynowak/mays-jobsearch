# SKILLS-PREFILL-THRESHOLD-01 — Kommasepariertes Prefill + Exact-Strategie-Fallback

## Current status
COMPLETED — Drei Befunde verifiziert und behoben: (1) Prefill kommasepariert, (2) CV-Parsing-Roundtrip für Multi-Word-Skills repariert, (3) Exact-Strategie liefert nicht mehr leer bei Teiltreffern.

## Audit date/time
2026-09-29 14:05:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: d9e449c (before fix; fix uncommitted at log time)
- Working tree: `M src/lib/skills.ts`, `M api/_lib/searchStrategy.mjs`, `M tests/api/search-strategy.test.mjs`

## Audit scope
Befund: alleinige Suche mit Feldeingabe `Java AWS Terraform` liefert keine Auffindung ("keine Jobs gefunden"). Zu prüfen: (a) CV-Parsing auf Komma-Separierungs-Bug — Werte müssen kommasepariert vorgefüllt werden; (b) ob wirklich alle Quellen 0 liefern. Read-only Diagnose plus minimaler Fix. Keine Änderung an Source-Registry, Deduplication, ATS-Analyse, API-Contract.

## Completed audit sections
1. **Tokenisierung/Prefill geprüft** (`src/lib/skills.ts`): `parseSkills` splittete auf `/[\s,;]+/`, `formatSkills` jointe mit `" "` (Leerzeichen) — kein Komma-Prefill.
2. **CV-Parsing-Roundtrip geprüft**: CV-Skills (Array, z. B. `["Spring Boot","React"]`) wurden per `formatSkills` space-joined (`"Spring Boot React"`) und beim erneuten Parsen in 3 statt 2 Skills zerlegt — Multi-Word-Skills gingen verloren.
3. **Search-Strategie geprüft** (`api/_lib/searchStrategy.mjs`, `buildCandidatePool`): 3 Skills → Threshold 3, Strategie `exact` → Filter verlangt ALLE 3 Skills, **ohne Fallback** → 0 Jobs trotz Teiltreffern. Lokal reproduziert (Mock-Jobs mit je 1–2 Treffern → `strategy: exact, threshold: 3, jobs: 0`).
4. **Quellen-Frage geprüft**: Nein — nicht alle Quellen liefern 0. Die Source-Ebene filtert nur auf `keywordHits > 0` (≥1 Treffer), liefert also Teiltreffer. Der Pool wird erst im letzten Pipeline-Schritt (`applySearchStrategyWithTargetRole` → `buildCandidatePool`, Exact-Pfad) auf 0 reduziert. Mit nur Arbeitnow konfiguriert verschärft sich das (kleiner Pool, keine Kompensation durch andere Sources).

## Actual findings
1. **Prefill-Bug (bestätigt)**: `formatSkills` jointe mit Leerzeichen statt Komma — gegen die Anforderung "Werte müssen kommasepariert vorgefüllt werden".
2. **CV-Parsing-Bug (bestätigt)**: `parseSkills` splittete zusätzlich auf Whitespace, sodass kommasepariert vorgefüllte Multi-Word-Skills (`"Spring Boot, React"`) beim Re-Parsen zerfielen. Roundtrip war lossy.
3. **Threshold-Bug (bestätigt, Hauptursache für "keine Auffindung")**: Exact-Pfad (`skills.length <= threshold`, typisch ≤3 Skills) hatte keinen Fallback — einziger Pfad ohne. Progressive-Pfad hat Min-Pool- und Threshold-0-Fallbacks. Ein bestehender Test (`search-strategy.test.mjs`, "exact strategy with 3 skills requires all skills") dokumentierte das Null-Ergebnis sogar als Soll-Verhalten.
4. **Quellen liefern**: Source-Filter (`keywordHits > 0`) lässt Teiltreffer durch; `applySearchFilters` ohne Parameter ist No-Op. Die 0 entsteht ausschließlich in `buildCandidatePool`.

## Evidence / file references
- `src/lib/skills.ts:1-26` — `parseSkills` (jetzt nur `[,;]+`), `formatSkills` (jetzt `join(", ")`)
- `api/_lib/searchStrategy.mjs:134-148` — Exact-Pfad mit Threshold-Fallback (`while leer && >1: threshold-1`)
- Repro (vor Fix): Mock-Jobs [Java-only, AWS-only, Terraform+AWS] × Skills [Java,AWS,Terraform] → `exact, threshold 3, jobs 0`
- Repro (nach Fix): gleiche Daten → `exact, threshold 2, jobs [DevOps]`; No-Match-Fall → `threshold 1, jobs 0`
- Roundtrip-Nachweis: `["Spring Boot","React"]` → `"Spring Boot, React"` → `["Spring Boot","React"]`
- `tests/api/search-strategy.test.mjs` — alter Null-Test ersetzt durch Fallback-Test + No-Match-Randfall-Test

## Classification
**GREEN** — Alle drei Befunde behoben und verifiziert; volle Suite grün.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- `M src/lib/skills.ts`, `M api/_lib/searchStrategy.mjs`, `M tests/api/search-strategy.test.mjs` — alle zu diesem Task gehörig.

## Files changed
- `src/lib/skills.ts` — `formatSkills` → `join(", ")`; `parseSkills` → Split nur auf `[,;]+`
- `api/_lib/searchStrategy.mjs` — Exact/`and`-Pfad: Threshold-Fallback bis 1 bei leerem Pool
- `tests/api/search-strategy.test.mjs` — Null-Test ersetzt (Fallback-Test + No-Match-Test)
- `docs/reports/SKILLS-PREFILL-THRESHOLD-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — Dateien geändert wie oben gelistet; keine anderen Dateien angefasst.

## Open questions
Keine.

## Risks
Minimal, verifiziert:
- Space-separierte Eingabe (`Java AWS Terraform`) bleibt suchbar: Frontend sendet sie als ein Token, Backend (`parseSkillsParam`, `normalizeSkills`) tokenisiert auf Whitespace — identische Treffer wie zuvor.
- 1-Skill-No-Match bleibt leer bei Threshold 1 (bestehender Test `includes fallback indicator in meta` grün) — kein Threshold-0-Zwang im Exact-Pfad.
- BROWSER-BUG-03 (Tipp-Verhalten, kein Submit bei Leerzeichen, "Spring Boot"-Submit) grün ohne Änderung.

## Recommended next actions
1. Diesen Task committen + pushen.
2. Manuell prüfen: Suche `Java AWS Terraform` liefert jetzt Teiltreffer; CV-Profil zeigt `Spring Boot, React` kommasepariert mit erhaltener Wortgruppe.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Tokenisierungs-/Prefill- und Search-Threshold-Fix in deterministischer Suchpipeline. Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Verifiziert (556/556 Tests, Build OK, Diff clean). Nächster Schritt: committen + pushen.
