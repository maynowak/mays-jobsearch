# SOURCE-ADDON-01 — Generalized JSON-Feed Source Addon

## Current status
COMPLETED — Shared `jsonFeedSource` helper created; 4 JSON adapters refactored onto it; Personio `SOURCE_ID` bug fixed; addon + upgrade points documented.

## Audit date/time
2026-09-29 12:30:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: bd02cff (before fix; fix uncommitted at log time)
- Working tree: `M api/_lib/sources/public-ats/adapters/{lever,ashby,workable,recruitee,personio}.mjs`, `M docs/ATS_JOB_SOURCES.md`, new `api/_lib/sources/public-ats/jsonFeedSource.mjs`

## Audit scope
Generalize the duplicated JSON-feed adapter logic (Lever, Ashby, Workable, Recruitee) into one reusable addon configured per source at creation time; fix the latent `SOURCE_ID is not defined` ReferenceError in all factory adapters; document the addon contract, 5-step new-source recipe, and upgrade points. No new providers, no `/api/v1`, no ATS Profile/Analysis changes, no cross-repo changes.

## Completed audit sections
1. Compared the 4 JSON adapters: identical fetch/filter/rank/meta flow; differences isolated to URL builder, list extractor, normalizer.
2. Confirmed latent bug via Node ESM reproduction: `createLeverSource(...).fetchJobs(...)` threw `ReferenceError: SOURCE_ID is not defined` (normalize functions referenced a closure-local constant).
3. Created `api/_lib/sources/public-ats/jsonFeedSource.mjs` (`createJsonFeedSource`).
4. Refactored Lever/Ashby/Workable/Recruitee onto the helper (same exports, same behavior, normalize now takes `sourceId`).
5. Fixed Personio the same way (`normalizePersonioJob(node, SOURCE_ID)`).
6. Documented addon + upgrade points in `docs/ATS_JOB_SOURCES.md`.
7. Verified: mocked-fetch checks for all 4 JSON adapters, targeted tests, full suite, build, diff check.

## Actual findings
- All 4 JSON adapters duplicated ~60 lines of identical logic; only `buildUrl`/`extractList`/`normalizeJob` differed.
- The `source: [SOURCE_ID, "ats"]` references in Lever/Ashby/Workable/Recruitee/Personio normalizers pointed at a `SOURCE_ID` that only exists inside each `create*Source` closure → `ReferenceError` at runtime for every successful fetch (previously swallowed by `Promise.allSettled`, so each source silently returned zero jobs).
- The `factory.mjs` contract (`{ provider, identifier, enabled, label, options }` → source with stable `provider:identifier` id) is unchanged; the helper implements it for JSON feeds.

## Evidence / file references
- New: `api/_lib/sources/public-ats/jsonFeedSource.mjs` — `createJsonFeedSource`, `MAX_JOBS_TO_AI`
- Modified: `adapters/lever.mjs`, `adapters/ashby.mjs`, `adapters/workable.mjs`, `adapters/recruitee.mjs` — thin wrappers + `normalize*(job, sourceId)`
- Modified: `adapters/personio.mjs` — `normalizePersonioJob(node, SOURCE_ID)` call + signature
- Modified: `docs/ATS_JOB_SOURCES.md` — "Generalized Source Addon" section (contract, 5-step recipe, worked Lever example, 7 upgrade points)
- Reproduction (before): `ReferenceError: SOURCE_ID is not defined` for Lever with mocked fetch
- Verification (after): mocked-fetch checks → `lever:demo`, `ashby:demo`, `workable:demo`, `recruitee:demo` each OK with 1 job and correct `source` tag

## Classification
**GREEN** — Addon created, 4 adapters refactored without behavior change (except fixing the ReferenceError), Personio fixed, docs written, all checks green.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- `M api/_lib/sources/public-ats/adapters/{lever,ashby,workable,recruitee,personio}.mjs`
- `M docs/ATS_JOB_SOURCES.md`
- New (untracked): `api/_lib/sources/public-ats/jsonFeedSource.mjs`, this report

## Files changed
- `api/_lib/sources/public-ats/jsonFeedSource.mjs` — new shared helper
- `api/_lib/sources/public-ats/adapters/lever.mjs` — refactored onto helper
- `api/_lib/sources/public-ats/adapters/ashby.mjs` — refactored onto helper
- `api/_lib/sources/public-ats/adapters/workable.mjs` — refactored onto helper
- `api/_lib/sources/public-ats/adapters/recruitee.mjs` — refactored onto helper
- `api/_lib/sources/public-ats/adapters/personio.mjs` — `sourceId` param fix
- `docs/ATS_JOB_SOURCES.md` — addon + upgrade points section
- `docs/reports/SOURCE-ADDON-01-EXECUTION_LOG.md` — this log

## Explicit confirmation when no files were changed
N/A — files changed as listed above. No other files touched.

## Open questions
- None for this task. Personio XML parsing still uses browser `DOMParser` (pre-existing); only runs when a Personio source is configured, and failures are isolated per source.

## Risks
- Low. Refactor preserves exports, signatures, URLs, error codes, ranking, and meta shape. Full suite (552 tests) passes.

## Recommended next actions
1. Commit + push this task's files, verify Vercel deploy.
2. Re-run the reported production `/api/jobs` query.
3. Optional follow-ups (separate tasks): pagination hook, L1 cache, `xmlFeedSource` sibling helper once a second XML provider appears.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: This task refactors job-source fetch/normalize plumbing and documentation only. No model call, AI provider, consent flow, anonymization flow, AI fallback, or AI data transfer is introduced or changed. `docs/AI_AUDITLOG.md` was reviewed against its template; it is a template-only file, so no artificial audit entry was created.

## Current resume point
Verified locally. Next: commit + push, then production verification.
