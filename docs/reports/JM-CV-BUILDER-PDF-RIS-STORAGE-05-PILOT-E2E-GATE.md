# JM-CV-BUILDER-PDF-RIS-STORAGE-05 — PILOT E2E GATE

**Status:** `PILOT E2E BLOCKED / APPROVAL PENDING`

**Date:** 2026-11-15
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-cv-builder-pdf-ris-storage-01`
**Baseline:** `83332f1ef7848d7c4f89aacb77e34588cbb7afa2`

## 1. Gate result

The controlled live pilot E2E was **not started**.

No new formal Privacy/Legal confirmation of the existing `cv-storage` v1 scope for
builder-generated PDFs and no explicit test approval for a synthetic pilot identity/preview
environment were found in the repository or auditlog.

The prior operator decision (STORAGE-04) remains documented, but it is not treated as a
substitute for the two approvals required by this gate.

## 2. What is already approved / unchanged

| Item | Status |
|---|---|
| `cv-storage` purpose | unchanged |
| Text | `cv-storage-consent-2026-11-08-v1` |
| SHA-256 | `2fe65fd158a3a2953cf3869ff864aae626971012d68cfb8849db84e04579d036` |
| RIS notice | `cv-storage/1.0` |
| Notice state | `APPROVED` — limited beta pilot |
| `legalApprovalRef` | `JM-CV-STORAGE-V1-BETA-2026-11-08` |
| Pilot/allowlist | unchanged |
| Structured-CV flag | `false` |
| v2 consent | not active / not used |

The existing v1 approval covers the limited beta pilot generally but does not, by itself,
document the new generated-PDF interpretation or this particular live test run.

## 3. Missing approval 1 — formal Privacy/Legal confirmation

The exact point remains open:

> Does `cv-storage-consent-2026-11-08-v1` cover a PDF generated in the CV builder and explicitly
> saved by the user through the existing RIS CV storage, including the existing Art. 9
> declaration?

Required evidence:

- dated confirmation by the responsible Privacy/Legal authority;
- explicit reference to `cv-storage-consent-2026-11-08-v1`;
- explicit confirmation of generated PDFs and Art. 9 scope;
- confirmation that the existing limited pilot/allowlist remains the only scope.

Without this, no real-user processing and no live pilot E2E.

## 4. Missing approval 2 — test execution authorization

The following were not explicitly confirmed for this run:

- authorized synthetic pilot identity (issuer/sub) and its allowlist status;
- approved preview environment/deployment and commit;
- confirmation that the existing `cv-storage` v1 consent will be used;
- confirmation that `CV_STORAGE_CONSENT_ENFORCED=true` and the pilot allowlist are active;
- confirmation that RIS configuration is unchanged;
- test window/operator and cleanup ownership.

No identity, endpoint, token or allowlist value was used.

## 5. Prepared E2E sequence (not executed)

After both approvals, the controlled sequence is:

1. Sign in with the approved synthetic pilot identity.
2. Verify the existing `cv-storage` v1 consent.
3. Create a synthetic CV in the builder.
4. Click “In RIS speichern” exactly once.
5. Reload the page.
6. Verify the PDF in “Meine Lebensläufe”.
7. Download and verify the PDF.
8. Delete the PDF.
9. Verify deletion and clean up the synthetic consent/data.
10. Confirm `STRUCTURED_CV_PROFILE_ENABLED=false` throughout.

No real applicant data is permitted.

## 6. Current evidence status

| Check | Status |
|---|---|
| Local implementation | VERIFIED LOCAL (prior review) |
| Mock-BFF E2E | PASS (prior review) |
| Live pilot E2E | **NOT EXECUTED — BLOCKED** |
| Privacy/Legal confirmation | **PENDING** |
| Test identity/environment approval | **PENDING** |
| Production deployment | NOT AUTHORIZED |
| Main merge | NOT AUTHORIZED |

## 7. Boundaries

- No RIS rebuild or configuration change.
- No Terraform/AWS operation.
- No consent v2 activation.
- No Structured-CV activation.
- No real-user data.
- No main merge or production deployment.

## 8. Next action

Obtain and record the two missing approvals. Then run the prepared synthetic sequence in the
approved preview environment and record deployment ID, consent/notice state, API run evidence,
reload/list/download/delete results and cleanup.

**PILOT E2E BLOCKED / APPROVAL PENDING**

**STOP BEFORE LIVE E2E AND PRODUCTION DEPLOYMENT.**
