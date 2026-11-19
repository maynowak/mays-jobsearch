# JM-API-PARSER-STANDARDIZATION-01 — Standardized CV and Job Parser APIs

**Status:** `PARSER APIS STANDARDIZED / CONTRACT TESTS VERIFIED LOCAL`  
**Branch:** `feature/jm-ris-cv-ats-api-01`  
**Code commit:** `1f9cb23`  
**No new API version. No second parser engine. No Main merge or Production deployment.**

## 1. Scope

The existing API-02 endpoints were reused and completed:

```text
POST /api/analysis/v1/cv/parse
POST /api/analysis/v1/ats/requirements
```

No new endpoint family, no new parser implementation and no new schema version
were introduced. The existing CV-builder parser artifact and the existing ATS
module remain the source of truth.

## 2. Standardized Contract

Both endpoints now follow the same API-02 conventions:

| Convention | CV parser | ATS requirements parser |
|---|---|---|
| Version | `schemaVersion` / `X-Schema-Version: 1` | `schemaVersion: 1` |
| Authentication | `X-Analysis-Token` service HMAC assertion | same |
| Scope | `cv:parse` | `ats:requirements` |
| Consent | `X-Analysis-Consent`, purpose `analysis` | same |
| Response envelope | `{schemaVersion, requestId, data, warnings}` | same |
| Errors | shared `{error:{code,message}}` envelope | same |
| Cache | `no-store, private` | same |
| Request ID | `X-Request-Id` or generated | same |
| Limits | 4 MiB PDF / 40 pages / 60k text | 64 KiB JSON / bounded fields |

The CV endpoint uses the `X-Schema-Version` header because its request body is a
raw PDF, not JSON. This is the documented binary equivalent of the JSON
`schemaVersion` field used by ATS and matching endpoints.

## 3. Changes Made

### 3.1 CV parser confidence contract

The previous implementation returned `sectionConfidence` as a boolean map while
the OpenAPI contract described string confidence values. This was a real
contract mismatch.

The service now derives the stable values from the existing parser mapping:

- `confirmed`
- `partial`
- `uncertain`

The overall `confidence` is derived from those section values and can now
correctly be `partial`, not only `confirmed`/`uncertain`. Sections without a
reliable mapping are omitted. No parser logic was duplicated; the values come
from the existing `CvBuilderImportMapping`/`uncertain` output.

### 3.2 ATS requirement contract

OpenAPI now defines `AtsRequirementV1` with the reusable fields produced by the
existing ATS module:

- `id`
- `text`
- `category`
- `importance` (`critical|high|medium|low`)
- `source` (`title|tags|description|criteria`)
- optional `explicitness`, `normalized`

The requirements response also documents `metadata`, `basis` and the required
`requirements` array. No ATS extraction or scoring rule was changed.

### 3.3 OpenAPI

`docs/api/openapi-analysis-v1.yaml` now contains:

- explicit parser confidence enums;
- formal ATS requirement item schema;
- ATS metadata/basis fields;
- the existing shared security schemes and error responses for both endpoints.

A local OpenAPI parse check verifies all four paths remain present and the new
schemas resolve.

## 4. Contract and Compatibility Tests

The existing `analysis-v1-foundation` suite now includes:

1. **CV → ATS chain**
   - parse a synthetic PDF through `/cv/parse`;
   - use the returned `draft.skills` and `draft.profile.headline` as the ATS
     profile;
   - call `/ats/requirements`;
   - call `/ats/analyze` with the same profile;
   - verify requirement IDs are identical between requirement extraction and
     analysis.

2. **RIS/ATS reusable requirement shape**
   - verify every requirement has the documented `id`, `text`, `category`,
     allowed `importance` and allowed `source`.

3. **Parser confidence contract**
   - verify every returned `sectionConfidence` value is one of
     `confirmed|partial|uncertain`.

4. Existing security/consent/limit tests remain in place for both endpoints.

No raw PDF, raw CV text, token or personal data is returned by default or
logged.

## 5. Verification

| Check | Result |
|---|---|
| Focused parser/ATS tests | **91 PASS** |
| CV → ATS requirements → ATS analysis chain | PASS |
| ATS requirement reusable shape | PASS |
| CV section confidence contract | PASS |
| Full frontend/API suite | **1984 PASS / 11 skipped** |
| `npm run build` | PASS |
| API syntax checks | PASS |
| OpenAPI YAML parse / four paths | PASS |
| `git diff --check` | PASS |

## 6. Boundaries Preserved

- No RIS repository change.
- No AWS, Terraform or Vercel configuration change.
- No consent record created or changed.
- No production activation: `ANALYSIS_API_ENABLED` remains the gate and
  service/consent configuration is still required.
- Existing Jobsearch UI functions remain unchanged.
- The known API-03 legacy-UI auth/consent boundary is unchanged; the two parser
  APIs themselves use the same API-02 service/consent rules.

## 7. Git

- Branch: `feature/jm-ris-cv-ats-api-01`
- Parser standardization commit: `1f9cb23`
- Pushed to `origin/feature/jm-ris-cv-ats-api-01`.
- No Main merge, PR release approval or Production deployment.

**JM-API-PARSER-STANDARDIZATION-01 — TWO STANDARDIZED PARSER APIS, SAME
API-02 SECURITY/CONTRACT, LOCAL CONTRACT TESTS VERIFIED.**
