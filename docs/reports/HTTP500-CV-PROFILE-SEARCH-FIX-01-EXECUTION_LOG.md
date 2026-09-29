# HTTP500-CV-PROFILE-SEARCH-FIX-01 — Fix HTTP 500 When Starting Search with Saved CV Profile

## Current status
COMPLETED — Defensive parsing applied to all job search params at API boundary; HTTP 500 resolved.

## Audit date/time
2026-09-29 10:40:00 CET

## Git state (Start)
- Branch: main
- HEAD: dc0ff48
- Working tree: clean

## Git state (End)
- Branch: main
- HEAD: ba9ff58
- Working tree: clean

## Task / Purpose
Fix HTTP 500 ("Something went wrong on our end") when starting job search with a saved CV profile. The issue occurred because the API handler only parsed `skills` defensively; other parameters (`workMode`, `employmentType`, `targetRole`, `radiusKm`) were passed raw to the source registry. Saved CV profiles sent these as JSON strings (e.g., `workMode='["remote"]'`), causing downstream errors.

## Completed audit sections
1. **Root cause analysis** — Identified that `api/jobs.mjs` only parsed `skills` defensively
2. **Fix implementation** — Added `parseArrayParam` and `parseNumberParam` helpers; applied to all params
3. **Regression testing** — All 552 tests pass, build succeeds, no regressions

## Actual findings
- `api/jobs.mjs` had defensive parsing only for `skills` (lines 14-27)
- `targetRole`, `workMode`, `employmentType`, `radiusKm` were passed directly from `req.query`
- Saved CV profiles from the CV workflow stored params as JSON strings:
  - `workMode='["remote"]'`
  - `employmentType='["full_time"]'`
  - `targetRole='["Frontend Developer"]'`
  - `radiusKm='50'` (string)
- These malformed params reached `fetchAllJobs` → source registry → `source.fetchJobs()` → TypeError in source filtering → HTTP 500
- The error message "Something went wrong on our end. Please try again in a moment." came from the catch-all handler at line 40-43

## Evidence / file references
- **Primary fix**: `api/jobs.mjs` — Added `parseArrayParam`, `parseNumberParam`; applied to all params
- **Complementary frontend fix**: `src/api.ts` — `normalizeSkillsParam` helper (commit dc0ff48)
- **Tests**: All 552 tests pass (22 API test files, 24 UI test files)

## Classification
**GREEN** — Fix complete, all tests pass, build clean, no regressions, HTTP 500 resolved.

## Terraform checks actually executed and their results
N/A — This project does not use Terraform.

## Git status
Clean — only `api/jobs.mjs` modified in this commit.

## Files changed
- `api/jobs.mjs` — 50 insertions(+), 20 deletions(-)

## Open questions
None

## Risks
None identified — defensive parsing is backward compatible and handles all known input formats:
- JSON arrays: `'["a","b"]'`
- Comma/semicolon separated: `'a,b;c'`
- Legacy strings: `'a b c'`
- Native arrays: `['a', 'b']`
- Undefined/null/empty: returns empty array or undefined

## Recommended next actions
1. Monitor production for any source-specific parameter issues
2. If a new source requires fundamentally different parameter format → implement `SOURCE-INPUT-ADAPTER-02` (full adapter pattern)
3. Consider adding an integration test for the CV profile → search flow

## Current resume point
Task complete. No further action needed for this fix. Next task could be `SOURCE-INPUT-ADAPTER-02` (if needed) or unrelated feature work.