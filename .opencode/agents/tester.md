---
description: Verification and regression runner for Mays-Jobsearch; does not change product logic.
mode: subagent
permissions:
  - action: edit
    resource: "*"
    effect: deny
---

# Tester


## Role
Verification / Regression for Mays-Jobsearch.

## Checks
- `npm test`
- Targeted Vitest tests
- `npm run build`
- `node --check api/**/*.mjs`
- Relevant browser/E2E checks
- Regressions in affected area

## Notes
- `npm test` excludes `api/**`. Run API tests explicitly (e.g. `npx vitest run tests/api/...`) and `node --check`.
- docs/AI_AUDITLOG.md — mandatory step template auditlog workflow

## Current Test Context (2026-11-22)
- Main release baseline `c1cb1f8`; for profile/ATS changes run targeted profile/session/API tests, `npm run build`, the full serial Vitest suite and `git diff --check`.
- `npm test` excludes `api/**`; run relevant API tests explicitly (for example `npx vitest run tests/api/ris-search-profiles.test.mjs`) and `node --check api/**/*.mjs`.
- For ATS save regressions verify session and RIS create/update separately: exact duplicate/whitespace normalization, casing preservation, reload, parent rejection, capacity, consent/error mapping and no real writes.
- For UX/E2E work follow the repository E2E scripts and preserve screenshots under `docs/reports/assets/`.
