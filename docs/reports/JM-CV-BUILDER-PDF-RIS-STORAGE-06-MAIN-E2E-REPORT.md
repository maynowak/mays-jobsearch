# JM-CV-BUILDER-PDF-RIS-STORAGE-06 — MAIN INTEGRATION / E2E

**Status:** `MAIN INTEGRATED / TESTS PASS / MOCK E2E VERIFIED`

**Additional status:** `REAL RIS E2E PENDING`

**Date:** 2026-11-15
**Repository:** `maynowak/mays-jobsearch`
**Main HEAD:** `f4cb0a36ebb465ee9a4a60fd7e7835c5147b9a94`
**Previous main:** `a5640d12dba8ca39258484f5212def17eabf4eca`

## 1. Controlled main integration

The feature branch was verified clean, remote-synchronized and fast-forward capable against
`origin/main` before integration.

| Check | Result |
|---|---|
| Feature HEAD before merge | `f4cb0a3` |
| Main before merge | `a5640d1` |
| Fast-forward | yes |
| Force-push / rewrite | no |
| Main push | `a5640d1..f4cb0a3` |
| Main after merge | `f4cb0a3` |
| Working tree after merge | clean |

`vercel.json` has `git.deploymentEnabled.main=true`; the Release Owner explicitly instructed the
controlled merge. The resulting automatic Vercel Production deployment was verified, not assumed.

## 2. Main verification

Tests were run in a detached worktree at the actual integrated main commit:

| Check | Result |
|---|---|
| `npm ci` | PASS |
| `npm run build` | PASS |
| Full suite, serial (`--no-file-parallelism`) | **1882 PASS / 11 skipped** |
| Mock-BFF browser E2E | **PASS** |
| Browser save/reload/list/download/delete | PASS |

The browser E2E uses synthetic OIDC/session data and mocked `/api/ris/cvs` and
`/api/ris/cv-consents`; it is not a real RIS live test.

## 3. CI / Vercel / Production evidence

For main `f4cb0a3`:

- CodeQL Analysis: SUCCESS.
- Vercel Preview Comments: SUCCESS.
- Vercel `mays-jobsearch`: SUCCESS.
- Vercel `mays-job-matcher`: SUCCESS.
- Vercel Deployments – Maymilly: SUCCESS.

Production bundle verification:

- `https://www.mays-job-matcher.app/` returns `200`.
- The served asset `main-l3bemNCe.js` contains the new label **“In RIS speichern”**.
- The served bundle contains the build SHA `f4cb0a36ebb465ee9a4a60fd7e7835c5147b9a94`.
- No manual `vercel --prod` was executed; this was the automatic Git main deployment.

This confirms the new frontend action is present in Production. It does **not** confirm a real
RIS live storage write for a real user.

## 4. Privacy and pilot status

The merge was explicitly directed by the Release Owner. The existing `cv-storage` v1 contract
remains unchanged:

- `cv-storage-consent-2026-11-08-v1`
- SHA-256 `2fe65fd158a3a2953cf3869ff864aae626971012d68cfb8849db84e04579d036`
- RIS notice `cv-storage/1.0`
- limited beta pilot / existing allowlist
- v2 not active

**Formal Privacy/Legal confirmation of the generated-PDF interpretation and Art. 9 scope remains
open.** The existing server-side consent and pilot gates remain the protection boundary; no
general rollout is claimed.

## 5. Real RIS live E2E

**`REAL RIS E2E — BLOCKED / APPROVAL PENDING`**

Not executed because:

- the formal v1 scope confirmation is still open;
- no approved synthetic test identity/preview authorization was supplied;
- no real CV data was used.

The controlled live sequence remains the one in STORAGE-04/05:

1. approved synthetic identity;
2. existing `cv-storage` v1 consent;
3. builder CV creation;
4. explicit save;
5. reload/list;
6. download;
7. delete and cleanup;
8. `STRUCTURED_CV_PROFILE_ENABLED=false` throughout.

## 6. Findings

| Severity | Finding | Status |
|---|---|---|
| P1 | Formal Privacy/Legal confirmation of generated-PDF v1 scope/Art. 9 | OPEN |
| P1 | Real RIS live E2E and synthetic identity approval | NOT EXECUTED |
| P2 | Production action is now present under the existing pilot gates | OBSERVED / no general rollout |
| P3 | Existing upload has no network abort for session/consent withdrawal mid-flight | OPEN — pre-existing limitation |

No new consent version, RIS API, Terraform, AWS, DynamoDB or Structured-CV activation was added.

## 7. Git / release summary

- Main: `f4cb0a36ebb465ee9a4a60fd7e7835c5147b9a94`
- Integration commits include `5cd47eb`, `1e41e48`, `7b39e46`, `5d29217`, `7866d4e`, `3188708`, `20f842a`, `83332f1`, `8cd84c0`, `17eaf4b`, `f4cb0a3`.
- Docs branch: `docs/jm-cv-builder-pdf-ris-storage-06-main`.
- No force-push, no history rewrite, no RIS/AWS/Terraform change.
- No XRepo `COMPLETED`.

**MAIN INTEGRATED / TESTS PASS / MOCK E2E VERIFIED**

**REAL RIS E2E PENDING**
