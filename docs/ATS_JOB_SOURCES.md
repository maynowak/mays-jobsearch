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

## Key-based Job APIs (Adzuna, JobsPipe)

Unlike the ATS sources above, these official job-board APIs require free credentials (**server-side only**, never in frontend code):

| Provider | Public Endpoint | Format | Identifier | Auth Required |
|----------|----------------|--------|------------|---------------|
| Adzuna | `https://api.adzuna.com/v1/api/jobs/{country}/search/{page}` | JSON | country code (`de`, `gb`, `us`, `fr`, …) | Yes — `app_id` + `app_key` (free tier at developer.adzuna.com) |
| JobsPipe | `https://api.jobspipe.dev/v1/jobs/search` (POST, Bearer) | JSON | — (30+ sources, single normalized schema) | Yes — Bearer API key (`JOBSPIPE_API_KEY`) |
| Theirstack | `https://api.theirstack.com/v1/jobs/search` (POST, Bearer) | JSON | — (worldwide, 100+ Länder, Filter via Body) | Yes — Bearer API key (1 Credit pro geliefertem Datensatz) |

### Adzuna
- **Coverage**: UK, USA, Germany, France + 10+ more countries (one country code per request).
- **Native search**: `what` (keywords), `where` (location), `results_per_page`, `page`, plus `salary_min`, `full_time`, `sort_by` (reserved for future use).
- **Structured data incl. geodata + salary**: `latitude`/`longitude` per job → normalized as optional `latitude`/`longitude` fields (feeds the per-job-radius upgrade point from GEO-WORKMODE); `salary_min`/`salary_max` → `salary` range string (no currency invented).
- **Multi-country**: `ADZUNA_COUNTRIES="de,gb"` loops countries like Greenhouse loops boards; per-country failures are logged and the loop continues; if NOTHING was fetched at all, the first error is rethrown (visible misconfiguration instead of silent empty).
- **Quota-Schutz via L1-Cache**: Roh-Payloads je Land + Query (`job-source:adzuna:<country>|<what>|<where>`, TTL 600 s, wie Apify-L1). Wiederholte identische Suchen kosten keinen Paid-Call; leere Ergebnisse werden nicht gecacht.
- **Config**: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ADZUNA_COUNTRIES` (default `"de"`), `JOB_SOURCE_ADZUNA_ENABLED` (default `true`); missing credentials → `emptyResult("missing_config")`.
- **Field mapping**: `az-{country}-{id}` externalId; `company.display_name`; `location.display_name` + `location.area[]`; `redirect_url` (url/applyUrl/jobUrl); `created` → `created_at`; `contract_time` → `jobTypes`; `category.label` → `tags`/`department`.
- **Endpoint verified** against official docs (`developer.adzuna.com/docs/search`): path, `app_id`/`app_key`, `results_per_page`, `what`, `where`, `redirect_url` confirmed 2026-09-29.

### JobsPipe
- **Coverage**: 30+ sources (job boards, public employment services, company ATS) via one normalized schema.
- **Request**: `POST https://api.jobspipe.dev/v1/jobs/search`, `Authorization: Bearer <key>`, body `{skills_or, job_title_or, posted_at_max_age_days, limit}`.
- **Local filtering still applies** afterwards (consistent with all sources).
- **Config**: `JOBSPIPE_API_KEY`, `JOB_SOURCE_JOBSPIPE_ENABLED` (default `true`), `JOBSPIPE_MONTHLY_MAX_CREDITS` (default `200`), `JOBSPIPE_MAX_CREDITS_PER_USER` (default `20`); missing key → `emptyResult("missing_config")`.
- **Field mapping**: `jp-{id}` externalId; `job_title`; `company`/`company_object.name`; `location`/`long_location`/`cities[0]`; `technology_slugs`/`keyword_slugs` → tags; `salary_string` passthrough; `employment_statuses` → `jobTypes`; `url`/`source_url`; `date_posted` → `created_at`.
- **Quota-Schutz via L1-Cache**: Roh-Payload je Query (`job-source:jobspipe:<body>|<city>`, TTL 600 s). Wiederholte identische Suchen kosten keinen Paid-Call; leere Ergebnisse werden nicht gecacht. `include_technologies` wird nicht gesetzt (Extra-Credits).
- **Verification status**: Doku per Fetch verifiziert 2026-10-01 (Filter-/Job-Schema); Live-Beweis siehe JOBSPIPE-01-Log.

### Theirstack
- **Coverage**: worldwide, 100+ Länder; besonders stark Tech/Startup-Jobs mit strukturierten Tech-/Seniority-/Gehaltsfeldern.
- **Request**: `POST https://api.theirstack.com/v1/jobs/search`, `Authorization: Bearer <key>`, Body mit `job_description_contains_or` (Skills, Whole-Word, ohne Regex-Escaping-Fallen), `job_title_or` (Zielrollen), `limit` (25 = Doku-Default/Beispiel), `page: 0` sowie Pflichtfilter `posted_at_max_age_days: 30` (API lehnt ohne Datums-/Company-Filter ab).
- **Kostenmodell (wichtig!)**: **1 Credit pro geliefertem Datensatz** (nicht pro Request) — Doku-verifiziert. Kontingent wird deshalb in Credits gezählt: `THEIRSTACK_MONTHLY_MAX_CREDITS` (Default `200`), Zähler `mj-usage:theirstack:credits:<YYYY-MM>`, bei Erreichen `emptyResult("limit_reached")` ohne Paid-Call. Cache-Hits kosten 0. Verbrauch pro Suche = Anzahl gelieferter Records (max. 25).
- **Per-User-Limit**: zusätzlich max. `THEIRSTACK_MAX_CREDITS_PER_USER` Credits pro User und Monat (Default `20`; anonyme Session = User, Zähler `mj-usage:theirstack:credits:user:<hash>:<YYYY-MM>`), bei Erreichen `emptyResult("user_limit_reached")` ohne Paid-Call. Identität kommt per `identity`-Param aus `/api/jobs` (Session-Cookie); ohne Identity greift nur der globale Guard.
- **401/403** → Credentials prüfen; **402** = Provider-Credits aufgebraucht (Upstream-Fehler + Hinweis auf Billing-Dashboard).
- **Config**: `THEIRSTACK_API_KEY`, `JOB_SOURCE_THEIRSTACK_ENABLED` (default `true`), `THEIRSTACK_MONTHLY_MAX_CREDITS` (default `200`), `THEIRSTACK_MAX_CREDITS_PER_USER` (default `20`); fehlender Key → `emptyResult("missing_config")`.
- **Field mapping** (gegen offizielle API-Referenz verifiziert): `ts-{id}` externalId; `job_title`; `company_object.name` (Fallback `company`); `location` (Fallback `long_location`); `remote`/`hybrid`-Flags → `remote`/`workplaceType`; `technology_slugs` + `seniority` → `tags`; `final_url`/`url`/`source_url` (url/applyUrl/jobUrl); `date_posted` → `created_at`; `employment_statuses[]` → `jobTypes`; `salary_string` (Fallback min/max-Range); `latitude`/`longitude`.
- **Quota-Schutz via L1-Cache**: Roh-`data`-Payload je Body (`job-source:theirstack:<body>|<city>`, TTL 600 s). Leere Ergebnisse werden nicht gecacht; `no_query` ohne Suchbegriffe (kein 40-Credit-Blindflug).

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
| JobsPipe | ✅ Implemented | `api/_lib/sources/jobspipe.mjs` (Bearer, credit-billed: 200/Monat-Default, L1-Cache) |
| Theirstack | ✅ Implemented | `api/_lib/sources/theirstack.mjs` (Bearer, credit-billed: 200/Monat-Default, L1-Cache) |

All 6 ATS providers implemented via factory pattern in `api/_lib/sources/public-ats/`. Adzuna + JobsPipe are first-class sources in `api/_lib/sources/index.mjs` (they need credentials, so they are not part of `PUBLIC_ATS_SOURCES`).

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

# JobsPipe (Bearer API key at https://jobspipe.dev/signup)
JOBSPIPE_API_KEY=your-jobspipe-key
JOB_SOURCE_JOBSPIPE_ENABLED=true
JOBSPIPE_MONTHLY_MAX_CREDITS=200
JOBSPIPE_MAX_CREDITS_PER_USER=20

# Theirstack (Bearer API key at https://app.theirstack.com/ Settings > API Keys;
# 1 credit per returned record — contingent counted in credits, not requests)
THEIRSTACK_API_KEY=your-theirstack-key
JOB_SOURCE_THEIRSTACK_ENABLED=true
THEIRSTACK_MONTHLY_MAX_CREDITS=200
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
- Key-based sources (Adzuna, JobsPipe, Theirstack, Apify) read credentials exclusively from server env vars (`ADZUNA_APP_ID/ADZUNA_APP_KEY`, `JOBSPIPE_API_KEY`, `THEIRSTACK_API_KEY`, `APIFY_API_TOKEN`) — never in frontend code, logs, or docs
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

## Key-based Sources — Capability Matrix (Adzuna / JobsPipe / Theirstack)

| Capability | Adzuna | JobsPipe | Theirstack |
|------------|:------:|:------:|:----------:|
| **Format** | JSON | JSON | JSON |
| **Auth** | `app_id` + `app_key` (query) | Bearer token (header) | Bearer token (header) |
| **Native Filter** | Keywords (`what`), location (`where`) | Skills (`skills_or`), title, date | Description/title/country/date filters |
| **Location** | `location.display_name` + `area[]` | `location`/`cities[0]` | `location` (+ `long_location` fallback) |
| **Department** | `category.label` | ❌ | ❌ |
| **Employment Type** | `contract_time` | `employment_statuses[]` | `employment_statuses[]` |
| **Workplace Type** | remote (inferred) | `remote` / `hybrid` flags | `remote` / `hybrid` flags |
| **Salary** | `salary_min`/`max` range | `salary_string` / min/max USD | `salary_string` / min/max USD |
| **Geodata** | `latitude`/`longitude` | `latitude`/`longitude` | `latitude`/`longitude` |
| **L1 Cache (600 s)** | ✅ per country+query | ✅ per body | ✅ per body |
| **Cost unit** | Free tier (per-call) | **Per returned record** (credit guard!) | **Per returned record** (credit guard!) |
| **Live-Test** | mock-only (`tests/api/adzuna-source.test.mjs`) | — | Nur bei Bedarf (`tests/api/theirstack-live.test.mjs`: `THEIRSTACK_LIVE_TESTS=1` + Key, 1 Call mit Limit 3, kostet Credits; default skipped) |

## Next Steps

All 6 ATS providers plus Adzuna, JobsPipe and Theirstack are now implemented. Future enhancements could include:
1. Add pagination support for Lever/Ashby/Workable/Recruitee
2. Add EU endpoint support for Lever (api.eu.lever.co)
3. Add auto-discovery for company identifiers
4. Per-job radius filtering once jobs carry coordinates (`latitude`/`longitude` already normalized where provided)