# JM-PROFILE-UI-HARDENING-05 — Execution Log

## Status

- **Overall:** IMPLEMENTED / VERIFIED — session-only hardening
- **RIS / remote adapter / persistence:** NOT IMPLEMENTED
- **AWS / deployment:** NOT RUN / NOT DEPLOYED
- **Baseline:** `ca4c682` (`main`, `origin/main` synchronized)
- **Pre-existing untracked files:** preserved and not staged

## Investigated call sites

`src/App.tsx`:

- `handleSaveManualProfile`
- `handleDeleteManualProfile`
- `handleDuplicateManualProfile`
- CV search-profile save (`CvProfileResult.onConfirm`)
- ATS profile save (`handleSkillSelectionConfirm`)

`src/components/ManualSearchProfilesSection.tsx`:

- save submit, duplicate, delete confirmation, pending/disabled states

## Findings

1. Manual CRUD used `void repo.*().catch(() => undefined)` followed by an
   immediate refresh. The list refresh ran before the awaited operation and all
   errors were swallowed.
2. The section displayed “saved/deleted/duplicated” immediately, regardless of
   the repository result.
3. CV/ATS saves read the session store synchronously after starting an async
   create. This only worked because the current session adapter resolves
   synchronously internally.
4. Auth identity changes cleared manual profiles but left CV hash buckets,
   CV documents, active search/ATS selections and consent state in memory.
   A second user in the same tab could therefore see the previous user's
   temporary CV workflow data.
5. No epoch guard prevented a delayed save from publishing state after a user
   switch.

## Corrections

- Manual save/delete/duplicate now `await` the session adapter. The list is
  refreshed only after success. Failures propagate to the section.
- The section keeps a `pendingAction`, disables conflicting actions, shows a
  localized error on failure, and displays success only after `await` resolves.
  The profile name overwrite behavior is unchanged.
- CV search-profile and ATS saves await the adapter and use the returned
  session ID/name instead of re-reading the store. On failure they keep the
  workflow on the current step and show an error status.
- ATS save marks `isProcessing` while pending, preventing double submissions.
- `sessionEpochRef` is incremented on auth identity change. Async completions
  check the epoch before touching state, so late results are ignored.
- On identity change the app now clears: manual profiles, CV hash buckets,
  CV documents/workflow state, selected saved search, selected ATS profile,
  profiles overlay target, ATS profile name, consent-dismissed flag and status.
- The existing 12-hour lazy TTL, 50-entry session list capacity, 5-ATS-parent
  limit and ATS override semantics are unchanged.
- No new network, model, persistence, localStorage, IndexedDB or RIS path was
  introduced.

## Session isolation check

| Data | User switch behavior |
|---|---|
| Manual profiles | cleared from the in-memory repository |
| CV hash buckets | cleared via `resetCvProfileLists()` |
| CV documents/File objects | React CV state reset |
| Selected search/ATS profile | reset to `null` |
| Consent/workflow flags | reset to initial state |
| Pending async save | ignored via session epoch |
| Reload | still clears all in-memory state |
| 12h TTL | unchanged |

`localStorage` is still used only for language; no profile data is stored
there. The authenticated browser flow was not executed, so this isolation is
verified by unit/integration tests, not a live login session.

## ATS parent deletion — decision template

Current behavior (unchanged): deleting a CV search profile sets
`searchProfileId = null` on its ATS children; children are retained.

| Option | Behavior | Advantages | Risks |
|---|---|---|---|
| A | Delete ATS children with the parent | matches strict V1 parent requirement | destructive, needs confirmation copy, may delete user work |
| B | Keep children unassigned | preserves user work, current behavior | unassigned children need a visible/manageable state; V1 requires a parent |
| C | Keep but hide until reassigned | preserves data without cluttering the list | hidden data can confuse users and erasure expectations |

**Recommendation for a later product decision:** B for the session model, with
an explicit “unassigned ATS profile” UI and a mandatory reassignment step
before any future remote migration. No cascade deletion is implemented here.

## Tests

| Gate | Result |
|---|---|
| New async success/failure/double-click tests | VERIFIED — PASS |
| Delayed-save race test after user switch | VERIFIED — PASS |
| Auth-switch CV bucket reset test | VERIFIED — PASS |
| Targeted profile tests | VERIFIED — 117 passed across 4 files |
| Full `npm test -- --run` | VERIFIED — 942 passed, 5 skipped; 90 passed, 3 skipped files |
| `npx tsc --noEmit -p tsconfig.app.json` | VERIFIED — PASS |
| `npm run build` | VERIFIED — PASS |
| `git diff --check` | VERIFIED — PASS |
| Chromium 1440 px manual CRUD smoke | VERIFIED — create, duplicate, delete; no overflow/console errors |
| Chromium 390 px manual CRUD smoke | VERIFIED — same |
| Network during CRUD | Only `GET /api/models` on mount; no job/match/profile request |
| Authenticated browser CRUD/logout flow | NOT VERIFIED |
| RIS / API / AWS | NOT RUN / NOT VERIFIED |

## Remaining risks

- Live authenticated identity switching was not exercised in a browser.
- The CV workflow reset on auth change is broader than before; it is covered by
  an integration test but should be included in a future authenticated E2E.
- ATS unassigned-child UX remains OPEN pending the decision above.
- The session adapter still resolves locally; remote latency/failure behavior
  remains untested until a remote adapter exists.

## Files changed

- `src/App.tsx`
- `src/components/ManualSearchProfilesSection.tsx`
- `src/i18n.tsx`
- `src/components/ManualSearchProfilesSection.test.tsx`
- `src/ManualSearchProfiles.integration.test.tsx`
- `src/ManualSearchProfiles.authRace.test.tsx`
- this report
- `docs/AI_AUDITLOG.md`

## Git

- Commit and push are recorded after final validation.
- No production deployment was performed.
