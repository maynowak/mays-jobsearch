# CV-BUILDER-02E-MAIN-RELEASE-01 — CONTROLLED MAIN INTEGRATION & LIVE RELEASE

**Status:** `CV-BUILDER-02E — MAIN INTEGRATED / PRODUCTION DEPLOYED / LIVE VERIFIED`
**Date:** 2026-11-11
**Repository:** `maynowak/mays-jobsearch`
**Main:** `e894229`
**Product/Test head:** `07e1450`
**Source branch:** `feature/cv-builder-real-world-qa-02e` at `e894229` (retained)

## 1. Production baseline before mutation

| Item | Value |
|---|---|
| Live production commit | `78c0a7b` |
| jobsearch production deployment | `7716009586` / `https://mays-jobsearch-aa1phkq86-maymilly.vercel.app` |
| matcher production deployment | `7716021731` / `https://mays-job-matcher-iqnd5rq7y-maymilly.vercel.app` |
| jobsearch domain | `https://mays-jobsearch.vercel.app` |
| matcher domain | `https://www.mays-job-matcher.app` |
| Auto domain assignment | active; both domains served `78c0a7b` |
| Rollback state | none active at start |

Previous production deployments retained as recovery targets:

| Project | Previous production deployment | Commit |
|---|---|---|
| jobsearch | `7713302555` / `https://mays-jobsearch-nt5ml2qb8-maymilly.vercel.app` | `6de0d77` |
| matcher | `7713306345` / `https://mays-job-matcher-4x29jb0at-maymilly.vercel.app` | `6de0d77` |

No configuration was changed during the baseline check.

## 2. Preflight and merge

- `origin/main` before release: `78c0a7b`.
- Source: `e894229`; merge-base `78c0a7b`.
- Divergence: **0 behind / 8 ahead** (the eighth commit is the final
  documentation/audit commit `e894229`; product/test head is `07e1450`).
- Working tree clean; merge scope only 02E source/tests/docs/assets; no
  unexpected files or secrets.
- Fast-forward: `78c0a7b..e894229`, no merge commit.
- Exactly one `git push origin main`: `78c0a7b..e894229`.
- `main` = `origin/main` = `e894229`; feature branch retained.

## 3. Release verification before push

| Check | Result |
|---|---|
| Focused CV tests | **61 PASS** |
| Serial full suite | **1767 PASS / 5 skipped** |
| TypeScript / production build | **PASS** |
| Import-01A E2E | **PASS** |
| Parser-02B E2E | **PASS** |
| Mapping-02C E2E | **PASS** |
| Import-UX-02D E2E | **PASS** |
| Workflow-02A E2E | **PASS** |
| PDF export with real download | **PASS** |
| PDF-Export-Fix-01 E2E | **PASS** |
| 02E real-world E2E 320–1440 | **PASS** |
| `git diff --check` / secret & privacy scan | **PASS** |
| Overflow / API-/RIS-writes / console | **0 / 0 / 0** |

## 4. Automatic Vercel Production release

No manual `vercel --prod` was executed.

| Project | GitHub deployment | Vercel deployment | Environment | Commit | Status |
|---|---|---|---|---|---|
| jobsearch | `7718729604` | `https://mays-jobsearch-h7ykwlugf-maymilly.vercel.app` | Production | `e894229` | **success / READY** |
| matcher | `7718741865` | `https://mays-job-matcher-36ify9fio-maymilly.vercel.app` | Production | `e894229` | **success / READY** |

Aliases verified:

- `https://mays-jobsearch.vercel.app`
- `https://www.mays-job-matcher.app`

Build identity:

**Git main `e894229` → Vercel deployment commit `e894229` → Footer `e894229`**

GitHub check-runs for `e894229`: CodeQL **success**, Vercel Preview Comments
**success**. Commit statuses: jobsearch, matcher and Vercel deployments
**success**.

No second manual production pipeline and no extra main documentation push
were used.

## 5. Live smoke test

Synthetic CV only; no real user data, no RIS writes.

| Check | Result |
|---|---|
| matcher `/` | 200 |
| jobsearch `/` | 200 |
| `/profil` | 200 |
| `/datenschutz` | 200 |
| `/impressum` | 200 |
| Footer matcher | `Version 2.2.0 · production · main · e894229` |
| Footer jobsearch | `Version 2.2.0 · production · main · e894229` |
| DE interface | **PASS** |
| EN interface | **PASS** |
| Synthetic PDF import | **PASS** |
| Personal fields (name/location) | **PASS** |
| Skills / certificate-goal review | **PASS** |
| Import summary + apply | **PASS** |
| Desktop editor/preview independent scroll | **PASS** |
| Mobile 390 px / no overflow | **PASS** |
| Session save | **PASS** |
| Actual PDF download | **PASS**, valid PDF, 2 pages |
| Console/server errors | **0** |
| Secret text in DOM | **none** |

## 6. Recovery status

No rollback was needed. The previous recovery deployments remain documented
above and unchanged. The feature branch remains available; no branch was
deleted.

## 7. Documentation branch

This report and the audit log update are committed on
`docs/cv-builder-02e-main-release-01`, not on `main`, to avoid a second
automatic Production deployment. A later documentation release can merge this
branch through a separate controlled Git release.

## 8. Open points

- `main` is already integrated; no further main push is part of this report.
- Production domains are live on `e894229`.
- No manual production deployment, no force-push, no RIS/AWS/Cognito/Terraform
  or consent changes, no real CV data.
- Auto Git/Vercel builds remain enabled.

**FINAL: CV-BUILDER-02E — MAIN INTEGRATED / PRODUCTION DEPLOYED / LIVE VERIFIED**
