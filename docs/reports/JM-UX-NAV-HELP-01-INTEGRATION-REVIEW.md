# JM-UX-NAV-HELP-01 — Integration Review

**Status:** `INTEGRATION REVIEW PASS — READY FOR UX PR`
**No push, merge or deployment**
**Date:** 2026-11-09

## Baselines

| Ref | SHA |
| --- | --- |
| Remote `main` after PR #9 | `eedd8f2` |
| UX branch | `feature/jm-ux-nav-help-01` @ `092a5da` |
| PR #9 | merged as `eedd8f2` (head `0f68857`) |
| Integration branch | `integration/jm-ux-nav-help-01-pr9` @ `1b5c68b` |

The UX branch already contained the pre-PR-#9 `main`. The isolated integration
worktree merged PR #9, then refreshed onto the PR #9 merge commit `eedd8f2`.
The UX feature branch itself was not changed.

## Conflict resolution

Only two files conflicted:

- `src/components/DashboardV2CvSection.tsx`
- `src/components/PersistentCvList.tsx`

Both were resolved by keeping both features:

- **Verarbeiten** for a ready durable CV (UX)
- **Suchprofile verwalten** for durable search/ATS profiles (PR #9)
- Existing consent, session/durable mode switch, profile overlay, retry and
  error states remain in place
- Navigation/CSS/i18n merged without additional duplicated controls

## CV acceptance path

A verified user can select a ready durable CV, click **Verarbeiten**, and the
PDF is loaded through the existing authenticated BFF/presigned URL into the
existing `handleCvUploadStart` workflow. No second upload, analysis engine or
storage consent reuse; the existing AI/CV consent gate remains authoritative.
Identity, storage consent, `ready` state and capacity are covered by the pure
handoff guard tests; the post-download session-epoch branch is implemented and
code-reviewed but not separately unit-tested.

## Screenshots

Assets: `docs/reports/assets/JM-UX-NAV-HELP-01-INTEGRATION/`

| Width | Overflow | Main nav | Dashboard nav | May |
| --- | --- | --- | --- | --- |
| 320 px | none | burger | compact select | visible |
| 390 px | none | burger | compact select | visible |
| 430 px | none | burger | compact select | visible |
| 768 px | none | burger | desktop sidebar | visible |
| 1024 px | none | desktop | desktop sidebar | visible |
| 1440 px | none | desktop | desktop sidebar | visible |

Additional evidence: `settings-390.png` and `settings-1024.png` show the
storage/privacy section after the PR #9 merge, also without horizontal overflow.
All screenshots were captured after the merge; four dashboard shots are
byte-identical to the UX-only captures because the layout did not change.
Screenshots use demo data only.

## Verification

| Check | Result |
| --- | --- |
| Focused UX + PR #9 tests | **67 passed** |
| Full suite, serial | **1662 passed**, 5 skipped |
| Production build | **PASS** |
| Screenshot overflow | **none** |

The full suite includes the P3 account-erasure, search-profile and consent
tests from PR #9, so both features were exercised together.

## Merge recommendation

**GO for the UX PR against the updated `main`.**

Completed:

1. PR #9 merged as `eedd8f2`.
2. UX integration branch refreshed onto `eedd8f2`; no new conflicts.

Remaining:

1. Open the UX PR from `integration/jm-ux-nav-help-01-pr9` against `main`.
2. Merge only after normal review/checks; **do not rebase**, because the two
   component conflicts were already resolved in `803daf3`.
3. Deploy only with separate approval.

No automatic merge, deployment, force-push, AWS/Terraform/RIS change or real
data was used.

## Remaining risks

- A real signed-in browser check of the presigned S3 GET/CORS path is still a
  deployment-time verification; local coverage uses a mocked BFF.
- P3 remains a limited pilot; account erasure/production rollout and S3
  version/backup/PITR boundaries are separate approvals.
- Parallel test execution retains pre-existing timing flakes; the serial full
  suite is green.
