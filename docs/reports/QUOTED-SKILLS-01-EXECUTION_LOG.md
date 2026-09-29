# QUOTED-SKILLS-01 — Anführungszeichen-Phrasen als ein Token

## Current status
COMPLETED — `"..."`-Phrasen im Skill-Eingabefeld zählen als ein Token; Ende-zu-Ende bis zur Jobsuche verdrahtet.

## Audit date/time
2026-09-29 14:15:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 459bf70 (before fix; fix uncommitted at log time)
- Working tree: `M src/lib/skills.ts`, `M src/api.ts`, `M api/_lib/filter.mjs`, `M api/_lib/searchStrategy.mjs`, `M api/ats-analysis.mjs`, `M api/cv-improvement.mjs`, `M src/components/SearchForm.test.tsx`, `M tests/api/filter.test.js`, `M tests/api/search-strategy.test.mjs`, neu `src/lib/skills.test.ts`

## Audit scope
Anforderung: Gibt ein Benutzer `tokenwordA tokenwordB "token wordX tokenwordZ"` (+ `nexttoken`) ein, muss der Anführungszeichen-Inhalt **ein** Token sein → Tokens: `tokenwordA`, `tokenwordB`, `token wordX tokenwordZ`, `nexttoken`. Betrifft Eingabefeld-Verhalten plus konsistenten Transport bis `/api/jobs`, `/api/match` und ATS-Analyse. Keine Änderung an Registry, Deduplication, Search-Thresholds, ATS-Regeln.

## Completed audit sections
1. **Frontend-Tokenizer** (`src/lib/skills.ts`): `parseSkills` splittet auf `[,;]`, extrahiert `"..."` pro Segment als ein Token, splittet Rest auf Whitespace; `formatSkills` quotet Tokens mit Whitespace und joint mit `", "` (stabiler Roundtrip).
2. **Transport** (`src/api.ts` `normalizeSkillsParam`): sendet immer ein JSON-Array — Multi-Word-Tokens überleben als ein Token bis `/api/jobs` (dort bereits JSON-fähig).
3. **Backend-Tokenizer** (`api/_lib/filter.mjs` `tokenize`/`splitQuotedPhrases`, `api/_lib/searchStrategy.mjs` `normalizeSkills`): String-Branch quote-aware; ohne Quotes byte-identisches Verhalten wie zuvor.
4. **ATS-Parser** (`api/ats-analysis.mjs`, `api/cv-improvement.mjs`): umgebende Quotes werden abgestreift, damit quotete Skills exakt matchen statt als PARTIAL mit Quote-Zeichen.
5. **Tests + Verifikation**: neue Unit-Tests (Frontend + Backend), 1 bestehenden Submit-Test ans neue Soll-Verhalten angepasst, volle Suite + Build + Diff-Check.

## Actual findings
- Vorher gab es kein Gruppierungszeichen: alles wurde auf Whitespace/Komma/Semikolon zerlegt; `"Spring Boot"` war als ein Skill nicht ausdrückbar.
- `formatSkills` (aus vorherigem Task) quotete nicht — Anzeige und Re-Parse waren für Multi-Word-Skills lossy; jetzt Roundtrip-stabil.
- Backend-Array-Pfade (`tokenize`/`normalizeSkills` bei Array-Input, `scoreJobBySkills`, `keywordHits`) behandeln Multi-Word-Tokens bereits korrekt per Substring-Match — keine Änderung nötig.
- `/api/match` nutzt `tokenize` auf dem Anzeige-String: ohne Backend-Anpassung wären Quote-Zeichen in Tokens gelandet — durch quote-aware `tokenize` behoben.

## Evidence / file references
- `src/lib/skills.ts` — `parseSkills` (Segment→Phrase→Whitespace), `formatSkills` (Quote + `, `-Join)
- `src/lib/skills.test.ts` — neu, 7 Tests (Beispiel aus Anforderung als erster Test)
- `src/api.ts` — `normalizeSkillsParam` sendet `JSON.stringify(tokens)`; Import `parseSkills`
- `api/_lib/filter.mjs` — neu `splitQuotedPhrases`, `tokenize` String-Branch nutzt ihn
- `api/_lib/searchStrategy.mjs` — `normalizeSkills` String-Branch nutzt `splitQuotedPhrases`
- `api/ats-analysis.mjs`, `api/cv-improvement.mjs` — `unquote`-Helper in lokalen `parseSkills`
- `tests/api/filter.test.js` — 4 Quote-Tests; `tests/api/search-strategy.test.mjs` — 1 Quote-Test
- `src/components/SearchForm.test.tsx` — Submit-Test ans Komma-Soll angepasst + neuer Quote-Submit-Test

## Classification
**GREEN** — Anforderung umgesetzt, Ende-zu-Ende konsistent, volle Suite grün.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- 9× modified, 2× neu (Testdatei, dieser Log) — alle zu diesem Task gehörig.

## Files changed
- `src/lib/skills.ts`, `src/lib/skills.test.ts` (neu)
- `src/api.ts`
- `api/_lib/filter.mjs`, `api/_lib/searchStrategy.mjs`
- `api/ats-analysis.mjs`, `api/cv-improvement.mjs`
- `src/components/SearchForm.test.tsx`, `tests/api/filter.test.js`, `tests/api/search-strategy.test.mjs`
- `docs/reports/QUOTED-SKILLS-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — Dateien geändert wie oben gelistet; keine anderen Dateien angefasst.

## Open questions
Keine.

## Risks
Minimal, verifiziert:
- Eingaben ohne Quotes verhalten sich exakt wie zuvor (alle Alt-Tests außer dem einen Submit-Test unverändert grün).
- Drahtformat `/api/jobs`-Skills ist jetzt immer JSON-Array; Backend parst JSON zuerst (abwärtskompatibel, zusätzlich String-Formate weiter unterstützt).
- Phrase-Matching per Substring (`haystack.includes`) — bewusst, konsistent mit bestehender Match-Semantik.

## Recommended next actions
1. Diesen Task committen + pushen.
2. Manuell prüfen: Eingabe `tokenwordA tokenwordB "token wordX tokenwordZ", nexttoken` → Anzeige mit Quotes, Suche behandelt Phrase als ein Token.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Tokenizer-/Anzeige-Änderung in deterministischer Suchpipeline (Eingabefeld, Transport, Filter/Scoring-Tokenizer). Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Verifiziert (569/569 Tests, Build OK, Diff clean). Nächster Schritt: committen + pushen.
