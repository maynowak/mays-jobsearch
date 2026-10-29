# MAYS-UI-S5.2-A-R3 — Profile select source fix

- Status: COMPLETE
- Date: 2026-10-29
- Branch: `main`
- Base HEAD: `3166802`

## Root cause

The Dashboard used the explicit selected-document ID, while `App.tsx` resolved
the profile-list source independently from the first `document.selected` flag.
During a switch to CV 2, the old profile IDs could therefore survive for one
render against a different source context. The store itself remained correctly
hash-separated.

## Fix

- App-level profile-list lookup now uses `selectedDocumentIds[0]`, the same
  active-document source used by the Dashboard.
- Search and ATS native selects are keyed by the active CV hash (and ATS by
  the selected parent search-profile ID), forcing option replacement when the
  context changes.
- No new storage, API, model call, or infrastructure was introduced.

## Verification

- Synthetic hash-isolation fixtures: existing Dashboard tests cover two CVs and
  separate lists; targeted App/CV workflow selection tests passed (35 passed,
  63 skipped by name filter); targeted ATS/CV tests passed (29 passed, 69
  skipped).
- `npm run build` — PASS
- All `api/**/*.mjs` syntax checks — PASS
- `git diff --check` — PASS
- Full suite after the source/filter fix: `npm test -- --run` — PASS (850
  passed, 5 skipped). No browser/Firefox run was performed.

## Git / AI audit

- AI_AUDITLOG updated with local-only data-flow assessment.
- Unrelated untracked user files were preserved and not staged.
- Commit and push are requested for this correction; no deployment.
