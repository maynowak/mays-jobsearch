# Job Sources Architecture

## Overview

The job source layer is designed to be as modular and extensible as the AI provider layer. The architecture separates:

1. **Job Source Registry** (`api/_lib/sources/index.mjs`) — the router that discovers enabled sources, fetches in parallel, merges results, and performs cross-source deduplication.
2. **Individual Source Modules** — each source implements a small, consistent interface (`id`, `displayName`, `provider`, `enabled()`, `fetchJobs()`).
3. **Apify Infrastructure** (`api/_lib/sources/apify/`) — shared code for all Apify-based sources (cache, dataset reuse, cost guard, async run + polling).
4. **Apify Actor Registry** (`api/_lib/sources/apify/actors.mjs`) — config-driven list of Actors; adding a new Apify job source = one config object.

This mirrors the AI provider pattern: Application → Job Source Registry → Sources → Jobs Pool.

---

## JobSource Interface

Each source module exports:

```js
{
  id: "arbeitnow",                    // unique source id (used in job.source[], cache keys, meta)
  displayName: "Arbeitnow",           // human-readable name
  provider: "direct-api",             // "direct-api" | "apify"
  enabled(): boolean,                 // checks config + required secrets
  fetchJobs({ skills, targetRole, city }): Promise<{ jobs, meta }>,
  // optional:
  critical: true,                     // if true, failures propagate as HttpError (default: false)
  actorId: "...",                     // for apify sources
  maxJobs: 40,                        // max jobs to return
}
```

The registry (`SOURCES` array) orders sources: Arbeitnow first, then Apify actors.

---

## Current Sources

### 1. Arbeitnow (`id: "arbeitnow"`, provider: `direct-api`)

- **Module**: `api/_lib/sources/arbeitnow.mjs`
- **API**: `https://www.arbeitnow.com/api/job-board-api` (no key required)
- **Fetch**: one page (~176 jobs), filtered by location + keyword hits, capped at 40
- **Normalization**: `compactJob()` → `source: ["arbeitnow"]`
- **Critical**: `true` — failures propagate as `HttpError` (user-visible)
- **Enable toggle**: `JOB_SOURCE_ARBEITNOW_ENABLED` (default `true`)

### 2. Arbeitsagentur (`id: "arbeitsagentur"`, provider: `apify`)

- **Module**: `api/_lib/sources/apify/actors.mjs` (config) + `api/_lib/sources/apify/index.mjs` (generic flow)
- **Actor**: `blackfalcondata~arbeitsagentur-jobs-feed`
- **Auth**: requires `APIFY_API_TOKEN`
- **Fetch**: async Actor run + polling → dataset read → filter/normalize, capped at 40
- **Normalization**: `normalizeArbeitsagentur()` → `source: ["arbeitsagentur"]`
- **Critical**: `false` — failures return empty result with `meta.reason`
- **Enable toggle**: `JOB_SOURCE_ARBEITSAGENTUR_ENABLED` (default `true`)

---

## Enabling / Disabling Sources

Each source can be independently disabled via environment variables:

| Variable | Default | Effect when `false` |
|---|---|---|
| `JOB_SOURCE_ARBEITNOW_ENABLED` | `true` | No Arbeitnow API request, no jobs from Arbeitnow |
| `JOB_SOURCE_ARBEITSAGENTUR_ENABLED` | `true` | No Apify run, no dataset read, no cache miss, no cost, no jobs from Arbeitsagentur |

**Behavior**:
- Disabled source → not in `enabledSources()`, no fetch attempted, no cost
- Other enabled sources continue to work normally
- If **all** sources disabled → clean empty state (`jobs: [], meta.totalFiltered: 0, meta.disabledSources: [...])`, no error

---

## Cache Architecture (Apify)

The Apify infrastructure uses a two-layer cache with **source-scoped keys** to avoid collisions between multiple Actors:

| Layer | Key pattern | TTL / Freshness |
|---|---|---|
| L1 — Job records | `job-source:<sourceId>:<query>|<location>` | Redis TTL 600 s (10 min) |
| L2 — Dataset pointer | `job-source:<sourceId>:dataset:<query>|<location>` | Time-of-day aware: peak 6 h / off-peak 12 h (configurable, IANA timezone) |

**Refresh policy** (preserved from original):
- L1 hit → return immediately (no dataset read, no Actor run)
- L1 miss, L2 hit **and** dataset fresh → reuse dataset, no Actor run
- L1 miss, L2 hit but **stale** → new Actor run
- L2 dataset gone (`404`/`410`) → delete pointer, new Actor run
- Transient errors (`429`, `5xx`, network, parse) → **keep** existing dataset pointer, return empty result (avoid unnecessary paid runs)

**Time-of-day window** (configurable via `api/_lib/config.mjs`):
- Peak (default 08:00–18:00 in `Europe/Berlin`) → 6 h reuse
- Off-peak → 12 h reuse
- Uses `Intl.DateTimeFormat` for automatic DST handling

---

## Cost Guard (Apify)

Before starting a new Actor run, `apifyRunLimitReached()` checks the monthly run counter (`mj-usage:apify:runs:<YYYY-MM>`). At the backstop (`APIFY_MONTHLY_MAX_RUNS`, default 30):
- No new paid run is started
- Source returns `emptyResult("limit_reached")`
- Cached and dataset-reused searches keep working
- Other sources (Arbeitnow) are unaffected

---

## Cross-Source Deduplication

The registry merges jobs from all sources and deduplicates by `title | company | location` (case-insensitive, location joined by comma):

- Duplicate jobs are merged into one
- Their `source[]` arrays are combined (e.g., `["arbeitnow", "arbeitsagentur"]`)
- Order: first occurrence wins position, sources appended

This preserves the original behavior and the `SourceBadge` / `JobSources` frontend logic.

---

## API Response (`/api/jobs`)

Extended `meta` object:

```json
{
  "jobs": [...],
  "meta": {
    "totalScanned": 176,
    "totalFiltered": 42,
    "city": ["berlin"],
    "keywords": ["frontend", "react"],
    "sources": { "arbeitnow": 25, "arbeitsagentur": 17 },
    "sourceCounts": { "arbeitnow": 22, "arbeitsagentur": 15 },
    "disabledSources": [],
    "sourceDetails": [
      { "id": "arbeitnow", "displayName": "Arbeitnow", "provider": "direct-api", "enabled": true },
      { "id": "arbeitsagentur", "displayName": "Arbeitsagentur", "provider": "apify", "enabled": true, "actorId": "blackfalcondata~arbeitsagentur-jobs-feed" }
    ],
    "jobsCombined": 37,
    "apify": { "enabled": true, "reason": null }
  }
}
```

- `sources` — per-source job counts from the raw fetch (pre-dedup)
- `sourceCounts` — per-source job counts from the final deduped pool (post-dedup, derived from `job.source[]`)
- `disabledSources` — array of registered source ids that are currently disabled
- `sourceDetails` — full registry info for each registered source
- `apify` — legacy field for the Arbeitsagentur source (retained for backward compatibility)

---

## Usage Counters (`/api/usage`)

The snapshot now includes a `jobSources` object with per-source counters:

```json
"jobSources": {
  "arbeitnow": { "requests": 42 },
  "arbeitsagentur": { "requests": 38, "runs": 5, "datasetReuses": 12, "cacheHits": 8, "cacheMisses": 3 }
}
```

- `requests` — how many times `fetchJobs` was called for this source (all sources)
- `runs` / `datasetReuses` / `cacheHits` / `cacheMisses` — Apify-specific (Apify-based sources only)
- Global legacy counters (`mj-usage:apify:*`) are kept for backward compatibility

---

## Adding a New Apify Job Source

1. Open `api/_lib/sources/apify/actors.mjs`
2. Add a new object to `APIFY_ACTORS`:

```js
{
  sourceId: "example-jobs",           // unique id (used in job.source[], cache keys)
  displayName: "Example Jobs",        // shown in UI / meta
  actorId: "someuser~some-job-actor", // Apify Actor ID
  maxJobs: 40,                        // optional, default 40
  enabled: () => getConfig().jobSourceExampleJobsEnabled, // or () => true
  buildInput: (query, location, maxJobs) => ({
    query, location, maxResults: maxJobs, mode: "full", ...
  }),
  normalize: (record) => ({
    slug: `ex-${record.id}`,
    title: record.title,
    company_name: record.company,
    location: [record.location],
    remote: false,
    tags: [],
    url: record.url,
    created_at: Date.now() / 1000,
    source: ["example-jobs"],
  }),
}
```

3. (Optional) Add `JOB_SOURCE_EXAMPLE_JOBS_ENABLED` to `api/_lib/config.mjs` and `.env.example`
4. Deploy — the new source is automatically picked up by the registry

No changes to `jobs.mjs`, `index.mjs`, or the match pipeline needed.

---

## Frontend Integration

The frontend components are **data-driven** and already support arbitrary sources:

- `src/types.ts` — `JobSource = "arbeitnow" | "arbeitsagentur"` (can be widened to `string` in the future)
- `src/components/JobSources.tsx` — iterates `job.source[]`, maps via `SOURCE_LABEL_KEYS` with fallback to raw id
- `src/components/SourceBadge.tsx` — same pattern
- `src/i18n.tsx` — label keys `source.arbeitnow`, `source.arbeitsagentur`

No new UI code is needed when a new source is added; it will automatically appear in the job sources list with its raw id as the label until a translation key is added.

---

## Migration Notes (from pre-registry architecture)

| Before | After |
|---|---|
| `job.source: ["existing" \| "apify-arbeitsagentur"]` | `job.source: ["arbeitnow" \| "arbeitsagentur"]` |
| Cache keys: `apify-jobs:...`, `apify-dataset:...` | `job-source:<sourceId>:...`, `job-source:<sourceId>:dataset:...` |
| `api/_lib/apify.mjs` monolithic | `api/_lib/sources/apify/` (client, index, actors) |
| `api/_lib/jobs.mjs` hardcoded two sources | Facade re-exporting from `sources/index.mjs` |
| `filter.mjs` contained Arbeitnow + Apify logic | Slimmed to generic utils only |
| Source enable: only via missing token | Explicit `JOB_SOURCE_*_ENABLED` env vars |

Existing cached data (old key format) will miss once on first deploy — harmless one-time cost.

---

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `JOB_SOURCE_ARBEITNOW_ENABLED` | `true` | Enable/disable Arbeitnow source |
| `JOB_SOURCE_ARBEITSAGENTUR_ENABLED` | `true` | Enable/disable Arbeitsagentur source |
| `APIFY_API_TOKEN` | (unset) | Required for Apify-based sources |
| `APIFY_MONTHLY_MAX_RUNS` | `30` | Apify run-count backstop |
| `APIFY_DATASET_REFRESH_PEAK_HOURS` | `6` | Peak dataset reuse window (hours) |
| `APIFY_DATASET_REFRESH_OFFPEAK_HOURS` | `12` | Off-peak dataset reuse window (hours) |
| `APIFY_DATASET_REFRESH_TIMEZONE` | `Europe/Berlin` | IANA timezone for peak window |
| `APIFY_DATASET_REFRESH_PEAK_START` | `08:00` | Peak window start |
| `APIFY_DATASET_REFRESH_PEAK_END` | `18:00` | Peak window end |