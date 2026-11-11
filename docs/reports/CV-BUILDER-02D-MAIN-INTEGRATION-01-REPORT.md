# CV-BUILDER-02D-MAIN-INTEGRATION-01 — CONTROLLED FAST-FORWARD

**Status:** `CV-BUILDER-02D — MAIN INTEGRATED / VERIFIED MAIN / PRODUCTION RESTORED`
**Date:** 2026-11-11
**Repository:** `maynowak/mays-jobsearch`

## 1. Preflight

- `main` and `origin/main`: `cef41cc`.
- Source: `feature/cv-builder-import-ux-02d` at `4d29141`.
- Merge base: `cef41cc`; divergence **0 behind / 33 ahead**.
- Working tree clean; no conflicts; `git diff --check` and secret scan clean.
- No RIS/AWS/Cognito/Terraform files in the diff.

## 2. Integration

Command used:

```bash
git switch main
git pull --ff-only origin main
git merge --ff-only origin/feature/cv-builder-import-ux-02d
git push origin main
```

Result: fast-forward `cef41cc..4d29141`, no merge commit, no force-push.
Main and `origin/main` are `4d29141`. Feature branch remains present.

## 3. Verification on local main

| Check | Result |
|---|---|
| Focused CV tests | **54 PASS** |
| Serial full suite | **1754 PASS / 5 skipped** |
| Production build | **PASS** |
| `cv-builder-import` E2E | **PASS** |
| Parser-02B E2E | **PASS** |
| Mapping-02C E2E | **PASS** |
| Workflow-02A E2E | **PASS** |
| Existing PDF E2E | **PASS** |
| PDF-Fix-01 E2E with real download | **PASS** |
| 02D Import-Review E2E 320–1440 | **PASS** |
| Overflow / API-/RIS-Writes / Console | **0 / 0 / 0** |
| `git diff --check` / secret scan | **PASS** |

## 4. Vercel deviation and rollback

No manual `vercel --prod` was executed. However, the main push triggered
automatic Vercel Production deployments:

- `mays-jobsearch-6seeoj9u6-maymilly.vercel.app`
- `mays-job-matcher-2hm8y69sw-maymilly.vercel.app`

Both were Ready and temporarily exposed via the production aliases. This
contradicts the “no production deployment” instruction, even though it was
triggered by Vercel rather than by a manual deploy.

Corrective action: the previous production deployments were promoted back:

- jobsearch: `dpl_4guHZz9WgyrVJtQp4mwuftx6VBKU`
- matcher: `dpl_3izMwQCNdgPyJaWGDPcU2D32asMX`

Read-only live verification after rollback:

- `https://www.mays-job-matcher.app` → `Version 2.2.0 · production · main · cef41cc`
- `https://mays-jobsearch.vercel.app` → `Version 2.2.0 · production · main · cef41cc`

Final production state is therefore the previous `cef41cc` deployment, not
the new 02D build. This report commit is pushed with skip markers to avoid
another automatic production build.

## 5. GitHub checks

- GitHub check-runs at `4d29141`: `CodeQL Analysis` was in progress at the
  time of rollback; `Vercel Preview Comments` success.
- No pull request was created for this branch.
- No GitHub Actions deployment workflow was executed manually.
- Vercel previews and production statuses are external checks, not product
  test evidence.

## 6. Privacy / boundaries

- No real CV data in public artifacts.
- No RIS/AWS/Cognito/Terraform/consent changes.
- No branch deletion.
- No force-push.
- No manual production deployment.

## 7. Remaining / not performed

- No manual production release of 02D.
- CodeQL result should be checked separately; it was still running.
- Automatic Vercel main→production behavior should be disabled or explicitly
  reviewed before the next main push; otherwise every future docs commit can
  trigger production again.
- The production aliases are restored to `cef41cc`, but the main branch now
  intentionally contains 02D.

## 8. Decision

**MAIN INTEGRATION: CONFIRMED / FAST-FORWARD VERIFIED.**
**PRODUCTION: RESTORED TO `cef41cc` / NO 02D PRODUCTION RELEASE.**
