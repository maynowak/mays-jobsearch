# JM-RELEASE-DOCS-CONSOLIDATION-02

**Status: READY FOR DOCUMENTATION MERGE REVIEW**

- Repository: `maynowak/mays-jobsearch`
- Main basis: `ee2ce6f2ec86e4dad76eeb5670505eb983df5fb3`
- Integration branch: `docs/jm-release-docs-consolidation-02`
- No product code, API, RIS, AWS, Terraform, Cognito, consent or deployment change.

## 1. Consolidated documentation

The following release reports were missing on `main` and are included:

| Source branch | HEAD | Adopted report |
| --- | --- | --- |
| `docs/jm-application-edit-tab-navigation-01-release` | `c79e480` | `docs/reports/JM-APPLICATION-EDIT-TAB-NAVIGATION-01-CONTROLLED-MAIN-RELEASE.md` |
| `docs/jm-doc-release-01` | `81803b3` | `docs/reports/JM-DOC-RELEASE-01-PRODUCTION.md` |
| `docs/jm-job-details-translation-hotfix-01-release` | `b783e3f` | `docs/reports/JM-JOB-DETAILS-TRANSLATION-HOTFIX-01-PRODUCTION.md` |
| `docs/jm-security-codeql-release-01` | `cc65290` | `docs/reports/JM-SECURITY-CODEQL-RELEASE-01-REPORT.md` |
| `docs/jm-ux-consolidated-release-01-production` | `414ee0b` | `docs/reports/JM-UX-CONSOLIDATED-RELEASE-01-PRODUCTION.md` plus its eight production screenshots |
| `docs/xrepo-parallel-analysis-01` | `0df5f3a` | `docs/reports/XREPO-PARALLEL-ORCHESTRATION-01-REPORT.md` |

## 2. Release chronology and SHAs

Newest first, as reflected in the audit log:

| Release | Merge / production SHA | Documentation |
| --- | --- | --- |
| Translation hotfix PR #70 | `ee2ce6f` | `JM-JOB-DETAILS-TRANSLATION-HOTFIX-01-PRODUCTION.md` |
| Translation hotfix PR #69 | `776112b` | audit entry in `cc65290`; report context in the security release |
| Security/CodeQL PR #68 | `b4157e5` | `JM-SECURITY-CODEQL-RELEASE-01-REPORT.md` |
| XREPO parallel analysis | analysis baseline `aa57500` / RIS `97a60df` | `XREPO-PARALLEL-ORCHESTRATION-01-REPORT.md` |
| Documentation release PR #67 | `aa57500` | `JM-DOC-RELEASE-01-PRODUCTION.md` |
| UX consolidated release PR #66 | `df1fe01` | `JM-UX-CONSOLIDATED-RELEASE-01-PRODUCTION.md` |
| Application edit release PR #65 | `e92d78b` | `JM-APPLICATION-EDIT-TAB-NAVIGATION-01-CONTROLLED-MAIN-RELEASE.md` |

These are historical report identities, not competing current production claims. The current production SHA at consolidation time is `ee2ce6f`.

## 3. Already integrated / de-duplicated

Already on `main` before this consolidation, or included in an adopted report only once:

- `JM-SECURITY-CODEQL-REMEDIATION-01` audit entry and its feature report.
- `JM-DOCUMENTATION-CONSOLIDATION-01` entry and README/docs consolidation.
- `JM-UX-CONSOLIDATED-RELEASE-01` integration entry; only the later **production** report is newly adopted.
- `JM-JOB-DETAILS-TRANSLATION-HOTFIX-01` feature entry; only the later **production release** entry is newly adopted.
- `JM-APPLICATION-EDIT-TAB-NAVIGATION-01` feature entry; only the later **controlled main release** report is newly adopted.

The security docs branch contained three audit blocks: two missing (`JM-TRANSLATION-JSON-UNWRAP-01`, `JM-SECURITY-CODEQL-RELEASE-01`) and one already present (`JM-SECURITY-CODEQL-REMEDIATION-01`). Only the two missing blocks were merged; the remediation block was **not duplicated**.

No empty or duplicate documentation commits were created.

## 4. Security / CodeQL wording

The consolidated documentation distinguishes:

- **PR #68** (`b4157e5`): security/CodeQL remediation release. Its production verification was
  `PRODUCTION VERIFICATION FAILED — HOTFIX REQUIRED` because translation showed raw JSON.
- **PR #69** (`776112b`): first translation hotfix. CodeQL report at that time:
  - active `/language:javascript-typescript` category: **0 open findings**;
  - retired `/language:javascript` category: **21 legacy alerts** remain open;
  - no dismissals.
- **PR #70** (`ee2ce6f`): additional strict translation hardening. Parser additionally
  fails closed for truncated wrappers and avoids silent >30k truncation; live provider
  translation remained pending (`model_unavailable`).

There is no blanket claim that GitHub has zero open alerts.

## 5. XREPO Jobsearch ↔ RIS

The XREPO report preserves the two-repository boundary:

- Jobsearch owns frontend/BFF and Jobsearch-side contract adapters.
- RIS is a separately operated service; its internals and AWS resources are not
  part of this repository.
- Open P0 gaps remain: the RIS-main erasure lifecycle lacks
  search-profile/CV-metadata deletion, and RIS accepts a `cv-storage` grant
  without Art. 9 proof at the service layer.
- RIS repository was **not modified** by this consolidation.

## 6. Checks

| Check | Result |
| --- | --- |
| Markdown/relative link check | see validation below |
| Screenshot paths | present |
| `git diff --check` | PASS |
| Secret-pattern scan | clean |
| Product code changes | none |
| Duplicate audit entries | none |
| Conflicting current SHA claims | none; chronology documented above |

## 7. Known limitations / remaining gaps

- These reports are historical; they are not rewritten to the final production SHA.
- The live translation provider check remains pending from the PR #70 release.
- The XREPO P0 erasure/consent gaps are documented, not implemented here.
- No RIS, AWS, Terraform, Cognito, consent or deployment change.
- PR #1 and old draft consent/xrepo docs PRs are outside this consolidation.

`JM-RELEASE-DOCS-CONSOLIDATION-02 — READY FOR DOCUMENTATION MERGE REVIEW`
