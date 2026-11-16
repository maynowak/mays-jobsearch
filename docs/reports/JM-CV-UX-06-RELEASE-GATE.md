# JM-CV-UX-06 — Integration & Release Gate

**Status:** `READY FOR OWNER APPROVAL`

- **PR:** [#25](https://github.com/maynowak/mays-jobsearch/pull/25) — OPEN, not draft
- **Branch:** `feature/jm-cv-ux-06-navigation-drafts`
- **Product commit:** `b2d1e755773623dbc0bc98c6b4c7396e29f69e1c`
- **Release-gate docs commit:** `a8f7c9462296fa715ca42783ca6a1a659cb50955`
- **Base:** `origin/main` @ `154c698`
- **Divergence:** product commit 1 ahead, 0 behind; gate docs add one docs-only commit
- **Mergeability:** `MERGEABLE` / `CLEAN`
- **Review:** owner approval pending

## Scope

Feature diff vs `origin/main`: **15 files**, CV-builder frontend, DE/EN UI strings, tests, E2E and documentation.

- No `api/**`, `infra/**`, `.github/**`, RIS, AWS, Terraform, Cognito, consent-gate, ATS/matching or translation-pipeline changes.
- `git diff --check`: clean.
- Secret scan of the feature diff: no key/token/credential patterns found.

## Verification

| Gate | Result |
|---|---|
| Full suite `npx vitest run --maxWorkers=2` | **1934 passed / 11 skipped**, 0 failed, 180 files passed |
| Build `npm run build` | **PASS**, 1.44 s |
| Existing UX-06 browser E2E | **PASS** at product commit `b2d1e75` |
| Existing 03A full-page workspace E2E | **PASS** at product commit `b2d1e75` |
| Diff / whitespace / secret audit | **PASS** |

Existing browser evidence was reused; no new tests were added for this gate. UX-06 evidence covers two real tabs, clean/dirty X, return + tab close, blocked `window.close()`, missing main window, direct workspace and 0 page/console errors. Evidence: `docs/reports/assets/JM-CV-UX-06/`.

## Vercel Preview

Both PR previews were READY at product commit `b2d1e75` and re-ran successfully for the docs-only release-gate commit `a8f7c94`:

| Project | Product commit preview | Docs-head preview | Final HTTP |
|---|---|---|---|
| `mays-job-matcher` | `dpl_CLmdCwvkMLhM66D9L1x7sZSxdm8s` | `dpl_2MozcnZJ1RTLYxwL3qziX7N4QYTn` | 200 |
| `mays-jobsearch` | `dpl_6UVVBXDyVdauC2nVjqTACqoudZws` | `dpl_6EVU152rBmSeerrGCvd19uLDVW2Q` | 200 |

Vercel metadata matches branch `feature/jm-cv-ux-06-navigation-drafts`, PR #25 and the respective SHA. Subsequent docs-only commits after `a8f7c94` do not change the tested product code; the PR checks re-run per head.

## CodeQL

- **CodeQL Analysis (javascript-typescript, none): SUCCESS** — 2m59s at product commit `b2d1e75`; 4m29s at docs-head commit `a8f7c94`.
- Auxiliary GitHub check `CodeQL`: **NEUTRAL/skipping** with warning that two historical configurations on `main` (`/language:javascript`, `/language:typescript`) were not found. The same neutral result existed on already-merged PR #22; the actual CodeQL analysis job is green and PR merge state is `CLEAN`.
- This is recorded as a pre-existing repository configuration warning, not a new feature failure.

## Gate Decision

**READY FOR OWNER APPROVAL.** No main merge, no production deployment and no branch deletion were performed. After approval, merge PR #25 and deploy production separately only under the owner's release instruction.
