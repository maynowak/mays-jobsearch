# ATS Job Sources — Public Job Posting APIs

## Purpose

Enable Mays Jobsearch to fetch published job postings from major ATS platforms via their public, unauthenticated job board APIs. These are **job sources** (like Arbeitnow), not to be confused with the existing ATS Analysis / ATS Profile system.

## Providers Overview

| Provider | Public Endpoint | Format | Identifier | Auth Required |
|----------|----------------|--------|------------|---------------|
| Greenhouse | `https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs` | JSON | `board_token` | No |
| Lever | `https://api.lever.co/v0/postings/{site}` | JSON | `site` | No |
| Ashby | `https://api.ashbyhq.com/posting-api/job-board/{job_board_name}` | JSON | `job_board_name` | No |
| Workable | `https://apply.workable.com/api/v3/accounts/{account_subdomain}/jobs` | JSON | `account_subdomain` | No |
| Recruitee | `https://{company_subdomain}.recruitee.com/api/v2/jobs` | JSON | `company_subdomain` | No |
| Personio | `https://{career_site}.jobs.personio.de/xml` | XML | `career_site` | No |

## Key-based Job APIs (Adzuna, Jooble)

Unlike the ATS sources above, these official job-board APIs require free credentials (**server-side only**, never in frontend code):

| Provider | Public Endpoint | Format | Identifier | Auth Required |
|----------|----------------|--------|------------|---------------|
| Adzuna | `https://api.adzuna.com/v1/api/jobs/{country}/search/{page}` | JSON | country code (`de`, `gb`, `us`, `fr`, …) | Yes — `app_id` + `app_key` (free tier at developer.adzuna.com) |
| Jooble | `https://jooble.org/api/{api_key}` (POST, JSON body) | JSON | — (worldwide, country via search params) | Yes — API key in URL path |

### Adzuna
- **Coverage**: UK, USA, Germany, France + 10+ more countries (one country code per request).
- **Native search**: `what` (keywords), `where` (location), `results_per_page`, `page`, plus `salary_min`, `full_time`, `sort_by` (reserved for future use).
- **Structured data incl. geodata + salary**: `latitude`/`longitude` per job → normalized as optional `latitude`/`longitude` fields (feeds the per-job-radius upgrade point from GEO-WORKMODE); `salary_min`/`salary_max` → `salary` range string (no currency invented).
- **Multi-country**: `ADZUNA_COUNTRIES="de,gb"` loops countries like Greenhouse loops boards; per-country failures logged, остальные fortgesetzt; if NOTHING was fetched, the first error is rethrown (visible misconfiguration instead of silent empty).
- **Config**: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ADZUNA_COUNTRIES` (default `"de"`), `JOB_SOURCE_ADZUNA_ENABLED` (default `true`); missing credentials → `emptyResult("missing_config")`.
- **Field mapping**: `az-{country}-{id}` externalId; `company.display_name`; `location.display_name` + `location.area[]`; `redirect_url` (url/applyUrl/jobUrl); `created` → `created_at`; `contract_time` → `jobTypes`; `category.label` → `tags`/`department`.
- **Endpoint verified** against official docs (`developer.adzuna.com/docs/search`): path, `app_id`/`app_key`, `results_per_page`, `what`, `where`, `redirect_url` confirmed 2026-09-29.

### Jooble
- **Coverage**: worldwide, 60+ countries; filtering by keywords + location via POST body.
- **Request**: `POST https://jooble.org/api/{key}`, `Content-Type: application/json`, body `{keywords, location}` (only set when non-empty).
- **Local filtering still applies** afterwards (consistent with all sources).
- **Config**: `JOOBLE_API_KEY`, `JOB_SOURCE_JOOBLE_ENABLED` (default `true`); missing key → `emptyResult("missing_config")`.
- **Field mapping**: `jo-{id}` externalId; `snippet` (plain text with `<b>` highlights → stripped for `descriptionPlain`); `salary` string passed through unchanged; `type` → `tags`/`jobTypes`; `link` (url/applyUrl/jobUrl); `updated` → `created_at`.
- **Verification status**: docs page bot-blocked (403) at check time — field mapping implemented defensively per documented schema; **verify against a live key before relying on Jooble in production** (single valid response suffices: all fields optional except array shape).

## Common ATS Source Contract

Each ATS source adapter MUST implement the following interface to integrate with the existing Source Registry (`api/_lib/sources/index.mjs`):

### Required Exports

```js
{
  id: "greenhouse",                    // unique source id (used in job.source[], cache keys, meta)
  displayName: "Greenhouse",           // human-readable name
  provider: "ats",                     // "ats" for all ATS sources
  enabled(): boolean,                  // checks config + required identifiers
  fetchJobs({ skills, targetRoles, targetRole, city }): Promise<{ jobs, meta }>,
  critical: false,                     // if true, failures propagate as HttpError
}
```

### fetchJobs Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `skills` | string | Comma-separated skill string |
| `targetRoles` | string[] | Array of target role strings (new format) |
| `targetRole` | string | Single target role (legacy, backward compat) |
| `city` | string | City query string (may be empty when no radius) |

### fetchJobs Return Value

```js
{
  jobs: Job[],           // normalized job objects (max MAX_JOBS_TO_AI)
  meta: {
    enabled: boolean,
    reason: string | null,    // e.g. "no_boards_configured", "not_found", "rate_limited"
    totalScanned: number,     // raw jobs fetched from API
    totalFiltered: number,    // jobs after local filtering
  }
}
```

### Normalized Job Fields (Contract)

All ATS sources MUST normalize to these fields. Missing fields remain `undefined` — **do not invent values**.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `slug` | string | Yes | Unique within source, used for dedup |
| `externalId` | string | Yes | Provider-specific stable ID (e.g., `gh-123`, `lev-abc`) |
| `title` | string | Yes | Job title |
| `company_name` | string | Yes | Employer name |
| `location` | string[] | Yes | Array of location strings |
| `remote` | boolean | Yes | True if remote-friendly |
| `tags` | string[] | No | Skills, departments, categories |
| `url` | string | Yes | Canonical job URL (apply or view) |
| `created_at` | number | No | Unix timestamp (seconds) |
| `source` | string[] | Yes | `[sourceId, "ats"]` |
| `description` | string | No | Raw HTML description |
| `descriptionPlain` | string | No | Plain text description |
| `language` | "de" \| "en" \| undefined | No | Detected language |
| `jobTypes` | string[] | No | Employment types (e.g., ["full_time"]) |
| `applyUrl` | string | No | Direct apply URL if different from `url` |
| `jobUrl` | string | No | Job detail page URL |
| `workplaceType` | string | No | "remote" \| "hybrid" \| "onsite" |
| `department` | string | No | Department name |
| `salary` | string | No | Salary info if available |
| `publishedAt` | number | No | Publication timestamp (seconds) |
| `updatedAt` | number | No | Last update timestamp (seconds) |
| `latitude` | number | No | Job latitude if provided (currently Adzuna) — feeds future per-job radius filtering |
| `longitude` | number | No | Job longitude if provided (currently Adzuna) — feeds future per-job radius filtering |

## Configuration

All ATS sources are configured via environment variables (no API keys for public endpoints):

**New unified configuration (recommended):**
```bash
PUBLIC_ATS_SOURCES='[
  {"provider":"greenhouse","identifier":"stripe","enabled":true},
  {"provider":"lever","identifier":"netflix","enabled":true},
  {"provider":"ashby","identifier":"notion","enabled":true},
  {"provider":"workable","identifier":"acme","enabled":true},
  {"provider":"recruitee","identifier":"mycompany","enabled":true},
  {"provider":"personio","identifier":"personio","enabled":true,"options":{"language":"en"}}
]'
```

**Legacy Greenhouse configuration (still supported for backward compatibility):**
```bash
JOB_SOURCE_GREENHOUSE_ENABLED=true
JOB_SOURCE_GREENHOUSE_BOARDS="board1,board2,board3"
```

Each source reads its configuration from `getConfig()` in `api/_lib/config.mjs`.

## Capability Matrix

| Capability | Greenhouse | Lever | Ashby | Workable | Recruitee | Personio |
|------------|:----------:|:-----:|:-----:|:--------:|:---------:|:--------:|
| **Format** | JSON | JSON | JSON | JSON | JSON | XML |
| **Pagination** | No (all jobs) | Yes (offset/limit) | Yes (cursor) | Yes (page/size) | Yes (offset/limit) | No (all jobs) |
| **Native Filter** | None | Location, commitment | Location, department | Location, department, employmentType | Location, department | None |
| **Location** | offices[].name | location | location.name | location.city/region/country | location.name | office.name |
| **Department** | departments[].name | categories.commitment | department.name | department.name | department.name | department.name |
| **Employment Type** | employment_type | categories.level | employmentType | employmentType | employmentType | employmentType |
| **Workplace Type** | ❌ (infer from location) | ❌ | workplaceType | workplaceType | remote (boolean) | ❌ |
| **Salary** | ❌ | salary | compensation | ❌ | ❌ | ❌ |
| **Updated Timestamp** | updated_at | updatedAt | updatedAt | updatedAt | updatedAt | ❌ |
| **Apply URL** | absolute_url | hostedUrl | applyUrl | applyUrl | careersUrl + applyUrl | applyUrl |
| **Description** | content (HTML) | description (HTML) | description (HTML) | description (HTML) | description (HTML) | description blocks |
| **Source URL** | absolute_url | hostedUrl | jobUrl | applyUrl | careersUrl | jobUrl |
| **Deletion/Closure** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

*Capability matrix verified against current provider documentation as of 2026-09-28.*

## Identifier / Tenant Discovery

Public ATS APIs require a provider-specific identifier (tenant/board/account). These are **not** API keys and do not require authentication.

| Provider | Identifier Name | Example | Where to Find |
|----------|----------------|---------|---------------|
| Greenhouse | `board_token` | `company-name` | Greenhouse job board URL: `https://boards.greenhouse.io/{board_token}` |
| Lever | `site` | `company-name` | Lever career site: `https://jobs.lever.co/{site}` |
| Ashby | `job_board_name` | `company-name` | Ashby job board: `https://jobs.ashbyhq.com/{job_board_name}` |
| Workable | `account_subdomain` | `company-name` | Workable apply URL: `https://apply.workable.com/{account_subdomain}` |
| Recruitee | `company_subdomain` | `company-name` | Recruitee careers: `https://{company_subdomain}.recruitee.com` |
| Personio | `career_site` | `company-name` | Personio careers: `https://{career_site}.jobs.personio.de` |

**Configuration approach**: Comma-separated list in env var (e.g., `JOB_SOURCE_GREENHOUSE_BOARDS="board1,board2"`). Empty list = source returns empty result with `meta.reason = "no_boards_configured"`.

## Normalization Rules

All sources share the same normalization pipeline utilities from `api/_lib/filter.mjs`:

- `stripHtml()` / `htmlToPlainText()` — HTML → plain text
- `detectLanguage()` — language detection
- `tokenize()` — skill/keyword tokenization
- `locationMatches()` — city/radius filtering
- `keywordHits()` — keyword matching

### Field Mapping Examples

**Greenhouse** → Normalized
```js
externalId: `gh-${job.id}`
title: job.title
company_name: job.company_name
location: [...job.location?.name, ...job.offices?.map(o => o.name)]
remote: location.includes("remote") || offices.some(o => o.name.includes("remote"))
tags: [...departments, ...job.tags]
url: job.absolute_url
created_at: job.updated_at ? Date.parse(job.updated_at) / 1000 : undefined
applyUrl: job.absolute_url
jobUrl: job.absolute_url
department: job.departments?.[0]?.name
jobTypes: job.employment_type ? [job.employment_type] : undefined
```

**Lever** → Normalized
```js
externalId: `lev-${job.id}`
title: job.text
company_name: job.company || "Unknown"
location: job.categories?.location ? [job.categories.location] : []
remote: job.categories?.commitment === "remote" || job.workplaceType === "remote"
tags: [job.categories?.commitment, job.categories?.team, job.categories?.level].filter(Boolean)
url: job.hostedUrl
applyUrl: job.applyUrl || job.hostedUrl
jobUrl: job.hostedUrl
workplaceType: job.workplaceType
department: job.categories?.team
jobTypes: job.categories?.commitment ? [job.categories.commitment] : undefined
updatedAt: job.updatedAt ? Date.parse(job.updatedAt) / 1000 : undefined
```

*(Similar mappings for Ashby, Workable, Recruitee, Personio — see individual adapter implementations)*

## Generalized Source Addon (`jsonFeedSource`)

New JSON-feed providers are added as thin addons on top of one shared helper — no copy-paste of fetch/filter/rank logic.

**Helper:** `api/_lib/sources/public-ats/jsonFeedSource.mjs` → `createJsonFeedSource({...})`

The helper owns the ground structure (configured once, reused by all JSON sources):
- standard input `fetchJobs({ skills, targetRoles, targetRole, city })` (comma-separated skills entry)
- keyword/city tokenization via `filter.mjs`
- fetch with `Accept: application/json`
- HTTP mapping: 404 → `not_found`, 429 → `rate_limited`, other non-OK/network → `upstream`/`network` (`HttpError`)
- JSON parse + list-shape validation
- local filtering, ranking, `meta: { enabled, reason, totalScanned, totalFiltered }`, max 40 jobs

**Provider addon supplies only** (bound at creation time via the factory):
- `providerName`, `identifier`, `enabled`, `label`, `options`
- `buildUrl(identifier, options)` — e.g. Lever: `` `${API_BASE}/${encodeURIComponent(id)}?mode=json` ``
- `extractList(json)` — e.g. Lever/Ashby: `json`; Workable: `json.jobs`; Recruitee: `json.offers`
- `normalizeJob(raw, sourceId)` — maps one raw item to the normalized Job contract; **must use the passed `sourceId`** for `source: [sourceId, "ats"]` (never a module-level constant, identifiers differ per instance)

**Adding a new JSON source (5 steps):**
1. Create `api/_lib/sources/public-ats/adapters/<provider>.mjs` with `export function create<Provider>Source({ identifier, enabled, label, options = {} })` calling `createJsonFeedSource`.
2. Register it in `ADAPTERS` in `api/_lib/sources/public-ats/factory.mjs` (static map — no dynamic imports).
3. Add the `provider` literal to the `PublicJobSourceConfig` docs and `.env.example` (`PUBLIC_ATS_SOURCES`).
4. Add the row to the Providers Overview + Capability Matrix in this doc.
5. Test with a mocked `fetch` (valid payload, 404, invalid JSON) — no production calls.

**Worked example (Lever):**
```js
import { createJsonFeedSource } from "../jsonFeedSource.mjs";

export function createLeverSource({ identifier, enabled, label, options = {} }) {
  return createJsonFeedSource({
    providerName: "lever",
    identifier,
    enabled,
    label,
    options,
    buildUrl: (id) => `https://api.lever.co/v0/postings/${encodeURIComponent(id)}?mode=json`,
    extractList: (json) => json,
    normalizeJob: (raw) => normalizeLeverJob(raw, `lever:${identifier}`),
  });
}
```

**Not covered by the helper (by design):**
- Greenhouse legacy multi-board source (`api/_lib/sources/greenhouse.mjs`) — own loop over `JOB_SOURCE_GREENHOUSE_BOARDS`; plus single-board `createGreenhouseSource` for the factory.
- Personio (`adapters/personio.mjs`) — XML feed, own fetch/parse; shares the same normalization contract and error-code conventions.

### Upgrade points for later sources
1. **Pagination** — extend the helper with an optional `paginate({ url, options, extractList })` hook (fetch-all-pages + concat); keep default single-request to avoid behavior changes for existing providers.
2. **Native server-side filtering** — optional `buildUrl(identifier, options, { keywordTokens, cityQueries })`; only for providers with real filter support (e.g. Lever `location/commitment/team`). Local filtering stays as fallback.
3. **Caching** — optional L1 cache (e.g. 10 min, keyed `ats:{sourceId}:{query}|{location}`) in the helper; must respect per-source TTL via `options`.
4. **EU/region endpoints** — via `options` (already used: Recruitee `baseUrl`, Personio `baseUrl`+`language`, Ashby `includeCompensation`); document per provider.
5. **XML feeds** — extract a `xmlFeedSource` sibling helper once a second XML provider appears; until then Personio stays standalone.
6. **Capability declarations** — if the search strategy ever needs them, add an optional `capabilities` field to the helper return (declared, not enforced; must not change search pipeline).
7. **Rate-limit backoff** — centralize retry-after handling in the helper instead of per-adapter messages.

## Deduplication Strategy

Cross-source deduplication uses `api/_lib/sources/index.mjs::jobKey()`:

```js
function jobKey(job) {
  const location = (job.location || []).join(",").toLowerCase();
  return `${(job.title || "").toLowerCase().trim()}|${(job.company_name || "").toLowerCase().trim()}|${location}`;
}
```

**Priority for ATS-internal deduplication** (within a single source's multi-tenant fetch):

1. `provider + externalId` (e.g., `greenhouse + gh-123`)
2. Canonical `applyUrl` / `jobUrl`
3. `source + url`
4. Fallback: `company + title + location` (last resort)

**Rule**: Never aggressively deduplicate different positions. Same company + same title + same location = likely same posting.

## Search Integration

ATS sources integrate with existing Search Strategy **unchanged**:

- `targetRoles[]` — hard filter (OR across roles)
- `skills` — K-of-N progressive threshold strategy
- `city` + `radiusKm` — geo semantics (city only filters when radius > 0)
- `workMode` / `employmentType` — post-fetch filters via `applySearchFilters()`

No changes to `searchStrategy.mjs` or `filter.mjs` required.

## ATS Source vs ATS Analysis — Critical Distinction

| Concept | Purpose | Example |
|---------|---------|---------|
| **ATS Job Source** | Fetches job postings from ATS platforms | Greenhouse, Lever, Ashby |
| **ATS Profile** | Defines matching rules for a specific ATS vendor | "Greenhouse ATS", "Lever ATS" |
| **ATS Analysis** | Scores a CV against a specific job's requirements | `ats.mjs::analyzeJobForAts()` |

**Flow**:
```
Job Source (Greenhouse) → Job → Search → Selected Job → ATS Analysis (with selected ATS Profile)
```

The existing ATS Analysis system (`api/_lib/ats.mjs`) remains completely unchanged.

## Reference Implementation: Greenhouse

Location: `api/_lib/sources/greenhouse.mjs`

### Features
- Fetches from `https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true`
- Supports multiple board tokens via `JOB_SOURCE_GREENHOUSE_BOARDS`
- Normalizes all contract fields
- Handles 404 (board not found), 429 (rate limit), 5xx, network errors
- Local filtering by city + keyword hits
- Returns max 40 jobs (`MAX_JOBS_TO_AI`)

### Configuration
```bash
JOB_SOURCE_GREENHOUSE_ENABLED=true
JOB_SOURCE_GREENHOUSE_BOARDS="stripe,airbnb,coinbase"
```

### Error Handling
| HTTP Status | Behavior |
|-------------|----------|
| 404 | Board not found → log error, continue with other boards |
| 429 | Rate limited → throw HttpError(429, "rate_limited") |
| 5xx / network | Throw HttpError(502, "upstream") |
| Invalid JSON | Throw HttpError(502, "upstream") |
| Empty boards list | Return `emptyResult("no_boards_configured")` |

## Remaining Providers — Implementation Status

| Provider | Status | Notes |
|----------|--------|-------|
| Greenhouse | ✅ Implemented | Reference adapter (`api/_lib/sources/greenhouse.mjs`) |
| Lever | ✅ Implemented | `api/_lib/sources/public-ats/adapters/lever.mjs` |
| Ashby | ✅ Implemented | `api/_lib/sources/public-ats/adapters/ashby.mjs` |
| Workable | ✅ Implemented | `api/_lib/sources/public-ats/adapters/workable.mjs` |
| Recruitee | ✅ Implemented | `api/_lib/sources/public-ats/adapters/recruitee.mjs` |
| Personio | ✅ Implemented | `api/_lib/sources/public-ats/adapters/personio.mjs` (XML) |
| Adzuna | ✅ Implemented | `api/_lib/sources/adzuna.mjs` (key-based, multi-country, geo+salary) |
| Jooble | ✅ Implemented | `api/_lib/sources/jooble.mjs` (key-based POST, verify live before prod use) |

All 6 ATS providers implemented via factory pattern in `api/_lib/sources/public-ats/`. Adzuna + Jooble are first-class sources in `api/_lib/sources/index.mjs` (they need credentials, so they are not part of `PUBLIC_ATS_SOURCES`).

## Configuration (Updated)

All ATS sources are configured via `PUBLIC_ATS_SOURCES` JSON environment variable (plus legacy Greenhouse config):

```bash
# Legacy Greenhouse (still supported)
JOB_SOURCE_GREENHOUSE_ENABLED=true
JOB_SOURCE_GREENHOUSE_BOARDS="board1,board2,board3"

# New unified configuration for all public ATS sources
PUBLIC_ATS_SOURCES='[
  {"provider":"greenhouse","identifier":"stripe","enabled":true},
  {"provider":"lever","identifier":"netflix","enabled":true},
  {"provider":"ashby","identifier":"notion","enabled":true},
  {"provider":"workable","identifier":"acme","enabled":true},
  {"provider":"recruitee","identifier":"mycompany","enabled":true},
  {"provider":"personio","identifier":"personio","enabled":true,"options":{"language":"en"}}
]'
```

Each source reads its configuration from `getConfig().publicAtsSources` in `api/_lib/config.mjs`.

Key-based sources use dedicated env vars (server-side only):

```bash
# Adzuna (free tier at https://developer.adzuna.com/)
ADZUNA_APP_ID=your-app-id
ADZUNA_APP_KEY=your-app-key
ADZUNA_COUNTRIES=de,gb
JOB_SOURCE_ADZUNA_ENABLED=true

# Jooble (API key, worldwide)
JOOBLE_API_KEY=your-jooble-key
JOB_SOURCE_JOOBLE_ENABLED=true
```

## Testing Requirements

### Common Contract Tests
- Normalization produces all required fields
- Missing optional fields remain `undefined`
- `externalId` is stable and provider-prefixed
- URL handling (applyUrl, jobUrl, url)
- Deduplication key generation
- Malformed response handling
- Empty response handling
- Timeout handling
- HTTP 429, 500 handling
- Invalid JSON handling
- XML failure handling (for Personio)

### Greenhouse-Specific Tests
- Valid response with multiple jobs
- No jobs returned
- Missing optional fields (departments, offices, tags)
- Description HTML handling
- Location parsing (location + offices)
- Apply URL extraction
- UpdatedAt timestamp parsing
- Stable external ID format (`gh-{id}`)

**All tests use mocked HTTP responses** — no dependency on production endpoints.

## Limitations & Known Issues

1. **No native search** — All ATS public APIs return full job lists; filtering happens locally
2. **No deletion/closure events** — Cannot detect removed jobs; stale jobs persist until re-fetch
3. **Rate limits** — Public endpoints have undocumented limits; 429 handling is defensive
4. **Identifier management** — Tenant identifiers must be manually configured; no auto-discovery
5. **Personio XML** — Requires XML parser; different from JSON sources
6. **Pagination** — Only Lever, Ashby, Workable, Recruitee paginate; Greenhouse/Personio return all

## Security

- All fetches are **server-side only** (existing API/Source layer)
- No ATS configuration in React frontend
- No API keys required for public endpoints
- Key-based sources (Adzuna, Jooble, Apify) read credentials exclusively from server env vars (`ADZUNA_APP_ID/ADZUNA_APP_KEY`, `JOOBLE_API_KEY`, `APIFY_API_TOKEN`) — never in frontend code, logs, or docs
- If a source ever requires credentials → document as `BLOCKED/REQUIRES_CREDENTIALS`, do not scrape or workaround

## Definition of Done (This Task)

- [x] Existing Source Architecture examined
- [x] Common ATS Source Contract defined
- [x] 6 Providers documented with current public endpoints
- [x] Identifier per provider documented
- [x] Capability Matrix created
- [x] Normalization Contract defined
- [x] Deduplication Strategy documented
- [x] Greenhouse Reference Adapter implemented
- [x] Greenhouse integrated in Source Registry
- [x] Lever adapter implemented
- [x] Ashby adapter implemented
- [x] Workable adapter implemented
- [x] Recruitee adapter implemented
- [x] Personio adapter implemented (XML)
- [x] Factory pattern for unified configuration
- [x] PUBLIC_ATS_SOURCES config parser
- [x] All 6 sources registered in Source Registry
- [x] Tests PASS (API tests: 291 passed)
- [x] TypeScript PASS
- [x] Build PASS
- [x] Search Regression PASS (existing tests pass)
- [x] AI_AUDITLOG.md checked (no AI data flow changes)
- [x] docs/ATS_JOB_SOURCES.md updated
- [x] docs/reports/ATS-JOB-SOURCES-01-EXECUTION_LOG.md created
- [ ] Commit + Push to main
- [ ] Git clean

## Next Steps

All 6 providers are now implemented. Future enhancements could include:
1. Add caching layer for ATS sources (similar to Apify L1/L2 cache)
2. Add pagination support for Lever/Ashby/Workable/Recruitee
3. Add EU endpoint support for Lever (api.eu.lever.co)
4. Add auto-discovery for company identifiers