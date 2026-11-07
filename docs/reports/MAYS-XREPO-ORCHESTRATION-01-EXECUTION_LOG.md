# MAYS-XREPO-ORCHESTRATION-01 — Execution Log (Jobsearch)

## 1. Current status

`IMPLEMENTED / LOCAL VERIFIED / E2E PENDING / BLOCKED FOR LIVE`

## 2. Audit date/time

`2026-11-06T09:35:00+01:00` (Europe/Berlin)

## 3. Current Git branch and HEAD

- Branch: `feature/mays-xrepo-orchestration-01`
- Base: `origin/main` = `fec135c2623c9fffbf73717b232ab09da134d3d7`
- Local `main`: `7a3d2ea` (14 commits ahead of `origin/main`; preserved unchanged)

## 4. Audit scope

Discovery for the bidirectional cross-repository handoff V1: verify paths, remotes,
branch state, existing instructions/workflows, and safe branch base. No product
code, workflow, Terraform, AWS, Cognito, CloudFront, Vercel, or Mays-Orders change.

## 5. Completed audit sections

- Confirmed checkout: `/home/dci-student/projects/Mays-Jobsearch`.
- Confirmed remote: `git@github.com:maynowak/mays-jobsearch.git`.
- Read `AGENTS.md`, `docs/AI_AUDITLOG.md`, and `.github/workflows/codeql.yml`.
- Verified local `main` vs. `origin/main`: 14 ahead / 0 behind.
- Verified pre-existing untracked documents; left untouched.
- Created `feature/mays-xrepo-orchestration-01` from `origin/main`, not from the unpublished local `main`.
- Verified there is no existing xrepo workflow or validator.

## 6. Actual findings

- Only `.github/workflows/codeql.yml` exists; it is unrelated and remains unchanged.
- `AGENTS.md` defines a strict external RIS boundary; this task may only add the
  documented cross-repo workflow, not inspect or mutate RIS infrastructure.
- Existing local `main` contains unpublished integration work. Basing the feature
  branch on `origin/main` keeps the draft PR limited to this task.
- Four untracked documents were present before branching; they are not part of this task.

## 7. Evidence / file references

- `AGENTS.md`
- `docs/AI_AUDITLOG.md`
- `.github/workflows/codeql.yml`
- `git rev-parse origin/main` → `fec135c2623c9fffbf73717b232ab09da134d3d7`
- `git rev-list --left-right --count main...origin/main` → `14  0`
- `git status --short --branch`

## 8. Classification

`GREEN` — discovery only; existing work and boundaries preserved.

## 9. Terraform checks actually executed

None. Out of scope.

## 10. Git status

Branch `feature/mays-xrepo-orchestration-01`; report/audit changes only. The four
pre-existing untracked documents remain untracked and unchanged.

## 11. Files changed

- `docs/reports/MAYS-XREPO-ORCHESTRATION-01-EXECUTION_LOG.md`
- `docs/AI_AUDITLOG.md`

## 12. Explicit no-change confirmation

No product code, existing workflow, Terraform, AWS, Cognito, CloudFront, Vercel,
Mays-Orders, branch, worktree, or stash was modified.

## 13. Open questions

- Cross-repository GitHub App credentials are not configured or verified in this
  repository. Live dispatch must remain `BLOCKED FOR LIVE` until they exist.

## 14. Risks

- Pushing this feature branch does not publish the unpushed local `main` commits.
- There is no dedicated xrepo test harness yet; later gates must add and run one.

## 15. Recommended next actions

Proceed to Gate 02 (Contract): versioned schema, validator, fixtures, and tests.

## 16. Current resume point

Gate 01 complete on `feature/mays-xrepo-orchestration-01` at base `fec135c`.


## Gate 02 — Contract

- Status: `COMPLETE — GREEN`
- Added `docs/xrepo/MAYS-XREPO-V1.schema.json` (versioned JSON Schema, 9 fields, max 10 evidence items).
- Added `scripts/xrepo/validate_event.py` (stdlib-only, fail-closed, 64 KiB limit, allowlist, source/target checks, evidence/source binding).
- Added `scripts/xrepo/test_validate_event.py` with 27 tests.
- Added fixtures under `docs/xrepo/fixtures/` for valid, spoofed-source, and evidence-absent events.
- Added `docs/xrepo/MAYS-XREPO-V1.md` with statuses, sequence/idempotency rules, credential requirements, and the test matrix.
- Test command: `python3 -m unittest scripts/xrepo/test_validate_event.py -v` → **27 tests OK**.
- Schema/fixtures JSON parse check: **PASS**.
- No live dispatch, no GitHub workflow change, no product/infrastructure change.
- Remaining: receiver/sender workflows, issue-state tests, PRs, and E2E readiness.

## Updated resume point

Gate 02 complete. Next: Gate 03 receiver plus idempotent issue-update tests.


## Gate 03 — Receiver

- Status: `COMPLETE — GREEN`
- Added `scripts/xrepo/apply_event.py`: source issue/commit verification, destination issue check, duplicate/stale/conflict decisions, idempotent Markdown comments, HTML escaping, no shell interpolation.
- Added `scripts/xrepo/test_apply_event.py`: state, retry, stale, duplicate, conflict, A→B→A status chain, source verification, target verification, and no-shell posting tests.
- Added `.github/workflows/xrepo-receive.yml`: `repository_dispatch` type `mays_xrepo_v1`, payload extraction via `jq`, re-validation, per-task concurrency, app token only for source reads, `GITHUB_TOKEN` for destination issue writes, explicit `BLOCKED FOR LIVE` when app secrets are absent.
- Test command: `python3 -m unittest discover -s scripts/xrepo -p 'test_*.py'` → **45/45 PASS**; `py_compile` → **PASS**.
- No live dispatch. The workflow is not on the default branch, so E2E remains pending.
- No product/infrastructure/workflow outside the new receiver file was changed.

## Updated resume point

Gate 03 complete. Next: Gate 04 sender workflow.


## Gate 04 — Sender

- Status: `COMPLETE — GREEN`
- Added `scripts/xrepo/build_event.py`: CLI builder with generated UUID v4, allowlist/target validation, evidence parsing, and canonical JSON output.
- Added `scripts/xrepo/test_build_event.py`: 8 tests for valid builds, evidence requirements, source/target rejection, invalid status/commit, and CLI round-trip/failure.
- Added `.github/workflows/xrepo-send.yml`: manual `workflow_dispatch`, source/target issue checks, local validation, explicit `BLOCKED FOR LIVE` without app secrets, least-privilege app token for `repository_dispatch`, and source-issue dispatch record.
- Test command: `python3 -m unittest discover -s scripts/xrepo -p 'test_*.py'` → **53/53 PASS**.
- No live dispatch. No product/infrastructure/existing workflow change.

## Updated resume point

Gate 04 complete. Next: Gate 05 local QA matrix and full verification.


## Gate 05 — Local QA

- Status: `COMPLETE — GREEN (local)`
- Added reproducible runner `scripts/xrepo/run_local_qa.sh` and detailed report `docs/reports/MAYS-XREPO-ORCHESTRATION-01-LOCAL-QA.md`.
- Matrix covers: valid, invalid schema, spoofed source, unauthorized repository, wrong target, stale sequence, duplicate event, evidence absent, retry cycle, A→B→A state sequence, source verification, no-shell posting, and missing credentials.
- Actual result: **53/53 tests PASS**, JSON parse PASS, workflow YAML parse PASS, `git diff --check` PASS.
- Live `repository_dispatch` was **not** executed; E2E remains pending because the workflows are not on the default branches and app credentials are not configured.
- No full product suite was run because no product code/API was changed; no Terraform/AWS/etc. was touched.

## Updated resume point

Gate 05 complete. Next: Gate 06 PR readiness.


## Gate 06 — PR Readiness

- Status: `COMPLETE — GREEN (PR readiness)`
- Jobsearch draft PR: https://github.com/maynowak/mays-jobsearch/pull/2
- RIS draft PR: https://github.com/maynowak/Mays-Recruiting-Intelligence-System/pull/6
- Both PRs are based on their repository's `main`; no merge, no auto-merge, no deployment command.
- Jobsearch `origin/main` advanced from `fec135c` to `7a3d2ea` during the task. Resolved by a normal merge commit `45c1e02` (no rebase, no force-push); the PR is now `MERGEABLE`/`UNSTABLE` only because Vercel preview checks are still reporting.
- RIS PR is `MERGEABLE`/`CLEAN`; no checks are configured.
- Diff audit: only the intended xrepo files, audit reports, and no product/API/Terraform changes.
- Secret audit: only references to secret *names* (`XREPO_APP_ID`, `XREPO_APP_PRIVATE_KEY`), no secret values, tokens, or credentials.
- Jobsearch PR creation triggered the repository's existing Vercel preview integration; this is platform behavior, not a manual Vercel configuration/deployment change.
- PR body records `IMPLEMENTED / E2E PENDING` and the remaining live setup.

## Updated resume point

Gate 06 complete. Next: Gate 07 E2E readiness. Live dispatch remains blocked until workflows are on both default branches and app credentials exist.


## Gate 07 — E2E Readiness

- Status: `E2E READINESS COMPLETE — LIVE BLOCKED`
- Controlled test issues:
  - A/source: https://github.com/maynowak/mays-jobsearch/issues/3
  - B/destination: https://github.com/maynowak/Mays-Recruiting-Intelligence-System/issues/7
- Added `docs/reports/MAYS-XREPO-ORCHESTRATION-01-E2E-READINESS.md` with the exact A→B→A runbook, expected status sequence, rework cycle, and live assertions.
- Live `repository_dispatch` was **not** executed because:
  1. the receiver workflow is not on the default branches;
  2. `XREPO_APP_ID` / `XREPO_APP_PRIVATE_KEY` are not configured/approved.
- Final local status: **IMPLEMENTED / LOCAL VERIFIED / E2E PENDING / BLOCKED FOR LIVE**.
- No merge, deployment, Terraform/AWS/Cognito/CloudFront/Vercel configuration/Mays-Orders, or product-code change.
- Recovery point: both draft PRs, both controlled issues, local QA report, and this runbook.

## Final resume point

Audit complete. Next action requires explicit rollout approval: merge both PRs, install/approve the GitHub App, add the two secrets to both repositories, then execute the A→B→A runbook against issues #3/#7 and record real run IDs/comment URLs. Do not merge or dispatch without approval.


## Post-gate hardening — 2026-11-06

- Receiver state markers are now trusted only from `github-actions[bot]`.
  User-authored comments cannot inject a high sequence or suppress an event.
- Added `test_untrusted_comment_markers_are_ignored`.
- Re-ran `./scripts/xrepo/run_local_qa.sh`: **54/54 tests PASS**, JSON/YAML/diff checks PASS.
- This is a follow-up hardening commit after the draft PR; no product/infrastructure change.


## Workspace path correction — 2026-11-06

- Canonical working directory is now `/home/dci-student/projects/mays-xrepo-orchestration/repos/mays-jobsearch`.
- Gate 01 discovery originally ran in the external checkout `/home/dci-student/projects/Mays-Jobsearch`. That checkout was returned to its original `main` state and is no longer used for this task.
- No branch was deleted; the feature branch is pushed to `origin` and checked out in this repository.
- All further work and evidence must stay under `/home/dci-student/projects/mays-xrepo-orchestration`.
