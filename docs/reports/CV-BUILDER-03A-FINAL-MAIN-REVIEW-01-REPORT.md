# CV-BUILDER-03A-FINAL-MAIN-REVIEW-01

**Status:** `CV-BUILDER-03A — FINAL REVIEW PASSED / READY FOR MAIN RELEASE`
**Date:** 2026-11-12
**Branch:** `feature/cv-builder-03a-full-page-workspace`
**Starting HEAD:** `542e6f1`
**Final code HEAD:** `5e0d4ab`
**Main:** `4192353`
**Decision:** **STOP before main integration and production release.**

## 1. Direct-route identity finding

The suspected direct-route gap was real:

- `handoffIdentity` stays `undefined` for a direct `/cv-builder/workspace`.
- The prior identity effect only ran for handoff workspaces.
- A later auth identity change therefore did not clear direct-route CV data.
- Additionally, the handoff initialization effect reset a direct workspace to
  the start view when `auth.isLoading` settled.

### Correction

- Added a separate `directIdentityRef` baseline.
- The baseline is captured only after the initial auth load has settled.
- Initial guest/auth-loading state is not treated as a user switch.
- Any subsequent direct-route identity change calls `clearWorkspaceData`:
  - draft and template reset;
  - profile and repository invalidated;
  - review/session state cleared;
  - editor replaced by the identity-change error/start state.
- The handoff effect no longer resets an active direct workspace when auth
  loading changes.
- Guest mode remains available.

### Synthetic component test

`src/components/CvBuilderWorkspacePage.test.tsx` covers:

1. Direct route → empty CV → name entered → identity changes → editor/data
   cleared and not recoverable.
2. Direct route with `auth.isLoading=true` → data entered → auth settles as a
   user → data remains because this is initial loading, not a user switch.

## 2. Handoff-safety review

The following paths were reviewed and exercised:

- `ready → handoff → accepted`
- `return → return-result`
- `session-ended`
- origin, exact window, UUID and schema validation
- ready/return timeouts
- one-time handoff acceptance
- version conflicts
- failed returns without false success
- source-closed behavior
- cleanup on identity/session change

Findings:

- Source closes import/editor only after the workspace sends `accepted`.
- Return success is only shown for `applied`.
- `conflict` preserves workspace data and does not overwrite source data.
- `identity_changed`/`session_ended` clear workspace data.
- Blocked / closed / timed-out target leaves source import review intact.
- Current auth identity, session epoch and CV generation are checked
  immediately before the repository write.
- Pending handoffs are invalidated on source identity change.
- No success is reported from `postMessage` delivery alone.

## 3. Regression

| Check | Result |
|---|---|
| Focused final tests | **90 PASS** |
| Serial full suite | **1794 PASS / 5 skipped** |
| TypeScript / production build | **PASS** |
| Existing import/parser/mapping/workflow/02D/PDF/02E E2E | **PASS** |
| Full-page handoff safety E2E | **PASS** |
| Screenshot 320 / 390 / 768 / 1024 / 1440 / 1920 | **PASS**, 0 px overflow |
| Real PDF download | **PASS** |
| `git diff --check` | **PASS** |
| Secret/privacy scan | **PASS** |
| New horizontal overflow | **0 px** |
| RIS / non-GET API calls | **none** |

The E2E covers successful import handoff with preserved skill decisions,
blocked/closed/timeout handoff state preservation, confirmed applied return,
stale return conflict, editor handoff/return, closed source tab, direct route,
DE/EN and screenshot/full-page scrolling.

## 4. Verification boundary

An authenticated logout/user-switch browser E2E still requires an approved
test identity. No such identity was available in this session. The
identity/session rejection path is covered by:

- the direct-route component test above;
- `workspaceOwnershipRejection()` unit tests for identity, epoch and CV
  generation;
- source-side checks immediately before repository writes;
- active-handoff invalidation on identity change.

This remains a documented verification boundary, not a claimed live-auth PASS.

## 5. Commits

- `3c6a878` — handoff confirmation and import-state preservation
- `5e0d4ab` — direct-route identity isolation and test
- Documentation commit follows on the same feature branch
- No main merge, no production deployment, no force-push, no history rewrite
- Automatic Vercel preview builds remain enabled

## 6. Known limits

- Workspace remains session-only; direct/reloaded tabs start clean.
- Closed source tab cannot confirm a return; local data/export remain.
- Authenticated logout/user-switch E2E is a verification boundary as above.
- No real production deployment was performed.

**STOP before main integration and production release.**
