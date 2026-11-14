# JM-CV-BUILDER-PDF-RIS-STORAGE-04 — OPTION A DECISION

**Status:** `EXISTING V1 SCOPE DOCUMENTED / PILOT E2E READINESS`

**Date:** 2026-11-14
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-cv-builder-pdf-ris-storage-01`
**Feature HEAD:** `20f842ae92536fea6b0ebe8575420cf0866fa2ef`

## 1. Operator decision

The operator has decided that the existing `cv-storage` v1 consent should remain in use for
builder-generated PDF snapshots because the storage purpose is unchanged. No new consent version
is desired for this PDF-snapshot use case.

This is a product/operator interpretation. It is **not** a new formal Privacy/Legal opinion and
does not change any consent text, notice or hash.

## 2. Existing v1 contract remains unchanged

| Field | Value |
|---|---|
| Purpose | `cv-storage` |
| Text version | `cv-storage-consent-2026-11-08-v1` |
| SHA-256 | `2fe65fd158a3a2953cf3869ff864aae626971012d68cfb8849db84e04579d036` |
| RIS notice | `cv-storage/1.0` |
| Notice state | `APPROVED` — limited beta pilot |
| `legalApprovalRef` | `JM-CV-STORAGE-V1-BETA-2026-11-08` |
| Pilot/allowlist | unchanged |

No text, hash, notice, purpose or consent record was changed.

## 3. Interpretation documented

The relevant v1 wording uses “hochgeladener Lebenslauf”. For this feature, “uploaded” is read as
the transfer of the explicitly selected PDF into the existing RIS CV document store, not as a
requirement that the file had to originate outside the application.

The unchanged processing facts support that interpretation:

- the user explicitly clicks “In RIS speichern”;
- the same RIS CV document store is used;
- the same document metadata is processed;
- the same deletion, withdrawal and retention rules apply;
- the same Art. 9 categories can be present;
- no structured builder profile is stored;
- no new purpose or processor is introduced.

**Formal Privacy/Legal confirmation remains open.** The exact open point is:

> Does `cv-storage-consent-2026-11-08-v1` cover a PDF that is generated in the CV builder and
> then explicitly saved by the user through the existing RIS CV storage, including the existing
> Art. 9 declaration?

Until that confirmation is recorded, the feature remains technically ready but not cleared for
real-user processing.

## 4. v2 preparation stopped

The previously prepared v2 draft (`cv-storage-consent-2026-11-14-v2`, draft SHA-256
`7baee3ce…`) is **not used** for this PDF-snapshot use case and is not active.

Consequences:

- no v1 text/hash/notice change;
- no v2 activation;
- no new consent purpose;
- no BFF/RIS mapping change;
- existing grants and the limited pilot remain valid.

A future structured-CV profile storage feature, if it introduces a genuinely different purpose,
would still require its own separate privacy decision.

## 5. Controlled synthetic pilot E2E — readiness only

This is a prepared runbook, not an executed test.

### Preconditions

- approved synthetic pilot identity only;
- existing `cv-storage` v1 consent `GRANTED`;
- existing pilot allowlist unchanged;
- `VITE_RIS_CV_STORAGE_ENABLED=true` in the authorized preview environment;
- RIS `CV_STORAGE_CONSENT_ENFORCED=true`;
- `STRUCTURED_CV_PROFILE_ENABLED=false`;
- separate authorization for live E2E and test identity;
- no production deployment.

### Test sequence

1. Sign in with the approved synthetic identity.
2. Grant the existing `cv-storage` v1 consent.
3. Open the CV builder and create a synthetic CV.
4. Click “In RIS speichern” exactly once.
5. Verify the success message only after create/upload/complete.
6. Reload the page.
7. Verify the PDF appears in “Meine Lebensläufe”.
8. Download it and verify the PDF.
9. Delete it and verify it disappears.
10. Verify no structured-CV profile route or flag was activated.
11. Clean up the synthetic identity/data and record the consent withdrawal.

### Evidence to record

- preview deployment ID and branch/commit;
- synthetic identity scope (issuer/sub) without exposing secrets;
- consent status and notice version;
- create/upload/complete request status and run IDs;
- reload/list/download/delete results;
- cleanup result;
- no real applicant data.

**Live E2E status: NOT EXECUTED.**

## 6. Remaining gates

| Gate | Status |
|---|---|
| Existing v1 scope documented | DONE |
| Formal Privacy/Legal confirmation | OPEN |
| Synthetic pilot identity authorization | OPEN |
| Authorized live E2E | NOT EXECUTED |
| Production deployment | NOT EXECUTED |
| Main merge | NOT EXECUTED |

## 7. Recommendation

Proceed with the controlled pilot only after Privacy/Legal records the confirmation in Section 3
and the synthetic test identity/preview deployment is separately authorized. Do not activate a
new consent version or general rollout for this PDF-snapshot feature.

**EXISTING V1 SCOPE DOCUMENTED / PILOT E2E READINESS**

**STOP BEFORE LIVE E2E AND PRODUCTION DEPLOYMENT.**
