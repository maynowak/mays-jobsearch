# JM-ATS-OVERLAY-PARITY-08A — Execution Log

## Status

- **Overall:** IMPLEMENTED / VERIFIED (session-only)
- **RIS / persistence / deployment:** NOT IMPLEMENTED / NOT DEPLOYED
- **Baseline:** `282da6b` (`main`, `origin/main` synchronized)
- **Pre-existing untracked files:** preserved and not staged

## Confirmed finding

`CvProfilesOverlay` was rendered in `App` with `onAssignUnassigned`, but
`DashboardV2CvSection` rendered the same overlay without the callback. The
dashboard showed the unassigned list, yet its “Zuordnen” button had no handler
and could not work.

## Correction

- Added `onAssignUnassigned` to `DashboardV2CvSection`.
- `App` passes the existing `handleAssignUnassignedAts` handler; no second
  assignment implementation was created.
- The dashboard overlay wrapper supplies the hash of the CV whose profiles were
  opened, not the currently selected CV.
- The overlay is keyed by document ID, so changing the opened CV resets local
  assignment state.
- When the callback is missing or the CV has no hash, the overlay receives
  `undefined`; its assign action stays disabled/ineffective instead of
  pretending to work.
- Assignment still runs through the session repository adapter with generation,
  CV-hash, parent, unassigned-only and five-profile capacity checks.
- UI updates only after the awaited call succeeds; errors and capacity
  violations remain visible; session-ended is a silent cancellation.

## Search-page overlay

Unchanged and still receives the callback from `App` with the opened document's
hash. Existing behavior and tests remain green.

## Dashboard overlay

Now uses the same callback path. A CV switch while the overlay is open does not
retarget the captured hash; the overlay resets when the opened document changes
because it is keyed by document ID.

## Guest compatibility

- No authentication requirement was added.
- The `/search` CV tab remains available without login.
- Existing PDF upload, consent, anonymization, model selection, profile
  generation, CV search profiles, ATS variants and session reassignment remain
  available.
- `/profil` keeps its existing authentication rules.
- No job search or model call is triggered by assignment.

## Tests

| Case | Result |
|---|---|
| Dashboard overlay receives the assignment callback | VERIFIED — PASS |
| Callback receives the opened CV hash | VERIFIED — PASS |
| CV switch does not retarget the open overlay | VERIFIED — PASS |
| Unassigned list/assignment UI (search page component) | VERIFIED — PASS |
| Repository integrity/capacity/generation tests | VERIFIED — PASS |
| Guest CV tab and upload input (Chromium) | VERIFIED — PASS |
| Full `npm test -- --run` | VERIFIED — 964 passed, 5 skipped; 92 passed, 3 skipped files |
| `npx tsc --noEmit -p tsconfig.app.json` | VERIFIED — PASS |
| `npm run build` | VERIFIED — PASS |
| `git diff --check` | VERIFIED — PASS |
| Chromium 1440/390 route smoke | VERIFIED — CV tab/upload visible, no overflow/console errors |
| Full guest PDF→profile→ATS workflow in browser | NOT VERIFIED — no synthetic PDF fixture |
| Dashboard overlay with seeded CV in browser | NOT VERIFIED — no CV fixture/session |
| Authenticated browser flow | NOT VERIFIED |

## Open points

- A committed synthetic CV fixture is still needed for full browser coverage of
  the overlay and guest PDF workflow.
- Unassigned ATS entries must not be migrated to persistent V1 resources before
  a parent is assigned.
- RIS/remote persistence remains outside this package.

## Files changed

- `src/components/DashboardV2CvSection.tsx`
- `src/components/DashboardV2CvSection.test.tsx`
- `src/App.tsx`
- this report
- `docs/AI_AUDITLOG.md`

## Git

- Implementation commit: `d95d6f8`
- Remote: pushed to `origin/main`, synchronized (`0 0`)
- No production deployment was performed.
