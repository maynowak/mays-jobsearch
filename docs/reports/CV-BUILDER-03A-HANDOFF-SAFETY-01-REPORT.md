# CV-BUILDER-03A-HANDOFF-SAFETY-01

**Status:** `CV-BUILDER-03A — HANDOFF SAFETY VERIFIED / READY FOR MAIN REVIEW`
**Date:** 2026-11-12
**Branch:** `feature/cv-builder-03a-full-page-workspace`
**Safety code HEAD:** `3c6a878`
**Previous workspace HEAD:** `a2fe1a4`
**Main:** `4192353`
**Decision:** **STOP before main integration and production release.**

## 1. Scope

Three handoff safety issues were corrected without rebuilding the workspace:

1. Return transfer now requires an explicit source result.
2. The import review remains intact when opening the second tab fails.
3. Identity/session ownership is checked at the moment of the repository write.

## 2. STEP A — Binding return confirmation

The handoff protocol now uses:

```text
ready -> handoff -> accepted
return -> return-result
session-ended (invalidation)
```

Return results are exactly:

- `applied`
- `conflict`
- `identity_changed`
- `session_ended`
- `error`

`sendWorkspaceReturn()` waits for the source result. The workspace shows a
success message only for `applied`. A successful `postMessage()` alone is not
success. On `conflict`, the workspace keeps its data and displays the conflict;
on identity/session rejection it clears the workspace data; on timeout,
unreachable opener or error it keeps local data and reports no confirmation.

`openCvBuilderWorkspace()` now resolves only after the target sends `accepted`.
The source keeps its import/editor state open until that point. Target
acceptance is therefore a real handoff acknowledgement, not just a popup
opening.

## 3. STEP B — Import state on failed handoff

The source import dialog is closed only after `accepted`.

On these paths the dialog remains open with all sections, manual decisions,
review items and skill selections intact:

- popup blocked;
- target tab closed before acceptance;
- target does not load/confirm;
- handoff timeout.

E2E verifies blocked, closed-before-acceptance and timeout paths. The failure
message is visible and the skill selection/count remains unchanged.

## 4. STEP C — Identity and session isolation

The source now checks, immediately before the repository write:

- payload identity against the **current** `authProfileKeyRef`;
- current session epoch against the opening epoch;
- current CV repository generation against the opening generation.

The checks are centralized in `workspaceOwnershipRejection()` and covered by
unit tests for identity, epoch and generation changes.

On identity change the source calls `invalidateWorkspaceHandoffs()`, which
sends `session-ended` to the active workspace and removes the handoff listener.
The workspace clears draft, profile, repository, import review and current mode.
No old data can be written into a new identity's repository.

Handoff and return messages continue to validate origin, exact source window,
random handoff id and schema.

## 5. STEP D — Browser E2E

`tests/e2e/cv-builder-full-page-workspace-03a.mjs` now covers:

| Case | Result |
|---|---|
| Successful import handoff with skill selection preserved | PASS |
| Source dialog remains after popup blocker | PASS |
| Source dialog remains after target closes before acceptance | PASS |
| Source dialog remains after handoff timeout | PASS |
| Confirmed `applied` return into source editor | PASS |
| Stale repeated return → visible conflict, no overwrite | PASS |
| Editor handoff, edit, save, transfer back | PASS |
| Source tab closed → local data remains, no false success | PASS |
| Direct workspace start view | PASS |
| DE/EN | PASS |
| Screenshot mode 320–1920 px | PASS |
| Repeated return messages | covered by stale-return case |
| Invalid payload guards | unit tests |
| Identity/session changes | unit ownership tests + source checks |

The test uses synthetic data only. It observes only `GET /api/models`; no PDF
upload, no RIS/non-GET API and no unexpected persistence.

### Authenticated logout/user-switch note

The local browser harness runs as a guest identity. A real authenticated
logout/user-switch E2E requires an approved test identity and was not executed
in this gate. The identity/session rejection path is covered by the
`workspaceOwnershipRejection()` unit tests and the source-side checks directly
before the write. This is recorded as a remaining verification boundary, not
as a passing live-auth claim.

## 6. STEP E — Regression

| Check | Result |
|---|---|
| Focused workspace/ownership/parser/structure/editor/root tests | **88 PASS** |
| Serial full suite | **1792 PASS / 5 skipped** |
| TypeScript / production build | **PASS** |
| Existing 02A–02F/PDF E2E | **PASS** |
| New full-page handoff E2E | **PASS** |
| PDF export real download | **PASS** |
| `git diff --check` | **PASS** |
| Secret/privacy scan | **PASS** |
| New horizontal overflow | **0 px** at 320–1920 |

## 7. STEP F — Git and report

- Safety code/tests commit: `3c6a878`
- Documentation commit follows on the same feature branch.
- Main remains `4192353`.
- No merge, no production deployment, no force-push, no history rewrite.
- Automatic Vercel preview builds remain enabled.
- No RIS/AWS/Cognito/Terraform/consent change.

## 8. Known limits

- Authenticated logout/user-switch browser E2E remains unavailable without an
  approved test identity; unit ownership checks and source-side immediate
  rejection are implemented.
- The workspace is session-only; direct/reloaded tabs start clean.
- A source tab closed or reloaded cannot confirm a return; the workspace keeps
  local data and export ability, by design.
- No real production deployment was performed.

**STOP before main integration and production release.**
