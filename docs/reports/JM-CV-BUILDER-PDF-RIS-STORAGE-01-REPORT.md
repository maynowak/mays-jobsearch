# JM-CV-BUILDER-PDF-RIS-STORAGE-01

**Status:** `IMPLEMENTED / VERIFIED LOCAL / RELEASE REVIEW PENDING`

**Date:** 2026-11-14
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-cv-builder-pdf-ris-storage-01`
**Baseline:** `origin/main` `a5640d12dba8ca39258484f5212def17eabf4eca`

## 1. Scope correction

This change reuses the existing CV-document storage. It does not add a Structured-CV
profile backend. RC1/RC2, RIS, Terraform, AWS, DynamoDB, API Gateway and consent
contracts are unchanged.

The existing storage accepts a PDF document through:

`createCvDocument → requestCvUpload → uploadCvBytes → completeCvUpload`

## 2. Implemented UI

- New explicit action **„In RIS speichern“** beside the existing PDF download.
- The existing PDF download remains unchanged and is not coupled to saving.
- The builder generates the PDF with the existing `createCvBuilderPdf()` and derives
  the filename with the existing `cvBuilderFileName()`.
- The PDF bytes are wrapped as `File(..., "application/pdf")`.
- The existing `validateCvFile()` guard runs before the upload.
- The existing `persistentCvStorage.upload(file)` path performs the actual storage.
- Duplicate clicks are blocked while the PDF is generated/uploaded.
- The modal editor and fullpage workspace use the same optional callback.

No direct AWS, Cognito, credential or RIS API access was added to the editor.

## 3. Reused API and state

| Existing component | Reused |
|---|---|
| `/api/ris/cvs` | unchanged |
| `cvStorageApi.ts` | unchanged |
| `usePersistentCvStorage.ts` | unchanged upload/consent/capacity path |
| `cvFileValidation.ts` | unchanged PDF/10 MB/empty checks |
| `pdfExport.ts` | unchanged PDF generation |
| `cv-storage` consent | unchanged purpose and notice |
| „Meine Lebensläufe“ | existing persistent CV list |

The new `useCvBuilderPdfRisStorage` hook only derives UI status and delegates to
`persistentCvStorage.upload`; it does not implement a second uploader.

## 4. Authentication and status

Saving is available only with:

- verified identity (`iss` + `sub`);
- `VITE_RIS_CV_STORAGE_ENABLED`;
- existing `cv-storage` consent with status `GRANTED`;
- existing pilot identity access;
- free capacity below 10 CVs;
- valid PDF file.

The status messages cover signed-out, storage unavailable, consent required, loading and
capacity reached. No token is passed through the editor or between windows.

## 5. Fullpage workspace

`CvBuilderWorkspacePage` uses its own authenticated `useAuth` context and the same
`usePersistentCvStorage`/`useCvBuilderPdfRisStorage` path. No cross-window token handoff
was introduced. Unauthenticated direct/fullpage use keeps the RIS save action disabled.

## 6. File and privacy boundaries

- Maximum file size: 10 MB, existing `MAX_CV_FILE_SIZE_BYTES`.
- MIME: `application/pdf`.
- Empty files rejected.
- Existing consent/capacity/validation errors remain authoritative.
- UI copy now distinguishes local PDF download from explicit RIS saving.

**Privacy open point:** the existing `cv-storage` consent text refers to the uploaded CV
file and Art. 9 categories. Whether a builder-generated PDF is explicitly covered by that
wording must be confirmed by Privacy/Legal. The consent text was **not** changed silently.
If the wording must change, notice version, hash, RIS contract and approval flow must be
updated in a separate decision.

## 7. Tests

| Check | Result |
|---|---|
| New focused component/hook tests | **20 PASS** |
| Full Jobsearch suite | **1879 PASS / 11 skipped** |
| Production build | PASS |
| Mock-BFF E2E: create → upload → complete → success | **PASS** |
| Real auth/RIS live E2E | NOT EXECUTED |
| Production deployment | NOT EXECUTED |

The mock E2E uses a synthetic OIDC session and mocked `/api/ris/cvs` and
`/api/ris/cv-consents`; it verifies the existing three-step storage flow and the new
explicit action. No real RIS request was made.

## 8. Git

- Implementation: `5cd47eb`
- Report/audit: docs commit follows this report.
- No main merge, push to main, deployment, tag or production action.
- Branch is ready for review/push separately.

## 9. Open items

1. Privacy/Legal confirmation whether generated PDFs are covered by the current
   `cv-storage` text.
2. If not, a separately approved notice-version/consent update is required before
   activating this flow for real users.
3. Live E2E requires an authorized synthetic pilot identity and confirmed consent scope.
4. No automated production release.

**JM-CV-BUILDER-PDF-RIS-STORAGE-01 — IMPLEMENTED / VERIFIED LOCAL / RELEASE REVIEW PENDING**
