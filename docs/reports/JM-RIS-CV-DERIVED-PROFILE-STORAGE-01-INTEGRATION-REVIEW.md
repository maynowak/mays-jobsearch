# JM-RIS-CV-DERIVED-PROFILE-STORAGE-01 — Integration Review

**Status:** `INTEGRATION READY — GO FOR CONTROLLED PR`
**No push, merge or deployment**
**Date:** 2026-11-09

## Baselines

| Ref | SHA |
| --- | --- |
| Remote `main` | `bcd503c` |
| Feature branch | `feature/jm-ris-cv-derived-profile-storage-01` @ `177428c` |
| Integration branch | `integration/jm-ris-cv-derived-profile-storage-01` @ `177428c` |

`origin/main` is an ancestor of the feature branch. The isolated integration
worktree needed no conflict resolution (`git merge origin/main` -> already
up to date). No UX/P3/CV code was rewritten or lost.

## Functional preservation

### Session

- CV processing and session search/ATS profile creation remain on the existing
  session repositories.
- Session is the default storage choice; no RIS write is triggered.
- Existing CV lists, profile selectors and ATS parent rules stay unchanged.

### Durable

- A processed durable RIS CV carries only a session-scoped `risCvId`.
- Durable search profiles use `persistentSearchProfiles.createCv(cvId, input)`.
- Durable ATS profiles use `createAts(searchProfileId, input)`.
- Existing durable parent profiles are loaded through `listCv(cvId)` and can be
  selected; invalid/missing parents are rejected before any write.
- Session IDs are never passed as RIS parent IDs.
- Durable save switches to persistent CV mode; the persistent profile overlay
  reloads from RIS after save/reload.
- Session save switches back to session mode.

### Privacy and lifecycle

- `search-profile-storage` must be `GRANTED`; CV storage consent is not reused.
- Busy state + operation token prevent duplicate submits and late success after
  close/back.
- Identity/session reset clears `risCvId`, durable parent state and in-flight
  operations.
- Failure keeps the workflow on the current step and does not claim success.
- May help explains session vs durable and the separate consent boundary.

## Screenshots

Assets: `docs/reports/assets/JM-RIS-CV-DERIVED-PROFILE-STORAGE-01-INTEGRATION/`

| Width | Overflow | Session option | Persistent option | May hint |
| --- | --- | --- | --- | --- |
| 320 px | none | visible | visible | visible |
| 390 px | none | visible | visible | visible |
| 430 px | none | visible | visible | visible |
| 1024 px | none | visible | visible | visible |
| 1440 px | none | visible | visible | visible |

`storage-390-persistent.png` and `storage-1024-persistent.png` show the selected
durable state. The screenshot surface is a temporary dev preview with demo
content; the temporary preview change was reverted before this commit.

## Verification

| Check | Result |
| --- | --- |
| New storage/guard tests | **5 passed** |
| Focused regression | **72 passed** |
| Full suite, serial | **1667 passed**, 5 skipped |
| Production build | **PASS** |
| Diff/secret audit | **clean** |

No pre-existing test failures were introduced. The authenticated live RIS write
was **not** executed and is not claimed as verified.

## Recommendation

**GO for a controlled PR** against `main` after normal review.

**NO-GO for production until a signed-in synthetic RIS E2E** verifies the actual
`createCv`/`createAts` writes, reload and parent assignment. No deployment is
part of this review.

## Remaining risks

- No App-level end-to-end test for the real authenticated `createCv`/`createAts`
  path; guard tests and the existing API contract tests cover the decision and
  request shapes.
- The real persistence/reload path depends on the RIS consent allowlist and
  remains a deployment-time synthetic verification.
- No push, merge, deployment, RIS/AWS/Terraform change or real user data.
