# CV-BUILDER-02F-MAIN-RELEASE-01 — CONTROLLED MAIN INTEGRATION & PRODUCTION RELEASE

**Status:** `CV-BUILDER-02F — MAIN INTEGRATED / PRODUCTION DEPLOYED / LIVE VERIFIED`
**Date:** 2026-11-12
**Repository:** `maynowak/mays-jobsearch`
**Source:** `feature/cv-builder-02f-correction-01`
**Integrated commit:** `41923533589f59384e8d6af64aa134ac60160bb1`
**Main / origin/main:** `41923533589f59384e8d6af64aa134ac60160bb1`
**Baseline main:** `e894229c698b0253836d43659a16607815145062`
**Documentation branch:** `docs/cv-builder-02f-main-release-01` (not merged to main)
**Production:** both domains verified on `main · 4192353`

---

## 1. Governance

Read before work:

- `AGENTS.md`
- `docs/AI_AUDITLOG.md`
- `docs/DEVELOPMENT_WORKFLOW.md`

Baseline checks were read-only. The private reference PDF was not used in the
production smoke test. The production fixture uses only the fictional
`Nora Beispiel` / `nora.beispiel@example.invalid` data. No private PDF, contact
data, screenshot, secret or RIS credential was written to the repository.

## 2. Production baseline (before release)

| Project | Production deployment | Commit | Status | Effective domain |
|---|---|---|---|---|
| `mays-jobsearch` | `dpl_74mgG33mZBXeuQAZrCc6AEJJ7SGm` (`mays-jobsearch-h7ykwlugf-maymilly.vercel.app`) | `e894229` | READY | `mays-jobsearch.vercel.app` |
| `mays-job-matcher` | `dpl_82vUBrmEz6YfjdAw5qy75sfU2TPD` (`mays-job-matcher-36ify9fio-maymilly.vercel.app`) | `e894229` | READY | `www.mays-job-matcher.app` |

Both aliases resolved to those deployments. Both domains served the footer
`Version 2.2.0 · production · main · e894229` with zero console errors.
No unexpected rollback/promotion state was found. These two deployment IDs are
the recovery targets.

## 3. Git preflight

| Field | Value |
|---|---|
| `origin/main` | `e894229` |
| `origin/feature/cv-builder-02f-correction-01` | `4192353` |
| Merge-base | `e894229` |
| Divergence | 6 ahead / 0 behind |
| Fast-forward | possible |
| Feature working tree | clean |

Diff scope: **8 files**, all CV-import code/tests, reports and audit log.
No RIS, AWS, Cognito, Terraform, consent, Vercel-config or private-data changes.
`git diff --check` passed; secret/privacy scan found no private PDF or contact
data.

The earlier GitHub state mentioned by the task was 4 ahead / 0 behind / 7 files.
After the education provenance code and report commits, the release state was
**6 ahead / 0 behind / 8 files**.

## 4. Pre-release quality gate

Repeated on the release HEAD / source `4192353`:

| Check | Result |
|---|---|
| Focused parser/structure/editor tests | **71 PASS** |
| Serial full suite | **1777 PASS / 5 skipped** |
| TypeScript / production build | **PASS** |
| 02B / 02C / 02D E2E | **PASS** |
| PDF-Fix-01 / 02E E2E (320–1440 px) | **PASS** |
| Real PDF export in E2E | **PASS** |
| `git diff --check` | **PASS** |
| Secret/privacy scan | **PASS** |

## 5. Vercel check investigation

Release HEAD `4192353`:

- `Vercel – mays-jobsearch`: **success**
- `Vercel – mays-job-matcher`: **success**
- `Vercel Deployments – Maymilly`: **success**
- `Vercel Preview Comments`: **success**

Historical matcher preview check on `c67883a`:

- Overall commit status was **failure** because the matcher preview was
  **canceled from the Vercel Dashboard**.
- `vercel inspect dpl_AGyNPnZDKmKJRTDZKQGWjiVtQc2X` reported
  `readyState=CANCELED`, reason: **“The deployment was canceled because a newer
  deployment superseded it.”**
- The jobsearch deployment and Vercel Preview Comments for `c67883a` were
  successful.
- This is not evidence of a reproducible product or build failure. The later
  `4192353` preview checks succeeded. The later success is not used as an
  automatic explanation of the cancellation.

`main` has no branch protection and no rulesets. No required CodeQL check was
configured; no CodeQL run was observed. No branch protection was bypassed.

## 6. Main integration

Exactly one fast-forward integration and exactly one main push:

```text
e894229..4192353  main -> main
```

No merge commit, no rebase, no force-push, no additional main push, and no
manual `vercel --prod`.

Local `main` and `origin/main` both resolve to `4192353`.

## 7. Automatic production deployments

The single main push triggered both automatic Vercel production deployments.
No manual deployment was started.

| Project | Deployment ID | Deployment URL | Status | Commit |
|---|---|---|---|---|
| `mays-jobsearch` | `dpl_Etm24jySSS4Tx57q7szmDq2eGqAZ` | `mays-jobsearch-pkzrnb98a-maymilly.vercel.app` | READY | `4192353` |
| `mays-job-matcher` | `dpl_7dSXqX86hXU6dBYHfiDc4TakC5D1` | `mays-job-matcher-1bq40abuk-maymilly.vercel.app` | READY | `4192353` |

Domain aliases after deployment:

- `mays-jobsearch.vercel.app` → `dpl_Etm24jySSS4Tx57q7szmDq2eGqAZ`
- `www.mays-job-matcher.app` → `dpl_7dSXqX86hXU6dBYHfiDc4TakC5D1`
- `mays-job-matcher.app` → same matcher deployment

Both live pages serve the footer:

`Version 2.2.0 · production · main · 4192353`

## 8. Live smoke test

Synthetic 3-page PDF only. Both domains were checked separately.

| Check | jobsearch | matcher |
|---|---|---|
| `/`, `/profil`, `/datenschutz`, `/impressum` | 200 | 200 |
| DE / EN switch | PASS | PASS |
| Personal fields in editor | 4/4 | 4/4 |
| Education institution 1 / 2 | `Hochschule Musterstadt` / **empty** | same |
| Vocational institution after import | empty and reviewable | empty and reviewable |
| Review items | 6 | 6 |
| Skills candidates | 15 separate | 15 separate |
| Manual skill deselect/select | 15→14→15 | 15→14→15 |
| Project technologies | `Cognito, Lambda, SQS, Terraform`; `React, TypeScript, Vercel`; `OpenRouter, EdenAI` | same |
| Certification goals acquired | 0 | 0 |
| Editor/preview scroll | independent | independent |
| Mobile 390 px overflow | 0 px | 0 px |
| PDF export | valid `%PDF`, 2 pages | valid `%PDF`, 2 pages |
| API calls | only `GET /api/models` | only `GET /api/models` |
| RIS writes / non-GET API | none | none |
| Console errors | 0 | 0 |
| Secret-like value in DOM | none | none |

For the export path only, the intentionally blank synthetic vocational
institution was completed manually (`Berufsschule Musterstadt`) after the blank
state had been verified. That is the intended review/edit workflow, not an
institution inference.

## 9. Privacy

- Production smoke used only fictional data.
- Private reference PDF was not uploaded, displayed or committed.
- No RIS write, no `POST`/`PUT`/`PATCH`/`DELETE` API request and no PDF upload
  request was observed.
- No private contact data or screenshots were committed.
- No AWS/Cognito/Terraform/consent change was made.
- Automatic Git/Vercel deployments remain enabled.

## 10. Recovery targets

| Project | Last verified pre-release deployment | Commit |
|---|---|---|
| `mays-jobsearch` | `dpl_74mgG33mZBXeuQAZrCc6AEJJ7SGm` | `e894229` |
| `mays-job-matcher` | `dpl_82vUBrmEz6YfjdAw5qy75sfU2TPD` | `e894229` |

No rollback was necessary.

## 11. Deviations and open points

- The first internal smoke harness assumed the modal would expose contact
  values directly and treated React as a skill. The modal collapses contact
  details and React is project technology, not a skill; the harness was
  corrected to verify editor fields and project technologies. No product
  change was made.
- The `c67883a` matcher preview was externally canceled/superseded, not a
  reproducible build failure. Its cause is documented above.
- No CodeQL check exists for this feature; `main` is unprotected and has no
  required ruleset.
- No second main push was made. This report and audit update are on
  `docs/cv-builder-02f-main-release-01`, not `main`.
- Feature branch remains intact.

**FINAL STATUS:**
`CV-BUILDER-02F — MAIN INTEGRATED / PRODUCTION DEPLOYED / LIVE VERIFIED`
