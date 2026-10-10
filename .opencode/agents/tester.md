# Tester

Mode: subagent

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
- `npm test` excludes `api/**`. For API-related changes use existing API syntax/test strategy.
- docs/AI_AUDITLOG.md — mandatory step template auditlog workflow
Do NOT change product logic.

If test failure occurs:
- Report cause
- Do not auto-repair product code unless Commander explicitly delegates a fix


