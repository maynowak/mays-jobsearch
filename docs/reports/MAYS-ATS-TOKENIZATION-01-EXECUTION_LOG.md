# MAYS-ATS-TOKENIZATION-01 — Execution Log

- Status: COMPLETE — full tests/build green; browser runtime NOT VERIFIED
- Date: 2026-10-30
- Branch: `main`
- HEAD at audit start: `65202bb`
- Scope: repair fragmenting list tokenization for ATS skills/roles while preserving structured arrays, technical punctuation, parent/profile/search semantics, and session behavior.

## Cause and data path

- Structured model output enters `api/profile.mjs` as arrays and is preserved by `cleanStringList`; the store also stores `skills: string[]` and `targetRoles: string[]` without splitting.
- User-edited profile strings were parsed by `src/lib/skills.ts`. Its old whitespace tokenizer produced `(P4` and `Cloud)` when a bracket group was unquoted.
- Legacy string input at `api/jobs.mjs` used `/[\s,;]+/`, creating the same downstream risk. ATS analysis independently used `profile.skills.split(',')` instead of the shared parser.
- The fixed path is now: bracket-/quote-aware list parser → existing Profile/ATS store arrays → existing selection components → JSON-array search transport / existing ATS analysis.

## Fix

- `src/lib/skills.ts` now splits list delimiters only outside quotes and `()[]{}` groups, and tokenizes whitespace only outside groups. Unclosed groups/quotes are retained losslessly rather than discarded or crashing.
- `parseTargetRoles` uses the same outer-delimiter handling without whitespace-splitting role entries.
- `api/_lib/filter.mjs` uses the equivalent shared contract for legacy strings; `api/jobs.mjs` delegates skill strings to it instead of splitting on whitespace.
- `api/_lib/ats.mjs` uses the shared `tokenize` parser instead of ad hoc comma splitting.
- Structured arrays are never re-split. No adjacent fragmented entries are merged; already-corrupted stored session entries require re-edit/re-generation.

## Examples

Input `Senior DevOps Engineer (P4 Cloud), C++, C#, .NET, CI/CD, TCP/IP` now yields:

`Senior` · `DevOps` · `Engineer` · `(P4 Cloud)` · `C++` · `C#` · `.NET` · `CI/CD` · `TCP/IP`

Input `"Senior DevOps Engineer (P4 Cloud)", Cloud Architect` yields two complete role entries. `Machine Learning`, `Amazon Web Services`, `ISO 27001`, and delimiters inside groups remain intact when supplied as quoted/grouped list values. The parser does not infer whether `P4 Cloud` is a skill or role.

## Regression coverage

- Mixed case reported example and bracket groups
- Multiple/nested groups and unterminated quote/group lossless behavior
- Quoted terms, commas/semicolons/newlines outside groups
- Technical punctuation `+`, `#`, `.`, `/`, `-`
- Empty entries and case-insensitive deduplication
- Existing frontend/API consumer tests, CV parent isolation, ATS field priority, and one-search-path tests remain green

## Verification

- `npx vitest run src/lib/skills.test.ts` — PASS (10 tests)
- `npm test -- --run` — PASS (856 passed, 5 skipped)
- `npm run build` — PASS
- All `api/**/*.mjs` syntax checks — PASS
- `git diff --check` — PASS
- Browser/Profile/CV upload synthetic-data runtime matrix: NOT VERIFIED in this correction step; no real CV/provider data used.

## Boundaries and privacy

- No new API, storage, session management, model request, or provider was introduced.
- Existing CV hash isolation, SearchProfile/ATS parent relationship, session TTL/capacities, SearchProfile-only search, ATS field priority, and per-job ATS analysis remain unchanged.
- Existing already-fragmented session entries are not guessed or silently recombined.

## Resume point

- Commit scoped source/tests/docs only on `main`; do not push/deploy.
