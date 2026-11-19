# JM-RIS-CV-ATS-API-02 — Secure API Foundation

**Status:** `FOUNDATION IMPLEMENTED / SECURITY GATES VERIFIED LOCAL`  
**Live activation:** `BLOCKED — ANALYSIS_API_ENABLED=false; service/consent issuer and operations decision required`  
**Branch:** `feature/jm-ris-cv-ats-api-01`  
**Foundation commit:** `21d2381`  
**No Main merge, no production deployment, no RIS/AWS/Terraform change.**

## 1. Implemented Foundation

All four versioned analysis endpoints exist under:

```text
/api/analysis/v1/cv/parse
/api/analysis/v1/ats/requirements
/api/analysis/v1/ats/analyze
/api/analysis/v1/match
```

They are **default-off** through:

```text
ANALYSIS_API_ENABLED=true
```

Without this flag, every endpoint fails closed with `503 analysis_disabled`.

### Shared envelope

```json
{
  "schemaVersion": 1,
  "requestId": "uuid",
  "data": {},
  "warnings": []
}
```

Errors:

```json
{
  "schemaVersion": 1,
  "requestId": "uuid",
  "error": { "code": "…", "message": "…" }
}
```

`X-Request-Id` is accepted when valid and regenerated otherwise. Responses are
`Cache-Control: no-store, private` and `X-Content-Type-Options: nosniff`.

## 2. Service Authentication

Implemented in `api/_lib/analysis/security.mjs`:

- server-only HMAC-SHA256 service assertion
- header `X-Analysis-Token`
- required claims: `iss`, `aud`, `sub`, `tenantId`, `userId`, `scopes`,
  `iat`, `exp`, `jti`
- required scopes:
  - `cv:parse`
  - `ats:requirements`
  - `ats:analyze`
  - `match:evaluate`
- constant-time signature verification
- issuer/audience/expiry/clock-skew validation
- tenant/user identity is taken from the verified token
- body `tenantId`/`userId` overrides are rejected with `tenant_mismatch` or
  `user_mismatch`
- no token values are logged

The secret is server-only (`ANALYSIS_SERVICE_SECRET`). It is **not** the
Jobsearch→RIS `RIS_PARTNER_CREDENTIAL`; that credential is not reused.

## 3. Analysis Consent Gate

`X-Analysis-Consent` requires a separate signed assertion:

- `kind=consent`
- `purpose=analysis`
- `tenantId` and `userId` must match the verified service identity
- `noticeVersion` must equal `ANALYSIS_CONSENT_NOTICE_VERSION`
- configured `ANALYSIS_CONSENT_SECRET`, issuer and audience are required

Without a valid assertion, the endpoint returns `403 consent_required` before
reading or parsing the payload. Without consent configuration it returns
`503 consent_not_configured`.

This is a **verification foundation**, not a real consent store. A trusted
consent issuer and approved analysis notice are still required before live
processing; no existing consent record was created or changed.

## 4. Endpoint Behavior

| Endpoint | Reuses | Processing |
|---|---|---|
| `cv/parse` | server PDF extractor + generated parser from `src/lib/cvBuilder/pdfImport.ts`, `documentStructure.ts`, `contractTypes.ts` | PDF only, max 4 MiB direct; no raw PDF/text in response; personal fields omitted by default |
| `ats/requirements` | `extractRequirementsFromJob`, `extractJobMetadata` | deterministic; no AI |
| `ats/analyze` | `analyzeJobForAts`, `generateCVRecommendations` | deterministic; `ai.executed=false` |
| `match` | `computeMatch` from existing `matching.mjs` | existing provider only; no new provider; AI only after auth + consent |

The existing `/api/ats-analysis` endpoint was not changed.

### CV response

The CV endpoint returns `CvParseResult`-style data with:

- SHA-256 and metadata for the submitted PDF
- existing `CvBuilderDraftV1`
- confidence and mapping summary
- anonymized profile (headline/skills; contact fields off by default)
- no raw PDF bytes or raw text
- no file persistence

The `cvParser.mjs` file is generated from the existing CV builder source; no
second parser implementation was created.

## 5. Limits and Errors

Central limits:

- JSON body: 64 KiB
- PDF direct body: 4 MiB
- PDF pages: 40
- extracted CV text: 60,000 characters
- match candidates: 10

Stable error codes include `unauthenticated`, `forbidden`, `consent_required`,
`tenant_mismatch`, `user_mismatch`, `analysis_disabled`,
`analysis_not_configured`, `consent_not_configured`,
`schema_version_unsupported`, `validation_error`, `unsupported_media_type`,
`payload_too_large`, `pdf_invalid`, `pdf_encrypted`, `pdf_too_many_pages`,
`text_too_long`, `jobs_too_many`, `method_not_allowed`, and
`internal_error`.

No raw payload, PDF, token or user content is logged.

## 6. Verification

| Check | Result |
|---|---|
| API foundation tests | **15 PASS** |
| Valid/invalid service token | PASS |
| Missing/incorrect scopes | PASS |
| Tenant spoofing | PASS |
| Missing/invalid analysis consent | PASS |
| Unsupported schema version | PASS |
| Invalid request body | PASS |
| JSON/PDF size limits | PASS |
| Rejection before parser/matcher processing | PASS |
| Synthetic PDF parse without raw PDF/text/personal data | PASS |
| Full frontend/API suite | **1980 PASS / 11 skipped** |
| `npm run build` | PASS |
| API syntax checks | PASS |
| OpenAPI YAML parse | PASS — 4 paths |

Artifacts:

- `docs/api/openapi-analysis-v1.yaml`
- `tests/api/analysis-v1-foundation.test.mjs`
- `api/_lib/analysis/security.mjs`
- `api/_lib/analysis/validation.mjs`
- `api/_lib/analysis/pdf.mjs`
- `api/_lib/analysis/cvParser.mjs`
- `api/analysis/v1/**`

## 7. Blocked Live Gates

The foundation is implemented and locally verified, but live processing remains
blocked until the following are decided/provided:

1. `ANALYSIS_API_ENABLED=true`
2. A production service secret/issuer/audience and rotation owner
3. A trusted consent issuer with an approved analysis notice version
4. Explicit approval for the external AI provider path used by `/match`
5. Operational rate limiting (the error code is reserved; no infrastructure
   rate limiter is added in this task)

No security bypass, no unprotected activation and no synthetic production data
are used.

**JM-RIS-CV-ATS-API-02 — FOUNDATION IMPLEMENTED / SECURITY GATES VERIFIED LOCAL.**
