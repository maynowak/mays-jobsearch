# JM-CV-JOB-PARSER-QUALITY-01 — CV & Job Parser Quality

**Status:** `CV & JOB PARSER IMPROVED / VERSIONED APIS VERIFIED LOCAL`  
**Release status:** `MERGED TO MAIN / PRODUCTION DEPLOYED / LIVE SMOKE VERIFIED`

**Branch:** `feature/jm-ris-cv-ats-api-01`

**Code commits:** `e1c8974`, `89a6e9b`, `01e237b`

**Merge commit:** `fd92230` (PR #41)

**No new endpoint, no new API version, no second parser engine.**

**No RIS/AWS/Terraform change.**

## 1. Result

Both existing parser surfaces were improved without changing their v1 routes:

```text
POST /api/analysis/v1/cv/parse
POST /api/analysis/v1/ats/requirements
```

The existing Jobsearch UI paths remain usable and now receive the same parser
output through the shared service/adapters.

## 2. CV Parser Improvements

Changed source: `src/lib/cvBuilder/pdfImport.ts`  
Generated server artifact: `api/_lib/analysis/cvParser.mjs`

- Added German/English contact labels:
  - `E-Mail-Adresse`, `Telefonnummer`, `Mobiltelefon`, `Handynummer`,
    `Wohnort`, `PLZ`, `postal`
- Stripped a leading profile label (`Profil:`, `Profile:`, `Summary:`, …) from
  the profile headline.
- Added skill deduplication by normalized key, so variants such as
  `Node.js` / `NodeJS` and repeated `AWS` entries do not duplicate.
- Added slash-separated year/month date periods (`2020/01 – 2021/06`) while
  retaining existing ISO, German numeric, named-month and open-ended ranges.
- Extended education recognition for `Fachabitur`, `high school diploma`,
  `secondary school`, `university degree`, `Hochschulabschluss`.
- API confidence remains structured as `confirmed|partial|uncertain` per
  section, with overall confidence derived from those values.

No new parser implementation was created. The server artifact is generated from
the frontend source by:

```bash
npm run generate:cv-parser
```

## 3. Job Parser Improvements

Changed source: `api/_lib/ats.mjs` and the shared service
`api/_lib/analysis/service.mjs`.

### Metadata

`extractJobMetadata` now additionally exposes:

- `companyName`
- `location[]`
- `remote`
- `responsibilities[]` (bounded, deduplicated task/responsibility lines)
- existing `title`, `titleTokens`, `language`, `workMode`, `jobTypes`,
  `contractType`, `contractTypeNoData`

### Requirements

Every requirement keeps its existing `id`, `text`, `category`, `importance` and
`source`. Compatible additions:

- `priority: required | preferred | unspecified`
- context-aware priority from the sentence containing the skill
- German and English required/preferred keywords
- negation handling for phrases such as `not required` / `nicht erforderlich`

`extractAtsRequirements` also exposes grouped `metadata.requiredSkills` and
`metadata.preferredSkills`.

### Skills, synonyms and education

- Expanded conservative technical vocabulary with common cloud, backend,
  database, CI/CD, observability and security terms.
- Added aliases/synonyms including `Amazon Web Services` → `AWS`,
  `K8s` → `Kubernetes`, `Google Cloud` → `GCP`, `Postgres` → `PostgreSQL`.
- Added German and English degree/education terms.
- Tightened certification extraction so ordinary `AWS experience required`
  text is not automatically treated as an AWS certification.
- Requirement IDs remain deterministic for the same input; existing ATS
  scoring/data structures are preserved.

## 4. One Parser Core

- Frontend CV import and the HTTP CV endpoint use the same source logic:
  `src/lib/cvBuilder/pdfImport.ts` → generated
  `api/_lib/analysis/cvParser.mjs`.
- A parity test imports both paths and compares complete structured results
  (generated IDs normalized) plus `buildPdfDocument`.
- Frontend ATS and the versioned ATS endpoints both reach
  `api/_lib/ats.mjs` through `api/_lib/analysis/service.mjs`.
- No duplicated ATS extraction, scoring or CV mapping implementation was added.

## 5. API Contract / Versioning

`docs/api/openapi-analysis-v1.yaml` remains `1.0.0` and v1, with compatible
additions:

- `AtsRequirementV1.priority`
- metadata `companyName`, `location`, `remote`, `responsibilities`,
  `requiredSkills`, `preferredSkills`
- documented `confirmed|partial|uncertain` CV section confidence

The API-02 draft `sectionConfidence` implementation mismatch (boolean flags vs
documented string values) is explicitly marked in OpenAPI as a pre-activation
v1 contract correction. It has no external production consumer and is not
renumbered as a new major version.

Central docs updated:

- `docs/api/openapi-analysis-v1.yaml`
- `docs/API_CONTRACT.md`
- `docs/CHANGELOG.md`

No automatic RIS contract migration was performed.

## 6. Test Evidence

| Check | Result |
|---|---|
| CV parser unit tests | **44 PASS** |
| Parser quality/API contract tests | **28 PASS** |
| ATS extraction/analysis regression | PASS |
| Legacy/versioned ATS compatibility | PASS |
| CV frontend/API parity | PASS |
| RIS boundary static test | PASS |
| Full frontend/API suite | **1996 PASS / 11 skipped** |
| `npm run build` | PASS |
| API/script syntax checks | PASS |
| OpenAPI parse / v1 schemas | PASS |
| `git diff --check` | PASS |

Synthetic coverage includes German/English documents, incomplete data,
different section structures, required/preferred German and English
requirements, negated requirements, synonyms, education, responsibilities and
frontend/API parser parity.

## 7. Boundaries and Open Points

- Existing Jobsearch UI functions remain unchanged.
- The legacy UI auth/consent boundary documented in
  `JM-CV-ATS-API-03` is not changed by this parser-quality task.
- The versioned APIs remain default-off and require API-02 service/consent
  configuration; no production activation was performed.
- New job metadata is available through the parser/API result and the existing
  legacy analysis response, but no new UI presentation was added.
- No RIS repository change, no AWS/Terraform change, no consent record change.
- The original parser-quality scope did not require a new UI presentation; new
  metadata is available through the existing analysis response and the
  versioned parser API.

## 8. Git and Release

- `e1c8974` — parser quality implementation, OpenAPI/docs/tests
- `89a6e9b` — Vercel function-limit consolidation: four public v1 paths now
  route through the existing `api/ats-analysis` function; public URLs are
  unchanged and the deployment remains at 12 functions.
- `01e237b` — CodeQL fixes for the generated parser regex escaping and unused
  imports.
- `fd92230` — PR #41 merged to `origin/main`.
- Prior parser standardization: `1f9cb23`.

## 9. Production Verification

Automatic main deployment completed without manual `vercel --prod`:

- `www.mays-job-matcher.app` → production deployment
  `dpl_95BJLfMmKm89Ybid6diP4gdJaDs2`, `READY`
- `mays-jobsearch.vercel.app` → production deployment
  `dpl_5T3NNuGFAFU99uap3ADWBuQ4c6ML`, `READY`

Live smoke checks:

- `/`, `/datenschutz`, `/impressum` return `200` on both domains.
- `POST /api/analysis/v1/ats/requirements` returns `503 analysis_disabled`
  (router is reachable; production activation remains intentionally off).
- `POST /api/ats-analysis` remains compatible and returns `200` for a synthetic
  title/tag request.
- No real CV or personal data was submitted.

**JM-CV-JOB-PARSER-QUALITY-01 — CV & JOB PARSER IMPROVED / VERSIONED APIS
VERIFIED LOCAL / MERGED TO MAIN / PRODUCTION SMOKE VERIFIED.**
