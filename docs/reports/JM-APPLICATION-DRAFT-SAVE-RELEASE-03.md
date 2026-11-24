# JM-APPLICATION-DRAFT-SAVE-RELEASE-03

**Status:** `PRODUCTION E2E VERIFIED`

**PR:** [#58](https://github.com/maynowak/mays-jobsearch/pull/58)

**Merge commit:** `3579ade12a1b6712cd0a09e8e06acf8a4ddb2e58`

**Feature head:** `b0ce8573c0b3037bc8b8af3a22dfcc7328462d32`

**Main base before merge:** `91f92a4`

## 1. Preflight

- `docs/AI_AUDITLOG.md` and `TESTING.md` read.
- PR #58: `MERGEABLE` / `CLEAN`.
- 9 changed files, 660 additions / 1 deletion; only the application draft
  fix, tests, report and audit were included.
- CodeQL: PASS.
- Vercel Preview deployments and Vercel Deployments check: PASS.
- Main and feature head were unchanged before merge.

## 2. Controlled merge

PR #58 was merged with the existing PR and exact head match:

`3579ade12a1b6712cd0a09e8e06acf8a4ddb2e58`

No force-push, no branch deletion and no foreign changes were introduced.

## 3. Production deployments

Automatic Vercel Git deployments completed without manual deployment:

| Project | Deployment | Status |
|---|---|---|
| `mays-jobsearch` | `dpl_4kSWT79fa48jST8DuXDQpkZ1C87M` | READY |
| `mays-job-matcher` | `dpl_8YJ8m2FoHvFWsBmNJFmcr8jGUAYD` | READY |

Both domains served the Production footer:

`Version 2.2.0 · production · main · 3579ade`

Public smoke:

- `/` — HTTP 200
- `/profil` — HTTP 200
- `/profil?tab=applications` — HTTP 200
- `/anmelden` — HTTP 200
- no console/page errors
- no horizontal overflow

## 4. Authenticated RIS E2E

The existing authenticated Chromium tab was used through the TESTING.md CDP
procedure. No token was copied and no new authentication architecture or
Cognito callback was added. Remote RIS application storage was active.

Synthetic manual draft:

- title: fallback `Initiativbewerbung` (title field left blank)
- company: `OpenCode Synthetic QA`
- location: empty
- original URL: empty
- description: synthetic

Observed result:

| Check | Result |
|---|---|
| BFF create | **2xx/201**, application returned |
| `applicationId` | `cb467798-dcf2-4ce0-88b6-fa6bcc0356c1` |
| `jobId` | `manual:59d996d5-d008-4880-8754-afe3893aca0b` |
| Status | `draft` |
| `job.location` | `[]` |
| `originalUrl` | absent |
| Draft in application overview | PASS |
| Reload / list from RIS | PASS, same application ID |
| Duplicate draft | none |
| AI / ATS / profile / cover-letter calls | **0** |
| Cleanup delete | **200** |
| After cleanup | 0 applications; synthetic record gone |
| Foreign applications | none changed |

The test dataset was removed through the existing application UI after
verification. No sensitive application content, tokens or credentials were
logged.

## 5. Contract result

RIS accepted the empty manual location representation without returning
`422`. No RIS contract change, workaround, placeholder location or invented
data was required.

## 6. Boundaries

- No RIS/AWS/Terraform/Cognito/Consent/Storage mutation.
- No Cognito callback changes or new credentials.
- No manual Vercel deployment.
- No additional Main push after this report.
- This documentation change is pushed on a separate documentation branch.

`PRODUCTION E2E VERIFIED`
