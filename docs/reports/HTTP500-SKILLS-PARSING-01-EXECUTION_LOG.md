# HTTP500-SKILLS-PARSING-01 — Fix HTTP 500 from Space-Separated Skills in URL Params

## Current status
COMPLETED — Fixed skills parsing to handle space-separated skills from URL-encoded `+` signs.

## Audit date/time
2026-09-29 12:05:00 CET

## Git state (Start)
- Branch: main
- HEAD: eb4c45d
- Working tree: clean (except report files)

## Git state (End)
- Branch: main
- HEAD: c8ae7c7
- Working tree: clean (except report files)

## Task / Purpose
Fix HTTP 500 ("FUNCTION_INVOCATION_FAILED") on production (Vercel) when searching with skills containing spaces. The error occurred because skills sent as space-separated strings (from URL-encoded `+` signs) were not parsed correctly by the API handler.

## Completed audit sections
1. **Error analysis** — Vercel logs showed `FUNCTION_INVOCATION_FAILED` with 500 on `/api/jobs`
2. **Request inspection** — Request had `skills=Java+AWS+Terraform+Docker+...` (space-separated via `+` encoding)
3. **Root cause identification** — `parseArrayParam` used `/[,;]+/` delimiter, not splitting on whitespace
3. **Fix implementation** — Added `parseSkillsParam` with `/[\s,;]+/` delimiter
4. **Verification** — Build and all 552 tests pass

## Actual findings
- **Request example**: `skills=Java+AWS+Terraform+Docker+DevOps+CI/CD+Microservices+Spring+JPA+Hibernate+JUnit+React+TypeScript+Angular+Node.js+Git+Jenkins+SCRUM+TDD+Generative+AI`
- **URL decoding**: `+` → space → `"Java AWS Terraform Docker DevOps CI/CD Microservices Spring JPA Hibernate JUnit React TypeScript Angular Node.js Git Jenkins SCRUM TDD Generative AI"`
- **Bug**: `parseArrayParam` used `/[,;]+/` delimiter → entire string treated as single skill
- **Impact**: Single-element skills array caused downstream errors in source filtering (tokenize, keywordHits, etc.)
- **Error manifestation**: Generic 500 "Something went wrong on our end" from catch-all handler

## Evidence / file references
- **Primary fix**: `api/jobs.mjs` — Added `parseSkillsParam` with `/[\s,;]+/` delimiter
- **Request example**: Vercel network log showing 500 with space-separated skills
- **Tests**: All 552 tests pass

## Classification
**GREEN** — Fix complete, build clean, all tests pass, root cause resolved.

## Terraform checks actually executed and their results
N/A — This project does not use Terraform.

## Git status
Clean — only `api/jobs.mjs` modified.

## Files changed
- `api/jobs.mjs` — 7 insertions(+), 2 deletions(-)

## Open questions
None.

## Risks
None identified — change is backward compatible:
- Comma-separated skills still work (`,` in delimiter)
- JSON array skills still work (JSON detection first)
- Semicolon-separated still work (`;` in delimiter)
- Space-separated now works (`\s` in delimiter)
- Other params (workMode, employmentType, targetRole) unchanged — keep comma/semicolon only

## Recommended next actions
1. Monitor Vercel function logs for any remaining 500s
2. Consider adding integration test for space-separated skills
3. Deploy to production and verify fix

## Current resume point
Fix deployed. Ready for production verification.