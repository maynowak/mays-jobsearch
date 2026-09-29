# HTTP500-CV-WORKFLOW-SEARCH-01 — HTTP 500 on Job Search After CV Workflow

## Current status
FIXED — Root cause was a broken module import in the source registry, not the CV profile params. Fix implemented and verified.

## Audit date/time
2026-09-29 12:15:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 39400c3 (before fix; fix uncommitted)
- Working tree: `M api/_lib/config.mjs`, `M api/_lib/sources/greenhouse.mjs`

## Audit scope
`GET /api/jobs?skills=...&targetRole=...&city=Michelstadt&employmentType=full_time` returning HTTP 500 `FUNCTION_INVOCATION_FAILED` on Vercel after CV workflow (saved search profile + ATS profile). Read-only code inspection plus verified local reproduction and fix. No ATS Profile, ATS Analysis, CV Upload, `/api/v1`, or cross-repo changes.

## Completed audit sections
1. Traced request path: saved-profile button → `startSearchWithSavedProfile` / `runCvSearch` / `runAiSearchWithProfile` → `fetchJobs` → `/api/jobs` → `fetchAllJobs` → source registry.
2. Verified param parsing: `api/jobs.mjs` `parseSkillsParam`/`parseArrayParam`/`parseNumberParam` and `src/api.ts` `normalizeSkillsParam`/`ensureArray` handle JSON, comma, space formats.
3. Inspected source registry error isolation: `Promise.allSettled`, non-critical sources logged, only `arbeitnow` (`critical: true`) rethrows.
4. Reproduced production failure locally with Node ESM import of `api/_lib/sources/index.mjs`.
5. Implemented minimal fix, re-ran import check, targeted tests, full suite, build, `git diff --check`.

## Actual findings
- `api/_lib/sources/public-ats/factory.mjs` imports `createGreenhouseSource` from `../greenhouse.mjs`.
- `api/_lib/sources/greenhouse.mjs` did NOT export `createGreenhouseSource` (only legacy `id`, `displayName`, `provider`, `enabled`, `fetchGreenhouseJobs`, `normalizeGreenhouseJob`, `fetchJobs`).
- Local reproduction: `The requested module '../greenhouse.mjs' does not provide an export named 'createGreenhouseSource'`; import of `api/_lib/sources/index.mjs` failed.
- On Vercel this fails at function cold start for every `/api/jobs` call → HTTP 500 `FUNCTION_INVOCATION_FAILED`, independent of which profile or skills were sent. The earlier skills-format fixes were valid hardening but not the root cause of this 500.
- Also found duplicate `jobSourceGreenhouseEnabled` / `jobSourceGreenhouseBoards` keys in `api/_lib/config.mjs` (harmless duplicate, later entry wins).

## Evidence / file references
- `api/_lib/sources/public-ats/factory.mjs:1` — `import { createGreenhouseSource } from "../greenhouse.mjs"`
- `api/_lib/sources/greenhouse.mjs` (before fix) — no `createGreenhouseSource` export (verified via read + grep)
- `api/_lib/sources/index.mjs:3,11-14` — imports factory at module top level, so the broken import poisons the whole registry
- `api/_lib/config.mjs:114-118,127-132` — duplicate Greenhouse keys (verified via read)
- Reproduction command + result: `node --input-type=module -e "import('./api/_lib/sources/index.mjs')..."` → `import failed: ... does not provide an export named 'createGreenhouseSource'`
- Post-fix verification: same command → `import ok; sources: arbeitnow,greenhouse,arbeitsagentur` + `factory ok: greenhouse:demo-board ats`; `git diff --check` → clean
- Fix: `api/_lib/sources/greenhouse.mjs` — added `createGreenhouseSource({ identifier, enabled, label })` single-board factory adapter bound at creation time; jobs tagged `source: [greenhouse:{identifier}, "ats"]`; standard comma-separated skills input unchanged
- Fix: `api/_lib/config.mjs` — removed duplicate Greenhouse keys

## Classification
**GREEN** — Root cause verified by reproduction; minimal fix applied; import check, targeted tests (50 passed), full suite (552 passed), build, and diff check all green.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- `M api/_lib/sources/greenhouse.mjs` (added `createGreenhouseSource` factory adapter)
- `M api/_lib/config.mjs` (removed duplicate keys)

## Files changed
- `api/_lib/sources/greenhouse.mjs` — added factory adapter, no changes to legacy multi-board flow
- `api/_lib/config.mjs` — removed duplicated `jobSourceGreenhouseEnabled`/`jobSourceGreenhouseBoards` entries

## Explicit confirmation when no files were changed
N/A — two files changed as listed above. No other files touched in this fix.

## Open questions
- None for this 500. Remaining hardening (optional, separate task): per-source input adapters if a future source needs a non-standard param shape; integration test for saved-CV-profile → `/api/jobs`.

## Risks
- Low. Change is additive (new export) plus duplicate-key cleanup. Legacy `greenhouse` standalone source untouched. All 552 tests pass.

## Recommended next actions
1. Commit only `api/_lib/sources/greenhouse.mjs` + `api/_lib/config.mjs`, push to `main`, verify Vercel deploy.
2. Re-run the exact failing request from the bug report against production.
3. Remove temporary `console.debug`/`console.error` request-query logging in a follow-up once production is confirmed (avoid logging PII-ish query data long-term).

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: This task fixes a source-registry module import (`createGreenhouseSource`) and duplicate config keys. Public ATS sources only provide job data; no model call, AI provider, consent flow, anonymization flow, AI fallback, or AI data transfer is introduced or changed. `docs/AI_AUDITLOG.md` was reviewed against its template; it is a template-only file, so no artificial audit entry was created.

## Current resume point
Fix verified locally. Next: commit + push, then production verification of `/api/jobs` with the reported query.
