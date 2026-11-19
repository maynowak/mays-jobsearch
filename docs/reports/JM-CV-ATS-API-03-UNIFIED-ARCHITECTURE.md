# JM-CV-ATS-API-03 — Unified API Architecture

**Status:** `UNIFIED CORE + SERVICE LAYER / INTEGRATION VERIFIED LOCAL`  
**Full no-bypass claim:** `BLOCKED — legacy UI adapters still use their pre-API-02 browser authentication boundary`  
**Branch:** `feature/jm-ris-cv-ats-api-01`  
**Code commits:** `ab1bc75` (shared service), `60a3f63` (legacy skill normalization)  
**No Main merge, no Production deployment, no RIS/AWS/Terraform/consent change.**

## 1. Architecture Result

The existing engines are now reached through one service layer:

```text
Consumer Layer
  Jobsearch UI (legacy /api/ats-analysis, /api/match)
  External API clients (/api/analysis/v1/*)

        │
        ▼
API Layer
  Existing UI adapters          Versioned analysis endpoints
  (unchanged response shape)    (API-02 auth + consent gates)

        │
        ▼
Service Layer
  api/_lib/analysis/service.mjs
  parseCvBuffer / extractAtsRequirements / analyzeAts / matchJobs

        │
        ▼
Core Layer
  api/_lib/analysis/pdf.mjs + generated cvParser.mjs
  api/_lib/ats.mjs
  api/_lib/matching.mjs
```

The versioned endpoints and the UI adapters no longer contain independent
ATS/matching logic. The UI adapters keep their existing response shapes for
backward compatibility; the versioned endpoints keep the API-01/API-02
envelopes, error codes, auth and consent gates.

## 2. Call Matrix

| Function | Current UI / consumer path | Shared engine | Contract | Adaptation needed |
|---|---|---|---|---|
| CV upload and parsing | `CvBuilderImportDialog` → browser `extractPdfText` + `parseCvBuilderImportText` | `src/lib/cvBuilder/pdfImport.ts` and its document/types inputs | Local CV-builder draft | None for UI; external `cv/parse` uses a generated server artifact from the same source. No second parser was added. |
| CV builder / mapping | Browser parser → local `CvBuilderDraftV1` → editor | Same parser/mapping source | Local CV-builder draft | None; no RIS persistence and no new server mapping engine. |
| ATS requirement extraction | UI uses the requirements embedded in `/api/ats-analysis`; external requirement-only call is new | `extractRequirementsFromJob` / `extractJobMetadata` in `ats.mjs` | API-02 `ats/requirements`; legacy ATS response | API-02 adapter is additive; UI continues through the compatibility adapter. |
| Deterministic ATS analysis | `src/api.ts` → `POST /api/ats-analysis` | `analyzeAts` service → `analyzeJobForAts` + `generateCVRecommendations` | Legacy ATS response; API-02 `ats/analyze` | Legacy response mapping retained; same service output verified by test. |
| CV–job matching | `src/api.ts` → `POST /api/match` → model fallback in UI | `matchJobs` service → `computeMatch` in `matching.mjs` | Legacy match response; API-02 `match` | Legacy model/`x-mj-attempt` options passed through; no second matcher. |
| AI-assisted matching | Existing UI flow uses the existing provider router/model fallback | Same `computeMatch` / provider path | Legacy match response; API-02 `match` | External `/match` does not expose UI model selection; provider approval remains unchanged. |

## 3. Implemented Service Layer

`api/_lib/analysis/service.mjs` owns the shared business operations:

- `parseCvBuffer(buffer, { includePersonal })`
  - lazy-loads the existing PDF extractor and generated parser only on the CV path
  - returns the existing draft/mapping/confidence result
  - omits personal fields by default
  - enforces page/text limits and stable PDF errors
- `extractAtsRequirements(job, profile)`
  - reuses `extractRequirementsFromJob` and `extractJobMetadata`
- `analyzeAts(job, profile)`
  - reuses `analyzeJobForAts` and `generateCVRecommendations`
  - returns both the compatibility result and the versioned response data
- `matchJobs(profile, jobs, options)`
  - reuses `computeMatch` and passes through the legacy model/attempt options
- `parseSkills` preserves the legacy quoted-skill normalization

The four API-02 endpoints are thin adapters over this service. The two legacy
Jobsearch endpoints import the same service. A source-level regression test
checks all six HTTP adapters reference `analysis/service.mjs`.

## 4. Contract and Compatibility

- API-02 routes remain:
  - `POST /api/analysis/v1/cv/parse`
  - `POST /api/analysis/v1/ats/requirements`
  - `POST /api/analysis/v1/ats/analyze`
  - `POST /api/analysis/v1/match`
- `schemaVersion: 1`, shared envelope, request IDs, stable error codes and
  OpenAPI remain unchanged.
- `/api/ats-analysis` and `/api/match` keep their existing request/response
  shapes. Existing UI code did not need a product-flow change.
- `/api/ats-analysis` still performs its existing AI formulation/fallback path
  only when the client explicitly enables it; the deterministic analysis is
  now taken from the shared service.
- `/api/match` still performs existing Arbeitsagentur detail enrichment after
  the shared matcher returns.
- No RIS, AWS, Terraform, Vercel configuration or consent record was changed.

## 5. Security Boundary — Explicit Blocker

The versioned API retains all API-02 controls:

- default-off `ANALYSIS_API_ENABLED`
- server-only HMAC `X-Analysis-Token`
- issuer/audience/expiry/scope checks
- signed `X-Analysis-Consent` with tenant/user/purpose/notice binding
- no raw CV/PDF/token/personal data in logs or default responses

However, the existing UI adapters `/api/ats-analysis` and `/api/match` are
still the pre-API-02 browser routes. They remain unauthenticated and do not
carry the API-02 service/consent assertions. That means the statement
“different authentication paths, but identical authorization and consent
rules” is **not yet true for those two legacy routes**, and the “no unprotected
internal bypass” requirement is **not fully satisfied**.

This is intentionally not hidden behind an alias or a weak same-origin check.
A separate internal-session design is required before claiming full no-bypass
unification:

1. Decide the Jobsearch browser-session verification path (for example a
   verified Cognito access token at the legacy adapters).
2. Bind the same analysis-purpose consent/notice decision to that internal
   session.
3. Add negative tests for missing/expired/foreign-session and missing-consent
   calls.
4. Only then remove or gate the legacy unauthenticated behavior.

Until then, API-03 is an **engine/contract integration result**, not a
production security activation. The versioned API remains default-off.

## 6. Verification

| Check | Result |
|---|---|
| API-03 focused shared-service/contract tests | **17 PASS** |
| API-02 foundation/security tests | PASS |
| Legacy ATS tests | PASS |
| Legacy match/cache tests | PASS |
| Full frontend/API suite | **1982 PASS / 11 skipped** |
| `npm run build` | PASS |
| API syntax checks | PASS |
| `git diff --check` | PASS |
| ATS legacy vs versioned output equality | PASS — same score and requirements |
| Shared-service source assertion across six HTTP adapters | PASS |
| Synthetic CV parse without raw PDF/text/personal data | PASS |

No live endpoint was activated; no real CV or production data was processed.

## 7. Git and Release State

- Code commits: `ab1bc75`, `60a3f63`
- Branch: `feature/jm-ris-cv-ats-api-01`
- No Main merge, PR, Production deployment or Vercel configuration change.
- No RIS repository change, no AWS/Terraform state change, no consent record
  creation or change.
- Next gate: resolve the internal legacy auth/consent boundary, then perform a
  separate release review for API-03.

**JM-CV-ATS-API-03 — UNIFIED CORE AND SERVICE LAYER INTEGRATION VERIFIED LOCAL;
FULL INTERNAL AUTH/CONSENT NO-BYPASS GATE OPEN.**
