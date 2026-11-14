# JM-CV-BUILDER-PDF-RIS-STORAGE-02 — RELEASE REVIEW

**Status:** `JM-CV-BUILDER-PDF-RIS-STORAGE-02 — TECHNICAL REVIEW VERIFIED / PRIVACY APPROVAL PENDING`

**Date:** 2026-11-14
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-cv-builder-pdf-ris-storage-01`
**Reviewed HEAD:** `7866d4edc7b02a876747e91285c291bf59947a0a`
**Baseline:** `origin/main` `a5640d12dba8ca39258484f5212def17eabf4eca`

## 1. Independent technical review

Reviewed against `origin/main`:

- `CvBuilderEditor.tsx`
- `CvBuilderWorkspacePage.tsx`
- `useCvBuilderPdfRisStorage.ts`
- `usePersistentCvStorage.ts`
- `App.tsx`
- `cvStorageApi.ts`
- `cvFileValidation.ts`

### Confirmed reuse

The feature uses the existing chain:

`createCvDocument → requestCvUpload → uploadCvBytes → completeCvUpload`

No parallel upload implementation was introduced. No new RIS API, BFF route, Terraform, AWS,
DynamoDB, GSI, API Gateway, consent purpose or Structured-CV activation exists in the diff.

The existing PDF download path is independent:

- Download calls only `createCvBuilderPdf` + `downloadCvBuilderPdf`.
- Save calls `createCvBuilderPdf` + existing `persistentCvStorage.upload`.
- A save failure does not suppress or replace the download action.
- The new action appears only when an authenticated storage callback is supplied.

## 2. Authentication and isolation findings

### Fixed — stale callback could start after identity change (P2)

An old `onSavePdfToRis` callback could finish PDF generation after an auth transition and invoke
the previous storage closure. The hook now compares the identity captured when the callback was
created with the current identity key **before** starting the upload, and again after completion.
The old callback returns `false` and does not start `storage.upload`.

Regression: `useCvBuilderPdfRisStorage.test.tsx` covers the old-callback-after-switch case.

### Fixed — parallel saves (P2)

- The builder blocks repeated clicks while a PDF save is in flight.
- The new hook serializes saves from the same authenticated context.
- The existing storage hook now has an in-flight guard so two calls cannot both create a CV.

Regression: new hook and builder tests cover serialization.

### Fullpage workspace

`CvBuilderWorkspacePage` uses its own `useAuth` context and the same
`usePersistentCvStorage`/`useCvBuilderPdfRisStorage` path. No token is passed between windows.
Without a verified identity the action is disabled. With a valid handoff/identity it uses the
same guarded callback. Direct unauthenticated fullpage use remains disabled.

### Residual limitation

The existing storage upload has no network abort. If an upload has already started and the
session ends or consent is withdrawn mid-flight, the server may still finish the old request
under the token that was valid at start. The new hook will not report success after an identity
change, and the old token cannot store into a different user's account. A future hardening task
could add abort/consent-invalidation semantics; it is not a cross-user storage path.

## 3. Test evidence

| Check | Result |
|---|---|
| Focused builder/hook/storage review tests | **26 PASS** |
| Full Jobsearch suite (final run) | **1882 PASS / 11 skipped** |
| Production build | PASS |
| Mock-BFF E2E create → upload → complete → success | PASS |
| Real RIS/live E2E | NOT EXECUTED |
| Production deployment | NOT EXECUTED |

The mock E2E uses a synthetic OIDC session and mocked `/api/ris/cvs` and
`/api/ris/consents` responses. It verifies one create, one presigned upload, one complete and
the success message; no real RIS request was made.

A transient unrelated `ManualSearchProfiles.integration.test.tsx` failure occurred in one
parallel full-suite run and passed in isolation and in the final full run.

## 4. Privacy decision template

**Purpose remains `cv-storage`; no new purpose is proposed.**

| Question | Current evidence | Decision required |
|---|---|---|
| Does “uploaded CV file” cover a generated PDF? | Existing consent UI wording refers to an uploaded CV file; the builder generates a PDF locally | Privacy/Legal must confirm or approve wording “uploaded or created” |
| Is the storage purpose unchanged? | Durable storage of one CV PDF, download and deletion | Confirm |
| Are data categories complete? | Same CV content, metadata and possible Art. 9 categories | Confirm |
| Is Art. 9 consent sufficient? | Existing `cv-storage` includes special-category consent | Confirm scope for generated PDFs |
| Retention/deletion | Existing CV storage rules | Confirm |
| Pilot/allowlist | Existing pilot/allowlist remains in force | Confirm; no general rollout |

### If wording must change

- Prepare a new notice version, not an edit of the approved version.
- Record the new SHA-256 and BFF/RIS mapping.
- Preserve the old approved version and existing grants.
- Do not activate the new notice without a separate Privacy/Legal decision and deployment
  authorization.

The consent text and notice were **not** changed in this task.

## 5. Release findings

| Severity | Finding | Status |
|---|---|---|
| P1 | Consent wording may not explicitly cover builder-generated PDFs | OPEN — Privacy/Legal |
| P2 | Stale callback could start after identity change | FIXED `7b39e46` |
| P2 | Parallel saves could race | FIXED `5d29217` |
| P2 | Upload error was cleared by post-failure refresh | FIXED `7866d4e` |
| P3 | No network abort for session/consent withdrawal during in-flight upload | OPEN — existing limitation, no cross-user path |
| P3 | Live RIS E2E not executed | OPEN — requires privacy/test approval |

No remaining technical release blocker was found for the local frontend implementation.

## 6. Release recommendation

**A — TECHNICALLY READY / PRIVACY APPROVAL PENDING.**

- Technical implementation: verified locally.
- Mock E2E: PASS.
- Production build: PASS.
- Privacy/legal: approval pending, specifically the scope of the existing `cv-storage` wording.
- No production deployment or main merge.
- No RIS/AWS/Terraform/consent-contract change.

After Privacy/Legal approval and separate live-test authorization, run the synthetic
PDF → save → reload → find → download → delete E2E against the pilot identity.

## 7. Git commits

- `5cd47eb` — initial PDF storage implementation
- `1e41e48` — implementation report/audit
- `7b39e46` — identity callback and upload concurrency hardening
- `5d29217` — same-context save serialization
- `7866d4e` — preserve failed-upload error and failure-path coverage
- Review docs commit follows this report.

**JM-CV-BUILDER-PDF-RIS-STORAGE-02 — TECHNICAL REVIEW VERIFIED / PRIVACY APPROVAL PENDING**
