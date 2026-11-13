# JM-RIS-STRUCTURED-CV-CONSENT-READINESS-01

**Status:** `CONSENT LIFECYCLE TECHNICALLY PREPARED / LEGAL APPROVAL REQUIRED`

**Date:** 2026-11-13

**Branch:** `feature/jm-ris-structured-cv-consent-readiness-01`

**Baseline:** `52b6786`

## Result

Created the technical consent lifecycle specification
`docs/consent/STRUCTURED-CV-CONSENT-READINESS-01.md` and a read-only
classification module:

- `src/lib/cvBuilder/structuredCvConsentReadiness.ts`
- `src/lib/cvBuilder/structuredCvConsentReadiness.test.ts`

The module distinguishes loading, error, missing, DRAFT, granted, withdrawn and
unknown states and permits writes only for a granted consent under an approved
notice. It does not grant, withdraw or invent a notice version.

## Existing vs missing

Existing: read-only status via `getStructuredCvConsentStatus()`, RIS consent
contract/repository, DRAFT fail-closed, BFF grant/withdraw block, approved
notice-gated durable UI.

Missing and intentionally not implemented: production grant/withdraw endpoints
for structured CV, approved notice/legal reference, final consent dialog and
Art. 9 attestation, post-withdrawal policy, authenticated production consent E2E.

## Tests

Focused classifier tests: **5 passed** (missing/loading/error, DRAFT,
approved mock, granted, withdrawn, NOT_GRANTED, unknown and future ACTIVE notice).
No real RIS consent mutation was performed.

## Release gates

Human legal/privacy approval, approved notice version/hash, consent UI review,
withdrawal/export/delete policy, and approved test identities remain required.
No DRAFT grant or production consent activation exists.

## Commit

Committed on `feature/jm-ris-structured-cv-consent-readiness-01`.
